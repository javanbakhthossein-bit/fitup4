import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { submitToIndexNow, articleUrl, homePageUrl } from "@/lib/fitness/indexnow";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * POST /api/indexnow?secret=CRON_SECRET
 *
 * ارسال همه URLهای سایت به IndexNow برای ایندکس سریع.
 *
 * این endpoint باید روزانه توسط یک cron job خارجی صدا زده شود:
 *   0 3 * * * curl -s "https://fittup.ir/api/indexnow?secret=$CRON_SECRET"
 *
 * همچنین بعد از انتشار هر مقاله، می‌توان فقط آن مقاله را ارسال کرد:
 *   POST /api/indexnow?secret=CRON_SECRET  body: { urls: ["https://fittup.ir/?article=slug"] }
 *
 * محافظت: CRON_SECRET الزامی است (fail-secure — اگر تنظیم نشده باشد ۴۰۱ برمی‌گردد).
 */
export async function POST(req: NextRequest) {
  // ─── Rate limit (per-IP) — ضد brute-force روی secret ───
  const rl = rateLimit(`indexnow:${getClientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return rateLimitResponse(rl.retryAfterSec);
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let urls: string[] = [];

    // اگر body شامل URLs است، فقط آن‌ها را ارسال کن
    try {
      const body = await req.json();
      if (body?.urls && Array.isArray(body.urls) && body.urls.length > 0) {
        urls = body.urls;
      }
    } catch {
      // body خالی یا JSON نامعتبر — ادامه با همه URLها
    }

    // اگر URLs مشخص نشده، همه URLهای مهم سایت را ارسال کن
    if (urls.length === 0) {
      urls.push(homePageUrl());

      // مقالات منتشرشده
      const articles = await db.article.findMany({
        where: { status: "published" },
        select: { slug: true },
        take: 500,
      });
      for (const a of articles) {
        urls.push(articleUrl(a.slug));
      }

      // صفحات اصلی
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
      urls.push(`${siteUrl}/?screen=articles`);
      urls.push(`${siteUrl}/?tool=tdee`);
      urls.push(`${siteUrl}/?tool=exercises`);
      urls.push(`${siteUrl}/?tool=foods`);

      // ─── صفحات پویای غذاها — برای ایندکس سریع ───
      const foods = await db.foodLibrary.findMany({
        orderBy: { name: "asc" },
        take: 1000,
        select: { id: true },
      });
      for (const f of foods) {
        urls.push(`${siteUrl}/?food=${encodeURIComponent(f.id)}`);
      }

      // ─── صفحات پویای حرکات — برای ایندکس سریع ───
      const exercises = await db.exerciseLibrary.findMany({
        orderBy: { name: "asc" },
        take: 1000,
        select: { id: true },
      });
      for (const ex of exercises) {
        urls.push(`${siteUrl}/?exercise=${encodeURIComponent(ex.id)}`);
      }
    }

    const result = await submitToIndexNow(urls);

    return Response.json({
      ok: result.ok,
      submitted: result.submitted,
      status: result.status,
      error: result.error,
      totalUrls: urls.length,
    });
  } catch (err) {
    console.error("[indexnow] error:", err);
    return Response.json({ error: "خطا در ارسال به IndexNow" }, { status: 500 });
  }
}

/**
 * GET /api/indexnow?secret=CRON_SECRET
 *
 * نسخه GET برای استفاده در cron job ساده (بدون نیاز به POST).
 */
export async function GET(req: NextRequest) {
  // ─── Rate limit (per-IP) — ضد brute-force روی secret ───
  const rl = rateLimit(`indexnow:${getClientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return rateLimitResponse(rl.retryAfterSec);
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const urls: string[] = [homePageUrl()];

    const articles = await db.article.findMany({
      where: { status: "published" },
      select: { slug: true },
      take: 500,
    });
    for (const a of articles) {
      urls.push(articleUrl(a.slug));
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    urls.push(`${siteUrl}/?screen=articles`);
    urls.push(`${siteUrl}/?tool=tdee`);
    urls.push(`${siteUrl}/?tool=exercises`);
    urls.push(`${siteUrl}/?tool=foods`);

    // ─── صفحات پویای غذاها و حرکات — برای ایندکس سریع ───
    const foods = await db.foodLibrary.findMany({
      orderBy: { name: "asc" },
      take: 1000,
      select: { id: true },
    });
    for (const f of foods) {
      urls.push(`${siteUrl}/?food=${encodeURIComponent(f.id)}`);
    }

    const exercises = await db.exerciseLibrary.findMany({
      orderBy: { name: "asc" },
      take: 1000,
      select: { id: true },
    });
    for (const ex of exercises) {
      urls.push(`${siteUrl}/?exercise=${encodeURIComponent(ex.id)}`);
    }

    const result = await submitToIndexNow(urls);

    return Response.json({
      ok: result.ok,
      submitted: result.submitted,
      status: result.status,
      error: result.error,
      totalUrls: urls.length,
    });
  } catch (err) {
    console.error("[indexnow] error:", err);
    return Response.json({ error: "خطا در ارسال به IndexNow" }, { status: 500 });
  }
}
