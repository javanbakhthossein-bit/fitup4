import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { avalaiClient, TEXT_MODEL, withSystemDirectives } from "@/lib/fitness/ai";
import {
  GOAL_LABELS, ACTIVITY_LABELS, GENDER_LABELS,
  WORKOUT_PLACE_LABELS, DIET_LABELS, TRAINING_EXPERIENCE_LABELS,
  BODY_FRAME_LABELS, WORKOUT_TIME_LABELS, PREFERRED_CUISINE_LABELS,
  MEDICAL_CONDITION_LABELS,
  type OnboardingData, type Goal, type Plan,
} from "@/lib/fitness/types";
import {
  calculateBodyComposition,
  calculateMuscleMassPercent,
  type BodyComposition,
} from "@/lib/fitness/body-composition";

/** Robustly parse a stored JSON-or-CSV string list field. */
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

// ─────────────────────────────────────────────────────────────────────────────
// Macro recommendation
// Calculates target calories + protein/carbs/fat grams based on user's goal.
// ─────────────────────────────────────────────────────────────────────────────
interface MacroRecommendation {
  targetCalories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  proteinPerKg: number;
  deficitPercent: number; // positive = deficit, negative = surplus
}

function calculateMacros(
  goal: Goal,
  tdee: number,
  weightKg: number,
): MacroRecommendation {
  let targetCalories = tdee;
  let proteinPerKg = 1.8;
  let deficitPercent = 0; // positive = cut, negative = bulk

  switch (goal) {
    case "fat_loss":
      // 25% deficit
      deficitPercent = 0.25;
      targetCalories = Math.round(tdee * 0.75);
      proteinPerKg = 2.2;
      break;
    case "muscle_gain":
      // 10% surplus
      deficitPercent = -0.10;
      targetCalories = Math.round(tdee * 1.10);
      proteinPerKg = 2.0;
      break;
    case "endurance":
    case "fitness":
    case "strength":
    default:
      // maintenance
      deficitPercent = 0;
      targetCalories = tdee;
      proteinPerKg = 1.8;
      break;
  }

  const protein_g = Math.round(weightKg * proteinPerKg);
  const proteinCal = protein_g * 4;

  // Fat = 25% of total calories
  const fatCal = targetCalories * 0.25;
  const fat_g = Math.round(fatCal / 9);

  // Carbs = remaining calories
  const carbsCal = Math.max(0, targetCalories - proteinCal - fatCal);
  const carbs_g = Math.round(carbsCal / 4);

  return {
    targetCalories,
    protein_g,
    carbs_g,
    fat_g,
    proteinPerKg,
    deficitPercent: Math.round(deficitPercent * 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Weight goal trajectory
// ─────────────────────────────────────────────────────────────────────────────
interface WeightTrajectory {
  currentWeight: number;
  targetWeight: number;
  weeksToGoal: number;
  weeklyRate: number; // kg per week (negative = loss)
  weeklyCalorieAdjustment: number; // kcal/day vs TDEE (negative = deficit)
}

function calculateTrajectory(
  goal: Goal,
  currentWeight: number,
  targetWeight: number | undefined | null,
  tdee: number,
): WeightTrajectory | null {
  if (!targetWeight || targetWeight <= 0) return null;
  const diff = targetWeight - currentWeight; // positive = gain, negative = loss

  // Determine safe weekly rate based on goal direction
  let weeklyRate: number;
  if (goal === "fat_loss" || diff < 0) {
    // Fat loss: 0.5 kg/week safe rate
    weeklyRate = -0.5;
  } else if (goal === "muscle_gain" || diff > 0) {
    // Muscle gain: 0.25 kg/week safe rate
    weeklyRate = 0.25;
  } else {
    // Maintenance
    return null;
  }

  // If the rate sign doesn't match the goal direction (e.g. user wants to lose
  // weight but target is heavier than current), bail out.
  if (Math.sign(diff) !== Math.sign(weeklyRate)) return null;

  const weeksToGoal = Math.max(1, Math.ceil(Math.abs(diff) / Math.abs(weeklyRate)));

  // Calorie adjustment: 1 kg fat ≈ 7700 kcal. Per week: rate * 7700. Per day: / 7.
  const weeklyCalorieAdjustment = Math.round((weeklyRate * 7700) / 7);

  return {
    currentWeight: Math.round(currentWeight * 10) / 10,
    targetWeight: Math.round(targetWeight * 10) / 10,
    weeksToGoal,
    weeklyRate,
    weeklyCalorieAdjustment,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan recommendation
// ─────────────────────────────────────────────────────────────────────────────
interface PlanRecommendation {
  recommendedPlan: Plan;
  reason: string;
}

function recommendPlan(
  goal: Goal,
  experience: string | null | undefined,
  hasInjuries: boolean,
  hasDiseases: boolean,
  wantsDetailedAnalysis: boolean,
): PlanRecommendation {
  const isBeginner = !experience || experience === "beginner";
  const hasMedicalConcern = hasInjuries || hasDiseases;

  // ─── سیاست پیشنهاد پلن (درخواست مالک) ───
  // پلن اقتصادی (۳۵۰ هزار تومان) در پیشنهاد خودکار «خیلی کمتر» ارائه شود —
  // عملاً هرگز به‌عنوان پلن پیشنهادی انتخاب نمی‌شود؛ فقط در فهرست همه پلن‌ها
  // قابل انتخاب است (قابلیت انتخاب هر پلن حفظ شده — در analysis-screen).
  // پیشنهاد همیشه از پلن‌های ۸۰۰ هزار تومان به بالاست:
  //   استاندارد (۸۰۰K) ← مبتدی‌ها با هدف عمومی
  //   پیشرفته (۱.۲M) ← تمرین‌کننده‌های جدی / اهداف چربی‌سوزی و عضله‌سازی
  //   حرفه‌ای (۱.۸M) ← حرفه‌ای‌ها، نگرانی پزشکی، آنالیز ویدیو/آزمایش

  // Ultimate is for users who want detailed video/blood analysis or are pro athletes with medical concerns
  if (wantsDetailedAnalysis || (experience === "pro" && hasMedicalConcern)) {
    return {
      recommendedPlan: "ultimate",
      reason:
        "با توجه به نیاز شما به آنالیز ویدیویی و آزمایش خون، پلن حرفه‌ای بهترین انتخاب است. این پلن شامل نظارت دقیق روی فرم حرکات و تحلیل کامل سلامت بدن شماست.",
    };
  }

  // Fat loss / muscle gain goals benefit most from AI coaching + meal/body photo analysis
  if (goal === "fat_loss" || goal === "muscle_gain") {
    if (isBeginner) {
      return {
        recommendedPlan: "advanced",
        reason:
          "برای کاهش چربی و عضله‌سازی، سرعت و کیفیت نتیجه مهم‌تر از هر چیز است. پلن پیشرفته با چت بی‌نهایت با فیتاپ هوشمند و آنالیز عکس غذا و بدن، از همان روز اول مسیر را برایت دقیق می‌کند.",
      };
    }
    return {
      recommendedPlan: "advanced",
      reason:
        "برای هدف کاهش چربی/عضله‌سازی با سابقه ورزشی، پلن پیشرفته با چت بی‌نهایت با مربی هوشمند، آنالیز وعده‌های غذایی و عکس بدن، بهترین نتیجه را برای شما می‌آورد.",
    };
  }

  // Strength/endurance/fitness goals — intermediate+ users → advanced
  if (!isBeginner) {
    return {
      recommendedPlan: "advanced",
      reason:
        "برای رسیدن به اهداف قدرتی/استقامت با سابقه ورزشی، پلن پیشرفته با دستیار هوشمند، حالت باشگاه و آنالیز عکس بدن، شما را در مسیر پیشرفت نگه می‌دارد.",
    };
  }

  // Default: standard (پلن استاندارد ۸۰۰ هزار تومان) for general fitness beginners
  return {
    recommendedPlan: "standard",
    reason:
      "برای شروع مسیر تناسب اندام، پلن استاندارد با برنامه مکمل‌ها، چکاپ‌های دوره‌ای و داشبورد پیشرفته، بهترین تعادل بین قیمت و امکانات را دارد.",
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await db.onboardingProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return Response.json({ error: "اطلاعات آنبوردینگ یافت نشد." }, { status: 400 });
    }

    const data: OnboardingData = {
      gender: profile.gender as OnboardingData["gender"],
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
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
    };

    // Fetch the baseline checkup (phase 0) — اندازه‌های بدنی (chest/arm/waist/hip/thigh/neck)
    // در OnboardingProfile ذخیره نمی‌شوند؛ در چکاپ phase 0 ذخیره می‌شوند.
    // shoulder/calf فقط در OnboardingProfile ذخیره می‌شوند (فیلدهای BODY-COMPOSITION-PRO).
    const baselineCheckupForCalc = await db.checkup.findFirst({
      where: { userId: user.id, phaseNumber: 0 },
      orderBy: { createdAt: "desc" },
    });

    // ─── محاسبه ترکیب بدن (US Navy Body Fat Formula) ───
    // اگر کاربر اندازه‌های لازم را دارد، درصد چربی، جرم خالص و جرم چربی را محاسبه می‌کنیم.
    // برای محاسبه: waist + neck [+ hip for women] از چکاپ baseline + height/weight/gender از OnboardingProfile.
    const bodyComposition: BodyComposition | null = calculateBodyComposition({
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      waist: baselineCheckupForCalc?.waistMeasurement ?? null,
      neck: baselineCheckupForCalc?.neckMeasurement ?? profile.neckMeasurement ?? null,
      hip: baselineCheckupForCalc?.hipMeasurement ?? null,
    });
    const muscleMass = bodyComposition
      ? calculateMuscleMassPercent({ weight: data.weight, leanBodyMass: bodyComposition.leanBodyMass })
      : null;

    // Calculate BMI, BMR, TDEE
    const heightM = data.height / 100;
    const bmi = data.weight / (heightM * heightM);

    const bmr =
      data.gender === "male"
        ? 10 * data.weight + 6.25 * data.height - 5 * data.age + 5
        : 10 * data.weight + 6.25 * data.height - 5 * data.age - 161;

    const activityFactors: Record<string, number> = {
      sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
    };
    const tdee = Math.round(bmr * (activityFactors[data.activityLevel] || 1.55));

    // ─── Macro + trajectory + plan recommendations ───
    const macros = calculateMacros(data.goal, tdee, data.weight);
    const trajectory = calculateTrajectory(data.goal, data.weight, data.targetWeight, tdee);

    // Detect if user wants detailed analysis (came from onboarding with body images / blood test)
    // We don't have direct access to body images count here, so we use heuristics.
    const wantsDetailedAnalysis = !!data.maxLifts || data.trainingExperience === "pro";

    const planRecommendation = recommendPlan(
      data.goal,
      data.trainingExperience,
      !!data.injuries,
      !!data.diseases,
      wantsDetailedAnalysis,
    );

    // ─── AI analysis — with caching ───
    // Bypass the cache when ?force=1 is passed.
    const forceRefresh = req.nextUrl.searchParams.get("force") === "1";

    const workoutDaysList = data.workoutDaysList ?? [];

    let analysisText = "";
    if (!forceRefresh && profile.aiAnalysis) {
      analysisText = profile.aiAnalysis;
    } else {
      const userName = user.name || "ورزشکار";

      const prompt = `تو فیتاپ هوشمند هستی. یک تحلیل اختصاصی کوتاه (حداکثر ۳ پاراگراف) از وضعیت فیزیکی این ورزشکار بنویس. لحن علمی، دوستانه و انگیزشی. فقط تحلیل بده، برنامه تجویز نکن.

اطلاعات ورزشکار:
- نام: ${userName}
- جنسیت: ${GENDER_LABELS[data.gender]}
- سن: ${data.age} سال
- قد: ${data.height} سانتی‌متر
- وزن: ${data.weight} کیلوگرم
- وزن هدف: ${data.targetWeight || "نامشخص"} کیلوگرم
- هدف: ${GOAL_LABELS[data.goal]}
- سطح فعالیت: ${ACTIVITY_LABELS[data.activityLevel]}
- روزهای تمرین: ${workoutDaysList.length > 0 ? workoutDaysList.join("، ") : data.workoutDays + " روز در هفته"}
- مکان تمرین: ${WORKOUT_PLACE_LABELS[data.workoutPlace]}
- آسیب‌دیدگی: ${data.injuries || "ندارد"}
- بیماری: ${data.diseases || "ندارد"}
- حساسیت غذایی: ${data.allergies || "ندارد"}
- BMI: ${bmi.toFixed(1)}
- BMR: ${Math.round(bmr)} کالری
- TDEE: ${tdee} کالری
${bodyComposition ? `- درصد چربی بدن: ${bodyComposition.bodyFatPercent}٪ (${bodyComposition.bodyFatCategory})
- جرم بدون چربی (LBM): ${bodyComposition.leanBodyMass} کیلوگرم
- جرم چربی: ${bodyComposition.fatMass} کیلوگرم
${muscleMass ? `- درصد عضله تقریبی: ${muscleMass.muscleMassPercent}٪` : ""}
` : ""}
تحلیل را با نام کاربر شروع کن. به نکات مهم مثل BMI${bodyComposition ? "، درصد چربی بدن" : ""}، فاصله تا وزن هدف، و توصیه‌های کلی اشاره کن. در پایان فقط یک جمله کوتاه بگو که برای دریافت برنامه اختصاصی باید از پلن‌های فیتاپ استفاده کند — ⚠️ نام هیچ پلن یا قیمتی را در متن تحلیل ذکر نکن (پیشنهاد پلن جداگانه و خودکار در UI نمایش داده می‌شود).`;

      try {
        const completion = await avalaiClient.chat.completions.create({
          model: TEXT_MODEL,
          messages: [
            { role: "system", content: withSystemDirectives("تو فیتاپ هوشمند هستی — مربی متخصص ورزشی و تغذیه. به زبان فارسی پاسخ بده.") },
            { role: "user", content: prompt },
          ],
        } as any);
        analysisText = completion.choices[0]?.message?.content || "";
      } catch (err) {
        console.error("[Analysis] AI error:", err);
        analysisText = `${userName} عزیز، بر اساس اطلاعات شما:\n\nشاخص توده بدنی (BMI) شما ${bmi.toFixed(1)} است که در دسته‌بندی ${bmi < 18.5 ? "کم‌وزن" : bmi < 25 ? "وزن نرمال" : bmi < 30 ? "اضافه‌وزن" : "چاق"} قرار می‌گیرد. کالری مورد نیاز روزانه شما حدود ${tdee} کیلوکالری است.\n\nبرای رسیدن به هدف ${GOAL_LABELS[data.goal]}، توصیه می‌شود یک برنامه تمرینی و غذایی اختصاصی تهیه کنید. فیتاپ هوشمند آماده طراحی برنامه متناسب با شرایط شماست.`;
      }

      // Cache the AI analysis for next visit
      try {
        await db.onboardingProfile.update({
          where: { userId: user.id },
          data: { aiAnalysis: analysisText },
        });
      } catch (cacheErr) {
        console.error("[Analysis] failed to cache aiAnalysis:", cacheErr);
      }
    }

    // Fetch the baseline checkup (phase 0) for body measurements
    const baselineCheckup = await db.checkup.findFirst({
      where: { userId: user.id, phaseNumber: 0 },
      orderBy: { createdAt: "desc" },
    });

    // Filter out null measurements so the client only shows what's actually present
    const measurements: Record<string, number> = {};
    if (baselineCheckup) {
      if (baselineCheckup.chestMeasurement != null) measurements.chest = baselineCheckup.chestMeasurement;
      if (baselineCheckup.armMeasurement != null) measurements.arm = baselineCheckup.armMeasurement;
      if (baselineCheckup.waistMeasurement != null) measurements.waist = baselineCheckup.waistMeasurement;
      if (baselineCheckup.hipMeasurement != null) measurements.hip = baselineCheckup.hipMeasurement;
      if (baselineCheckup.thighMeasurement != null) measurements.thigh = baselineCheckup.thighMeasurement;
      if (baselineCheckup.neckMeasurement != null) measurements.neck = baselineCheckup.neckMeasurement;
    }

    return Response.json({
      analysis: analysisText,
      bmi: Math.round(bmi * 10) / 10,
      bmr: Math.round(bmr),
      tdee,
      // ─── Macro recommendations ───
      macros,
      // ─── Weight goal trajectory (null if no target weight) ───
      trajectory,
      // ─── Plan recommendation based on goal + experience + medical concerns ───
      planRecommendation,
      // ─── NEW: Body composition (US Navy formula) ───
      bodyComposition: bodyComposition
        ? {
            bodyFatPercent: bodyComposition.bodyFatPercent,
            leanBodyMass: bodyComposition.leanBodyMass,
            fatMass: bodyComposition.fatMass,
            bodyFatCategory: bodyComposition.bodyFatCategory,
            bodyFatColor: bodyComposition.bodyFatColor,
            muscleMassPercent: muscleMass?.muscleMassPercent ?? null,
            muscleMass: muscleMass?.muscleMass ?? null,
          }
        : null,
      // ─── Raw profile data for display in profile overlay ───
      // تمام فیلدهای آنبوردینگ (شامل فیلدهای اختیاری حرفه‌ای) برای نمایش
      // و ویرایش در پروفایل کاربر برمی‌گردند.
      profile: {
        // Identity
        gender: data.gender,
        genderLabel: GENDER_LABELS[data.gender],
        age: data.age,
        height: data.height,
        weight: data.weight,
        targetWeight: data.targetWeight ?? null,
        goal: data.goal,
        goalLabel: GOAL_LABELS[data.goal],
        activityLevel: data.activityLevel,
        activityLabel: ACTIVITY_LABELS[data.activityLevel],
        workoutDays: data.workoutDays,
        workoutDaysList,
        workoutPlace: data.workoutPlace,
        workoutPlaceLabel: WORKOUT_PLACE_LABELS[data.workoutPlace],
        workoutTime: profile.workoutTime ?? null,
        workoutTimeLabel: profile.workoutTime
          ? (WORKOUT_TIME_LABELS as any)[profile.workoutTime] ?? profile.workoutTime
          : null,
        // Equipment
        equipment: data.equipment,
        // Diet
        dietType: data.dietType,
        dietLabel: DIET_LABELS[data.dietType],
        preferredCuisine: profile.preferredCuisine ?? null,
        preferredCuisineLabel: profile.preferredCuisine
          ? (PREFERRED_CUISINE_LABELS as any)[profile.preferredCuisine] ?? profile.preferredCuisine
          : null,
        dislikedFoods: profile.dislikedFoods ?? null,
        allergies: data.allergies,
        // Health
        injuries: data.injuries,
        diseases: data.diseases,
        drugAllergies: data.drugAllergies ?? null,
        currentMedications: data.currentMedications ?? null,
        medicalConditions: safeParseList(profile.medicalConditions),
        medicalConditionsLabel: (() => {
          const list = safeParseList(profile.medicalConditions);
          if (list.length === 0) return null;
          return list.map((c) => (MEDICAL_CONDITION_LABELS as any)[c] || c).join("، ");
        })(),
        // Recovery
        sleepHours: profile.sleepHours ?? null,
        stressLevel: profile.stressLevel ?? null,
        waterHabit: profile.waterHabit ?? null,
        waterGoalMl: profile.waterHabit != null ? profile.waterHabit * 250 : null,
        bodyFrame: profile.bodyFrame ?? null,
        bodyFrameLabel: profile.bodyFrame
          ? (BODY_FRAME_LABELS as any)[profile.bodyFrame] ?? profile.bodyFrame
          : null,
        // Training experience
        trainingExperience: data.trainingExperience ?? null,
        trainingExperienceLabel: data.trainingExperience
          ? TRAINING_EXPERIENCE_LABELS[data.trainingExperience]
          : null,
        previousTrainingType: data.previousTrainingType ?? null,
        maxLifts: data.maxLifts ?? null,
        // Target date
        targetDate: profile.targetDate ?? null,
        // Supplements
        currentSupplements: profile.currentSupplements ?? null,
        // Body composition measurements
        neckMeasurement: profile.neckMeasurement ?? null,
        shoulderMeasurement: profile.shoulderMeasurement ?? null,
        calfMeasurement: profile.calfMeasurement ?? null,
      },
      // اندازه‌های اولیه بدن از چکاپ baseline (phase 0)
      baseline: baselineCheckup
        ? {
            weight: baselineCheckup.weight,
            chestMeasurement: baselineCheckup.chestMeasurement,
            armMeasurement: baselineCheckup.armMeasurement,
            waistMeasurement: baselineCheckup.waistMeasurement,
            hipMeasurement: baselineCheckup.hipMeasurement,
            thighMeasurement: baselineCheckup.thighMeasurement,
            createdAt: baselineCheckup.createdAt,
          }
        : null,
      // ─── Body measurements (filtered, only non-null) ───
      measurements,
      // ─── Whether the AI text was loaded from cache (for UI refresh button) ───
      fromCache: !forceRefresh && !!profile.aiAnalysis,
    });
  } catch (e) {
    return apiError(e);
  }
}
