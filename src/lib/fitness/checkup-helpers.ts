import { db } from "@/lib/db";
import { type CheckupReferencePoint } from "@/lib/fitness/ai";
import { calculateBodyComposition } from "@/lib/fitness/body-composition";

// ─── هلپرهای چکاپ — از route جدا شدند (اصلاح تایپ‌چک Next 16) ───
// Next.js 16 اجازه نمی‌دهد فایل‌های route چیزهایی غیر از هندلرها/کانفیگ
// export کنند (خطای TS2344 در .next/dev/types). این دو تابع به این lib
// منتقل شدند تا هم route تمیز بماند و هم analyze-route از import معتبر
// استفاده کند.

/**
 * US Navy body fat formula with BMI-based fallback.
 *
 * Primary method: calculateBodyComposition from body-composition.ts (true US Navy
 * formula requiring waist + neck [+ hip for women]).
 *
 * Fallback (if neck measurement is missing): BMI-based Deurenberg formula:
 *   (1.20 * BMI) + (0.23 * age) - (10.8 * sex) - 5.4
 *
 * Result clamped to 5-60%.
 *
 * Returns { bodyFatPercent, leanBodyMass } or null.
 */
export function computeBodyFat(opts: {
  gender: "male" | "female";
  waist?: number | null;
  hip?: number | null;
  neck?: number | null;
  height?: number | null;
  weight?: number | null;
  age?: number | null;
}): { bodyFatPercent: number; leanBodyMass: number } | null {
  const { gender, waist, hip, neck, height, weight, age } = opts;
  if (!weight || weight <= 0) return null;

  // 1) Try US Navy formula first (most accurate)
  if (height && height > 0 && waist && waist > 0) {
    const bc = calculateBodyComposition({
      gender,
      height,
      weight,
      waist,
      neck: neck ?? null,
      hip: hip ?? null,
    });
    if (bc) {
      return {
        bodyFatPercent: bc.bodyFatPercent,
        leanBodyMass: bc.leanBodyMass,
      };
    }
  }

  // 2) Fallback to BMI-based Deurenberg formula
  if (!height || !weight || !age) return null;
  try {
    const bmi = weight / Math.pow(height / 100, 2);
    const sex = gender === "male" ? 1 : 0;
    let bf = 1.2 * bmi + 0.23 * age - 10.8 * sex - 5.4;
    if (!isFinite(bf)) return null;
    bf = Math.max(5, Math.min(60, Math.round(bf * 10) / 10));
    const leanBodyMass = Math.round((weight - (weight * bf) / 100) * 10) / 10;
    return { bodyFatPercent: bf, leanBodyMass };
  } catch {
    return null;
  }
}

/**
 * Build the AI reference point for a checkup analysis.
 *
 * Strategy:
 *  1. If the user has at least one prior checkup, use it as the reference point
 *     (source="previous_checkup"). We pass its measurements + daysAgo (number of
 *     days between the previous checkup and now).
 *  2. Otherwise (first checkup), fall back to the onboarding profile baseline
 *     (source="onboarding_baseline"): weight from profile.weight, bodyFatPercent
 *     computed via computeBodyFat using profile.gender/height/weight and any
 *     measurements stored on the profile (neckMeasurement, etc.). daysAgo = days
 *     since the profile was created.
 *
 * Returns null only if neither a prior checkup nor an onboarding profile exists.
 *
 * Exported so the re-analysis endpoint (/api/checkup/[id]/analyze) can reuse the
 * exact same logic.
 */
export async function buildCheckupReferencePoint(opts: {
  userId: string;
  excludeCheckupId?: string;
}): Promise<CheckupReferencePoint | null> {
  const { userId, excludeCheckupId } = opts;

  // 1) Look up the user's most recent PRIOR checkup (excluding the one being analyzed)
  const previousCheckup = await db.checkup.findFirst({
    where: {
      userId,
      ...(excludeCheckupId ? { id: { not: excludeCheckupId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      weight: true,
      bodyFatPercent: true,
      leanBodyMass: true,
      chestMeasurement: true,
      armMeasurement: true,
      waistMeasurement: true,
      hipMeasurement: true,
      thighMeasurement: true,
      fatigueLevel: true,
      sleepQuality: true,
      dietAdherence: true,
      workoutAdherence: true,
      createdAt: true,
    },
  });

  if (previousCheckup) {
    const daysAgo = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(previousCheckup.createdAt).getTime()) /
          (24 * 60 * 60 * 1000)
      )
    );
    return {
      source: "previous_checkup",
      daysAgo,
      weight: previousCheckup.weight,
      bodyFatPercent: previousCheckup.bodyFatPercent,
      leanBodyMass: previousCheckup.leanBodyMass,
      chestMeasurement: previousCheckup.chestMeasurement,
      armMeasurement: previousCheckup.armMeasurement,
      waistMeasurement: previousCheckup.waistMeasurement,
      hipMeasurement: previousCheckup.hipMeasurement,
      thighMeasurement: previousCheckup.thighMeasurement,
      fatigueLevel: previousCheckup.fatigueLevel,
      sleepQuality: previousCheckup.sleepQuality,
      dietAdherence: previousCheckup.dietAdherence,
      workoutAdherence: previousCheckup.workoutAdherence,
    };
  }

  // 2) Fall back to onboarding baseline (first checkup case)
  const profile = await db.onboardingProfile.findUnique({
    where: { userId },
    select: {
      gender: true,
      age: true,
      height: true,
      weight: true,
      neckMeasurement: true,
      waistMeasurement: true,
      hipMeasurement: true,
      goal: true,
      createdAt: true,
    },
  });

  if (!profile) return null;

  const daysAgo = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(profile.createdAt).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  );

  // Compute baseline body fat % from onboarding profile data
  const baselineBodyFat = computeBodyFat({
    gender: (profile.gender as "male" | "female") ?? "male",
    waist: profile.waistMeasurement ?? null,
    hip: profile.hipMeasurement ?? null,
    neck: profile.neckMeasurement ?? null,
    height: profile.height ?? null,
    weight: profile.weight ?? null,
    age: profile.age ?? null,
  });

  return {
    source: "onboarding_baseline",
    daysAgo,
    weight: profile.weight,
    bodyFatPercent: baselineBodyFat?.bodyFatPercent ?? null,
    leanBodyMass: baselineBodyFat?.leanBodyMass ?? null,
    // Onboarding profile doesn't store chest/arm/thigh measurements — leave null
    chestMeasurement: null,
    armMeasurement: null,
    waistMeasurement: profile.waistMeasurement ?? null,
    hipMeasurement: profile.hipMeasurement ?? null,
    thighMeasurement: null,
    fatigueLevel: null,
    sleepQuality: null,
    dietAdherence: null,
    workoutAdherence: null,
  };
}

