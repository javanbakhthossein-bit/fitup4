import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * GET /api/cron/generate-scheduled?secret=CRON_SECRET
 *
 * تولید و انتشار مقاله‌ای که زمان انتشارش رسیده.
 *
 * این endpoint باید هر روز صدا زده شود:
 *   0 8 * * * curl -s "https://fittup.ir/api/cron/generate-scheduled?secret=$CRON_SECRET"
 *
 * محافظت: CRON_SECRET الزامی است (fail-secure — اگر تنظیم نشده باشد ۴۰۱ برمی‌گردد).
 */
export async function GET(req: NextRequest) {
  // ─── Rate limit (per-IP) — ضد brute-force روی secret ───
  const rl = rateLimit(`cron-generate:${getClientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return rateLimitResponse(rl.retryAfterSec);
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    const scheduled = await db.article.findMany({
      where: {
        status: "draft",
        scheduledAt: { lte: now, not: null },
      },
      select: { id: true, title: true, slug: true, content: true },
      orderBy: { scheduledAt: "asc" },
      take: 1,
    });

    if (scheduled.length === 0) {
      return Response.json({ ok: true, published: 0 });
    }

    const article = scheduled[0];
    const needsGeneration = !article.content || article.content.trim().length < 100;

    if (needsGeneration) {
      return Response.json({
        ok: true,
        published: 0,
        message: `مقاله "${article.title}" نیاز به تولید دارد.`,
      });
    }

    await db.article.update({
      where: { id: article.id },
      data: { status: "published", scheduledAt: null, publishedAt: now },
    });

    return Response.json({
      ok: true,
      published: 1,
      article: { slug: article.slug, title: article.title },
    });
  } catch (err) {
    console.error("[cron/generate-scheduled] error:", err);
    return Response.json({ error: "خطا" }, { status: 500 });
  }
}
