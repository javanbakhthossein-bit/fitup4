/**
 * Backfill `publishedAt` برای مقالات موجود.
 *
 * این اسکریپت یک‌بار اجرا می‌شود تا مقالاتی که قبل از اضافه شدن فیلد `publishedAt`
 * منتشر شده‌اند، تاریخ انتشار درستی بگیرند.
 *
 * منطق:
 *  - اگر مقاله published است و publishedAt ندارد → publishedAt = createdAt (به‌عنوان fallback منطقی)
 *  - اگر مقاله draft است → publishedAt را دست نمی‌زنیم (null می‌ماند)
 *  - اگر مقاله publishedAt دارد → تغییر نمی‌دهد
 *
 * اجرا: bun run scripts/backfill-published-at.ts
 */
import { db } from "../src/lib/db";

async function main() {
  console.log("━".repeat(60));
  console.log("Backfill publishedAt برای مقالات موجود");
  console.log("━".repeat(60));

  // تمام مقالات منتشرشده‌ای که publishedAt ندارند
  const publishedWithoutDate = await db.article.findMany({
    where: {
      status: "published",
      publishedAt: null,
    },
    select: { id: true, title: true, slug: true, createdAt: true },
  });

  console.log(`\nمقالات منتشرشده بدون publishedAt: ${publishedWithoutDate.length}`);

  if (publishedWithoutDate.length === 0) {
    console.log("✅ همه مقالات publishedAt دارند. کاری نیست.");
    return;
  }

  console.log("\nدر حال بروزرسانی...\n");
  let updated = 0;
  for (const a of publishedWithoutDate) {
    await db.article.update({
      where: { id: a.id },
      data: { publishedAt: a.createdAt },
    });
    console.log(`  ✓ ${a.slug} — publishedAt = ${a.createdAt.toISOString().split("T")[0]}`);
    updated++;
  }

  console.log(`\n✅ ${updated} مقاله بروزرسانی شد.`);

  // گزارش نهایی
  const totalPublished = await db.article.count({ where: { status: "published" } });
  const totalWithDate = await db.article.count({
    where: { status: "published", publishedAt: { not: null } },
  });
  console.log(`\n📊 خلاصه:`);
  console.log(`   - کل مقالات منتشرشده: ${totalPublished}`);
  console.log(`   - با publishedAt: ${totalWithDate}`);
  console.log(`   - بدون publishedAt: ${totalPublished - totalWithDate}`);
}

main()
  .catch((e) => {
    console.error("❌ خطا:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
