import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/admin/accounting/overview?from=ISO&to=ISO
 *
 * آمار کلی یک بازه زمانی:
 *  - totalRevenue, totalPayments, totalUsers (ثبت‌نام در بازه), activeSubscriptions
 *  - revenueByPlan (توزیع درآمد و تعداد بر اساس پلن)
 *  - revenueDaily (نمودار روزانه درآمد)
 *  - recentPayments (آخرین ۱۰ پرداخت موفق)
 *  - recentUsers (آخرین ۱۰ کاربر ثبت‌نام‌شده)
 *
 * اگر from/to ارسال نشود، بازه پیش‌فرض ۳۰ روز گذشته است.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const to = toParam ? new Date(toParam) : now;
    if (isNaN(to.getTime())) return Response.json({ error: "تاریخ پایان نامعتبر است." }, { status: 400 });

    const from = fromParam
      ? new Date(fromParam)
      : new Date(new Date(to).setDate(to.getDate() - 29));
    if (isNaN(from.getTime())) return Response.json({ error: "تاریخ شروع نامعتبر است." }, { status: 400 });
    if (from > to) return Response.json({ error: "تاریخ شروع باید قبل از پایان باشد." }, { status: 400 });

    const paymentWhere = {
      status: "success" as const,
      createdAt: { gte: from, lte: to },
    };

    const [totalRevenueAgg, totalPayments, totalUsers, activeSubscriptions, paymentsByPlanAgg, allPayments, recentPayments, recentUsers] =
      await Promise.all([
        db.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
        db.payment.count({ where: paymentWhere }),
        db.user.count({ where: { createdAt: { gte: from, lte: to } } }),
        db.subscription.count({ where: { status: "active", endDate: { gt: now } } }),
        db.payment.groupBy({
          by: ["plan"],
          where: paymentWhere,
          _sum: { amount: true },
          _count: true,
        }),
        db.payment.findMany({
          where: paymentWhere,
          select: { amount: true, createdAt: true, plan: true },
          orderBy: { createdAt: "asc" },
        }),
        db.payment.findMany({
          where: paymentWhere,
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { user: { select: { name: true, mobile: true } } },
        }),
        db.user.findMany({
          where: { createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            name: true,
            mobile: true,
            createdAt: true,
            planName: true,
            onboardingDone: true,
          },
        }),
      ]);

    const totalRevenue = totalRevenueAgg._sum.amount || 0;

    // درآمد روزانه برای نمودار خطی
    const dayBuckets: { date: string; label: string; revenue: number; count: number }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const endCursor = new Date(to);
    endCursor.setHours(0, 0, 0, 0);
    let guard = 0;
    while (cursor.getTime() <= endCursor.getTime() && guard < 400) {
      const dayKey = cursor.toISOString().slice(0, 10);
      dayBuckets.push({
        date: dayKey,
        label: new Date(cursor).toLocaleDateString("fa-IR", { month: "short", day: "numeric" }),
        revenue: 0,
        count: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }

    for (const p of allPayments) {
      const key = p.createdAt.toISOString().slice(0, 10);
      const bucket = dayBuckets.find((b) => b.date === key);
      if (bucket) {
        bucket.revenue += p.amount;
        bucket.count += 1;
      }
    }

    const PLAN_LABELS: Record<string, string> = {
      basic: "اقتصادی",
      standard: "استاندارد",
      advanced: "پیشرفته",
      ultimate: "حرفه‌ای",
    };
    const revenueByPlan = paymentsByPlanAgg.map((p) => ({
      plan: p.plan,
      label: PLAN_LABELS[p.plan] || p.plan,
      revenue: p._sum.amount || 0,
      count: p._count,
    }));

    return Response.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      stats: {
        totalRevenue,
        totalPayments,
        totalUsers,
        activeSubscriptions,
        avgTicket: totalPayments > 0 ? Math.round(totalRevenue / totalPayments) : 0,
      },
      revenueByPlan,
      revenueDaily: dayBuckets,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        originalAmount: p.originalAmount,
        plan: p.plan,
        status: p.status,
        refId: p.refId,
        authority: p.authority,
        paymentMethod: p.paymentMethod,
        userName: p.user?.name || "",
        userMobile: p.user?.mobile || "",
        createdAt: p.createdAt.toISOString(),
        verifiedAt: p.verifiedAt?.toISOString() || null,
      })),
      recentUsers: recentUsers.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
