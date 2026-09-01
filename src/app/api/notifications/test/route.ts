import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

/**
 * POST /api/notifications/test
 * ارسال یک نوتیف تست به کاربر فعلی.
 */
export async function POST() {
  try {
    const user = await requireAuth();

    // ایجاد نوتیف تست در دیتابیس
    const notif = await db.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "اعلان آزمایشی ✅",
        body: "این یک اعلان آزمایشی است. اگر این را می‌بینید، سیستم اعلان‌ها به‌درستی کار می‌کند.",
        link: "?tab=dashboard",
        read: false,
      },
    });

    // تلاش برای ارسال پوش نوتیف (اگر کاربر subscribe کرده)
    try {
      const webpush = (await import("web-push")).default;

      webpush.setVapidDetails(
        `mailto:support@${process.env.NEXT_PUBLIC_SITE_URL?.replace("https://", "").replace("http://", "") || "fittup.ir"}`,
        process.env.VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );

      const subscriptions = await db.pushSubscription.findMany({
        where: { userId: user.id },
      });

      if (subscriptions.length > 0) {
        const payload = JSON.stringify({
          title: "اعلان آزمایشی ✅",
          body: "این یک اعلان آزمایشی است. سیستم اعلان‌ها کار می‌کند.",
          url: "/?tab=dashboard",
        });

        let sentCount = 0;
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );
            sentCount++;
          } catch (e: any) {
            console.error("[notifications/test] push failed for sub:", sub.endpoint, e?.message);
            // اگر subscription منقضی شده، حذف کن
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
        return NextResponse.json({
          ok: true,
          message: `اعلان آزمایشی ارسال شد (${sentCount} پوش + دیتابیس)`,
          notificationId: notif.id,
          pushSent: sentCount,
        });
      } else {
        return NextResponse.json({
          ok: true,
          message: "اعلان آزمایشی در دیتابیس ثبت شد (پوش فعال نیست — subscribe نشده‌اید)",
          notificationId: notif.id,
          pushSent: 0,
        });
      }
    } catch (pushErr) {
      console.error("[notifications/test] push module error:", pushErr);
      return NextResponse.json({
        ok: true,
        message: "اعلان آزمایشی در دیتابیس ثبت شد (خطا در پوش)",
        notificationId: notif.id,
        pushSent: 0,
      });
    }
  } catch (e) {
    return apiError(e);
  }
}
