import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { analyzeCheckup, buildUserContext, type CheckupReferencePoint } from "@/lib/fitness/ai";
import type { OnboardingData, Plan } from "@/lib/fitness/types";
import { createNotification } from "@/lib/fitness/notifications";
import { calculateBodyComposition } from "@/lib/fitness/body-composition";
import { computeBodyFat, buildCheckupReferencePoint } from "@/lib/fitness/checkup-helpers";

interface CheckupBody {
  weight: number;
  phaseNumber?: number;
  isFinalCheckup?: boolean;
  chestMeasurement?: number;
  armMeasurement?: number;
  waistMeasurement?: number;
  hipMeasurement?: number;
  thighMeasurement?: number;
  neckMeasurement?: number;
  fatigueLevel?: number;
  sleepQuality?: number;
  dietAdherence?: number;
  workoutAdherence?: number;
  phaseCompleted?: boolean;
  notes?: string;
  /** Optional: trigger AI analysis immediately on submit (default true for standard+ plans) */
  analyze?: boolean;
}

export async function GET() {
  try {
    const user = await requireAuth();
    const checkups = await db.checkup.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return Response.json({
      checkups: checkups.map((c) => ({
        id: c.id,
        phaseNumber: c.phaseNumber,
        isFinalCheckup: c.isFinalCheckup,
        status: c.status,
        weight: c.weight,
        chestMeasurement: c.chestMeasurement,
        armMeasurement: c.armMeasurement,
        waistMeasurement: c.waistMeasurement,
        hipMeasurement: c.hipMeasurement,
        thighMeasurement: c.thighMeasurement,
        neckMeasurement: c.neckMeasurement,
        bodyFatPercent: c.bodyFatPercent,
        leanBodyMass: c.leanBodyMass,
        fatigueLevel: c.fatigueLevel,
        sleepQuality: c.sleepQuality,
        dietAdherence: c.dietAdherence,
        workoutAdherence: c.workoutAdherence,
        phaseCompleted: c.phaseCompleted,
        notes: c.notes,
        aiAnalysis: c.aiAnalysis ? JSON.parse(c.aiAnalysis) : null,
        coachNotes: c.coachNotes,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Plan-gated: standard+
    await requirePlanCapability("periodicCheckups");
    const user = await requireAuth();
    const body = (await req.json()) as CheckupBody;

    if (!body.weight || body.weight < 30 || body.weight > 250) {
      return Response.json({ error: "وزن نامعتبر است (۳۰-۲۵۰ کیلوگرم)." }, { status: 400 });
    }

    const phaseNumber = Math.max(1, Math.min(3, Number(body.phaseNumber ?? 1)));
    const fatigueLevel = clampInt(body.fatigueLevel, 1, 5, 3);
    const sleepQuality = clampInt(body.sleepQuality, 1, 5, 3);
    const dietAdherence = clampInt(body.dietAdherence, 1, 5, 3);
    const workoutAdherence = clampInt(body.workoutAdherence, 1, 5, 3);

    // Compute body fat % using onboarding profile data + submitted measurements
    const profile = await db.onboardingProfile.findUnique({ where: { userId: user.id } });
    const bodyFatResult = computeBodyFat({
      gender: (profile?.gender as "male" | "female") ?? "male",
      waist: body.waistMeasurement ?? null,
      hip: body.hipMeasurement ?? null,
      neck: body.neckMeasurement ?? null,
      height: profile?.height ?? null,
      weight: body.weight,
      age: profile?.age ?? null,
    });
    const bodyFatPercent = bodyFatResult?.bodyFatPercent ?? null;
    const leanBodyMass = bodyFatResult?.leanBodyMass ?? null;

    const checkup = await db.checkup.create({
      data: {
        userId: user.id,
        phaseNumber,
        isFinalCheckup: Boolean(body.isFinalCheckup),
        status: "pending_coach",
        weight: Number(body.weight),
        chestMeasurement: numOrNull(body.chestMeasurement),
        armMeasurement: numOrNull(body.armMeasurement),
        waistMeasurement: numOrNull(body.waistMeasurement),
        hipMeasurement: numOrNull(body.hipMeasurement),
        thighMeasurement: numOrNull(body.thighMeasurement),
        neckMeasurement: numOrNull(body.neckMeasurement),
        bodyFatPercent,
        leanBodyMass,
        fatigueLevel,
        sleepQuality,
        dietAdherence,
        workoutAdherence,
        phaseCompleted: Boolean(body.phaseCompleted),
        notes: String(body.notes || ""),
      },
    });

    // Auto-trigger AI analysis (default true)
    const shouldAnalyze = body.analyze !== false;
    let aiAnalysisResult: any = null;
    if (shouldAnalyze) {
      try {
        const userContext = profile
          ? buildUserContext(profileToOnboarding(profile), (user.planName as Plan) ?? null)
          : undefined;

        // ─── Smart comparison: build reference point (previous checkup OR onboarding baseline) ───
        // This is the new "Smart Checkup AI Analysis" — instead of analyzing the current
        // measurements in isolation, we feed the AI a comparison point so it can compute
        // deltas (weight change, measurement change) and write a progress-aware analysis.
        const referencePoint = await buildCheckupReferencePoint({
          userId: user.id,
          excludeCheckupId: checkup.id,
        });

        aiAnalysisResult = await analyzeCheckup({
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
          data: { aiAnalysis: JSON.stringify(aiAnalysisResult) },
        });
      } catch (err) {
        console.error("[checkup] AI analysis failed:", err);
      }
    }

    // Notify: checkup submitted
    await createNotification(
      user.id,
      "checkup",
      "چکاپ دوره‌ای ثبت شد ✅",
      `چکاپ فاز ${phaseNumber} شما ثبت شد و توسط هوش مصنوعی تحلیل شد. امتیاز بدن: ${
        aiAnalysisResult?.bodyScore ?? "—"
      } از ۱۰۰.`,
      "?tab=progress",
      { checkupId: checkup.id, phaseNumber, bodyScore: aiAnalysisResult?.bodyScore ?? null }
    );

    return Response.json({
      id: checkup.id,
      phaseNumber: checkup.phaseNumber,
      status: checkup.status,
      bodyFatPercent: checkup.bodyFatPercent,
      leanBodyMass: checkup.leanBodyMass,
      aiAnalysis: aiAnalysisResult,
      createdAt: checkup.createdAt.toISOString(),
    });
  } catch (e) {
    return apiError(e);
  }
}

function clampInt(v: unknown, min: number, max: number, def: number): number {
  const n = Number(v);
  if (!isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return null;
  return n;
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
    equipment: safeParseEquipment(p.equipment),
    diseases: p.diseases || "",
    injuries: p.injuries || "",
    allergies: p.allergies || "",
    dietType: p.dietType,
  };
}

/**
 * Robustly parse the equipment field which may be stored as:
 * - JSON array string: '["dumbbell","barbell"]'
 * - CSV string: "dumbbell,barbell" (legacy data)
 * - Empty string or null
 */
function safeParseEquipment(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    if (typeof parsed === "string") {
      return parsed.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  } catch {
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
}
