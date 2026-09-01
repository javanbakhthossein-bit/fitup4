import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/admin/accounting/compare?from1=&to1=&from2=&to2=
 *
 * مقایسه دو بازه زمانی:
 *  - revenue, payments, newUsers, avgTicket برای هر بازه
 *  - diffs (مطلق + درصد)
 *  - side-by-side daily buckets (با طول مساوی — padding صفر برای روزهای کم‌داده)
 */

interface RangeStats {
  revenue: number;
  payments: number;
  newUsers: number;
  avgTicket: number;
}

async function computeRangeStats(from: Date, to: Date): Promise<RangeStats> {
  const where = {
    status: "success" as const,
    createdAt: { gte: from, lte: to },
  };
  const [revAgg, payments, newUsers] = await Promise.all([
    db.payment.aggregate({ where, _sum: { amount: true } }),
    db.payment.count({ where }),
    db.user.count({ where: { createdAt: { gte: from, lte: to } } }),
  ]);
  const revenue = revAgg._sum.amount || 0;
  return {
    revenue,
    payments,
    newUsers,
    avgTicket: payments > 0 ? Math.round(revenue / payments) : 0,
  };
}

function buildDailyBuckets(from: Date, to: Date, payments: { amount: number; createdAt: Date }[]) {
  const buckets: { date: string; label: string; revenue: number; count: number }[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const endCursor = new Date(to);
  endCursor.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cursor.getTime() <= endCursor.getTime() && guard < 400) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({
      date: key,
      label: new Date(cursor).toLocaleDateString("fa-IR", { month: "short", day: "numeric" }),
      revenue: 0,
      count: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  for (const p of payments) {
    const key = p.createdAt.toISOString().slice(0, 10);
    const b = buckets.find((x) => x.date === key);
    if (b) {
      b.revenue += p.amount;
      b.count += 1;
    }
  }
  return buckets;
}

function pct(prev: number, curr: number): number | null {
  if (prev === 0) {
    return curr === 0 ? 0 : null; // null → "نامحدود" در UI
  }
  return Math.round(((curr - prev) / prev) * 100);
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const from1 = new Date(searchParams.get("from1") || "");
    const to1 = new Date(searchParams.get("to1") || "");
    const from2 = new Date(searchParams.get("from2") || "");
    const to2 = new Date(searchParams.get("to2") || "");

    if ([from1, to1, from2, to2].some((d) => isNaN(d.getTime()))) {
      return Response.json({ error: "یکی از بازه‌ها نامعتبر است." }, { status: 400 });
    }
    if (from1 > to1 || from2 > to2) {
      return Response.json({ error: "تاریخ شروع باید قبل از پایان باشد." }, { status: 400 });
    }

    const [s1, s2, p1, p2] = await Promise.all([
      computeRangeStats(from1, to1),
      computeRangeStats(from2, to2),
      db.payment.findMany({
        where: { status: "success", createdAt: { gte: from1, lte: to1 } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      db.payment.findMany({
        where: { status: "success", createdAt: { gte: from2, lte: to2 } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const b1 = buildDailyBuckets(from1, to1, p1);
    const b2 = buildDailyBuckets(from2, to2, p2);

    // هم‌تراز کردن طول دو سری برای نمودار کنار هم
    const maxLen = Math.max(b1.length, b2.length);
    while (b1.length < maxLen) b1.push({ date: `pad-${b1.length}`, label: "—", revenue: 0, count: 0 });
    while (b2.length < maxLen) b2.push({ date: `pad-${b2.length}`, label: "—", revenue: 0, count: 0 });

    const combined = b1.map((day, i) => ({
      label: `روز ${toFa(i + 1)}`,
      range1: day.revenue,
      range2: b2[i]?.revenue || 0,
    }));

    return Response.json({
      ranges: {
        range1: { from: from1.toISOString(), to: to1.toISOString(), ...s1 },
        range2: { from: from2.toISOString(), to: to2.toISOString(), ...s2 },
      },
      diffs: {
        revenue: { absolute: s2.revenue - s1.revenue, pct: pct(s1.revenue, s2.revenue) },
        payments: { absolute: s2.payments - s1.payments, pct: pct(s1.payments, s2.payments) },
        newUsers: { absolute: s2.newUsers - s1.newUsers, pct: pct(s1.newUsers, s2.newUsers) },
        avgTicket: { absolute: s2.avgTicket - s1.avgTicket, pct: pct(s1.avgTicket, s2.avgTicket) },
      },
      daily: combined,
    });
  } catch (e) {
    return apiError(e);
  }
}

function toFa(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d, 10)]);
}
