import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/admin/discount-codes
 *   ?search=   فیلتر بر اساس کد
 *   ?page=     شماره صفحه (پیش‌فرض ۱)
 *   ?pageSize  تعداد در هر صفحه (پیش‌فرض ۵۰)
 *
 * تمام کدهای تخفیف را برمی‌گرداند. کدها به‌صورت UPPERCASE ذخیره می‌شوند تا با
 * منطق checkout/discount که `code.trim().toUpperCase()` می‌کند، هم‌خوان باشند.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().toUpperCase();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.max(
      1,
      Math.min(200, Number(searchParams.get("pageSize") || 50))
    );

    const where = search ? { code: { contains: search } } : undefined;
    const [codes, total] = await Promise.all([
      db.discountCode.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.discountCode.count({ where }),
    ]);

    return Response.json({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        value: c.value,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        validFrom: c.validFrom.toISOString(),
        validUntil: c.validUntil ? c.validUntil.toISOString() : null,
        active: c.active,
        applicablePlans: c.applicablePlans,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return apiError(e);
  }
}

interface CreateBody {
  code: string;
  type: "percent" | "fixed";
  value: number;
  maxUses?: number;
  validUntil?: string | null;
  active?: boolean;
  applicablePlans?: string;
}

/**
 * POST /api/admin/discount-codes
 * ساخت کد تخفیف جدید.
 *   code           الزامی، یکتا
 *   type           "percent" | "fixed"
 *   value          عدد مثبت (درصد یا مبلغ تومان)
 *   maxUses        -1 = نامحدود (پیش‌فرض) یا عدد صحیح ≥ 0
 *   validUntil     ISO date اختیاری
 *   active         پیش‌فرض true
 *   applicablePlans "all" (پیش‌فرض) یا لیست جدا با کاما (e.g. "advanced,ultimate")
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = (await req.json()) as CreateBody;

    const code = (body.code || "").trim().toUpperCase();
    if (!code) {
      return Response.json({ error: "کد تخفیف را وارد کنید." }, { status: 400 });
    }
    if (code.length < 3 || code.length > 40) {
      return Response.json(
        { error: "کد باید بین ۳ تا ۴۰ کاراکتر باشد." },
        { status: 400 }
      );
    }
    if (!/^[A-Z0-9_-]+$/.test(code)) {
      return Response.json(
        {
          error: "کد فقط می‌تواند شامل حروف انگلیسی بزرگ، عدد، خط تیره و زیرخط باشد.",
        },
        { status: 400 }
      );
    }

    if (!body.type || !["percent", "fixed"].includes(body.type)) {
      return Response.json(
        { error: "نوع تخفیف باید percent یا fixed باشد." },
        { status: 400 }
      );
    }

    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return Response.json(
        { error: "مقدار تخفیف باید عددی بزرگتر از صفر باشد." },
        { status: 400 }
      );
    }
    if (body.type === "percent" && value > 100) {
      return Response.json(
        { error: "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد." },
        { status: 400 }
      );
    }

    const maxUses =
      body.maxUses === undefined || body.maxUses === null
        ? -1
        : Math.floor(Number(body.maxUses));
    if (!Number.isFinite(maxUses) || maxUses < -1) {
      return Response.json(
        { error: "حداکثر استفاده نامعتبر است." },
        { status: 400 }
      );
    }

    let validUntil: Date | null = null;
    if (body.validUntil) {
      const d = new Date(body.validUntil);
      if (isNaN(d.getTime())) {
        return Response.json(
          { error: "تاریخ انقضای نامعتبر." },
          { status: 400 }
        );
      }
      validUntil = d;
    }

    const applicablePlans = body.applicablePlans
      ? String(body.applicablePlans).trim()
      : "all";

    // بررسی یکتایی کد
    const existing = await db.discountCode.findUnique({ where: { code } });
    if (existing) {
      return Response.json(
        { error: "این کد تخفیف قبلاً ثبت شده است." },
        { status: 400 }
      );
    }

    const created = await db.discountCode.create({
      data: {
        code,
        type: body.type,
        value: Math.floor(value),
        maxUses,
        validUntil,
        active: body.active !== false,
        applicablePlans,
      },
    });

    return Response.json({
      ok: true,
      code: {
        id: created.id,
        code: created.code,
        type: created.type,
        value: created.value,
        maxUses: created.maxUses,
        usedCount: created.usedCount,
        validFrom: created.validFrom.toISOString(),
        validUntil: created.validUntil
          ? created.validUntil.toISOString()
          : null,
        active: created.active,
        applicablePlans: created.applicablePlans,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
