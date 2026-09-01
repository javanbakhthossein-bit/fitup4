import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { createNotification } from "@/lib/fitness/notifications";

/**
 * PATCH /api/admin/checkup/[id]
 * Admin/coach reviews a checkup: updates coachNotes, sets status to "completed".
 * Sends a notification to the athlete.
 *
 * Body: { coachNotes?: string, status?: "completed" | "pending_coach" }
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const id = req.nextUrl.pathname.split("/").slice(-1)[0];
    const body = (await req.json()) as { coachNotes?: string; status?: string };

    const checkup = await db.checkup.findUnique({ where: { id } });
    if (!checkup) {
      return Response.json({ error: "چکاپ یافت نشد." }, { status: 404 });
    }

    const updated = await db.checkup.update({
      where: { id },
      data: {
        coachNotes: body.coachNotes != null ? String(body.coachNotes) : checkup.coachNotes,
        status: body.status === "completed" ? "completed" : "pending_coach",
      },
    });

    if (updated.status === "completed") {
      await createNotification(
        checkup.userId,
        "coach",
        "چکاپ شما توسط مربی بررسی شد 📋",
        body.coachNotes
          ? ` مربی یادداشت‌هایی برای چکاپ فاز ${checkup.phaseNumber} شما ثبت کرده است.`
          : `چکاپ فاز ${checkup.phaseNumber} شما تأیید شد.`,
        "?tab=progress",
        { checkupId: checkup.id, phaseNumber: checkup.phaseNumber }
      );
    }

    return Response.json({
      ok: true,
      checkup: {
        id: updated.id,
        status: updated.status,
        coachNotes: updated.coachNotes,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * GET /api/admin/checkup/[id] — fetch single checkup (admin view)
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const id = req.nextUrl.pathname.split("/").slice(-1)[0];
    const checkup = await db.checkup.findUnique({
      where: { id },
      include: { user: { select: { id: true, mobile: true, name: true } } },
    });
    if (!checkup) {
      return Response.json({ error: "چکاپ یافت نشد." }, { status: 404 });
    }
    return Response.json({
      checkup: {
        id: checkup.id,
        userId: checkup.userId,
        user: checkup.user,
        phaseNumber: checkup.phaseNumber,
        isFinalCheckup: checkup.isFinalCheckup,
        status: checkup.status,
        weight: checkup.weight,
        chestMeasurement: checkup.chestMeasurement,
        armMeasurement: checkup.armMeasurement,
        waistMeasurement: checkup.waistMeasurement,
        hipMeasurement: checkup.hipMeasurement,
        thighMeasurement: checkup.thighMeasurement,
        bodyFatPercent: checkup.bodyFatPercent,
        leanBodyMass: checkup.leanBodyMass,
        fatigueLevel: checkup.fatigueLevel,
        sleepQuality: checkup.sleepQuality,
        dietAdherence: checkup.dietAdherence,
        workoutAdherence: checkup.workoutAdherence,
        phaseCompleted: checkup.phaseCompleted,
        notes: checkup.notes,
        aiAnalysis: checkup.aiAnalysis ? JSON.parse(checkup.aiAnalysis) : null,
        coachNotes: checkup.coachNotes,
        createdAt: checkup.createdAt.toISOString(),
        updatedAt: checkup.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
