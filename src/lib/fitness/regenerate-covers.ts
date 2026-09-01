/**
 * Regenerate all article cover images with FitUp branded style
 *
 * الگوی جدید: dramatic lighting, dark background, orange-gold accents, cinematic
 *
 * Run: bun run src/lib/fitness/regenerate-covers.ts
 */
import { db } from "../db";
import { generateImage, type AspectRatio } from "./avalai-image";
import { processAndSaveArticleImage } from "./image-processing";
import sharp from "sharp";

const KEYWORDS: Record<string, string> = {
  "complete-bodybuilding-program-guide": "bodybuilding workout program, barbell, gym",
  "sports-nutrition-meal-plan": "healthy meal prep, protein, vegetables, fitness nutrition",
  "sports-supplements-complete-guide": "protein powder, supplements, fitness, shaker bottle",
  "weight-loss-scientific-guide": "weight loss, measuring tape, scale, fitness transformation",
  "muscle-gain-7-secrets": "muscular bodybuilder, flexing, muscle growth, gym",
  "fat-loss-tips": "fat loss, cardio, running, fitness, sweating",
  "beginner-3day-program": "beginner workout, dumbbells, home gym, fitness starter",
  "calorie-calculation-guide": "calorie counting, food scale, nutrition tracking, healthy food",
  "food-calorie-chart": "food calorie chart, variety of healthy foods, nutrition",
  "exercise-library-guide": "exercise guide, gym equipment, dumbbells, fitness training",
};

/**
 * Add FitUp watermark to an image buffer
 */
async function addWatermark(buffer: Buffer): Promise<Buffer> {
  // Get image metadata
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1200;
  const height = meta.height || 675;

  // Create watermark text as SVG
  const watermarkText = "FitUp";
  const fontSize = Math.round(width * 0.06); // 6% of width
  const padding = Math.round(width * 0.03);

  // SVG watermark - "FitUp" with orange gradient
  const svgBuffer = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f97316;stop-opacity:1" />
        </linearGradient>
      </defs>
      <text x="${width - padding}" y="${height - padding}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="900"
        fill="url(#grad)"
        text-anchor="end"
        opacity="0.85">${watermarkText}</text>
    </svg>
  `);

  // Composite watermark onto image
  const result = await sharp(buffer)
    .composite([{ input: svgBuffer, top: 0, left: 0, blend: "over" }])
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  return result;
}

async function main() {
  console.log("🎨 شروع بازسازی تصاویر کاور مقالات با الگوی فیتاپ...\n");

  const articles = await db.article.findMany({
    where: { status: "published" },
    select: { id: true, slug: true, title: true, coverImage: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📝 ${articles.length} مقاله یافت شد\n`);

  let success = 0;
  let failed = 0;

  for (const article of articles) {
    console.log(`━━━ ${article.slug} ━━━`);

    // Keyword for this article
    const keyword = KEYWORDS[article.slug] || article.title;

    // Generate new cover with natural realistic style
    const prompt = `Professional fitness photograph of ${keyword}, natural bright daylight, modern gym environment, realistic colors, athletic person in natural pose, proper form, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, magazine editorial style`;

    try {
      console.log(`  🖼 تولید تصویر...`);
      const imgResult = await generateImage({
        prompt,
        aspectRatio: "16:9" as AspectRatio,
        timeoutMs: 120000,
      });

      console.log(`  ✂️ پردازش و بهینه‌سازی...`);
      const processed = await processAndSaveArticleImage({
        buffer: imgResult.buffer,
        articleSlug: article.slug,
        descriptiveName: article.slug.replace(/-/g, "").slice(0, 30),
      });

      // Add FitUp watermark to cover
      console.log(`  🏷 افزودن واترمارک FitUp...`);
      const fs = await import("fs/promises");
      const coverBuffer = await fs.readFile(processed.cover.absPath);
      const watermarked = await addWatermark(coverBuffer);

      // Save watermarked version
      await fs.writeFile(processed.cover.absPath, watermarked);

      const newCoverUrl = processed.cover.url;
      console.log(`  ✅ کاور جدید: ${newCoverUrl} (${Math.round(watermarked.length / 1024)}KB)`);

      // Update article in DB
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

    // Wait 2 seconds between images to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n🎉 تمام شد! موفق: ${success}, ناموفق: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
