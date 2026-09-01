import { NextRequest } from "next/server";
import { requireAuth, requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { analyzeBloodTest } from "@/lib/fitness/ai";
import { db } from "@/lib/db";
import { getCapabilities } from "@/lib/fitness/types";
import { startProgramGenerationInBackground } from "@/lib/fitness/program-generation";

/**
 * POST /api/coach/analyze-blood
 *  - نیازمند پلن حرفه‌ای (Ultimate) — قابلیت bloodTestAnalysis (آلیاس bloodTest)
 *  - محدودیت پلن: bloodTestLimit (۱ بار در پلن Ultimate)
 *  - پس از تحلیل موفق، نتیجه در AnalysisResult ذخیره می‌شود و شمارنده bloodTestUsed افزایش می‌یابد.
 *
 * GET /api/coach/analyze-blood
 *  - آخرین نتیجه ذخیره‌شده کاربر را برمی‌گرداند (تا رفرش صفحه اطلاعات را از دست ندهد).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, planName } = await requirePlanCapability("bloodTestAnalysis");
    const { base64Image, mimeType } = await req.json();
    if (!base64Image || typeof base64Image !== "string")
      return Response.json({ error: "تصویر ارسال نشده." }, { status: 400 });

    // === گیت حجم payload (base64) ===
    // عکس‌های موبایل (۴-۱۲MP) به رشته base64 چند مگابایتی تبدیل می‌شوند؛ بدون این
    // گیت، کل رشته در حافظه نگه داشته می‌شود و پشت پراکسی‌های رایج (nginx با
    // client_max_body_size پیش‌فرض ۱MB) درخواست 413 می‌گیرد.
    // ۸ مگابایت base64 ≈ ۶ مگابایت عکس خام.
    const MAX_BASE64_CHARS = 8 * 1024 * 1024;
    if (base64Image.length > MAX_BASE64_CHARS) {
      return Response.json(
        { error: "حجم تصویر زیاد است (حداکثر ~۶ مگابایت). لطفاً از تصویر کوچک‌تری استفاده کنید." },
        { status: 413 }
      );
    }

    // === اعمال محدودیت واقعی پلن ===
    const limit = getCapabilities(planName).bloodTestLimit;
    const user = await db.user.findUnique({ where: { id: userId }, select: { bloodTestUsed: true } });
    const used = user?.bloodTestUsed ?? 0;
    if (limit > 0 && used >= limit) {
      return Response.json(
        { error: "سقف استفاده از این قابلیت پر شده است.", code: "LIMIT_REACHED" },
        { status: 403 }
      );
    }

    // === فشرده‌سازی با sharp قبل از ارسال به VLM (همان الگوی بقیه جریان‌های مدیا) ===
    // عکس خام آزمایشگاه ۳-۸MB است؛ resize به حداکثر ۲۰۰۰px + WebP هم payload ارسالی
    // به AvalAI را کوچک می‌کند و هم خوانایی متن گزارش را حفظ می‌کند.
    const sharp = (await import("sharp")).default;
    let vlmBase64 = base64Image;
    let vlmMime = typeof mimeType === "string" && mimeType ? mimeType : "image/jpeg";
    try {
      const raw = Buffer.from(base64Image, "base64");
      const processed = await sharp(raw)
        .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      vlmBase64 = processed.toString("base64");
      vlmMime = "image/webp";
    } catch (sharpErr) {
      // تصویر خراب/نامعتبر — پیام واضح بده تا VLM با خطای مبهم fail نکند
      console.error("[analyze-blood] sharp compression failed:", sharpErr);
      return Response.json(
        { error: "پردازش تصویر ناموفق بود. لطفاً یک تصویر معتبر (JPG/PNG/WebP) ارسال کنید." },
        { status: 400 }
      );
    }

    const result = await analyzeBloodTest(vlmBase64, vlmMime);

    // === ذخیره نتیجه در DB + افزایش شمارنده استفاده ===
    await db.$transaction([
      db.analysisResult.create({
        data: {
          userId,
          type: "blood_test",
          result: JSON.stringify(result),
          mediaUrl: null,
        },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          bloodTestUsed: { increment: 1 },
          // آپلود نتایج = تعیین تکلیف پیش‌نیاز آزمایش خون
          bloodTestStatus: "uploaded",
        },
      }),
    ]);

    // اگر آپلود آزمایش خون آخرین پیش‌نیاز بود → تولید برنامه در پس‌زمینه شروع شود
    let programStarted = false;
    try {
      const gen = await startProgramGenerationInBackground(userId);
      programStarted = gen.started || gen.reason === "already_generating";
    } catch (genErr) {
      console.error("[analyze-blood] failed to start background generation:", genErr);
    }

    return Response.json({ ...result, programStarted });
  } catch (e) {
    return apiError(e);
  }
}

export async function GET() {
  try {
    // ─── مشاهده نتیجه ذخیره‌شده فقط نیازمند لاگین است (باگ 2-b) ───
    // تحلیل جدید (POST) همچنان قابلیت Ultimate می‌خواهد — فقط «مشاهده»
    // نتیجه‌ای که کاربر قبلاً برایش پول داده آزاد شد (داده در DB می‌ماند).
    const user = await requireAuth();
    const userId = user.id;
    const latest = await db.analysisResult.findFirst({
      where: { userId, type: "blood_test" },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) {
      return Response.json({ result: null });
    }
    try {
      return Response.json({
        result: JSON.parse(latest.result),
        createdAt: latest.createdAt.toISOString(),
      });
    } catch {
      return Response.json({ result: null });
    }
  } catch (e) {
    return apiError(e);
  }
}
