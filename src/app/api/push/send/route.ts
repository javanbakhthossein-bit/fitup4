import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

// ─── lazy init web-push (جلوگیری از خطا در زمان build) ───
// web-push در زمان build مقداردهی نمی‌شود چون VAPID keys در build time موجود نیستند.
// فقط در runtime (هنگام صدا زدن API) مقداردهی می‌شود.
let _webpush: any = null;
async function getWebpush() {
  if (_webpush) return _webpush;
  const wp = (await import("web-push")).default;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  wp.setVapidDetails(
    `mailto:support@${process.env.NEXT_PUBLIC_SITE_URL?.replace("https://", "").replace("http://", "") || "fittup.ir"}`,
    publicKey,
    privateKey
  );
  _webpush = wp;
  return _webpush;
}

/**
 * POST /api/push/send
 * Admin only — send a REAL push notification to user(s)
 * Body: { userId?: string, title: string, body: string, url?: string }
 * If userId omitted → send to ALL users with subscriptions
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    if (!body.title || !body.body) {
      return Response.json({ error: "title و body الزامی است" }, { status: 400 });
    }

    // Find subscriptions
    const where = body.userId ? { userId: body.userId } : {};
    const subs = await db.pushSubscription.findMany({ where });

    if (subs.length === 0) {
      // No push subscriptions — just store as in-app notification
      await storeNotification(body);
      return Response.json({ ok: true, sent: 0, message: "اشتراک پوشی وجود ندارد — فقط در اپ نمایش داده شد" });
    }

    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      url: body.url || "/",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      lang: "fa",
      vibrate: [100, 50, 100],
      tag: "fitup-push",
      requireInteraction: false,
    });

    let sentCount = 0;
    let failCount = 0;
    const invalidEndpoints: string[] = [];

    // Send push to each subscription — به‌صورت دسته‌ای (۲۰تایی) و هم‌زمان.
    // قبلاً حلقه ترتیبی (await در for) بود: برای صدها subscription درخواست
    // admin دقیقه‌ها معلق می‌ماند (gateway timeout) و یک endpoint کند کل
    // broadcast را قفل می‌کرد. شمارش نتایج/پاکسازی 410/404 مثل قبل است.
    const wp = await getWebpush();
    const CHUNK_SIZE = 20;
    for (let i = 0; i < subs.length; i += CHUNK_SIZE) {
      const chunk = subs.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map((sub) =>
          wp
            .sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              payload
            )
            .then(() => ({ ok: true as boolean, endpoint: sub.endpoint, err: null as any }))
            .catch((err: any) => ({ ok: false as boolean, endpoint: sub.endpoint, err }))
        )
      );
      for (const r of results) {
        if (r.status !== "fulfilled") continue; // با .catch داخل map نباید رخ دهد
        if (r.value.ok) {
          sentCount++;
        } else {
          failCount++;
          // 410 = subscription expired, 404 = not found → remove
          if (r.value.err?.statusCode === 410 || r.value.err?.statusCode === 404) {
            invalidEndpoints.push(r.value.endpoint);
          }
        }
      }
    }

    // Clean up invalid subscriptions
    if (invalidEndpoints.length > 0) {
      await db.pushSubscription.deleteMany({
        where: { endpoint: { in: invalidEndpoints } },
      });
    }

    // Also store as in-app notification (so user sees it in the notification panel)
    await storeNotification(body);

    return Response.json({
      ok: true,
      sent: sentCount,
      failed: failCount,
      cleaned: invalidEndpoints.length,
      message: `${sentCount} نوتیف ارسال شد${failCount > 0 ? ` (${failCount} ناموفق)` : ""}`,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * Store notification in DB for in-app display
 */
async function storeNotification(body: { userId?: string; title: string; body: string; url?: string }) {
  if (body.userId) {
    await db.notification.create({
      data: {
        userId: body.userId,
        type: "system",
        title: body.title,
        body: body.body,
        link: body.url || null,
        read: false,
      },
    });
  } else {
    // ارسال به همه کاربران (شامل ادمین‌ها) — فقط کاربران مسدودنشده
    const users = await db.user.findMany({
      where: { isBlocked: false },
      select: { id: true },
    });
    await db.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: "system",
        title: body.title,
        body: body.body,
        link: body.url || null,
        read: false,
      })),
    });
  }
}
