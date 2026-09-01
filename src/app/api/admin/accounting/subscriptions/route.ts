import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/admin/accounting/subscriptions?from=&to=&plan=&status=&search=&page=&pageSize=
 *
 * جدول اشتراک‌ها با فیلتر. شامل کاربر، پلن، شروع، پایان، وضعیت.
 */
const VALID_STATUSES = ["active", "pending", "expired", "cancelled"];

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
      const users = await db.user.findMany({
        where: { OR: [{ mobile: { contains: search } }, { name: { contains: search } }] },
        select: { id: true },
      });
      where.userId = { in: users.map((u) => u.id) };
    }

    const [total, subs] = await Promise.all([
      db.subscription.count({ where }),
      db.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, mobile: true } } },
      }),
    ]);

    return Response.json({
      subscriptions: subs.map((s) => ({
        id: s.id,
        plan: s.plan,
        status: s.status,
        durationDays: s.durationDays,
        pricePaid: s.pricePaid,
        discountCode: s.discountCode || "",
        userName: s.user?.name || "",
        userMobile: s.user?.mobile || "",
        startDate: s.startDate?.toISOString() || null,
        endDate: s.endDate?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
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
