import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        link: n.link ?? null,
        meta: n.meta ? safeParse(n.meta) : null,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

// Create a notification for the current user (client-side, e.g., PWA install suggestion)
// Only allows type "system" — prevents abuse (no upgrade/renewal/etc. spoofing).
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    if (!body?.title || !body?.body) {
      return Response.json({ error: "عنوان و متن اعلان الزامی است." }, { status: 400 });
    }
    const notif = await db.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: String(body.title).slice(0, 200),
        body: String(body.body).slice(0, 2000),
        link: body.link ? String(body.link).slice(0, 500) : null,
        meta: body.meta ? String(body.meta).slice(0, 2000) : null,
      },
    });
    return Response.json({ ok: true, id: notif.id });
  } catch (e) {
    return apiError(e);
  }
}

// Mark a single notification as read (POST with {id}) OR mark all as read (PATCH)
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    if (body?.id) {
      await db.notification.updateMany({
        where: { id: String(body.id), userId: user.id },
        data: { read: true },
      });
    } else {
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

// Delete a notification
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) {
      await db.notification.deleteMany({ where: { id, userId: user.id } });
    } else {
      // clear all
      await db.notification.deleteMany({ where: { userId: user.id } });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
