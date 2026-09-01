/**
 * اسکریپت تعمیر فایل‌های تصویری خراب
 *
 * مشکل: نسخه قبلی addFitUpWatermark همیشه به WebP تبدیل می‌کرد، حتی اگر فایل
 * اصلی PNG یا JPG بود. این باعث می‌شد فایل‌هایی مثل `art-weight-loss.png`
 * محتوای WebP داشته باشند ولی پسوند `.png` نگه دارند — که مرورگرها نمی‌توانند
 * آن‌ها را نمایش دهند.
 *
 * این اسکریپت:
 *  ۱. همه فایل‌های تصویری را بررسی می‌کند
 *  ۲. فایل‌هایی که فرمت محتوایشان با پسوندشان نمی‌خواند را پیدا می‌کند
 *  ۳. آن‌ها را با فرمت درست ذخیره می‌کند (یا پسوند را اصلاح می‌کند)
 *
 * Run: bun run src/lib/fitness/fix-corrupted-images.ts
 */
import sharp from "sharp";
import { readFile, writeFile, readdir, rename } from "fs/promises";
import path from "path";
import { UPLOADS_ROOT } from "./image-processing";

const ARTICLES_DIR = path.join(UPLOADS_ROOT, "articles");

async function fixDirectory(dirPath: string, stats: { fixed: number; ok: number; failed: number }) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await fixDirectory(fullPath, stats);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (![".webp", ".png", ".jpg", ".jpeg"].includes(ext)) continue;

    try {
      const buffer = await readFile(fullPath);
      const meta = await sharp(buffer).metadata();
      const actualFormat = meta.format; // "webp" | "png" | "jpeg"
      const expectedExt = ext.slice(1); // "webp" | "png" | "jpeg" | "jpg"

      // نرمال‌سازی: jpg → jpeg
      const normalizedExpected = expectedExt === "jpg" ? "jpeg" : expectedExt;

      if (actualFormat === normalizedExpected) {
        // فایل سالم است
        stats.ok++;
        continue;
      }

      // فایل خراب است — تعمیر
      console.log(`🔧 تعمیر: ${path.relative(ARTICLES_DIR, fullPath)}`);
      console.log(`   پسوند: .${expectedExt}، فرمت واقعی: ${actualFormat}`);

      if (actualFormat === "webp" && normalizedExpected === "png") {
        // فایل PNG با محتوای WebP → تبدیل به PNG واقعی
        const pngBuffer = await sharp(buffer).png({ compressionLevel: 6 }).toBuffer();
        await writeFile(fullPath, pngBuffer);
        console.log(`   ✓ به PNG واقعی تبدیل شد (${Math.round(pngBuffer.length / 1024)}KB)`);
        stats.fixed++;
      } else if (actualFormat === "webp" && normalizedExpected === "jpeg") {
        // فایل JPEG با محتوای WebP → تبدیل به JPEG واقعی
        const jpegBuffer = await sharp(buffer).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
        await writeFile(fullPath, jpegBuffer);
        console.log(`   ✓ به JPEG واقعی تبدیل شد (${Math.round(jpegBuffer.length / 1024)}KB)`);
        stats.fixed++;
      } else if (actualFormat === "png" && normalizedExpected === "webp") {
        // فایل WebP با محتوای PNG → تغییر پسوند به .png
        const newName = fullPath.replace(/\.webp$/i, ".png");
        await rename(fullPath, newName);
        console.log(`   ✓ پسوند به .png تغییر کرد`);
        stats.fixed++;
      } else if (actualFormat === "jpeg" && normalizedExpected === "webp") {
        // فایل WebP با محتوای JPEG → تغییر پسوند به .jpg
        const newName = fullPath.replace(/\.webp$/i, ".jpg");
        await rename(fullPath, newName);
        console.log(`   ✓ پسوند به .jpg تغییر کرد`);
        stats.fixed++;
      } else {
        console.log(`   ⚠ حالت ناشناخته — skip`);
      }
    } catch (e: any) {
      console.log(`❌ خطا در ${path.relative(ARTICLES_DIR, fullPath)}: ${e.message}`);
      stats.failed++;
    }
  }
}

async function main() {
  console.log("🔧 اسکریپت تعمیر فایل‌های تصویری خراب\n");
  console.log(`   پوشه: ${ARTICLES_DIR}\n`);

  const stats = { fixed: 0, ok: 0, failed: 0 };
  await fixDirectory(ARTICLES_DIR, stats);

  console.log(`\n🎉 تمام!`);
  console.log(`   ✅ سالم: ${stats.ok}`);
  console.log(`   🔧 تعمیر شده: ${stats.fixed}`);
  console.log(`   ❌ ناموفق: ${stats.failed}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
