// Shared types for Fitap Fitness App

export type Gender = "male" | "female";
export type Goal =
  | "fat_loss"
  | "muscle_gain"
  | "endurance"
  | "fitness"
  | "strength";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type WorkoutPlace = "gym" | "home" | "both";
export type DietType = "standard" | "vegetarian" | "vegan" | "keto";

export type TrainingExperience = "beginner" | "intermediate" | "advanced" | "pro";

// --- NEW: Comprehensive professional onboarding enums (ONBOARDING-PLAN-UPGRADE) ---
/** اندازه استخوان بدن — روی محاسبه وزن ایده‌آل اثر می‌گذارد */
export type BodyFrame = "small" | "medium" | "large";
/** ساعت ترجیحی تمرین — برای بهینه‌سازی سیرکادین */
export type WorkoutTime = "morning" | "afternoon" | "evening" | "night";
/** سبک آشپزی ترجیحی */
export type PreferredCuisine = "persian" | "mediterranean" | "asian" | "mixed";
/** شرایط پزشکی خاص — چک‌باکس‌ها در آنبوردینگ */
export type MedicalConditionKey =
  | "diabetes"
  | "hypertension"
  | "thyroid"
  | "heart"
  | "back_pain"
  | "knee_pain"
  | "shoulder_issues";

export const BODY_FRAME_LABELS: Record<BodyFrame, string> = {
  small: "ریز‌استخوان (نازک)",
  medium: "متوسط",
  large: "درشت‌استخوان (پر)",
};

export const WORKOUT_TIME_LABELS: Record<WorkoutTime, string> = {
  morning: "صبح (۶ تا ۱۰)",
  afternoon: "ظهر/بعدازظهر (۱۰ تا ۱۶)",
  evening: "غروب (۱۶ تا ۲۰)",
  night: "شب (۲۰ تا ۲۴)",
};

export const PREFERRED_CUISINE_LABELS: Record<PreferredCuisine, string> = {
  persian: "ایرانی",
  mediterranean: "مدیترانه‌ای",
  asian: "آسیایی",
  mixed: "ترکیبی (مخلوط)",
};

export const MEDICAL_CONDITION_LABELS: Record<MedicalConditionKey, string> = {
  diabetes: "دیابت / قند خون",
  hypertension: "فشار خون بالا",
  thyroid: "تیروئید (کم‌کاری/پرکاری)",
  heart: "بیماری قلبی-عروقی",
  back_pain: "کمردرد / دیسک کمر",
  knee_pain: "درد زانو / آسیب مینیسک",
  shoulder_issues: "مشکلات شانه / روتاتور کاف",
};

export interface OnboardingData {
  // Identity (collected at the start of onboarding)
  firstName?: string;
  lastName?: string;

  gender: Gender;
  age: number;
  height: number; // cm
  weight: number; // kg
  targetWeight?: number;
  goal: Goal;
  activityLevel: ActivityLevel;
  workoutDays: number;
  workoutDaysList?: string[]; // روزهای انتخاب‌شده هفته (شنبه، یکشنبه، ...)
  workoutPlace: WorkoutPlace;
  equipment: string[];
  diseases: string;
  injuries: string;
  allergies: string;
  dietType: DietType;
  mealCount?: number; // تعداد وعده‌های غذایی رغبتی

  // Professional advanced fields (optional, for pro athletes)
  trainingExperience?: TrainingExperience; // سابقه ورزشی
  previousTrainingType?: string; // نوع تمرین قبلی
  drugAllergies?: string; // آلرژی‌های دارویی
  currentMedications?: string; // داروهای مصرفی
  maxLifts?: string; // حداکثر وزنه‌ها (اسکوات/پرس سینه/ددلیفت)

  // --- NEW: Comprehensive professional fields (ONBOARDING-PLAN-UPGRADE) ---
  bodyFrame?: BodyFrame;          // small | medium | large
  sleepHours?: number;            // 4-12 (hours per night)
  stressLevel?: number;           // 1-5
  waterHabit?: number;            // glasses per day (current)
  targetDate?: string;            // ISO date string (YYYY-MM-DD) — goal target date
  workoutTime?: WorkoutTime;      // morning | afternoon | evening | night
  medicalConditions?: MedicalConditionKey[]; // selected medical condition keys
  currentSupplements?: string;    // supplements being taken (free text)
  dislikedFoods?: string;         // foods user dislikes (free text, comma separated)
  preferredCuisine?: PreferredCuisine; // persian | mediterranean | asian | mixed
  waterGoalMl?: number;           // auto-calculated daily water goal (ml)

