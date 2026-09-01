import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

interface PatchBody {
  code?: string;
  type?: "percent" | "fixed";
  value?: number;
  maxUses?: number;
  validUntil?: string | null;
  active?: boolean;
  applicablePlans?: string;
}

/**
 * PATCH /api/admin/discount-codes/[id]
 * به‌روزرسانی یک کد تخفیف. تمام فیلدها اختیاری هستند.
 * اگر `code` ارسال شود، باید یکتا باشد (و با خود رکورد فعلی تداخل نداشته باشد).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = (await req.json()) as PatchBody;

    const existing = await db.discountCode.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: "کد تخفیف یافت نشد." },
        { status: 404 }
      );
    }

    const data: {
      code?: string;
      type?: "percent" | "fixed";
      value?: number;
      maxUses?: number;
      validUntil?: Date | null;
      active?: boolean;
      applicablePlans?: string;
    } = {};

    if (body.code !== undefined) {
      const code = String(body.code).trim().toUpperCase();
      if (!code) {
        return Response.json(
          { error: "کد نمی‌تواند خالی باشد." },
          { status: 400 }
        );
      }
      // همان اعتبارسنجی طول POST (۳..۴۰) — ممیزی 2-c P3: PATCH قبلاً فقط regex
      // داشت و کد ۱کاراکتری/۵۰۰کاراکتری ممکن بود.
      if (code.length < 3 || code.length > 40) {
        return Response.json(
          { error: "کد باید بین ۳ تا ۴۰ کاراکتر باشد." },
          { status: 400 }
        );
      }
      if (!/^[A-Z0-9_-]+$/.test(code)) {
        return Response.json(
          { error: "فرمت کد نامعتبر است." },
          { status: 400 }
        );
      }
      if (code !== existing.code) {
        const conflict = await db.discountCode.findUnique({
          where: { code },
        });
        if (conflict) {
          return Response.json(
            { error: "این کد قبلاً استفاده شده است." },
            { status: 400 }
          );
        }
      }
      data.code = code;
    }

    if (body.type !== undefined) {
      if (!["percent", "fixed"].includes(body.type)) {
        return Response.json(
          { error: "نوع تخفیف نامعتبر است." },
          { status: 400 }
        );
      }
      data.type = body.type;
    }

    if (body.value !== undefined) {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value <= 0) {
        return Response.json(
          { error: "مقدار تخفیف نامعتبر است." },
          { status: 400 }
        );
      }
      const finalType = data.type ?? existing.type;
      if (finalType === "percent" && value > 100) {
        return Response.json(
          { error: "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد." },
          { status: 400 }
        );
      }
      data.value = Math.floor(value);
    }

    if (body.maxUses !== undefined) {
      const maxUses = Math.floor(Number(body.maxUses));
      if (!Number.isFinite(maxUses) || maxUses < -1) {
        return Response.json(
          { error: "حداکثر استفاده نامعتبر است." },
          { status: 400 }
        );
      }
      data.maxUses = maxUses;
    }

    if (body.validUntil !== undefined) {
      if (body.validUntil === null || body.validUntil === "") {
        data.validUntil = null;
      } else {
        const d = new Date(body.validUntil);
        if (isNaN(d.getTime())) {
          return Response.json(
            { error: "تاریخ انقضای نامعتبر." },
            { status: 400 }
          );
        }
        data.validUntil = d;
      }
    }

    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }

    if (body.applicablePlans !== undefined) {
      data.applicablePlans = String(body.applicablePlans).trim() || "all";
    }

    const updated = await db.discountCode.update({
      where: { id },
      data,
    });

    return Response.json({
      ok: true,
      code: {
        id: updated.id,
        code: updated.code,
        type: updated.type,
        value: updated.value,
        maxUses: updated.maxUses,
        usedCount: updated.usedCount,
        validFrom: updated.validFrom.toISOString(),
        validUntil: updated.validUntil
          ? updated.validUntil.toISOString()
          : null,
        active: updated.active,
        applicablePlans: updated.applicablePlans,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * DELETE /api/admin/discount-codes/[id]
 * حذف یک کد تخفیف. اگر کد قبلاً استفاده شده باشد (usedCount > 0) برای حفظ
 * تاریخچه می‌توان آن را غیرفعال کرد، اما حذف هم مجاز است (در صورت نیاز ادمین).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await db.discountCode.findUnique({ where: { id } });
    if (!existing) {
      return Response.json(
        { error: "کد تخفیف یافت نشد." },
        { status: 404 }
      );
    }

    await db.discountCode.delete({ where: { id } });

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
