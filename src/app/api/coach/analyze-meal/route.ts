import { NextRequest } from "next/server";
import { requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { analyzeMealPhoto } from "@/lib/fitness/ai";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * POST /api/coach/analyze-meal
 *
 * آنالیز عکس غذا با ورودی base64 (با mimeType).
 * این مسیر توسط فراخوانی‌های JSON مستقیم استفاده می‌شود (نه فرم آپلود).
 * برای آپلود از طریق فرم، از /api/coach/meal-photo-analysis استفاده کنید.
 *
 * بهینه‌سازی: عکس قبل از ارسال به AI با sharp فشرده می‌شود
 * (resize حداکثر 1024px + WebP quality 75) → حجم کمتر، تحلیل سریع‌تر.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePlanCapability("mealPhotoAnalysis");

    // ─── M6: محدودیت نرخ — ۲۰ آنالیز در ساعت برای هر کاربر (کال VLM + sharp)
    const rl = rateLimit(`analyze-meal:${userId}`, 20, 60 * 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    const { base64Image, mimeType, userContext } = await req.json();
    if (!base64Image) {
      return Response.json({ error: "تصویر ارسال نشده." }, { status: 400 });
    }

    // ─── بهینه‌سازی تصویر قبل از ارسال به AI ───
    // حتی اگر کاربر عکس بزرگی را base64 کرده باشد، قبل از ارسال به VLM آن را فشرده می‌کنیم
    // تا سرعت بالا رود و هزینه‌ی token کم شود.
    let finalBase64 = base64Image;
    let finalMime = mimeType || "image/jpeg";
    try {
      const sharp = (await import("sharp")).default;
      const buf = Buffer.from(base64Image, "base64");
      const processed = await sharp(buf)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
      finalBase64 = processed.toString("base64");
      finalMime = "image/webp";
    } catch (err) {
      // اگر sharp نتوانست پردازش کند (مثلاً base64 خراب بود)، با همان ورودی ادامه بده
      console.error("[analyze-meal] sharp optimization failed, falling back to raw:", err);
    }

    const result = await analyzeMealPhoto(finalBase64, finalMime, userContext || "");
    return Response.json(result);
  } catch (e) {
    return apiError(e);
  }
}