  bloodTestUploaded?: boolean;
  bodyImagesCount?: number;

  // Optional baseline body measurements (cm) — collected during onboarding
  // for a more accurate baseline checkup. All optional.
  chestMeasurement?: number;  // دور قفسه سینه
  armMeasurement?: number;    // دور بازو
  waistMeasurement?: number;  // دور کمر
  hipMeasurement?: number;    // دور باسن
  thighMeasurement?: number;  // دور ران
  // NEW (BODY-COMPOSITION-PRO): برای محاسبه دقیق درصد چربی بدن (US Navy formula)
  neckMeasurement?: number;     // cm — دور گردن (الزامی برای فرمول US Navy)
  shoulderMeasurement?: number; // cm — دور شانه
  calfMeasurement?: number;     // cm — دور ساق پا
}

// Workout plan structure (stored as JSON)
export interface ExerciseSet {
  setNumber: number;
  reps: string; // "10-12" or "30s"
  restSec: number;
  weight?: number; // kg logged by user
  done?: boolean;
  /** RPE (Rate of Perceived Exertion) برای این ست — ۱ تا ۱۰. در صورت عدم وجود، RPE حرکت اعمال می‌شود. */
  rpe?: number;
}

/** پروتکل گرم‌کردن یا سردکردن برای یک روز تمرینی */
export interface WarmupCooldownItem {
  name: string;        // مثلاً "دویدن سبک روی تردمیل"
  durationSec: number; // مدت زمان به ثانیه (مثلاً ۳۰۰ = ۵ دقیقه)
  notes?: string;      // توضیح اضافه (شدت، نکته فنی)
}

export interface PlanExercise {
  id: string;
  name: string;
  muscle: string;
  category: string;
  description: string;
  tips: string;
  mediaUrl: string;
  difficulty: string;
  sets: ExerciseSet[];
  /** سوپرست/تری‌ست/جاینت‌ست — اگر این حرکت با حرکت دیگری در یک گروه است، نام گروه را اینجا بگذار.
   *  مثال: "A" یعنی عضو گروه A. گروه‌های هم‌نام با هم سوپرست/تری‌ست/جاینت‌ست می‌شوند. */
  supersetGroup?: string;
  /** نوع گروه:
   *  - "superset" (۲ حرکت)
   *  - "triset" (۳ حرکت)
   *  - "giant"    (۴ حرکت یا بیشتر — جاینت‌ست / سیرکویت)
   */
  supersetType?: "superset" | "triset" | "giant";
  /** برای جاینت‌ست: تعداد دفعات تکرار کل سیرکویت (پیش‌فرض ۱). بین ۱ تا ۵. */
  circuitRounds?: number;
  /** برای جاینت‌ست: استراحت بین دورها (ثانیه). معمولاً ۱۲۰ تا ۱۸۰ ثانیه. */
  restBetweenRounds?: number;
  /** RPE (Rate of Perceived Exertion) برای این حرکت — ۱ تا ۱۰. */
  rpe?: number;
  /** تمپو حرکت به فرمت ۴-رقمی مثلاً "3-1-2-0" (اکسنتریک-مکث-کنسنتریک-مکث). */
  tempo?: string;
  /** حرکت جایگزین برای زمانی که تجهیزات کافی نباشد یا محدودیت خطری وجود داشته باشد. */
  substitution?: string;
  /** توصیه کوتاه مربی (۱ جمله) — نکته فنی/انگیزشی زیر هر حرکت. */
  coachTip?: string;
}

export interface WorkoutDay {
  day: string; // "شنبه", "یکشنبه", ...
  title: string; // "روز سینه و سه‌سر"
  focus: string;
  exercises: PlanExercise[];
  estimatedMinutes: number;
  isToday?: boolean;
  /** پروتکل گرم‌کردن قبل از شروع تمرین اصلی. */
  warmup?: WarmupCooldownItem[];
  /** پروتکل سردکردن بعد از اتمام تمرین. */
  cooldown?: WarmupCooldownItem[];
}

