/**
 * ایجنت تحلیل آنبوردینگ — پیچیدن (wrap) منطق تحلیل پروفایل ورزشکار
 * که در حال حاضر در src/app/api/onboarding/analysis/route.ts قرار دارد.
 *
 * این ایجنت:
 *   1. پروفایل آنبوردینگ کاربر را از دیتابیس بارگذاری می‌کند
 *   2. BMI، BMR و TDEE را محاسبه می‌کند
 *   3. یک تحلیل کوتاه فارسی توسط هوش مصنوعی تولید می‌کند
 *
 * ورودی: ندارد (از ctx.userId استفاده می‌کند)
 * خروجی: { analysis: string; bmi: number; bmr: number; tdee: number }
 *
 * نکته: API route فعلی می‌تواند بعداً به این ایجنت منتقل شود. در حال حاضر
 * هر دو وجود دارند تا هیچ breaking change‌ای رخ ندهد.
 */

import { db } from "@/lib/db";
import { avalaiClient, TEXT_MODEL, withSystemDirectives } from "@/lib/fitness/ai";
import {
  GOAL_LABELS,
  ACTIVITY_LABELS,
  GENDER_LABELS,
  WORKOUT_PLACE_LABELS,
  type OnboardingData,
} from "@/lib/fitness/types";
import type { AIAgent, AgentContext, AgentResult } from "../types";
import { registerAgent } from "../registry";

/** خروجی ایجنت تحلیل آنبوردینگ */
export interface OnboardingAnalysisResult {
  /** متن تحلیل فارسی تولیدشده توسط هوش مصنوعی */
  analysis: string;
  /** شاخص توده بدنی (یک اعشار) */
  bmi: number;
  /** نرخ متابولیسم پایه (کالری) */
  bmr: number;
  /** کل انرژی مصرفی روزانه (کالری) */
  tdee: number;
}

/** ورودی ایجنت — ندارد (از ctx استفاده می‌کند) */
export type OnboardingAnalyzerInput = void;

/** تبدیل رشته ذخیره‌شده (JSON یا CSV) به آرایه — برای فیلدهایی مثل equipment */
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

/**
 * محاسبه BMI، BMR و TDEE از روی داده‌های آنبوردینگ.
 * این تابع pure است و هیچ side-effect‌ای ندارد.
 */
export function calculateBodyMetrics(
  data: Pick<OnboardingData, "gender" | "age" | "height" | "weight" | "activityLevel">
): { bmi: number; bmr: number; tdee: number } {
  const heightM = data.height / 100;
  const bmi = data.weight / (heightM * heightM);

  // فرمول Mifflin-St Jeor
  const bmr =
    data.gender === "male"
      ? 10 * data.weight + 6.25 * data.height - 5 * data.age + 5
      : 10 * data.weight + 6.25 * data.height - 5 * data.age - 161;

  const activityFactors: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = Math.round(bmr * (activityFactors[data.activityLevel] || 1.55));

  return { bmi, bmr, tdee };
}

/**
 * منطق اصلی تحلیل آنبوردینگ.
 * این تابع قابل استفاده مجدد است — هم در API route و هم در ایجنت.
 *
 * @param userId شناسه کاربر
 * @param log لاگر اختیاری برای ثبت رویدادها
 * @returns نتیجه تحلیل شامل متن AI و مقادیر BMI/BMR/TDEE
 */
export async function analyzeOnboarding(
  userId: string,
  log?: (level: "info" | "warn" | "error" | "success", msg: string) => void
): Promise<AgentResult<OnboardingAnalysisResult>> {
  const startedAt = Date.now();

  try {
    // ۱. بارگذاری کاربر و پروفایل
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!user) {
      return {
        ok: false,
        error: "کاربر یافت نشد.",
        durationMs: Date.now() - startedAt,
      };
    }

    const profile = await db.onboardingProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      return {
        ok: false,
        error: "اطلاعات آنبوردینگ یافت نشد.",
        durationMs: Date.now() - startedAt,
      };
    }

    // ۲. ساخت OnboardingData از پروفایل ذخیره‌شده
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
    };

    // ۳. محاسبه BMI، BMR، TDEE
    const { bmi, bmr, tdee } = calculateBodyMetrics(data);
    log?.("info", `محاسبه شاخص‌ها: BMI=${bmi.toFixed(1)}, BMR=${Math.round(bmr)}, TDEE=${tdee}`);

    // ۴. ساخت پرامپت و تولید تحلیل با هوش مصنوعی
    const userName = user.name || "ورزشکار";
    const workoutDaysList = data.workoutDaysList ?? [];

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

