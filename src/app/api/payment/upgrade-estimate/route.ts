import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { getActivePlan } from "@/lib/fitness/pricing";
import type { Plan } from "@/lib/fitness/types";

/**
 * GET /api/payment/upgrade-estimate?planId=X
 *
 * برآورد اعتبار ارتقا برای یک پلن خاص.
 * اگر کاربر اشتراک فعال با پلن متفاوت دارد، اعتبار باقی‌مانده را محاسبه می‌کند.
 *
 * فرمول: upgradeCredit = (pricePaid / durationDays) × daysLeft
 *
 * F6: اشتراک‌های pending (advanced/ultimate قبل از تکمیل پیش‌نیازها) هم
 * اعتبار کامل pricePaid دارند (هیچ روزی مصرف نشده) — بدون این اعتبار، UI و
 * سرور کاربر را وادار به پرداخت قیمت کامل می‌کردند و پول پلن pending می‌سوخت.
 *
 * پاسخ:
 *   { isUpgrade, upgradeCredit, daysLeft, currentPlan, finalAmount, originalAmount,
 *     activeCredit, pendingCredit, pendingCount }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const planId = req.nextUrl.searchParams.get("planId") as Plan | null;
    if (!planId) {
      return Response.json({ error: "planId الزامی است." }, { status: 400 });
    }

    const plan = await getActivePlan(planId);
    if (!plan) {
      return Response.json({ error: "پلن نامعتبر است." }, { status: 400 });
    }

    const now = new Date();
    const [activeSub, pendingSubs] = await Promise.all([
      db.subscription.findFirst({
        where: { userId: user.id, status: "active", endDate: { gt: now } },
        orderBy: { endDate: "desc" },
      }),
      db.subscription.findMany({
        where: {
          userId: user.id,
          status: "pending",
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // اعتبار از اشتراک فعال (pro-rata) — فقط برای پلن متفاوت
    let activeCredit = 0;
    let daysLeft = 0;
    if (activeSub && activeSub.endDate && activeSub.plan !== plan.id) {
      const oldPlan = await getActivePlan(activeSub.plan as Plan);
      if (oldPlan) {
        daysLeft = Math.ceil(
          (activeSub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft > 0) {
          activeCredit = Math.round(
            (activeSub.pricePaid / activeSub.durationDays) * daysLeft
          );
        }
      }
    }

    // اعتبار کامل از اشتراک‌های pending — هیچ روزی مصرف نشده (F6)
    const pendingCredit = pendingSubs.reduce((sum, s) => sum + s.pricePaid, 0);

    const upgradeCredit = activeCredit + pendingCredit;
    const isUpgrade = upgradeCredit > 0;
    const finalAmount = Math.max(0, plan.price - upgradeCredit);

    // اگر نه اشتراک فعال با پلن متفاوت دارد و نه pending — ارتقا نیست
    if (!isUpgrade) {
      return Response.json({
        isUpgrade: false,
        upgradeCredit: 0,
        daysLeft: 0,
        currentPlan: activeSub?.plan ?? pendingSubs[0]?.plan ?? null,
        originalAmount: plan.price,
        finalAmount: plan.price,
        activeCredit: 0,
        pendingCredit: 0,
        pendingCount: 0,
      });
    }

    return Response.json({
      isUpgrade: true,
      upgradeCredit,
      daysLeft,
      currentPlan: activeSub?.plan ?? pendingSubs[0]?.plan ?? null,
      currentPlanEndDate: activeSub?.endDate?.toISOString() ?? null,
      originalAmount: plan.price,
      finalAmount,
      activeCredit,
      pendingCredit,
      pendingCount: pendingSubs.length,
    });
  } catch (e) {
    return apiError(e);
  }
}
