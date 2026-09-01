/**
 * اسکریپت اصلاح دیتابیس مقالات:
 * ۱. بروزرسانی publishedAt برای مقالاتی که publishedAt = null دارند
 * ۲. تبدیل category انگلیسی به فارسی
 * ۳. مرتب‌سازی مقالات بر اساس publishedAt
 *
 * اجرا: bun run scripts/fix-articles-db.ts
 */
import { db } from "../src/lib/db";

// نقشه انگلیسی → فارسی
const CATEGORY_MAP: Record<string, string> = {
  "training": "تمرین",
  "nutrition": "تغذیه",
  "motivation": "انگیزشی",
  "general": "عمومی",
  "news": "اخبار",
  "supplement": "مکمل",
  "recovery": "بازیابی",
  "exercises": "حرکات",
  "training-methods": "روش‌های-تمرینی",
  "metrics": "اندازه‌گیری",
  "athletes": "ورزشکاران",
  "steroids-education": "آموزش-استروئیدها",
};

async function main() {
  console.log("━".repeat(60));
  console.log("اصلاح دیتابیس مقالات");
  console.log("━".repeat(60));

  // ۱. fix publishedAt
  const articlesWithoutPub = await db.article.findMany({
    where: { status: "published", publishedAt: null },
    select: { id: true, title: true, createdAt: true },
  });
  console.log(`\n۱. مقالات published با publishedAt = null: ${articlesWithoutPub.length}`);
  for (const a of articlesWithoutPub) {
    await db.article.update({
      where: { id: a.id },
      data: { publishedAt: a.createdAt },
    });
    console.log(`  ✓ publishedAt set: ${a.title.slice(0, 40)}`);
  }

  // ۲. convert category to Persian
  const allArticles = await db.article.findMany({
    select: { id: true, title: true, category: true },
  });
  console.log(`\n۲. تبدیل category انگلیسی به فارسی:`);
  let catUpdated = 0;
  for (const a of allArticles) {
    const persianCat = CATEGORY_MAP[a.category];
    if (persianCat) {
      await db.article.update({
        where: { id: a.id },
        data: { category: persianCat },
      });
      console.log(`  ✓ ${a.category} → ${persianCat} | ${a.title.slice(0, 30)}`);
      catUpdated++;
    }
  }
  console.log(`  ${catUpdated} مقاله بروزرسانی شد.`);

  // ۳. verify order
  const finalArticles = await db.article.findMany({
    where: { status: "published" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { title: true, publishedAt: true, category: true },
  });
  console.log(`\n۳. ترتیب نهایی مقالات منتشرشده:`);
  for (let i = 0; i < finalArticles.length; i++) {
    const a = finalArticles[i];
    const date = a.publishedAt ? new Date(a.publishedAt).toISOString().split("T")[0] : "NULL";
    console.log(`  ${i + 1}. ${date} | ${a.category.padEnd(10)} | ${a.title.slice(0, 35)}`);
  }
  console.log(`\nTotal: ${finalArticles.length}`);

  // ۴. check categories
  const cats = [...new Set(finalArticles.map(a => a.category))];
  console.log(`\n۴. دسته‌بندی‌های نهایی: ${cats.join(", ")}`);
}

main()
  .catch((e) => { console.error("❌ خطا:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
