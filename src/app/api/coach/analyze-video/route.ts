import { NextRequest } from "next/server";
import { requireAuth, requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { analyzeVideoFromPath } from "@/lib/fitness/ai";
import { db } from "@/lib/db";
import { getCapabilities } from "@/lib/fitness/types";
import { savePrivateMediaFile } from "@/lib/fitness/private-media";

/**
 * POST /api/coach/analyze-video
 *  - نیازمند پلن حرفه‌ای (Ultimate) — قابلیت videoBodyAnalysis (آلیاس videoAnalysis)
 *  - محدودیت پلن: videoAnalysisLimit (۱۰ بار در پلن Ultimate)
 *  - پس از تحلیل موفق، نتیجه در AnalysisResult ذخیره می‌شود و شمارنده videoAnalysisUsed افزایش می‌یابد.
 *
 * multipart/form-data:
 *   - video: File (ویدیوی فرم بدن) — الزامی
 *   - userContext: string — اختیاری
 *
 * ۱. ویدیو در uploads/videos/ (خارج از public) ذخیره می‌شود (نه ارسال base64 خام)
 *    و فقط از طریق /api/serve-upload با احراز هویت سرو می‌شود.
 * ۲. مسیر فایل به `analyzeVideoFromPath` داده می‌شود:
 *    - ffmpeg فریم وسط ویدیو را استخراج می‌کند
 *    - فریم به VLM ارسال می‌شود (VLM از ویدیو پشتیبانی نمی‌کند، فقط عکس)
 * ۳. نتیجه در AnalysisResult با mediaUrl ویدیو ذخیره می‌شود.
 *
 * GET /api/coach/analyze-video
 *  - آخرین نتیجه ذخیره‌شده کاربر را برمی‌گرداند (تا رفرش صفحه اطلاعات را از دست ندهد).
 */

// حداکثر حجم ویدیو: ۳۰ مگابایت
// (توسط هر دو سمت کلاینت و سرور اعمال می‌شود)
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

// پسوندهای مجاز
const ALLOWED_VIDEO_EXTS = ["mp4", "webm", "mov", "m4v", "mkv"];

export async function POST(req: NextRequest) {
  try {
    const { userId, planName } = await requirePlanCapability("videoBodyAnalysis");

    // === اعمال محدودیت واقعی پلن ===
    const limit = getCapabilities(planName).videoAnalysisLimit;
    const user = await db.user.findUnique({ where: { id: userId }, select: { videoAnalysisUsed: true } });
    const used = user?.videoAnalysisUsed ?? 0;
    if (limit > 0 && used >= limit) {
      return Response.json(
        { error: "سقف استفاده از این قابلیت پر شده است.", code: "LIMIT_REACHED" },
        { status: 403 }
      );
    }

    // === خواندن FormData به‌جای JSON ===
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json(
        { error: "درخواست باید multipart/form-data باشد.", code: "INVALID_FORMAT" },
        { status: 400 }
      );
    }

    const videoField = formData.get("video");
    const userContext = formData.get("userContext");

    if (!videoField || !(videoField instanceof File) || videoField.size === 0) {
      return Response.json(
        { error: "ویدیو ارسال نشده.", code: "NO_VIDEO" },
        { status: 400 }
      );
    }

    const video = videoField as File;

    // === اعتبارسنجی حجم (۳۰MB) ===
    if (video.size > MAX_VIDEO_BYTES) {
      const sentMB = Math.round(video.size / (1024 * 1024));
      const maxMB = Math.round(MAX_VIDEO_BYTES / (1024 * 1024));
      return Response.json(
        {
          error: `حجم ویدیو زیاد است (${sentMB}MB). حداکثر مجاز ${maxMB}MB است.`,
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    // === اعتبارسنجی نوع فایل ===
    if (!video.type.startsWith("video/")) {
      return Response.json(
        { error: "فقط فایل ویدیویی مجاز است.", code: "INVALID_TYPE" },
        { status: 400 }
      );
    }

    const userContextStr = typeof userContext === "string" ? userContext : "تحلیل فرم بدن و تکنیک حرکات ورزشی";

    // === ذخیره ویدیو در uploads/videos/ (خارج از public — سرو با احراز هویت) ===
    const originalExt = (video.name.split(".").pop() || "").toLowerCase();
    const finalExt = ALLOWED_VIDEO_EXTS.includes(originalExt) ? originalExt : "mp4";
    const fileName = `video-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${finalExt}`;
    const buffer = Buffer.from(await video.arrayBuffer());
    const { url: fileUrl, filePath } = await savePrivateMediaFile("videos", fileName, buffer);

    // === تحلیل ویدیو (با استخراج فریم ffmpeg) ===
    // این تابع فریم وسط ویدیو را با ffmpeg استخراج می‌کند و آن را به VLM می‌دهد.
    // اگر ffmpeg نصب نباشد، پیام واضح برمی‌گرداند.
    const result = await analyzeVideoFromPath(filePath, userContextStr);

    // === ذخیره نتیجه در DB + افزایش شمارنده استفاده ===
    await db.$transaction([
      db.analysisResult.create({
        data: {
          userId,
          type: "video_analysis",
          result: JSON.stringify(result),
          mediaUrl: fileUrl,
        },
      }),
      db.user.update({
        where: { id: userId },
        data: { videoAnalysisUsed: { increment: 1 } },
      }),
    ]);

    return Response.json(result);
  } catch (e) {
    return apiError(e);
  }
}

export async function GET() {
  try {
    // ─── مشاهده نتیجه ذخیره‌شده فقط نیازمند لاگین است (باگ 2-b) ───
    // قبلاً GET هم قابلیت Ultimate می‌خواست → بعد از انقضای اشتراک، کاربر
    // دسترسی به نتیجه‌ای که قبلاً برایش پول داده بود را از دست می‌داد.
    // تحلیل جدید (POST) همچنان gated است — فقط «مشاهده» آزاد شد.
    const user = await requireAuth();
    const userId = user.id;
    const latest = await db.analysisResult.findFirst({
      where: { userId, type: "video_analysis" },
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
