import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { analyzeBodyPhoto, analyzeVideoFromPath } from "@/lib/fitness/ai";
import { readFile } from "fs/promises";
import { savePrivateMediaFile } from "@/lib/fitness/private-media";
import { toPersianDigits } from "@/lib/fitness/types";
import { checkPrerequisites } from "@/lib/fitness/prerequisites";
import { createNotification } from "@/lib/fitness/notifications";
import {
  startProgramGenerationInBackground,
  PROGRAM_PREPARING_MESSAGE,
} from "@/lib/fitness/program-generation";

/**
 * GET /api/coach/submit-body-analysis
 * بررسی وضعیت ارسال مدیای بدن برای کاربر فعلی.
 * پاسخ شامل:
 *  - needsBodyPhoto: آیا عکس بدن لازم است؟ (Advanced / Ultimate)
 *  - canSubmitVideo: آیا کاربر می‌تواند ویدیو ارسال کند؟ (Ultimate) — ویدیو اختیاری است
 *  - pendingStatus: وضعیت فعلی ProgramRequest (pending_body_photo / pending_body_media / ready / ...)
 *  - hasWorkoutPlan: آیا برنامه تمرینی فعال دارد؟
 */
export async function GET() {
  try {
    const { userId, planName } = await requirePlanCapability("bodyPhotoAnalysis");

    const needsBodyPhoto = planName === "advanced" || planName === "ultimate";
    // ویدیو برای Ultimate اختیاری است (نه الزامی)
    const canSubmitVideo = planName === "ultimate";

    const [latestReq, workout] = await Promise.all([
      db.programRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
      db.workoutPlan.findFirst({
        where: { userId, active: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const pendingStatus = latestReq?.status ?? null;
    const hasWorkoutPlan = !!workout;

    // ─── بررسی پیش‌نیازها ───
    const prereqCheck = await checkPrerequisites(userId, planName as any);

    // بنر آپلود فقط زمانی نشان داده شود که عکس بدن واقعاً آپلود نشده
    // نه زمانی که برنامه در حال ساخت است (generating) یا ساخته شده (hasWorkoutPlan)
    const bodyPhotoPrereq = prereqCheck.prerequisites.find((p) => p.type === "body_photo");
    const bodyPhotoIncomplete = bodyPhotoPrereq && bodyPhotoPrereq.status !== "completed";
    const awaitingMedia =
      needsBodyPhoto &&
      !hasWorkoutPlan &&
      bodyPhotoIncomplete &&
      pendingStatus !== "generating" &&
      pendingStatus !== "ready";

    return Response.json({
      needsBodyPhoto,
      canSubmitVideo,
      pendingStatus,
      hasWorkoutPlan,
      awaitingMedia,
      // اطلاعات پیش‌نیازها برای نمایش دانه‌دانه در UI
      prerequisites: prereqCheck.prerequisites,
      canGenerateProgram: prereqCheck.canGenerateProgram,
      blockingReason: prereqCheck.blockingReason,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST /api/coach/submit-body-analysis
 * multipart/form-data:
 *   - bodyPhotos: File[] (۱ تا ۴ تصویر) — الزامی
 *   - bodyVideo: File (اختیاری — برای Ultimate کاربران می‌توانند ویدیو هم ارسال کنند)
 *
 * این صفحه فقط مسئول «پیش‌نیاز عکس بدن» است — تولید برنامه اینجا انجام نمی‌شود:
 *  ۱. عکس‌ها (و ویدیو در صورت ارسال) در public/uploads/body-analysis ذخیره می‌کند.
 *  ۲. در ProgressPhoto ثبت می‌کند (type=front/side/back/custom).
 *  ۳. هر عکس را با `analyzeBodyPhoto` (VLM) تحلیل و نتیجه را در AnalysisResult ذخیره می‌کند.
 *  ۴. در صورت ارسال ویدیو، آن را هم تحلیل می‌کند (اختیاری — خطا برنامه را متوقف نمی‌کند).
 *  ۵. اگر همه پیش‌نیازها تعیین تکلیف شده باشند، تولید برنامه «در پس‌زمینه» شروع
 *     می‌شود (startProgramGenerationInBackground) و پاسخ فوری با pendingStatus="generating"
 *     برمی‌گردد — UI پیام «برنامه شما در حال آماده‌سازی است» نشان می‌دهد و نوتیفیکیشن
 *     «برنامه آماده شد» بعداً می‌رسد.
 *
 * (سابقاً تولید برنامه سینکرون داخل همین request بود و ۲ تا ۵ دقیقه طول می‌کشید →
 * تایم‌اوت گیت‌وی → خطای «پاسخ سرور نامعتبر» در UI ولی برنامه در پس‌زمینه ساخته می‌شد.)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, planName } = await requirePlanCapability("bodyPhotoAnalysis");

    // ویدیو برای Ultimate اختیاری است (هیچ پلنی برای ویدیو الزامی نیست)
    const canSubmitVideo = planName === "ultimate";

    const formData = await req.formData();
    const photoFiles = formData.getAll("bodyPhotos").filter(
      (f): f is File => f instanceof File && f.size > 0 && f.type.startsWith("image/")
    );
    const videoFile = formData.get("bodyVideo");
    const video = videoFile instanceof File && videoFile.size > 0 ? videoFile : null;

    // اعتبارسنجی حداقل‌ها
    if (photoFiles.length === 0) {
      return Response.json(
        { error: "حداقل یک عکس از بدن ارسال کنید." },
        { status: 400 }
      );
    }
    if (photoFiles.length > 4) {
      return Response.json(
        { error: "حداکثر ۴ عکس مجاز است." },
        { status: 400 }
      );
    }
    // ویدیو کاملاً اختیاری است — حتی برای Ultimate — هیچ الزامی وجود ندارد.
    // (اگر کاربر Ultimate ویدیو فرستاد، آن را تحلیل می‌کنیم؛ اگر نفرستاد، برنامه بدون آن ساخته می‌شود.)
    void canSubmitVideo; // for clarity — variable intentionally unused beyond documentation

    // اعتبارسنجی حجم — عکس‌ها ۳۰MB (بعد از فشرده‌سازی سمت کلاینت)، ویدیو ۵۰MB
    for (const f of photoFiles) {
      if (f.size > 30 * 1024 * 1024) {
        return Response.json({ error: "حجم هر عکس نباید بیشتر از ۳۰ مگابایت باشد (خودکار کاهش می‌یابد)." }, { status: 400 });
      }
    }
    if (video && video.size > 50 * 1024 * 1024) {
      return Response.json({ error: "حجم ویدیو نباید بیشتر از ۵۰ مگابایت باشد." }, { status: 400 });
    }
    // اعتبارسنجی MIME ویدیو — الگوی مشابه analyze-video:
    // بدون این بررسی، هر فایلی (PDF/ZIP و…) با نام .mp4 به‌عنوان ویدیو ذخیره می‌شد.
    if (video && !video.type.startsWith("video/")) {
      return Response.json({ error: "فقط فایل ویدیویی مجاز است." }, { status: 400 });
    }

    // ─── تعیین تکلیف ویدیو (وظیفه ۷-۸) ───
    // اگر کاربر پلن Ultimate دارد:
    //   - اگر ویدیو آپلود کرده → videoStatus = "uploaded"
    //   - اگر ویدیو آپلود نکرده → videoStatus = "skipped" (یعنی تصمیم صریح گرفته)
    // این کار تضمین می‌کند که پس از ارسال عکس بدن، ویدیو حتماً تعیین تکلیف شده است.
    if (planName === "ultimate") {
      const userRecord = await db.user.findUnique({
        where: { id: userId },
        select: { videoStatus: true },
      });
      // فقط اگر قبلاً "uploaded" نبوده، آپدیت کن (تا روی آپلود قبلی override نکند)
      const newVideoStatus = video ? "uploaded" : (userRecord?.videoStatus === "uploaded" ? "uploaded" : "skipped");
      if (userRecord?.videoStatus !== newVideoStatus) {
        await db.user.update({
          where: { id: userId },
          data: { videoStatus: newVideoStatus },
        });
      }
    }

    // ذخیره فایل‌ها — در uploads/body-analysis/ (خارج از public؛ سرو با احراز هویت از طریق serve-upload)
    const savedPhotoUrls: string[] = [];
    const savedPhotoPaths: string[] = [];
    const savedPhotoMimeTypes: string[] = [];
    const photoTypes = ["front", "side", "back", "custom"];
    const photoAngleNames = ["جلو", "پهلو", "پشت", "سه‌چهارم"]; // برسی زاویه عکس برای پرامپت VLM

    // ─── بهینه‌سازی عکس‌ها با sharp: resize به 1024px + WebP q80 ───
    // این کار حجم عکس را به‌شدت کاهش می‌دهد و سرعت آپلود + تحلیل را بالا می‌برد.
    // 1024px برای ارزیابی فرم بدن توسط VLM کافی است و token کمتری مصرف می‌کند.
    const sharp = (await import("sharp")).default;
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const buffer = Buffer.from(await file.arrayBuffer());

      // کاهش حجم + resize به حداکثر 1024px + WebP (per FOOD-ANALYSIS-LOGGING spec)
      const processed = await sharp(buffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      const fileName = `body-${userId}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}.webp`;
      const { url, filePath } = await savePrivateMediaFile("body-analysis", fileName, processed);
      savedPhotoUrls.push(url);
      savedPhotoPaths.push(filePath);
      savedPhotoMimeTypes.push("image/webp");
    }

    let savedVideoUrl: string | null = null;
    let savedVideoPath: string | null = null;
    let savedVideoMimeType: string | null = null;
    if (video) {
      const allowedVidExts = ["mp4", "webm", "mov", "m4v", "mkv"];
      const vext = (video.name.split(".").pop() || "").toLowerCase();
      const finalVext = allowedVidExts.includes(vext) ? vext : "mp4";
      const vFileName = `body-video-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${finalVext}`;
      const vBuffer = Buffer.from(await video.arrayBuffer());
      const { url: vUrl, filePath: vFilePath } = await savePrivateMediaFile("body-analysis", vFileName, vBuffer);
      savedVideoUrl = vUrl;
      savedVideoPath = vFilePath;
      savedVideoMimeType = video.type || "video/mp4";
    }

    const profile = await db.onboardingProfile.findUnique({ where: { userId } });
    if (!profile) {
      return Response.json({ error: "ابتدا آنبوردینگ را تکمیل کنید." }, { status: 400 });
    }

    // ─── تحلیل هر عکس بدن با VLM — موازی برای سرعت بیشتر ───
    // هر عکس را از روی دیسک می‌خوانیم، به base64 تبدیل می‌کنیم و به `analyzeBodyPhoto`
    // می‌دهیم. اگر تحلیل یک عکس خطا دهد، آن را رد می‌کنیم ولی به بقیه ادامه می‌دهیم.
    const bodyAnalyses: string[] = [];
    const analysisResults = await Promise.allSettled(
      savedPhotoPaths.map(async (photoPath, i) => {
        const buffer = await readFile(photoPath);
        const base64 = buffer.toString("base64");
        const mimeType = savedPhotoMimeTypes[i];
        const angleLabel = photoAngleNames[i] || "اضافی";
        const userContext = `این عکس زاویه ${angleLabel} از بدن ورزشکار است. هدف ورزشکار: ${profile.goal || "نامشخص"}. فرم بدن، تعادل عضلانی، نقاط ضعف و قوت را تحلیل کن.`;
        const analysis = await analyzeBodyPhoto(base64, mimeType, userContext);
        return `زاویه ${i + 1} (${angleLabel}):\nامتیاز فرم: ${toPersianDigits(analysis.bodyScore)} از ۱۰۰\nتحلیل: ${analysis.analysis}\nتوصیه‌ها: ${analysis.recommendations.join("، ")}`;
      })
    );
    analysisResults.forEach((res, i) => {
      if (res.status === "fulfilled") {
        bodyAnalyses.push(res.value);
      } else {
        console.error(`[submit-body-analysis] photo ${i + 1} analysis failed:`, res.reason);
        // ادامه حتی اگر یک عکس خطا دهد
      }
    });

    const combinedBodyAnalysis = bodyAnalyses.length > 0
      ? `تحلیل عکس‌های بدن ورزشکار (${toPersianDigits(bodyAnalyses.length)} عکس):\n\n${bodyAnalyses.join("\n\n")}`
      : "";

    // ─── تحلیل ویدیو (اختیاری) ───
    // اگر ویدیو فرستاده شده باشد، آن را هم تحلیل می‌کنیم. خطای تحلیل ویدیو هرگز
    // نباید جلوی ادامه را بگیرد — این بخش کاملاً optional است.
    let videoAnalysisResult = "";
    if (video && savedVideoPath && savedVideoMimeType) {
      try {
        // تحلیل مستقیم از مسیر فایل ذخیره‌شده (بدون roundtrip base64 ~۶۷MB —
        // analyzeVideoBody خودش base64 → tmp file → unlink می‌کرد؛ اینجا فایل
        // از قبل روی دیسک هست، پس analyzeVideoFromPath مستقیماً صدا زده می‌شود)
        const vResult = await analyzeVideoFromPath(savedVideoPath, "تحلیل فرم بدن و تکنیک حرکات ورزشی");
        videoAnalysisResult = `تحلیل ویدیوی فرم بدن:\nپوسچر: ${vResult.posture}\nتقارن: ${toPersianDigits(vResult.symmetry)} از ۱۰۰\nامتیاز: ${toPersianDigits(vResult.score)} از ۱۰۰\nمشکلات: ${vResult.issues.join("، ")}\nتوصیه‌ها: ${vResult.recommendations.join("، ")}`;
      } catch (e) {
        console.error("[submit-body-analysis] video analysis failed:", e);
        // تحلیل ویدیو اختیاری است — بدون آن ادامه می‌دهیم
      }
    }

    // ─── persist کردن تحلیل عکس بدن و ویدیو به AnalysisResult ───
    // این نتایج برای تولید برنامه در پس‌زمینه لازم است تا AI بتواند
    // از تحلیل‌ها استفاده کند (buildGenerationExtras این‌ها را می‌خواند).
    if (combinedBodyAnalysis) {
      try {
        await db.analysisResult.create({
          data: {
            userId,
            type: "body_photo",
            result: JSON.stringify({
              analysis: combinedBodyAnalysis,
              createdAt: new Date().toISOString(),
              photoCount: bodyAnalyses.length,
            }),
            mediaUrl: savedPhotoUrls[0] || null,
          },
        });
      } catch (e) {
        console.error("[submit-body-analysis] failed to persist body photo analysis:", e);
      }
    }

    // ─── ثبت عکس‌ها در ProgressPhoto — بعد از persist شدن تحلیل ───
    // ترتیب مهم است: وجود ردیف ProgressPhoto «پیش‌نیاز body_photo» را کامل می‌کند
    // (prerequisites.ts). اگر این ردیف‌ها قبل از تحلیل VLM ساخته می‌شدند، در
    // پنجره چند‌ده‌ثانیه‌ای تحلیل، یک تریگر همزمان (video-status/blood-test-status/
    // plan/watchdog) می‌توانست تولید برنامه را «بدون» تحلیل عکس بدن شروع کند.
    // پس اول نتیجه تحلیل در AnalysisResult ذخیره می‌شود، بعد ردیف‌ها ساخته می‌شوند
    // تا «کامل شدن پیش‌نیاز» همیشه به معنای «تحلیل ذخیره‌شده» باشد.
    // (اگر تحلیل هیچ عکسی موفق نشده باشد، ردیفی نمی‌سازیم تا مسیر تولید برنامه
    // بدون تحلیل باز نماند و کاربر بتواند دوباره ارسال کند.)
    if (bodyAnalyses.length > 0) {
      for (let i = 0; i < savedPhotoUrls.length; i++) {
        await db.progressPhoto.create({
          data: {
            userId,
            imageUrl: savedPhotoUrls[i],
            type: photoTypes[i] ?? "custom",
            note: "آپلود برای طراحی برنامه (Body Analysis)",
          },
        });
      }
    }
    if (videoAnalysisResult) {
      try {
        await db.analysisResult.create({
          data: {
            userId,
            type: "video_analysis",
            result: JSON.stringify({
              analysis: videoAnalysisResult,
              createdAt: new Date().toISOString(),
            }),
            mediaUrl: savedVideoUrl,
          },
        });
      } catch (e) {
        console.error("[submit-body-analysis] failed to persist video analysis:", e);
      }
    }

    // ─── شروع تولید برنامه در پس‌زمینه (نه در این request) ───
    // این صفحه فقط پیش‌نیاز «عکس بدن» را کامل می‌کند. اگر با این ارسال، همه
    // پیش‌نیازها تعیین تکلیف شده باشند، تولید برنامه به‌صورت پس‌زمینه شروع می‌شود
    // و پاسخ فوری برمی‌گردد — UI پیام «برنامه شما در حال آماده‌سازی است» نشان می‌دهد.
    const prereqCheck = await checkPrerequisites(userId, planName as any);
    if (!prereqCheck.canGenerateProgram) {
      // هنوز پیش‌نیاز باقی مانده (مثلاً تعیین تکلیف ویدیو/آزمایش خون برای Ultimate)
      const latestReq = await db.programRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (latestReq) {
        await db.programRequest.update({
          where: { id: latestReq.id },
          data: { status: "pending_body_photo" },
        });
      }

      await createNotification(
        userId,
        "system",
        "عکس‌های بدن شما ذخیره شد 📸",
        `عکس‌های بدن شما با موفقیت ذخیره و تحلیل شد. برای شروع ساخت برنامه، ${prereqCheck.blockingReason ?? "پیش‌نیازهای باقی‌مانده را تعیین تکلیف کنید"}.`,
        "?tab=dashboard"
      );

      return Response.json({
        ok: true,
        photos: savedPhotoUrls,
        video: savedVideoUrl,
        analyzedPhotosCount: bodyAnalyses.length,
        hasWorkoutPlan: false,
        pendingStatus: "pending_body_photo",
        awaitingMedia: false,
        awaitingDecision: true,
        programStarted: false,
        message: prereqCheck.blockingReason ?? "پیش‌نیازهای باقی‌مانده را تعیین تکلیف کنید.",
        prerequisites: prereqCheck.prerequisites,
      });
    }

    // همه پیش‌نیازها تعیین تکلیف شده‌اند → تولید برنامه در پس‌زمینه
    const genResult = await startProgramGenerationInBackground(userId);

    if (genResult.started || genResult.reason === "already_generating") {
      const analyzedPhotosNote = bodyAnalyses.length > 0
        ? `بر اساس ${toPersianDigits(bodyAnalyses.length)} عکس بدن شما${videoAnalysisResult ? " و ویدیوی فرم حرکات" : ""}`
        : "بر اساس اطلاعات شما";
      await createNotification(
        userId,
        "system",
        "برنامه شما در حال آماده‌سازی است ⏳",
        `${analyzedPhotosNote}، فیتاپ هوشمند طراحی برنامه تمرینی و غذایی شما را شروع کرد. پس از آماده‌سازی به شما اطلاع می‌دهیم.`,
        "?tab=programs"
      );
      return Response.json({
        ok: true,
        photos: savedPhotoUrls,
        video: savedVideoUrl,
        analyzedPhotosCount: bodyAnalyses.length,
        hasWorkoutPlan: false,
        pendingStatus: "generating",
        awaitingMedia: false,
        programStarted: true,
        message: PROGRAM_PREPARING_MESSAGE,
      });
    }

    // تولید شروع نشد (مثلاً already_has_fresh_plan یا no_plan) — وضعیت فعلی را برگردان
    return Response.json({
      ok: true,
      photos: savedPhotoUrls,
      video: savedVideoUrl,
      analyzedPhotosCount: bodyAnalyses.length,
      hasWorkoutPlan: false,
      pendingStatus: genResult.reason ?? null,
      awaitingMedia: false,
      programStarted: false,
      message: "عکس‌های بدن شما ذخیره و تحلیل شد. وضعیت برنامه خود را از بخش «برنامه‌ها» بررسی کنید.",
    });
  } catch (e) {
    return apiError(e);
  }
}
