import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { checkPrerequisites, getPendingPrerequisites } from "@/lib/fitness/prerequisites";
import { recoverStuckGenerations } from "@/lib/fitness/program-generation";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * دریافت تاریخچه برنامه‌های قبلی کاربر + تحلیل هوش مصنوعی برای برنامه جدید
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const generateAnalysis = searchParams.get("analyze") === "1";

    // ─── rate limit فقط روی حالت تحلیل AI ───
    // حالت عادی (بدون analyze=1) هر ۳۰ ثانیه توسط فرانت‌اند poll می‌شود و
    // ارزان است؛ اما analyze=1 یک فراخوانی VLM/LLM پرهزینه است — بدون محدودیت
    // می‌شد کردیت AvalAI را drained کرد.
    if (generateAnalysis) {
      const rl = rateLimit(`program-history-analyze:${user.id}`, 10, 60 * 60_000);
      if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);
    }

    // ─── watchdog خودترمیم ───
    // فرانت‌اند در حالت generating هر ۳۰ ثانیه به این endpoint poll می‌کند —
    // بهترین نقطه برای بازیابی تولیدات یتیم‌شده (بعد از restart سرور)
    if (!generateAnalysis) {
      await recoverStuckGenerations(user.id);
    }

    // دریافت تمام برنامه‌های تمرینی کاربر (مرتب بر اساس قدیمی‌ترین)
    const workoutPlans = await db.workoutPlan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // دریافت تمام برنامه‌های غذایی
    const mealPlans = await db.mealPlan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // دریافت تمام اشتراک‌ها
    const subscriptions = await db.subscription.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "desc" },
    });

    // دریافت چکاپ‌ها
    const checkups = await db.checkup.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // دریافت وزن‌های ثبت‌شده
    const weightLogs = await db.weightLog.findMany({
      where: { userId: user.id },
      orderBy: { loggedAt: "asc" },
    });

    // ─── جفت‌کردن هر برنامه تمرینی با برنامه غذایی «همان دوره تولید» ───
    // قبلاً mealPlans[i] با ایندکس جفت می‌شد — وقتی تعداد برنامه‌های تمرینی و
    // غذایی برابر نبود (یا یکی fail شده بود)، برنامه غذایی اشتباه به برنامه
    // تمرینی وصل می‌شد و مدال «مشاهده کل برنامه» برنامه غذایی متفاوتی از
    // «دستیار تغذیه» (که برنامه فعال واقعی را از /api/coach/plan می‌خواند)
    // نشان می‌داد.
    // راه درست: هر WorkoutPlan با نزدیک‌ترین MealPlan از نظر زمان ایجاد جفت
    // می‌شود — هر دو در یک cycle تولید (با فاصله چند ثانیه) ساخته می‌شوند.
    // برای برنامه فعال، همین جفت‌شدگی عملاً همان برنامه غذایی فعال است چون
    // generation قدیمی‌ها را یکجا deactivate می‌کند.
    const usedMealPlanIds = new Set<string>();
    const mealPlanForWorkout = (wp: { createdAt: Date }) => {
      let best: (typeof mealPlans)[number] | null = null;
      let bestDiff = Number.POSITIVE_INFINITY;
      for (const mp of mealPlans) {
        if (usedMealPlanIds.has(mp.id)) continue;
        const diff = Math.abs(mp.createdAt.getTime() - wp.createdAt.getTime());
        if (diff < bestDiff) {
          bestDiff = diff;
          best = mp;
        }
      }
      // فقط اگر در همان cycle تولید ساخته شده باشد (فاصله < ۱۰ دقیقه)
      if (best && bestDiff <= 10 * 60 * 1000) {
        usedMealPlanIds.add(best.id);
        return best;
      }
      return null;
    };

    // ─── جفت‌کردن هر برنامه تمرینی با اشتراک «همان دوره» ───
    // قبلاً subscriptions[i] با ایندکس جفت می‌شد — دو لیست با مرتب‌سازی و
    // تعداد متفاوت (تولید مجدد، اشتراک pending بدون برنامه، تمدید بدون
    // برنامه جدید و ...) باعث می‌شد بعد از نقطه واگرایی، هر کارت برنامه
    // اشتراک اشتباه (تاریخ/وضعیت/درصد پیشرفت اشتباه) بگیرد.
    // راه درست (آینه الگوی جفت‌سازی meal-plan بالای همین فایل):
    //  ۱) اشتراکی که بازه اعتبارش (startDate → cancelledAt/endDate) لحظهٔ
    //     ساخت برنامه را پوشش می‌دهد — این حالت دورهای هفتگی و تولیدهای
    //     مجددِ همان اشتراک را هم درست جفت می‌کند (رابطه واقعی ۱:N است،
    //     برخلاف meal-plan که ۱:۱ است — پس بدون used-set).
    //  ۲) اگر هیچ اشتراکی پوشش نداد: نزدیک‌ترین اشتراک در پنجره ۱۰ دقیقه
    //     (حالت لبه: برنامه چند میلی‌ثانیه «قبل از» فعال‌شدن اشتراک pending
    //     نوشته شده — در دیتای زنده DB دیده شده است).
    //  ۳) هیچ تطبیق نبود → بدون برچسب اشتراک (وضعیت unknown + تاریخ خود برنامه).
    // نکته: اشتراک‌های pending (startDate=null) هرگز برنامه تولید نکرده‌اند و
    // فقط در پنجره ۱۰ دقیقه با createdAt خودشان قابل جفت‌شدن هستند.
    const subscriptionForWorkout = (wp: { createdAt: Date }) => {
      const t = wp.createdAt.getTime();
      let covering: (typeof subscriptions)[number] | null = null;
      let coveringStart = 0;
      for (const s of subscriptions) {
        if (!s.startDate) continue; // pending — دوره فعال نداشته است
        const start = s.startDate.getTime();
        const end = (s.cancelledAt ?? s.endDate)?.getTime() ?? Number.POSITIVE_INFINITY;
        if (t >= start && t <= end && (!covering || Math.abs(start - t) < Math.abs(coveringStart - t))) {
          covering = s;
          coveringStart = start;
        }
      }
      if (covering) return covering;
      // همان cycle تولید — نزدیک‌ترین اشتراک در پنجره ۱۰ دقیقه
      let best: (typeof subscriptions)[number] | null = null;
      let bestDiff = Number.POSITIVE_INFINITY;
      for (const s of subscriptions) {
        const diff = Math.abs((s.startDate ?? s.createdAt).getTime() - t);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = s;
        }
      }
      if (best && bestDiff <= 10 * 60 * 1000) return best;
      return null;
    };

    // ساخت خلاصه هر دوره برنامه
    // ⚠️ گارد JSON.parse: یک رکورد خراب نباید کل endpoint را 500 کند —
    // محتوای تمرینی خراب → کل ردیف skip؛ محتوای غذایی خراب → فقط اطلاعات
    // غذایی همان برنامه حذف می‌شود (برنامه تمرینی سالم نمایش داده می‌شود).
    const programs = workoutPlans.flatMap((wp) => {
      let content: any;
      try {
        content = JSON.parse(wp.content);
      } catch {
        console.error("[Program History] corrupt workoutPlan content — skipped:", wp.id);
        return [];
      }
      const mealPlan = mealPlanForWorkout(wp);
      let mealContent: any = null;
      if (mealPlan) {
        try {
          mealContent = JSON.parse(mealPlan.content);
        } catch {
          console.error("[Program History] corrupt mealPlan content — ignored:", mealPlan.id);
          mealContent = null;
        }
      }
      const sub = subscriptionForWorkout(wp);

      return [{
        id: wp.id,
        weekIndex: wp.weekIndex,
        active: wp.active,
        createdAt: wp.createdAt.toISOString(),
        days: content.days?.length || 0,
        exercises: content.days?.reduce((s: number, d: any) => s + (d.exercises?.length || 0), 0) || 0,
        weeklyGoal: content.weeklyGoal || "",
        notes: content.notes || "",
        // گرد کردن مقادیر تغذیه — AI گاهی اعداد floating-point با اعشار طولانی
        // (مثل ۲۱۸.۴۰۰۰۰۰۰۰۰۰۰۰۰۳) برمی‌گرداند که بدون گرد شدن در UI زشت نمایش داده می‌شد
        totalCalories: Math.round(mealContent?.totalCalories || 0),
        planName: sub?.plan || user.planName,
        status: sub?.status || "unknown",
        startDate: sub?.startDate?.toISOString() || wp.createdAt.toISOString(),
        endDate: sub?.endDate?.toISOString() || null,
        // تاریخ لغو توسط ادمین — اگر موجود باشد، برنامه از startDate تا cancelledAt نمایش داده می‌شود
        cancelledAt: sub?.cancelledAt?.toISOString() || null,
        // برنامه تمرینی کامل
        workoutDays: content.days || [],
        // مکمل‌های ساده (لیست تخت — برای همه پلن‌ها)
        supplements: mealContent?.supplements || content.supplements || [],
        // برنامه مکمل پیشرفته (با دسته‌بندی base/advanced/targeted و هشدارهای پزشکی)
        // فقط برای پلن‌های استاندارد به بالا — توسط AI در generateMealPlan تولید می‌شود
        supplementStack: mealContent?.supplementStack || [],
        // برنامه غذایی
        meals: mealContent?.meals || [],
        mealNotes: mealContent?.notes || "",
        waterLiters: Math.round((mealContent?.waterLiters || 2.5) * 10) / 10,
        totalProtein: Math.round(mealContent?.totalProtein || 0),
        totalCarbs: Math.round(mealContent?.totalCarbs || 0),
        totalFat: Math.round(mealContent?.totalFat || 0),
      }];
    });

    let aiAnalysis: string | null = null;

    // اگر درخواست تحلیل بود و کاربر حداقل ۱ برنامه قبلی دارد
    if (generateAnalysis && programs.length > 0 && user.planName) {
      try {
        const { avalaiClient, TEXT_MODEL, withSystemDirectives } = await import("@/lib/fitness/ai");

        // خلاصه پیشرفت کاربر
        const firstWeight = weightLogs[0]?.weight;
        const lastWeight = weightLogs[weightLogs.length - 1]?.weight;
        const weightChange = firstWeight && lastWeight ? (lastWeight - firstWeight).toFixed(1) : null;
        const checkupCount = checkups.length;
        const lastCheckup = checkups[0];

        const summary = `تاریخچه ورزشکار:
- تعداد برنامه‌های قبلی: ${programs.length}
- تغییر وزن: ${weightChange ? `${weightChange} کیلوگرم (${Number(weightChange) > 0 ? "افزایش" : "کاهش"})` : "نامشخص"}
- تعداد چکاپ‌های ثبت‌شده: ${checkupCount}
- آخرین وزن ثبت‌شده: ${lastWeight || "نامشخص"}
- برنامه‌های قبلی:
${programs.slice(0, 3).map((p, idx) => `  برنامه ${idx + 1}: ${p.days} روز، ${p.exercises} حرکت، ${p.totalCalories} کالری، هدف: ${p.weeklyGoal}`).join("\n")}

برای برنامه جدید، یک تحلیل کوتاه (۲-۳ پاراگراف) به زبان فارسی بنویس که:
۱. پیشرفت کاربر را در دوره‌های قبلی خلاصه کند
۲. نقاط قوت و ضعف را مشخص کند
۳. توضیح بدهد که برنامه جدید چه تفاوتی با قبلی دارد و چه تمرکزی دارد`;

        const completion = await avalaiClient.chat.completions.create({
          model: TEXT_MODEL,
          messages: [
            { role: "system", content: withSystemDirectives("تو فیتاپ هوشمند هستی — مربی متخصص ورزشی. به زبان فارسی پاسخ بده.") },
            { role: "user", content: summary },
          ],
        } as any);

        aiAnalysis = completion.choices[0]?.message?.content || null;
      } catch (err) {
        console.error("[Program History] AI analysis error:", err);
      }
    }

    // ─── اطلاعات پیش‌نیازها برای نمایش در programs-view (وظیفه ۱۰) ───
    // سیستم دانه‌دانه پیش‌نیازها: هر مورد (عکس بدن، ویدیو، آزمایش خون، اندازه‌ها)
    // به‌طور جداگانه با وضعیت خودش نمایش داده می‌شود.
    const userPlan = (user.planName as string) ?? null;
    const prereqCheck = await checkPrerequisites(user.id, userPlan as any);
    const pendingPrerequisites = getPendingPrerequisites(prereqCheck);

    // مقادیر قدیمی برای backward-compatibility
    const needsBodyPhoto = userPlan === "advanced" || userPlan === "ultimate";
    const needsVideo = userPlan === "ultimate";
    const bodyPhotoPrereq = prereqCheck.prerequisites.find((p) => p.type === "body_photo");
    const videoPrereq = prereqCheck.prerequisites.find((p) => p.type === "video_body");
    const hasBodyPhoto = bodyPhotoPrereq?.status === "completed";
    const hasVideo = videoPrereq?.status === "completed";

    // وضعیت درخواست برنامه
    const latestRequest = await db.programRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    const programStatus = latestRequest?.status ?? "ready";

    return Response.json({
      programs,
      totalPrograms: programs.length,
      weightLogs: weightLogs.map((w) => ({
        weight: w.weight,
        loggedAt: w.loggedAt.toISOString(),
      })),
      checkupCount: checkups.length,
      aiAnalysis,
      // اطلاعات پیش‌نیازها (سیستم دانه‌دانه جدید)
      prerequisites: prereqCheck.prerequisites,
      pendingPrerequisites,
      canGenerateProgram: prereqCheck.canGenerateProgram,
      blockingReason: prereqCheck.blockingReason,
      // مقادیر backward-compatible
      programStatus,
      needsBodyPhoto,
      hasBodyPhoto,
      needsVideo,
      hasVideo,
    });
  } catch (e) {
    return apiError(e);
  }
}
