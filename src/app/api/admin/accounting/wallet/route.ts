import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/admin/accounting/wallet?from=&to=&type=&search=&page=&pageSize=
 *
 * جدول تراکنش‌های کیف پول با فیلتر. شامل کاربر، نوع، مبلغ، توضیحات، تاریخ.
 */
const VALID_TYPES = ["deposit", "purchase", "refund", "bonus"];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type") || "";
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") || 20)));

    const where: any = {};
    if (from) {
      const fd = new Date(from);
      if (!isNaN(fd.getTime())) where.createdAt = { ...(where.createdAt || {}), gte: fd };
    }
    if (to) {
      const td = new Date(to);
      if (!isNaN(td.getTime())) where.createdAt = { ...(where.createdAt || {}), lte: td };
    }
    if (type && VALID_TYPES.includes(type)) {
      where.type = type;
    }
    if (search) {
      const users = await db.user.findMany({
        where: { OR: [{ mobile: { contains: search } }, { name: { contains: search } }] },
        select: { id: true },
      });
      where.OR = [
        { description: { contains: search } },
        { refId: { contains: search } },
        { userId: { in: users.map((u) => u.id) } },
      ];
    }

    const [total, txns] = await Promise.all([
      db.walletTransaction.count({ where }),
      db.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, mobile: true } } },
      }),
    ]);

    return Response.json({
      transactions: txns.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balance: t.balance,
        description: t.description || "",
        refId: t.refId || "",
        userName: t.user?.name || "",
        userMobile: t.user?.mobile || "",
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return apiError(e);
  }
}
