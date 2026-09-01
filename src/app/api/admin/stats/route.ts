import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

export async function GET() {
  try {
    await requireAdmin();
    const now = new Date();

    const [
      totalUsers,
      activeSubscriptions,
      totalRevenue,
      totalPayments,
      blockedUsers,
      onboardingDone,
      exercises,
      foods,
      usersWithPlan,
    ] = await Promise.all([
      db.user.count(),
      db.subscription.count({ where: { status: "active", endDate: { gt: now } } }),
      // درآمد واقعی = پرداخت‌های موفق «غیر از شارژ کیف پول» (ممیزی 2-c P2):
      // شارژ کیف جذب نقدینگی است نه درآمد؛ وگرنه وقتی همان کیف برای خرید پلن خرج شود دوبار شمرده می‌شود.
      // totalPayments عمداً شامل topup می‌ماند (شمارش کل تراکنش‌های موفق).
      db.payment.aggregate({
        where: { status: "success", plan: { not: "wallet_topup" } },
        _sum: { amount: true },
      }),
      db.payment.count({ where: { status: "success" } }),
      db.user.count({ where: { isBlocked: true } }),
      db.user.count({ where: { onboardingDone: true } }),
      db.exerciseLibrary.count(),
      db.foodLibrary.count(),
      db.user.count({ where: { planName: { not: null } } }),
    ]);

    // نرخ تبدیل: کاربرانی که پلن فعال دارند / کل کاربران
    const conversionRate = totalUsers > 0 ? Math.round((usersWithPlan / totalUsers) * 100) : 0;

    // درآمد بر اساس پلن — شارژ کیف پول (wallet_topup) درآمد نیست و حذف می‌شود (ممیزی 2-c P2)
    const revenueByPlan = await db.payment.groupBy({
      by: ["plan"],
      where: { status: "success", plan: { not: "wallet_topup" } },
      _sum: { amount: true },
      _count: true,
    });

    // توزیع کاربران در پلن‌ها
    const planDistribution = await db.user.groupBy({
      by: ["planName"],
      where: { planName: { not: null } },
      _count: true,
    });

    const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

    // ─── باکت‌بندی دقیق بر اساس مرز ماه‌های شمسی (جلالی) ───
    // ریشه باگ «فریز نمودار روی مرداد»: قبلاً باکت‌ها اولِ ماهِ میلادی بودند و
    // فقط لیبل شمسی می‌گرفتند؛ اول مرداد میلادی = ۱۰ مرداد شمسی، پس آخرین
    // ستون همیشه ماه شمسیِ قبل را نشان می‌داد و ماه جاری (مثلاً شهریور که
    // از ۲۳ مرداد میلادی شروع می‌شود) هرگز ظاهر نمی‌شد.
    // حالا ۶ ماهِ شمسیِ اخیر با مرز دقیق جلالی ساخته می‌شوند.
    function getJalaliParts(date: Date): { y: number; m: number; d: number } {
      // timeZone صریح تهران (ممیزی 2-c P3): بدون آن قالب‌بندی در TZ سرور انجام می‌شد و
      // اگر سرور UTC باشد رخدادهای ۰۰:۰۰-۰۳:۳۰ تهرانِ ابتدای ماه به ماه قبل می‌افتادند.
      const parts = new Intl.DateTimeFormat("en-u-ca-persian", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        timeZone: "Asia/Tehran",
      }).formatToParts(date);
      const num = (t: string) => parseInt(parts.find((p) => p.type === t)?.value.replace(/\D/g, "") || "0", 10);
      return { y: num("year"), m: num("month"), d: num("day") };
    }

    /** آیا تاریخِ داده‌شده قبل از شروعِ ماه (y, m) جلالی است؟ */
    function beforeJalaliMonth(date: Date, y: number, m: number): boolean {
      const j = getJalaliParts(date);
      if (j.y !== y) return j.y < y;
      return j.m < m;
    }

    /** اولین روزِ میلادیِ ماه (y, m) جلالی — جستجوی دودویی با تقویم Intl */
    function jalaliMonthStart(y: number, m: number): Date {
      const DAY = 86400000;
      // برآورد: نوروز سال j ≈ ۲۱ مارس (y+621) + شروع ماه m
      const est = Date.UTC(y + 621, 2, 21) + Math.round((m - 1) * 30.44 * DAY);
      let lo = Math.floor(est / DAY) * DAY - 7 * DAY;
      let hi = Math.floor(est / DAY) * DAY + 7 * DAY;
      // گسترش دامنه تا lo قاطعاً قبل از ماه و hi قاطعاً در ماه/بعد از آن باشد
      while (beforeJalaliMonth(new Date(hi), y, m)) hi += 7 * DAY;
      while (!beforeJalaliMonth(new Date(lo), y, m)) lo -= 7 * DAY;
      // جستجوی دودویی روزبه‌روز
      while (hi - lo > DAY) {
        const mid = lo + Math.floor((hi - lo) / (2 * DAY)) * DAY;
        if (beforeJalaliMonth(new Date(mid), y, m)) lo = mid;
        else hi = mid;
      }
      const start = new Date(hi);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    const nowJ = getJalaliParts(now);
    const buckets: { start: Date; end: Date; monthIndex: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let y = nowJ.y;
      let m = nowJ.m - i;
      while (m < 1) { m += 12; y -= 1; }
      while (m > 12) { m -= 12; y += 1; }
      const start = jalaliMonthStart(y, m);
      const end = m === 12 ? jalaliMonthStart(y + 1, 1) : jalaliMonthStart(y, m + 1);
      buckets.push({ start, end, monthIndex: m - 1 });
    }
    const windowStart = buckets[0].start;

    const allUsers = await db.user.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    });

    const userGrowth: { month: string; users: number; total: number }[] = [];
    let cumulative = totalUsers - allUsers.length;
    for (const b of buckets) {
      const monthUsers = allUsers.filter((u) => u.createdAt >= b.start && u.createdAt < b.end).length;
      cumulative += monthUsers;
      userGrowth.push({ month: monthNames[b.monthIndex], users: monthUsers, total: cumulative });
    }

    // درآمد ۶ ماه شمسی اخیر (همان باکت‌ها) — بدون wallet_topup (ممیزی 2-c P2)
    const allPayments = await db.payment.findMany({
      where: { status: "success", plan: { not: "wallet_topup" }, createdAt: { gte: windowStart } },
      select: { amount: true, createdAt: true },
    });
    const revenueGrowth: { month: string; revenue: number }[] = [];
    for (const b of buckets) {
      const monthRev = allPayments.filter((p) => p.createdAt >= b.start && p.createdAt < b.end).reduce((s, p) => s + p.amount, 0);
      revenueGrowth.push({ month: monthNames[b.monthIndex], revenue: monthRev });
    }

    // تعداد برنامه‌های در انتظار
    const pendingPrograms = await db.programRequest.count({ where: { status: "pending" } });
    const readyPrograms = await db.programRequest.count({ where: { status: "ready" } });

    // کاربران اخیر
    const recentUsers = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, mobile: true, name: true, onboardingDone: true, isBlocked: true, createdAt: true, planName: true },
    });

    return Response.json({
      stats: {
        totalUsers,
        activeSubscriptions,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalPayments,
        blockedUsers,
        onboardingDone,
        exercises,
        foods,
        conversionRate,
        usersWithPlan,
        pendingPrograms,
        readyPrograms,
      },
      revenueByPlan,
      planDistribution,
      userGrowth,
      revenueGrowth,
      recentUsers: recentUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    });
  } catch (e) {
    return apiError(e);
  }
}
