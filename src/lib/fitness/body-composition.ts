/**
 * ابزار محاسبه ترکیب بدن — Body Composition utility
 * ===================================================
 *
 * پیاده‌سازی فرمول علمی US Navy برای درصد چربی بدن (معتبرترین روش بر پایه اندازه‌گیری با متر نرم).
 *
 * US Navy Body Fat Percentage Formula
 * ------------------------------------
 * For men:
 *   %BF = 495 / (1.0324 − 0.19077 × log10(waist − neck) + 0.15456 × log10(height)) − 450
 *
 * For women:
 *   %BF = 495 / (1.29579 − 0.35004 × log10(waist + hip − neck) + 0.22100 × log10(height)) − 450
 *
 * همه اندازه‌ها به سانتی‌متر.
 *
 * Lean Body Mass (LBM) = weight × (1 − bodyFatPercent / 100)
 * Fat Mass = weight × bodyFatPercent / 100
 *
 * مرجع: U.S. Navy Circumference Method (Hodgdon & Beckett, 1984).
 */

import type { Gender } from "./types";

export interface BodyComposition {
  bodyFatPercent: number;     // درصد چربی بدن (0-100)
  leanBodyMass: number;       // جرم بدون چربی به کیلوگرم
  fatMass: number;            // جرم چربی به کیلوگرم
  bodyFatCategory: string;    // برچسب فارسی دسته‌بندی چربی
  bodyFatColor: string;       // کد hex رنگ برای UI
}

export interface MuscleMassResult {
  muscleMassPercent: number;  // درصد تقریبی عضله (0-100)
  muscleMass: number;         // جرم تقریبی عضله به کیلوگرم
}

interface CalcParams {
  gender: Gender;
  height: number;     // cm
  weight: number;     // kg
  waist?: number | null;  // cm — الزامی
  neck?: number | null;   // cm — الزامی
  hip?: number | null;    // cm — الزامی برای خانم‌ها
}

/**
 * محاسبه ترکیب بدن بر اساس فرمول US Navy.
 * - برای آقایان: به waist + neck نیاز است.
 * - برای خانم‌ها: به waist + neck + hip نیاز است.
 *
 * اگر اندازه‌های لازم وجود نداشته باشند، null برمی‌گرداند.
 *
 * @returns BodyComposition | null
 */
export function calculateBodyComposition(params: CalcParams): BodyComposition | null {
  const { gender, height, weight, waist, neck, hip } = params;

  // اعتبارسنجی ورودی‌های پایه
  if (!height || height <= 0) return null;
  if (!weight || weight <= 0) return null;
  if (!waist || waist <= 0) return null;
  if (!neck || neck <= 0) return null;

  try {
    let bf: number;

    if (gender === "female") {
      // برای خانم‌ها hip هم الزامی است
      if (!hip || hip <= 0) return null;

      // waist + hip − neck باید مثبت باشد تا log10 تعریف‌شده باشد
      const sumWHN = waist + hip - neck;
      if (sumWHN <= 0) return null;

      const denom = 1.29579 - 0.35004 * Math.log10(sumWHN) + 0.22100 * Math.log10(height);
      if (denom <= 0) return null;
      bf = 495 / denom - 450;
    } else {
      // آقا — waist − neck باید مثبت باشد
      const diffWN = waist - neck;
      if (diffWN <= 0) return null;

      const denom = 1.0324 - 0.19077 * Math.log10(diffWN) + 0.15456 * Math.log10(height);
      if (denom <= 0) return null;
      bf = 495 / denom - 450;
    }

    if (!isFinite(bf)) return null;

    // محدودسازی به بازه منطقی (3-60 درصد)
    bf = Math.max(3, Math.min(60, Math.round(bf * 10) / 10));

    const fatMass = Math.round((weight * bf) / 100 * 10) / 10;
    const leanBodyMass = Math.round((weight - fatMass) * 10) / 10;

    const { label, color } = categorizeBodyFat(bf, gender);

    return {
      bodyFatPercent: bf,
      leanBodyMass,
      fatMass,
      bodyFatCategory: label,
      bodyFatColor: color,
    };
  } catch {
    return null;
  }
}

