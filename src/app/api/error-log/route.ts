import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { logError } from "@/lib/error-logger";
import { requireAdmin, apiError, getCurrentUser } from "@/lib/fitness/auth";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * POST /api/error-log
 * Public endpoint — anyone can submit error logs (client-side errors).
 * Rate limit per-IP (۳۰/دقیقه) + سقف طول فیلدها برای جلوگیری از DoS دیسک/DB.
 */
export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit (per-IP) — ضد درج بی‌نهایت رکورد در SQLite ───
    const rl = rateLimit(`error-log:${getClientIp(req)}`, 30, 60 * 1000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    const body = await req.json().catch(() => ({}));
    // Try to get user ID from session (optional — errors can be anonymous)
    let userId: string | undefined;
    try {
      const user = await getCurrentUser();
      if (user) userId = user.id;
    } catch {
      // anonymous error — that's fine
    }
    // ─── سقف طول فیلدها قبل از درج در DB ───
    const truncate = (v: unknown, max: number): string | undefined =>
      typeof v === "string" && v.length > 0 ? v.slice(0, max) : undefined;
    // ─── اعتبارسنجی source (whitelist) — قبلاً هر رشته‌ای با هر طولی قبول می‌شد ───
    const VALID_SOURCES = ["client", "api", "server"] as const;
    const source: (typeof VALID_SOURCES)[number] = (
      VALID_SOURCES as readonly string[]
    ).includes(body.source)
      ? body.source
      : "client";
    await logError({
      source,
      message: truncate(body.message, 500) || "Unknown error",
      stack: truncate(body.stack, 2000),
      url: truncate(body.url, 300),
      method: truncate(body.method, 10),
      statusCode: body.statusCode,
      userId,
      userAgent: truncate(body.userAgent, 300),
      context: body.context,
    });
    // ─── هرس دوره‌ای ErrorLog (بدون این، جدول بی‌نهایت رشد می‌کرد) ───
    // با احتمال ~۵٪ در هر درج، رکوردهای قدیمی‌تر از ۳۰ روز حذف می‌شوند —
    // بدون cron جدید و بدون بار محسوس روی مسیر لاگ‌ing
    if (Math.random() < 0.05) {
      try {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await db.errorLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
      } catch {
        // هرس best-effort است — نباید لاگ‌ing را شکست بدهد
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * GET /api/error-log
 * Admin-only — returns error logs with filtering.
 * Query params: ?source=client|api|server &reviewed=true|false &limit=50 &offset=0
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const source = url.searchParams.get("source") || undefined;
    const reviewed = url.searchParams.get("reviewed");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const offset = Number(url.searchParams.get("offset")) || 0;

    const where: {
      source?: string;
      reviewed?: boolean;
    } = {};
    if (source) where.source = source;
    if (reviewed === "true") where.reviewed = true;
    if (reviewed === "false") where.reviewed = false;

    const [logs, total] = await Promise.all([
      db.errorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: { id: true, name: true, mobile: true },
          },
        },
      }),
      db.errorLog.count({ where }),
    ]);

    return Response.json({ logs, total, limit, offset });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * PATCH /api/error-log
 * Admin-only — mark error(s) as reviewed.
 * Body: { ids: string[] } or { markAll: true }
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    if (body.markAll) {
      const result = await db.errorLog.updateMany({
        where: { reviewed: false },
        data: { reviewed: true },
      });
      return Response.json({ ok: true, updated: result.count });
    } else if (Array.isArray(body.ids)) {
      const result = await db.errorLog.updateMany({
        where: { id: { in: body.ids } },
        data: { reviewed: true },
      });
      return Response.json({ ok: true, updated: result.count });
    }
    return Response.json({ ok: true, updated: 0 });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * DELETE /api/error-log
 * Admin-only — delete error log(s).
 * Body: { ids: string[] } or { deleteAll: true }
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    if (body.deleteAll) {
      const result = await db.errorLog.deleteMany({});
      return Response.json({ ok: true, deleted: result.count });
    } else if (Array.isArray(body.ids)) {
      const result = await db.errorLog.deleteMany({
        where: { id: { in: body.ids } },
      });
      return Response.json({ ok: true, deleted: result.count });
    }
    return Response.json({ ok: true, deleted: 0 });
  } catch (e) {
    return apiError(e);
  }
}
