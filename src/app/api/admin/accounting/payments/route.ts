import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/admin/accounting/payments?from=&to=&plan=&status=&search=&page=&pageSize=
 *
 * جدول پرداخت‌ها با فیلتر کامل. شامل کاربر، پلن، تاریخ شمسی، وضعیت، کد پیگیری.
 * خروجی CSV با پارامتر ?export=csv.
 */
const VALID_STATUSES = [
  "pending",
  "verifying",
  "success",
  "failed",
  "cancelled",
  "refunded",
  "manual_resolved", // معلق قدیمی — ادمین دستی تعیین‌تکلیف کرده؛ بازیابی خودکار ممنوع
  "expired", // از پنجره بازیابی خارج شد بدون پرداخت — «وارد درگاه و خارج شده»
];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const plan = searchParams.get("plan") || "";
    const status = searchParams.get("status") || "";
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") || 20)));
    const wantCsv = searchParams.get("export") === "csv";

    const where: any = {};
    if (from) {
      const fd = new Date(from);
      if (!isNaN(fd.getTime())) where.createdAt = { ...(where.createdAt || {}), gte: fd };
    }
    if (to) {
      const td = new Date(to);
      if (!isNaN(td.getTime())) where.createdAt = { ...(where.createdAt || {}), lte: td };
    }
    if (plan && ["basic", "standard", "advanced", "ultimate"].includes(plan)) {
      where.plan = plan;
    }
    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }
    if (search) {
      // جستجو بر اساس کد پیگیری/Authority مستقیم یا کاربر (mobile/name) با join
      const users = await db.user.findMany({
        where: { OR: [{ mobile: { contains: search } }, { name: { contains: search } }] },
        select: { id: true },
      });
      where.OR = [
        { refId: { contains: search } },
        { authority: { contains: search } },
        { userId: { in: users.map((u) => u.id) } },
      ];
    }

    const [total, payments] = await Promise.all([
      db.payment.count({ where }),
      db.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: wantCsv ? 0 : (page - 1) * pageSize,
        take: wantCsv ? 5000 : pageSize,
        include: { user: { select: { name: true, mobile: true } } },
      }),
    ]);

    const formatted = payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      originalAmount: p.originalAmount,
      plan: p.plan,
      paymentMethod: p.paymentMethod,
      status: p.status,
      refId: p.refId || "",
      authority: p.authority || "",
      discountCode: p.discountCode || "",
      description: p.description || "",
      cardPan: p.cardPan || "",
      fee: p.fee ?? null,
      userName: p.user?.name || "",
      userMobile: p.user?.mobile || "",
      createdAt: p.createdAt.toISOString(),
      verifiedAt: p.verifiedAt?.toISOString() || null,
    }));

    if (wantCsv) {
      const header = ["کاربر", "موبایل", "مبلغ (تومان)", "مبلغ اصلی", "پلن", "روش پرداخت", "وضعیت", "کد پیگیری", "Authority", "کد تخفیف", "تاریخ شمسی", "تاریخ میلادی"];
      const lines = [header.join(",")];
      const STATUS_LABELS: Record<string, string> = {
        success: "موفق",
        failed: "ناموفق",
        pending: "در انتظار",
        verifying: "در حال پردازش",
        cancelled: "لغو شده",
        refunded: "مسترد شده",
        manual_resolved: "رسیدگی دستی (قدیمی)",
        expired: "منقضی — پرداخت‌نشده",
      };
      const PLAN_LABELS: Record<string, string> = { basic: "اقتصادی", standard: "استاندارد", advanced: "پیشرفته", ultimate: "حرفه‌ای" };
      for (const p of formatted) {
        const row = [
          csvCell(p.userName),
          csvCell(p.userMobile),
          String(p.amount),
          String(p.originalAmount),
          csvCell(PLAN_LABELS[p.plan] || p.plan),
          csvCell(p.paymentMethod === "wallet" ? "کیف پول" : "درگاه"),
          csvCell(STATUS_LABELS[p.status] || p.status),
          csvCell(p.refId),
          csvCell(p.authority),
          csvCell(p.discountCode),
          csvCell(new Date(p.createdAt).toLocaleDateString("fa-IR")),
          csvCell(p.createdAt),
        ];
        lines.push(row.join(","));
      }
      const csv = "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="fitap-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return Response.json({
      payments: formatted,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return apiError(e);
  }
}

function csvCell(s: string): string {
  if (s == null) s = "";
  // Escape quotes and wrap in quotes
  return `"${String(s).replace(/"/g, '""')}"`;
}
