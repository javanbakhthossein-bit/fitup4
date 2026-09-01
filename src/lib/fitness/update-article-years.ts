/**
 * اسکریپت به‌روزرسانی سال‌های مقالات
 *
 * کارهایی که انجام می‌دهد:
 *  ۱. جایگزینی 2024 → 2026 در title و content
 *  ۲. جایگزینی ۱۴۰۳ → ۱۴۰۵ در title و content
 *  ۳. جایگزینی 2025 → 2026 (اگر وجود دارد)
 *  ۴. جایگزینی ۱۴۰۴ → ۱۴۰۵
 *
 * مهم: این اسکریپت فقط سال‌های قدیمی را به سال جاری (2026/1405) تغییر می‌دهد.
 * برای سال‌های بعد، باید این اسکریپت دوباره اجرا شود یا یک cron job اضافه شود.
 *
 * Run: bun run src/lib/fitness/update-article-years.ts
 */
import { db } from "../db";

// سال جاری میلادی و شمسی
const CURRENT_YEAR_GREGORIAN = new Date().getFullYear(); // 2026

/**
 * سال شمسی جاری — داینامیک (قبلاً ۱۴۰۵ هاردکد بود و بعد از نوروز می‌گذشت).
 * از تقویم فارسی Intl استفاده می‌کند (خروجی مثل "1405 AP")؛
 * در صورت نبود پشتیبانی، مرز نوروز (~۲۱ مارس) تقریب می‌زند.
 */
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
  // نوروز تقریبی: ۲۱ مارس
  const nowruz = new Date(now.getFullYear(), 2, 21);
  return now.getTime() >= nowruz.getTime()
    ? now.getFullYear() - 621
    : now.getFullYear() - 622;
}
const CURRENT_YEAR_JALALI = currentJalaliYear();

// سال‌های قدیمی که باید جایگزین شوند
const OLD_YEARS_GREGORIAN = [2024, 2025];
const OLD_YEARS_JALALI = [1403, 1404];

async function main() {
  console.log(`📅 اسکریپت به‌روزرسانی سال‌های مقالات`);
  console.log(`   سال جاری میلادی: ${CURRENT_YEAR_GREGORIAN}`);
  console.log(`   سال جاری شمسی: ${CURRENT_YEAR_JALALI}\n`);

  const articles = await db.article.findMany({
    select: { id: true, title: true, slug: true, content: true, status: true },
  });

  console.log(`📝 ${articles.length} مقاله بررسی شد\n`);

  let updated = 0;

  for (const article of articles) {
    let title = article.title || "";
    let content = article.content || "";
    let changed = false;

    // جایگزینی سال‌های میلادی در title
    for (const oldYear of OLD_YEARS_GREGORIAN) {
      if (title.includes(String(oldYear))) {
        title = title.split(String(oldYear)).join(String(CURRENT_YEAR_GREGORIAN));
        changed = true;
      }
    }

    // جایگزینی سال‌های شمسی در title (فارسی و انگلیسی)
    for (const oldYear of OLD_YEARS_JALALI) {
      const faOld = toPersianDigits(String(oldYear));
      const faNew = toPersianDigits(String(CURRENT_YEAR_JALALI));
      if (title.includes(String(oldYear))) {
        title = title.split(String(oldYear)).join(String(CURRENT_YEAR_JALALI));
        changed = true;
      }
      if (title.includes(faOld)) {
        title = title.split(faOld).join(faNew);
        changed = true;
      }
    }

    // جایگزینی سال‌های میلادی در content
    for (const oldYear of OLD_YEARS_GREGORIAN) {
      if (content.includes(String(oldYear))) {
        content = content.split(String(oldYear)).join(String(CURRENT_YEAR_GREGORIAN));
        changed = true;
      }
    }

    // جایگزینی سال‌های شمسی در content
    for (const oldYear of OLD_YEARS_JALALI) {
      const faOld = toPersianDigits(String(oldYear));
      const faNew = toPersianDigits(String(CURRENT_YEAR_JALALI));
      if (content.includes(String(oldYear))) {
        content = content.split(String(oldYear)).join(String(CURRENT_YEAR_JALALI));
        changed = true;
      }
      if (content.includes(faOld)) {
        content = content.split(faOld).join(faNew);
        changed = true;
      }
    }

    if (changed) {
      await db.article.update({
        where: { id: article.id },
        data: { title, content },
      });
      console.log(`  ✅ ${article.slug} (${article.status})`);
      updated++;
    }
  }

  console.log(`\n🎉 تمام! ${updated} مقاله به‌روزرسانی شد.`);
}

function toPersianDigits(s: string): string {
  return s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d)]);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