تحلیل را با نام کاربر شروع کن. به نکات مهم مثل BMI، فاصله تا وزن هدف، و توصیه‌های کلی اشاره کن. در پایان بگو که برای دریافت برنامه اختصاصی باید پلن تهیه کند.`;

    let analysisText = "";
    try {
      const completion = await avalaiClient.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          {
            role: "system",
            content: withSystemDirectives(
              "تو فیتاپ هوشمند هستی — مربی متخصص ورزشی و تغذیه. به زبان فارسی پاسخ بده."
            ),
          },
          { role: "user", content: prompt },
        ],
      } as any);
      analysisText = completion.choices[0]?.message?.content || "";
      log?.("success", "تحلیل هوش مصنوعی با موفقیت تولید شد");
    } catch (err) {
      log?.("error", `خطا در تولید تحلیل AI — استفاده از fallback`);
      // متن fallback در صورت شکست هوش مصنوعی
      analysisText = `${userName} عزیز، بر اساس اطلاعات شما:\n\nشاخص توده بدنی (BMI) شما ${bmi.toFixed(
        1
      )} است که در دسته‌بندی ${
        bmi < 18.5 ? "کم‌وزن" : bmi < 25 ? "وزن نرمال" : bmi < 30 ? "اضافه‌وزن" : "چاق"
      } قرار می‌گیرد. کالری مورد نیاز روزانه شما حدود ${tdee} کیلوکالری است.\n\nبرای رسیدن به هدف ${GOAL_LABELS[data.goal]}، توصیه می‌شود یک برنامه تمرینی و غذایی اختصاصی تهیه کنید. فیتاپ هوشمند آماده طراحی برنامه متناسب با شرایط شماست.`;
    }

    return {
      ok: true,
      data: {
        analysis: analysisText,
        bmi: Math.round(bmi * 10) / 10,
        bmr: Math.round(bmr),
        tdee,
      },
      durationMs: Date.now() - startedAt,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "خطای ناشناخته در تحلیل آنبوردینگ";
    log?.("error", errMsg);
    return {
      ok: false,
      error: errMsg,
      durationMs: Date.now() - startedAt,
    };
  }
}

/** ایجنت تحلیل آنبوردینگ — برای مارکت‌پلیس ایجنت‌ها */
const onboardingAnalyzer: AIAgent<OnboardingAnalyzerInput, OnboardingAnalysisResult> = {
  id: "onboarding-analyzer",
  name: "تحلیل‌گر آنبوردینگ",
  description:
    "پروفایل آنبوردینگ ورزشکار را تحلیل می‌کند و شاخص‌های BMI، BMR، TDEE را محاسبه می‌کند و یک تحلیل کوتاه فارسی توسط هوش مصنوعی تولید می‌کند. رایگان برای همه کاربران.",
  icon: "ClipboardCheck",
  model: TEXT_MODEL,
  estimatedCost: 2000, // تقریباً ۱۰۰۰-۲۰۰۰ توکن برای یک تحلیل کوتاه
  requiredPlan: null, // رایگان برای همه — حتی کاربران بدون پلن

  async run(
    ctx: AgentContext,
    _input: OnboardingAnalyzerInput
  ): Promise<AgentResult<OnboardingAnalysisResult>> {
    return analyzeOnboarding(ctx.userId, ctx.log);
  },
};

// ثبت ایجنت هنگام بارگذاری ماژول (side-effect registration)
registerAgent(onboardingAnalyzer);

export default onboardingAnalyzer;
