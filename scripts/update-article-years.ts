/**
 * بروزرسانی سال در همه مقالات منتشرشده.
 *
 * این اسکریپت:
 *  - همه مقالات published را پیدا می‌کند
 *  - سال‌های قدیمی (1403، 1404، 2024، 2025) را در title، seoTitle، seoDescription،
 *    metaKeywords و content به سال جاری تبدیل می‌کند
 *  - سال‌های قدیمی انگلیسی و فارسی را هر دو پوشش می‌دهد
 *
 * اجرا: bun run scripts/update-article-years.ts
 */
import { db } from "../src/lib/db";

async function main() {
  console.log("━".repeat(60));
  console.log("بروزرسانی سال در مقالات منتشرشده");
  console.log("━".repeat(60));

  const now = new Date();
  const gYear = now.getFullYear();
  // محاسبه سال شمسی (تقریبی)
  const mar21 = new Date(gYear, 2, 21);
  const jYear = now >= mar21 ? gYear - 621 : gYear - 622;

  // تبدیل به اعداد فارسی
  const faGYear = String(gYear).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
  const faJYear = String(jYear).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

  console.log(`سال جاری: ${faJYear} شمسی / ${faGYear} میلادی (${jYear}/${gYear})`);
  console.log("");

  // سال‌های قدیمی برای جایگزینی (هم انگلیسی هم فارسی)
  const oldYearsPatterns: Array<[RegExp, string]> = [
    // فارسی
    [/۱۴۰۳/g, faJYear],
    [/۱۴۰۴/g, faJYear],
    // انگلیسی
    [/\b2024\b/g, String(gYear)],
    [/\b2025\b/g, String(gYear)],
    [/\b1403\b/g, String(jYear)],
    [/\b1404\b/g, String(jYear)],
  ];

  const articles = await db.article.findMany({
    where: { status: "published" },
    select: {
      id: true,
      title: true,
      seoTitle: true,
      seoDescription: true,
      metaKeywords: true,
      content: true,
    },
  });

  console.log(`مقالات منتشرشده: ${articles.length}`);
  console.log("");

  let updated = 0;
  let skipped = 0;

  for (const a of articles) {
    let changed = false;
    let newTitle = a.title;
    let newSeoTitle = a.seoTitle;
    let newSeoDescription = a.seoDescription;
    let newMetaKeywords = a.metaKeywords;
    let newContent = a.content;

    for (const [pattern, replacement] of oldYearsPatterns) {
      if (pattern.test(newTitle)) {
        newTitle = newTitle.replace(pattern, replacement);
        changed = true;
      }
      if (newSeoTitle && pattern.test(newSeoTitle)) {
        newSeoTitle = newSeoTitle.replace(pattern, replacement);
        changed = true;
      }
      if (newSeoDescription && pattern.test(newSeoDescription)) {
        newSeoDescription = newSeoDescription.replace(pattern, replacement);
        changed = true;
      }
      if (newMetaKeywords && pattern.test(newMetaKeywords)) {
        newMetaKeywords = newMetaKeywords.replace(pattern, replacement);
        changed = true;
      }
      if (newContent && pattern.test(newContent)) {
        newContent = newContent.replace(pattern, replacement);
        changed = true;
      }
      // reset lastIndex for global regex
      pattern.lastIndex = 0;
    }

    if (changed) {
      await db.article.update({
        where: { id: a.id },
        data: {
          title: newTitle,
          seoTitle: newSeoTitle,
          seoDescription: newSeoDescription,
          metaKeywords: newMetaKeywords,
          content: newContent,
        },
      });
      console.log(`  ✓ ${a.id.slice(-8)} — بروزرسانی شد`);
      updated++;
    } else {
      skipped++;
    }
  }

  console.log("");
  console.log("━".repeat(60));
  console.log("📊 خلاصه:");
  console.log(`   - کل مقالات: ${articles.length}`);
  console.log(`   - بروزرسانی شد: ${updated}`);
  console.log(`   - بدون تغییر: ${skipped}`);
  console.log("━".repeat(60));
}

main()
  .catch((e) => {
    console.error("❌ خطا:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
