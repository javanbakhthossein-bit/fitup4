import { db } from "@/lib/db";

/**
 * Create a notification for a user.
 *
 * علاوه بر ذخیره در DB، یک push notification هم (best-effort) به تمام
 * دستگاه‌های کاربر ارسال می‌کند تا در PWA حتی وقتی اپ بسته است هم نمایش
 * داده شود. اگر VAPID keys تنظیم نشده باشند یا push ارسال ناموفق باشد،
 * فقط رکورد DB ایجاد می‌شود (failures به‌صورت silent نادیده گرفته می‌شوند
 * تا جریان اصلی شکسته نشود).
 *
 * @param userId  Target user id
 * @param type    Notification type (welcome | workout_reminder | water_reminder |
 *                subscription | achievement | system | upgrade | renewal |
 *                re_engagement | checkup | coach)
 * @param title   Persian title
 * @param body    Persian body
 * @param link    Optional internal app path for clickable notifications
 *                 (e.g. "?tab=plans", "?tab=progress")
 * @param meta    Optional extra data — will be JSON-stringified
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
  meta?: any
) {
  try {
    const notif = await db.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        link: link ?? null,
        meta: meta ? JSON.stringify(meta) : null,
        read: false,
      },
    });

    // ارسال push notification به PWA (best-effort، non-blocking)
    // اگر VAPID keys نباشند یا خطا بدهد، فقط در اپ نمایش داده می‌شود.
    sendPushToUser(userId, title, body, link).catch((err) => {
      // silent fail — push optional است
      console.warn("[createNotification] push failed (non-blocking):", err?.message || err);
    });

    return notif;
  } catch (err) {
    console.error("[createNotification] failed:", err);
    return null;
  }
}

// ─── lazy init web-push (مانند /api/push/send/route.ts) ───
// در زمان build مقداردهی نمی‌شود چون VAPID keys موجود نیستند.
let _webpush: any = null;
async function getWebpush(): Promise<any | null> {
  if (_webpush) return _webpush;
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
      // VAPID keys تنظیم نشده‌اند — push غیرفعال است
      return null;
    }
    const wp = (await import("web-push")).default;
    const subject = `mailto:support@${
      (process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir")
        .replace("https://", "")
        .replace("http://", "")
    }`;
    wp.setVapidDetails(subject, publicKey, privateKey);
    _webpush = wp;
    return _webpush;
  } catch (err) {
    console.warn("[sendPushToUser] web-push init failed:", err);
    return null;
  }
}

/**
 * ارسال push notification به تمام دستگاه‌های کاربر (PWA).
 * best-effort: خطاها silently نادیده گرفته می‌شوند تا جریان اصلی شکسته نشود.
 * endpointهای نامعتبر (410/404) به‌صورت خودکار از DB پاک می‌شوند.
 */
async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  const wp = await getWebpush();
  if (!wp) return; // VAPID keys موجود نیست — skip

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return; // کاربر دستگاهی ثبت نکرده

  const payload = JSON.stringify({
    title,
    body,
    url: link || "/",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    dir: "rtl",
    lang: "fa",
    vibrate: [100, 50, 100],
    tag: "fitup-notification",
    requireInteraction: false,
  });

  const invalidEndpoints: string[] = [];
  for (const sub of subs) {
    try {
      await wp.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
    } catch (err: any) {
      // 410 = subscription expired, 404 = not found → پاک‌سازی
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        invalidEndpoints.push(sub.endpoint);
      }
      // سایر خطاها (network، timeout، ...) silently نادیده گرفته می‌شوند
    }
  }

  if (invalidEndpoints.length > 0) {
    try {
      await db.pushSubscription.deleteMany({
        where: { endpoint: { in: invalidEndpoints } },
      });
    } catch {
      // silent — cleanup غیربحرانی است
    }
  }
}

/**
 * Generate a unique per-user renewal discount code for loyalty.
 * Format: FITAP15-{USERID-SHORT-6-CHARS}
 * (FITAP15 = 15% off renewal loyalty, private per-user, only shown in dashboard)
 */
export function buildRenewalDiscountCode(userId: string, percent: number): string {
  // First 6 chars of the userId (cuid), uppercased, alphanumeric only
  const short = userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase().padEnd(6, "0");
  return `FITAP15-${short}`;
}

/**
 * Ensure a user has an active (non-expired, non-used) per-user discount code
 * for renewal. If they already have one, reuse it; otherwise create a new one.
 *
 * Default percent = 15 (FITAP15 loyalty code).
 */
export async function ensureRenewalDiscountCode(
  userId: string,
  percent = 15,
  validForDays = 14
): Promise<{ code: string; value: number; type: "percent" } | null> {
  // Look for an existing active (non-used, non-expired) renewal code
  const now = new Date();
  const existing = await db.userDiscountCode.findFirst({
    where: {
      userId,
      isUsed: false,
      reason: "renewal_loyalty",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return { code: existing.code, value: existing.value, type: "percent" as const };
  }

  // Otherwise create a new one (retry on unique collision)
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + validForDays);

  for (let attempt = 0; attempt < 5; attempt++) {
    // The base code is deterministic per user (FITAP15-{short6}). On collision
    // (already exists for another user due to short hash), append a numeric suffix.
    const suffix = attempt === 0 ? "" : String(attempt);
    const code = `${buildRenewalDiscountCode(userId, percent)}${suffix}`;
    try {
      const created = await db.userDiscountCode.create({
        data: {
          userId,
          code,
          type: "percent",
          value: percent,
          reason: "renewal_loyalty",
          isUsed: false,
          validUntil,
        },
      });
      return { code: created.code, value: created.value, type: "percent" as const };
    } catch (err: any) {
      // P2002 = unique constraint failure — retry with new code
      if (err?.code !== "P2002" && err?.name !== "PrismaClientKnownRequestError") {
        console.error("[ensureRenewalDiscountCode] failed:", err);
        return null;
      }
    }
  }
  return null;
}
