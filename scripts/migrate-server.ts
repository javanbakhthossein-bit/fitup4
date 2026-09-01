/**
 * مهاجرت رسانه‌های قدیمی + به‌روزرسانی سال مقالات (نسخه سرور — idempotent)
 *
 * تاریخچه: نسخه قدیمی این فایل `getCurrentYears` را از `../src/lib/fitness/ai`
 * import می‌کرد که در نسخه فعلی کد وجود ندارد → خطای TypeScript در `next build`
 * (سکریپت‌های پوشه scripts/ هم مانند src تحت تایپ‌چک بیلد هستند).
 * این نسخه کاملاً خودکفا است (هیچ وابستگی به src ندارد) و اجرای مجدد آن
 * بی‌ضرر است — هر بار فقط کارهای باقی‌مانده را انجام می‌دهد.
 *
 * کارها:
 *  ۱. انتقال امن رسانه‌های خصوصی کاربران از public/uploads/ به uploads/
 *     (دسته‌های شناخته‌شده؛ فایل موجود بازنویسی نمی‌شود)
 *  ۲. حذف public/uploads فقط وقتی هیچ فایل شناخته‌شده‌ای در آن باقی نمانده باشد
 *  ۳. به‌روزرسانی سال‌های قدیمی مقالات به سال جاری (میلادی + شمسی)
 *
 * Run: bun run scripts/migrate-server.ts
 * (deploy.sh همین مهاجرت را در قدم ۶ به‌صورت bash هم انجام می‌دهد؛
 *  این فایل برای اجرای دستی/نگهداری است.)
 */
import { db } from "../src/lib/db";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "public", "uploads");
const DST_DIR = path.join(ROOT, "uploads");

/** دسته‌های رسانه خصوصی که باید از public/uploads به uploads منتقل شوند */
const MEDIA_CATEGORIES = [
  "articles",
  "body-analysis",
  "body-photos",
  "blood-tests",
  "chat",
  "meal-analysis",
  "progress",
  "videos",
] as const;

/* -------------------------------------------------------------------------- */
/*  ابزارهای تاریخ — خودکفا (بدون import از src تا سکریپت‌های آینده نشکنند)   */
/* -------------------------------------------------------------------------- */

/** سال شمسی جاری — از تقویم فارسی Intl با fallback مرز نوروز */
function currentJalaliYear(): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      year: "numeric",
    }).format(new Date());
    const parsed = parseInt(formatted.replace(/\D/g, ""), 10);
    if (Number.isFinite(parsed) && parsed > 1300 && parsed < 1600) return parsed;
  } catch {
    // Intl پشتیبانی نشد → fallback
  }
  const now = new Date();
  const nowruz = new Date(now.getFullYear(), 2, 21); // نوروز تقریبی: ۲۱ مارس
  return now.getTime() >= nowruz.getTime()
    ? now.getFullYear() - 621
    : now.getFullYear() - 622;
}

/** سال‌های جاری میلادی و شمسی (معادل getCurrentYears نسخه قدیمی) */
function getCurrentYears(): { gregorian: number; jalali: number } {
  return { gregorian: new Date().getFullYear(), jalali: currentJalaliYear() };
}

/** تبدیل ارقام فارسی به معادل لاتین (برای جایگزینی امن در متن) */
function toEnglishDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/* -------------------------------------------------------------------------- */
/*  قدم ۱+۲: مهاجرت رسانه‌ها                                                   */
/* -------------------------------------------------------------------------- */

