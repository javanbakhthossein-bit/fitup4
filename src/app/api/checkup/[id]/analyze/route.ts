import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { analyzeCheckup, buildUserContext } from "@/lib/fitness/ai";
import { buildCheckupReferencePoint } from "@/lib/fitness/checkup-helpers";
import type { OnboardingData, Plan } from "@/lib/fitness/types";

/**
 * POST /api/checkup/[id]/analyze
 * Re-trigger AI analysis on an existing checkup (e.g. after edits or if auto-analysis failed).
 *
 * This endpoint now uses the same "smart comparison" logic as POST /api/checkup:
 * it builds a reference point (the most recent PRIOR checkup, or the onboarding
 * baseline if this is the first checkup) and feeds it to the AI so the analysis
 * compares current vs. previous measurements and writes a progress-aware report.
 */
export async function POST(req: NextRequest) {
  try {
    await requirePlanCapability("periodicCheckups");
    const user = await requireAuth();
    const id = req.nextUrl.pathname.split("/").slice(-2, -1)[0];
    const checkup = await db.checkup.findFirst({
      where: { id, userId: user.id },
    });
    if (!checkup) {
      return Response.json({ error: "چکاپ یافت نشد." }, { status: 404 });
    }

    const profile = await db.onboardingProfile.findUnique({ where: { userId: user.id } });
    const userContext = profile
      ? buildUserContext(profileToOnboarding(profile), (user.planName as Plan) ?? null)
      : undefined;

    // Build the smart reference point (previous checkup OR onboarding baseline).
    // We exclude THIS checkup's ID so the search for "previous" doesn't return itself.
    const referencePoint = await buildCheckupReferencePoint({
      userId: user.id,
      excludeCheckupId: checkup.id,
    });

    const result = await analyzeCheckup({
      weight: checkup.weight,
      bodyFatPercent: checkup.bodyFatPercent,
      leanBodyMass: checkup.leanBodyMass,
      chestMeasurement: checkup.chestMeasurement,
      armMeasurement: checkup.armMeasurement,
      waistMeasurement: checkup.waistMeasurement,
      hipMeasurement: checkup.hipMeasurement,
      thighMeasurement: checkup.thighMeasurement,
      fatigueLevel: checkup.fatigueLevel,
      sleepQuality: checkup.sleepQuality,
      dietAdherence: checkup.dietAdherence,
      workoutAdherence: checkup.workoutAdherence,
      notes: checkup.notes,
      phaseNumber: checkup.phaseNumber,
      userContext,
      referencePoint,
      goal: profile?.goal ?? null,
    });

    await db.checkup.update({
      where: { id: checkup.id },
      data: { aiAnalysis: JSON.stringify(result) },
    });

    return Response.json({ ok: true, aiAnalysis: result });
  } catch (e) {
    return apiError(e);
  }
}

function profileToOnboarding(p: any): OnboardingData {
  return {
    gender: p.gender,
    age: p.age,
    height: p.height,
    weight: p.weight,
    targetWeight: p.targetWeight ?? undefined,
    goal: p.goal,
    activityLevel: p.activityLevel,
    workoutDays: p.workoutDays,
    workoutPlace: p.workoutPlace,
    equipment: JSON.parse(p.equipment || "[]"),
    diseases: p.diseases || "",
    injuries: p.injuries || "",
    allergies: p.allergies || "",
    dietType: p.dietType,
  };
}
