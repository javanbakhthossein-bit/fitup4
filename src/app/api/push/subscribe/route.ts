import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

/**
 * POST /api/push/subscribe
 * Register a push subscription for the current user
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return Response.json({ error: "Invalid subscription" }, { status: 400 });
    }

    await db.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent: req.headers.get("user-agent") || "",
      },
      update: {
        userId: user.id,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * DELETE /api/push/subscribe
 * Unsubscribe
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));

    if (body.endpoint) {
      await db.pushSubscription.deleteMany({
        where: { endpoint: body.endpoint, userId: user.id },
      });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * GET /api/push/subscribe
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const count = await db.pushSubscription.count({
      where: { userId: user.id },
    });
    return Response.json({ subscribed: count > 0, count });
  } catch (e) {
    return apiError(e);
  }
}
