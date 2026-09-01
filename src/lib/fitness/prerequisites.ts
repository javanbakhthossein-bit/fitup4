import { db } from "@/lib/db";
import type { Plan } from "@/lib/fitness/types";

/**
 * سیستمی برای بررسی پیش‌نیازهای ساخت برنامه بر اساس پلن کاربر.
 *
 * پیش‌نیازها بر اساس پلن:
 * - advanced / ultimate: عکس بدن (الزامی)
 * - ultimate: ویدیوی فرم حرکات (اختیاری — اما باید تعیین تکلیف شود: آپلود یا skip)
 * - ultimate: آزمایش خون (اختیاری — اما باید تعیین تکلیف شود: آپلود، waiting، یا skip)
 * - همه پلن‌ها: اندازه‌های بدنی (تشویقی، نه الزامی)
 *
 * وضعیت‌های ممکن هر پیش‌نیاز:
 * - "completed": تکمیل شده (آپلود شده یا skip شده)
 * - "pending": در انتظار (مثلاً کاربر آزمایش داده و منتظر نتایج است)
 * - "pending_decision": تعیین تکلیف نشده — کاربر باید تصمیم بگیرد
 * - "incomplete": هنوز انجام نشده (برای موارد الزامی مثل عکس بدن)
 */

export type PrerequisiteStatus =
  | "completed"
  | "pending"
  | "pending_decision"
  | "incomplete";

export interface Prerequisite {
  id: string;
  /** نوع پیش‌نیاز: body_photo | video_body | blood_test | body_measurements */
  type: "body_photo" | "video_body" | "blood_test" | "body_measurements";
  label: string;
  description: string;
  /** آیا این پیش‌نیاز برای ساخت برنامه الزامی است؟ */
  required: boolean;
  /** وضعیت فعلی پیش‌نیاز */
  status: PrerequisiteStatus;
  /** متن فارسی وضعیت فعلی */
  statusLabel: string;
  /** تب مربوط به این پیش‌نیاز (برای دکمه "شروع" یا "تعیین تکلیف") */
  tab: string;
  /** دکمه‌ای که باید نمایش داده شود */
  actionLabel: string;
}

export interface PrerequisiteCheckResult {
  /** لیست همه پیش‌نیازها (برای نمایش دانه‌دانه) */
  prerequisites: Prerequisite[];
  /** آیا همه پیش‌نیازهای الزامی تکمیل شده‌اند؟ */
  allRequiredCompleted: boolean;
  /** آیا همه پیش‌نیازهای اختیاری تعیین تکلیف شده‌اند؟ */
  allOptionalDecided: boolean;
  /** آیا می‌توان برنامه ساخت؟ */
  canGenerateProgram: boolean;
  /** پیام خطا (در صورت عدم امکان ساخت برنامه) */
  blockingReason: string | null;
}

/**
 * بررسی وضعیت پیش‌نیازهای کاربر برای ساخت برنامه.
 *
 * @param userId آیدی کاربر
 * @param planName نام پلن فعال کاربر
 */
