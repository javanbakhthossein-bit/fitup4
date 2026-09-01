import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireAdmin } from "@/lib/fitness/auth";

// PUT: update a TermsVersion (title/content/isActive) — admin only
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const existing = await db.termsVersion.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "نسخه قوانین یافت نشد." }, { status: 404 });
    }

    const body = await req.json();
    const data: { title?: string; content?: string; isActive?: boolean } = {};

    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (t.length < 3) {
        return Response.json(
          { error: "عنوان باید حداقل ۳ کاراکتر باشد." },
          { status: 400 }
        );
      }
      data.title = t;
    }
    if (typeof body.content === "string") {
      const c = body.content.trim();
      if (c.length < 10) {
        return Response.json(
          { error: "محتوای قوانین را کامل کنید." },
          { status: 400 }
        );
      }
      data.content = c;
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    // If activating this version, deactivate all others first (only one active at a time)
    if (data.isActive === true) {
      await db.termsVersion.updateMany({
        where: { isActive: true, NOT: { id } },
        data: { isActive: false },
      });
    }

    const updated = await db.termsVersion.update({
      where: { id },
      data,
    });

    return Response.json({
      terms: {
        id: updated.id,
        version: updated.version,
        title: updated.title,
        content: updated.content,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

// DELETE: delete a TermsVersion — admin only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const existing = await db.termsVersion.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "نسخه قوانین یافت نشد." }, { status: 404 });
    }
    if (existing.isActive) {
      return Response.json(
        { error: "نمی‌توان نسخه فعال را حذف کرد. ابتدا نسخه دیگری را فعال کنید." },
        { status: 400 }
      );
    }
    await db.termsVersion.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
