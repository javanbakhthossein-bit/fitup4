import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { createNotification } from "@/lib/fitness/notifications";

/**
 * POST /api/admin/users/[id]/notify
 *
 * ارسال اعلان به یک کاربر خاص از طرف ادمین.
 *
 * Body:
 *   title  الزامی (حداکثر ۲۰۰ کاراکتر)
 *   body   الزامی (حداکثر ۲۰۰۰ کاراکتر)
 *   type   اختیاری — یکی از welcome | workout_reminder | water_reminder |
 *          subscription | achievement | system | upgrade | renewal |
 *          re_engagement | checkup | coach (پیش‌فرض: system)
 *   link   اختیاری — مسیر داخلی قابل کلیک (مثل "?tab=workouts")
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const title = (body?.title ?? "").toString().trim();
    const notifBody = (body?.body ?? "").toString().trim();
    const type = (body?.type ?? "system").toString().trim();
    const link = body?.link ? String(body.link).trim() : null;

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

    // بررسی وجود کاربر
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, mobile: true },
    });
    if (!user) {
      return Response.json(
        { error: "کاربر یافت نشد." },
        { status: 404 }
      );
    }

    const notif = await createNotification(
      user.id,
      finalType,
      title.slice(0, 200),
      notifBody.slice(0, 2000),
      link ? link.slice(0, 500) : undefined,
      { from: "admin" }
    );

    // Also try to send a push notification (if user has push subscription)
    try {
      const subs = await db.pushSubscription.findMany({ where: { userId: user.id } });
      if (subs.length > 0) {
        const webpush = (await import("web-push")).default;
        webpush.setVapidDetails(
          `mailto:support@${process.env.NEXT_PUBLIC_SITE_URL?.replace("https://", "").replace("http://", "") || "fittup.ir"}`,
          process.env.VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!
        );
        const payload = JSON.stringify({
          title: title.slice(0, 200),
          body: notifBody.slice(0, 2000),
          url: link || "/",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          dir: "rtl",
          lang: "fa",
          vibrate: [100, 50, 100],
          tag: "fitup-admin-push",
        });
        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
          } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
      }
    } catch (pushErr) {
      console.error("[notify] push failed (non-fatal):", pushErr);
    }

    return Response.json({ ok: true, id: notif?.id ?? null });
  } catch (e) {
    return apiError(e);
  }
}