/** پیشرفت هفتگی — توصیه برای افزایش وزنه/تکرار هر هفته (progressive overload) */
export interface WeeklyProgression {
  /** متن توضیحی کلی استراتژی پیشرفت */
  strategy: string;
  /** برنامه هفته به هفته — هر آبجکت توصیف یک هفته است */
  weeks: { week: number; weightChangeKg?: number; repChange?: number; note: string }[];
}

export interface WorkoutPlanContent {
  days: WorkoutDay[];
  weeklyGoal: string;
  /** هدف برنامه (مثل عضله‌سازی/چربی‌سوزی) — AI گاهی تولید می‌کند */
  goal?: string;
  notes: string;
  supplements?: { name: string; dose: string; timing: string; note?: string }[];
  /** استراتژی پیشرفت هفتگی (progressive overload) */
  weeklyProgression?: WeeklyProgression;
  /** نکات ایمنی مبتنی بر آسیب‌دیدگی‌ها و شرایط پزشکی */
  safetyNotes?: string[];
  /** توصیه‌های ریکاوری مبتنی بر خواب و استرس */
  recoveryNotes?: string[];
  /** توصیه‌های تایمینگ تغذیه (قبل/بعد تمرین) */
  nutritionTimingNotes?: string[];
  /** توصیه‌های تایمینگ مکمل — در صورت وجود مکمل فعلی مصرفی */
  supplementTimingNotes?: string[];
  /** پرچم‌های هشدار پزشکی — در صورت وجود شرایط پزشکی حساس */
  medicalWarningFlags?: string[];
}

// Meal plan structure (stored as JSON)
export interface MealItem {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  imageUrl: string;
  done?: boolean;
  /** شاخص گلیسمی (GI) تخمینی: low | medium | high (در صورت موجود بودن) */
  glycemicIndex?: "low" | "medium" | "high";
  /** ویژگی‌های ضددرد/ضدالتهابی (anti-inflammatory) — در صورت وجود */
  antiInflammatory?: boolean;
  /** ویتامین‌ها/مواد معدنی برجسته این غذا (اختیاری) */
  micronutrients?: string[];
  /** نکته آماده‌سازی (مثلاً "بخارپز کن، نه سرخ‌کرده") */
  prepTip?: string;
}

export interface Meal {
  type: string; // صبحانه | ناهار | شام | میان‌وعده
  label: string;
  items: MealItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  /** ترکیب غذاها — مثلاً "تخم‌مرغ + نان سنگک + پنیر" — به کاربر می‌گوید چه چیزهایی را با هم بخورد */
  combination?: string;
  /** غذاهای جایگزین — ۲-۳ گزینه جایگزین برای این وعده تا کاربر تنوع داشته باشد.
   *  هر گزینه یک آبجکت با items (لیست غذاها) و combination (توضیح ترکیب) است. */
  alternatives?: {
    combination: string;
    items: MealItem[];
    totalCalories: number;
  }[];
  /** تایمینگ توصیه‌شده برای این وعده (نسبت به تمرین یا ساعت روز) */
  timingNote?: string;
  /** برجسته‌سازی ویتامین/ماده معدنی کل این وعده */
  micronutrientHighlights?: string[];
}

/** یک نقطه از برنامه هیدراتاسیون روزانه */
export interface HydrationScheduleItem {
  time: string;     // مثلاً "بیدار شد"
  amountMl: number; // میلی‌لیتر
  note?: string;    // نکته (مثلاً "با لیمو")
}

/** توصیه تغذیه قبل/بعد از تمرین */
export interface PrePostWorkoutNutrition {
  preWorkout: string;  // مثلاً "۳۰ دقیقه قبل: موز + قهوه"
  postWorkout: string; // مثلاً "۳۰ دقیقه بعد: پروتئین وی + موز"
  note?: string;
}

export interface MealPlanContent {
  meals: Meal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  waterLiters: number;
  notes: string;
  /** برنامه مکمل‌ها (Standard+) — در صورت وجود، از همینجا نمایش داده می‌شود */
  supplements?: { name: string; dose: string; timing: string; note?: string }[];
  /** برنامه هیدراتاسیون تفکیک‌شده در طول روز */
  hydrationSchedule?: HydrationScheduleItem[];
  /** غذاهای ضدالتهابی پیشنهادی (در صورت آسیب‌دیدگی یا شرایط پزشکی) */
  antiInflammatoryFoods?: string[];
  /** توصیه تغذیه قبل/بعد از تمرین */
  prePostWorkoutNutrition?: PrePostWorkoutNutrition;
  /** نکات آماده‌سازی غذا برای روز هفته */
  foodPrepTips?: string[];
  /** برجسته‌سازی ویتامین‌ها/مواد معدنی کل برنامه روزانه */
  micronutrientHighlights?: string[];
}

