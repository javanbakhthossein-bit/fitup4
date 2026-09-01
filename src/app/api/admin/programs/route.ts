import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";

    const where: any = {};
    if (status && ["pending", "generating", "ready", "failed"].includes(status)) {
      where.status = status;
    }

    const programs = await db.programRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, mobile: true, planName: true },
        },
      },
    });

    return Response.json({
      programs: programs.map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.user?.name || "",
        userMobile: p.user?.mobile || "",
        plan: p.plan,
        billingPeriod: p.billingPeriod,
        status: p.status,
        paymentId: p.paymentId,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

// Update program status (approve/reject/ready)
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const { programId, status } = await req.json();
    if (!["pending", "generating", "ready", "failed"].includes(status)) {
      return Response.json({ error: "وضعیت نامعتبر است." }, { status: 400 });
    }

    const updated = await db.programRequest.update({
      where: { id: programId },
      data: { status },
    });

    // If approved (ready), trigger notification
    if (status === "ready") {
      await db.notification.create({
        data: {
          userId: updated.userId,
          type: "achievement",
          title: "برنامه شما آماده شد! 🎯",
          body: "برنامه تمرینی و غذایی شما توسط مربی هوشمند تولید و تایید شد. از بخش تمرینات مشاهده کنید.",
          read: false,
        },
      });
    }

    return Response.json({ ok: true, program: { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() } });
  } catch (e) {
    return apiError(e);
  }
}
