import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePlanCapability, apiError } from "@/lib/fitness/auth";
import {
  startProgramGenerationInBackground,
  PROGRAM_PREPARING_MESSAGE,
} from "@/lib/fitness/program-generation";

/**
 * PATCH /api/video-status
 *
 * آپدیت وضعیت ویدیوی فرم حرکات کاربر (فقط برای پلن Ultimate).
 * body: { status: "skipped" | "uploaded" | null }
 *
 * - null: حالت اولیه (هنوز تصمیم نگرفته) — تولید برنامه متوقف می‌ماند
 * - "skipped": کاربر نمی‌خواهد ویدیو آپلود کند — برنامه بدون تحلیل ویدیو طراحی می‌شود
 * - "uploaded": کاربر ویدیو را آپلود کرده (به‌صورت خودکار از submit-body-analysis ست می‌شود)
 *
 * مهم: تا زمانی که status برابر null باشد، تولید برنامه برای پلن Ultimate متوقف می‌ماند
 * (کاربر باید حداقل یک تصمیم بگیرد: آپلود یا skip).
 *
 * اگر با این تصمیم همه پیش‌نیازها تعیین تکلیف شده باشند، تولید برنامه
 * «در پس‌زمینه» شروع می‌شود و پاسخ شامل programStarted=true و پیام
 * «برنامه شما در حال آماده‌سازی است» است.
 */
export async function PATCH(req: NextRequest) {
  try {
    // M5: بررسی دسترسی پلن — فقط Ultimate می‌تواند videoStatus را set کند
    const { userId } = await requirePlanCapability("videoBodyAnalysis");
    const { status } = await req.json();

    if (
      status !== null &&
      status !== "skipped" &&
      status !== "uploaded"
    ) {
      return Response.json({ error: "وضعیت نامعتبر است." }, { status: 400 });
    }

    await db.user.update({
      where: { id: userId },
      data: { videoStatus: status },
    });

    // اگر تعیین تکلیف ویدیو آخرین پیش‌نیاز بود → تولید برنامه در پس‌زمینه
    let programStarted = false;
    let message =
      status === "skipped"
        ? "باشه! برنامه شما بدون تحلیل ویدیو طراحی می‌شود."
        : status === "uploaded"
        ? "ویدیوی شما ثبت شد — برنامه با تحلیل ویدیو طراحی می‌شود."
        : "وضعیت ویدیو بازنشانی شد.";

    if (status !== null) {
      const genResult = await startProgramGenerationInBackground(userId);
      if (genResult.started || genResult.reason === "already_generating") {
        programStarted = true;
        message = PROGRAM_PREPARING_MESSAGE;
      }
    }

    return Response.json({
      ok: true,
      status,
      programStarted,
      message,
    });
  } catch (e) {
    return apiError(e);
  }
}
