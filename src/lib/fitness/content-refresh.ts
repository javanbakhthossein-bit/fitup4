/**
 * آپدیت محتواها بر اساس گزارش Google Search Console (T4 — «آپدیت محتواها»)
 *
 * هدف: مقالات منتشر‌شده‌ای که برای کوئری‌های واقعی در جایگاه ۴ تا ۲۵ گوگل‌اند
 * (فاصله‌ی ضربه‌ای / striking distance) را هوش مصنوعی بازنویسی و غنی‌سازی
 * می‌کند تا به رتبه‌ی یک برسند — بر اساس داده‌ی واقعی کلیک/نمایش/جایگاه.
 *
 * جریان:
 *  ۱. داده GSC (از کش ۲۴ ساعته — بدون هزینه‌ی API اضافه، T6)
 *  ۲. تطبیق کوئری‌ها با مقالات منتشر‌شده (عنوان/slug/کلمات کلیدی/URL صفحه)
 *  ۳. انتخاب فرصت‌ها: جایگاه ۳.۵ تا ۲۵ + حداقل نمایش
 *  ۴. برای هر مقاله: بازنویسی AI با حفظ ساختار Markdown + غنی‌سازی E-E-A-T
 *     + پرسش‌های متداول جدید + توزیع طبیعی کلمه کلیدی هدف
 *  ۵. ذخیره در همان مقاله (content/excerpt/فیلدهای سئو) — status=published می‌ماند
 */

import { db } from "@/lib/db";
import { avalaiClient, TEXT_MODEL, withSystemDirectives } from "@/lib/fitness/ai";
import { getSearchConsoleData, getGscSummaryForSeo } from "@/lib/fitness/search-console";
import { log, type RunContext } from "@/lib/fitness/seo-agent";

/* ─────────────── پیکربندی انتخاب فرصت ─────────────── */

/** جایگاه ۳.۵ تا این مقدار = فرصت آپدیت (صفحه اول تا صفحه سوم) */
const MAX_POSITION = 25;
/** حداقل نمایش برای فرصت (کوئری بی‌نمایش ارزش آپدیت ندارد) */
const MIN_IMPRESSIONS = 20;

interface Opportunity {
  articleId: string;
  slug: string;
  title: string;
  matchedQueries: { query: string; clicks: number; impressions: number; position: number }[];
}

/** پیدا کردن مقاله‌ی مرتبط برای هر کوئری GSC */
async function findOpportunities(): Promise<Opportunity[]> {
  const gsc = await getSearchConsoleData(false);
  if (!gsc.ok || !gsc.data) return [];

  const articles = await db.article.findMany({
    where: { status: "published" },
    select: { id: true, slug: true, title: true, metaKeywords: true, excerpt: true, content: true, seoTitle: true, seoDescription: true },
  });
  if (articles.length === 0) return [];

  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const pageToArticle = new Map<string, typeof articles[number]>();
  for (const a of articles) {
    // URL صفحه‌ی مقاله در این اپ: /?article=slug (و قدیمی: /article/slug)
    pageToArticle.set(`/?article=${a.slug}`, a);
    pageToArticle.set(`/article/${a.slug}`, a);
  }

  // نقشه‌ی مقاله → کوئری‌های منطبق
  const byArticle = new Map<string, Opportunity>();
  const register = (article: typeof articles[number], q: { keys: string[]; clicks: number; impressions: number; position: number }) => {
    if (q.position < 3.5 || q.position > MAX_POSITION || q.impressions < MIN_IMPRESSIONS) return;
    let opp = byArticle.get(article.id);
    if (!opp) {
      opp = { articleId: article.id, slug: article.slug, title: article.title, matchedQueries: [] };
      byArticle.set(article.id, opp);
    }
    opp.matchedQueries.push({ query: q.keys[0], clicks: q.clicks, impressions: q.impressions, position: q.position });
  };

  // ۱) تطبیق مستقیم صفحه (دقیق‌ترین)
  for (const p of gsc.data.pages) {
    const url = p.keys[0] || "";
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0] === ""
      ? url.replace(/^https?:\/\/[^/]+/, "") || "/"
      : url.replace(/^https?:\/\/[^/]+/, "");
    const normalized = url.includes(siteBase) ? url.split(siteBase)[1] || "/" : path;
    const article = pageToArticle.get(normalized);
    if (article) {
      // همه‌ی کوئری‌هایی که این صفحه رتبه دارد — از گزارش pages قابل استخراج نیست
      // (GSC جدا می‌دهد)؛ از تطبیق کوئری در گام ۲ پوشش داده می‌شود.
      register(article, { keys: [""], clicks: p.clicks, impressions: p.impressions, position: p.position });
    }
  }

  // ۲) تطبیق متن کوئری با عنوان/slug/کلمات کلیدی مقاله
  const norm = (s: string) => s.replace(/[\u200c\s]+/g, " ").trim().toLowerCase();
  for (const q of gsc.data.queries) {
    const query = q.keys[0];
    if (!query || query.length < 3) continue;
    const nq = norm(query);
    const words = nq.split(" ").filter((w) => w.length > 2);
    if (words.length === 0) continue;
    for (const a of articles) {
      const hay = norm(`${a.title} ${a.slug.replace(/-/g, " ")} ${a.metaKeywords}`);
      // همه‌ی کلمات معنادار کوئری در مقاله → تطابق
      const matched = words.every((w) => hay.includes(w));
      if (matched) {
        register(a, q);
        break; // هر کوئری فقط به بهترین (اولین) مقاله
      }
    }
  }

  // پاکسازی کوئری خالی گام ۱ (صفحه‌محور) — فقط حاکی از رتبه است
  const result = Array.from(byArticle.values())
    .map((opp) => ({
      ...opp,
      matchedQueries: opp.matchedQueries.filter((q) => q.query),
    }))
    .filter((opp) => opp.matchedQueries.length > 0);

  // اولویت: جمع نمایش کوئری‌ها (نزولی)
  result.sort(
    (a, b) =>
      b.matchedQueries.reduce((s, q) => s + q.impressions, 0) -
      a.matchedQueries.reduce((s, q) => s + q.impressions, 0)
  );
  return result;
}

