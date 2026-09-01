import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { scheduleBackgroundHeal } from "@/lib/fitness/article-media-selfheal";
import { persianSearchVariants } from "@/lib/fitness/persian-search";
import { submitToIndexNow } from "@/lib/fitness/indexnow";

const VALID_CATEGORIES = [
  // فارسی
  "تمرین", "تغذیه", "مکمل", "بازیابی", "انگیزشی", "عمومی", "حرکات", "اخبار",
  "روش‌های-تمرینی", "اندازه‌گیری", "ورزشکاران", "آموزش-استروئیدها",
  // انگلیسی (backward compat)
  "general", "nutrition", "training", "motivation", "news", "supplement",
  "recovery", "exercises", "training-methods", "metrics", "athletes", "steroids-education",
];

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FF\u0030-\u0039a-zA-Z\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || `article-${Date.now()}`;
}

// GET /api/articles — public list of published articles with pagination, category filter, search
// Admin-only features:
//   - status=all → returns both draft and published articles (incl. scheduled drafts)
//   - status=draft → only drafts
//   - status=published → only published (default for public access)
//   - include_seo=true → attaches `isSeo` + SEO plan info (coverImagePrompt, keyword) for SEO articles
export async function GET(req: NextRequest) {
  try {
    // ─── خودترمیمی رسانه مقالات (throttled — حداکثر یک اسکن در ۳۰ دقیقه) ───
    // اگر مقاله‌ای کاور یا تصویر inline مفقود داشته باشد، در پس‌زمینه ترمیم
    // می‌شود. این صدا زدن عملاً رایگان است (فقط چک timestamp) و هرگز پاسخ
    // این route را کند نمی‌کند.
    scheduleBackgroundHeal();

    const { searchParams } = new URL(req.url);
    // پارس امن صفحه‌بندی — Number(abc) → NaN → skip/take نامعتبر و خطای ۵۰۰ پراسیما (ممیزی 2-c)
    const page = Math.max(1, Math.floor(Number(searchParams.get("page") || 1) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(searchParams.get("pageSize") || 12) || 12)));
    const category = searchParams.get("category") || "";
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const includeSeo = searchParams.get("include_seo") === "true";

    // امنیت (ممیزی 2-c P1): خواندن مقالات draft/all فقط برای ادمین مجاز است.
    // اگر status غیر از published باشد، requireAdmin صدا زده می‌شود؛ خطای آن
    // (UNAUTHORIZED/FORBIDDEN) به catch می‌رود و پاسخ استاندارد 401/403 برمی‌گردد.
    if (status && status !== "published") {
      await requireAdmin();
    }

    // Public endpoint: only published. Admin endpoint: allow status filter (incl. "all")
    const where: any = {};
    if (status === "all") {
      // admin wants everything — no status filter
    } else if (status && ["draft", "published"].includes(status)) {
      where.status = status;
    } else {
      where.status = "published";
    }
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }
    if (search) {
      // جستجوی مقاوم به نیم‌فاصله/فاصله و ی/ک عربی — همان الگوی foods/exercises
      // (قبلاً contains خام بود و «آب پز» با فاصله، مقاله «آب‌پز» را پیدا نمی‌کرد)
      where.OR = persianSearchVariants(search).flatMap((v) => [
        { title: { contains: v } },
        { excerpt: { contains: v } },
        { tags: { contains: v } },
      ]);
    }

    const [total, articles] = await Promise.all([
      db.article.count({ where }),
      db.article.findMany({
        where,
        // مرتب‌سازی بر اساس تاریخ انتشار واقعی (publishedAt) برای مقالات منتشرشده.
        // برای draftها (که publishedAt = null است)، nullها در DESC در انتها قرار می‌گیرند (SQLite).
        // به‌عنوان fallback، createdAt هم مرتب می‌شود تا draftها به‌ترتیب زمان ایجاد نمایش داده شوند.
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    // If admin wants SEO info, look up SeoArticlePlan for each article's id.
    // This lets the front-end show an "image rebuild" button for SEO-created articles.
    let seoPlansMap: Map<string, { keyword: string; coverImagePrompt: string; planStatus: string }> | null = null;
    if (includeSeo && articles.length > 0) {
      const articleIds = articles.map((a) => a.id);
      const seoPlans = await db.seoArticlePlan.findMany({
        where: { articleId: { in: articleIds } },
        select: {
          articleId: true,
          keyword: true,
          coverImagePrompt: true,
          status: true,
        },
      });
      seoPlansMap = new Map(
        seoPlans.map((p) => [
          p.articleId!,
          {
            keyword: p.keyword,
            coverImagePrompt: p.coverImagePrompt,
            planStatus: p.status,
          },
        ])
      );
    }

    return Response.json({
      articles: articles.map((a) => {
        const seoPlan = seoPlansMap?.get(a.id) ?? null;
        return {
          id: a.id,
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt,
          content: a.content, // مهم: content برای ویرایش مقالات لازم است
          category: a.category,
          tags: a.tags,
          status: a.status,
          authorName: a.author?.name || "تیم فیتاپ",
          coverImage: a.coverImage,
          views: a.views,
          scheduledAt: a.scheduledAt?.toISOString() ?? null,
          publishedAt: a.publishedAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
          // SEO fields
          seoTitle: a.seoTitle,
          seoDescription: a.seoDescription,
          metaKeywords: a.metaKeywords,
          canonicalUrl: a.canonicalUrl,
          ogImage: a.ogImage,
          robots: a.robots,
          readingMinutes: a.readingMinutes,
          // SEO metadata (only attached when include_seo=true)
          isSeo: !!seoPlan,
          seoKeyword: seoPlan?.keyword ?? "",
          seoCoverImagePrompt: seoPlan?.coverImagePrompt ?? "",
        };
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/articles — create article (admin only)
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const {
      title, slug, excerpt, content, category, tags, status, coverImage,
      seoTitle, seoDescription, metaKeywords, canonicalUrl, ogImage, robots, readingMinutes,
      scheduledAt,
    } = body || {};

    if (!title || typeof title !== "string" || title.trim().length < 3) {
      return Response.json({ error: "عنوان مقاله حداقل ۳ کاراکتر باید باشد." }, { status: 400 });
    }
    if (!content || typeof content !== "string" || content.trim().length < 10) {
      return Response.json({ error: "محتوای مقاله بسیار کوتاه است." }, { status: 400 });
    }

    const finalSlug = (typeof slug === "string" && slug.trim() ? slugify(slug) : slugify(title));
    // Ensure slug uniqueness
    const existing = await db.article.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      return Response.json({ error: "این شناسه (slug) قبلاً استفاده شده است." }, { status: 400 });
    }

    const finalCategory = VALID_CATEGORIES.includes(category) ? category : "general";

    // Parse scheduledAt: if a valid future date is provided, the article is saved
    // as "draft" with scheduledAt set (the cron publisher will publish it later).
    // If status is explicitly "published" or no scheduledAt is given, behave as before.
    const scheduledDate = parseScheduledAt(scheduledAt);
    const finalStatus =
      scheduledDate && status !== "published" ? "draft" : status === "published" ? "published" : "draft";

    // اگر مقاله مستقیماً منتشر می‌شود (نه زمان‌بندی‌شده)، publishedAt را روی now تنظیم کن.
    // این تاریخ برای نمایش به کاربر و JSON-LD datePublished استفاده می‌شود.
    const finalPublishedAt = finalStatus === "published" ? new Date() : null;

    // Estimate reading time if not provided (200 wpm for Persian)
    let readingMins = 3;
    try {
      const wordCount = content.trim().split(/\s+/).length;
      readingMins = Math.max(1, Math.ceil(wordCount / 200));
    } catch {}
    if (Number.isFinite(readingMinutes) && readingMinutes > 0) {
      readingMins = readingMinutes;
    }

    const article = await db.article.create({
      data: {
        title: title.trim(),
        slug: finalSlug,
        excerpt: typeof excerpt === "string" ? excerpt.trim() : "",
        content,
        category: finalCategory,
        tags: typeof tags === "string" ? tags.trim() : "",
        status: finalStatus,
        // Only keep scheduledAt if the article is still a draft. A published article
        // should never have a scheduledAt (it's already published).
        scheduledAt: finalStatus === "draft" ? (scheduledDate ?? null) : null,
        // publishedAt فقط زمانی set می‌شود که مقاله واقعاً منتشر شود.
        publishedAt: finalPublishedAt,
        coverImage: typeof coverImage === "string" ? coverImage.trim() : "",
        seoTitle: typeof seoTitle === "string" ? seoTitle.trim() : "",
        seoDescription: typeof seoDescription === "string" ? seoDescription.trim() : "",
        metaKeywords: typeof metaKeywords === "string" ? metaKeywords.trim() : "",
        canonicalUrl: typeof canonicalUrl === "string" ? canonicalUrl.trim() : "",
        ogImage: typeof ogImage === "string" ? ogImage.trim() : "",
        robots: typeof robots === "string" && robots.trim() ? robots.trim() : "index,follow",
        readingMinutes: readingMins,
        authorId: admin.id,
      },
    });

    // ─── ایندکس فوری: انتشار مستقیم مقاله → IndexNow (SEO) ───
    // به‌جای انتظار برای کرون روزانه/كرال گوگل، لحظه‌ای به موتورهای جستجو
    // اطلاع می‌دهیم (fire-and-forget — پاسخ ادمین را کند نمی‌کند).
    if (finalStatus === "published") {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
      submitToIndexNow([`${siteUrl}/?article=${encodeURIComponent(finalSlug)}`]).catch(() => {});
    }

    return Response.json({
      article: {
        ...article,
        scheduledAt: article.scheduledAt?.toISOString() ?? null,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * Parse a scheduledAt value from the request body into a Date.
 *
 * Accepts:
 *  - ISO 8601 string ("2025-12-31T09:00:00.000Z")
 *  - Date-only string ("2025-12-31") — interpreted as 9:00 AM local time
 *  - A Date object (already parsed)
 *  - null/undefined/"" → null (no scheduling)
 *
 * Returns null if the value is invalid or in the past.
 */
function parseScheduledAt(value: unknown): Date | null {
  if (value == null || value === "") return null;
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "string") {
    // Date-only string → 9:00 AM local
    if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      d = new Date(`${value.trim()}T09:00:00`);
    } else {
      d = new Date(value);
    }
  } else if (typeof value === "number") {
    d = new Date(value);
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  // Must be at least 1 minute in the future to be a valid schedule
  const oneMinuteFromNow = Date.now() + 60 * 1000;
  if (d.getTime() < oneMinuteFromNow) return null;
  return d;
}
