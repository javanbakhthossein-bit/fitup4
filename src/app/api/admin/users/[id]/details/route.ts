import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/admin/users/[id]/details
 * Full user details for admin:
 *  - profile (تمام فیلدهای آنبوردینگ — قابل ویرایش توسط ادمین)
 *  - subscriptions (تاریخچه اشتراک)
 *  - workoutPlans (تمام برنامه‌های تمرینی خریداری‌شده)
 *  - mealPlans (تمام برنامه‌های غذایی)
 *  - checkups (تاریخچه چکاپ)
 *  - weightLogs (آخرین وزن‌ها)
 *  - programRequests (تاریخچه درخواست برنامه)
 *  - payments (تمام تراکنش‌ها — پرداخت‌ها)
 *  - totalPurchased (مجموع خرید کاربر از سایت)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const [user, profile, subscriptions, workoutPlans, mealPlans, checkups, weightLogs, programRequests, payments] =
      await Promise.all([
        db.user.findUnique({
          where: { id },
          select: {
            id: true, mobile: true, name: true, role: true, isBlocked: true,
            onboardingDone: true, planName: true, planExpiresAt: true, planStartedAt: true,
            walletBalance: true, videoAnalysisUsed: true, bloodTestUsed: true,
            bloodTestStatus: true, videoStatus: true,
            referralCode: true, referredById: true, createdAt: true,
          },
        }),
        db.onboardingProfile.findUnique({
          where: { userId: id },
          // تمام فیلدهای آنبوردینگ برای نمایش و ویرایش توسط ادمین
          select: {
            gender: true, age: true, height: true, weight: true, targetWeight: true,
            goal: true, activityLevel: true, workoutDays: true, workoutDaysList: true,
            workoutPlace: true, equipment: true, diseases: true, injuries: true,
            allergies: true, dietType: true,
            // فیلدهای پیشرفته‌تر
            trainingExperience: true, previousTrainingType: true, drugAllergies: true,
            currentMedications: true, maxLifts: true,
            bodyFrame: true, sleepHours: true, stressLevel: true, waterHabit: true,
            targetDate: true, workoutTime: true, medicalConditions: true,
            currentSupplements: true, dislikedFoods: true, preferredCuisine: true,
            // اندازه‌های بدنی (فقط آن‌هایی که روی OnboardingProfile هستند —
            // بقیه اندازه‌ها (waist/chest/arm/hip/thigh) روی Checkup قرار دارند)
            neckMeasurement: true, shoulderMeasurement: true, calfMeasurement: true,
            aiAnalysis: true,
            createdAt: true, updatedAt: true,
          },
        }),
        db.subscription.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          select: { id: true, plan: true, status: true, startDate: true, endDate: true, durationDays: true, pricePaid: true, discountCode: true, createdAt: true },
        }),
        // تمام برنامه‌های تمرینی (بدون take) — تاریخچه کامل خریدها
        db.workoutPlan.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          select: { id: true, weekIndex: true, active: true, createdAt: true, content: true },
        }),
        // تمام برنامه‌های غذایی (بدون take)
        db.mealPlan.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          select: { id: true, active: true, totalCal: true, createdAt: true },
        }),
        db.checkup.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          select: { id: true, phaseNumber: true, weight: true, bodyFatPercent: true, leanBodyMass: true, status: true, phaseCompleted: true, createdAt: true },
        }),
        db.weightLog.findMany({
          where: { userId: id },
          orderBy: { loggedAt: "desc" },
          select: { id: true, weight: true, loggedAt: true },
          take: 30,
        }),
        db.programRequest.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          select: { id: true, plan: true, status: true, createdAt: true },
        }),
        // تمام تراکنش‌ها (پرداخت‌های کاربر)
        db.payment.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, amount: true, originalAmount: true, plan: true,
            paymentMethod: true, authority: true, refId: true, status: true,
            discountCode: true, description: true, cardPan: true,
            createdAt: true, verifiedAt: true,
          },
        }),
      ]);

    if (!user) {
      return Response.json({ error: "کاربر یافت نشد" }, { status: 404 });
    }

    // Parse workout plan content to extract summary
    const workoutPlanSummaries = workoutPlans.map((wp) => {
      let summary = "";
      try {
        const content = JSON.parse(wp.content);
        summary = `${content.days?.length || 0} روز - هدف: ${content.weeklyGoal || ""}`;
      } catch {
        summary = "نامشخص";
      }
      return { ...wp, content: undefined, summary };
    });

    // مجموع خرید کاربر از سایت — فقط پرداخت‌های موفق
    const successfulPayments = payments.filter((p) => p.status === "success");
    const totalPurchased = successfulPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return Response.json({
      user,
      profile,
      subscriptions,
      workoutPlans: workoutPlanSummaries,
      mealPlans,
      checkups,
      weightLogs,
      programRequests,
      payments: payments.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
      })),
      totalPurchased,
      successfulPaymentCount: successfulPayments.length,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * PUT /api/admin/users/[id]/details
 * آپدیت پروفایل آنبوردینگ کاربر توسط ادمین (تمام فیلدها قابل ویرایش).
 * فقط فیلدهای مجاز (whitelist) آپدیت می‌شوند.
 */
const ALLOWED_ONBOARDING_FIELDS = [
  "gender", "age", "height", "weight", "targetWeight", "goal",
  "activityLevel", "workoutDays", "workoutDaysList", "workoutPlace",
  "equipment", "diseases", "injuries", "allergies", "dietType",
  "trainingExperience", "previousTrainingType", "drugAllergies",
  "currentMedications", "maxLifts", "bodyFrame", "sleepHours", "stressLevel",
  "waterHabit", "targetDate", "workoutTime", "medicalConditions",
  "currentSupplements", "dislikedFoods", "preferredCuisine",
  "neckMeasurement", "shoulderMeasurement", "calfMeasurement",
] as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // ساخت object آپدیت فقط با فیلدهای مجاز
    const updateData: Record<string, any> = {};
    for (const field of ALLOWED_ONBOARDING_FIELDS) {
      if (field in body && body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: "هیچ فیلد معتبری برای آپدیت ارسال نشده است." }, { status: 400 });
    }

    // بررسی وجود پروفایل
    const existing = await db.onboardingProfile.findUnique({ where: { userId: id } });
    if (!existing) {
      return Response.json({ error: "پروفایل آنبوردینگ برای این کاربر وجود ندارد." }, { status: 404 });
    }

    const updated = await db.onboardingProfile.update({
      where: { userId: id },
      data: updateData,
    });

    // نوتیف به کاربر مبنی بر ویرایش پروفایل توسط ادمین
    await db.notification.create({
      data: {
        userId: id,
        type: "system",
        title: "پروفایل شما توسط ادمین به‌روزرسانی شد ✅",
        body: "اطلاعات پروفایل و پرونده پزشکی شما توسط ادمین ویرایش شد. در صورت سوال، با پشتیبانی در ارتباط باشید.",
        read: false,
      },
    }).catch(() => {});

    return Response.json({
      ok: true,
      message: "پروفایل با موفقیت به‌روزرسانی شد",
      updatedFields: Object.keys(updateData),
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    return apiError(e);
  }
}