/* ─────────────── بازنویسی مقاله با AI ─────────────── */

interface RefreshedArticle {
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  metaKeywords: string;
}

async function refreshArticle(
  article: { title: string; excerpt: string; content: string; seoTitle: string; seoDescription: string; metaKeywords: string; slug: string },
  queries: Opportunity["matchedQueries"]
): Promise<RefreshedArticle> {
  const queriesText = queries
    .map((q) => `- «${q.query}» — ${q.impressions} نمایش/ماه، جایگاه فعلی ${q.position.toFixed(1)}، ${q.clicks} کلیک`)
    .join("\n");

  const systemPrompt = withSystemDirectives(
    `تو یک متخصص ارشد سئوی محتوای فارسی (Content SEO + E-E-A-T) برای پلتفرم فیتاپ هستی.
مقاله‌ی موجود را برای رسیدن به رتبه ۱ گوگل بازنویسی/غنی‌سازی می‌کنی — نه از صفر.

قواعد الزامی:
۱. موضوع و پیام اصلی مقاله را حفظ کن — این «آپدیت» است نه مقاله‌ی جدید.
۲. ساختار Markdown را حفظ کن (## ،### ، جدول‌ها، لیست‌ها).
۳. کلمه‌ی کلیدی هدف (و مترادف‌های طبیعی فارسی) را در: عنوان، H1/H2 اول، پاراگراف اول، و چند جای طبیعی متن بگنجان — بدون keyword stuffing (تراکم زیر ۲٪).
۴. عمق محتوا را بالا ببر: بخش‌های ناقص را کامل کن، آمار/نکات عملی اضافه کن.
۵. بخش «## پرسش‌های متداول» با حداقل ۴ سؤال واقعی مرتبط با کوئری‌ها اضافه/بهبود کن (برای featured snippet).
۶. یک پاراگراف خبرگان (E-E-A-T): تجربه‌ی عملی مربی/ورزشکار — چرا فیتاپ این توصیه را می‌دهد.
۷. لینک داخلی طبیعی: ۲-۳ ارجاع به صفحات فیتاپ با فرمت Markdown: [متن](/?article=slug) — فقط از slugهای واقعی فهرست زیر.
۸. طول: مقاله را به حداقل ۸۰۰ کلمه برسان (اگر کمتر است)؛ اگر بلند است کیفیت را بهبود بده نه حجیم‌سازی.
۹. فارسی روان و حرفه‌ای؛ ارقام را با حروف/اعداد فارسی طبیعی بنویس.
۱۰. عنوان جدید باید جذاب + حاوی کلمه کلیدی اصلی + زیر ۶۰ کاراکتر باشد.
۱۱. خروجی فقط و فقط JSON باشد — هیچ متن اضافه‌ای نه قبل و نه بعد.

خروجی JSON:
{"title":"...","excerpt":"...","content":"... (Markdown کامل)","seoTitle":"...","seoDescription":"...","metaKeywords":"کلمه1, کلمه2, ..."}

کوئری‌های واقعی گوگل برای این مقاله (فرصت‌های رتبه ۱):
${queriesText}

مقاله‌ی فعلی:
عنوان: ${article.title}
slug: ${article.slug}
خلاصه: ${article.excerpt}
کلمات کلیدی فعلی: ${article.metaKeywords || "(خالی)"}

محتوای کامل فعلی:
${article.content}`
  );

  const completion = await avalaiClient.chat.completions.create({
    model: TEXT_MODEL,
    messages: [{ role: "system", content: systemPrompt }],
    temperature: 0.4,
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  // استخراج JSON — مدل گاهی ```json می‌گذارد
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("پاسخ AI قابل پارس نبود");
  const parsed = JSON.parse(jsonMatch[0]) as RefreshedArticle;
  if (!parsed.content || parsed.content.length < 400) throw new Error("محتوای بازنویسی‌شده بسیار کوتاه/ناقص است");
  if (!parsed.title) parsed.title = article.title;
  if (!parsed.excerpt) parsed.excerpt = article.excerpt;
  return parsed;
}

/* ─────────────── اجرای عمومی ─────────────── */

export async function runContentRefresh(
  ctx: RunContext,
  maxArticles: number
): Promise<RunContext> {
  log(ctx, "info", "🔄 شروع آپدیت محتواها بر اساس گزارش Google Search Console");

  // داده GSC از کش (T6) — اگر پیکربندی نشده، به‌صورت شفاف گزارش می‌شود
  const gscSummary = await getGscSummaryForSeo();
  if (!gscSummary) {
    log(ctx, "warn", "⚠️ سرچ کنسول پیکربندی نشده یا داده‌ای ندارد — آپدیت محتوا انجام نمی‌شود (اول تب «سرچ کنسول» را تنظیم کنید)");
    ctx.errors.push("search-console-not-configured");
    return ctx;
  }
  log(ctx, "info", "📊 داده‌های GSC (کش ۲۴ ساعته) دریافت شد — استخراج فرصت‌ها…");

  const opportunities = await findOpportunities();
  if (opportunities.length === 0) {
    log(ctx, "info", "هیچ فرصت آپدینی پیدا نشد (کوئری‌های جایگاه ۴-۲۵ با مقاله منطبق)");
    return ctx;
  }
  const selected = opportunities.slice(0, Math.max(1, Math.min(maxArticles, 20)));
  log(
    ctx,
    "info",
    `🎯 ${toFa(opportunities.length)} فرصت پیدا شد — آپدیت ${toFa(selected.length)} مقاله با بالاترین نمایش`
  );

  for (const opp of selected) {
    try {
      const article = await db.article.findUnique({ where: { id: opp.articleId } });
      if (!article) continue;
      log(
        ctx,
        "info",
        `✍️ آپدیت «${article.title}» برای ${toFa(opp.matchedQueries.length)} کوئری (جایگاه ${toFa(opp.matchedQueries[0].position.toFixed(1))})…`
      );
      const refreshed = await refreshArticle(article, opp.matchedQueries);
      // نسخه پشتیبان محتوای فعلی قبل از بازنویسی (ممیزی 2-c P1) — اگر خروجی AI خراب
      // بود یا ادمین بخواهد، محتوای قبلی از ArticleRevision قابل بازیابی است.
      // اگر ذخیره پشتیبان شکست بخورد، بازنویسی هم انجام نمی‌شود (خطا در catch حلقه).
      await db.articleRevision.create({
        data: {
          articleId: article.id,
          title: article.title,
          excerpt: article.excerpt,
          content: article.content,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
          metaKeywords: article.metaKeywords,
        },
      });
      await db.article.update({
        where: { id: article.id },
        data: {
          title: refreshed.title,
          excerpt: refreshed.excerpt,
          content: refreshed.content,
          seoTitle: refreshed.seoTitle || article.seoTitle,
          seoDescription: refreshed.seoDescription || article.seoDescription,
          metaKeywords: refreshed.metaKeywords || article.metaKeywords,
          // status=published می‌ماند — مقاله زنده به‌روزرسانی می‌شود
        },
      });
      ctx.successCount++;
      ctx.articles.push({ slug: article.slug, title: refreshed.title, updated: true });
      log(ctx, "success", `✅ «${refreshed.title}» آپدیت و منتشر شد`);
    } catch (e) {
      ctx.failCount++;
      const msg = e instanceof Error ? e.message : String(e);
      ctx.errors.push(`refresh:${opp.slug}:${msg}`);
      log(ctx, "error", `❌ خطا در آپدیت «${opp.title}»: ${msg}`);
    }
  }

  log(ctx, "success", `🏁 آپدیت محتواها کامل شد — ${toFa(ctx.successCount)} مقاله بهبودیافت`);
  return ctx;
}

function toFa(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
