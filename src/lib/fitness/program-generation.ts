import { db } from "@/lib/db";
import { generateWorkoutPlan, generateMealPlan } from "@/lib/fitness/ai";
import type { OnboardingData, Plan } from "@/lib/fitness/types";
import { checkPrerequisites } from "@/lib/fitness/prerequisites";
import { activatePendingSubscription } from "@/lib/fitness/subscription";
import { createNotification } from "@/lib/fitness/notifications";
import { buildUserDto } from "@/lib/fitness/auth";

/**
 * تولید برنامه (تمرینی + غذایی) در پس‌زمینه — هسته مشترک.
 *
 * چرا این فایل وجود دارد:
 * تولید برنامه با هوش مصنوعی ۱ تا ۵ دقیقه طول می‌کشد (با تفکر high بیشتر).
 * اگر داخل request handler به‌صورت سینکرون اجرا شود، درخواست از سقف تایم‌اوت
 * گیت‌وی عبور می‌کند و مرورگر پاسخ HTML خطا می‌گیرد («Unexpected token '<'») —
 * در حالی که سرور کار را ادامه می‌دهد و برنامه در نهایت ساخته می‌شود؛ یعنی
 * کاربر هم خطا می‌بیند هم بعداً برنامه دارد (باگ گزارش‌شده).
 *
 * راه‌حل: همه مسیرها (خرید، آپلود عکس بدن، تعیین تکلیف ویدیو/آزمایش خون،
 * retry از تب برنامه‌ها) از این تابع استفاده می‌کنند:
 *  ۱) وضعیت ProgramRequest فوراً «generating» می‌شود (UI بنر «در حال طراحی» نشان می‌دهد)
 *  ۲) تولید در پس‌زمینه (fire-and-forget) انجام می‌شود
 *  ۳) با موفقیت: برنامه‌ها ذخیره + وضعیت ready + نوتیفیکیشن «برنامه آماده شد»
 *  ۴) با خطا: وضعیت failed + نوتیفیکیشن (کاربر از تب برنامه‌ها retry می‌کند)
 */