// Chat
export interface ChatMessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  mediaUrl?: string | null; // URL فایل مدیا (عکس/ویدیو) ارسال‌شده در پیام کاربر
  mediaType?: "image" | "video" | null; // نوع مدیا
  createdAt: string;
}

// Notifications
export type NotificationType =
  | "welcome"
  | "workout_reminder"
  | "water_reminder"
  | "subscription"
  | "achievement"
  | "system"
  | "upgrade"
  | "renewal"
  | "re_engagement"
  | "checkup"
  | "coach";

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  meta?: any;
  read: boolean;
  createdAt: string;
}

// ============================================================
//  SUBSCRIPTION PLANS — 4 tiers (Basic / Standard / Advanced / Ultimate)
//  هر بدنی فیتاپ میخواد — ۴ سطح دسترسی متناسب با هر هدف و بودجه
// ============================================================
export type Plan = "basic" | "standard" | "advanced" | "ultimate";

export type PlanTier = Plan;

export type BillingPeriod = "monthly" | "yearly";

/** قابلیت‌هایی که بر اساس پلن فعال/غیرفعال می‌شوند (Feature Gating) */
export interface PlanCapabilities {
  workoutAndNutritionPlan: boolean;
  supplementsPlan: boolean;
  periodicCheckups: boolean;
  aiChatQuestions: number; // 0 = قفل، -1 = بی‌نهایت
  chatImageUpload: boolean;
  chatVideoUpload: boolean;
  mealPhotoAnalysis: boolean;
  bodyPhotoAnalysis: boolean;
  /** تحلیل هوشمند پیشرفت بدن از عکس‌های گالری پیشرفت (standard+، ۳ بار در طول اشتراک) */
  progressAnalysis: boolean;
  gymMode: boolean;
  nutritionCompanion: boolean;
  fullExerciseLibrary: boolean;
  videoBodyAnalysis: boolean;
  videoAnalysisLimit: number;
  techniqueCorrection: boolean;
  bloodTestAnalysis: boolean;
  bloodTestLimit: number;
  humanCoachOversight: boolean;
}

