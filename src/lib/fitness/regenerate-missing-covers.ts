/**
 * اسکریپت تولید عکس کاور برای مقالاتی که کاور ندارند یا فایل کاورشان گم شده است.
 *
 * این اسکریپت:
 *  ۱. همه مقالات را از دیتابیس می‌خواند
 *  ۲. بررسی می‌کند که آیا فایل کاور موجود است یا نه
 *  ۳. برای مقالاتی که کاور ندارند، یک SeoArticlePlan پیدا می‌کند (برای گرفتن coverImagePrompt)
 *  ۴. با استفاده از AvalAI Image API یک عکس جدید تولید می‌کند
 *  ۵. عکس را با processAndSaveArticleImage پردازش و ذخیره می‌کند (شامل واترمارک FitUp)
 *  ۶. URL جدید را در دیتابیس به‌روزرسانی می‌کند
 *
 * Run: bun run src/lib/fitness/regenerate-missing-covers.ts
 */
import { db } from "../db";
import { generateImage, type AspectRatio } from "./avalai-image";
import { processAndSaveArticleImage, UPLOADS_ROOT } from "./image-processing";
import { stat } from "fs/promises";
import path from "path";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("🖼 اسکریپت تولید عکس کاور برای مقالات بدون کاور\n");

  // همه مقالات (منتشرشده + پیش‌نویس)
  const articles = await db.article.findMany({
    select: { id: true, title: true, slug: true, coverImage: true, status: true, tags: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📝 ${articles.length} مقاله در دیتابیس یافت شد\n`);

  // پیدا کردن مقالاتی که کاور ندارند یا فایل کاورشان گم شده است
  const missing: typeof articles = [];
  for (const article of articles) {
    if (!article.coverImage) {
      missing.push(article);
      continue;
    }
    const filePath = path.join(UPLOADS_ROOT, article.coverImage.replace(/^\/uploads\//, ""));
    if (!(await fileExists(filePath))) {
      missing.push(article);
    }
  }

  console.log(`🔍 ${missing.length} مقاله بدون کاور (یا با فایل گم‌شده) یافت شد\n`);

  if (missing.length === 0) {
    console.log("✅ همه مقالات کاور دارند — کاری لازم نیست.");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const article of missing) {
    console.log(`━━━ ${article.title.slice(0, 60)} ━━━`);
    console.log(`  slug: ${article.slug} | status: ${article.status}`);

    // پیدا کردن SeoArticlePlan برای این مقاله (برای گرفتن coverImagePrompt)
    const seoPlan = await db.seoArticlePlan.findFirst({
      where: { articleId: article.id },
      select: { keyword: true, coverImagePrompt: true },
    });

    const keyword = seoPlan?.keyword || article.tags?.split(",")[0]?.trim() || article.title;
    const coverPrompt =
      seoPlan?.coverImagePrompt ||
      `Professional fitness photograph of ${keyword}, natural bright daylight, modern gym environment, realistic colors, athletic person in natural pose, proper form, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, magazine editorial style`;

    console.log(`  🗝 keyword: ${keyword}`);

    try {
      console.log(`  🖼 تولید تصویر کاور...`);
      const imgResult = await generateImage({
        prompt: coverPrompt,
        aspectRatio: "16:9" as AspectRatio,
        timeoutMs: 120000,
      });

      console.log(`  ✂️ پردازش و ذخیره...`);
      const processed = await processAndSaveArticleImage({
        buffer: imgResult.buffer,
        articleSlug: article.slug,
        descriptiveName: keyword.replace(/\s+/g, "-").slice(0, 40),
      });

      const newCoverUrl = processed.cover.url;
      console.log(`  ✅ کاور جدید: ${newCoverUrl} (${Math.round(processed.cover.bytes / 1024)}KB)`);

      // به‌روزرسانی دیتابیس
      await db.article.update({
        where: { id: article.id },
        data: {
          coverImage: newCoverUrl,
          ogImage: newCoverUrl,
        },
      });

      console.log(`  ✓ دیتابیس به‌روزرسانی شد\n`);
      success++;
    } catch (e: any) {
      console.log(`  ❌ خطا: ${e.message}\n`);
      failed++;
    }

    // انتظار ۲ ثانیه بین تصاویر برای جلوگیری از rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n🎉 تمام شد!`);
  console.log(`  ✅ موفق: ${success}`);
  console.log(`  ❌ ناموفق: ${failed}`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
