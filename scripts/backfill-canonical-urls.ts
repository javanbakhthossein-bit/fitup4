/**
 * بک‌فیلت canonicalUrl برای همه مقالات منتشرشده.
 *
 * همه مقالات canonicalUrl = "" دارند که باعث می‌شود Google آن‌ها را duplicate
 * تشخیص دهد. این اسکریپت canonicalUrl را برای هر مقاله set می‌کند:
 *   canonicalUrl = https://fittup.ir/?article=<slug>
 *
 * اجرا: bun run scripts/backfill-canonical-urls.ts
 */
import { db } from "../src/lib/db";

async function main() {
  console.log("━".repeat(60));
  console.log("بک‌فیلت canonicalUrl برای مقالات");
  console.log("━".repeat(60));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";

  const articles = await db.article.findMany({
    where: { canonicalUrl: "" },
    select: { id: true, slug: true, title: true, status: true },
  });

  console.log(`\nمقالات با canonicalUrl خالی: ${articles.length}`);

  if (articles.length === 0) {
    console.log("✅ همه مقالات canonicalUrl دارند. کاری نیست.");
    return;
  }

  console.log("\nدر حال بروزرسانی...\n");
  let updated = 0;
  for (const a of articles) {
    const canonical = `${siteUrl}/?article=${a.slug}`;
    await db.article.update({
      where: { id: a.id },
      data: { canonicalUrl: canonical },
    });
    console.log(`  ✓ ${a.slug} → ${canonical}`);
    updated++;
  }

  console.log(`\n✅ ${updated} مقاله بروزرسانی شد.`);

  // گزارش نهایی
  const withCanonical = await db.article.count({
    where: { canonicalUrl: { not: "" } },
  });
  const total = await db.article.count();
  console.log(`\n📊 خلاصه:`);
  console.log(`   - کل مقالات: ${total}`);
  console.log(`   - با canonicalUrl: ${withCanonical}`);
  console.log(`   - بدون canonicalUrl: ${total - withCanonical}`);
}

main()
  .catch((e) => {
    console.error("❌ خطا:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
