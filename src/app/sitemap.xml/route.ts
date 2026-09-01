import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";

/**
 * ─── sitemap.xml کاملاً داینامیک (فیکس قطعی باگ «فقط ۷ صفحه») ───
 *
 * باگ قبلی: فایل app/sitemap.ts با revalidate=3600 در زمان build پیش‌رندر
 * می‌شد. اگر در زمان build دیتابیس در دسترس نبود یا جداول هنوز ساخته
 * نشده بودند، نسخهٔ خالی (فقط ۷ URL ثابت) «تا یک ساعت» در کش ISR می‌ماند
 * و گوگل همان را می‌دید. روی سرور پروداکشن این سناریو رخ می‌داد چون
 * ترتیب build/db-push در deploy ممکن است جابه‌جا شود.
 *
 * FIX: این route handler با force-dynamic هیچ‌وقت در build-time رندر یا
 * کش نمی‌شود — هر درخواستِ گوگل همیشه از دیتابیس زنده خوانده می‌شود.
 * برای حفاظت از دیتابیس، یک کش حافظه‌ای ۱۰ دقیقه‌ای داریم (نه ISR).
 *
 * خودترمیمی: هر بخش (مقالات/دسته‌ها/حرکات/غذاها) try/catch جداگانه با
 * یک retry دارد؛ خطای یک بخش بقیه را از کار نمی‌اندازد و sitemap هرگز
 * ۵۰۰ نمی‌دهد.
 */

type SitemapEntry = { loc: string; lastmod: string; changefreq: string; priority: string };

// ─── کش حافظه‌ای ۱۰ دقیقه‌ای (به‌جای ISR) ───
let cachedXml: { xml: string; count: number; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function fetchSection<T>(section: string, fn: () => Promise<T>): Promise<T | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      console.error(`[sitemap] ❌ بخش «${section}» خطا داد (تلاش ${attempt}/2): ${msg}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return null;
}

async function buildSitemapXml(): Promise<{ xml: string; count: number }> {
  const nowIso = new Date().toISOString();
  const entries: SitemapEntry[] = [];

  // ─── صفحات ثابت ───
  entries.push({ loc: `${SITE_URL}/`, lastmod: nowIso, changefreq: "daily", priority: "1.0" });

  const staticPages: { params: Record<string, string>; freq: string; pri: string }[] = [
    { params: { tool: "tdee" }, freq: "monthly", pri: "0.8" },
    { params: { tool: "exercises" }, freq: "weekly", pri: "0.8" },
    { params: { tool: "foods" }, freq: "weekly", pri: "0.8" },
    { params: { screen: "articles" }, freq: "daily", pri: "0.7" },
    { params: { screen: "terms" }, freq: "yearly", pri: "0.3" },
    { params: { screen: "contact" }, freq: "yearly", pri: "0.3" },
  ];
  for (const p of staticPages) {
    const qs = Object.entries(p.params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    entries.push({ loc: `${SITE_URL}/?${qs}`, lastmod: nowIso, changefreq: p.freq, priority: p.pri });
  }

  // ─── مقالات منتشرشده (تا ۱۰۰۰۰) ───
  const articles = await fetchSection("articles", () =>
    db.article.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 10000,
      select: { slug: true, updatedAt: true },
    })
  );
  if (articles) {
    for (const a of articles) {
      entries.push({
        loc: `${SITE_URL}/?article=${encodeURIComponent(a.slug)}`,
        lastmod: a.updatedAt?.toISOString() ?? nowIso,
        changefreq: "monthly",
        priority: "0.6",
      });
    }
  }

  // ─── دسته‌بندی‌های مقالات ───
  const categories = await fetchSection("categories", () =>
    db.article.groupBy({ by: ["category"], where: { status: "published" } })
  );
  if (categories) {
    for (const cat of categories) {
      if (cat.category) {
        entries.push({
          loc: `${SITE_URL}/?screen=articles&category=${encodeURIComponent(cat.category)}`,
          lastmod: nowIso,
          changefreq: "weekly",
          priority: "0.5",
        });
      }
    }
  }

  // ─── صفحات اختصاصی هر حرکت ورزشی (تا ۱۰۰۰۰) ───
  const exercises = await fetchSection("exercises", () =>
    db.exerciseLibrary.findMany({
      orderBy: { name: "asc" },
      take: 10000,
      select: { id: true, name: true, updatedAt: true },
    })
  );
  if (exercises) {
    for (const ex of exercises) {
      entries.push({
        loc: `${SITE_URL}/?exercise=${encodeURIComponent(ex.id)}`,
        lastmod: ex.updatedAt?.toISOString() ?? nowIso,
        changefreq: "monthly",
        priority: "0.7",
      });
    }
  }

  // ─── صفحات اختصاصی هر غذا (تا ۱۰۰۰۰ — قبلاً ۱۰۰۰ بود و ۸۰ غذا جا می‌ماند!) ───
  const foods = await fetchSection("foods", () =>
    db.foodLibrary.findMany({
      orderBy: { name: "asc" },
      take: 10000,
      select: { id: true, name: true, updatedAt: true },
    })
  );
  if (foods) {
    for (const f of foods) {
      entries.push({
        loc: `${SITE_URL}/?food=${encodeURIComponent(f.id)}`,
        lastmod: f.updatedAt?.toISOString() ?? nowIso,
        changefreq: "monthly",
        priority: "0.6",
      });
    }
  }

  const failed = ["articles", "categories", "exercises", "foods"].filter(
    (s) => (s === "articles" && !articles) || (s === "categories" && !categories) || (s === "exercises" && !exercises) || (s === "foods" && !foods)
  );
  if (failed.length > 0) {
    console.error(`[sitemap] ⚠️ ${failed.length} بخش بعد از retry شکست خورد (${failed.join("، ")}) — فقط ${entries.length} URL برگشت (انتظار: ۱۳۰۰+).`);
  } else {
    console.log(
      `[sitemap] ✅ کامل — ${entries.length} URL (مقالات=${articles?.length ?? 0}، دسته‌ها=${categories?.length ?? 0}، حرکات=${exercises?.length ?? 0}، غذاها=${foods?.length ?? 0})`
    );
  }

  const xmlParts = entries.map(
    (e) =>
      `<url><loc>${xmlEscape(e.loc)}</loc><lastmod>${e.lastmod}</lastmod><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlParts.join("\n")}\n</urlset>`;
  return { xml, count: entries.length };
}

export async function GET() {
  if (cachedXml && Date.now() - cachedXml.at < CACHE_TTL_MS) {
    return new NextResponse(cachedXml.xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=600",
        "X-Sitemap-Cache": "hit",
        "X-Sitemap-Count": String(cachedXml.count),
      },
    });
  }
  const { xml, count } = await buildSitemapXml();
  cachedXml = { xml, count, at: Date.now() };
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=600",
      "X-Sitemap-Cache": "miss",
      "X-Sitemap-Count": String(count),
    },
  });
}
