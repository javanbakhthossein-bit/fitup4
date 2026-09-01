import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * GET /api/cron/publish-scheduled?secret=CRON_SECRET
 *
 * انتشار مقالات زمان‌بندی‌شده.
 * مقالاتی که status="draft" و scheduledAt <= now هستند را منتشر می‌کند.
 *
 * ─── FIX (۱۴۰۵/۰۶): انتشار خودکار درون‌اپ ───
 * قبلاً این endpoint فقط با کرونِ خارجیِ سرور (crontab) صدا زده می‌شد؛
 * با تغییر کرون‌ها انتشار مقالات زمان‌بندی‌شده متوقف شد (مقاله‌ی ۱ شهریور
 * منتشر نشد). حالا instrumentation خود اپ هر ۱۵ دقیقه این route را صدا
 * می‌زند (startScheduledPublisher) — بدون نیاز به کرون خارجی.
 *
 * محافظت (الگوی db-selfheal):
 *  ۱) secret درست، یا
 *  ۲) اتصال محلی (بدون هدر پروکسی یا IP loopback — درخواستِ خودِ سرور).
 * انتشار idempotent است: مقاله‌ی منتشرشده دوباره منتشر نمی‌شود.
 */
export async function GET(req: NextRequest) {
  // ─── Rate limit (per-IP) — ضد brute-force روی secret ───
  const rl = rateLimit(`cron-publish:${getClientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return rateLimitResponse(rl.retryAfterSec);
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  // مجاز در دو حالت: secret درست یا اتصال محلی از خود سرور (instrumentation)
  const h = req.headers;
  const hasProxyHeaders =
    Boolean(h.get("x-forwarded-for")) ||
    Boolean(h.get("cf-connecting-ip")) ||
    Boolean(h.get("x-real-ip"));
  const clientIp = getClientIp(req);
  const isLoopbackIp =
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp === "::ffff:127.0.0.1" ||
    clientIp.startsWith("::ffff:127.") ||
    (clientIp.startsWith("::ffff:") && clientIp.endsWith(":7f00:1"));
  const isLocal = !hasProxyHeaders || isLoopbackIp;

  const authorized = Boolean(expected && secret === expected) || isLocal;
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  try {
    // پیدا کردن مقالاتی که زمان انتشارشان رسیده
    const scheduled = await db.article.findMany({
      where: {
        status: "draft",
        scheduledAt: { lte: now, not: null },
      },
      select: { id: true, title: true, slug: true },
    });

    if (scheduled.length === 0) {
      return Response.json({ ok: true, published: 0, message: "هیچ مقاله‌ای برای انتشار نیست" });
    }

    // انتشار مقالات
    // مهم: canonicalUrl را هم set می‌کنیم تا گوگل canonical درست را ببیند.
    // این کار از خطای «Alternative page with proper canonical tag» جلوگیری می‌کند.
    // مهم: publishedAt را روی now تنظیم می‌کنیم تا تاریخ انتشار واقعی مقاله ثبت شود
    // (نه createdAt که تاریخ تولید draft است).
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir").replace(/\/$/, "");
    const result = await db.article.updateMany({
      where: {
        id: { in: scheduled.map((a) => a.id) },
      },
      data: {
        status: "published",
        scheduledAt: null, // پاک کردن زمان‌بندی بعد از انتشار
        publishedAt: now, // تاریخ انتشار واقعی
      },
    });

    // set canonicalUrl برای هر مقاله — فقط اگر خالی است
    // (قبلاً بی‌قید و شرط بازنویسی می‌شد و canonical سفارشی ادمین/سندیکیشن از بین می‌رفت)
    // نکته: canonicalUrl در schema غیر-null است و مقدار پیش‌فرض "" دارد.
    for (const a of scheduled) {
      const canonical = `${siteUrl}/?article=${a.slug}`;
      await db.article.updateMany({
        where: {
          id: a.id,
          canonicalUrl: "",
        },
        data: { canonicalUrl: canonical },
      });
    }

    // ─── IndexNow: اطلاع‌رسانی به موتورهای جستجو برای ایندکس سریع ───
    // مقالات تازه منتشرشده را به IndexNow ارسال کن تا در چند دقیقه ایندکس شوند.
    try {
      const { submitToIndexNow } = await import("@/lib/fitness/indexnow");
      const publishedUrls = scheduled.map((a) => `${siteUrl}/?article=${a.slug}`);
      const indexNowResult = await submitToIndexNow(publishedUrls);
      console.log("[cron/publish-scheduled] IndexNow:", indexNowResult);
    } catch (indexNowErr) {
      // خطای IndexNow نباید مانع انتشار شود
      console.error("[cron/publish-scheduled] IndexNow error:", indexNowErr);
    }

    return Response.json({
      ok: true,
      published: result.count,
      articles: scheduled.map((a) => ({ slug: a.slug, title: a.title })),
    });
  } catch (err) {
    console.error("[cron/publish-scheduled] error:", err);
    return Response.json({ error: "خطا در انتشار مقالات" }, { status: 500 });
  }
}
