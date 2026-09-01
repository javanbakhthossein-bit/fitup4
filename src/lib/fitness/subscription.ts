import { db } from "@/lib/db";
import { processReferralReward } from "@/lib/fitness/referral";

/**
 * پنجره اعتبار اشتراک pending (به روز).
 *
 * اشتراک‌های advanced/ultimate هنگام خرید با status="pending" ساخته می‌شوند و
 * دوره اصلی (۴۵ روز) از زمان تکمیل پیش‌نیازها شروع می‌شود. برای اینکه کاربر
 * نتواند برای همیشه (بدون ارسال عکس بدن) به قابلیت‌های tier-3/4 دسترسی داشته
 * باشد، endDate اشتراک pending برابر «زمان خرید + PENDING_WINDOW_DAYS» است.
 * buildUserDto (auth.ts) اشتراک pending را فقط تا این تاریخ معتبر می‌شمارد و
 * بعد از آن به‌صورت تنبل (lazy) آن را expired می‌کند.
 */
export const PENDING_WINDOW_DAYS = 7;

/**
 * فعال‌سازی اشتراک pending کاربر (advanced/ultimate) در لحظه تکمیل پیش‌نیازها.
 *
 * این تابع entitlement تجاری را از موفقیت زنجیره AI جدا می‌کند:
 * به‌محض اینکه کاربر پیش‌نیازها را تعیین‌تکلیف کرد صدا زده می‌شود (نه بعد از
 * موفقیت تولید برنامه) تا دوره ۴۵ روزه صرف‌نظر از نتیجه AI شروع شود.
 *
 * کارها:
 *  - آخرین اشتراک pending (endDate=null یا در آینده) را پیدا می‌کند.
 *  - endDate = now + durationDays و status="active" و startDate=now تنظیم می‌کند.
 *  - فیلدهای پلن روی User (planName/planStartedAt/planExpiresAt) را آپدیت می‌کند.
 *  - پاداش معرفی (referral) را در صورت وجود paymentId پردازش می‌کند — چون
 *    پرداخت واقعی این اشتراک حالا «نهایی» شده است (F10: پاداش فقط روی
 *    فعال‌سازی، نه روی خرید pending).
 *
 * Idempotent: اگر اشتراک pendingی نباشد (یا همزمان توسط فراخوان دیگری فعال
 * شده باشد) null برمی‌گرداند و هیچ تغییری نمی‌دهد.
 */
export async function activatePendingSubscription(userId: string, now = new Date()) {
  const pendingSub = await db.subscription.findFirst({
    where: {
      userId,
      status: "pending",
      OR: [{ endDate: null }, { endDate: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!pendingSub) return null;

  // طول دوره اصلی پلن — دوره pending (پنجره) با دوره واقعی جایگزین می‌شود
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + (pendingSub.durationDays || 45));

  // فعال‌سازی اتمیک — اگر همزمان فراخوان دیگری همین اشتراک را فعال کرده باشد،
  // count=0 برمی‌گردد و این فراخوان no-op است (idempotent).
  const claimed = await db.subscription.updateMany({
    where: { id: pendingSub.id, status: "pending" },
    data: { status: "active", startDate: now, endDate },
  });
  if (claimed.count === 0) return null;

  // به‌روزرسانی فیلدهای پلن روی User برای دسترسی سریع و gating
  await db.user.update({
    where: { id: userId },
    data: {
      planName: pendingSub.plan,
      planStartedAt: now,
      planExpiresAt: endDate,
    },
  });

  // ─── پاداش معرفی (F10) ───
  // خریدهای advanced/ultimate هنگام verify پاداش نمی‌گیرند (اشتراک pending است)؛
  // پاداش اینجا پردازش می‌شود چون حالا مشخص است اشتراک واقعاً فعال شده است.
  // اشتراک‌های اهدایی ادمین (paymentId=null) پاداش رفرال ندارند.
  if (pendingSub.paymentId) {
    try {
      await processReferralReward({
        buyerUserId: userId,
        paymentId: pendingSub.paymentId,
      });
    } catch (refErr) {
      // خطای پاداش نباید جلوی فعال‌سازی را بگیرد
      console.error("[subscription] referral reward failed on activation:", refErr);
    }
  }

  return { ...pendingSub, status: "active", startDate: now, endDate };
}
