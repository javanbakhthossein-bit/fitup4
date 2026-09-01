import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { generateImage, type AspectRatio } from "@/lib/fitness/avalai-image";
import {
  processAndSaveArticleImage,
  processAndSaveInlineImage,
} from "@/lib/fitness/image-processing";

/**
 * POST /api/articles/[slug]/rebuild-images
 *
 * برای مقالاتی که با ایجنت سئو ساخته شده‌اند (و یک SeoArticlePlan دارند):
 *  ۱. اگر تصویر کاور ندارد یا URL آن خراب/خالی است → با coverImagePrompt یک کاور جدید تولید کن.
 *  ۲. اگر در متن مقاله تصویری ![alt](url) دارد که URL آن خالی/خراب است → با یک پرامپت مرتبط تولید کن.
 *  ۳. اگر تصویری alt text ندارد (alt خالی) → یک alt توصیفی فارسی (حاوی کلمه کلیدی) بگذار.
 *  ۴. اگر در متن هیچ تصویری نیست ولی مقاله SEO است → یک تصویر مرتبط تولید کن و در جای مناسب (بعد از H1) درج کن.
 *
 * body (optional):
 *  - force: boolean → اگر true باشد، تمام تصاویر (کاور + inline) دوباره تولید شوند.
 */
// تولید چندین عکس با AI زمان‌بر است — timeout ۵ دقیقه
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin();
    const { slug } = await params;
    const body = await req.json().catch(() => ({} as any));
    const force = Boolean((body as any)?.force);

    const article = await db.article.findUnique({ where: { slug } });
    if (!article) {
      return Response.json({ error: "مقاله یافت نشد." }, { status: 404 });
    }

    // Find linked SEO plan (if any) — gives us coverImagePrompt, keyword, etc.
    const seoPlan = await db.seoArticlePlan.findFirst({
      where: { articleId: article.id },
    });

    const keyword = seoPlan?.keyword || article.tags?.split(",")[0]?.trim() || article.title;
    const coverPrompt =
      seoPlan?.coverImagePrompt ||
      `Professional fitness photograph of ${keyword}, natural bright daylight, modern gym environment, realistic colors, athletic person in natural pose, proper form, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, magazine editorial style`;

    const log: string[] = [];
    let newCoverUrl = article.coverImage;
    let newOgImage = article.ogImage;
    let newContent = article.content;

    // ─── ۱. بررسی / تولید تصویر کاور ───
    const coverMissing = !article.coverImage || article.coverImage.trim() === "" || force;
    if (coverMissing) {
      try {
        const coverImg = await generateImage({
          prompt: coverPrompt,
          aspectRatio: "16:9" as AspectRatio,
          timeoutMs: 120000,
        });
        const processed = await processAndSaveArticleImage({
          buffer: coverImg.buffer,
          articleSlug: article.slug,
          descriptiveName: keyword.replace(/\s+/g, "-").slice(0, 40),
        });
        newCoverUrl = processed.cover.url;
        newOgImage = processed.cover.url;
        log.push(`✅ تصویر کاور تولید شد: ${newCoverUrl}`);
      } catch (e: any) {
        log.push(`❌ خطا در تولید تصویر کاور: ${e.message}`);
      }
    } else {
      log.push("ℹ تصویر کاور از قبل وجود داشت (skip).");
    }

    // ─── ۲. پردازش تصاویر داخل متن (![](url)) ───
    // پارسر regex برای markdown image syntax
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const imgMatches: { alt: string; url: string; fullMatch: string; index: number }[] = [];
    let m;
    let idxCounter = 0;
    while ((m = imgRegex.exec(newContent)) !== null) {
      imgMatches.push({
        alt: m[1] || "",
        url: m[2] || "",
        fullMatch: m[0],
        index: ++idxCounter,
      });
    }

    // Heuristic: a URL is "broken/empty" if it is empty, "IMAGE_PLACEHOLDER_N", or doesn't start with /, http
    const isBrokenUrl = (url: string) =>
      !url ||
      url.trim() === "" ||
      /^IMAGE_PLACEHOLDER_\d+$/i.test(url.trim()) ||
      (!url.startsWith("/") && !url.startsWith("http"));

    let inlineRebuilt = 0;
    let altFixed = 0;

    // ─── تولید پرامپت‌های inline از SeoArticlePlan (اگر موجود) ───
    let inlinePrompts: string[] = [];
    try {
      const raw = (seoPlan as any)?.inlineImagePrompts;
      if (Array.isArray(raw)) {
        inlinePrompts = raw;
      } else if (typeof raw === "string") {
        inlinePrompts = JSON.parse(raw || "[]");
      }
    } catch {
      inlinePrompts = [];
    }

    for (const img of imgMatches) {
      let newAlt = img.alt;
      let newUrl = img.url;
      let needsReplace = false;

      // ۲-الف) اصلاح alt text خالی
      if (!newAlt || newAlt.trim() === "") {
        newAlt = buildAltText(keyword, article.title, img.index);
        altFixed++;
        needsReplace = true;
      }

      // ۲-ب) اگر URL خراب است یا force=true → بازسازی تصویر با پرامپت مرتبط
      if (isBrokenUrl(newUrl) || force) {
        try {
          // استفاده از پرامپت inline از SeoArticlePlan یا fallback به keyword
          const inlinePromptIdx = Math.min(img.index - 1, inlinePrompts.length - 1);
          const inlinePrompt = (inlinePrompts[inlinePromptIdx] as string) ||
            `Photorealistic fitness photo showing: ${newAlt || keyword}, natural bright daylight, gym or athletic setting, realistic human body in natural exercise pose, proper anatomy, correct proportions, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, magazine editorial style`;

          log.push(`🔄 تولید تصویر inline شماره ${img.index}...`);
          const inlineImg = await generateImage({
            prompt: inlinePrompt,
            aspectRatio: "16:9" as AspectRatio,
            timeoutMs: 120000,
          });
          const processedInline = await processAndSaveInlineImage({
            buffer: inlineImg.buffer,
            articleSlug: article.slug,
            descriptiveName: (newAlt || keyword).replace(/\s+/g, "-").slice(0, 40),
            index: img.index,
          });
          newUrl = processedInline.url;
          inlineRebuilt++;
          needsReplace = true;
          log.push(`✅ تصویر inline شماره ${img.index} تولید شد: ${newUrl}`);
        } catch (e: any) {
          log.push(`❌ خطا در تولید inline ${img.index}: ${e.message} — حذف می‌شود`);
          newContent = newContent.replace(img.fullMatch, "");
          continue;
        }
      }

      if (needsReplace) {
        const replacement = `![${newAlt}](${newUrl})`;
        newContent = newContent.replace(img.fullMatch, replacement);
      }
    }

    // ۳. اگر مقاله هیچ تصویر inline ندارد → یک تصویر تولید کن
    if (imgMatches.length === 0) {
      try {
        const inlinePrompt = (inlinePrompts[0] as string) ||
          `Photorealistic fitness photo showing: ${keyword}, natural bright daylight, gym or athletic setting, realistic human body in natural exercise pose, proper anatomy, correct proportions, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, magazine editorial style`;
        log.push(`🔄 مقاله inline ندارد — تولید یک تصویر inline جدید...`);
        const inlineImg = await generateImage({
          prompt: inlinePrompt,
          aspectRatio: "16:9" as AspectRatio,
          timeoutMs: 120000,
        });
        const processedInline = await processAndSaveInlineImage({
          buffer: inlineImg.buffer,
          articleSlug: article.slug,
          descriptiveName: keyword.replace(/\s+/g, "-").slice(0, 40),
          index: 1,
        });
        const inlineMarkdown = `\n\n![${buildAltText(keyword, article.title, 1)}](${processedInline.url})\n\n`;
        // درج بعد از اولین H1
        const h1Match = newContent.match(/^#\s+.+$/m);
        if (h1Match) {
          const h1End = (h1Match.index || 0) + h1Match[0].length;
          newContent = newContent.slice(0, h1End) + inlineMarkdown + newContent.slice(h1End);
        } else {
          newContent = inlineMarkdown + newContent;
        }
        inlineRebuilt++;
        log.push(`✅ تصویر inline جدید درج شد: ${processedInline.url}`);
      } catch (e: any) {
        log.push(`❌ خطا در تولید inline جدید: ${e.message}`);
      }
    }

    // ─── ذخیره در دیتابیس ───
    const updateData: any = {};
    if (newCoverUrl !== article.coverImage) {
      updateData.coverImage = newCoverUrl;
    }
    if (newOgImage !== article.ogImage) {
      updateData.ogImage = newOgImage;
    }
    if (newContent !== article.content) {
      updateData.content = newContent;
    }

    if (Object.keys(updateData).length > 0) {
      await db.article.update({
        where: { id: article.id },
        data: updateData,
      });
      log.push("✓ مقاله در دیتابیس به‌روزرسانی شد.");
    } else {
      log.push("ℹ تغییری لازم نبود (همه چیز سالم بود).");
    }

    return Response.json({
      ok: true,
      slug: article.slug,
      coverImage: newCoverUrl,
      inlineRebuilt,
      altFixed,
      log,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * ساخت alt text فارسی توصیفی حاوی کلمه کلیدی
 * حداقل ۵ کلمه — برای سئوی تصویر (Google Image SEO)
 */
function buildAltText(keyword: string, articleTitle: string, index: number): string {
  // تعداد محدودی الگو برای تنوع
  const templates = [
    `تصویر ${keyword} — ${articleTitle.slice(0, 40)}`,
    `${keyword} در عمل — تصویر آموزشی شماره ${index}`,
    `نمونه تصویری ${keyword} برای راهنمای جامع`,
    `${articleTitle.slice(0, 30)} — ${keyword} (تصویر ${index})`,
  ];
  return templates[index % templates.length];
}

// (buildInlinePrompt حذف شد — دیگر inline جدید تولید نمی‌کنیم)
