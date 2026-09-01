import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

/**
 * DELETE /api/nutrition/log/[id]
 * حذف یک غذای ثبت‌شده متعلق به کاربر فعلی.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const existing = await db.foodLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) {
      return Response.json({ error: "رکورد یافت نشد." }, { status: 404 });
    }

    await db.foodLog.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