/** پارس لیست ذخیره‌شده به‌صورت JSON یا CSV */
function safeParseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const t = raw.trim();
  if (!t) return [];
  try {
    const p = JSON.parse(t);
    if (Array.isArray(p)) return p.map((x) => String(x));
    if (typeof p === "string") return p.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  } catch {
    return t.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

/** ساخت OnboardingData از پروفایل ذخیره‌شده — وزن فعلی از WeightLog */
export async function buildOnboardingData(userId: string): Promise<OnboardingData | null> {
  const profile = await db.onboardingProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const latestWeightLog = await db.weightLog.findFirst({
    where: { userId },
    orderBy: { loggedAt: "desc" },
    select: { weight: true },
  });
  const currentWeight = latestWeightLog?.weight ?? profile.weight;

  return {
    gender: profile.gender as OnboardingData["gender"],
    age: profile.age,
    height: profile.height,
    weight: currentWeight,
    targetWeight: profile.targetWeight ?? undefined,
    goal: profile.goal as OnboardingData["goal"],
    activityLevel: profile.activityLevel as OnboardingData["activityLevel"],
    workoutDays: profile.workoutDays,
    workoutDaysList: safeParseList(profile.workoutDaysList),
    workoutPlace: profile.workoutPlace as OnboardingData["workoutPlace"],
    equipment: safeParseList(profile.equipment),
    diseases: profile.diseases,
    injuries: profile.injuries,
    allergies: profile.allergies,
    dietType: profile.dietType as OnboardingData["dietType"],
    trainingExperience: (profile.trainingExperience ?? undefined) as OnboardingData["trainingExperience"],
    previousTrainingType: profile.previousTrainingType ?? undefined,
    drugAllergies: profile.drugAllergies ?? undefined,
    currentMedications: profile.currentMedications ?? undefined,
    maxLifts: profile.maxLifts ?? undefined,
    bodyFrame: (profile.bodyFrame ?? undefined) as OnboardingData["bodyFrame"],
    sleepHours: profile.sleepHours ?? undefined,
    stressLevel: profile.stressLevel ?? undefined,
    waterHabit: profile.waterHabit ?? undefined,
    targetDate: profile.targetDate ?? undefined,
    workoutTime: (profile.workoutTime ?? undefined) as OnboardingData["workoutTime"],
    medicalConditions: safeParseList(profile.medicalConditions) as OnboardingData["medicalConditions"],
    currentSupplements: profile.currentSupplements ?? undefined,
    dislikedFoods: profile.dislikedFoods ?? undefined,
    preferredCuisine: (profile.preferredCuisine ?? undefined) as OnboardingData["preferredCuisine"],
    waterGoalMl: (() => {
      const w = currentWeight || 70;
      const baseMl = Math.round(w * 35);
      let adj = 0;
      const al = profile.activityLevel;
      if (al === "active" || al === "very_active") adj = 500;
      else if (al === "moderate") adj = 250;
      return baseMl + adj;
    })(),
  };
}

/** ساخت extras برای AI از نتایج تحلیل ذخیره‌شده (عکس بدن، ویدیو، آزمایش خون، تمدید) */
export async function buildGenerationExtras(userId: string): Promise<{
  bodyPhotoAnalysis?: string;
  videoAnalysisResult?: string;
  bloodTestReport?: string;
  renewalContext?: string;
}> {
  const extras: {
    bodyPhotoAnalysis?: string;
    videoAnalysisResult?: string;
    bloodTestReport?: string;
    renewalContext?: string;
  } = {};

  // آخرین تحلیل عکس بدن
  try {
    const latestBodyPhoto = await db.analysisResult.findFirst({
      where: { userId, type: "body_photo" },
      orderBy: { createdAt: "desc" },
      select: { result: true, createdAt: true },
    });
    if (latestBodyPhoto?.result) {
      try {
        const parsed = JSON.parse(latestBodyPhoto.result);
        const analysisText = parsed.analysis ? String(parsed.analysis) : "";
        if (analysisText) {
          extras.bodyPhotoAnalysis = `آخرین تحلیل عکس بدن کاربر (تاریخ: ${new Date(latestBodyPhoto.createdAt).toLocaleDateString("fa-IR")}):\n${analysisText}`;
        } else {
          const summaryParts: string[] = [];
          if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
            summaryParts.push(`توصیه‌ها: ${parsed.recommendations.slice(0, 3).join("، ")}`);
          }
          if (parsed.bodyScore != null) summaryParts.push(`امتیاز فرم بدن: ${parsed.bodyScore} از ۱۰۰`);
          if (summaryParts.length > 0) {
            extras.bodyPhotoAnalysis = `آخرین تحلیل عکس بدن کاربر (تاریخ: ${new Date(latestBodyPhoto.createdAt).toLocaleDateString("fa-IR")}):\n${summaryParts.join("\n")}`;
          }
        }
      } catch {
        extras.bodyPhotoAnalysis = `آخرین تحلیل عکس بدن کاربر:\n${latestBodyPhoto.result.slice(0, 800)}`;
      }
    }
  } catch (e) {
    console.error("[program-generation] failed to load body photo analysis:", e);
  }

  // آخرین تحلیل ویدیو
  try {
    const latestVideo = await db.analysisResult.findFirst({
      where: { userId, type: "video_analysis" },
      orderBy: { createdAt: "desc" },
      select: { result: true, createdAt: true },
    });
    if (latestVideo?.result) {
      try {
        const parsed = JSON.parse(latestVideo.result);
        if (parsed.analysis && typeof parsed.analysis === "string") {
          extras.videoAnalysisResult = `آخرین تحلیل ویدیوی فرم بدن کاربر (تاریخ: ${new Date(latestVideo.createdAt).toLocaleDateString("fa-IR")}):\n${parsed.analysis}`;
        } else {
          const summaryParts: string[] = [];
          if (parsed.posture) summaryParts.push(`پوسچر: ${parsed.posture}`);
          if (parsed.symmetry != null) summaryParts.push(`تقارن: ${parsed.symmetry} از ۱۰۰`);
          if (parsed.score != null) summaryParts.push(`امتیاز: ${parsed.score} از ۱۰۰`);
          if (parsed.issues && Array.isArray(parsed.issues) && parsed.issues.length > 0) {
            summaryParts.push(`مشکلات: ${parsed.issues.join("، ")}`);
          }
          if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
            summaryParts.push(`توصیه‌ها: ${parsed.recommendations.slice(0, 3).join("، ")}`);
          }
          if (summaryParts.length > 0) {
            extras.videoAnalysisResult = `آخرین تحلیل ویدیوی فرم بدن کاربر (تاریخ: ${new Date(latestVideo.createdAt).toLocaleDateString("fa-IR")}):\n${summaryParts.join("\n")}`;
          }
        }
      } catch {
        extras.videoAnalysisResult = `آخرین تحلیل ویدیوی کاربر:\n${latestVideo.result.slice(0, 800)}`;
      }
    }
  } catch (e) {
    console.error("[program-generation] failed to load video analysis:", e);
  }

  // آخرین آزمایش خون
  try {
    const latestBloodTest = await db.analysisResult.findFirst({
      where: { userId, type: "blood_test" },
      orderBy: { createdAt: "desc" },
      select: { result: true, createdAt: true },
    });
    if (latestBloodTest?.result) {
      try {
        const parsed = JSON.parse(latestBloodTest.result);
        const summaryParts: string[] = [];
        if (parsed.summary) summaryParts.push(String(parsed.summary));
        if (parsed.abnormalities && Array.isArray(parsed.abnormalities) && parsed.abnormalities.length > 0) {
          summaryParts.push(`ناهنجاری‌ها: ${parsed.abnormalities.map((a: any) => typeof a === "string" ? a : (a?.name || a?.test || JSON.stringify(a))).join("، ")}`);
        }
        if (parsed.recommendations && Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
          summaryParts.push(`توصیه‌ها: ${parsed.recommendations.slice(0, 3).join("، ")}`);
        }
        if (summaryParts.length > 0) {
          extras.bloodTestReport = `آخرین آزمایش خون کاربر (تاریخ: ${new Date(latestBloodTest.createdAt).toLocaleDateString("fa-IR")}):\n${summaryParts.join("\n")}`;
        }
      } catch {
        extras.bloodTestReport = `آخرین آزمایش خون کاربر:\n${latestBloodTest.result.slice(0, 800)}`;
      }
    }
  } catch (e) {
    console.error("[program-generation] failed to load blood test:", e);
  }

  // بستر تمدید / بازتولید — پیشرفت کاربر در دوره قبلی
  try {
    const previousSub = await db.subscription.findFirst({
      where: { userId, status: "expired" },
      orderBy: { endDate: "desc" },
      select: { plan: true, durationDays: true, endDate: true },
    });
    const previousPlan = await db.workoutPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (previousSub || previousPlan) {
      const latestCheckup = await db.checkup.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { weight: true, bodyFatPercent: true, fatigueLevel: true, sleepQuality: true, dietAdherence: true, workoutAdherence: true, phaseNumber: true, isFinalCheckup: true },
      });
      const parts: string[] = [];
      if (previousSub) {
        parts.push(`[سیستم - تمدید اشتراک]: این کاربر قبلاً پلن ${previousSub.plan} را برای ${previousSub.durationDays} روز استفاده کرده است.`);
      } else {
        parts.push(`[سیستم - بازتولید برنامه]: کاربر قبلاً برنامه داشته است.`);
      }
      if (latestCheckup) {
        parts.push(`پیشرفت کاربر:`);
        if (latestCheckup.weight) parts.push(`- وزن فعلی: ${latestCheckup.weight}kg`);
        if (latestCheckup.bodyFatPercent) parts.push(`- درصد چربی: ${latestCheckup.bodyFatPercent}%`);
        if (latestCheckup.fatigueLevel) parts.push(`- سطح انرژی: ${latestCheckup.fatigueLevel}/5`);
        if (latestCheckup.sleepQuality) parts.push(`- کیفیت خواب: ${latestCheckup.sleepQuality}/5`);
        if (latestCheckup.dietAdherence) parts.push(`- رعایت رژیم: ${latestCheckup.dietAdherence}/5`);
        if (latestCheckup.workoutAdherence) parts.push(`- رعایت تمرین: ${latestCheckup.workoutAdherence}/5`);
        if (latestCheckup.phaseNumber) parts.push(`- فاز تکمیل‌شده: ${latestCheckup.phaseNumber}${latestCheckup.isFinalCheckup ? " (چکاپ نهایی)" : ""}`);
        parts.push(`برنامه جدید را بر اساس این پیشرفت طراحی کن:`);
        if (latestCheckup.workoutAdherence && latestCheckup.workoutAdherence >= 4) {
          parts.push(`✅ رعایت عالی تمرین — شدت بیشتر پیشنهاد بده`);
        }
        if (latestCheckup.workoutAdherence && latestCheckup.workoutAdherence <= 2) {
          parts.push(`⚠️ رعایت ضعیف تمرین — حجم کمتر و تنوع بیشتر`);
        }
        if (latestCheckup.fatigueLevel && latestCheckup.fatigueLevel <= 2) {
          parts.push(`⚠️ خستگی بالا — حجم کمتر و استراحت بیشتر`);
        }
        if (latestCheckup.dietAdherence && latestCheckup.dietAdherence >= 4) {
          parts.push(`✅ رعایت عالی رژیم — کالری دقیق‌تر`);
        }
      }
      if (parts.length > 0) extras.renewalContext = parts.join("\n");
    }
  } catch (e) {
    console.error("[program-generation] failed to build renewalContext:", e);
  }

  return extras;
}

