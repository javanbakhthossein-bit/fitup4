import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { createNotification } from "@/lib/fitness/notifications";

/**
 * POST /api/admin/broadcast-notification
 *
 * ارسال یک اعلان به‌صورت کلی به همه کاربران (broadcast) از طرف ادمین.
 *
 * Body:
 *   title  الزامی (حداکثر ۲۰۰ کاراکتر)
 *   body   الزامی (حداکثر ۲۰۰۰ کاراکتر)
 *   type   اختیاری — یکی از welcome | workout_reminder | water_reminder |
 *          subscription | achievement | system | upgrade | renewal |
 *          re_engagement | checkup | coach (پیش‌فرض: system)
 *   link   اختیاری — مسیر داخلی قابل کلیک (مثل "?tab=workouts")
 *   onlyActivePlan  اختیاری (boolean) — اگر true باشد، فقط به کاربرانی که
 *          پلن فعال دارند ارسال می‌شود.
 *
 * Response:
 *   { ok: true, sent: number, total: number, pushed: number }
 *
 * نکته: برای جلوگیری از تایم‌اوت سرور، اعلان‌ها به‌صورت دسته‌ای (batch)
 * با createMany ساخته می‌شوند و پوش‌نوتیف به‌صورت best-effort و بدون
 * مسدودسازی پاسخ ارسال می‌شود.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const title = (body?.title ?? "").toString().trim();
    const notifBody = (body?.body ?? "").toString().trim();
    const type = (body?.type ?? "system").toString().trim();
    const link = body?.link ? String(body.link).trim() : null;
    const onlyActivePlan = Boolean(body?.onlyActivePlan);

    if (!title) {
      return Response.json(
        { error: "عنوان اعلان الزامی است." },
        { status: 400 }
      );
    }
    if (!notifBody) {
      return Response.json(
        { error: "متن اعلان الزامی است." },
        { status: 400 }
      );
    }

    const ALLOWED_TYPES = [
      "welcome",
      "workout_reminder",
      "water_reminder",
      "subscription",
      "achievement",
      "system",
      "upgrade",
      "renewal",
      "re_engagement",
      "checkup",
      "coach",
    ];
    const finalType = ALLOWED_TYPES.includes(type) ? type : "system";

    // ── دریافت همه کاربران (یا فقط کاربران با پلن فعال) ──
    // فقط id آن‌ها را می‌گیریم تا حافظه کمتری مصرف شود.
    const where: any = { isBlocked: false };
    if (onlyActivePlan) {
      const now = new Date();
      where.AND = [
        { planName: { not: null } },
        { OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }] },
      ];
    }

    const users = await db.user.findMany({
      where,
      select: { id: true },
    });

    if (users.length === 0) {
      return Response.json({
        ok: true,
        sent: 0,
        total: 0,
        pushed: 0,
        message: "هیچ کاربری برای ارسال اعلان یافت نشد.",
      });
    }

    const safeTitle = title.slice(0, 200);
    const safeBody = notifBody.slice(0, 2000);
    const safeLink = link ? link.slice(0, 500) : null;
    const metaJson = JSON.stringify({ from: "admin_broadcast", at: new Date().toISOString() });

    // ── ساخت اعلان به‌صورت دسته‌ای (یک کوئری) ──
    // createMany برای چند صد هزار رکورد ممکن است سنگین باشد؛ برای امنیت
    // بیشتر، در دسته‌های ۵۰۰ تایی ذخیره می‌کنیم.
    const BATCH = 500;
    let createdCount = 0;
    for (let i = 0; i < users.length; i += BATCH) {
      const slice = users.slice(i, i + BATCH);
      const result = await db.notification.createMany({
        data: slice.map((u) => ({
          userId: u.id,
          type: finalType,
          title: safeTitle,
          body: safeBody,
          link: safeLink,
          meta: metaJson,
          read: false,
        })),
      });
      createdCount += result.count || 0;
    }

    // ── ارسال پوش‌نوتیف (best-effort، بدون مسدودسازی پاسخ) ──
    // پوش‌نوتیف برای همه کاربرانی که PushSubscription دارند ارسال می‌شود.
    // در صورت بروز خطا، فقط در لاگ ثبت می‌شود و فرآیند ارسال اعلان متوقف نمی‌شود.
    let pushedCount = 0;
    try {
      const subs = await db.pushSubscription.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
        select: { id: true, endpoint: true, p256dh: true, auth: true, userId: true },
      });

      if (subs.length > 0) {
        const webpush = (await import("web-push")).default;
        webpush.setVapidDetails(
          `mailto:support@${process.env.NEXT_PUBLIC_SITE_URL?.replace("https://", "").replace("http://", "") || "fittup.ir"}`,
          process.env.VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!
        );

        const payload = JSON.stringify({
          title: safeTitle,
          body: safeBody,
          url: safeLink || "/",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          dir: "rtl",
          lang: "fa",
          vibrate: [100, 50, 100],
          tag: "fitup-admin-broadcast",
        });

        // ارسال موازی با محدودیت ۲۰ همزمان (جلوگیری از پر کردن event loop)
        const CONCURRENCY = 20;
        for (let i = 0; i < subs.length; i += CONCURRENCY) {
          const batch = subs.slice(i, i + CONCURRENCY);
          await Promise.all(
            batch.map(async (sub) => {
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                  payload
                );
                pushedCount += 1;
              } catch (err: any) {
                // 410/404 یعنی اشتراک منقضی شده → حذف کن
                if (err?.statusCode === 410 || err?.statusCode === 404) {
                  await db.pushSubscription
                    .delete({ where: { id: sub.id } })
                    .catch(() => {});
                }
                // خطاهای دیگر را silent نادیده می‌گیریم
              }
            })
          );
        }
      }
    } catch (pushErr) {
      console.error("[broadcast] push failed (non-fatal):", pushErr);
    }

    return Response.json({
      ok: true,
      sent: createdCount,
      total: users.length,
      pushed: pushedCount,
    });
  } catch (e) {
    return apiError(e);
  }
}
