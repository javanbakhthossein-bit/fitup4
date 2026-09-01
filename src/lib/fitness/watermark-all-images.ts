/**
 * اسکریپت جامع: افزودن واترمارک FitUp به همه تصاویر موجود در public/uploads/articles/
 *
 * این اسکریپت همه فایل‌های webp/png/jpg داخل همه زیرپوشه‌های articles را پیدا می‌کند
 * و واترمارک FitUp را به آن‌ها اضافه می‌کند (در صورت نداشتن واترمارک).
 *
 * تشخیص واترمارک: یک فایل کوچک ۱px ساختگی بدون واترمارک می‌سازیم و اگر فایل موجود
 * از نظر اندازه و مشخصات با یک فایل واترمارک‌دار منطبق نباشد، دوباره پردازش می‌کنیم.
 *
 * در عمل، چون واترمارک با sharp composite انجام می‌شود، یک راه ساده‌تر این است که
 * همه فایل‌ها را دوباره پردازش کنیم (overwrite) — چون واترمارک همیشه در گوشه پایین-
 * راست است و اگر دوباره اعمال شود، فقط کمی تیره‌تر می‌شود ولی به‌طور قابل تشخیصی
 * خراب نمی‌شود. برای جلوگیری از این، یک metadata خام "FitUp" را در COM/EXIF ذخیره
 * می‌کنیم و اگر فایل این metadata را داشت، skip می‌کنیم.
 *
 * Run: bun run src/lib/fitness/watermark-all-images.ts
 */
import { addFitUpWatermark, UPLOADS_ROOT } from "./image-processing";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import path from "path";
import sharp from "sharp";

const ARTICLES_DIR = path.join(UPLOADS_ROOT, "articles");

/**
 * تشخیص اینکه آیا فایل واترمارک FitUp دارد یا نه.
 *
 * واترمارک "FitUp" با fontSize = 6% عرض تصویر در گوشه پایین-راست قرار دارد.
 * برای یک تصویر ۱۲۰۰×۶۷۵، fontSize ≈ ۷۲px است و متن از y ≈ height-108 تا y ≈ height-36
 * کشیده می‌شود. پس باید یک نوار بزرگ‌تر از پایین تصویر را بررسی کنیم.
 *
 * روش: استخراج نوار ۱۰۰×۱۰۰ از گوشه پایین-راست و شمارش پیکسل‌های نارنجی-طلایی.
 * اگر حداقل ۲۰ پیکسل نارنجی پیدا شد → واترمارک دارد.
 */
async function hasFitUpWatermark(filePath: string): Promise<boolean> {
  try {
    const buffer = await readFile(filePath);
    const meta = await sharp(buffer).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (width < 50 || height < 50) return false;

    // نوار ۱۰۰×۱۰۰ از گوشه پایین-راست (یا کوچک‌تر اگر تصویر کوچک‌تر باشد)
    const regionW = Math.min(100, width);
    const regionH = Math.min(100, height);
    const region = await sharp(buffer)
      .extract({
        left: Math.max(0, width - regionW),
        top: Math.max(0, height - regionH),
        width: regionW,
        height: regionH,
      })
      .raw()
      .toBuffer();

    // شمارش پیکسل‌های نارنجی-طلایی (R>180, G>100, G<200, B<100)
    let orangePixels = 0;
    const channels = meta.channels || 3;
    for (let i = 0; i < region.length; i += channels) {
      const r = region[i];
      const g = region[i + 1];
      const b = region[i + 2] || 0;
      if (r > 180 && g > 100 && g < 200 && b < 100) {
        orangePixels++;
      }
    }

    // اگر حداقل ۲۰ پیکسل نارنجی-طلایی پیدا شد → واترمارک دارد
    return orangePixels >= 20;
  } catch {
    return false;
  }
}

async function processDirectory(dirPath: string, stats: { processed: number; skipped: number; failed: number }) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // بازگشی به زیرپوشه‌ها
      await processDirectory(fullPath, stats);
      continue;
    }

    // فقط فایل‌های تصویری
    const ext = path.extname(entry.name).toLowerCase();
    if (![".webp", ".png", ".jpg", ".jpeg"].includes(ext)) continue;

    try {
      // بررسی: آیا واترمارک دارد؟
      const alreadyHasWatermark = await hasFitUpWatermark(fullPath);
      if (alreadyHasWatermark) {
        stats.skipped++;
        continue;
      }

      // افزودن واترمارک
      const buffer = await readFile(fullPath);
      const watermarked = await addFitUpWatermark(buffer);
      await writeFile(fullPath, watermarked);
      stats.processed++;
      console.log(`  ✅ ${path.relative(ARTICLES_DIR, fullPath)} — واترمارک اضافه شد (${Math.round(watermarked.length / 1024)}KB)`);
    } catch (e: any) {
      stats.failed++;
      console.log(`  ❌ ${path.relative(ARTICLES_DIR, fullPath)} — خطا: ${e.message}`);
    }
  }
}

async function main() {
  console.log("🏷 اسکریپت جامع واترمارک FitUp");
  console.log(`   پوشه: ${ARTICLES_DIR}\n`);

  try {
    await stat(ARTICLES_DIR);
  } catch {
    console.error(`❌ پوشه articles وجود ندارد: ${ARTICLES_DIR}`);
    process.exit(1);
  }

  const stats = { processed: 0, skipped: 0, failed: 0 };
  await processDirectory(ARTICLES_DIR, stats);

  console.log(`\n🎉 تمام!`);
  console.log(`   ✅ پردازش شده (واترمارک اضافه شد): ${stats.processed}`);
  console.log(`   ⏭ رد شده (از قبل واترمارک داشتند): ${stats.skipped}`);
  console.log(`   ❌ ناموفق: ${stats.failed}`);
  console.log(`   📊 مجموع: ${stats.processed + stats.skipped + stats.failed}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