export interface SubscriptionPlan {
  id: Plan;
  tier: number;
  label: string;
  tagline: string;
  price: number;
  durationDays: number;
  phases: number;
  features: string[];
  capabilities: PlanCapabilities;
  badge?: string;
  popular?: boolean;
  accentColor: string;
  icon: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "basic",
    tier: 1,
    label: "اقتصادی",
    tagline: "شروع مسیر تناسب اندام",
    price: 350000,
    durationDays: 45,
    phases: 1,
    icon: "🌱",
    accentColor: "from-slate-500 to-gray-600",
    features: [
      "آنالیز کامل پروفایل ورزشی",
      "برنامه تمرینی اختصاصی (۴۵ روزه / ۱ فاز)",
      "برنامه تغذیه اختصاصی",
      "پیگیری پیشرفت وزن",
      "دسترسی به برنامه‌های قبلی خریداری‌شده",
    ],
    capabilities: {
      workoutAndNutritionPlan: true,
      supplementsPlan: false,
      periodicCheckups: false,
      aiChatQuestions: 0,
      chatImageUpload: false,
      chatVideoUpload: false,
      mealPhotoAnalysis: false,
      bodyPhotoAnalysis: false,
      progressAnalysis: false,
      gymMode: false,
      nutritionCompanion: false,
      fullExerciseLibrary: false,
      videoBodyAnalysis: false,
      videoAnalysisLimit: 0,
      techniqueCorrection: false,
      bloodTestAnalysis: false,
      bloodTestLimit: 0,
      humanCoachOversight: false,
    },
  },
  {
    id: "standard",
    tier: 2,
    label: "استاندارد",
    tagline: "برنامه کامل‌تر با مکمل و چکاپ",
    price: 800000,
    durationDays: 45,
    phases: 1,
    icon: "⚡",
    accentColor: "from-cyan-500 to-teal-600",
    features: [
      "تمام امکانات پلن اقتصادی",
      "برنامه مکمل‌های ورزشی اختصاصی",
      "۳ چکاپ دوره‌ای برای رصد پیشرفت",
      "داشبورد پیشرفته با تاریخچه و سوابق ورزشی",
      "برنامه تمرین و تغذیه اختصاصی (۴۵ روزه / ۱ فاز)",
      "حفظ تاریخچه کامل در ذهن فیتاپ برای ساخت برنامه‌های بعدی",
    ],
    capabilities: {
      workoutAndNutritionPlan: true,
      supplementsPlan: true,
      periodicCheckups: true,
      aiChatQuestions: 0,
      chatImageUpload: false,
      chatVideoUpload: false,
      mealPhotoAnalysis: false,
      bodyPhotoAnalysis: false,
      progressAnalysis: true,
      gymMode: false,
      nutritionCompanion: false,
      fullExerciseLibrary: false,
      videoBodyAnalysis: false,
      videoAnalysisLimit: 0,
      techniqueCorrection: false,
      bloodTestAnalysis: false,
      bloodTestLimit: 0,
      humanCoachOversight: false,
    },
  },
  {
    id: "advanced",
    tier: 3,
    label: "پیشرفته",
    tagline: "چت هوشمند + حالت باشگاه + آنالیز عکس",
    price: 1200000,
    durationDays: 45,
    phases: 1,
    icon: "🔥",
    accentColor: "from-amber-500 to-orange-600",
    badge: "پیشنهاد ویژه",
    popular: true,
    features: [
      "تمام امکانات پلن استاندارد",
      "پشتیبانی ۲۴ ساعته با چت فیتاپ هوشمند (متن + عکس)",
      "آنالیز هوشمند وعده‌های غذایی با ارسال عکس",
      "آنالیز هوشمند بدن با ارسال عکس",
      "دسترسی به حالت باشگاه (Gym Mode)",
      "کامپنیون تغذیه (دستیار تغذیه)",
      "دسترسی کامل به کتابخانه متحرک حرکات",
      "سوالات چت هوشمند = بی‌نهایت",
    ],
    capabilities: {
      workoutAndNutritionPlan: true,
      supplementsPlan: true,
      periodicCheckups: true,
      aiChatQuestions: -1,
      chatImageUpload: true,
      chatVideoUpload: false,
      mealPhotoAnalysis: true,
      bodyPhotoAnalysis: true,
      progressAnalysis: true,
      gymMode: true,
      nutritionCompanion: true,
      fullExerciseLibrary: true,
      videoBodyAnalysis: false,
      videoAnalysisLimit: 0,
      techniqueCorrection: false,
      bloodTestAnalysis: false,
      bloodTestLimit: 0,
      humanCoachOversight: false,
    },
  },
  {
    id: "ultimate",
    tier: 4,
    label: "حرفه‌ای",
    tagline: "آنالیز ویدیویی + آزمایش خون — کامل‌ترین",
    price: 1800000,
    durationDays: 45,
    phases: 1,
    icon: "👑",
    accentColor: "from-violet-500 to-purple-600",
    badge: "کامل‌ترین",
    features: [
      "تمام امکانات پلن پیشرفته",
      "پشتیبانی ۲۴ ساعته با هوش مصنوعی (متن + عکس + ویدیو)",
      "آنالیز ویدیویی بدن قبل از طراحی برنامه",
      "اصلاح تکنیک حرکات با ارسال ویدیو (۱۰ بار مجاز)",
      "آنالیز تخصصی آزمایش خون و تطبیق با برنامه (۱ بار مجاز)",
      "سوالات چت هوشمند = بی‌نهایت",
    ],
    capabilities: {
      workoutAndNutritionPlan: true,
      supplementsPlan: true,
      periodicCheckups: true,
      aiChatQuestions: -1,
      chatImageUpload: true,
      chatVideoUpload: true,
      mealPhotoAnalysis: true,
      bodyPhotoAnalysis: true,
      progressAnalysis: true,
      gymMode: true,
      nutritionCompanion: true,
      fullExerciseLibrary: true,
      videoBodyAnalysis: true,
      videoAnalysisLimit: 10,
      techniqueCorrection: true,
      bloodTestAnalysis: true,
      bloodTestLimit: 1,
      humanCoachOversight: true,
    },
  },
];

