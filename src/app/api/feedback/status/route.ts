import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, getCurrentUser } from "@/lib/fitness/auth";

/**
 * GET /api/feedback/status
 * Returns whether the current user has submitted a survey recently (last 30 days).
 * Used by the UI to decide whether to show the survey prompt.
 */
export async function GET(_req: NextRequest) {
  try {
    let userId: string | undefined;
    try {
      const u = await getCurrentUser();
      userId = u?.id;
    } catch {
      return Response.json({ hasRecent: false, lastSubmittedAt: null });
    }

    if (!userId) {
      return Response.json({ hasRecent: false, lastSubmittedAt: null });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find the most recent survey feedback from this user
    const recent = await db.feedback.findFirst({
      where: {
        userId,
        category: "survey",
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const lastEver = await db.feedback.findFirst({
      where: { userId, category: "survey" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return Response.json({
      hasRecent: !!recent,
      lastSubmittedAt: lastEver?.createdAt || null,
    });
  } catch (e) {
    return apiError(e);
  }
}
