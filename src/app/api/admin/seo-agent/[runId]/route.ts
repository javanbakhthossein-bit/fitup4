import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { isAgentRunning, getCurrentRunId } from "@/lib/fitness/seo-agent";

/**
 * GET /api/admin/seo-agent/[runId]
 * دریافت وضعیت لحظه‌ای یک اجرای ایجنت سئو (برای polling)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    await requireAdmin();
    const { runId } = await params;

    const run = await db.seoAgentRun.findUnique({ where: { id: runId } });
    if (!run) {
      return Response.json({ error: "run not found" }, { status: 404 });
    }

    let logs: any[] = [];
    try {
      logs = JSON.parse(run.logs || "[]");
    } catch {
      logs = [];
    }

    let results: any = {};
    try {
      results = JSON.parse(run.results || "{}");
    } catch {
      results = {};
    }

    const running = isAgentRunning() && getCurrentRunId() === runId;

    return Response.json({
      runId: run.id,
      mode: run.mode,
      status: running ? "running" : run.status,
      requestedCount: run.requestedCount,
      successCount: run.successCount,
      failCount: run.failCount,
      durationMs: run.durationMs,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      logs,
      results,
    });
  } catch (e) {
    return apiError(e);
  }
}