/**
 * دسته‌بندی درصد چربی بدن بر اساس جنسیت (ACEfitness).
 *
 * Men:
 *   <6%     ضروری (Essential)
 *   6-13%   ورزشی (Athletic)
 *   14-17%  آمادگی (Fitness)
 *   18-25%  قابل‌قبول (Acceptable)
 *   >25%    چاق (Obese)
 *
 * Women:
 *   <14%    ضروری (Essential)
 *   14-20%  ورزشی (Athletic)
 *   21-24%  آمادگی (Fitness)
 *   25-31%  قابل‌قبول (Acceptable)
 *   >31%    چاق (Obese)
 */
export function categorizeBodyFat(
  bf: number,
  gender: Gender
): { label: string; color: string } {
  if (gender === "female") {
    if (bf < 14) return { label: "چربی ضروری", color: "#06b6d4" }; // cyan
    if (bf <= 20) return { label: "ورزشی", color: "#10b981" }; // emerald
    if (bf <= 24) return { label: "آمادگی", color: "#84cc16" }; // lime
    if (bf <= 31) return { label: "قابل‌قبول", color: "#f59e0b" }; // amber
    return { label: "چاق", color: "#ef4444" }; // red
  }
  // male
  if (bf < 6) return { label: "چربی ضروری", color: "#06b6d4" };
  if (bf <= 13) return { label: "ورزشی", color: "#10b981" };
  if (bf <= 17) return { label: "آمادگی", color: "#84cc16" };
  if (bf <= 25) return { label: "قابل‌قبول", color: "#f59e0b" };
  return { label: "چاق", color: "#ef4444" };
}

/**
 * تخمین درصد جرم عضلانی بدن.
 *
 * نکته علمی: فرمول مستقلی برای درصد عضله (به‌اندازه US Navy برای چربی) وجود ندارد.
 * اما از طریق LBM (Lean Body Mass) می‌توان تقریب زد. LBM شامل عضله + استخوان + آب + اندام‌هاست.
 * میانگین وزن استخوان + اندام‌ها حدود ۲۰-۲۵٪ وزن بدن است (بسته به جنسیت و قدم).
 *
 * ما برای تقریب ساده:
 *   muscleMass ≈ LBM × 0.65 (یعنی حدود ۶۵٪ جرم بدون چربی را عضله تشکیل می‌دهد)
 *
 * این تخمین است و برای ردیابی پیشرفت (نه تشخیص پزشکی) استفاده می‌شود.
 */
export function calculateMuscleMassPercent(params: {
  weight: number;
  leanBodyMass: number;
}): MuscleMassResult {
  const { weight, leanBodyMass } = params;
  if (!weight || weight <= 0) return { muscleMassPercent: 0, muscleMass: 0 };
  const safeLbm = Math.max(0, Math.min(weight, leanBodyMass));
  const muscleMass = Math.round(safeLbm * 0.65 * 10) / 10;
  const muscleMassPercent = Math.round((muscleMass / weight) * 100 * 10) / 10;
  return { muscleMassPercent, muscleMass };
}

/**
 * محاسبه ترکیب بدن از OnboardingProfile-style object.
 * Helper برای استفاده در API route ها.
 *
 * ورودی: فیلدهایی که از روی OnboardingProfile یا Checkup می‌آیند.
 * خروجی: BodyComposition | null
 */
export function calculateBodyCompositionFromProfile(p: {
  gender: string | Gender;
  height: number;
  weight: number;
  waistMeasurement?: number | null;
  neckMeasurement?: number | null;
  hipMeasurement?: number | null;
}): BodyComposition | null {
  return calculateBodyComposition({
    gender: (p.gender as Gender) ?? "male",
    height: p.height,
    weight: p.weight,
    waist: p.waistMeasurement ?? null,
    neck: p.neckMeasurement ?? null,
    hip: p.hipMeasurement ?? null,
  });
}
