import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/admin/checkup
 * Admin view of all checkups (optionally filtered by status or userId).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const userId = url.searchParams.get("userId");

    const checkups = await db.checkup.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { id: true, mobile: true, name: true } } },
    });

    return Response.json({
      checkups: checkups.map((c) => ({
        id: c.id,
        userId: c.userId,
        user: c.user,
        phaseNumber: c.phaseNumber,
        isFinalCheckup: c.isFinalCheckup,
        status: c.status,
        weight: c.weight,
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
