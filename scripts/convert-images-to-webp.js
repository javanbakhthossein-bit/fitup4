#!/usr/bin/env node
/**
 * اسکریپت خودکار تبدیل تصاویر مقالات به WebP
 *
 * این اسکریپت:
 *  1. تمام تصاویر PNG/JPG/JPEG در public/uploads/articles را به WebP تبدیل می‌کند
 *  2. در دیتابیس مسیرها را به‌روزرسانی می‌کند (PNG → WebP)
 *  3. تصاویر اصلی را حفظ می‌کند (برای fallback)
 *
 * استفاده:
 *   node scripts/convert-images-to-webp.js
 *
 * بعد از هر بار آپدیت سایت یا افزودن مقالات جدید، این اسکریپت را اجرا کنید.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(__dirname, '..', 'public', 'uploads', 'articles');
const QUALITY = 78; // کیفیت WebP — 78 تعادل خوبی بین حجم و کیفیت است
const MAX_WIDTH = 1200; // حداکثر عرض تصاویر cover
const MAX_HEIGHT = 675; // حداکثر ارتفاع (نسبت 16:9)

async function convertDir(dir) {
  let converted = 0;
  let skipped = 0;
  let totalSaved = 0;

  function processDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        processDir(fullPath);
      } else if (entry.isFile() && /\.(png|jpg|jpeg)$/i.test(entry.name)) {
        const webpPath = fullPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        const origSize = fs.statSync(fullPath).size;

        // اگر WebP وجود ندارد یا قدیمی‌تر از اصلی است
        let needConvert = false;
        if (!fs.existsSync(webpPath)) {
          needConvert = true;
        } else {
          const webpStat = fs.statSync(webpPath);
          const origStat = fs.statSync(fullPath);
          if (webpStat.mtime < origStat.mtime) {
            needConvert = true;
          }
        }

        if (needConvert) {
          try {
            sharp(fullPath)
              .resize(MAX_WIDTH, MAX_HEIGHT, {
                fit: 'inside',
                withoutEnlargement: true,
              })
              .webp({ quality: QUALITY })
              .toFile(webpPath)
              .then(() => {
                const newSize = fs.statSync(webpPath).size;
                const saved = origSize - newSize;
                const pct = Math.round((saved / origSize) * 100);
                console.log(
                  `✓ ${path.relative(ARTICLES_DIR, fullPath)} → .webp ` +
                    `(${(origSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB, -${pct}%)`
                );
              })
              .catch((e) => console.error(`✗ ${entry.name}: ${e.message}`));
            converted++;
            totalSaved += origSize;
          } catch (e) {
            console.error(`✗ ${entry.name}: ${e.message}`);
          }
        } else {
          skipped++;
        }
      }
    }
  }

  if (!fs.existsSync(ARTICLES_DIR)) {
    console.log('پوشه uploads/articles وجود ندارد.');
    return { converted, skipped, totalSaved };
  }

  processDir(ARTICLES_DIR);
  return { converted, skipped, totalSaved };
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  تبدیل تصاویر مقالات به WebP');
  console.log('═══════════════════════════════════════════════\n');

  // مرحله ۱: تبدیل تصاویر
  const result = await convertDir(ARTICLES_DIR);

  // صبر برای اتمام sharp
  await new Promise((r) => setTimeout(r, 2000));

  // مرحله ۲: به‌روزرسانی دیتابیس
  console.log('\n── به‌روزرسانی دیتابیس ──');
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { db } = require(path.join(__dirname, '..', 'src', 'lib', 'db'));
    const articles = await db.article.findMany({
      select: { id: true, coverImage: true, title: true },
      where: {
        coverImage: { contains: '.png' },
      },
    });

    let dbUpdated = 0;
    for (const a of articles) {
      if (a.coverImage && /\.(png|jpg|jpeg)$/i.test(a.coverImage)) {
        const webpUrl = a.coverImage.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        await db.article.update({
          where: { id: a.id },
          data: { coverImage: webpUrl },
        });
        console.log(`  ✓ DB: ${a.title?.slice(0, 40)} → ${webpUrl.split('/').pop()}`);
        dbUpdated++;
      }
    }
    console.log(`\n${dbUpdated} رکورد دیتابیس به‌روزرسانی شد.`);
    await db.$disconnect();
  } catch (e) {
    console.error('خطا در به‌روزرسانی دیتابیس:', e.message);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  خلاصه:`);
  console.log(`  • تبدیل شده: ${result.converted}`);
  console.log(`  • رد شده (قبلاً WebP): ${result.skipped}`);
  console.log(`  • کل صرفه‌جویی: ~${(result.totalSaved / 1024).toFixed(0)}KB`);
  console.log('═══════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