/** Helper: گرفتن آبجکت پلن با ID */
export function getPlan(id: Plan): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

/** Helper: گرفتن قابلیت‌های یک پلن */
export function getCapabilities(planId: Plan | null | undefined): PlanCapabilities {
  if (!planId) return SUBSCRIPTION_PLANS[0].capabilities;
  return getPlan(planId)?.capabilities ?? SUBSCRIPTION_PLANS[0].capabilities;
}

/**
 * Helper: آیا پلن فعلی به قابلیت خاصی دسترسی دارد؟
 *
 * این تابع روی PlanCapabilities (مثل aiChatQuestions، chatImageUpload) کار می‌کند
 * و برای کنترل fine-grained استفاده می‌شود.
 *
 * نکته: یک سیستم feature flag جدید و extensible‌تر در src/lib/features قرار دارد
 * که روی Feature‌ها (مثل workout_plan، blood_test_analysis) کار می‌کند.
 * آن سیستم برای coarse-grained gating و مارکت‌پلیس استفاده می‌شود.
 * هر دو سیستم همزیستی می‌کنند — این تابع برای حفظ سازگاری با کد موجود دست‌نخورده باقی مانده است.
 *
 * @see src/lib/features برای سیستم feature flag جدید
 */
export function canAccess(
  planId: Plan | null | undefined,
  capability: keyof PlanCapabilities
): boolean {
  const caps = getCapabilities(planId);
  const val = caps[capability];
  if (typeof val === "number") return val !== 0;
  return Boolean(val);
}

/** رتبه‌بندی پلن برای مقایسه (کمک‌کننده برای gating) */
export function planTierRank(planId: Plan | null | undefined): number {
  if (!planId) return 0;
  return getPlan(planId)?.tier ?? 0;
}

/** برچسب فارسی پلن */
export const PLAN_LABELS: Record<Plan, string> = {
  basic: "اقتصادی",
  standard: "استاندارد",
  advanced: "پیشرفته",
  ultimate: "حرفه‌ای",
};

/** حداقل پلن لازم برای هر قابلیت قفل‌شده */
export const FEATURE_MIN_PLAN: Record<string, { plan: Plan; label: string }> = {
  aiChat: { plan: "advanced", label: "چت هوشمند فیتاپ" },
  chatVideo: { plan: "ultimate", label: "ارسال ویدیو در چت" },
  gymMode: { plan: "advanced", label: "حالت باشگاه" },
  nutritionCompanion: { plan: "advanced", label: "دستیار تغذیه" },
  videoAnalysis: { plan: "ultimate", label: "آنالیز ویدیویی بدن" },
  bloodTest: { plan: "ultimate", label: "آنالیز آزمایش خون" },
  techniqueCorrection: { plan: "ultimate", label: "اصلاح تکنیک حرکات" },
  supplements: { plan: "standard", label: "برنامه مکمل‌ها" },
  humanCoach: { plan: "ultimate", label: "نظارت مربی فدراسیون" },
};

/** فرمت مبلغ به تومان با جداکننده سه‌رقمی */
export function formatToman(amount: number): string {
  return amount.toLocaleString("en-US");
}

// Persian digit helper
export const toPersianDigits = (input: string | number): string => {
  const persian = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/[0-9]/g, (d) => persian[Number(d)]);
};

/**
 * نرمال‌سازی ترتیب «عدد + واحد» در رشته‌های فارسی.
 * داده‌های قدیمی (دوز مکمل‌ها، servingSize و…) گاهی با ترتیب معکوس
 * «واحد عدد» ذخیره شده‌اند (مثل «گرم ۳۰» به‌جای «۳۰ گرم») که در نمایش
 * RTL به‌صورت جابجا دیده می‌شود. این تابع الگوهای معکوس شناخته‌شده را
 * به ترتیب درست «عدد واحد» تبدیل می‌کند.
 *
 * مثال: «گرم 30» → «30 گرم» — «کالری 60» → «60 کالری» — «دقیقه ۱۲» → «۱۲ دقیقه»
 */