function migrateMedia(): void {
  if (!fs.existsSync(SRC_DIR)) {
    console.log("ℹ public/uploads وجود ندارد — مهاجرت رسانه لازم نیست.");
    return;
  }

  let totalMoved = 0;
  for (const category of MEDIA_CATEGORIES) {
    const src = path.join(SRC_DIR, category);
    if (!fs.existsSync(src)) continue;

    const dst = path.join(DST_DIR, category);
    fs.mkdirSync(dst, { recursive: true });

    let moved = 0;
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const from = path.join(src, entry.name);
      const to = path.join(dst, entry.name);
      if (fs.existsSync(to)) continue; // نسخه جدیدتر در uploads برنده است
      fs.cpSync(from, to, { recursive: true });
      moved++;
    }
    if (moved > 0) {
      totalMoved += moved;
      console.log(`  ✓ ${category} منتقل شد (${moved} آیتم)`);
    } else {
      console.log(`  ✓ ${category} از قبل منتقل شده بود`);
    }
  }

  // زیرپوشه TTS چت
  const ttsSrc = path.join(SRC_DIR, "chat", "tts");
  if (fs.existsSync(ttsSrc)) {
    const ttsDst = path.join(DST_DIR, "chat", "tts");
    fs.mkdirSync(ttsDst, { recursive: true });
    for (const f of fs.readdirSync(ttsSrc)) {
      const from = path.join(ttsSrc, f);
      const to = path.join(ttsDst, f);
      if (fs.existsSync(to)) continue;
      fs.copyFileSync(from, to);
      totalMoved++;
    }
    console.log("  ✓ chat/tts منتقل شد");
  }

  // فقط وقتی حذف کن که هیچ فایلی باقی مانده باشد
  const remaining = countFiles(SRC_DIR);
  if (remaining === 0) {
    fs.rmSync(SRC_DIR, { recursive: true, force: true });
    console.log("  ✓ مهاجرت کامل شد و public/uploads حذف شد");
  } else {
    console.log(
      `  ⚠ ${remaining} فایل شناسایی‌نشده در public/uploads باقی مانده — پوشه حفظ شد (حذف نشد)`
    );
  }
  console.log(`  مجموع موارد منتقل‌شده این اجرا: ${totalMoved}`);
}

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(path.join(dir, entry.name));
    else n++;
  }
  return n;
}

/* -------------------------------------------------------------------------- */
/*  قدم ۳: به‌روزرسانی سال‌های مقالات                                           */
/* -------------------------------------------------------------------------- */

async function updateArticleYears(): Promise<void> {
  const { gregorian, jalali } = getCurrentYears();
  const oldGregorian = [2024, 2025, gregorian - 1].filter((y) => y < gregorian);
  const oldJalali = [1403, 1404, jalali - 1].filter((y) => y < jalali);

  console.log(
    `📅 سال جاری: ${gregorian} میلادی / ${jalali} شمسی — جایگزینی ${oldGregorian.join(",")} و ${oldJalali.join(",")}`
  );

  const articles = await db.article.findMany({
    select: { id: true, title: true, content: true },
  });

  let updated = 0;
  for (const article of articles) {
    let title = article.title ?? "";
    let content = article.content ?? "";
    const before = title + content;

    for (const y of oldGregorian) {
      title = title.split(String(y)).join(String(gregorian));
      content = content.split(String(y)).join(String(gregorian));
    }
    for (const jy of oldJalali) {
      const faOld = String(jy).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
      const faNew = String(jalali).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
      title = title.split(String(jy)).join(String(jalali));
      title = title.split(faOld).join(faNew);
      content = content.split(String(jy)).join(String(jalali));
      content = content.split(faOld).join(faNew);
    }

    if (title + content !== before) {
      await db.article.update({ where: { id: article.id }, data: { title, content } });
      updated++;
    }
  }
  console.log(`  ✓ ${updated} مقاله از ${articles.length} مورد به‌روزرسانی شد.`);
}

/* -------------------------------------------------------------------------- */

async function main() {
  console.log("🚀 مهاجرت سرور FitUp (idempotent — اجرای مجدد بی‌ضرر است)\n");

  console.log("📁 [۱/۲] مهاجرت رسانه‌های قدیمی از public/uploads به uploads/...");
  migrateMedia();

  console.log("\n📅 [۲/۲] به‌روزرسانی سال مقالات...");
  try {
    await updateArticleYears();
  } catch (err) {
    console.error("  ⚠ به‌روزرسانی سال مقالات ناموفق بود:", err);
  }

  await db.$disconnect();
  console.log("\n✅ مهاجرت کامل شد.");
}

main().catch(async (err) => {
  console.error("❌ خطای مهاجرت:", err);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
