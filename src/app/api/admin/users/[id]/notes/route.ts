import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * توضیحات مدیر (UserAdminNote) — یادداشت‌های پایدار هر کاربر.
 * تاریخچه گفتگوها/تماس‌ها که همیشه ذخیره می‌ماند (حتی ۵ سال بعد قابل مرور است).
 *
 *  GET    /api/admin/users/[id]/notes        → { notes: [...] } (جدیدترین اول)
 *  POST   /api/admin/users/[id]/notes        → { note }  (body: 2..5000 کاراکتر)
 *  PUT    /api/admin/users/[id]/notes        → { note }  (body: { id, body })
 *  DELETE /api/admin/users/[id]/notes?id=... → { ok: true }
 *
 * تمام متدها requireAdmin هستند؛ authorMobile از موبایل ادمینِ لاگین‌شده پر می‌شود.
 */

const NOTE_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  authorMobile: true,
} as const;

const MAX_NOTE_LEN = 5000;
const MIN_NOTE_LEN = 2;

function validateNoteBody(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const trimmed = body.trim();
  if (trimmed.length < MIN_NOTE_LEN || trimmed.length > MAX_NOTE_LEN) return null;
  return trimmed;
}

/** GET — لیست یادداشت‌های کاربر (جدیدترین اول) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const notes = await db.userAdminNote.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: NOTE_SELECT,
    });

    return Response.json({ notes });
  } catch (e) {
    return apiError(e);
  }
}

/** POST — ثبت یادداشت جدید (authorMobile = موبایل ادمین) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const text = validateNoteBody((body as { body?: unknown })?.body);
    if (text == null) {
      return Response.json(
        { error: `متن یادداشت باید بین ${MIN_NOTE_LEN} تا ${MAX_NOTE_LEN} کاراکتر باشد.` },
        { status: 400 }
      );
    }

    // کاربر باید وجود داشته باشد (FK + پیام شفاف)
    const user = await db.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      return Response.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    const note = await db.userAdminNote.create({
      data: {
        userId: id,
        body: text,
        authorMobile: admin.mobile,
      },
      select: NOTE_SELECT,
    });

    return Response.json({ note }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

/** PUT — ویرایش متن یادداشت موجود (باید متعلق به همین کاربر باشد) */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const noteId = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : null;
    if (!noteId) {
      return Response.json({ error: "شناسه یادداشت ارسال نشده است." }, { status: 400 });
    }

    const text = validateNoteBody((body as { body?: unknown })?.body);
    if (text == null) {
      return Response.json(
        { error: `متن یادداشت باید بین ${MIN_NOTE_LEN} تا ${MAX_NOTE_LEN} کاراکتر باشد.` },
        { status: 400 }
      );
    }

    const existing = await db.userAdminNote.findFirst({
      where: { id: noteId, userId: id },
      select: { id: true },
    });
    if (!existing) {
      return Response.json({ error: "یادداشت یافت نشد" }, { status: 404 });
    }

    const note = await db.userAdminNote.update({
      where: { id: noteId },
      data: { body: text },
      select: NOTE_SELECT,
    });

    return Response.json({ note });
  } catch (e) {
    return apiError(e);
  }
}

/** DELETE — حذف یادداشت (?id=...) — فقط یادداشت‌های همان کاربر */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const noteId = new URL(req.url).searchParams.get("id");
    if (!noteId) {
      return Response.json({ error: "شناسه یادداشت ارسال نشده است." }, { status: 400 });
    }

    const result = await db.userAdminNote.deleteMany({
      where: { id: noteId, userId: id },
    });
    if (result.count === 0) {
      return Response.json({ error: "یادداشت یافت نشد" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
