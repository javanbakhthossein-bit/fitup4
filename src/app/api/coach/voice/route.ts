import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * POST /api/coach/voice
 * دریافت فایل صوتی (audio/webm) و تبدیل به متن با Whisper API
 * Body: FormData with "audio" field
 * Response: { text: string }
 */
export async function POST(req: NextRequest) {
  try {
    // ─── M7: گیت پلن — ارسال ویس در چت مربی قابلیت پیشرفته (advanced+) است ───
    await requirePlanCapability("aiChat");
    const user = await requireAuth();

    // ─── H2/H6: محدودیت نرخ — ۲۰ درخواست در دقیقه برای هر کاربر ───
    const rl = rateLimit(`coach-voice:${user.id}`, 20, 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    if (!audioFile) {
      return NextResponse.json({ error: "فایل صوتی یافت نشد" }, { status: 400 });
    }

    // ارسال به Whisper API (AvalAI — OpenAI compatible)
    // استفاده از کلید TTS (همان کلیدی که برای سرویس‌های صوتی استفاده می‌شود)
    const apiKey = process.env.AVALAI_TTS_API_KEY || process.env.AVALAI_API_KEY;
    const baseURL = process.env.AVALAI_BASE_URL || "https://api.avalai.ir/v1";

    if (!apiKey) {
      return NextResponse.json({ error: "سرویس صوتی پیکربندی نشده" }, { status: 503 });
    }

    // ساخت FormData برای Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "voice.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "fa");

    const res = await fetch(`${baseURL}/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: whisperForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[voice] Whisper error:", res.status, errText);
      return NextResponse.json({ error: "خطا در تبدیل صدا به متن" }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text || "" });
  } catch (e) {
    return apiError(e);
  }
}
