import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import {
  GOAL_LABELS, ACTIVITY_LABELS, GENDER_LABELS,
  WORKOUT_PLACE_LABELS, DIET_LABELS, TRAINING_EXPERIENCE_LABELS,
  BODY_FRAME_LABELS, WORKOUT_TIME_LABELS, PREFERRED_CUISINE_LABELS,
  MEDICAL_CONDITION_LABELS,
} from "@/lib/fitness/types";

/**
 * Robustly parse a stored JSON-or-CSV string list field.
 */
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
 * GET /api/onboarding/profile
 *
 * بازگرداندن آخرین پروفایل آنبوردینگ کاربر با تمام فیلدها (برای نمایش در پنل).
 * فیتاپ هوشمند همیشه به آخرین اطلاعات دسترسی دارد چون این داده‌ها
 * در system prompt مربی هوشمند استفاده می‌شوند.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const profile = await db.onboardingProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return Response.json({ error: "پروفایل آنبوردینگ یافت نشد." }, { status: 404 });
    }

    const medicalConditions = safeParseList(profile.medicalConditions);
    const equipment = safeParseList(profile.equipment);
    const workoutDaysList = safeParseList(profile.workoutDaysList);

    return Response.json({
      ok: true,
      profile: {
        // Identity
        firstName: user.name || null,
        mobile: user.mobile || null,
        // Basic physical
        gender: profile.gender,
        genderLabel: GENDER_LABELS[profile.gender as keyof typeof GENDER_LABELS] || profile.gender,
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
        targetWeight: profile.targetWeight ?? null,
        goal: profile.goal,
        goalLabel: GOAL_LABELS[profile.goal as keyof typeof GOAL_LABELS] || profile.goal,
        activityLevel: profile.activityLevel,
        activityLabel: ACTIVITY_LABELS[profile.activityLevel as keyof typeof ACTIVITY_LABELS] || profile.activityLevel,
        workoutDays: profile.workoutDays,
        workoutDaysList,
        workoutPlace: profile.workoutPlace,
        workoutPlaceLabel: WORKOUT_PLACE_LABELS[profile.workoutPlace as keyof typeof WORKOUT_PLACE_LABELS] || profile.workoutPlace,
        workoutTime: profile.workoutTime ?? null,
        workoutTimeLabel: profile.workoutTime
          ? (WORKOUT_TIME_LABELS[profile.workoutTime as keyof typeof WORKOUT_TIME_LABELS] || profile.workoutTime)
          : null,
        // Equipment
        equipment,
        // Diet
        dietType: profile.dietType,
        dietLabel: DIET_LABELS[profile.dietType as keyof typeof DIET_LABELS] || profile.dietType,
        preferredCuisine: profile.preferredCuisine ?? null,
        preferredCuisineLabel: profile.preferredCuisine
          ? (PREFERRED_CUISINE_LABELS[profile.preferredCuisine as keyof typeof PREFERRED_CUISINE_LABELS] || profile.preferredCuisine)
          : null,
        dislikedFoods: profile.dislikedFoods ?? null,
        allergies: profile.allergies,
        // Health
        injuries: profile.injuries,
        diseases: profile.diseases,
        drugAllergies: profile.drugAllergies ?? null,
        currentMedications: profile.currentMedications ?? null,
        medicalConditions,
        medicalConditionsLabel: medicalConditions.length > 0
          ? medicalConditions.map((c) => MEDICAL_CONDITION_LABELS[c as keyof typeof MEDICAL_CONDITION_LABELS] || c).join("، ")
          : null,
        // Recovery
        sleepHours: profile.sleepHours ?? null,
        stressLevel: profile.stressLevel ?? null,
        waterHabit: profile.waterHabit ?? null,
        bodyFrame: profile.bodyFrame ?? null,
        bodyFrameLabel: profile.bodyFrame
          ? (BODY_FRAME_LABELS[profile.bodyFrame as keyof typeof BODY_FRAME_LABELS] || profile.bodyFrame)
          : null,
        // Training experience
        trainingExperience: profile.trainingExperience ?? null,
        trainingExperienceLabel: profile.trainingExperience
          ? (TRAINING_EXPERIENCE_LABELS[profile.trainingExperience as keyof typeof TRAINING_EXPERIENCE_LABELS] || profile.trainingExperience)
          : null,
        previousTrainingType: profile.previousTrainingType ?? null,
        maxLifts: profile.maxLifts ?? null,
        // Target date
        targetDate: profile.targetDate ?? null,
        // Supplements
        currentSupplements: profile.currentSupplements ?? null,
        // Body composition measurements (BODY-COMPOSITION-PRO)
        neckMeasurement: profile.neckMeasurement ?? null,
        shoulderMeasurement: profile.shoulderMeasurement ?? null,
        calfMeasurement: profile.calfMeasurement ?? null,
      },
      updatedAt: profile.updatedAt,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * Build an `allowedFields` object from the request body.
 * Accepts ALL onboarding fields and validates types.
 */
function buildUpdateFields(body: Record<string, any>): Record<string, any> {
  const allowed: Record<string, any> = {};

  // Identity / basic physical (numeric)
  if (body.weight != null) allowed.weight = Number(body.weight);
  if (body.targetWeight != null) allowed.targetWeight = Number(body.targetWeight);
  if (body.age != null) allowed.age = Number(body.age);
  if (body.height != null) allowed.height = Number(body.height);
  if (body.sleepHours != null) allowed.sleepHours = Number(body.sleepHours);
  if (body.stressLevel != null) allowed.stressLevel = Number(body.stressLevel);
  if (body.waterHabit != null) allowed.waterHabit = Number(body.waterHabit);
  if (body.workoutDays != null) allowed.workoutDays = Number(body.workoutDays);
  if (body.neckMeasurement != null) allowed.neckMeasurement = Number(body.neckMeasurement);
  if (body.shoulderMeasurement != null) allowed.shoulderMeasurement = Number(body.shoulderMeasurement);
  if (body.calfMeasurement != null) allowed.calfMeasurement = Number(body.calfMeasurement);

  // Numeric strings — empty string = null
  const numOrNull = (v: any): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };
  if (body.targetWeight !== undefined) allowed.targetWeight = numOrNull(body.targetWeight);
  if (body.sleepHours !== undefined) allowed.sleepHours = numOrNull(body.sleepHours);
  if (body.stressLevel !== undefined) allowed.stressLevel = numOrNull(body.stressLevel);
  if (body.waterHabit !== undefined) allowed.waterHabit = numOrNull(body.waterHabit);
  if (body.neckMeasurement !== undefined) allowed.neckMeasurement = numOrNull(body.neckMeasurement);
  if (body.shoulderMeasurement !== undefined) allowed.shoulderMeasurement = numOrNull(body.shoulderMeasurement);
  if (body.calfMeasurement !== undefined) allowed.calfMeasurement = numOrNull(body.calfMeasurement);

  // Text fields — empty string preserved as empty (clears the value)
  const textFields: (keyof typeof body)[] = [
    "injuries", "diseases", "allergies", "drugAllergies", "currentMedications",
    "maxLifts", "dislikedFoods", "previousTrainingType", "currentSupplements",
    "targetDate",
  ];
  for (const f of textFields) {
    if (body[f] != null) allowed[f as string] = String(body[f]);
  }

  // Enum-like string fields
  const strFields: (keyof typeof body)[] = [
    "preferredCuisine", "workoutTime", "workoutPlace",
    "trainingExperience", "goal", "activityLevel", "dietType", "bodyFrame", "gender",
  ];
  for (const f of strFields) {
    if (body[f] != null) allowed[f as string] = String(body[f]);
  }

  // Array-like fields — stored as JSON string
  if (body.equipment != null) {
    allowed.equipment = JSON.stringify(
      Array.isArray(body.equipment) ? body.equipment : String(body.equipment).split(",").map((s) => s.trim()).filter(Boolean)
    );
  }
  if (body.workoutDaysList != null) {
    allowed.workoutDaysList = JSON.stringify(
      Array.isArray(body.workoutDaysList) ? body.workoutDaysList : String(body.workoutDaysList).split(",").map((s) => s.trim()).filter(Boolean)
    );
  }
  if (body.medicalConditions != null) {
    allowed.medicalConditions = JSON.stringify(
      Array.isArray(body.medicalConditions) ? body.medicalConditions : String(body.medicalConditions).split(",").map((s) => s.trim()).filter(Boolean)
    );
  }

  return allowed;
}

/**
 * PUT /api/onboarding/profile
 *
 * آپدیت کامل پروفایل آنبوردینگ کاربر (تمام فیلدها).
 * بعد از ذخیره، فیتاپ هوشمند در چت و تولید برنامه از این اطلاعات استفاده می‌کند.
 *
 * (PATCH نیز برای سازگاری با نسخه‌های قبلی نگه داشته شده است.)
 */
export async function PUT(req: NextRequest) {
  return updateProfile(req);
}

export async function PATCH(req: NextRequest) {
  return updateProfile(req);
}

async function updateProfile(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const allowedFields = buildUpdateFields(body || {});

    if (Object.keys(allowedFields).length === 0) {
      return Response.json({ error: "هیچ فیلدی برای آپدیت ارسال نشده است." }, { status: 400 });
    }

    const existing = await db.onboardingProfile.findUnique({ where: { userId: user.id } });
    if (!existing) {
      return Response.json({ error: "پروفایل آنبوردینگ یافت نشد." }, { status: 404 });
    }

    const updated = await db.onboardingProfile.update({
      where: { userId: user.id },
      // ─── M5: کش تحلیل AI آنبوردینگ را باطل کن — مثل POST /api/onboarding.
      // بدون این، GET /api/onboarding/analysis تا force نشود، متن قدیمی
      // (با وزن/هدف قبلی) برمی‌گرداند در حالی که پروفایل ویرایش شده است.
      data: { ...allowedFields, aiAnalysis: null },
    });

    // ثبت نوتیف برای کاربر
    await db.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "پروفایل شما به‌روزرسانی شد ✅",
        body: "اطلاعات پروفایل و پرونده پزشکی شما با موفقیت ذخیره شد. فیتاپ هوشمند از این پس از آخرین اطلاعات شما در چت و تولید برنامه استفاده خواهد کرد.",
        read: false,
      },
    }).catch(() => {});

    return Response.json({
      ok: true,
      message: "پروفایل با موفقیت به‌روزرسانی شد و به مربی هوشمند تزریق شد",
      updatedFields: Object.keys(allowedFields),
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    return apiError(e);
  }
}
