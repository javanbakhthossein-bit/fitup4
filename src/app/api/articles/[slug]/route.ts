import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
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

// GET /api/articles/[slug] — public single article (increments views)
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const article = await db.article.findUnique({
      where: { slug },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!article) {
      return Response.json({ error: "مقاله یافت نشد." }, { status: 404 });
    }
    // Only published articles are publicly viewable (allow preview of drafts via admin only)
    // مقالات زمان‌بندی‌شده (draft با scheduledAt) نباید 404 بدهند — گوگل نباید 404 ببیند
    if (article.status !== "published") {
      try {
        await requireAdmin();
      } catch {
        // اگر مقاله زمان‌بندی‌شده است (draft با scheduledAt)، 404 نده
        // به‌جای 404، مقاله را با status="draft" برگردان تا گوگل 404 نبیند
        if (article.status === "draft" && article.scheduledAt) {
          // مقاله هنوز منتشر نشده — اطلاعاتی محدود برگردان
          return Response.json({
            article: {
              id: article.id,
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt,
              content: article.content,
              category: article.category,
              tags: article.tags,
              status: "scheduled",
              authorName: article.author?.name || "تیم فیتاپ",
              coverImage: article.coverImage,
              seoTitle: article.seoTitle,
              seoDescription: article.seoDescription,
              metaKeywords: article.metaKeywords,
              canonicalUrl: article.canonicalUrl,
              ogImage: article.ogImage,
              robots: "noindex,follow", // گوگل این را index نکند ولی 404 هم نبیند
              readingMinutes: article.readingMinutes,
              scheduledAt: article.scheduledAt?.toISOString() ?? null,
              publishedAt: article.publishedAt?.toISOString() ?? null,
              createdAt: article.createdAt.toISOString(),
              updatedAt: article.updatedAt.toISOString(),
            },
          });
        }
        return Response.json({ error: "مقاله یافت نشد." }, { status: 404 });
      }
    }

    // Increment views (best-effort, non-blocking)
    // ممیزی 2-c P2: شمارش فقط وقتی انجام می‌شود که (۱) مقاله منتشرشده باشد،
    // (۲) بازدیدکننده ربات/کراولر/پیش‌نمایش نباشد و (۳) ادمین نباشد (preview ادمین
    // و رفرش‌های ربات قبلاً شمرده می‌شدند).
    let shouldCountView = article.status === "published";
    if (shouldCountView) {
      const ua = req.headers.get("user-agent") || "";
      if (/bot|crawler|spider|preview/i.test(ua)) {
        shouldCountView = false;
      }
    }
    if (shouldCountView) {
      try {
        // اگر ادمین است، بازدید شمرده نمی‌شود (پیش‌نمایش ادمین آمار را خراب نکند)
        await requireAdmin();
        shouldCountView = false;
      } catch {
        // not an admin → view is counted
      }
    }
    if (shouldCountView) {
      db.article.update({ where: { id: article.id }, data: { views: { increment: 1 } } }).catch(() => {});
    }

    return Response.json({
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        category: article.category,
        tags: article.tags,
        status: article.status,
        authorName: article.author?.name || "تیم فیتاپ",
        coverImage: article.coverImage,
        // SEO fields
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        metaKeywords: article.metaKeywords,
        canonicalUrl: article.canonicalUrl,
        ogImage: article.ogImage,
        robots: article.robots,
        readingMinutes: article.readingMinutes,
        scheduledAt: article.scheduledAt?.toISOString() ?? null,
        publishedAt: article.publishedAt?.toISOString() ?? null,
        views: article.views + (shouldCountView ? 1 : 0),
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

// PUT /api/articles/[slug] — update article (admin only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    const existing = await db.article.findUnique({ where: { slug } });
    if (!existing) {
      return Response.json({ error: "مقاله یافت نشد." }, { status: 404 });
    }

    const body = await req.json();
    const {
      title, slug: newSlug, excerpt, content, category, tags, status, coverImage,
      seoTitle, seoDescription, metaKeywords, canonicalUrl, ogImage, robots, readingMinutes,
      scheduledAt,
    } = body || {};

    const data: any = {};
    if (typeof title === "string" && title.trim().length >= 3) data.title = title.trim();
    if (typeof excerpt === "string") data.excerpt = excerpt.trim();
    if (typeof content === "string" && content.trim().length >= 10) data.content = content;
    if (typeof category === "string" && VALID_CATEGORIES.includes(category)) data.category = category;
    if (typeof tags === "string") data.tags = tags.trim();
    if (typeof coverImage === "string") data.coverImage = coverImage.trim();
    if (status === "published" || status === "draft") data.status = status;

    // SEO fields
    if (typeof seoTitle === "string") data.seoTitle = seoTitle.trim();
    if (typeof seoDescription === "string") data.seoDescription = seoDescription.trim();
    if (typeof metaKeywords === "string") data.metaKeywords = metaKeywords.trim();
    if (typeof canonicalUrl === "string") data.canonicalUrl = canonicalUrl.trim();
    if (typeof ogImage === "string") data.ogImage = ogImage.trim();
    if (typeof robots === "string" && robots.trim()) data.robots = robots.trim();
    if (Number.isFinite(readingMinutes) && readingMinutes > 0) data.readingMinutes = readingMinutes;
    else if (typeof content === "string") {
      // auto recompute reading time
      try {
        const wc = content.trim().split(/\s+/).length;
        data.readingMinutes = Math.max(1, Math.ceil(wc / 200));
      } catch {}
    }

    // ─── Scheduled publish date handling ───
    // `scheduledAt` can be one of:
    //   - null/""         → clear the schedule (no future auto-publish)
    //   - ISO date string  → set schedule (article stays/becomes draft)
    //   - undefined        → leave existing scheduledAt untouched
    if (scheduledAt !== undefined) {
      const parsed = parseScheduledAt(scheduledAt);
      if (parsed) {
        // A valid future date was provided → keep article as draft + schedule it.
        // (If admin wants to publish immediately, they should toggle status=published
        // AND clear scheduledAt by sending scheduledAt="" or null.)
        data.scheduledAt = parsed;
        if (data.status === "published") {
          // Don't allow a published article to also have a scheduledAt — it's already published.
          data.status = "draft";
        }
      } else if (scheduledAt === null || scheduledAt === "") {
        // Explicitly clear the schedule
        data.scheduledAt = null;
        // If article is currently published and we're clearing scheduledAt, leave status alone.
      }
      // If scheduledAt is an invalid string (not null/empty but unparseable), ignore it.
    }

    // ─── publishedAt handling (تاریخ انتشار واقعی) ───
    // وقتی مقاله از draft به published تبدیل می‌شود، publishedAt را روی now تنظیم کن.
    // این تاریخ برای نمایش به کاربر و JSON-LD datePublished استفاده می‌شود.
    // اگر مقاله قبلاً منتشر شده (publishedAt دارد) و همچنان published است، publishedAt را تغییر نده.
    // اگر از published به draft برمی‌گردد، publishedAt را پاک نکن (تاریخ اولین انتشار حفظ شود برای مرجع).
    const isTransitioningToPublished =
      data.status === "published" && existing.status !== "published";
    if (isTransitioningToPublished) {
      data.publishedAt = new Date();
    }

    if (typeof newSlug === "string" && newSlug.trim() && newSlug !== slug) {
      const finalSlug = slugify(newSlug);
      if (finalSlug !== slug) {
        const conflict = await db.article.findUnique({ where: { slug: finalSlug } });
        if (conflict && conflict.id !== existing.id) {
          return Response.json({ error: "این شناسه (slug) قبلاً استفاده شده است." }, { status: 400 });
        }
        data.slug = finalSlug;
      }
    }

    const updated = await db.article.update({ where: { id: existing.id }, data });

    // ─── ایندکس فوری: draft → published → IndexNow (SEO) ───
    // لحظه‌ی انتشار (یا ویرایش مقاله منتشرشده) به موتورهای جستجو اطلاع داده
    // می‌شود تا کرال سریع انجام شود — fire-and-forget.
    if (isTransitioningToPublished || (data.status === "published" && existing.status === "published")) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
      const finalSlug = (typeof data.slug === "string" && data.slug) || slug;
      submitToIndexNow([`${siteUrl}/?article=${encodeURIComponent(finalSlug)}`]).catch(() => {});
    }

    return Response.json({
      article: {
        ...updated,
        scheduledAt: updated.scheduledAt?.toISOString() ?? null,
        publishedAt: updated.publishedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * Parse a scheduledAt value from the request body into a Date.
 * Accepts ISO string, date-only string ("2025-12-31" → 9 AM local), Date object, or number.
 * Returns null if the value is invalid or in the past.
 */
function parseScheduledAt(value: unknown): Date | null {
  if (value == null || value === "") return null;
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "string") {
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
  const oneMinuteFromNow = Date.now() + 60 * 1000;
  if (d.getTime() < oneMinuteFromNow) return null;
  return d;
}

// DELETE /api/articles/[slug] — delete article (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    const existing = await db.article.findUnique({ where: { slug } });
    if (!existing) {
      return Response.json({ error: "مقاله یافت نشد." }, { status: 404 });
    }
    await db.article.delete({ where: { id: existing.id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
