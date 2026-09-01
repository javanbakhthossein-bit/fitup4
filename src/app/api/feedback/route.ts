import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * POST /api/feedback
 * Public — anyone can submit feedback
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = (body.message || "").trim();
    if (message.length < 5) {
      return Response.json({ error: "پیام خیلی کوتاه است" }, { status: 400 });
    }
    const category = ["suggestion", "complaint", "bug", "other"].includes(body.category)
      ? body.category
      : "suggestion";

    // Try to identify user (optional)
    let userId: string | undefined;
    try {
      const { requireAuth } = await import("@/lib/fitness/auth");
      const user = await requireAuth();
      userId = user.id;
    } catch {
      // anonymous feedback — fine
    }

    await db.feedback.create({
      data: {
        message: message.slice(0, 5000),
        category,
        name: (body.name || "").trim().slice(0, 100) || null,
        mobile: (body.mobile || "").trim().slice(0, 20) || null,
        userId,
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * GET /api/feedback
 * Admin only — list all feedback
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const reviewed = url.searchParams.get("reviewed");
    const where: any = {};
    if (reviewed === "true") where.reviewed = true;
    if (reviewed === "false") where.reviewed = false;

    const feedback = await db.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return Response.json({ feedback });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * PATCH /api/feedback
 * Admin — mark as reviewed
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    if (body.id) {
      await db.feedback.update({
        where: { id: body.id },
        data: { reviewed: true },
      });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * DELETE /api/feedback
 * Admin — delete feedback
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    if (body.id) {
      await db.feedback.delete({ where: { id: body.id } });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
