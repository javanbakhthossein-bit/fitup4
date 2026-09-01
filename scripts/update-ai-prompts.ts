/**
 * بروزرسانی پرامپت‌های هوش مصنوعی در دیتابیس با نسخه‌های کامل DEFAULT_*.
 *
 * این اسکریپت باید یک‌بار اجرا شود تا پرامپت‌های کوتاه placeholder
 * با نسخه‌های جامع جایگزین شوند.
 *
 * اجرا: bun run scripts/update-ai-prompts.ts
 */
import { db } from "../src/lib/db";
import {
  DEFAULT_COACH_PROMPT,
  DEFAULT_CHAT_PROMPT,
  DEFAULT_NUTRITION_PROMPT,
  DEFAULT_NIKA_PROMPT,
} from "../src/lib/fitness/ai";

async function main() {
  console.log("━".repeat(60));
  console.log("بروزرسانی پرامپت‌های هوش مصنوعی در دیتابیس");
  console.log("━".repeat(60));

  const updates = [
    { key: "coach_system_prompt", label: "پرامپت مربی (ساخت برنامه تمرینی)", value: DEFAULT_COACH_PROMPT },
    { key: "chat_system_prompt", label: "پرامپت چت هوشمند", value: DEFAULT_CHAT_PROMPT },
    { key: "nutrition_system_prompt", label: "پرامپت برنامه غذایی", value: DEFAULT_NUTRITION_PROMPT },
    { key: "nika_system_prompt", label: "پرامپت نیکا (دستیار فروش)", value: DEFAULT_NIKA_PROMPT },
  ];

  for (const { key, label, value } of updates) {
    await db.aiConfig.upsert({
      where: { key },
      create: { key, label, value },
      update: { value },
    });
    console.log(`  ✓ ${key} — ${value.length} کاراکتر`);
  }

  console.log("\n✅ همه پرامپت‌ها با موفقیت بروزرسانی شدند.");
}

main()
  .catch((e) => {
    console.error("❌ خطا:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
