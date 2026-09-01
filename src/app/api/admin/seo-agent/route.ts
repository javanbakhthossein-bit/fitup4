import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import {
  isAgentRunning,
  getCurrentRunId,
  startBackgroundRun,
} from "@/lib/fitness/seo-agent";

/**
 * GET /api/admin/seo-agent
 * وضعیت کامل ایجنت سئو را برمی‌گرداند:
 *  - استراتژی فعال (اخرین نسخه)
 *  - آمار مقالات موجود
 *  - صف مقالات برنامه‌ریزی‌شده
 *  - آخرین اجراها
 *  - وضعیت اجرای فعلی (در حال اجرا یا نه)
 */
export async function GET() {
  try {
    await requireAdmin();

    const [activeStrategy, articles, plannedArticles, recentRuns, scheduledArticles] =
      await Promise.all([
        db.seoStrategy.findFirst({
          where: { isActive: true },
          orderBy: { version: "desc" },
        }),
        db.article.findMany({
          where: { status: "published" },
          select: {
            id: true,
            title: true,
            slug: true,
            views: true,
            category: true,
            createdAt: true,
            coverImage: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        db.seoArticlePlan.findMany({
          where: { status: "planned" },
          orderBy: { priority: "desc" },
          take: 30,
        }),
        db.seoAgentRun.findMany({
          orderBy: { startedAt: "desc" },
          take: 5,
        }),
        // Draft articles scheduled for future publishing (show next 20 by date)
        db.article.findMany({
          where: {
            status: "draft",
            scheduledAt: { not: null },
          },
          select: {
            id: true,
            title: true,
            slug: true,
            category: true,
            coverImage: true,
            scheduledAt: true,
            createdAt: true,
          },
          orderBy: { scheduledAt: "asc" },
          take: 20,
        }),
      ]);

    const totalViews = articles.reduce((s, a) => s + a.views, 0);
    const withCover = articles.filter((a) => a.coverImage).length;

    // Current run (if any)
    const running = isAgentRunning();
    const currentRunId = getCurrentRunId();
    let currentRun: any = null;
    if (running && currentRunId) {
      currentRun = await db.seoAgentRun.findUnique({
        where: { id: currentRunId },
      });
    }

    // Stats by category
    const categoryStats: Record<string, number> = {};
    for (const a of articles) {
      categoryStats[a.category] = (categoryStats[a.category] || 0) + 1;
    }

    return Response.json({
      running,
      currentRun,
      strategy: activeStrategy
        ? {
            id: activeStrategy.id,
            version: activeStrategy.version,
            summary: activeStrategy.summary,
            targetKeywords: activeStrategy.targetKeywords,
            plannedCount: activeStrategy.plannedCount,
            lastRunAt: activeStrategy.lastRunAt,
            content: (() => {
              try {
                return JSON.parse(activeStrategy.content);
              } catch {
                return null;
              }
            })(),
          }
        : null,
      stats: {
        totalArticles: articles.length,
        totalViews,
        withCover,
        withoutCover: articles.length - withCover,
        scheduledDrafts: scheduledArticles.length,
        categoryStats,
      },
      articles: articles.slice(0, 20),
      scheduledArticles: scheduledArticles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        category: a.category,
        coverImage: a.coverImage,
        scheduledAt: a.scheduledAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
      plannedArticles,
      recentRuns,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST /api/admin/seo-agent
 * شروع اجرای ایجنت سئو در پس‌زمینه
 * body: { mode: "full" | "continue" | "strategy_only", count: number, publishImmediately?: boolean }
 *
 * If `publishImmediately` is true, generated articles are published immediately.
 * Otherwise (default), articles are saved as drafts with a `scheduledAt` date
 * spaced out over weeks (based on the strategy content calendar), and the
 * /api/cron/publish-scheduled endpoint will publish them at the right time.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode as "full" | "continue" | "strategy_only" | "content_refresh") || "full";
    const count = Math.min(Math.max(Number(body?.count) || 5, 1), 20);
    const publishImmediately = Boolean(body?.publishImmediately);

    if (isAgentRunning()) {
      return Response.json(
        {
          error:
            "ایجنت سئو در حال اجراست. لطفاً تا پایان آن صبر کنید یا بعد دوباره تلاش کنید.",
          runId: getCurrentRunId(),
        },
        { status: 409 }
      );
    }

    const { runId, alreadyRunning } = await startBackgroundRun({
      adminId: admin.id,
      mode,
      count,
      publishImmediately,
    });

    return Response.json({
      ok: true,
      runId,
      alreadyRunning,
      publishImmediately,
      message:
        mode === "content_refresh"
          ? `آپدیت محتواها شروع شد — تا ${count} مقاله بر اساس فرصت‌های سرچ کنسول بازنویسی می‌شوند`
          : mode === "full"
          ? publishImmediately
            ? `ایجنت سئو با موفقیت شروع شد — تحلیل سایت، تولید استراتژی، برنامه‌ریزی و انتشار فوری ${count} مقاله`
            : `ایجنت سئو با موفقیت شروع شد — تحلیل سایت، تولید استراتژی، برنامه‌ریزی و زمان‌بندی ${count} مقاله برای انتشار در هفته‌های آینده`
          : mode === "strategy_only"
          ? "ایجنت سئو فقط استراتژی تولید می‌کند"
          : publishImmediately
          ? `ایجنت سئو ادامه می‌دهد — تولید و انتشار فوری ${count} مقاله از صف`
          : `ایجنت سئو ادامه می‌دهد — تولید و زمان‌بندی ${count} مقاله از صف برای انتشار در هفته‌های آینده`,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * DELETE /api/admin/seo-agent
 * حذف استراتژی فعال و صف مقالات (ریست کامل)
 */
export async function DELETE() {
  try {
    await requireAdmin();
    if (isAgentRunning()) {
      return Response.json(
        { error: "امکان ریست نیست — ایجنت در حال اجراست" },
        { status: 409 }
      );
    }
    // Deactivate strategies, delete plans, keep runs (history)
    await db.seoStrategy.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await db.seoArticlePlan.deleteMany({
      where: { status: { in: ["planned", "queued", "generating", "failed"] } },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
