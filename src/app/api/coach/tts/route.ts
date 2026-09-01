import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { db } from "@/lib/db";
import { generateTTSFullText } from "@/lib/fitness/tts";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";

/** حداکثر طول متن ورودی برای TTS — هر چانک ~۳۰ ثانیه زمان می‌برد؛ متن خیلی طولانی = هزینه/کندی بالا */
const MAX_TTS_TEXT_CHARS = 4000;

/**
 * POST /api/coach/tts
 * تبدیل متن فارسی به صدا با Gemini 2.5 Flash TTS (با fallback به tts-1)
 * Body: { text: string }
 * Response: audio/mpeg (MP3)
 *
 * شامل:
 *  - retry logic برای خطاهای گذرا (429, 500, 502, 503, 504)
 *  - fallback به مدل tts-1
 *  - chunk کردن متن‌های طولانی
 *  - انتخاب صدا بر اساس جنسیت کاربر
 */
export async function POST(req: NextRequest) {
  try {
    // ─── M7: گیت پلن — TTS مربی (گوش دادن به پاسخ‌ها) قابلیت چت پیشرفته (advanced+) است ───
    await requirePlanCapability("aiChat");
    const user = await requireAuth();

    // ─── H2/H6: محدودیت نرخ — ۲۰ درخواست در دقیقه برای هر کاربر ───
    const rl = rateLimit(`coach-tts:${user.id}`, 20, 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "متن خالی است" }, { status: 400 });
    }

    // ─── سقف طول متن — جلوگیری از چانک‌های بی‌شمار و هزینه/کندی بالا ───
    if (text.length > MAX_TTS_TEXT_CHARS) {
      return NextResponse.json(
        { error: "متن بیش از حد طولانی است (حداکثر ۴۰۰۰ کاراکتر)." },
        { status: 400 }
      );
    }

    // ─── تعیین صدای TTS بر اساس جنسیت کاربر ───
    let voice: string = "alloy"; // پیش‌فرض: صدای مرد
    try {
      const profile = await db.onboardingProfile.findUnique({
        where: { userId: user.id },
        select: { gender: true },
      });
      if (profile?.gender === "female") {
        voice = "shimmer"; // صدای زن
      }
    } catch {
      // اگر پروفایل پیدا نشد، پیش‌فرض (alloy) استفاده می‌شود
    }

    // ─── تولید صدا با retry + fallback + chunking ───
    const audioBuffer = await generateTTSFullText(text, voice);

    if (!audioBuffer) {
      return NextResponse.json(
        { error: "خطا در تولید صدا. لطفاً دوباره تلاش کنید." },
        { status: 502 }
      );
    }

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'inline; filename="speech.mp3"',
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
