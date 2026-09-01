/**
 * اعمال واترمارک FitUp روی همه عکس‌های موجود در uploads/articles/
 *
 * این اسکریپت:
 *  - تمام فایل‌های عکس (webp, png, jpg, jpeg) را در uploads/articles/ بازمی‌گرداند
 *  - برای هر عکس، چک می‌کند آیا واترمارک FitUp دارد (با تشخیص پیکسل نارنجی)
 *  - اگر واترمارک ندارد، واترمارک را اعمال می‌کند و فایل را بازنویسی می‌کند
 *  - فرمت اصلی عکس حفظ می‌شود (PNG→PNG، JPEG→JPEG، WebP→WebP)
 *
 * اجرا: bun run scripts/watermark-all.ts
 */
import { addFitUpWatermark, hasFitUpWatermark } from "../src/lib/fitness/image-processing";
import { UPLOADS_ROOT, getArticlesDir } from "../src/lib/fitness/uploads-config";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import path from "path";

const ARTICLES_DIR = path.join(UPLOADS_ROOT, "articles");
const VALID_EXTS = [".webp", ".png", ".jpg", ".jpeg"];

interface Stats {
  processed: number; // عکس‌هایی که واترمارک شدند
  skipped: number;   // عکس‌هایی که قبلاً واترمارک داشتند
  failed: number;    // عکس‌هایی که خطا دادند
  total: number;     // کل عکس‌های پیدا شده
}

async function processDirectory(dirPath: string, stats: Stats) {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    let s;
    try {
      s = await stat(fullPath);
    } catch {
      continue;
    }

    if (s.isDirectory()) {
      await processDirectory(fullPath, stats);
      continue;
    }

    if (!s.isFile()) continue;

    const ext = path.extname(entry).toLowerCase();
    if (!VALID_EXTS.includes(ext)) continue;

    stats.total++;

    try {
      // چک کن آیا واترمارک دارد
      const alreadyWatermarked = await hasFitUpWatermark(fullPath);
      if (alreadyWatermarked) {
        stats.skipped++;
        continue;
      }

      // واترمارک اعمال کن
      const buffer = await readFile(fullPath);
      const watermarked = await addFitUpWatermark(buffer);
      await writeFile(fullPath, watermarked);
      stats.processed++;
      console.log(`  ✓ واترمارک شد: ${path.relative(ARTICLES_DIR, fullPath)}`);
    } catch (err) {
      stats.failed++;
      console.error(`  ✗ خطا: ${path.relative(ARTICLES_DIR, fullPath)} — ${err}`);
    }
  }
}

async function main() {
  console.log("━".repeat(60));
  console.log("اعمال واترمارک FitUp روی همه عکس‌های مقالات");
  console.log("━".repeat(60));
  console.log(`مسیر: ${ARTICLES_DIR}`);
  console.log("");

  // چک کن مسیر وجود دارد
  try {
    await stat(ARTICLES_DIR);
  } catch {
    console.log("❌ پوشه uploads/articles/ وجود ندارد.");
    return;
  }

  const stats: Stats = { processed: 0, skipped: 0, failed: 0, total: 0 };

  await processDirectory(ARTICLES_DIR, stats);

  console.log("");
  console.log("━".repeat(60));
  console.log("📊 خلاصه:");
  console.log(`   کل عکس‌ها:     ${stats.total}`);
  console.log(`   واترمارک شد:   ${stats.processed}`);
  console.log(`   قبلاً داشت:    ${stats.skipped}`);
  console.log(`   خطا:          ${stats.failed}`);
  console.log("━".repeat(60));

  if (stats.processed === 0 && stats.failed === 0) {
    console.log("✅ همه عکس‌ها قبلاً واترمارک FitUp دارند. کاری لازم نیست.");
  } else if (stats.failed > 0) {
    console.log(`⚠️  ${stats.failed} عکس خطا داد. لطفاً لاگ بالا را بررسی کنید.`);
  } else {
    console.log(`✅ ${stats.processed} عکس با موفقیت واترمارک شد.`);
  }
}

main().catch((e) => {
  console.error("❌ خطای بحرانی:", e);
  process.exit(1);
});
