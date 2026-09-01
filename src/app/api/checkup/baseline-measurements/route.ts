import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { calculateBodyComposition } from "@/lib/fitness/body-composition";

/**
 * POST /api/checkup/baseline-measurements
 * ذخیره اندازه‌های بدنی که کاربر بعد از خرید وارد می‌کند.
 * این اندازه‌ها در چکاپ phase 0 (baseline) ذخیره می‌شوند.
 * همچنین bodyFatPercent و leanBodyMass را با فرمول US Navy محاسبه و ذخیره می‌کند.
 *
 * این endpoint برای کاربرانی استفاده می‌شود که در فرآیند submit-body-analysis
 * (پلن Advanced/Ultimate) اندازه‌های بدنی را وارد می‌کنند اما هنوز چکاپ ایجاد نکرده‌اند.
 *
 * Body (JSON):
 *   - waistMeasurement?: number
 *   - neckMeasurement?: number
 *   - hipMeasurement?: number
 *   - chestMeasurement?: number
 *   - armMeasurement?: number
 *   - thighMeasurement?: number
 *   - shoulderMeasurement?: number  (only on OnboardingProfile)
 *   - calfMeasurement?: number      (only on OnboardingProfile)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = (await req.json()) as Record<string, number | undefined>;

    const numOrUndef = (v: unknown): number | undefined => {
      const n = Number(v);
      if (!isFinite(n) || n <= 0) return undefined;
      return n;
    };

    const waist = numOrUndef(body.waistMeasurement);
    const neck = numOrUndef(body.neckMeasurement);
    const hip = numOrUndef(body.hipMeasurement);
    const chest = numOrUndef(body.chestMeasurement);
    const arm = numOrUndef(body.armMeasurement);
    const thigh = numOrUndef(body.thighMeasurement);
    const shoulder = numOrUndef(body.shoulderMeasurement);
    const calf = numOrUndef(body.calfMeasurement);

    // ─── ذخیره shoulder/calf در OnboardingProfile (فقط آنجا این فیلدها وجود دارند) ───
    const profileUpdate: Record<string, number | null> = {};
    if (shoulder != null) profileUpdate.shoulderMeasurement = shoulder;
    if (calf != null) profileUpdate.calfMeasurement = calf;
    if (Object.keys(profileUpdate).length > 0) {
      await db.onboardingProfile.updateMany({
        where: { userId: user.id },
        data: profileUpdate,
      });
    }

    // ─── محاسبه body composition با فرمول US Navy ───
    const profile = await db.onboardingProfile.findUnique({ where: { userId: user.id } });
    let bodyFatPercent: number | null = null;
    let leanBodyMass: number | null = null;
    if (profile) {
      const bc = calculateBodyComposition({
        gender: profile.gender as "male" | "female",
        height: profile.height,
        weight: profile.weight,
        waist: waist ?? null,
        neck: neck ?? null,
        hip: hip ?? null,
      });
      if (bc) {
        bodyFatPercent = bc.bodyFatPercent;
        leanBodyMass = bc.leanBodyMass;
      }
    }

    // ─── به‌روزرسانی چکاپ phase 0 (baseline) ───
    const existing = await db.checkup.findFirst({
      where: { userId: user.id, phaseNumber: 0 },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      await db.checkup.update({
        where: { id: existing.id },
        data: {
          waistMeasurement: waist ?? existing.waistMeasurement,
          neckMeasurement: neck ?? existing.neckMeasurement,
          hipMeasurement: hip ?? existing.hipMeasurement,
          chestMeasurement: chest ?? existing.chestMeasurement,
          armMeasurement: arm ?? existing.armMeasurement,
          thighMeasurement: thigh ?? existing.thighMeasurement,
          bodyFatPercent: bodyFatPercent ?? existing.bodyFatPercent,
          leanBodyMass: leanBodyMass ?? existing.leanBodyMass,
        },
      });
    } else {
      // اگر چکاپ phase 0 وجود ندارد (نباید پیش بیاید چون onboarding آن را می‌سازد)
      // یک چکاپ baseline جدید ایجاد می‌کنیم
      await db.checkup.create({
        data: {
          userId: user.id,
          phaseNumber: 0,
          isFinalCheckup: false,
          status: "approved",
          weight: profile?.weight ?? 70,
          waistMeasurement: waist ?? null,
          neckMeasurement: neck ?? null,
          hipMeasurement: hip ?? null,
          chestMeasurement: chest ?? null,
          armMeasurement: arm ?? null,
          thighMeasurement: thigh ?? null,
          bodyFatPercent,
          leanBodyMass,
          fatigueLevel: 3,
          sleepQuality: 3,
          dietAdherence: 3,
          workoutAdherence: 3,
          phaseCompleted: true,
          notes: "چکاپ اولیه — اندازه‌های بدنی پس از خرید وارد شد",
          aiAnalysis: null,
          coachNotes: null,
        },
      });
    }

    return Response.json({
      ok: true,
      bodyFatPercent,
      leanBodyMass,
      message: "اندازه‌های بدنی ذخیره شد.",
    });
  } catch (e) {
    return apiError(e);
  }
}