export interface StartGenerationResult {
  started: boolean;
  reason?: "no_profile" | "prerequisites_incomplete" | "already_generating" | "already_has_fresh_plan" | "no_plan";
  blockingReason?: string | null;
}

/**
 * شروع تولید برنامه در پس‌زمینه برای کاربر.
 *
 * پیش‌شرط‌ها:
 *  - اشتراک فعال یا pending (پلن مؤثر)
 *  - پروفایل آنبوردینگ موجود
 *  - همه پیش‌نیازها تعیین تکلیف شده باشند
 *  - هیچ تولید در حال اجرای تازه‌ای وجود نداشته باشد (جلوگیری از دوباره‌کاری)
 *
 * خروجی فوری برمی‌گرداند؛ تولید در پس‌زمینه ادامه می‌یابد.
 */
export async function startProgramGenerationInBackground(userId: string): Promise<StartGenerationResult> {
  // پلن مؤثر (active یا pending داخل پنجره)
  const dto = await buildUserDto(userId);
  const effectivePlan = (dto?.planName ?? null) as Plan | null;
  if (!effectivePlan) {
    return { started: false, reason: "no_plan" };
  }

  const profile = await db.onboardingProfile.findUnique({ where: { userId } });
  if (!profile) {
    return { started: false, reason: "no_profile" };
  }

  // پیش‌نیازها باید تعیین تکلیف شده باشند
  const prereqCheck = await checkPrerequisites(userId, effectivePlan);
  if (!prereqCheck.canGenerateProgram) {
    return { started: false, reason: "prerequisites_incomplete", blockingReason: prereqCheck.blockingReason };
  }

  // جلوگیری از تولید همزمان: اگر آخرین درخواست «generating» و تازه است، دوباره شروع نکن
  // (پنجره ۲۰ دقیقه‌ای هم‌راستا با بازیابی درخواست‌های گیرکرده — M3)
  const latestReq = await db.programRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const stuckWindowAgo = new Date(Date.now() - STUCK_GENERATION_WINDOW_MS);

  // ─── Claim اتمیک (رفع TOCTOU) ───
  // قبلاً «خواندن وضعیت» و «نوشتن generating» دو مرحله جدا بودند؛ دو فراخوانی
  // همزمان (مثلاً verify + submit-body-analysis) هر دو از چک رد می‌شدند و
  // تولیدِ دوباره AI (هزینه دوبرابر + برنامه تکراری) شروع می‌شد.
  // حالا خودِ به‌روزرسانی شرطی است: فقط اگر درخواست در حال generatingِ تازه
  // نباشد، وضعیت به «generating» claim می‌شود — یک برنده، بقیه متوقف.
  let reqId: string;
  if (latestReq) {
    const claimed = await db.programRequest.updateMany({
      where: {
        id: latestReq.id,
        OR: [
          { status: { not: "generating" } },
          { updatedAt: { lte: stuckWindowAgo } }, // generatingِ گیرکرده → قابل claim مجدد
        ],
      },
      data: { status: "generating" },
    });
    if (claimed.count === 0) {
      return { started: false, reason: "already_generating" };
    }
    reqId = latestReq.id;
  } else {
    // اولین درخواست — create می‌کند، سپس برای امنیت دوباره چک می‌کنیم که
    // فراخوانی همزمان دیگری در همان لحظه درخواست دیگری نساخته باشد.
    const created = await db.programRequest.create({
      data: { userId, plan: effectivePlan, billingPeriod: "monthly", status: "generating" },
    });
    const concurrent = await db.programRequest.findFirst({
      where: {
        userId,
        status: "generating",
        id: { not: created.id },
        updatedAt: { gt: stuckWindowAgo },
      },
      orderBy: { createdAt: "asc" },
    });
    if (concurrent) {
      // این درخواستِ دومِ همزمان است → تولیدِ تکراری را لغو کن
      await db.programRequest.update({
        where: { id: created.id },
        data: { status: "failed" },
      }).catch(() => {});
      return { started: false, reason: "already_generating" };
    }
    reqId = created.id;
  }

  // فعال‌سازی اشتراک pending — دوره ۴۵ روزه از همین لحظه شروع می‌شود،
  // مستقل از موفقیت AI (entitlement کاربر از دست نمی‌رود)
  try {
    const activated = await activatePendingSubscription(userId);
    if (activated) {
      console.log("[program-generation] pending subscription activated:", activated.id);
    }
  } catch (e) {
    console.error("[program-generation] failed to activate pending subscription:", e);
  }

  // ─── تولید در پس‌زمینه (fire-and-forget) ───
  // reqId از بلوک بالا (update/create) می‌آید — هرگز null نیست
  void (async () => {
    const startedAt = Date.now();
    try {
      const [planData, extras] = await Promise.all([
        buildOnboardingData(userId),
        buildGenerationExtras(userId),
      ]);
      if (!planData) throw new Error("پروفایل آنبوردینگ یافت نشد");

      const [workout, meal] = await Promise.all([
        generateWorkoutPlan(planData, effectivePlan, extras),
        generateMealPlan(planData, effectivePlan, extras),
      ]);

      // غیرفعال‌سازی برنامه‌های قبلی فقط بعد از موفقیت تولید (C4)
      await db.workoutPlan.updateMany({ where: { userId }, data: { active: false } });
      await db.mealPlan.updateMany({ where: { userId }, data: { active: false } });

      await db.workoutPlan.create({
        data: { userId, content: JSON.stringify(workout), active: true },
      });
      await db.mealPlan.create({
        data: { userId, content: JSON.stringify(meal), totalCal: meal.totalCalories, active: true },
      });

      if (reqId) {
        await db.programRequest.update({ where: { id: reqId }, data: { status: "ready" } });
      }

      await createNotification(
        userId,
        "achievement",
        "برنامه شما آماده شد! 🎯",
        "برنامه تمرینی و غذایی شخصی‌سازی‌شده شما توسط فیتاپ هوشمند ساخته شد. از بخش «تمرینات» و «تغذیه» مشاهده کنید.",
        "?tab=programs"
      );
      console.log(`[program-generation] completed for ${userId} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
    } catch (err) {
      console.error("[program-generation] background generation failed:", err);
      try {
        if (reqId) {
          await db.programRequest.update({ where: { id: reqId }, data: { status: "failed" } });
        }
      } catch {}
      try {
        await createNotification(
          userId,
          "system",
          "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
          "تولید برنامه ورزشی و غذایی شما با خطا مواجه شد. لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید یا با پشتیبانی در ارتباط باشید.",
          "?tab=programs",
          { from: "program-generation", action: "plan_generation_failed" }
        );
      } catch {}
    }
  })();

  return { started: true };
}

/** پیام فارسی استاندارد «در حال آماده‌سازی» — برای پاسخ API‌ها */
export const PROGRAM_PREPARING_MESSAGE =
  "برنامه شما در حال آماده‌سازی است — پس از آماده‌سازی به شما اطلاع می‌دهیم.";

/**
 * پنجره «تولید گیرکرده» (M3) — باید از بدترین حالت تولید بزرگ‌تر باشد تا
 * تولیدِ هنوز-در-حال-اجرا اشتباهی «یتیم» تشخیص داده نشود و تولید موازی دوباره
 * شروع نشود (هزینه ۲× AI). بدترین حالت: ۲ تلاش × ۲۸۰s + fallback ۲۸۰s ≈ ۱۴ دقیقه
 * → پنجره ۲۰ دقیقه.
 */
const STUCK_GENERATION_WINDOW_MS = 20 * 60 * 1000;

/**
 * Watchdog خودترمیم — بازیابی درخواست‌های «generating» گیرکرده (یتیم‌شده).
 *
 * چرا: تولید برنامه fire-and-forget است. اگر پروسه سرور وسط تولید restart شود
 * (dev-mode memory restart، crash، دیپلوی)، پروسه پس‌زمینه می‌میرد و
 * ProgramRequest برای همیشه «generating» می‌ماند.
 *
 * رفتار:
 *  - درخواست گیرکرده (>۲۰ دقیقه بدون به‌روزرسانی) پیدا می‌شود
 *  - اگر برنامه‌ای بعد از شروع همین چرخه تولید ذخیره شده باشد → ready
 *    (تولید کامل شده ولی آپدیت status به‌خاطر مرگ پروسه نرسیده)
 *  - اگر برنامه‌ای نیست و autoRetryCount < 1:
 *      → یک‌بار به‌صورت خودکار تولید دوباره شروع می‌شود (بدون دخالت کاربر)
 *  - وگرنه: failed (کاربر از تب برنامه‌ها دکمه retry را می‌زند)
 *
 * این تابع از endpointهایی صدا زده می‌شود که فرانت‌اند موقع generating به آن‌ها
 * poll می‌کند (coach/plan GET و program-history GET) — یعنی watchdog همان‌جا
 * فعال می‌شود که کاربر منتظر برنامه است.
 */
export async function recoverStuckGenerations(userId: string): Promise<void> {
  try {
    const stuckWindowAgo = new Date(Date.now() - STUCK_GENERATION_WINDOW_MS);
    const stuck = await db.programRequest.findFirst({
      where: { userId, status: "generating", updatedAt: { lt: stuckWindowAgo } },
      orderBy: { createdAt: "desc" },
    });
    if (!stuck) return;

    // آیا برنامه‌ای در این مدت ذخیره شده؟ (تولید ممکن است کامل شده باشد ولی
    // آپدیت status به‌خاطر مرگ پروسه نرسیده باشد)
    // ─── M2: فقط برنامه‌ای که «بعد از شروع همین چرخه تولید» ساخته شده دلیل
    // آماده‌بودن است — updatedAt همان لحظه‌ای است که وضعیت generating شده؛
    // برنامه دوره قبلی نباید تولید گیرکردهِ کاربر تمدیدی را ready کند.
    const hasPlan = await db.workoutPlan.findFirst({
      where: { userId, createdAt: { gte: stuck.updatedAt } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (hasPlan) {
      // برنامه موجود است — وضعیت را ready کن (نه failed!)
      await db.programRequest.update({
        where: { id: stuck.id },
        data: { status: "ready" },
      });
      console.log("[watchdog] recovered orphaned generating → ready (plan exists):", stuck.id);
      return;
    }

    // برنامه‌ای نیست — اگر تابه‌حال خودترمیم نشده، یک‌بار دوباره شروع کن
    if (stuck.autoRetryCount < 1) {
      await db.programRequest.update({
        where: { id: stuck.id },
        data: { status: "failed", autoRetryCount: { increment: 1 } },
      });
      console.log("[watchdog] auto-retrying orphaned generation:", stuck.id);
      const result = await startProgramGenerationInBackground(userId);
      if (result.started) {
        console.log("[watchdog] auto-retry started for:", userId);
      } else {
        console.log("[watchdog] auto-retry not started:", result.reason);
      }
      return;
    }

    // قبلاً یک‌بار خودترمیم شده و باز گیر کرده — failed بماند (کاربر دستی retry می‌کند)
    await db.programRequest.update({
      where: { id: stuck.id },
      data: { status: "failed" },
    });
    console.log("[watchdog] marked stuck generation as failed (retry budget exhausted):", stuck.id);
  } catch (e) {
    // watchdog هرگز نباید مسیر caller را بشکند
    console.error("[watchdog] recoverStuckGenerations error:", e);
  }
}
