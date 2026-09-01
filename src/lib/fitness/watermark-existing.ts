/**
 * Add FitUp watermark to existing inline article images (no new image generation)
 *
 * Run: bun run src/lib/fitness/watermark-existing.ts
 */
import { db } from "../db";
import { addFitUpWatermark, UPLOADS_ROOT } from "./image-processing";
import { readFile, writeFile } from "fs/promises";
import path from "path";

async function main() {
  console.log("🏷 افزودن واترمارک FitUp به تصاویر inline مقالات موجود...\n");

  const articles = await db.article.findMany({
    where: { status: "published" },
    select: { slug: true, content: true },
  });

  let processed = 0;
  let skipped = 0;

  for (const article of articles) {
    // Find all inline image URLs
    const imgUrls = (article.content.match(/\/uploads\/articles\/[^)]+\.(webp|png|jpg)/g) || []);

    for (const url of imgUrls) {
      const filePath = path.join(UPLOADS_ROOT, url.replace(/^\/uploads\//, ""));

      try {
        const buffer = await readFile(filePath);

        // Check if already has watermark (simple check: file size > original)
        // We'll just process all of them

        console.log(`  🏷 ${url}`);
        const watermarked = await addFitUpWatermark(buffer);
        await writeFile(filePath, watermarked);
        console.log(`     ✓ واترمارک اضافه شد (${Math.round(watermarked.length / 1024)}KB)`);
        processed++;
      } catch (e: any) {
        console.log(`     ⚠ فایل پیدا نشد یا خطا: ${e.message}`);
        skipped++;
      }
    }
  }

  console.log(`\n🎉 تمام! پردازش شده: ${processed}, رد شده: ${skipped}`);
}

main().catch(console.error).finally(() => process.exit(0));