const UNIT_ORDER_WORDS =
  "(حرکت|دقیقه|ثانیه|گرم|کالری|کیلوکالری|کیلوگرم|کیلو|لیتر|میلی‌لیتر|میلی لیتر|قرص|کپسول|اسکوپ|وعده|دور|سری|ماه|روز|هفته|سال|میلی‌گرم|میلی گرم)";
export function fixUnitOrder(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(
      new RegExp(`${UNIT_ORDER_WORDS}\\s+([۰-۹0-9][۰-۹0-9]*[.,\\-–]?[۰-۹0-9]*)`, "g"),
      "$2 $1"
    )
    .trim();
}

/**
 * حذف واحد تکراری از نام غذا.
 * داده‌های AI گاهی نام غذا را با واحد در پرانتز برمی‌گردانند — مثل
 * «تخم‌مرغ آب‌پز (۳ عدد)» — و در کنار آن فیلد servingSize هم «۳ عدد» است؛
 * نمایش هر دو = واحد دوبار (باگ گزارش‌شده کاربر).
 * این تابع پرانتز انتهاییِ نام را فقط وقتی حذف می‌کند که محتوایش با
 * servingSize (نرمال‌شده) یکی باشد؛ در غیر این صورت (واحد متفاوت) دست
 * نمی‌زند تا اطلاعاتی از دست نرود.
 *
 * مثال: ("تخم‌مرغ آب‌پز (۳ عدد)", "۳ عدد") → "تخم‌مرغ آب‌پز"
 *       ("نان سنگک (۱.۵ کف دست)", "۱.۵ کف دست") → "نان سنگک"
 *       ("موز", "۱ عدد") → "موز"
 */
export function stripUnitFromFoodName(
  name: string | null | undefined,
  servingSize?: string | null
): string {
  if (!name) return "";
  const trimmed = name.trim();
  const m = trimmed.match(/^(.*\S)\s*\(([^()]*)\)\s*$/);
  if (!m) return trimmed;
  // نرمال‌سازی برای مقایسه: ارقام فارسی→انگلیسی، حذف فاصله‌های اضافی
  const norm = (s: string) =>
    s
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/\u200c/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const inner = m[2].trim();
  if (servingSize && norm(inner) === norm(servingSize)) {
    const rest = m[1].trim();
    // اگر بعد از حذف، چیزی نمیماند (کل نام پرانتز بود) نام اصلی را نگه دار
    return rest || trimmed;
  }
  return trimmed;
}

// Persian labels
export const GOAL_LABELS: Record<Goal, string> = {
  fat_loss: "کاهش چربی",
  muscle_gain: "عضله‌سازی",
  endurance: "افزایش استقامت",
  fitness: "تناسب اندام عمومی",
  strength: "افزایش قدرت",
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "بی‌تحرک",
  light: "کم‌تحرک",
  moderate: "متوسط",
  active: "فعال",
  very_active: "خیلی فعال",
};

export const WORKOUT_PLACE_LABELS: Record<WorkoutPlace, string> = {
  gym: "باشگاه",
  home: "خانه",
  both: "هردو (باشگاه و خانه)",
};

export const DIET_LABELS: Record<DietType, string> = {
  standard: "عادی",
  vegetarian: "گیاه‌خواری",
  vegan: "وگن",
  keto: "کتوژنیک",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "آقا",
  female: "خانم",
};

// Persian week days
export const PERSIAN_WEEKDAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

/**
 * مرتب‌سازی روزهای هفته بر اساس ترتیب استاندارد فارسی (شنبه → جمعه).
 * AI گاهی روزها را نامرتب برمی‌گرداند (مثلاً شنبه، دوشنبه، چهارشنبه، یکشنبه).
 * این تابع آن‌ها را به ترتیب صحیح مرتب می‌کند.
 */
export function sortWeekdaysByPersianOrder<T extends { day: string }>(days: T[]): T[] {
  return [...days].sort((a, b) => {
    const idxA = PERSIAN_WEEKDAYS.indexOf(a.day);
    const idxB = PERSIAN_WEEKDAYS.indexOf(b.day);
    // اگر روز پیدا نشد، در انتها قرار بگیرد
    const safeA = idxA === -1 ? 99 : idxA;
    const safeB = idxB === -1 ? 99 : idxB;
    return safeA - safeB;
  });
}


// Training experience labels (Persian)
export const TRAINING_EXPERIENCE_LABELS: Record<TrainingExperience, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
  pro: "حرفه‌ای",
};