export async function checkPrerequisites(
  userId: string,
  planName: Plan | null
): Promise<PrerequisiteCheckResult> {
  const userPlan = planName ?? null;
  const needsBodyPhoto = userPlan === "advanced" || userPlan === "ultimate";
  const isUltimate = userPlan === "ultimate";

  const prerequisites: Prerequisite[] = [];

  // ─── ۱. عکس بدن (الزامی برای advanced/ultimate) ───
  if (needsBodyPhoto) {
    const progressPhoto = await db.progressPhoto.findFirst({
      where: { userId },
      orderBy: { takenAt: "desc" },
    });
    const hasBodyPhoto = !!progressPhoto;

    prerequisites.push({
      id: "body_photo",
      type: "body_photo",
      label: "ارسال عکس بدن (۴ زاویه)",
      description:
        "برای ساخت برنامه اختصاصی، عکس‌های بدن خود را از ۴ زاویه (جلو، پهلو، پشت، سه‌چهارم) ارسال کنید. این مرحله الزامی است.",
      required: true,
      status: hasBodyPhoto ? "completed" : "incomplete",
      statusLabel: hasBodyPhoto ? "تکمیل شده ✓" : "الزامي — هنوز ارسال نشده",
      tab: "dashboard",
      actionLabel: hasBodyPhoto ? "ارسال مجدد" : "شروع",
    });
  }

  // ─── ۲. ویدیوی فرم حرکات (اختیاری برای ultimate — باید تعیین تکلیف شود) ───
  if (isUltimate) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { videoStatus: true },
    });
    const videoStatus = user?.videoStatus ?? null;
    // اگر تحلیل ویدیو در AnalysisResult موجود باشد، یعنی کاربر قبلاً ویدیو آپلود کرده
    const videoAnalysis = await db.analysisResult.findFirst({
      where: { userId, type: "video_analysis" },
      orderBy: { createdAt: "desc" },
    });

    let status: PrerequisiteStatus = "pending_decision";
    let statusLabel = "تعیین تکلیف نشده — آپلود یا رد کنید";

    if (videoStatus === "uploaded" || videoAnalysis) {
      status = "completed";
      statusLabel = "آپلود شده ✓";
    } else if (videoStatus === "skipped") {
      status = "completed";
      statusLabel = "رد شد ✓";
    }

    prerequisites.push({
      id: "video_body",
      type: "video_body",
      label: "ارسال ویدیوی فرم حرکات (اختیاری)",
      description:
        "برای دقت بالاتر، ویدیویی از فرم اجرای حرکات خود ارسال کنید. این مرحله اختیاری است اما باید تعیین تکلیف شود (آپلود یا «آپلود نمی‌کنم»).",
      required: false, // خودش اختیاری است، اما تعیین تکلیفش الزامی است
      status,
      statusLabel,
      tab: "dashboard",
      actionLabel: status === "completed" ? "تکمیل شد ✓" : "تعیین تکلیف",
    });
  }

  // ─── ۳. آزمایش خون (اختیاری برای ultimate — باید تعیین تکلیف شود) ───
  if (isUltimate) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { bloodTestStatus: true },
    });
    const bloodTestStatus = user?.bloodTestStatus ?? null;
    const bloodTestAnalysis = await db.analysisResult.findFirst({
      where: { userId, type: "blood_test" },
      orderBy: { createdAt: "desc" },
    });

    let status: PrerequisiteStatus = "pending_decision";
    let statusLabel = "تعیین تکلیف نشده — آپلود، آزمایش بده، یا رد کنید";

    if (bloodTestAnalysis) {
      status = "completed";
      statusLabel = "آپلود شده ✓";
    } else if (bloodTestStatus === "declined") {
      status = "completed";
      statusLabel = "رد شد ✓";
    } else if (bloodTestStatus === "waiting" || bloodTestStatus === "pending_blood_test") {
      status = "pending";
      statusLabel = "در انتظار نتایج آزمایش ⏳";
    }

    prerequisites.push({
      id: "blood_test",
      type: "blood_test",
      label: "آزمایش خون (اختیاری)",
      description:
        "برای داشتن یک برنامه کاملاً شخصی‌سازی‌شده، می‌توانید آزمایش خون خود را ارسال کنید. این مرحله اختیاری است اما باید تعیین تکلیف شود (آپلود، «آزمایش دادم و منتظر جوابم»، یا «آپلود نمی‌کنم»).",
      required: false, // خودش اختیاری است، اما تعیین تکلیفش الزامی است
      status,
      statusLabel,
      tab: "dashboard",
      actionLabel: status === "completed" ? "تکمیل شد ✓" : "تعیین تکلیف",
    });
  }

  // ─── ۴. اندازه‌های بدنی (تشویقی، نه الزامی) ───
  const baselineCheckup = await db.checkup.findFirst({
    where: { userId, phaseNumber: 0 },
    orderBy: { createdAt: "desc" },
  });
  const hasMeasurements =
    !!baselineCheckup?.waistMeasurement && !!baselineCheckup?.neckMeasurement;

  prerequisites.push({
    id: "body_measurements",
    type: "body_measurements",
    label: "اندازه‌های بدنی (اختیاری — تشویقی)",
    description:
      "با وارد کردن دور کمر، گردن و سایر اندازه‌ها، فیتاپ هوشمند درصد چربی بدن شما را با فرمول علمی US Navy محاسبه می‌کند و برنامه دقیق‌تری طراحی می‌کند. این مرحله کاملاً اختیاری است.",
    required: false,
    status: hasMeasurements ? "completed" : "incomplete",
    statusLabel: hasMeasurements ? "تکمیل شده ✓" : "اختیاری — هنوز وارد نشده",
    tab: "progress",
    actionLabel: hasMeasurements ? "ویرایش" : "شروع",
  });

  // ─── محاسبه وضعیت کلی ───
  const requiredPrereqs = prerequisites.filter((p) => p.required);
  const optionalPrereqs = prerequisites.filter((p) => !p.required && p.type !== "body_measurements");
  const allRequiredCompleted = requiredPrereqs.every((p) => p.status === "completed");
  const allOptionalDecided = optionalPrereqs.every((p) => p.status === "completed");

  // برنامه را می‌توان ساخت اگر:
  // ۱. همه پیش‌نیازهای الزامی تکمیل شده باشند
  // ۲. همه پیش‌نیازهای اختیاری تعیین تکلیف شده باشند (نه pending_decision و نه pending)
  const canGenerateProgram = allRequiredCompleted && allOptionalDecided;

  let blockingReason: string | null = null;
  if (!canGenerateProgram) {
    const incompleteRequired = requiredPrereqs.filter((p) => p.status !== "completed");
    const pendingOptional = optionalPrereqs.filter((p) => p.status !== "completed");
    if (incompleteRequired.length > 0) {
      blockingReason = `برای ساخت برنامه، ابتدا باید ${incompleteRequired.map((p) => p.label).join("، ")} را تکمیل کنید.`;
    } else if (pendingOptional.length > 0) {
      blockingReason = `برای ساخت برنامه، باید ${pendingOptional.map((p) => p.label).join("، ")} را تعیین تکلیف کنید (آپلود یا «آپلود نمی‌کنم»).`;
    }
  }

  return {
    prerequisites,
    allRequiredCompleted,
    allOptionalDecided,
    canGenerateProgram,
    blockingReason,
  };
}

/**
 * لیست پیش‌نیازهای در انتظار (برای نمایش در programs-view).
 * شامل مواردی که هنوز تکمیل/تعیین تکلیف نشده‌اند.
 */
export function getPendingPrerequisites(result: PrerequisiteCheckResult): Prerequisite[] {
  // body_measurements تشویقی است و در pendingPrerequisites نمایش داده نمی‌شود
  // مگر اینکه هیچ پیش‌نیاز دیگری در انتظار نباشد.
  const blocking = result.prerequisites.filter(
    (p) =>
      p.type !== "body_measurements" &&
      p.status !== "completed"
  );
  if (blocking.length > 0) return blocking;
  // اگر همه پیش‌نیازها تکمیل شده‌اند ولی اندازه‌های بدنی نه، آن را به‌عنوان تشویق نمایش بده
  const measurements = result.prerequisites.find(
    (p) => p.type === "body_measurements" && p.status !== "completed"
  );
  return measurements ? [measurements] : [];
}
