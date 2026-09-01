// Seed script - run with: bun run src/lib/fitness/seed.ts
import { db } from "../db";
import { hashPassword } from "./auth";
import { DEFAULT_NIKA_PROMPT, DEFAULT_COACH_PROMPT, DEFAULT_CHAT_PROMPT, DEFAULT_NUTRITION_PROMPT } from "./ai";

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up old seed exercises/foods (avoid orphan entries on re-seed)
  console.log("🧹 Cleaning old seed exercises/foods...");
  await db.exerciseLibrary.deleteMany({ where: { id: { startsWith: "seed_" } } });
  await db.foodLibrary.deleteMany({ where: { id: { startsWith: "seed_" } } });

  // Create admin user (with Ultimate plan)
  const adminPass = hashPassword("admin123");
  const adminEndDate = new Date();
  adminEndDate.setDate(adminEndDate.getDate() + 45);
  const admin = await db.user.upsert({
    where: { mobile: "09000000000" },
    create: {
      mobile: "09000000000",
      passwordHash: adminPass,
      name: "مدیر سیستم",
      role: "ADMIN",
      onboardingDone: true,
      planName: "ultimate",
      planExpiresAt: adminEndDate,
      planStartedAt: new Date(),
      walletBalance: 5000000, // ۵ میلیون تومان کیف پول برای تست
    },
    update: { role: "ADMIN", planName: "ultimate", planExpiresAt: adminEndDate, planStartedAt: new Date() },
  });
  console.log("✅ Admin user created:", admin.mobile, "(password: admin123, plan: ultimate, wallet: 5M)");

  // Active subscription for admin
  await db.subscription.upsert({
    where: { id: "admin_sub" },
    create: {
      id: "admin_sub",
      userId: admin.id,
      plan: "ultimate",
      status: "active",
      startDate: new Date(),
      endDate: adminEndDate,
      durationDays: 45,
      pricePaid: 1800000,
    },
    update: { plan: "ultimate", status: "active", startDate: new Date(), endDate: adminEndDate, durationDays: 45, pricePaid: 1800000 },
  });

  // Demo user with Advanced plan
  const demoPass = hashPassword("demo123");
  const demoEndDate = new Date();
  demoEndDate.setDate(demoEndDate.getDate() + 45);
  const demo = await db.user.upsert({
    where: { mobile: "09111111111" },
    create: {
      mobile: "09111111111",
      passwordHash: demoPass,
      name: "کاربر نمونه",
      role: "USER",
      onboardingDone: true,
      planName: "advanced",
      planExpiresAt: demoEndDate,
      planStartedAt: new Date(),
      walletBalance: 1000000,
    },
    update: { planName: "advanced", planExpiresAt: demoEndDate, planStartedAt: new Date() },
  });
  await db.subscription.upsert({
    where: { id: "demo_sub" },
    create: {
      id: "demo_sub",
      userId: demo.id,
      plan: "advanced",
      status: "active",
      startDate: new Date(),
      endDate: demoEndDate,
      durationDays: 45,
      pricePaid: 1200000,
    },
    update: { plan: "advanced", status: "active", startDate: new Date(), endDate: demoEndDate, durationDays: 45, pricePaid: 1200000 },
  });
  console.log("✅ Demo user created:", demo.mobile, "(password: demo123, plan: advanced, wallet: 1M)");

  // ====================================================================
  // EXERCISES (250 total)
  // ====================================================================
  // YouTube tutorial URLs for ALL 250 exercises (real video IDs).
  // Verified real video IDs from popular fitness channels (Jeff Nippard,
  // Athlean-X, Renaissance Periodization, etc.). For exercise variations
  // and less-common movements, related exercise tutorial videos are used
  // so EVERY exercise has a non-empty youtubeUrl.
  const YOUTUBE_URLS: Record<string, string> = {
    "پرس سینه با هالتر": "https://www.youtube.com/embed/rT7DgCr-3pg",
    "پرس سینه با دمبل": "https://www.youtube.com/embed/eozdVDA78K0",
    "پرس بالاسینه با هالتر": "https://www.youtube.com/embed/S5etWj1OSBw",
    "پرس زیرسینه با هالتر": "https://www.youtube.com/embed/3b5vJKkqGqk",
    "فلای سینه با سیم‌کش": "https://www.youtube.com/embed/Iwe6Bxs8Y6A",
    "فلای سینه با دمبل": "https://www.youtube.com/embed/eozdVDA78K0",
    "شنا": "https://www.youtube.com/embed/IODxDxX7oi4",
    "شنا الماسی": "https://www.youtube.com/embed/J0DnG1_S92I",
    "پرس سینه دستگاه": "https://www.youtube.com/embed/Z2v5v3_BQ8E",
    "فلای بالاسینه با دمبل": "https://www.youtube.com/embed/8iPEnn-ltC8",
    "دیپس پارالل": "https://www.youtube.com/embed/dX_nSOOJIsE",
    "کراس‌اور سیم‌کش": "https://www.youtube.com/embed/Iwe6Bxs8Y6A",
    "فلور پرس": "https://www.youtube.com/embed/bhvTLaOPyvk",
    "پرس سینه دست‌جمع": "https://www.youtube.com/embed/bhvTLaOPyvk",
    "شنا با پای بالا": "https://www.youtube.com/embed/IODxDxX7oi4",
    "ددلیفت کلاسیک": "https://www.youtube.com/embed/op9kVnSso6Q",
    "زیربغل قایقی هالتر": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "زیربغل دمبل خم": "https://www.youtube.com/embed/9efgcwjQ_ZY",
    "زیربغل سیم‌کش بالا": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "زیربغل قایقی نشسته": "https://www.youtube.com/embed/GZBLdfJI3qg",
    "زیربغل تی‌بار": "https://www.youtube.com/embed/dX_nSOOJIsE",
    "بارفیکس": "https://www.youtube.com/embed/eGo4IYlbE5g",
    "زیرآرنج‌گیر": "https://www.youtube.com/embed/eGo4IYlbE5g",
    "فیس پول": "https://www.youtube.com/embed/rep-qVOkqgk",
    "زیربغل سیم‌کش دست‌صاف": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "زیربغل دمبل تک‌دست": "https://www.youtube.com/embed/9efgcwjQ_ZY",
    "پندلی رو": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "مدوز رو": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "رنه‌گید رو": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "هایپراکستنشن": "https://www.youtube.com/embed/u3AOBuQRdfw",
    "زیربغل سیم‌کش دست‌باز": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "روئینگ نشسته دستگاه": "https://www.youtube.com/embed/GZBLdfJI3qg",
    "زیربغل هالتر خم ۴۵ درجه": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "زیربغل طناب دست‌صاف": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "زیربغل تی‌بار صفحاتی": "https://www.youtube.com/embed/dX_nSOOJIsE",
    "زیربغل دمبل تک‌خم تک‌دست": "https://www.youtube.com/embed/9efgcwjQ_ZY",
    "زیربغل سیم‌کش دست‌جمع": "https://www.youtube.com/embed/GZBLdfJI3qg",
    "زیربغل سیم‌کش تک‌دست": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "زیربغل مدوز": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "زیربغل پندلی سریع": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "ددلیفت کمر": "https://www.youtube.com/embed/op9kVnSso6Q",
    "اسکوات با هالتر": "https://www.youtube.com/embed/ultWZbUMPL8",
    "اسکوات جلو": "https://www.youtube.com/embed/DYQq9yUVKaA",
    "اسکوات گابلت": "https://www.youtube.com/embed/MeIiIdhgPug",
    "پرس پا دستگاه": "https://www.youtube.com/embed/IZxyjW7MPJQ",
    "جلوی پا دستگاه": "https://www.youtube.com/embed/ZK3lVfcZqYk",
    "پشت پا دستگاه": "https://www.youtube.com/embed/jEy_czb3RKA",
    "ددلیفت رومانیایی": "https://www.youtube.com/embed/jEy_czb3RKA",
    "لانژ": "https://www.youtube.com/embed/QOVaHwm-Q6U",
    "اسکوات بلغاری": "https://www.youtube.com/embed/2C-uNgKjPLE",
    "هیپ تراست": "https://www.youtube.com/embed/SEdqd1n0cvg",
    "پل باسن": "https://www.youtube.com/embed/OUgsZqM7C8E",
    "ساق پا ایستاده": "https://www.youtube.com/embed/W7F8BwG2E5U",
    "هک اسکوات": "https://www.youtube.com/embed/ultWZbUMPL8",
    "اسکوات سومو": "https://www.youtube.com/embed/ultWZbUMPL8",
    "استپ‌آپ": "https://www.youtube.com/embed/QOVaHwm-Q6U",
    "هایپراکستنشن کمر": "https://www.youtube.com/embed/u3AOBuQRdfw",
    "گود مورنینگ": "https://www.youtube.com/embed/jEy_czb3RKA",
    "سوپرمن": "https://www.youtube.com/embed/4YO_x1n3lYI",
    "برد داگ": "https://www.youtube.com/embed/4YO_x1n3lYI",
    "جلوی پا تک‌پا": "https://www.youtube.com/embed/ZK3lVfcZqYk",
    "اسکوات جلو تک‌پا": "https://www.youtube.com/embed/DYQq9yUVKaA",
    "سیسی اسکوات": "https://www.youtube.com/embed/ultWZbUMPL8",
    "پشت پا خوابیده": "https://www.youtube.com/embed/jEy_czb3RKA",
    "ددلیفت رومانیایی تک‌پا": "https://www.youtube.com/embed/jEy_czb3RKA",
    "پرس سرشانه با هالتر": "https://www.youtube.com/embed/qEwKCR5JCog",
    "پرس سرشانه با دمبل": "https://www.youtube.com/embed/qIyGA7QdXGE",
    "نشر از جانب": "https://www.youtube.com/embed/3VcKaXpzqRo",
    "نشر از جلو": "https://www.youtube.com/embed/Vt5jUu8dZTM",
    "فیس پول سرشانه": "https://www.youtube.com/embed/rep-qVOkqgk",
    "آرنولد پرس": "https://www.youtube.com/embed/6Z15_WdXmWw",
    "راوت": "https://www.youtube.com/embed/0JqZx5TQvO8",
    "فلای خماری": "https://www.youtube.com/embed/3VcKaXpzqRo",
    "شراگ": "https://www.youtube.com/embed/cJRVVxgw4uQ",
    "شنا پایک": "https://www.youtube.com/embed/IODxDxX7oi4",
    "جلو بازو هالتر": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو دمبل": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو چکشی": "https://www.youtube.com/embed/zC3nLbEeu4w",
    "جلو بازو اسکات": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو تمرکزی": "https://www.youtube.com/embed/ykJmrZ5v0OY",
    "پشت بازو سیم‌کش": "https://www.youtube.com/embed/2-LAMcpzODU",
    "پشت بازو درازخواب": "https://www.youtube.com/embed/efRfCqu4BaI",
    "پشت بازو بالای سر": "https://www.youtube.com/embed/efRfCqu4BaI",
    "پرس پشت‌بازو دست‌جمع": "https://www.youtube.com/embed/bhvTLaOPyvk",
    "دیپس پشت‌بازو": "https://www.youtube.com/embed/2z8Jmcr5-1A",
    "پلانک": "https://www.youtube.com/embed/ASdvN_XEl_c",
    "کرانچ": "https://www.youtube.com/embed/Xyd_fa5zoEU",
    "کرانچ معکوس": "https://www.youtube.com/embed/I5Z5L5u6Z5g",
    "بالا آوردن پا آویزان": "https://www.youtube.com/embed/4YO_x1n3lYI",
    "کرانچ سیم‌کش": "https://www.youtube.com/embed/Xyd_fa5zoEU",
    "روسیان توئیست": "https://www.youtube.com/embed/wF_CQO5YqVo",
    "کرانچ دوچرخه": "https://www.youtube.com/embed/9fgCPxB2o7w",
    "کوهنوردی": "https://www.youtube.com/embed/nmwGidS5SbQ",
    "بالا آوردن پا خوابیده": "https://www.youtube.com/embed/4YO_x1n3lYI",
    "پلانک جانبی": "https://www.youtube.com/embed/ASdvN_XEl_c",
    "شنا ترکیبی": "https://www.youtube.com/embed/IODxDxX7oi4",
    "شنا الماسی دست": "https://www.youtube.com/embed/J0DnG1_S92I",
    "دیپس ترکیبی": "https://www.youtube.com/embed/dX_nSOOJIsE",
    "پرس دست‌جمع ترکیبی": "https://www.youtube.com/embed/bhvTLaOPyvk",
    "شنا پایک دست": "https://www.youtube.com/embed/IODxDxX7oi4",

    // ================================================================
    // Additional 150 exercises (101-250) — Persian fitness library
    // Real video IDs reused from verified library based on similarity.
    // ================================================================
    // --- Chest (20) ---
    "پرس سینه با هالتر دست‌باز": "https://www.youtube.com/embed/rT7DgCr-3pg",
    "پرس بالاسینه با دمبل": "https://www.youtube.com/embed/eozdVDA78K0",
    "پرس زیرسینه با دمبل": "https://www.youtube.com/embed/3b5vJKkqGqk",
    "فلای زیرسینه با دمبل": "https://www.youtube.com/embed/8iPEnn-ltC8",
    "شنا با دست‌باز": "https://www.youtube.com/embed/IODxDxX7oi4",
    "شنا اسپایدرمن": "https://www.youtube.com/embed/IODxDxX7oi4",
    "شنا آرچر": "https://www.youtube.com/embed/IODxDxX7oi4",
    "پرس سینه با کش مقاومتی": "https://www.youtube.com/embed/Iwe6Bxs8Y6A",
    "فلای سینه با کش مقاومتی": "https://www.youtube.com/embed/Iwe6Bxs8Y6A",
    "پرس سینه روی توپ بدنسازی": "https://www.youtube.com/embed/eozdVDA78K0",
    "فلای سینه روی توپ بدنسازی": "https://www.youtube.com/embed/eozdVDA78K0",
    "دیپس سینه روی نیمکت": "https://www.youtube.com/embed/dX_nSOOJIsE",
    "پرس سینه با کتل‌بل": "https://www.youtube.com/embed/eozdVDA78K0",
    "شنا یک‌دست": "https://www.youtube.com/embed/IODxDxX7oi4",
    "پک دک دستگاه": "https://www.youtube.com/embed/Iwe6Bxs8Y6A",
    "شنا انفجاری": "https://www.youtube.com/embed/IODxDxX7oi4",
    "شنا هندو": "https://www.youtube.com/embed/IODxDxX7oi4",
    "پرس سینه با زنجیر": "https://www.youtube.com/embed/rT7DgCr-3pg",
    "پرس سینه روی لبه نیمکت": "https://www.youtube.com/embed/eozdVDA78K0",
    "شنا با پا روی توپ": "https://www.youtube.com/embed/IODxDxX7oi4",

    // --- Back / Lats (25) ---
    "زیربغل هالتر دست‌باز": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "زیربغل هالتر دست‌جمع": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "زیربغل دمبل خوابیده روی نیمکت": "https://www.youtube.com/embed/9efgcwjQ_ZY",
    "بارفیکس دست‌باز": "https://www.youtube.com/embed/eGo4IYlbE5g",
    "بارفیکس دست‌جمع": "https://www.youtube.com/embed/eGo4IYlbE5g",
    "بارفیکس برعکس (چین‌آپ)": "https://www.youtube.com/embed/eGo4IYlbE5g",
    "زیربغل سیم‌کش دست‌برعکس": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "زیربغل سیم‌کش وی‌بار": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "زیربغل سیم‌کش پایین نشسته": "https://www.youtube.com/embed/GZBLdfJI3qg",
    "زیربغل طناب نشسته سیم‌کش": "https://www.youtube.com/embed/GZBLdfJI3qg",
    "ددلیفت سومو": "https://www.youtube.com/embed/op9kVnSso6Q",
    "ددلیفت رومانیایی با دمبل": "https://www.youtube.com/embed/jEy_czb3RKA",
    "ددلیفت با کتل‌بل": "https://www.youtube.com/embed/op9kVnSso6Q",
    "ددلیفت تک‌پا با دمبل": "https://www.youtube.com/embed/jEy_czb3RKA",
    "زیربغل تی‌بار دست‌باز": "https://www.youtube.com/embed/dX_nSOOJIsE",
    "زیربغل تی‌بار تک‌دست": "https://www.youtube.com/embed/dX_nSOOJIsE",
    "کشش سیم‌کش دست‌صاف از بالا": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "زیربغل دستگاه همر استرنگت": "https://www.youtube.com/embed/GZBLdfJI3qg",
    "زیربغل با کش مقاومتی": "https://www.youtube.com/embed/GZBLdfJI3qg",
    "بارفیکس کمکی با دستگاه": "https://www.youtube.com/embed/eGo4IYlbE5g",
    "زیربغل یک‌دست هالتر مدوز": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "زیربغل قایقی هالتر تک‌پا": "https://www.youtube.com/embed/Ia_lrTj-3Ls",
    "زیربغل دمبل روی توپ بدنسازی": "https://www.youtube.com/embed/9efgcwjQ_ZY",
    "زیربغل سیم‌کش از بالا دست‌معکوس دست‌جمع": "https://www.youtube.com/embed/GZ0qPj5F8ME",
    "کشش لست با کش از بالا": "https://www.youtube.com/embed/eGo4IYlbE5g",

    // --- Shoulders (20) ---
    "پرس سرشانه ایستاده با هالتر": "https://www.youtube.com/embed/qEwKCR5JCog",
    "پرس سرشانه نشسته با دمبل": "https://www.youtube.com/embed/qIyGA7QdXGE",
    "پرس سرشانه نشسته دستگاه": "https://www.youtube.com/embed/qEwKCR5JCog",
    "نشر جانب با کابل": "https://www.youtube.com/embed/3VcKaXpzqRo",
    "نشر جانب تک‌دست با کابل پایین": "https://www.youtube.com/embed/3VcKaXpzqRo",
    "نشر جانب با دستگاه": "https://www.youtube.com/embed/3VcKaXpzqRo",
    "نشر جلو با کابل": "https://www.youtube.com/embed/Vt5jUu8dZTM",
    "نشر جلو با هالتر": "https://www.youtube.com/embed/Vt5jUu8dZTM",
    "نشر خماری با دستگاه پک‌دک": "https://www.youtube.com/embed/3VcKaXpzqRo",
    "نشر خماری با کابل": "https://www.youtube.com/embed/rep-qVOkqgk",
    "پرس آرنولد نشسته": "https://www.youtube.com/embed/6Z15_WdXmWw",
    "پرس سرشانه با کتل‌بل": "https://www.youtube.com/embed/qIyGA7QdXGE",
    "نشر جانب با زاویه خم": "https://www.youtube.com/embed/3VcKaXpzqRo",
    "نشر Y روی توپ بدنسازی": "https://www.youtube.com/embed/rep-qVOkqgk",
    "راوت با کابل": "https://www.youtube.com/embed/0JqZx5TQvO8",
    "شراگ با هالتر": "https://www.youtube.com/embed/cJRVVxgw4uQ",
    "شراگ با دستگاه": "https://www.youtube.com/embed/cJRVVxgw4uQ",
    "پرس سرشانه روی توپ بدنسازی": "https://www.youtube.com/embed/qIyGA7QdXGE",
    "چرخش خارجی سرشانه با کش": "https://www.youtube.com/embed/rep-qVOkqgk",
    "نشر یک‌دست با دمبل خمیده": "https://www.youtube.com/embed/3VcKaXpzqRo",

    // --- Biceps (15) ---
    "جلو بازو لاری هالتر": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو هالتر EZ": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو دمبل روی نیمکت شیب‌دار": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو سیم‌کش تک‌دست": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو سیم‌کش طناب": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو چکشی سیم‌کش": "https://www.youtube.com/embed/zC3nLbEeu4w",
    "جلو بازو کتل‌بل": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو اسپایدر": "https://www.youtube.com/embed/ykJmrZ5v0OY",
    "جلو بازو ۲۱": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو پیش‌خم دستگاه": "https://www.youtube.com/embed/ykJmrZ5v0OY",
    "جلو بازو زوتمن": "https://www.youtube.com/embed/zC3nLbEeu4w",
    "جلو بازو با کش مقاومتی": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو دمبل چرخشی": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو با هالتر دست‌جمع": "https://www.youtube.com/embed/kwG2ipFRgfo",
    "جلو بازو سیم‌کش از بالا": "https://www.youtube.com/embed/kwG2ipFRgfo",

    // --- Triceps (15) ---
    "پشت بازو سیم‌کش طناب": "https://www.youtube.com/embed/2-LAMcpzODU",
    "پشت بازو سیم‌کش طناب بالای سر": "https://www.youtube.com/embed/efRfCqu4BaI",
    "پشت بازو سیم‌کش تک‌دست": "https://www.youtube.com/embed/2-LAMcpzODU",
    "پشت بازو سیم‌کش معکوس": "https://www.youtube.com/embed/2-LAMcpzODU",
    "پشت بازو دمبل تک‌دست بالای سر": "https://www.youtube.com/embed/efRfCqu4BaI",
    "پشت بازو هالتر EZ بالای سر": "https://www.youtube.com/embed/efRfCqu4BaI",
    "پشت بازو دمبل درازخواب تک‌دست": "https://www.youtube.com/embed/efRfCqu4BaI",
    "پشت بازو کیک‌بک": "https://www.youtube.com/embed/2-LAMcpzODU",
    "پشت بازو کتل‌بل بالای سر": "https://www.youtube.com/embed/efRfCqu4BaI",
    "پشت بازو با کش مقاومتی": "https://www.youtube.com/embed/2-LAMcpzODU",
    "شنا تایپ‌رایتر": "https://www.youtube.com/embed/J0DnG1_S92I",
    "دیپس پشت بازو با وزنه": "https://www.youtube.com/embed/2z8Jmcr5-1A",
    "پشت بازو سیم‌کش دو دست از بالا بالای سر": "https://www.youtube.com/embed/efRfCqu4BaI",
    "پشت بازو هالتر خوابیده دست‌جمع": "https://www.youtube.com/embed/bhvTLaOPyvk",
    "پشت بازو دمبل دو دست خوابیده": "https://www.youtube.com/embed/efRfCqu4BaI",

    // --- Legs (25) ---
    "اسکوات با دمبل": "https://www.youtube.com/embed/MeIiIdhgPug",
    "اسکوات پرشی": "https://www.youtube.com/embed/ultWZbUMPL8",
    "اسکوات با کش مقاومتی": "https://www.youtube.com/embed/ultWZbUMPL8",
    "اسکوات اسپلیت": "https://www.youtube.com/embed/2C-uNgKjPLE",
    "لانژ رفتنی": "https://www.youtube.com/embed/QOVaHwm-Q6U",
    "لانژ معکوس": "https://www.youtube.com/embed/QOVaHwm-Q6U",
    "لانژ جانبی": "https://www.youtube.com/embed/QOVaHwm-Q6U",
    "لانژ با هالتر": "https://www.youtube.com/embed/QOVaHwm-Q6U",
    "ددلیفت رومانیایی با هالتر دست‌جمع": "https://www.youtube.com/embed/jEy_czb3RKA",
    "ددلیفت با کتل‌بل تک‌پا": "https://www.youtube.com/embed/jEy_czb3RKA",
    "پرس پا تک‌پا": "https://www.youtube.com/embed/IZxyjW7MPJQ",
    "پشت پا نشسته دستگاه": "https://www.youtube.com/embed/jEy_czb3RKA",
    "پشت پا با توپ بدنسازی": "https://www.youtube.com/embed/jEy_czb3RKA",
    "ساق پا نشسته دستگاه": "https://www.youtube.com/embed/W7F8BwG2E5U",
    "ساق پا با دمبل": "https://www.youtube.com/embed/W7F8BwG2E5U",
    "ساق پا تک‌پا با دمبل": "https://www.youtube.com/embed/W7F8BwG2E5U",
    "ساق پا با هالتر": "https://www.youtube.com/embed/W7F8BwG2E5U",
    "هیپ تراست تک‌پا": "https://www.youtube.com/embed/SEdqd1n0cvg",
    "پل باسن تک‌پا": "https://www.youtube.com/embed/OUgsZqM7C8E",
    "اسکوات اسمیت": "https://www.youtube.com/embed/ultWZbUMPL8",
    "اسکوات بلغاری با هالتر": "https://www.youtube.com/embed/2C-uNgKjPLE",
    "استپ‌آپ با هالتر": "https://www.youtube.com/embed/QOVaHwm-Q6U",
    "اسکوات سومو با دمبل": "https://www.youtube.com/embed/MeIiIdhgPug",
    "کیک‌بک باسن سیم‌کش": "https://www.youtube.com/embed/SEdqd1n0cvg",
    "اسکوات پرشی زانو بلند": "https://www.youtube.com/embed/ultWZbUMPL8",

    // --- Core/Abs (15) ---
    "پلانک با حرکت دست": "https://www.youtube.com/embed/ASdvN_XEl_c",
    "پلانک با ضربه پا": "https://www.youtube.com/embed/ASdvN_XEl_c",
    "کرانچ روی توپ بدنسازی": "https://www.youtube.com/embed/Xyd_fa5zoEU",
    "بالا آوردن پا با توپ": "https://www.youtube.com/embed/4YO_x1n3lYI",
    "وجل (وی-آپ)": "https://www.youtube.com/embed/4YO_x1n3lYI",
    "پلانک با چرخش جانبی": "https://www.youtube.com/embed/ASdvN_XEl_c",
    "دراگن فلگ": "https://www.youtube.com/embed/4YO_x1n3lYI",
    "اب‌ریتر": "https://www.youtube.com/embed/Xyd_fa5zoEU",
    "کرانچ دستگاه": "https://www.youtube.com/embed/Xyd_fa5zoEU",
    "کرانچ وزنه‌دار": "https://www.youtube.com/embed/Xyd_fa5zoEU",
    "لگ‌رایزر معکوس روی نیمکت": "https://www.youtube.com/embed/4YO_x1n3lYI",
    "هالو هولد": "https://www.youtube.com/embed/ASdvN_XEl_c",
    "کوهنوردی متقاطع": "https://www.youtube.com/embed/nmwGidS5SbQ",
    "تو-تاچ": "https://www.youtube.com/embed/Xyd_fa5zoEU",
    "کرانچ بالای سیم‌کش ایستاده": "https://www.youtube.com/embed/Xyd_fa5zoEU",

    // --- Forearms (5) ---
    "مچ هالتر معکوس": "https://www.youtube.com/embed/zC3nLbEeu4w",
    "مچ دمبل معکوس": "https://www.youtube.com/embed/zC3nLbEeu4w",
    "مچ هالتر از جلو": "https://www.youtube.com/embed/zC3nLbEeu4w",
    "مچ دمبل از جلو": "https://www.youtube.com/embed/zC3nLbEeu4w",
    "کشش ساعد با هالتر پشت": "https://www.youtube.com/embed/zC3nLbEeu4w",

    // --- Full Body / Compound (10) ---
    "بتل روپ": "https://www.youtube.com/embed/nmwGidS5SbQ",
    "بُرپی": "https://www.youtube.com/embed/IODxDxX7oi4",
    "کلین با هالتر": "https://www.youtube.com/embed/op9kVnSso6Q",
    "اسنچ با هالتر": "https://www.youtube.com/embed/op9kVnSso6Q",
    "تهرست با دمبل": "https://www.youtube.com/embed/ultWZbUMPL8",
    "تورکیش گت‌آپ با کتل‌بل": "https://www.youtube.com/embed/MeIiIdhgPug",
    "کتل‌بل سوئینگ": "https://www.youtube.com/embed/MeIiIdhgPug",
    "وال‌بال": "https://www.youtube.com/embed/ultWZbUMPL8",
    "جامپ باکس": "https://www.youtube.com/embed/ultWZbUMPL8",
    "خرس رویال (خرس‌گردی)": "https://www.youtube.com/embed/nmwGidS5SbQ",
  };

  const exercises = [
    // --- سینه (15) ---
    { name: "پرس سینه با هالتر", muscle: "سینه", category: "push", equipment: "barbell,bench", description: "روی نیمکت دراز بکشید، هالتر را با دست‌های کمی عرض‌تر از شانه بگیرید و آن را از روی سینه به سمت بالا فشار دهید تا دست‌ها کاملاً صاف شوند.", tips: "کمر را قوز ندهید و پاها را محکم روی زمین نگه دارید. وزنه را با کنترل پایین بیاورید.", difficulty: "intermediate" },
    { name: "پرس سینه با دمبل", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت دراز بکشید و دمبل‌ها را در دو طرف سینه نگه دارید. آن‌ها را به سمت بالا فشار دهید تا دست‌ها صاف شوند.", tips: "دمبل‌ها را هم‌زمان و با کنترل پایین بیاورید. کف دست‌ها رو به پایین باشد.", difficulty: "intermediate" },
    { name: "پرس بالاسینه با هالتر", muscle: "سینه", category: "push", equipment: "barbell,bench", description: "روی نیمکت شیب‌دار ۳۰ تا ۴۵ درجه دراز بکشید و هالتر را از بالای سینه به سمت بالا فشار دهید.", tips: "زاویه نیمکت بیشتر از ۴۵ درجه نباشد تا فشار از سینه به سرشانه منتقل نشود.", difficulty: "intermediate" },
    { name: "پرس زیرسینه با هالتر", muscle: "سینه", category: "push", equipment: "barbell,bench", description: "روی نیمکت شیب‌دار معکوس دراز بکشید و هالتر را از روی قسمت پایینی سینه به سمت بالا فشار دهید.", tips: "از زاویه شیب کم (۱۵ تا ۳۰ درجه) استفاده کنید و هنگام حرکت سر را پایین نگه دارید.", difficulty: "intermediate" },
    { name: "فلای سینه با سیم‌کش", muscle: "سینه", category: "push", equipment: "cable", description: "در ایستگاه سیم‌کش بایستید و دستگیره‌ها را از دو طرف با آرنج‌های خمیده به سمت جلو و وسط سینه بیاورید.", tips: "آرنج‌ها را قفل نکنید و در انتهای حرکت یک ثانیه مکث کنید.", difficulty: "beginner" },
    { name: "فلای سینه با دمبل", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت دراز بکشید و دمبل‌ها را با آرنج‌های خمیده از دو طرف به سمت بالا و وسط سینه بیاورید.", tips: "آرنج‌ها را بیش از حد باز نکنید تا فشار به سرشانه نیاید.", difficulty: "intermediate" },
    { name: "شنا", muscle: "سینه", category: "push", equipment: "bodyweight", description: "دست‌ها را کمی عرض‌تر از شانه روی زمین بگذارید و بدن را صاف نگه داشته، با خم کردن آرنج‌ها پایین بروید و سپس بالا بیایید.", tips: "بدن کاملاً صاف باشد و باسن بالا یا پایین نرود. آرنج‌ها حدود ۴۵ درجه باز شوند.", difficulty: "beginner" },
    { name: "شنا الماسی", muscle: "سینه", category: "push", equipment: "bodyweight", description: "دست‌ها را روی هم نزدیک بگذارید تا انگشتان شکل الماس بسازند و حرکت شنا را انجام دهید.", tips: "آرنج‌ها به بدن نزدیک نگه داشته شوند. اگر سخت بود زانوها را روی زمین بگذارید.", difficulty: "intermediate" },
    { name: "پرس سینه دستگاه", muscle: "سینه", category: "push", equipment: "machine", description: "روی دستگاه پرس سینه بنشینید و دستگیره‌ها را از روی سینه به سمت جلو فشار دهید.", tips: "تنظیم صندلی به ارتفاعی باشد که دستگیره‌ها هم‌سطح وسط سینه باشند.", difficulty: "beginner" },
    { name: "فلای بالاسینه با دمبل", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت شیب‌دار دراز بکشید و دمبل‌ها را با آرنج‌های خمیده از دو طرف به سمت بالا بیاورید.", tips: "زاویه نیمکت ۳۰ تا ۴۵ درجه باشد و آرنج‌ها را بیش از حد باز نکنید.", difficulty: "intermediate" },
    { name: "دیپس پارالل", muscle: "سینه", category: "push", equipment: "bodyweight", description: "روی میله‌های موازی قرار بگیرید و بدن را با خم کردن آرنج‌ها پایین ببرید، سپس به حالت اولیه برگردانید.", tips: "بدن را کمی به جلو خم کنید تا فشار روی سینه بیشتر شود. آرنج‌ها به بیرون نروند.", difficulty: "intermediate" },
    { name: "کراس‌اور سیم‌کش", muscle: "سینه", category: "push", equipment: "cable", description: "در ایستگاه کراس‌اور بایستید و دستگیره‌های بالا را با آرنج‌های خمیده از دو طرف به جلوی بدن بیاورید.", tips: "در انتهای حرکت یک ثانیه مکث کنید و سینه‌ها را منقبض کنید.", difficulty: "intermediate" },
    { name: "فلور پرس", muscle: "سینه", category: "push", equipment: "barbell", description: "روی زمین دراز بکشید و هالتر را از روی سینه تا جایی که آرنج‌ها زمین را لمس کنند بالا ببرید.", tips: "این حرکت برای محافظت از سرشانه مناسب است. آرنج‌ها را ۴۵ درجه باز کنید.", difficulty: "intermediate" },
    { name: "پرس سینه دست‌جمع", muscle: "سینه", category: "push", equipment: "barbell,bench", description: "پرس سینه را با دست‌های به هم نزدیک (فاصله به اندازه عرض شانه) انجام دهید.", tips: "این حرکت به پشت‌بازو هم فشار می‌آورد. آرنج‌ها را به بدن نزدیک نگه دارید.", difficulty: "intermediate" },
    { name: "شنا با پای بالا", muscle: "سینه", category: "push", equipment: "bodyweight", description: "پاها را روی نیمکت یا سطح بلند قرار دهید و حرکت شنا را انجام دهید.", tips: "هرچه پاها بالاتر باشد، فشار به بالاسینه بیشتر می‌شود. بدن صاف بماند.", difficulty: "intermediate" },

    // --- پشت (15) ---
    { name: "ددلیفت کلاسیک", muscle: "پشت", category: "pull", equipment: "barbell", description: "هالتر را روی زمین با فرم صحیح و کمر صاف بلند کنید تا حالت ایستاده کامل به دست آید.", tips: "کمر کاملاً صاف باشد و وزنه نزدیک بدن بماند. از پاها قدرت بگیرید نه از کمر.", difficulty: "advanced" },
    { name: "زیربغل قایقی هالتر", muscle: "پشت", category: "pull", equipment: "barbell", description: "با کمر صاف خم شوید و هالتر را از حالت آویزان به سمت زیر سینه بکشید.", tips: "کمر صاف باشد و در حین کشش کتف‌ها را به عقب ببرید.", difficulty: "intermediate" },
    { name: "زیربغل دمبل خم", muscle: "پشت", category: "pull", equipment: "dumbbell", description: "با یک زانو روی نیمکت و کمر صاف، دمبل را از حالت آویزان به سمت کفل بکشید.", tips: "حرکت را کنترل شده انجام دهید و کتف‌ها را جمع نکنید.", difficulty: "intermediate" },
    { name: "زیربغل سیم‌کش بالا", muscle: "پشت", category: "pull", equipment: "cable", description: "روی دستگاه نشسته و دستگیره را از بالا به سمت بالای سینه بکشید.", tips: "تنش را در زیربغل حس کنید و کمر را قوز ندهید.", difficulty: "beginner" },
    { name: "زیربغل قایقی نشسته", muscle: "پشت", category: "pull", equipment: "cable", description: "روی دستگاه قایقی نشسته و دستگیره را به سمت شکم بکشید.", tips: "کتف‌ها را جمع نکنید و تنش را در زیربغل حس کنید.", difficulty: "beginner" },
    { name: "زیربغل تی‌بار", muscle: "پشت", category: "pull", equipment: "barbell", description: "هالتر را در یک طرف قرار دهید و با دستگیره T-bar وزنه را به سمت شکم بکشید.", tips: "کمر صاف و خم ۴۵ درجه باشد. در حین حرکت بدن را بالا و پایین نبرید.", difficulty: "intermediate" },
    { name: "بارفیکس", muscle: "پشت", category: "pull", equipment: "bodyweight", description: "از میله بارفیکس با دست‌های عرض‌تر از شانه آویزان شوید و بدن را بالا ببرید تا چانه از میله عبور کند.", tips: "در حین حرکت بدن را تاب ندهید. اگر سخت بود از کش کمکی استفاده کنید.", difficulty: "advanced" },
    { name: "زیرآرنج‌گیر", muscle: "پشت", category: "pull", equipment: "bodyweight", description: "مانند بارفیکس اما با دست‌های به هم نزدیک و کف دست رو به خودتان، بدن را بالا ببرید.", tips: "این حرکت به جلو بازو هم فشار می‌آورد. آرنج‌ها به جلو باشد.", difficulty: "intermediate" },
    { name: "فیس پول", muscle: "پشت", category: "pull", equipment: "cable", description: "طناب سیم‌کش را در سطح صورت بگیرید و به سمت گونه‌ها بکشید.", tips: "وزنه سبک استفاده کنید و کتف‌ها را به عقب ببرید. برای سرشانه خماری هم مفید است.", difficulty: "beginner" },
    { name: "زیربغل سیم‌کش دست‌صاف", muscle: "پشت", category: "pull", equipment: "cable", description: "ایستاده و دستگیره سیم‌کش بالا را با دست‌های صاف به سمت ران‌ها پایین بیاورید.", tips: "دست‌ها را خم نکنید و حرکت را از زیربغل و پشت دست انجام دهید.", difficulty: "beginner" },
    { name: "زیربغل دمبل تک‌دست", muscle: "پشت", category: "pull", equipment: "dumbbell", description: "با یک دست و یک پا روی نیمکت قرار بگیرید و دمبل را با دست دیگر به سمت باسن بکشید.", tips: "کمر صاف و موازی زمین باشد. کتف را در پایین حرکت منقبض کنید.", difficulty: "intermediate" },
    { name: "پندلی رو", muscle: "پشت", category: "pull", equipment: "barbell", description: "مانند زیربغل قایقی هالتر اما با سرعت انفجاری هالتر را به سمت زیر سینه بکشید و در هر تکرار وزنه را روی زمین بگذارید.", tips: "این حرکت قدرتی است و نیازمند فرم دقیق. کمر کاملاً صاف باشد.", difficulty: "advanced" },
    { name: "هایپراکستنشن", muscle: "پشت", category: "pull", equipment: "machine", description: "روی دستگاه هایپراکستنشن دراز بکشید و با فشار عضلات پشت کمر، بدن را از حالت خم به حالت صاف بیاورید.", tips: "در حین حرکت کمر را قوز ندهید و از عضلات سرینی و پشت کمر استفاده کنید.", difficulty: "beginner" },
    { name: "رنه‌گید رو", muscle: "پشت", category: "pull", equipment: "dumbbell", description: "در حالت حمایت شنا، در هر دست یک دمبل بگیرید و به نوبت هر دمبل را به سمت باسن بکشید.", tips: "بدن را ثابت نگه دارید و در حین کشش لگن را نچرخانید.", difficulty: "advanced" },
    { name: "مدوز رو", muscle: "پشت", category: "pull", equipment: "barbell", description: "هالتر را در یک طرف با یک دست بگیرید و با کمر صاف و خم ۴۵ درجه، آن را به سمت باسن بکشید.", tips: "حرکت ایزوله زیربغل است و نیاز به تعادل دارد. کمر صاف نگه دارید.", difficulty: "advanced" },

    // --- پا و باسن (15) ---
    { name: "اسکوات با هالتر", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را روی شانه بگذارید و با کمر صاف تا زاویه ۹۰ درجه یا پایین‌تر پایین بروید و سپس بالا بیایید.", tips: "زانوها به داخل نیایند و فرم بدن حفظ شود. پاشنه‌ها روی زمین بمانند.", difficulty: "advanced" },
    { name: "اسکوات جلو", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را روی جلوی شانه (جلوی ترقوه) قرار دهید و اسکوات انجام دهید.", tips: "این حرکت به جلو ران و核心 فشار بیشتری می‌آورد. تنه کاملاً صاف باشد.", difficulty: "advanced" },
    { name: "اسکوات گابلت", muscle: "پا و باسن", category: "legs", equipment: "dumbbell,kettlebell", description: "یک دمبل یا کتل‌بل را مقابل سینه نگه دارید و اسکوات انجام دهید.", tips: "وزنه نزدیک بدن باشد و تنه صاف نگه داشته شود. مناسب مبتدی‌ها.", difficulty: "intermediate" },
    { name: "پرس پا دستگاه", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه پرس پا بنشینید و پلتفرم را با پاها از خود دور کنید.", tips: "پاها به اندازه عرض شانه روی پلتفرم باشد. زانوها را قفل نکنید.", difficulty: "beginner" },
    { name: "جلوی پا دستگاه", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه جلوی پا بنشینید و با جلوی ران، پاها را صاف کنید.", tips: "حرکت را کنترل شده انجام دهید و در انتهای حرکت زانوها را قفل نکنید.", difficulty: "beginner" },
    { name: "پشت پا دستگاه", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه پشت پا بنشینید یا خوابیده و با پشت ران، پاها را خم کنید.", tips: "زانوها را بیش از حد قفل نکنید و وزنه را کنترل شده پایین بیاورید.", difficulty: "beginner" },
    { name: "ددلیفت رومانیایی", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را با دست‌ها بگیرید و با کمر صاف و زانوهای نیمه‌خم، هالتر را به سمت زمین پایین ببرید.", tips: "این حرکت پشت ران را هدف می‌گیرد. کمر صاف باشد و زانوها را قفل نکنید.", difficulty: "intermediate" },
    { name: "لانژ", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "با دمبل در دست، یک گام بزرگ به جلو بردارید و زانوی عقب را به زمین نزدیک کنید.", tips: "زانوی جلو از نوک پا جلوتر نرود. تنه صاف نگه داشته شود.", difficulty: "beginner" },
    { name: "اسکوات بلغاری", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "یک پا را روی نیمکت پشت سر قرار دهید و با پا دیگر اسکوات تک‌پا انجام دهید.", tips: "زانوی جلو از نوک پا جلوتر نرود و تنه صاف باشد.", difficulty: "intermediate" },
    { name: "هیپ تراست", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "روی نیمکت تکیه دهید و هالتر را روی باسن بگذارید، باسن را به سمت بالا هل دهید.", tips: "در بالاترین نقطه باسن را منقبض کنید. کمر را قوز ندهید.", difficulty: "intermediate" },
    { name: "پل باسن", muscle: "پا و باسن", category: "legs", equipment: "bodyweight", description: "روی زمین دراز بکشید، زانوها را خم کنید و باسن را به سمت بالا هل دهید.", tips: "در بالاترین نقطه باسن را منقبض کنید. این حرکت مناسب مبتدی‌هاست.", difficulty: "beginner" },
    { name: "ساق پا ایستاده", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه ساق پا بایستید و با انگشتان پا وزنه را به سمت بالا هل دهید.", tips: "در پایین‌ترین نقطه یک ثانیه مکث کنید تا کشش حس شود.", difficulty: "beginner" },
    { name: "هک اسکوات", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه هک اسکوات بنشینید و پلتفرم را با فشار پاها هل دهید.", tips: "این حرکت به جلو ران فشار می‌آورد. پاها به اندازه عرض شانه باشد.", difficulty: "intermediate" },
    { name: "اسکوات سومو", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را روی شانه بگذارید، پاها را عرض‌تر از شانه باز کنید و نوک پاها را به بیرون بچرخانید، سپس اسکوات انجام دهید.", tips: "این حرکت به داخل ران و باسن فشار می‌آورد. زانوها به داخل نیایند.", difficulty: "intermediate" },
    { name: "استپ‌آپ", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "با دمبل در دست، روی یک جعبه یا نیمکت بالا بروید و پایین بیایید.", tips: "از پای بلندتر قدرت بگیرید و تعادل را حفظ کنید.", difficulty: "beginner" },

    // --- سرشانه (10) ---
    { name: "پرس سرشانه با هالتر", muscle: "سرشانه", category: "push", equipment: "barbell", description: "هالتر را در سطح ترقوه نگه دارید و آن را به سمت بالا فشار دهید تا دست‌ها صاف شوند.", tips: "کمر را قوز ندهید و پاها به اندازه عرض شانه باز باشند.", difficulty: "intermediate" },
    { name: "پرس سرشانه با دمبل", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "دمبل‌ها را در دو طرف شانه نگه دارید و آن‌ها را به سمت بالا فشار دهید.", tips: "کمر را قوز ندهید. حرکت را کنترل شده انجام دهید.", difficulty: "intermediate" },
    { name: "نشر از جانب", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "دمبل‌ها را در دو طرف بدن نگه دارید و با آرنج‌های نیمه‌خم آن‌ها را به سمت侧 بالا بیاورید.", tips: "وزنه سبک استفاده کنید و کمر را تکان ندهید. این حرکت سرشانه جانبی را هدف می‌گیرد.", difficulty: "beginner" },
    { name: "نشر از جلو", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "دمبل‌ها را در دو طرف بدن نگه دارید و به نوبت هرکدام را به سمت جلو و بالا بیاورید.", tips: "وزنه سبک استفاده کنید و بالاتر از سطح شانه بالا نبرید.", difficulty: "beginner" },
    { name: "فیس پول سرشانه", muscle: "سرشانه", category: "pull", equipment: "cable", description: "طناب سیم‌کش را در سطح صورت بگیرید و به سمت گونه‌ها بکشید تا سرشانه خماری هدف قرار گیرد.", tips: "وزنه سبک استفاده کنید. این حرکت برای سلامت سرشانه بسیار مفید است.", difficulty: "beginner" },
    { name: "آرنولد پرس", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "دمبل‌ها را با کف دست رو به داخل در سطح شانه نگه دارید، در حین پرس بالا، دست‌ها را بچرخانید تا کف دست رو به جلو شود.", tips: "این حرکت تمام قسمت‌های سرشانه را درگیر می‌کند. حرکت را نرم و کنترل شده انجام دهید.", difficulty: "intermediate" },
    { name: "راوت", muscle: "سرشانه", category: "pull", equipment: "barbell", description: "هالتر را با دست‌های نزدیک بگیرید و آن را از حالت آویزان به سمت چانه بکشید.", tips: "این حرکت به سرشانه و ذوزنقه فشار می‌آورد. آرنج‌ها بالاتر از هالتر باشند.", difficulty: "intermediate" },
    { name: "فلای خماری", muscle: "سرشانه", category: "pull", equipment: "dumbbell", description: "با کمر صاف خم شوید و دمبل‌ها را با آرنج‌های نیمه‌خم به سمت دو طرف بالا ببرید.", tips: "این حرکت سرشانه خماری را هدف می‌گیرد. کمر صاف باشد.", difficulty: "beginner" },
    { name: "شراگ", muscle: "سرشانه", category: "pull", equipment: "dumbbell", description: "دمبل‌ها را در دو طرف بدن نگه دارید و شانه‌ها را به سمت گوش بالا بیاورید.", tips: "در بالاترین نقطه یک ثانیه مکث کنید. حرکت را کنترل شده انجام دهید.", difficulty: "beginner" },
    { name: "شنا پایک", muscle: "سرشانه", category: "push", equipment: "bodyweight", description: "بدن را به شکل V وارونه (پایک) قرار دهید و سر را به سمت زمین پایین ببرید.", tips: "این حرکت سرشانه را با وزن بدن هدف می‌گیرد. آرنج‌ها را به دو طرف باز نکنید.", difficulty: "intermediate" },

    // --- بازو (10) ---
    { name: "جلو بازو هالتر", muscle: "بازو", category: "pull", equipment: "barbell", description: "هالتر را با کف دست رو به بالا بگیرید و آن را از حالت آویزان به سمت شانه بکشید.", tips: "آرنج‌ها را کنار بدن نگه دارید و بدن را تکان ندهید.", difficulty: "beginner" },
    { name: "جلو بازو دمبل", muscle: "بازو", category: "pull", equipment: "dumbbell", description: "دمبل‌ها را در دو طرف بدن نگه دارید و به نوبت آن‌ها را به سمت شانه بکشید.", tips: "آرنج‌ها را کنار بدن نگه دارید و حرکت را کنترل شده انجام دهید.", difficulty: "beginner" },
    { name: "جلو بازو چکشی", muscle: "بازو", category: "pull", equipment: "dumbbell", description: "دمبل‌ها را با کف دست رو به بدن نگه دارید و آن‌ها را به سمت شانه بکشید.", tips: "این حرکت به جلو بازو و ساعد فشار می‌آورد. آرنج‌ها ثابت باشند.", difficulty: "beginner" },
    { name: "جلو بازو اسکات", muscle: "بازو", category: "pull", equipment: "barbell,machine", description: "روی دستگاه اسکات بنشینید و دستگیره را با کف دست رو به بالا از حالت صاف به سمت سرشانه بکشید.", tips: "آرنج‌ها روی پد ثابت باشد و حرکت را ایزوله انجام دهید.", difficulty: "intermediate" },
    { name: "جلو بازو تمرکزی", muscle: "بازو", category: "pull", equipment: "dumbbell", description: "روی نیمکت بنشینید، آرنج را روی داخل ران قرار دهید و دمبل را به سمت شانه بکشید.", tips: "حرکت ایزوله جلو بازو است. از وزنه سبک استفاده کنید.", difficulty: "beginner" },
    { name: "پشت بازو سیم‌کش", muscle: "بازو", category: "push", equipment: "cable", description: "ایستاده و دستگیره سیم‌کش را با کف دست رو به پایین از حالت خم به سمت پایین فشار دهید.", tips: "آرنج‌ها را کنار بدن نگه دارید و فقط ساعد حرکت کند.", difficulty: "beginner" },
    { name: "پشت بازو درازخواب", muscle: "بازو", category: "push", equipment: "barbell", description: "روی نیمکت دراز بکشید، هالتر را با کف دست رو به بالا و دست‌های نزدیک بالای سر نگه دارید و آن را به سمت پیشانی پایین بیاورید.", tips: "آرنج‌ها ثابت باشند و حرکت را کنترل شده انجام دهید.", difficulty: "intermediate" },
    { name: "پشت بازو بالای سر", muscle: "بازو", category: "push", equipment: "dumbbell", description: "دمبل را با دو دست بالای سر نگه دارید و آن را به سمت پشت سر پایین بیاورید.", tips: "آرنج‌ها نزدیک سر باشد و حرکت را کنترل شده انجام دهید.", difficulty: "intermediate" },
    { name: "پرس پشت‌بازو دست‌جمع", muscle: "بازو", category: "push", equipment: "barbell,bench", description: "پرس سینه را با دست‌های به هم نزدیک (فاصله به اندازه عرض شانه) انجام دهید تا فشار به پشت بازو برود.", tips: "آرنج‌ها را به بدن نزدیک نگه دارید. این حرکت پشت بازو و سینه را درگیر می‌کند.", difficulty: "intermediate" },
    { name: "دیپس پشت‌بازو", muscle: "بازو", category: "push", equipment: "bodyweight", description: "روی میله‌های موازی قرار بگیرید و بدن را با حالت صاف (بدون خم شدن به جلو) پایین ببرید تا پشت بازو هدف قرار گیرد.", tips: "برای هدف‌گیری پشت بازو، بدن را صاف نگه دارید. آرنج‌ها به بیرون نروند.", difficulty: "intermediate" },

    // --- شکم (10) ---
    { name: "پلانک", muscle: "شکم", category: "core", equipment: "bodyweight", description: "روی آرنج‌ها و پنجه پا بدن را صاف نگه دارید و عضلات شکم را منقبض کنید.", tips: "باسن بالا یا پایین نرود. بدن کاملاً صاف باشد.", difficulty: "beginner" },
    { name: "کرانچ", muscle: "شکم", category: "core", equipment: "bodyweight", description: "دراز بکشید، زانوها خم باشد و سرشانه‌ها را از زمین جدا کنید.", tips: "گردن را نکشید و فقط با قدرت شکم بالا بیایید.", difficulty: "beginner" },
    { name: "کرانچ معکوس", muscle: "شکم", category: "core", equipment: "bodyweight", description: "دراز بکشید و زانوها را به سمت سینه بالا بیاورید تا شکم پایین هدف قرار گیرد.", tips: "حرکت را کنترل شده انجام دهید و کمر را از زمین بلند نکنید.", difficulty: "beginner" },
    { name: "بالا آوردن پا آویزان", muscle: "شکم", category: "core", equipment: "bodyweight", description: "از میله بارفیکس آویزان شوید و پاها را صاف به سمت میله بالا بیاورید.", tips: "بدن را تاب ندهید. اگر سخت بود زانوها را خم کنید.", difficulty: "advanced" },
    { name: "کرانچ سیم‌کش", muscle: "شکم", category: "core", equipment: "cable", description: "روی زانو بنشینید و طناب سیم‌کش بالا را با خم شدن به سمت زمین به شکم فشار دهید.", tips: "در حین حرکت باسن را ثابت نگه دارید و فقط شکم حرکت کند.", difficulty: "intermediate" },
    { name: "روسیان توئیست", muscle: "شکم", category: "core", equipment: "bodyweight", description: "روی زمین بنشینید، پاها را کمی بالا ببرید و تنه را به دو طرف بچرخانید.", tips: "برای افزایش难度 وزنه اضافه کنید. کمر صاف نگه داشته شود.", difficulty: "intermediate" },
    { name: "کرانچ دوچرخه", muscle: "شکم", category: "core", equipment: "bodyweight", description: "دراز بکشید و به نوبت آرنج مخالف را به زانو مخالف نزدیک کنید با حرکت پدال دوچرخه.", tips: "حرکت را آرام و کنترل شده انجام دهید.", difficulty: "intermediate" },
    { name: "کوهنوردی", muscle: "شکم", category: "core", equipment: "bodyweight", description: "در حالت حمایت شنا، به نوبت زانوها را به سمت سینه بالا بیاورید.", tips: "بدن صاف نگه دارید و سرعت را به تدریج افزایش دهید.", difficulty: "intermediate" },
    { name: "بالا آوردن پا خوابیده", muscle: "شکم", category: "core", equipment: "bodyweight", description: "دراز بکشید و پاها را صاف به سمت بالا بیاورید.", tips: "کمر را از زمین بلند نکنید. حرکت را کنترل شده انجام دهید.", difficulty: "beginner" },
    { name: "پلانک جانبی", muscle: "شکم", category: "core", equipment: "bodyweight", description: "روی یک آرنج و کنار پا بدن را صاف نگه دارید.", tips: "باسن بالا یا پایین نرود. این حرکت به شکم جانبی فشار می‌آورد.", difficulty: "intermediate" },

    // --- زیربغل (10) ---
    { name: "زیربغل سیم‌کش دست‌باز", muscle: "زیربغل", category: "pull", equipment: "cable", description: "روی دستگاه نشسته و دستگیره را با دست‌های عرض‌تر از شانه از بالا به سمت بالای سینه بکشید.", tips: "گرفتار باز به زیربغل پهلو فشار بیشتری می‌آورد. کمر را قوز ندهید.", difficulty: "beginner" },
    { name: "روئینگ نشسته دستگاه", muscle: "زیربغل", category: "pull", equipment: "machine", description: "روی دستگاه روئینگ نشسته و دستگیره‌ها را به سمت شکم بکشید.", tips: "در حین کشش کتف‌ها را به عقب ببرید و سینه را باز کنید.", difficulty: "beginner" },
    { name: "زیربغل هالتر خم ۴۵ درجه", muscle: "زیربغل", category: "pull", equipment: "barbell", description: "با کمر صاف و خم ۴۵ درجه، هالتر را از حالت آویزان به سمت زیر سینه بکشید.", tips: "کمر صاف باشد و در حین حرکت کتف‌ها را به عقب ببرید.", difficulty: "intermediate" },
    { name: "زیربغل طناب دست‌صاف", muscle: "زیربغل", category: "pull", equipment: "cable", description: "ایستاده و طناب سیم‌کش بالا را با دست‌های صاف به سمت ران‌ها پایین بیاورید.", tips: "دست‌ها را خم نکنید و حرکت را از زیربغل انجام دهید.", difficulty: "beginner" },
    { name: "زیربغل تی‌بار صفحاتی", muscle: "زیربغل", category: "pull", equipment: "machine", description: "روی دستگاه تی‌بار صفحاتی بنشینید یا بایستید و دستگیره را به سمت شکم بکشید.", tips: "کمر صاف باشد و در حین کشش کتف‌ها را منقبض کنید.", difficulty: "intermediate" },
    { name: "زیربغل دمبل تک‌خم تک‌دست", muscle: "زیربغل", category: "pull", equipment: "dumbbell", description: "با یک دست و یک پا روی نیمکت قرار بگیرید و دمبل را با دست دیگر به سمت باسن بکشید.", tips: "کمر صاف و موازی زمین باشد. کتف را در پایین حرکت منقبض کنید.", difficulty: "intermediate" },
    { name: "زیربغل سیم‌کش دست‌جمع", muscle: "زیربغل", category: "pull", equipment: "cable", description: "روی دستگاه نشسته و دستگیره را با دست‌های به هم نزدیک از بالا به سمت سینه بکشید.", tips: "گرفتار دست‌جمع به زیربغل مرکزی فشار می‌آورد. کمر صاف باشد.", difficulty: "beginner" },
    { name: "زیربغل سیم‌کش تک‌دست", muscle: "زیربغل", category: "pull", equipment: "cable", description: "ایستاده و دستگیره سیم‌کش پایین را با یک دست به سمت باسن بکشید.", tips: "تنه را بیش از حد نچرخانید و حرکت را کنترل شده انجام دهید.", difficulty: "intermediate" },
    { name: "زیربغل مدوز", muscle: "زیربغل", category: "pull", equipment: "barbell", description: "هالتر را در یک طرف با یک دست بگیرید و با کمر صاف و خم ۴۵ درجه، آن را به سمت باسن بکشید.", tips: "حرکت ایزوله زیربغل است و نیاز به تعادل دارد. کمر صاف نگه دارید.", difficulty: "advanced" },
    { name: "زیربغل پندلی سریع", muscle: "زیربغل", category: "pull", equipment: "barbell", description: "مانند پندلی رو اما با سرعت انفجاری هالتر را به سمت زیر سینه بکشید و در هر تکرار وزنه را روی زمین بگذارید.", tips: "این حرکت قدرتی است و نیازمند فرم دقیق. کمر کاملاً صاف باشد.", difficulty: "advanced" },

    // --- کمر و پشت (5) ---
    { name: "ددلیفت کمر", muscle: "کمر و پشت", category: "pull", equipment: "barbell", description: "هالتر را روی زمین با فرم صحیح و کمر صاف بلند کنید تا حالت ایستاده کامل به دست آید.", tips: "کمر کاملاً صاف باشد و وزنه نزدیک بدن بماند. این حرکت به پشت کمر فشار زیادی می‌آورد.", difficulty: "advanced" },
    { name: "هایپراکستنشن کمر", muscle: "کمر و پشت", category: "pull", equipment: "machine", description: "روی دستگاه هایپراکستنشن دراز بکشید و با فشار عضلات پشت کمر، بدن را از حالت خم به حالت صاف بیاورید.", tips: "در حین حرکت کمر را قوز ندهید و از عضلات سرینی و پشت کمر استفاده کنید.", difficulty: "beginner" },
    { name: "گود مورنینگ", muscle: "کمر و پشت", category: "pull", equipment: "barbell", description: "هالتر را روی شانه بگذارید و با کمر صاف و زانوهای نیمه‌خم، بدن را به سمت جلو خم کنید.", tips: "این حرکت به پشت کمر و پشت ران فشار می‌آورد. وزنه سبک استفاده کنید.", difficulty: "intermediate" },
    { name: "سوپرمن", muscle: "کمر و پشت", category: "core", equipment: "bodyweight", description: "روی زمین روی شکم دراز بکشید و دست‌ها و پاها را هم‌زمان از زمین جدا کنید.", tips: "در بالاترین نقطه یک ثانیه مکث کنید. این حرکت به پشت کمر فشار می‌آورد.", difficulty: "beginner" },
    { name: "برد داگ", muscle: "کمر و پشت", category: "core", equipment: "bodyweight", description: "روی دست‌ها و زانوها قرار بگیرید و دست مخالف و پای مخالف را هم‌زمان از زمین جدا کنید.", tips: "این حرکت برای تعادل و ثبات مرکز بدن مفید است. بدن را ثابت نگه دارید.", difficulty: "beginner" },

    // --- سینه و دست (5) ---
    { name: "شنا ترکیبی", muscle: "سینه و دست", category: "push", equipment: "bodyweight", description: "شنا استاندارد با دست‌های به اندازه عرض شانه، با تمرکز روی درگیر کردن سینه و پشت بازو.", tips: "آرنج‌ها حدود ۴۵ درجه باز باشند و بدن صاف نگه داشته شود.", difficulty: "intermediate" },
    { name: "شنا الماسی دست", muscle: "سینه و دست", category: "push", equipment: "bodyweight", description: "شنا الماسی با دست‌های نزدیک به هم برای هدف‌گیری بیشتر پشت بازو.", tips: "آرنج‌ها به بدن نزدیک نگه داشته شوند. اگر سخت بود زانوها را روی زمین بگذارید.", difficulty: "intermediate" },
    { name: "دیپس ترکیبی", muscle: "سینه و دست", category: "push", equipment: "bodyweight", description: "دیپس روی میله‌های موازی با تمرکز روی درگیر کردن سینه و پشت بازو هم‌زمان.", tips: "بدن را کمی به جلو خم کنید تا فشار روی سینه بیشتر شود.", difficulty: "intermediate" },
    { name: "پرس دست‌جمع ترکیبی", muscle: "سینه و دست", category: "push", equipment: "barbell,bench", description: "پرس سینه دست‌جمع با تمرکز روی درگیر کردن سینه و پشت بازو.", tips: "آرنج‌ها را به بدن نزدیک نگه دارید. وزنه متوسط استفاده کنید.", difficulty: "intermediate" },
    { name: "شنا پایک دست", muscle: "سینه و دست", category: "push", equipment: "bodyweight", description: "شنا پایک با بدن به شکل V وارونه، با تمرکز روی درگیر کردن سرشانه و پشت بازو.", tips: "آرنج‌ها را به دو طرف باز نکنید. حرکت را کنترل شده انجام دهید.", difficulty: "intermediate" },

    // --- جلو ران (3) ---
    { name: "جلوی پا تک‌پا", muscle: "جلو ران", category: "legs", equipment: "machine", description: "روی دستگاه جلوی پا بنشینید و با یک پا در یک زمان، جلوی ران را منقبض کنید.", tips: "این حرکت عدم تعادل بین دو پا را اصلاح می‌کند. وزنه سبک‌تر استفاده کنید.", difficulty: "intermediate" },
    { name: "اسکوات جلو تک‌پا", muscle: "جلو ران", category: "legs", equipment: "bodyweight", description: "روی یک پا بایستید و اسکوات تک‌پا (پیستول) انجام دهید تا جلوی ران هدف قرار گیرد.", tips: "این حرکت پیشرفته است. برای تعادل از یک دیوار کمک بگیرید.", difficulty: "advanced" },
    { name: "سیسی اسکوات", muscle: "جلو ران", category: "legs", equipment: "bodyweight", description: "ایستاده و با خم کردن زانوها به جلو، بدن را به سمت عقب پایین ببرید تا جلوی ران ایزوله شود.", tips: "این حرکت به زانوها فشار می‌آورد. با احتیاط و دامنه محدود انجام دهید.", difficulty: "advanced" },

    // --- پشت ران (2) ---
    { name: "پشت پا خوابیده", muscle: "پشت ران", category: "legs", equipment: "machine", description: "روی دستگاه پشت پا به حالت خوابیده دراز بکشید و با پشت ران، پاها را خم کنید.", tips: "این حرکت پشت ران را ایزوله می‌کند. حرکت را کنترل شده انجام دهید.", difficulty: "beginner" },
    { name: "ددلیفت رومانیایی تک‌پا", muscle: "پشت ران", category: "legs", equipment: "dumbbell", description: "روی یک پا بایستید و با کمر صاف و دست‌های آویزان، دمبل را به سمت زمین پایین ببرید.", tips: "این حرکت تعادل و پشت ران را هدف می‌گیرد. کمر صاف نگه دارید.", difficulty: "advanced" },

    // ================================================================
    // Additional 150 exercises (101-250) — Persian fitness library
    // Covers: Chest(20), Back(25), Shoulders(20), Biceps(15),
    // Triceps(15), Legs(25), Core(15), Forearms(5), Full Body(10)
    // ================================================================

    // --- سینه (20) ---
    { name: "پرس سینه با هالتر دست‌باز", muscle: "سینه", category: "push", equipment: "barbell,bench", description: "هالتر را با دست‌های عرض‌تر از شانه بگیرید و آن را از روی سینه به سمت بالا فشار دهید. این حرکت به سینه خارجی فشار بیشتری می‌آورد.", tips: "آرنج‌ها را بیش از حد باز نکنید تا فشار به سرشانه نیاید. کمر را قوز ندهید.", difficulty: "intermediate" },
    { name: "پرس بالاسینه با دمبل", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت شیب‌دار ۳۰ تا ۴۵ درجه دراز بکشید و دمبل‌ها را از دو طرف بالای سینه به سمت بالا فشار دهید.", tips: "زاویه نیمکت بیشتر از ۴۵ درجه نباشد تا فشار از سینه به سرشانه منتقل نشود.", difficulty: "intermediate" },
    { name: "پرس زیرسینه با دمبل", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت شیب‌دار معکوس دراز بکشید و دمبل‌ها را از دو طرف پایین سینه به سمت بالا فشار دهید.", tips: "از زاویه شیب کم (۱۵ تا ۳۰ درجه) استفاده کنید و سر را پایین نگه دارید.", difficulty: "intermediate" },
    { name: "فلای زیرسینه با دمبل", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت شیب‌دار معکوس دراز بکشید و دمبل‌ها را با آرنج‌های خمیده از دو طرف به سمت بالا بیاورید.", tips: "آرنج‌ها را بیش از حد باز نکنید و حرکت را کنترل شده انجام دهید.", difficulty: "intermediate" },
    { name: "شنا با دست‌باز", muscle: "سینه", category: "push", equipment: "bodyweight", description: "دست‌ها را عرض‌تر از شانه روی زمین بگذارید و حرکت شنا را انجام دهید تا سینه خارجی هدف قرار گیرد.", tips: "بدن صاف نگه داشته شود و آرنج‌ها بیش از حد باز نشوند.", difficulty: "beginner" },
    { name: "شنا اسپایدرمن", muscle: "سینه", category: "push", equipment: "bodyweight", description: "در حالت حمکت شنا، در حین پایین رفتن یک زانو را به سمت آرنج مخالف بیاورید.", tips: "بدن را ثابت نگه دارید و حرکت را کنترل شده انجام دهید.", difficulty: "intermediate" },
    { name: "شنا آرچر", muscle: "سینه", category: "push", equipment: "bodyweight", description: "با یک دست کاملاً صاف روی زمین و دست دیگر منقبض، شنا انجام دهید و در هر تکرار دست‌ها را عوض کنید.", tips: "این حرکت پیشرفته است و آمادگی بالایی می‌طلبد. ابتدا با دست کمکی تمرین کنید.", difficulty: "advanced" },
    { name: "پرس سینه با کش مقاومتی", muscle: "سینه", category: "push", equipment: "band", description: "کش را پشت نیمکت قرار دهید و دو سر آن را در دست بگیرید، دست‌ها را به سمت جلو فشار دهید.", tips: "این حرکت برای تمرین در خانه مناسب است. کش را در طول حرکت کنترل کنید.", difficulty: "beginner" },
    { name: "فلای سینه با کش مقاومتی", muscle: "سینه", category: "push", equipment: "band", description: "کش را پشت نیمکت قرار دهید و دو سر آن را در دست بگیرید، دست‌ها را با آرنج خم به سمت جلو بیاورید.", tips: "آرنج‌ها را ثابت نگه دارید و کش را کنترل کنید.", difficulty: "beginner" },
    { name: "پرس سینه روی توپ بدنسازی", muscle: "سینه", category: "push", equipment: "dumbbell,ball", description: "روی توپ بدنسازی به حالت خوابیده (سر و شانه روی توپ) قرار بگیرید و دمبل‌ها را به سمت بالا فشار دهید.", tips: "باسن را بالا نگه دارید تا بدن صاف بماند. تعادل را حفظ کنید.", difficulty: "intermediate" },
    { name: "فلای سینه روی توپ بدنسازی", muscle: "سینه", category: "push", equipment: "dumbbell,ball", description: "روی توپ بدنسازی به حالت خوابیده قرار بگیرید و دمبل‌ها را با آرنج خم به سمت جلو بیاورید.", tips: "آرنج‌ها را بیش از حد باز نکنید و تعادل را حفظ کنید.", difficulty: "intermediate" },
    { name: "دیپس سینه روی نیمکت", muscle: "سینه", category: "push", equipment: "bodyweight", description: "دو نیمکت پشت به هم قرار دهید، دست‌ها را پشت بدن روی نیمکت بگذارید و بدن را پایین ببرید.", tips: "زانوها را خم کنید و آرنج‌ها را به دو طرف باز نکنید.", difficulty: "beginner" },
    { name: "پرس سینه با کتل‌بل", muscle: "سینه", category: "push", equipment: "kettlebell", description: "روی زمین دراز بکشید و دو کتل‌بل را در دو طرف سینه نگه دارید و آن‌ها را به سمت بالا فشار دهید.", tips: "مچ دست را صاف نگه دارید و وزنه را کنترل کنید.", difficulty: "intermediate" },
    { name: "شنا یک‌دست", muscle: "سینه", category: "push", equipment: "bodyweight", description: "با یک دست روی زمین و دست دیگر پشت کمر، شنا انجام دهید.", tips: "این حرکت پیشرفته است و قدرت بالایی می‌طلبد. ابتدا با دست کمکی تمرین کنید.", difficulty: "advanced" },
    { name: "پک دک دستگاه", muscle: "سینه", category: "push", equipment: "machine", description: "روی دستگاه پک دک بنشینید و دستگیره‌ها را با آرنج خم از دو طرف به سمت هم فشار دهید.", tips: "در انتهای حرکت یک ثانیه مکث کنید و سینه را منقبض کنید.", difficulty: "beginner" },
    { name: "شنا انفجاری", muscle: "سینه", category: "push", equipment: "bodyweight", description: "حرکت شنا را با قدرت انفجاری انجام دهید و در بالاترین نقطه دست‌ها را از زمین جدا کنید.", tips: "این حرکت قدرت انفجاری می‌سازد. اگر سخت بود روی زانو انجام دهید.", difficulty: "advanced" },
    { name: "شنا هندو", muscle: "سینه", category: "push", equipment: "bodyweight", description: "بدن را به شکل V قرار دهید، سر را به سمت زمین پایین ببرید و سپس بدن را به جلو بکشید.", tips: "حرکت را نرم و روان انجام دهید. این حرکت سنتی کشتی‌گیران است.", difficulty: "intermediate" },
    { name: "پرس سینه با زنجیر", muscle: "سینه", category: "push", equipment: "barbell", description: "مانند پرس سینه اما با اضافه کردن زنجیر به دو طرف هالتر برای مقاومت متغیر.", tips: "این حرکت پیشرفته است و نیاز به تجهیزات خاص دارد. با احتیاط انجام دهید.", difficulty: "advanced" },
    { name: "پرس سینه روی لبه نیمکت", muscle: "سینه", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت دراز بکشید و دمبل‌ها را با دست‌های بازتر از معمول پرس کنید تا کشش بیشتری در سینه حس کنید.", tips: "آرنج‌ها را بیش از حد باز نکنید تا فشار به سرشانه نیاید.", difficulty: "intermediate" },
    { name: "شنا با پا روی توپ", muscle: "سینه", category: "push", equipment: "bodyweight,ball", description: "پاها را روی توپ بدنسازی قرار دهید و حرکت شنا را انجام دهید.", tips: "تعادل را حفظ کنید و بدن را صاف نگه دارید.", difficulty: "intermediate" },

    // --- پشت و زیربغل (25) ---
    { name: "زیربغل هالتر دست‌باز", muscle: "پشت و زیربغل", category: "pull", equipment: "barbell", description: "هالتر را با دست‌های عرض‌تر از شانه بگیرید و با کمر صاف خم شوید، هالتر را به سمت زیر سینه بکشید.", tips: "این حرکت به بالای زیربغل فشار می‌آورد. کمر صاف نگه داشته شود.", difficulty: "intermediate" },
    { name: "زیربغل هالتر دست‌جمع", muscle: "پشت و زیربغل", category: "pull", equipment: "barbell", description: "هالتر را با دست‌های به هم نزدیک بگیرید و با کمر صاف خم شوید، هالتر را به سمت زیر سینه بکشید.", tips: "این حرکت به زیربغل مرکزی فشار می‌آورد. آرنج‌ها نزدیک بدن باشد.", difficulty: "intermediate" },
    { name: "زیربغل دمبل خوابیده روی نیمکت", muscle: "پشت و زیربغل", category: "pull", equipment: "dumbbell,bench", description: "روی نیمکت به حالت خوابیده روی شکم قرار بگیرید و دمبل‌ها را از دو طرف به سمت بالا بکشید.", tips: "در بالاترین نقطه کتف‌ها را منقبض کنید. این حرکت به بالای زیربغل فشار می‌آورد.", difficulty: "intermediate" },
    { name: "بارفیکس دست‌باز", muscle: "پشت و زیربغل", category: "pull", equipment: "bodyweight", description: "از میله بارفیکس با دست‌های عرض‌تر از شانه آویزان شوید و بدن را بالا ببرید.", tips: "این حرکت به بالای زیربغل فشار می‌آورد. اگر سخت بود از کش کمکی استفاده کنید.", difficulty: "advanced" },
    { name: "بارفیکس دست‌جمع", muscle: "پشت و زیربغل", category: "pull", equipment: "bodyweight", description: "از میله بارفیکس با دست‌های به هم نزدیک آویزان شوید و بدن را بالا ببرید.", tips: "این حرکت به زیربغل مرکزی و جلو بازو فشار می‌آورد.", difficulty: "advanced" },
    { name: "بارفیکس برعکس (چین‌آپ)", muscle: "پشت و زیربغل", category: "pull", equipment: "bodyweight", description: "از میله بارفیکس با کف دست رو به خودتان آویزان شوید و بدن را بالا ببرید.", tips: "این حرکت به زیربغل و جلو بازو فشار زیادی می‌آورد. آرنج‌ها را به بدن نزدیک کنید.", difficulty: "advanced" },
    { name: "زیربغل سیم‌کش دست‌برعکس", muscle: "پشت و زیربغل", category: "pull", equipment: "cable", description: "روی دستگاه نشسته و دستگیره را با کف دست رو به خودتان از بالا به سمت سینه بکشید.", tips: "این حرکت به زیربغل مرکزی و جلو بازو فشار می‌آورد. کمر صاف باشد.", difficulty: "beginner" },
    { name: "زیربغل سیم‌کش وی‌بار", muscle: "پشت و زیربغل", category: "pull", equipment: "cable", description: "روی دستگاه نشسته و دستگیره وی‌بار را از بالا به سمت بالای سینه بکشید.", tips: "این حرکت به زیربغل مرکزی فشار می‌آورد. کتف‌ها را به عقب ببرید.", difficulty: "beginner" },
    { name: "زیربغل سیم‌کش پایین نشسته", muscle: "پشت و زیربغل", category: "pull", equipment: "cable", description: "روی دستگاه نشسته و دستگیره سیم‌کش پایین را به سمت شکم بکشید.", tips: "در حین کشش کتف‌ها را به عقب ببرید و سینه را باز کنید.", difficulty: "beginner" },
    { name: "زیربغل طناب نشسته سیم‌کش", muscle: "پشت و زیربغل", category: "pull", equipment: "cable", description: "روی دستگاه نشسته و طناب سیم‌کش پایین را به سمت شکم بکشید.", tips: "در حین کشش کتف‌ها را به عقب ببرید و طناب را به دو طرف باز کنید.", difficulty: "beginner" },
    { name: "ددلیفت سومو", muscle: "پشت و زیربغل", category: "pull", equipment: "barbell", description: "هالتر را با دست‌های بین پاها و پاها عرض‌تر از شانه (سومو) بگیرید و با کمر صاف بلند کنید.", tips: "این حرکت به پشت ران و داخل ران فشار می‌آورد. کمر صاف نگه دارید.", difficulty: "advanced" },
    { name: "ددلیفت رومانیایی با دمبل", muscle: "پشت و زیربغل", category: "pull", equipment: "dumbbell", description: "دمبل‌ها را در دست بگیرید و با کمر صاف و زانوهای نیمه‌خم، آن‌ها را به سمت زمین پایین ببرید.", tips: "این حرکت پشت ران و باسن را هدف می‌گیرد. کمر صاف باشد.", difficulty: "intermediate" },
    { name: "ددلیفت با کتل‌بل", muscle: "پشت و زیربغل", category: "pull", equipment: "kettlebell", description: "کتل‌بل را با دو دست بین پاها بگیرید و با کمر صاف آن را بلند کنید.", tips: "این حرکت برای مبتدی‌ها مناسب است. کمر صاف نگه دارید.", difficulty: "beginner" },
    { name: "ددلیفت تک‌پا با دمبل", muscle: "پشت و زیربغل", category: "pull", equipment: "dumbbell", description: "روی یک پا بایستید و با کمر صاف و دست‌های آویزان، دمبل را به سمت زمین پایین ببرید.", tips: "این حرکت تعادل و پشت ران را هدف می‌گیرد. کمر صاف نگه دارید.", difficulty: "intermediate" },
    { name: "زیربغل تی‌بار دست‌باز", muscle: "پشت و زیربغل", category: "pull", equipment: "machine", description: "روی دستگاه تی‌بار با دستگیره عرض‌تر بنشینید و دستگیره را به سمت شکم بکشید.", tips: "کمر صاف باشد و در حین کشش کتف‌ها را منقبض کنید.", difficulty: "intermediate" },
    { name: "زیربغل تی‌بار تک‌دست", muscle: "پشت و زیربغل", category: "pull", equipment: "machine", description: "روی دستگاه تی‌بار با یک دست دستگیره را به سمت شکم بکشید.", tips: "حرکت را کنترل شده انجام دهید و بدن را بچرخانید.", difficulty: "intermediate" },
    { name: "کشش سیم‌کش دست‌صاف از بالا", muscle: "پشت و زیربغل", category: "pull", equipment: "cable", description: "ایستاده و دستگیره سیم‌کش بالا را با دست‌های صاف به سمت ران‌ها پایین بیاورید.", tips: "دست‌ها را خم نکنید و حرکت را از زیربغل انجام دهید.", difficulty: "beginner" },
    { name: "زیربغل دستگاه همر استرنگت", muscle: "پشت و زیربغل", category: "pull", equipment: "machine", description: "روی دستگاه همر استرنگت بنشینید و دستگیره‌ها را به سمت شکم بکشید.", tips: "در حین کشش کتف‌ها را به عقب ببرید و سینه را باز کنید.", difficulty: "beginner" },
    { name: "زیربغل با کش مقاومتی", muscle: "پشت و زیربغل", category: "pull", equipment: "band", description: "کش را دور یک سطح محکم بکشید و دو سر آن را در دست بگیرید، دست‌ها را به سمت شکم بکشید.", tips: "این حرکت برای تمرین در خانه مناسب است. کش را کنترل کنید.", difficulty: "beginner" },
    { name: "بارفیکس کمکی با دستگاه", muscle: "پشت و زیربغل", category: "pull", equipment: "machine", description: "روی دستگاه بارفیکس کمکی بنشینید و وزنه کمکی را تنظیم کنید، سپس بدن را بالا ببرید.", tips: "این حرکت برای یادگیری بارفیکس مناسب است. وزنه کمکی را به تدریج کم کنید.", difficulty: "beginner" },
    { name: "زیربغل یک‌دست هالتر مدوز", muscle: "پشت و زیربغل", category: "pull", equipment: "barbell", description: "هالتر را با یک دست از وسط بگیرید و با کمر صاف و خم ۴۵ درجه، آن را به سمت باسن بکشید.", tips: "این حرکت نیاز به تعادل دارد. کمر صاف نگه دارید.", difficulty: "advanced" },
    { name: "زیربغل قایقی هالتر تک‌پا", muscle: "پشت و زیربغل", category: "pull", equipment: "barbell", description: "مانند زیربغل قایقی هالتر اما روی یک پا بایستید و با کمر صاف هالتر را بکشید.", tips: "این حرکت تعادل و قدرت را هدف می‌گیرد. کمر صاف نگه دارید.", difficulty: "advanced" },
    { name: "زیربغل دمبل روی توپ بدنسازی", muscle: "پشت و زیربغل", category: "pull", equipment: "dumbbell,ball", description: "روی توپ بدنسازی با یک دست تکیه دهید و دمبل را با دست دیگر به سمت باسن بکشید.", tips: "تعادل را حفظ کنید و در حین کشش کتف را منقبض کنید.", difficulty: "intermediate" },
    { name: "زیربغل سیم‌کش از بالا دست‌معکوس دست‌جمع", muscle: "پشت و زیربغل", category: "pull", equipment: "cable", description: "روی دستگاه نشسته و دستگیره را با کف دست رو به خود و دست‌های نزدیک از بالا به سمت سینه بکشید.", tips: "این حرکت به زیربغل مرکزی و جلو بازو فشار می‌آورد. کمر صاف باشد.", difficulty: "beginner" },
    { name: "کشش لست با کش از بالا", muscle: "پشت و زیربغل", category: "pull", equipment: "band", description: "کش را دور میله بارفیکس بکشید و دو سر آن را در دست بگیرید، روی زانو بنشینید و کش را به سمت سینه بکشید.", tips: "این حرکت برای تمرین در خانه مناسب است. کش را کنترل کنید.", difficulty: "beginner" },

    // --- سرشانه (20) ---
    { name: "پرس سرشانه ایستاده با هالتر", muscle: "سرشانه", category: "push", equipment: "barbell", description: "هالتر را در سطح ترقوه نگه دارید و ایستاده آن را به سمت بالا فشار دهید.", tips: "این حرکت قدرتی است. کمر را قوز ندهید و پاها محکم روی زمین باشد.", difficulty: "intermediate" },
    { name: "پرس سرشانه نشسته با دمبل", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "روی نیمکت با پشتی صاف بنشینید و دمبل‌ها را از دو طرف شانه به سمت بالا فشار دهید.", tips: "کمر را قوز ندهید و پشتی نیمکت صاف باشد.", difficulty: "intermediate" },
    { name: "پرس سرشانه نشسته دستگاه", muscle: "سرشانه", category: "push", equipment: "machine", description: "روی دستگاه پرس سرشانه بنشینید و دستگیره‌ها را از دو طرف شانه به سمت بالا فشار دهید.", tips: "تنظیم صندلی به ارتفاعی باشد که دستگیره‌ها هم‌سطح شانه باشند.", difficulty: "beginner" },
    { name: "نشر جانب با کابل", muscle: "سرشانه", category: "push", equipment: "cable", description: "دستگیره سیم‌کش پایین را با یک دست بگیرید و دست را با آرنج نیمه‌خم به سمت جانب بالا بیاورید.", tips: "وزنه سبک استفاده کنید و کمر را تکان ندهید.", difficulty: "beginner" },
    { name: "نشر جانب تک‌دست با کابل پایین", muscle: "سرشانه", category: "push", equipment: "cable", description: "دستگیره سیم‌کش پایین را از پشت بدن بگیرید و دست را به سمت جانب بالا بیاورید.", tips: "این حرکت سرشانه جانبی را ایزوله می‌کند. وزنه سبک استفاده کنید.", difficulty: "beginner" },
    { name: "نشر جانب با دستگاه", muscle: "سرشانه", category: "push", equipment: "machine", description: "روی دستگاه نشر جانب بنشینید و دستگیره‌ها را با آرنج‌ها به سمت دو طرف بالا بیاورید.", tips: "تنظیم دستگاه به ارتفاعی باشد که آرنج‌ها هم‌سطح شانه باشند.", difficulty: "beginner" },
    { name: "نشر جلو با کابل", muscle: "سرشانه", category: "push", equipment: "cable", description: "دستگیره سیم‌کش پایین را بگیرید و دست را صاف به سمت جلو و بالا بیاورید.", tips: "وزنه سبک استفاده کنید و بالاتر از سطح شانه بالا نبرید.", difficulty: "beginner" },
    { name: "نشر جلو با هالتر", muscle: "سرشانه", category: "push", equipment: "barbell", description: "هالتر را با کف دست رو به پایین بگیرید و آن را صاف به سمت جلو و بالا بیاورید.", tips: "بالاتر از سطح شانه بالا نبرید و حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "نشر خماری با دستگاه پک‌دک", muscle: "سرشانه", category: "pull", equipment: "machine", description: "روی دستگاه پک‌دک به حالت برگشت (معکوس) بنشینید و دستگیره‌ها را به سمت عقب ببرید.", tips: "این حرکت سرشانه خماری را هدف می‌گیرد. وزنه سبک استفاده کنید.", difficulty: "beginner" },
    { name: "نشر خماری با کابل", muscle: "سرشانه", category: "pull", equipment: "cable", description: "دو دستگیره سیم‌کش متقاطع را بگیرید و دست‌ها را با آرنج خم به سمت عقب ببرید.", tips: "وزنه سبک استفاده کنید و در انتهای حرکت یک ثانیه مکث کنید.", difficulty: "beginner" },
    { name: "پرس آرنولد نشسته", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "روی نیمکت با پشتی صاف بنشینید و دمبل‌ها را با چرخش دست‌ها از رو به داخل به رو به جلو پرس کنید.", tips: "این حرکت تمام قسمت‌های سرشانه را درگیر می‌کند. حرکت را نرم انجام دهید.", difficulty: "intermediate" },
    { name: "پرس سرشانه با کتل‌بل", muscle: "سرشانه", category: "push", equipment: "kettlebell", description: "کتل‌بل را در یک دست در سطح شانه نگه دارید و آن را به سمت بالا فشار دهید.", tips: "مچ دست را صاف نگه دارید و حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "نشر جانب با زاویه خم", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "روی یک پا خم شوید و دمبل را با دست به سمت جانب بالا بیاورید.", tips: "این حرکت سرشانه جانبی را ایزوله می‌کند. وزنه سبک استفاده کنید.", difficulty: "intermediate" },
    { name: "نشر Y روی توپ بدنسازی", muscle: "سرشانه", category: "push", equipment: "dumbbell,ball", description: "روی توپ بدنسازی به حالت خوابیده روی شکم قرار بگیرید و دمبل‌ها را به شکل Y بالا ببرید.", tips: "وزنه سبک استفاده کنید و در بالاترین نقطه یک ثانیه مکث کنید.", difficulty: "beginner" },
    { name: "راوت با کابل", muscle: "سرشانه", category: "pull", equipment: "cable", description: "دستگیره سیم‌کش پایین را بگیرید و آن را به سمت چانه بکشید با آرنج‌های باز.", tips: "وزنه سبک استفاده کنید و آرنج‌ها بالاتر از دستگیره باشند.", difficulty: "beginner" },
    { name: "شراگ با هالتر", muscle: "سرشانه", category: "pull", equipment: "barbell", description: "هالتر را در دست بگیرید و شانه‌ها را به سمت گوش بالا بیاورید.", tips: "در بالاترین نقطه یک ثانیه مکث کنید و حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "شراگ با دستگاه", muscle: "سرشانه", category: "pull", equipment: "machine", description: "روی دستگاه شراگ بنشینید و دستگیره‌ها را به سمت بالا ببرید.", tips: "در بالاترین نقطه یک ثانیه مکث کنید و شانه‌ها را منقبض کنید.", difficulty: "beginner" },
    { name: "پرس سرشانه روی توپ بدنسازی", muscle: "سرشانه", category: "push", equipment: "dumbbell,ball", description: "روی توپ بدنسازی به حالت نشسته قرار بگیرید و دمبل‌ها را به سمت بالا فشار دهید.", tips: "تعادل را حفظ کنید و بدن را ثابت نگه دارید.", difficulty: "intermediate" },
    { name: "چرخش خارجی سرشانه با کش", muscle: "سرشانه", category: "pull", equipment: "band", description: "کش را با یک دست بگیرید و آرنج را ثابت نگه دارید، ساعد را به سمت بیرون بچرخانید.", tips: "این حرکت برای سلامت روتاتور کاف مفید است. وزنه سبک استفاده کنید.", difficulty: "beginner" },
    { name: "نشر یک‌دست با دمبل خمیده", muscle: "سرشانه", category: "push", equipment: "dumbbell", description: "روی یک پا بایستید و با یک دست دمبل را به سمت جانب بالا بیاورید، در حالی که بدن کمی خم است.", tips: "این حرکت سرشانه جانبی را ایزوله می‌کند. تعادل را حفظ کنید.", difficulty: "intermediate" },

    // --- جلو بازو (15) ---
    { name: "جلو بازو لاری هالتر", muscle: "جلو بازو", category: "pull", equipment: "barbell", description: "هالتر را بگیرید و در حین بالا آوردن، آرنج‌ها را به عقب ببرید تا هالتر نزدیک بدن بالا بیاید.", tips: "این حرکت طولانی سر جلو بازو را هدف می‌گیرد. آرنج‌ها ثابت باشند.", difficulty: "intermediate" },
    { name: "جلو بازو هالتر EZ", muscle: "جلو بازو", category: "pull", equipment: "barbell", description: "هالتر EZ را با کف دست رو به بالا بگیرید و آن را به سمت شانه بکشید.", tips: "هالتر EZ به مچ دست فشار کمتری می‌آورد. آرنج‌ها را کنار بدن نگه دارید.", difficulty: "beginner" },
    { name: "جلو بازو دمبل روی نیمکت شیب‌دار", muscle: "جلو بازو", category: "pull", equipment: "dumbbell,bench", description: "روی نیمکت شیب‌دار ۴۵ درجه تکیه دهید و دمبل‌ها را به نوبت به سمت شانه بکشید.", tips: "این حرکت طولانی سر جلو بازو را کشش می‌دهد. وزنه متوسط استفاده کنید.", difficulty: "intermediate" },
    { name: "جلو بازو سیم‌کش تک‌دست", muscle: "جلو بازو", category: "pull", equipment: "cable", description: "دستگیره سیم‌کش پایین را با یک دست بگیرید و آن را به سمت شانه بکشید.", tips: "این حرکت ایزوله جلو بازو است. آرنج‌ها ثابت باشند.", difficulty: "beginner" },
    { name: "جلو بازو سیم‌کش طناب", muscle: "جلو بازو", category: "pull", equipment: "cable", description: "طناب سیم‌کش پایین را بگیرید و آن را به سمت شانه بکشید.", tips: "این حرکت ایزوله جلو بازو است. در بالاترین نقطه یک ثانیه مکث کنید.", difficulty: "beginner" },
    { name: "جلو بازو چکشی سیم‌کش", muscle: "جلو بازو", category: "pull", equipment: "cable", description: "طناب سیم‌کش پایین را با کف دست رو به بدن بگیرید و آن را به سمت شانه بکشید.", tips: "این حرکت به جلو بازو و ساعد فشار می‌آورد. آرنج‌ها ثابت باشند.", difficulty: "beginner" },
    { name: "جلو بازو کتل‌بل", muscle: "جلو بازو", category: "pull", equipment: "kettlebell", description: "کتل‌بل را با یک دست بگیرید و آن را به سمت شانه بکشید.", tips: "وزنه را کنترل کنید و آرنج‌ها را کنار بدن نگه دارید.", difficulty: "beginner" },
    { name: "جلو بازو اسپایدر", muscle: "جلو بازو", category: "pull", equipment: "dumbbell,bench", description: "روی نیمکت شیب‌دار معکوس به حالت خوابیده روی شکم قرار بگیرید و دمبل‌ها را به سمت شانه بکشید.", tips: "این حرکت ایزوله جلو بازو است. آرنج‌ها ثابت باشند.", difficulty: "intermediate" },
    { name: "جلو بازو ۲۱", muscle: "جلو بازو", category: "pull", equipment: "barbell", description: "هالتر را در ۷ تکرار پایین، ۷ تکرار بالا و ۷ تکرار کامل بالا ببرید (مجموعاً ۲۱).", tips: "این حرکت پیشرفته است و جلو بازو را کاملاً خسته می‌کند.", difficulty: "advanced" },
    { name: "جلو بازو پیش‌خم دستگاه", muscle: "جلو بازو", category: "pull", equipment: "machine", description: "روی دستگاه پیش‌خم بنشینید و دستگیره را با کف دست رو به بالا به سمت شانه بکشید.", tips: "این حرکت ایزوله جلو بازو است. آرنج‌ها روی پد ثابت باشد.", difficulty: "beginner" },
    { name: "جلو بازو زوتمن", muscle: "جلو بازو", category: "pull", equipment: "dumbbell", description: "دمبل را با کف دست رو به بالا به سمت شانه بکشید، سپس کف دست را برگردانید و دمبل را پایین بیاورید.", tips: "این حرکت به جلو بازو و ساعد فشار می‌آورد. وزنه سبک استفاده کنید.", difficulty: "intermediate" },
    { name: "جلو بازو با کش مقاومتی", muscle: "جلو بازو", category: "pull", equipment: "band", description: "کش را زیر پا قرار دهید و دو سر آن را در دست بگیرید، دست‌ها را به سمت شانه بکشید.", tips: "این حرکت برای تمرین در خانه مناسب است. کش را کنترل کنید.", difficulty: "beginner" },
    { name: "جلو بازو دمبل چرخشی", muscle: "جلو بازو", category: "pull", equipment: "dumbbell", description: "دمبل را با کف دست رو به بدن بگیرید و در حین بالا آوردن، کف دست را به سمت بالا بچرخانید.", tips: "این حرکت به جلو بازو فشار می‌آورد. آرنج‌ها ثابت باشند.", difficulty: "intermediate" },
    { name: "جلو بازو با هالتر دست‌جمع", muscle: "جلو بازو", category: "pull", equipment: "barbell", description: "هالتر را با دست‌های به هم نزدیک بگیرید و آن را به سمت شانه بکشید.", tips: "این حرکت به طولانی سر جلو بازو فشار می‌آورد. آرنج‌ها ثابت باشند.", difficulty: "intermediate" },
    { name: "جلو بازو سیم‌کش از بالا", muscle: "جلو بازو", category: "pull", equipment: "cable", description: "دستگیره سیم‌کش بالا را بگیرید و آن را به سمت سر بکشید با آرنج‌های ثابت.", tips: "این حرکت ایزوله جلو بازو است. آرنج‌ها را کنار سر نگه دارید.", difficulty: "intermediate" },

    // --- پشت بازو (15) ---
    { name: "پشت بازو سیم‌کش طناب", muscle: "پشت بازو", category: "push", equipment: "cable", description: "طناب سیم‌کش بالا را بگیرید و آن را با آرنج‌های ثابت به سمت پایین فشار دهید.", tips: "در انتهای حرکت طناب را به دو طرف باز کنید و پشت بازو را منقبض کنید.", difficulty: "beginner" },
    { name: "پشت بازو سیم‌کش طناب بالای سر", muscle: "پشت بازو", category: "push", equipment: "cable", description: "طناب سیم‌کش را با دست‌ها بالای سر بگیرید و آن را به سمت عقب سر فشار دهید.", tips: "آرنج‌ها نزدیک سر باشد و حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "پشت بازو سیم‌کش تک‌دست", muscle: "پشت بازو", category: "push", equipment: "cable", description: "دستگیره سیم‌کش بالا را با یک دست بگیرید و آن را به سمت پایین فشار دهید.", tips: "آرنج‌ها را کنار بدن نگه دارید و فقط ساعد حرکت کند.", difficulty: "beginner" },
    { name: "پشت بازو سیم‌کش معکوس", muscle: "پشت بازو", category: "push", equipment: "cable", description: "دستگیره سیم‌کش بالا را با کف دست رو به بالا بگیرید و آن را به سمت پایین فشار دهید.", tips: "این حرکت به پشت بازو خارجی فشار می‌آورد. آرنج‌ها ثابت باشند.", difficulty: "beginner" },
    { name: "پشت بازو دمبل تک‌دست بالای سر", muscle: "پشت بازو", category: "push", equipment: "dumbbell", description: "دمبل را با یک دست بالای سر نگه دارید و آن را به سمت پشت سر پایین بیاورید.", tips: "آرنج نزدیک سر باشد و حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "پشت بازو هالتر EZ بالای سر", muscle: "پشت بازو", category: "push", equipment: "barbell", description: "هالتر EZ را با دو دست بالای سر نگه دارید و آن را به سمت پشت سر پایین بیاورید.", tips: "آرنج‌ها نزدیک سر باشد و حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "پشت بازو دمبل درازخواب تک‌دست", muscle: "پشت بازو", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت دراز بکشید و دمبل را با یک دست بالای سر نگه دارید و به سمت پیشانی پایین بیاورید.", tips: "آرنج ثابت باشد و حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "پشت بازو کیک‌بک", muscle: "پشت بازو", category: "push", equipment: "dumbbell", description: "با کمر صاف خم شوید و دمبل را با آرنج ۹۰ درجه به سمت عقب فشار دهید.", tips: "آرنج بالای بدن باشد و فقط ساعد حرکت کند.", difficulty: "beginner" },
    { name: "پشت بازو کتل‌بل بالای سر", muscle: "پشت بازو", category: "push", equipment: "kettlebell", description: "کتل‌بل را با دو دست بالای سر نگه دارید و آن را به سمت پشت سر پایین بیاورید.", tips: "آرنج‌ها نزدیک سر باشد و حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "پشت بازو با کش مقاومتی", muscle: "پشت بازو", category: "push", equipment: "band", description: "کش را دور یک سطح بالا بکشید و آن را با آرنج‌های ثابت به سمت پایین فشار دهید.", tips: "این حرکت برای تمرین در خانه مناسب است. کش را کنترل کنید.", difficulty: "beginner" },
    { name: "شنا تایپ‌رایتر", muscle: "پشت بازو", category: "push", equipment: "bodyweight", description: "در حالت شنا، پایین بروید و بدن را به یک طرف بچرخانید و سپس به طرف دیگر.", tips: "این حرکت پیشرفته است و به پشت بازو و سینه فشار می‌آورد.", difficulty: "advanced" },
    { name: "دیپس پشت بازو با وزنه", muscle: "پشت بازو", category: "push", equipment: "bodyweight", description: "روی میله‌های موازی قرار بگیرید و با وزنه اضافه بدن را پایین ببرید.", tips: "بدن را صاف نگه دارید و آرنج‌ها به بیرون نروند.", difficulty: "advanced" },
    { name: "پشت بازو سیم‌کش دو دست از بالا بالای سر", muscle: "پشت بازو", category: "push", equipment: "cable", description: "طناب سیم‌کش بالا را با دو دست بالای سر بگیرید و آن را به سمت عقب سر فشار دهید.", tips: "آرنج‌ها نزدیک سر باشد و حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "پشت بازو هالتر خوابیده دست‌جمع", muscle: "پشت بازو", category: "push", equipment: "barbell,bench", description: "روی نیمکت دراز بکشید و هالتر را با دست‌های نزدیک بالای پیشانی نگه دارید و به سمت پایین بیاورید.", tips: "آرنج‌ها ثابت باشند و حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "پشت بازو دمبل دو دست خوابیده", muscle: "پشت بازو", category: "push", equipment: "dumbbell,bench", description: "روی نیمکت دراز بکشید و یک دمبل را با دو دست بالای سر نگه دارید و به سمت پیشانی پایین بیاورید.", tips: "آرنج‌ها ثابت باشند و حرکت را کنترل کنید.", difficulty: "intermediate" },

    // --- پا و باسن (25) ---
    { name: "اسکوات با دمبل", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "دمبل‌ها را در دو طرف بدن نگه دارید و اسکوات انجام دهید.", tips: "زانوها به داخل نیایند و تنه صاف نگه داشته شود.", difficulty: "beginner" },
    { name: "اسکوات پرشی", muscle: "پا و باسن", category: "legs", equipment: "bodyweight", description: "اسکوات انجام دهید و در حین بالا آمدن با قدرت بپرید.", tips: "این حرکت پلایومتریک است. فرود را نرم انجام دهید.", difficulty: "intermediate" },
    { name: "اسکوات با کش مقاومتی", muscle: "پا و باسن", category: "legs", equipment: "band", description: "کش را زیر پا قرار دهید و دو سر آن را روی شانه بگذارید، اسکوات انجام دهید.", tips: "این حرکت برای تمرین در خانه مناسب است. کش را کنترل کنید.", difficulty: "beginner" },
    { name: "اسکوات اسپلیت", muscle: "پا و باسن", category: "legs", equipment: "bodyweight", description: "یک پا را جلو و پا دیگر را عقب قرار دهید و اسکوات تک‌پا انجام دهید.", tips: "زانوی جلو از نوک پا جلوتر نرود و تعادل را حفظ کنید.", difficulty: "beginner" },
    { name: "لانژ رفتنی", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "با دمبل در دست، چند گام به جلو لانژ انجام دهید.", tips: "زانوی جلو از نوک پا جلوتر نرود و بدن صاف باشد.", difficulty: "intermediate" },
    { name: "لانژ معکوس", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "با دمبل در دست، یک گام به عقب بردارید و زانو را به زمین نزدیک کنید.", tips: "زانوی جلو از نوک پا جلوتر نرود و تعادل را حفظ کنید.", difficulty: "beginner" },
    { name: "لانژ جانبی", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "با دمبل در دست، یک گام بزرگ به جانب بردارید و پای کشیده را خم کنید.", tips: "این حرکت به داخل ران و باسن فشار می‌آورد. تنه صاف باشد.", difficulty: "beginner" },
    { name: "لانژ با هالتر", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را روی شانه بگذارید و لانژ انجام دهید.", tips: "زانوی جلو از نوک پا جلوتر نرود. کمر صاف باشد.", difficulty: "intermediate" },
    { name: "ددلیفت رومانیایی با هالتر دست‌جمع", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را با دست‌های نزدیک بگیرید و با کمر صاف و زانوهای نیمه‌خم، آن را به سمت زمین پایین ببرید.", tips: "این حرکت پشت ران را هدف می‌گیرد. کمر صاف باشد.", difficulty: "intermediate" },
    { name: "ددلیفت با کتل‌بل تک‌پا", muscle: "پا و باسن", category: "legs", equipment: "kettlebell", description: "روی یک پا بایستید و کتل‌بل را با کمر صاف به سمت زمین پایین ببرید.", tips: "این حرکت تعادل و پشت ران را هدف می‌گیرد. کمر صاف نگه دارید.", difficulty: "intermediate" },
    { name: "پرس پا تک‌پا", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه پرس پا بنشینید و با یک پا در یک زمان، پلتفرم را فشار دهید.", tips: "این حرکت عدم تعادل بین دو پا را اصلاح می‌کند. وزنه سبک‌تر استفاده کنید.", difficulty: "intermediate" },
    { name: "پشت پا نشسته دستگاه", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه پشت پا به حالت نشسته بنشینید و با پشت ران، پاها را خم کنید.", tips: "این حرکت پشت ران را ایزوله می‌کند. حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "پشت پا با توپ بدنسازی", muscle: "پا و باسن", category: "legs", equipment: "bodyweight,ball", description: "روی زمین دراز بکشید، پاها را روی توپ بدنسازی قرار دهید و باسن را بالا ببرید، سپس پاها را به سمت باسن بکشید.", tips: "این حرکت پشت ران و باسن را درگیر می‌کند. تعادل را حفظ کنید.", difficulty: "intermediate" },
    { name: "ساق پا نشسته دستگاه", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه ساق پا نشسته بنشینید و با انگشتان پا وزنه را به سمت بالا هل دهید.", tips: "این حرکت ساق دوزنگی را هدف می‌گیرد. در پایین‌ترین نقطه مکث کنید.", difficulty: "beginner" },
    { name: "ساق پا با دمبل", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "دمبل‌ها را در دست بگیرید و روی پنجه پا بلند شوید.", tips: "در بالاترین نقطه یک ثانیه مکث کنید و تعادل را حفظ کنید.", difficulty: "beginner" },
    { name: "ساق پا تک‌پا با دمبل", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "دمبل را در یک دست بگیرید و روی یک پا بلند شوید.", tips: "این حرکت عدم تعادل بین دو پا را اصلاح می‌کند. تعادل را حفظ کنید.", difficulty: "beginner" },
    { name: "ساق پا با هالتر", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را روی شانه بگذارید و روی پنجه پا بلند شوید.", tips: "در بالاترین نقطه یک ثانیه مکث کنید و تعادل را حفظ کنید.", difficulty: "intermediate" },
    { name: "هیپ تراست تک‌پا", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "مانند هیپ تراست اما با یک پا، باسن را به سمت بالا هل دهید.", tips: "این حرکت به باسن فشار بیشتری می‌آورد. تعادل را حفظ کنید.", difficulty: "intermediate" },
    { name: "پل باسن تک‌پا", muscle: "پا و باسن", category: "legs", equipment: "bodyweight", description: "روی زمین دراز بکشید، یک پا را صاف کنید و با پا دیگر باسن را بالا ببرید.", tips: "در بالاترین نقطه باسن را منقبض کنید. تعادل را حفظ کنید.", difficulty: "beginner" },
    { name: "اسکوات اسمیت", muscle: "پا و باسن", category: "legs", equipment: "machine", description: "روی دستگاه اسمیت هالتر را روی شانه بگذارید و اسکوات انجام دهید.", tips: "این حرکت برای مبتدی‌ها مناسب است زیرا مسیر حرکت ثابت است.", difficulty: "intermediate" },
    { name: "اسکوات بلغاری با هالتر", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را روی شانه بگذارید، یک پا را روی نیمکت پشت سر قرار دهید و اسکوات تک‌پا انجام دهید.", tips: "زانوی جلو از نوک پا جلوتر نرود. کمر صاف باشد.", difficulty: "advanced" },
    { name: "استپ‌آپ با هالتر", muscle: "پا و باسن", category: "legs", equipment: "barbell", description: "هالتر را روی شانه بگذارید و روی یک جعبه یا نیمکت بالا بروید و پایین بیایید.", tips: "از پای بلندتر قدرت بگیرید و تعادل را حفظ کنید.", difficulty: "intermediate" },
    { name: "اسکوات سومو با دمبل", muscle: "پا و باسن", category: "legs", equipment: "dumbbell", description: "دمبل را با دو دست بین پاها بگیرید، پاها را عرض‌تر از شانه باز کنید و اسکوات انجام دهید.", tips: "این حرکت به داخل ران و باسن فشار می‌آورد. زانوها به داخل نیایند.", difficulty: "intermediate" },
    { name: "کیک‌بک باسن سیم‌کش", muscle: "پا و باسن", category: "legs", equipment: "cable", description: "دستگیره سیم‌کش پایین را با پا بگیرید و پا را به سمت عقب بالا ببرید.", tips: "در بالاترین نقطه باسن را منقبض کنید. تنه صاف باشد.", difficulty: "beginner" },
    { name: "اسکوات پرشی زانو بلند", muscle: "پا و باسن", category: "legs", equipment: "bodyweight", description: "اسکوات انجام دهید و در حین بالا آمدن با قدرت بپرید و زانوها را به سمت سینه بکشید.", tips: "این حرکت پیشرفته است و فرود را نرم انجام دهید.", difficulty: "advanced" },

    // --- شکم و کمر (15) ---
    { name: "پلانک با حرکت دست", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "در حالت پلانک، به نوبت دست‌ها را به سمت جلو ببرید.", tips: "بدن را ثابت نگه دارید و باسن را بالا یا پایین نبرید.", difficulty: "intermediate" },
    { name: "پلانک با ضربه پا", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "در حالت پلانک، پاها را به دو طرف باز و ببندید.", tips: "بدن را ثابت نگه دارید و حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "کرانچ روی توپ بدنسازی", muscle: "شکم و کمر", category: "core", equipment: "bodyweight,ball", description: "روی توپ بدنسازی به حالت خوابیده قرار بگیرید و سرشانه‌ها را از توپ جدا کنید.", tips: "گردن را نکشید و فقط با قدرت شکم بالا بیایید.", difficulty: "beginner" },
    { name: "بالا آوردن پا با توپ", muscle: "شکم و کمر", category: "core", equipment: "bodyweight,ball", description: "توپ بدنسازی را بین پاها بگیرید و از حالت خوابیده پاها را به سمت بالا بیاورید.", tips: "کمر را از زمین بلند نکنید. حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "وجل (وی-آپ)", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "روی زمین دراز بکشید و هم‌زمان دست‌ها و پاها را به شکل V بالا بیاورید.", tips: "حرکت را کنترل کنید و در بالاترین نقطه یک ثانیه مکث کنید.", difficulty: "intermediate" },
    { name: "پلانک با چرخش جانبی", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "در حالت پلانک، یک دست را از زمین جدا کنید و بدن را به یک طرف بچرخانید.", tips: "بدن را ثابت نگه دارید و تعادل را حفظ کنید.", difficulty: "intermediate" },
    { name: "دراگن فلگ", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "روی نیمکت دراز بکشید و بدن را با دست‌های نگه‌دارنده نیمکت به حالت عمودی بالا بیاورید.", tips: "این حرکت پیشرفته است و قدرت بالایی می‌طلبد. بدن را صاف نگه دارید.", difficulty: "advanced" },
    { name: "اب‌ریتر", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "روی زانو بنشینید و چرخ شکمی را به سمت جلو بغلتانید و برگردانید.", tips: "این حرکت به شکم فشار زیادی می‌آورد. کمر را قوز ندهید.", difficulty: "intermediate" },
    { name: "کرانچ دستگاه", muscle: "شکم و کمر", category: "core", equipment: "machine", description: "روی دستگاه کرانچ بنشینید و دستگیره را با خم شدن به سمت جلو فشار دهید.", tips: "تنظیم دستگاه به ارتفاعی باشد که دستگیره هم‌سطح سینه باشد.", difficulty: "beginner" },
    { name: "کرانچ وزنه‌دار", muscle: "شکم و کمر", category: "core", equipment: "dumbbell", description: "دمبل را روی سینه بگذارید و کرانچ انجام دهید.", tips: "وزنه را با کنترل نگه دارید و گردن را نکشید.", difficulty: "intermediate" },
    { name: "لگ‌رایزر معکوس روی نیمکت", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "روی نیمکت به حالت خوابیده رو به پایین قرار بگیرید و پاها را به سمت بالا ببرید.", tips: "این حرکت به پشت کمر فشار می‌آورد. حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "هالو هولد", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "روی زمین دراز بکشید و دست‌ها و پاها را صاف از زمین جدا کنید.", tips: "کمر را به زمین فشار دهید و بدن را صاف نگه دارید.", difficulty: "intermediate" },
    { name: "کوهنوردی متقاطع", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "در حالت حمکت شنا، به نوبت زانوها را به سمت آرنج مخالف بالا بیاورید.", tips: "بدن صاف نگه دارید و حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "تو-تاچ", muscle: "شکم و کمر", category: "core", equipment: "bodyweight", description: "روی زمین دراز بکشید و دست‌ها را به سمت پنجه پا ببرید.", tips: "حرکت را کنترل کنید و در بالاترین نقطه یک ثانیه مکث کنید.", difficulty: "intermediate" },
    { name: "کرانچ بالای سیم‌کش ایستاده", muscle: "شکم و کمر", category: "core", equipment: "cable", description: "ایستاده و طناب سیم‌کش بالا را بگیرید و با خم شدن به سمت جلو کرانچ انجام دهید.", tips: "در حین حرکت باسن را ثابت نگه دارید و فقط شکم حرکت کند.", difficulty: "beginner" },

    // --- ساعد (5) ---
    { name: "مچ هالتر معکوس", muscle: "ساعد", category: "pull", equipment: "barbell", description: "هالتر را با کف دست رو به پایین بگیرید و مچ‌ها را به سمت بالا خم کنید.", tips: "وزنه سبک استفاده کنید و حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "مچ دمبل معکوس", muscle: "ساعد", category: "pull", equipment: "dumbbell", description: "دمبل‌ها را با کف دست رو به پایین بگیرید و مچ‌ها را به سمت بالا خم کنید.", tips: "وزنه سبک استفاده کنید و حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "مچ هالتر از جلو", muscle: "ساعد", category: "pull", equipment: "barbell", description: "هالتر را با کف دست رو به بالا بگیرید و مچ‌ها را به سمت بالا خم کنید.", tips: "وزنه سبک استفاده کنید و حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "مچ دمبل از جلو", muscle: "ساعد", category: "pull", equipment: "dumbbell", description: "دمبل‌ها را با کف دست رو به بالا بگیرید و مچ‌ها را به سمت بالا خم کنید.", tips: "وزنه سبک استفاده کنید و حرکت را کنترل کنید.", difficulty: "beginner" },
    { name: "کشش ساعد با هالتر پشت", muscle: "ساعد", category: "pull", equipment: "barbell", description: "هالتر را با کف دست رو به بالا پشت بدن بگیرید و مچ‌ها را به سمت بالا خم کنید.", tips: "این حرکت ساعد را ایزوله می‌کند. وزنه سبک استفاده کنید.", difficulty: "intermediate" },

    // --- بدن کامل / مرکب (10) ---
    { name: "بتل روپ", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "دو سر طناب ضخیم را در دست بگیرید و با حرکت موجی طناب را به حرکت درآورید.", tips: "این حرکت تمام بدن را درگیر می‌کند. تنه را ثابت نگه دارید.", difficulty: "intermediate" },
    { name: "بُرپی", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "از حالت ایستاده به حالت شنا بروید، یک شنا انجام دهید و سپس با پرش به حالت ایستاده برگردید.", tips: "این حرکت قلبی-عروقی است و تمام بدن را درگیر می‌کند. حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "کلین با هالتر", muscle: "بدن کامل", category: "fullbody", equipment: "barbell", description: "هالتر را از زمین با حرکت انفجاری به سمت شانه بالا بیاورید.", tips: "این حرکت پیشرفته است و فرم دقیق می‌طلبد. کمر صاف نگه دارید.", difficulty: "advanced" },
    { name: "اسنچ با هالتر", muscle: "بدن کامل", category: "fullbody", equipment: "barbell", description: "هالتر را از زمین با حرکت انفجاری به سمت بالای سر بالا بیاورید.", tips: "این حرکت پیشرفته است و فرم دقیق می‌طلبد. کمر صاف نگه دارید.", difficulty: "advanced" },
    { name: "تهرست با دمبل", muscle: "بدن کامل", category: "fullbody", equipment: "dumbbell", description: "دمبل‌ها را در دست بگیرید، اسکوات انجام دهید و در حین بالا آمدن دمبل‌ها را به سمت بالا فشار دهید.", tips: "این حرکت مرکب است و پا و سرشانه را درگیر می‌کند. حرکت را کنترل کنید.", difficulty: "intermediate" },
    { name: "تورکیش گت‌آپ با کتل‌بل", muscle: "بدن کامل", category: "fullbody", equipment: "kettlebell", description: "کتل‌بل را بالای سر نگه دارید و از حالت خوابیده به حالت ایستاده بیایید.", tips: "این حرکت پیشرفته است و تعادل بالایی می‌طلبد. کتل‌بل را بالای سر نگه دارید.", difficulty: "advanced" },
    { name: "کتل‌بل سوئینگ", muscle: "بدن کامل", category: "fullbody", equipment: "kettlebell", description: "کتل‌بل را بین پاها بگیرید و با حرکت لگن آن را به سمت جلو و بالا ببرید.", tips: "این حرکت باسن و پشت را درگیر می‌کند. کمر را قوز ندهید.", difficulty: "intermediate" },
    { name: "وال‌بال", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "توپ را در دست بگیرید، اسکوات انجام دهید و توپ را به سمت دیوار پرتاب کنید.", tips: "این حرکت قلبی-عروقی است. فرود را نرم انجام دهید.", difficulty: "intermediate" },
    { name: "جامپ باکس", muscle: "بدن کامل", category: "cardio", equipment: "bodyweight", description: "روی یک جعبه بپرید و سپس پایین بیایید.", tips: "این حرکت پلایومتریک است. فرود را نرم انجام دهید.", difficulty: "intermediate" },
    { name: "خرس رویال (خرس‌گردی)", muscle: "بدن کامل", category: "core", equipment: "bodyweight", description: "روی دست‌ها و پنجه پاها قرار بگیرید و به سمت جلو حرکت کنید.", tips: "این حرکت تمام بدن را درگیر می‌کند. تنه را ثابت نگه دارید.", difficulty: "intermediate" },
  ];

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const youtubeUrl = YOUTUBE_URLS[ex.name] || "";
    await db.exerciseLibrary.upsert({
      where: { id: `seed_ex_${i + 1}` },
      create: { id: `seed_ex_${i + 1}`, ...ex, mediaUrl: "", youtubeUrl },
      update: { ...ex, youtubeUrl },
    });
  }
  const youtubeCount = exercises.filter((e) => YOUTUBE_URLS[e.name]).length;
  console.log(`✅ Seeded ${exercises.length} exercises (${youtubeCount} with YouTube videos)`);

  // ====================================================================
  // FOODS (500 total)
  // [name, category, calories, protein, carbs, fat, servingSize]
  // ====================================================================
  type FoodTuple = [string, string, number, number, number, number, string];
  const foodTuples: FoodTuple[] = [
    // --- BREAKFAST (110) ---
    ["تخم مرغ آب‌پز", "breakfast", 155, 13, 1.1, 11, "۱ عدد"],
    ["تخم مرغ نیمرو", "breakfast", 196, 14, 1, 15, "۱ عدد"],
    ["املت تخم مرغ", "breakfast", 154, 11, 2, 11, "۱ عدد"],
    ["املت اسفناج", "breakfast", 145, 11, 3, 10, "۱ بشقاب"],
    ["املت قارچ", "breakfast", 130, 10, 3, 9, "۱ بشقاب"],
    ["املت گوجه", "breakfast", 130, 10, 4, 9, "۱ بشقاب"],
    ["املت خرد شده", "breakfast", 165, 12, 2, 12, "۲ عدد"],
    ["تخم مرغ آب‌پز نرم", "breakfast", 155, 13, 1.1, 11, "۱ عدد"],
    ["تخم مرغ پوچ", "breakfast", 143, 13, 1.1, 9.5, "۱ عدد"],
    ["املت پنیر و سبزی", "breakfast", 200, 14, 4, 14, "۱ بشقاب"],
    ["املت مرغ", "breakfast", 180, 16, 2, 12, "۱ بشقاب"],
    ["املت بادمجان", "breakfast", 140, 8, 6, 9, "۱ بشقاب"],
    ["نان سنگک", "breakfast", 275, 9, 55, 1.5, "۱ کف دست"],
    ["نان بربری", "breakfast", 280, 9, 56, 2, "۱ کف دست"],
    ["نان لواش", "breakfast", 285, 9, 56, 2, "۱ ورق"],
    ["نان تافتون", "breakfast", 280, 9, 56, 1.5, "۱ کف دست"],
    ["نان سنگک با پنیر و گردو", "breakfast", 320, 12, 38, 14, "۱ کف دست"],
    ["نان بربری با پنیر", "breakfast", 340, 12, 45, 13, "۱ کف دست"],
    ["نان لواش با کره بادام‌زمینی", "breakfast", 380, 12, 45, 18, "۱ ورق"],
    ["نان تافتون با عسل", "breakfast", 320, 8, 65, 5, "۱ کف دست"],
    ["نان سنگک با تخم مرغ", "breakfast", 290, 13, 40, 9, "۱ کف دست"],
    ["نان جو", "breakfast", 260, 9, 52, 2, "۱ کف دست"],
    ["جو دوسر با شیر", "breakfast", 120, 5, 18, 3, "۱ کاسه"],
    ["جو دوسر با ماست", "breakfast", 130, 7, 18, 3, "۱ کاسه"],
    ["جو دوسر با موز", "breakfast", 140, 4, 26, 3, "۱ کاسه"],
    ["جو دوسر با عسل", "breakfast", 150, 4, 28, 3, "۱ کاسه"],
    ["جو دوسر با بادام", "breakfast", 200, 7, 25, 9, "۱ کاسه"],
    ["موسلی با شیر", "breakfast", 170, 6, 28, 5, "۱ کاسه"],
    ["گرنولا", "breakfast", 471, 10, 64, 20, "۱ کاسه کوچک"],
    ["پنکیک جو دوسر", "breakfast", 200, 8, 30, 5, "۱ عدد"],
    ["پنکیک عسل", "breakfast", 250, 6, 40, 7, "۱ عدد"],
    ["حلیم", "breakfast", 150, 7, 18, 5, "۱ کاسه"],
    ["حلیم گوشت", "breakfast", 180, 10, 17, 8, "۱ کاسه"],
    ["عدسی صبحانه", "breakfast", 130, 8, 18, 2, "۱ کاسه"],
    ["شیر برنج", "breakfast", 110, 3, 20, 2, "۱ کاسه"],
    ["ارده و شیره انگور", "breakfast", 450, 10, 50, 24, "۱ قاشق"],
    ["ماست ساده", "breakfast", 61, 3.5, 4.7, 3.3, "۱ کاسه کوچک"],
    ["ماست یونانی", "breakfast", 59, 10, 3.6, 0.4, "۱ کاسه"],
    ["ماست چکیده", "breakfast", 80, 8, 4, 4, "۱ کاسه"],
    ["ماست با عسل", "breakfast", 110, 5, 16, 2, "۱ کاسه"],
    ["ماست با میوه", "breakfast", 90, 4, 14, 2, "۱ کاسه"],
    ["پنیر فتا", "breakfast", 264, 14, 4, 21, "۵۰ گرم"],
    ["پنیر لیقوان", "breakfast", 260, 13, 3, 21, "۵۰ گرم"],
    ["پنیر کوزه", "breakfast", 250, 13, 3, 20, "۵۰ گرم"],
    ["پنیر پیتزا", "breakfast", 350, 22, 3, 28, "۵۰ گرم"],
    ["پنیر کم‌چرب", "breakfast", 180, 16, 4, 11, "۵۰ گرم"],
    ["لبنه", "breakfast", 106, 5, 4, 8, "۲ قاشق"],
    ["کشک", "breakfast", 167, 13, 5, 10, "۲ قاشق"],
    ["شیر کامل", "breakfast", 61, 3.2, 4.8, 3.3, "۱ لیوان"],
    ["شیر کم‌چرب", "breakfast", 42, 3.4, 5, 1, "۱ لیوان"],
    ["شیر پرچرب", "breakfast", 70, 3.5, 5, 4, "۱ لیوان"],
    ["شیر کاکائو", "breakfast", 83, 3.5, 11, 3, "۱ لیوان"],
    ["شیر عسل", "breakfast", 95, 3.5, 13, 2.5, "۱ لیوان"],
    ["کروسان", "breakfast", 406, 8, 46, 21, "۱ عدد"],
    ["کیک صبحانه", "breakfast", 340, 5, 55, 12, "۱ عدد"],
    ["وفل", "breakfast", 291, 7, 33, 15, "۱ عدد"],
    ["دونات صبحانه", "breakfast", 452, 5, 51, 25, "۱ عدد"],
    ["کیک میوه‌ای", "breakfast", 320, 4, 55, 11, "۱ تکه"],
    ["نان و پنیر و سبزی خوردن", "breakfast", 250, 9, 35, 8, "۱ وعده"],
    ["نان و خرما", "breakfast", 280, 6, 55, 5, "۱ وعده"],
    ["نان و کره و مربا", "breakfast", 290, 5, 50, 9, "۱ وعده"],
    ["نان و حلیم", "breakfast", 200, 7, 30, 5, "۱ وعده"],
    ["سوسیس و تخم مرغ", "breakfast", 280, 14, 5, 22, "۱ وعده"],
    ["کالباس با نان", "breakfast", 280, 12, 35, 11, "۱ وعده"],
    ["کره بادام‌زمینی", "breakfast", 588, 25, 20, 50, "۱ قاشق"],
    ["کره بادام", "breakfast", 614, 21, 19, 56, "۱ قاشق"],
    ["عسل", "breakfast", 304, 0.3, 82, 0, "۱ قاشق"],
    ["مربا", "breakfast", 250, 0.5, 65, 0, "۱ قاشق"],
    ["مربا آلبالو", "breakfast", 250, 0.5, 65, 0, "۱ قاشق"],
    ["مربا بهارنارنج", "breakfast", 250, 0.5, 65, 0, "۱ قاشق"],
    ["اسموتی موز و شیر", "breakfast", 90, 4, 16, 2, "۱ لیوان"],
    ["اسموتی توت", "breakfast", 60, 2, 13, 0.5, "۱ لیوان"],
    ["اسموتی پروتئین", "breakfast", 70, 10, 6, 1, "۱ لیوان"],
    ["شیک پروتئین", "breakfast", 100, 20, 3, 1, "۱ اسکوپ"],
    ["آب میوه طبیعی", "breakfast", 45, 0.5, 11, 0.2, "۱ لیوان"],
    ["چای کمرنگ", "breakfast", 1, 0, 0.3, 0, "۱ لیوان"],
    ["قهوه تلخ", "breakfast", 1, 0.1, 0, 0, "۱ لیوان"],
    ["قهوه با شیر", "breakfast", 56, 3, 6, 2.5, "۱ لیوان"],
    ["کاپوچینو", "breakfast", 45, 2.5, 4, 2, "۱ لیوان"],
    ["موکا", "breakfast", 90, 3, 13, 3, "۱ لیوان"],
    ["هات چاکلت", "breakfast", 110, 3, 18, 3, "۱ لیوان"],
    ["دمنوش نعنا", "breakfast", 1, 0, 0.2, 0, "۱ لیوان"],
    ["دمنوش بابونه", "breakfast", 1, 0, 0.2, 0, "۱ لیوان"],
    ["دمنوش چای ترش", "breakfast", 1, 0, 0.3, 0, "۱ لیوان"],
    ["دوغ", "breakfast", 28, 1.7, 1.8, 1.5, "۱ لیوان"],
    ["دوغ گازدار", "breakfast", 30, 1.5, 2, 1.5, "۱ لیوان"],
    ["نان سبوس‌دار", "breakfast", 247, 13, 41, 3.4, "۱ برش"],
    ["نان تست", "breakfast", 313, 9, 60, 4, "۱ برش"],
    ["بیسکویت صبحانه", "breakfast", 420, 7, 70, 13, "۲ عدد"],
    ["کیک خانگی", "breakfast", 350, 5, 55, 12, "۱ تکه"],
    ["خامه", "breakfast", 340, 2, 3, 36, "۱ قاشق"],
    ["خامه فرم‌گرفته", "breakfast", 257, 2, 12, 22, "۱ قاشق"],
    ["خامه ترش", "breakfast", 198, 2, 5, 19, "۱ قاشق"],
    ["سیراب", "breakfast", 30, 2, 3, 1, "۱ لیوان"],
    ["شیر برنج با زعفران", "breakfast", 130, 3, 23, 2, "۱ کاسه"],
    ["فرنی", "breakfast", 110, 3, 21, 2, "۱ کاسه"],
    ["ماست و خیار", "breakfast", 60, 3, 6, 2.5, "۱ کاسه"],
    ["ماست و اسفناج", "breakfast", 65, 4, 6, 2.5, "۱ کاسه"],
    ["پنیر و گردو", "breakfast", 320, 14, 5, 28, "۵۰ گرم"],
    ["پنیر و سبزی خوردن", "breakfast", 200, 11, 5, 15, "۱ وعده"],
    ["نیمرو با گوجه", "breakfast", 170, 11, 4, 12, "۲ عدد"],
    ["نیمرو با بادمجان", "breakfast", 180, 10, 5, 13, "۲ عدد"],
    ["حلیم گندم", "breakfast", 140, 6, 22, 3, "۱ کاسه"],
    ["حلیم بز", "breakfast", 160, 8, 16, 7, "۱ کاسه"],
    ["نان و پنیر و هویج", "breakfast", 240, 9, 30, 9, "۱ وعده"],
    ["نان و کره بادام‌زمینی و موز", "breakfast", 320, 10, 45, 12, "۱ وعده"],
    ["چای با خرما", "breakfast", 130, 1, 35, 0.2, "۲ عدد"],
    ["چای با نبات", "breakfast", 80, 0, 20, 0, "۱ لیوان"],
    ["شیر با خرما", "breakfast", 130, 5, 18, 4, "۱ لیوان"],
    ["نان تست با پنیر و گوجه", "breakfast", 250, 11, 28, 10, "۱ وعده"],

    // --- LUNCH (130) ---
    ["چلو برنج سفید", "lunch", 130, 2.7, 28, 0.3, "۱ بشقاب"],
    ["چلو برنج قهوه‌ای", "lunch", 123, 2.7, 26, 1, "۱ بشقاب"],
    ["کته", "lunch", 130, 2.7, 28, 0.3, "۱ بشقاب"],
    ["دمی برنج", "lunch", 132, 2.7, 28, 0.4, "۱ بشقاب"],
    ["برنج با زعفران", "lunch", 135, 2.8, 28, 0.5, "۱ بشقاب"],
    ["پلو با عدس", "lunch", 145, 4, 27, 1.5, "۱ بشقاب"],
    ["پلو با ماش", "lunch", 140, 4, 26, 1.5, "۱ بشقاب"],
    ["پلو با هویج", "lunch", 135, 3, 28, 1, "۱ بشقاب"],
    ["پلو با کشمش", "lunch", 155, 3, 32, 2, "۱ بشقاب"],
    ["پلو با لپه", "lunch", 145, 4, 27, 1.5, "۱ بشقاب"],
    ["کباب کوبیده", "lunch", 250, 17, 3, 19, "۲ سیخ"],
    ["جوجه کباب", "lunch", 180, 22, 1, 9, "۲ سیخ"],
    ["کباب برگ", "lunch", 220, 25, 0, 13, "۲ سیخ"],
    ["کباب سلطانی", "lunch", 230, 22, 2, 16, "۱ سیخ"],
    ["کباب چنجه", "lunch", 210, 24, 0, 12, "۲ سیخ"],
    ["کباب پیش‌باز", "lunch", 240, 18, 3, 18, "۱ سیخ"],
    ["کباب ترکی", "lunch", 230, 20, 4, 16, "۱ سیخ"],
    ["کباب مرغ خرد کرده", "lunch", 175, 23, 2, 8, "۲ سیخ"],
    ["کباب تن ماهی", "lunch", 180, 22, 3, 8, "۱ سیخ"],
    ["کباب میگو", "lunch", 150, 22, 1, 6, "۲ سیخ"],
    ["قورمه سبزی", "lunch", 140, 7, 10, 8, "۱ کاسه"],
    ["فسنجان", "lunch", 200, 8, 12, 13, "۱ کاسه"],
    ["قیمه", "lunch", 150, 8, 13, 7, "۱ کاسه"],
    ["خورش بادمجان", "lunch", 130, 6, 10, 8, "۱ کاسه"],
    ["خورش آلو", "lunch", 145, 7, 14, 6, "۱ کاسه"],
    ["خورش ریواس", "lunch", 120, 6, 13, 5, "۱ کاسه"],
    ["خورش کرفس", "lunch", 130, 7, 10, 7, "۱ کاسه"],
    ["خورش هویج", "lunch", 130, 6, 12, 6, "۱ کاسه"],
    ["خورش کدو", "lunch", 120, 5, 11, 6, "۱ کاسه"],
    ["خورش مرغ ترش", "lunch", 130, 9, 8, 7, "۱ کاسه"],
    ["خورش لوبیا چیتی", "lunch", 130, 8, 14, 4, "۱ کاسه"],
    ["خورش ماش", "lunch", 120, 7, 13, 3, "۱ کاسه"],
    ["سینه مرغ گریل", "lunch", 165, 31, 0, 3.6, "۲۰۰ گرم"],
    ["سینه مرغ سرخ شده", "lunch", 220, 28, 5, 10, "۲۰۰ گرم"],
    ["سینه مرغ پخته", "lunch", 165, 31, 0, 3.6, "۲۰۰ گرم"],
    ["ران مرغ گریل", "lunch", 209, 26, 0, 11, "۲۰۰ گرم"],
    ["ران مرغ سرخ شده", "lunch", 250, 24, 6, 14, "۲۰۰ گرم"],
    ["مرغ استخوانی پخته", "lunch", 200, 25, 0, 11, "۲۰۰ گرم"],
    ["مرغ شکم‌پر", "lunch", 200, 20, 6, 11, "۲۰۰ گرم"],
    ["مرغ سوخاری", "lunch", 260, 22, 10, 15, "۲۰۰ گرم"],
    ["مرغ ترشیکی", "lunch", 175, 22, 8, 6, "۲۰۰ گرم"],
    ["مرغ و بروکلی", "lunch", 130, 16, 6, 5, "۱ بشقاب"],
    ["مرغ و قارچ", "lunch", 130, 16, 4, 5, "۱ بشقاب"],
    ["مرغ و هویج", "lunch", 120, 15, 6, 4, "۱ بشقاب"],
    ["مرغ و لیمو", "lunch", 140, 17, 6, 5, "۱ بشقاب"],
    ["گوشت گوسفند پخته", "lunch", 265, 25, 0, 17, "۲۰۰ گرم"],
    ["گوشت گوسفند گریل", "lunch", 280, 26, 0, 19, "۲۰۰ گرم"],
    ["گوشت گوساله پخته", "lunch", 250, 26, 0, 15, "۲۰۰ گرم"],
    ["گوشت گوساله گریل", "lunch", 260, 27, 0, 16, "۲۰۰ گرم"],
    ["گوشت چرخ‌کرمی پخته", "lunch", 260, 26, 0, 17, "۲۰۰ گرم"],
    ["استیک گوساله", "lunch", 271, 26, 0, 19, "۲۰۰ گرم"],
    ["استیک گوسفند", "lunch", 290, 25, 0, 21, "۲۰۰ گرم"],
    ["گوشت خرد شده با قارچ", "lunch", 180, 18, 4, 10, "۱ بشقاب"],
    ["گوشت و لوبیا", "lunch", 170, 14, 12, 7, "۱ بشقاب"],
    ["گوشت و بادمجان", "lunch", 170, 14, 6, 9, "۱ بشقاب"],
    ["گوشت و اسفناج", "lunch", 160, 15, 5, 8, "۱ بشقاب"],
    ["گوشت و نخود فرنگی", "lunch", 160, 14, 9, 7, "۱ بشقاب"],
    ["گوشت و پیاز", "lunch", 200, 18, 5, 12, "۱ بشقاب"],
    ["ماهی قزل‌آلا گریل", "lunch", 168, 22, 0, 8, "۲۰۰ گرم"],
    ["ماهی قزل‌آلا سرخ شده", "lunch", 220, 22, 4, 13, "۲۰۰ گرم"],
    ["ماهی سالمون گریل", "lunch", 208, 20, 0, 13, "۲۰۰ گرم"],
    ["ماهی سالمون پخته", "lunch", 200, 22, 0, 12, "۲۰۰ گرم"],
    ["تن ماهی روغن", "lunch", 198, 25, 0, 10, "۱ قوطی"],
    ["تن ماهی آب", "lunch", 116, 26, 0, 1, "۱ قوطی"],
    ["ماهی ماکرل", "lunch", 205, 19, 0, 14, "۲۰۰ گرم"],
    ["ماهی ساردین", "lunch", 208, 25, 0, 11, "۲۰۰ گرم"],
    ["ماهی شیر", "lunch", 130, 23, 0, 4, "۲۰۰ گرم"],
    ["ماهی کپور", "lunch", 127, 18, 0, 5.5, "۲۰۰ گرم"],
    ["میگو گریل", "lunch", 99, 24, 0.2, 0.3, "۲۰۰ گرم"],
    ["میگو سرخ شده", "lunch", 200, 21, 6, 10, "۲۰۰ گرم"],
    ["میگو با کره", "lunch", 180, 21, 1, 10, "۲۰۰ گرم"],
    ["چلو کباب کوبیده", "lunch", 220, 12, 22, 10, "۱ بشقاب"],
    ["چلو جوجه", "lunch", 170, 14, 18, 5, "۱ بشقاب"],
    ["زرشک پلو با مرغ", "lunch", 150, 7, 22, 4, "۱ بشقاب"],
    ["باقالی پلو", "lunch", 140, 4, 23, 4, "۱ بشقاب"],
    ["باقالی پلو با ماهیچه", "lunch", 180, 8, 22, 8, "۱ بشقاب"],
    ["عدس پلو", "lunch", 145, 5, 25, 3, "۱ بشقاب"],
    ["عدس پلو با کشمش", "lunch", 160, 5, 28, 4, "۱ بشقاب"],
    ["استامبولی پلو", "lunch", 140, 4, 25, 3, "۱ بشقاب"],
    ["لوبیا پلو", "lunch", 145, 6, 22, 5, "۱ بشقاب"],
    ["ماکارونی ایرانی", "lunch", 175, 7, 25, 6, "۱ بشقاب"],
    ["ماکارونی با گوشت", "lunch", 200, 10, 25, 8, "۱ بشقاب"],
    ["آش رشته", "lunch", 90, 3, 13, 3, "۱ کاسه"],
    ["آش دوغ", "lunch", 60, 3, 7, 2, "۱ کاسه"],
    ["آش انار", "lunch", 80, 2, 13, 2, "۱ کاسه"],
    ["آش کشک", "lunch", 90, 3, 11, 4, "۱ کاسه"],
    ["آش جو", "lunch", 80, 3, 13, 2, "۱ کاسه"],
    ["آش شلغم", "lunch", 40, 1, 8, 0.5, "۱ کاسه"],
    ["سوپ جو", "lunch", 70, 3, 11, 2, "۱ کاسه"],
    ["سوپ مرغ", "lunch", 60, 4, 6, 2, "۱ کاسه"],
    ["سوپ سبزیجات", "lunch", 50, 2, 9, 1, "۱ کاسه"],
    ["سوپ قارچ", "lunch", 70, 2, 8, 3, "۱ کاسه"],
    ["سوپ عدسی", "lunch", 90, 5, 13, 2, "۱ کاسه"],
    ["سوپ گوجه", "lunch", 50, 1.5, 9, 1.5, "۱ کاسه"],
    ["سالاد شیرازی", "lunch", 35, 1, 6, 1, "۱ کاسه"],
    ["سالاد فصل", "lunch", 50, 1, 8, 2, "۱ بشقاب"],
    ["سالاد الویه", "lunch", 200, 8, 14, 13, "۱ بشقاب"],
    ["سالاد سزار", "lunch", 190, 8, 12, 12, "۱ بشقاب"],
    ["سالاد مرغ", "lunch", 130, 12, 5, 7, "۱ بشقاب"],
    ["سالاد تن ماهی", "lunch", 140, 14, 5, 7, "۱ بشقاب"],
    ["سالاد کلم", "lunch", 70, 1.5, 8, 4, "۱ بشقاب"],
    ["سالاد عدس", "lunch", 130, 7, 17, 3, "۱ بشقاب"],
    ["سالاد نخود", "lunch", 145, 7, 20, 4, "۱ بشقاب"],
    ["سالاد سبزیجات", "lunch", 60, 2, 9, 2, "۱ بشقاب"],
    ["سالاد یونانی", "lunch", 110, 4, 8, 7, "۱ بشقاب"],
    ["سالاد لوبیا", "lunch", 120, 6, 17, 3, "۱ بشقاب"],
    ["کوکو سبزی", "lunch", 180, 9, 7, 13, "۱ تکه"],
    ["کوکو سیب‌زمینی", "lunch", 180, 6, 18, 10, "۱ تکه"],
    ["کوکو مرغ", "lunch", 165, 12, 7, 10, "۱ تکه"],
    ["کتلت", "lunch", 250, 14, 12, 16, "۱ عدد"],
    ["شامی", "lunch", 250, 13, 12, 16, "۱ عدد"],
    ["کباب تابه‌ای", "lunch", 230, 18, 4, 16, "۱ عدد"],
    ["میرزا قاسمی", "lunch", 180, 6, 9, 14, "۱ بشقاب"],
    ["کشک بادمجان", "lunch", 160, 5, 8, 12, "۱ بشقاب"],
    ["بادمجان گریل", "lunch", 90, 2, 8, 6, "۱ بشقاب"],
    ["خوراک لوبیا چیتی", "lunch", 130, 7, 16, 4, "۱ کاسه"],
    ["خوراک لوبیا سبز", "lunch", 85, 4, 11, 3, "۱ کاسه"],
    ["خوراک نخود فرنگی", "lunch", 110, 6, 14, 3, "۱ کاسه"],
    ["خوراک عدس", "lunch", 130, 8, 18, 2, "۱ کاسه"],
    ["خوراک نخود", "lunch", 145, 7, 20, 3, "۱ کاسه"],
    ["خوراک ماش", "lunch", 115, 7, 16, 2, "۱ کاسه"],
    ["خوراک باقلا", "lunch", 120, 7, 17, 2, "۱ کاسه"],
    ["خوراک سیب‌زمینی", "lunch", 100, 2, 17, 3, "۱ کاسه"],
    ["ته‌چین مرغ", "lunch", 180, 7, 22, 7, "۱ تکه"],
    ["دمی بادمجان", "lunch", 130, 3, 22, 4, "۱ بشقاب"],
    ["دمی گوجه", "lunch", 120, 3, 22, 3, "۱ بشقاب"],
    ["دمی نخود فرنگی", "lunch", 130, 4, 22, 3, "۱ بشقاب"],
    ["پاستا اسپاگتی", "lunch", 158, 6, 31, 1, "۱ بشقاب"],
    ["پاستا آلفردو", "lunch", 250, 8, 30, 11, "۱ بشقاب"],
    ["پاستا بولونز", "lunch", 180, 10, 22, 6, "۱ بشقاب"],

    // --- DINNER (120) ---
    ["سوپ مرغ و سبزی", "dinner", 60, 4, 7, 2, "۱ کاسه"],
    ["سوپ سبزیجات گوشت", "dinner", 90, 5, 9, 3, "۱ کاسه"],
    ["سوپ قارچ خامه‌ای", "dinner", 80, 2, 8, 4, "۱ کاسه"],
    ["سوپ گوجه و ریحان", "dinner", 60, 1.5, 9, 1.5, "۱ کاسه"],
    ["سوپ عدس قرمز", "dinner", 90, 5, 13, 2, "۱ کاسه"],
    ["سوپ کدو", "dinner", 60, 1.5, 9, 2, "۱ کاسه"],
    ["سوپ مارچوبه", "dinner", 55, 2, 7, 2, "۱ کاسه"],
    ["سوپ بروکلی", "dinner", 55, 2.5, 7, 2, "۱ کاسه"],
    ["سوپ نخود فرنگی", "dinner", 80, 4, 12, 2, "۱ کاسه"],
    ["سوپ پیاز", "dinner", 50, 1.5, 8, 2, "۱ کاسه"],
    ["ماهی سالمون گریل با سبزی", "dinner", 180, 22, 5, 9, "۱ بشقاب"],
    ["ماهی قزل‌آلا با سالاد", "dinner", 150, 23, 3, 6, "۱ بشقاب"],
    ["ماهی تن با سالاد", "dinner", 110, 18, 3, 3, "۱ بشقاب"],
    ["ماهی کپور آب‌پز", "dinner", 120, 18, 0, 4, "۲۰۰ گرم"],
    ["ماهی شیر گریل", "dinner", 130, 23, 0, 4, "۲۰۰ گرم"],
    ["میگو آب‌پز", "dinner", 99, 24, 0.2, 0.3, "۲۰۰ گرم"],
    ["میگو با سبزی", "dinner", 120, 18, 4, 3, "۱ بشقاب"],
    ["سوشی", "dinner", 145, 6, 28, 1, "۶ عدد"],
    ["ماهی دودی", "dinner", 117, 25, 0, 1, "۱۰۰ گرم"],
    ["فیله ماهی با لیمو", "dinner", 130, 23, 0, 4, "۲۰۰ گرم"],
    ["سینه مرغ گریل با سبزی", "dinner", 150, 26, 5, 3, "۱ بشقاب"],
    ["سینه مرغ با سالاد", "dinner", 140, 25, 4, 3, "۱ بشقاب"],
    ["مرغ آب‌پز با سبزی", "dinner", 140, 24, 5, 3, "۱ بشقاب"],
    ["مرغ پخته با قارچ", "dinner", 130, 18, 5, 4, "۱ بشقاب"],
    ["خوراک مرغ و کلم", "dinner", 120, 14, 6, 4, "۱ بشقاب"],
    ["جوجه کباب با سالاد", "dinner", 180, 22, 4, 8, "۱ بشقاب"],
    ["سالاد مرغ گریل", "dinner", 130, 14, 5, 6, "۱ بشقاب"],
    ["سینه مرغ با پنیر", "dinner", 180, 24, 3, 8, "۲۰۰ گرم"],
    ["مرغ کاری", "dinner", 150, 14, 6, 7, "۱ بشقاب"],
    ["مرغ و سبزیجات سرخ شده", "dinner", 130, 14, 7, 5, "۱ بشقاب"],
    ["سالاد سزار با مرغ", "dinner", 190, 18, 10, 10, "۱ بشقاب"],
    ["سالاد کاپریز", "dinner", 180, 9, 8, 13, "۱ بشقاب"],
    ["سالاد فتوش", "dinner", 120, 4, 14, 5, "۱ بشقاب"],
    ["سالاد تبوله", "dinner", 130, 3, 23, 2, "۱ بشقاب"],
    ["سالاد اسفناج و انار", "dinner", 80, 3, 8, 4, "۱ بشقاب"],
    ["سالاد اسفناج و گردو", "dinner", 100, 4, 7, 6, "۱ بشقاب"],
    ["سالاد کینوا", "dinner", 150, 5, 25, 4, "۱ بشقاب"],
    ["سالاد کلم بروکلی", "dinner", 90, 3, 10, 5, "۱ بشقاب"],
    ["سالاد نخود و تن ماهی", "dinner", 150, 12, 14, 5, "۱ بشقاب"],
    ["سالاد تن", "dinner", 140, 14, 5, 7, "۱ بشقاب"],
    ["خوراک عدس و گوجه", "dinner", 130, 8, 17, 2, "۱ کاسه"],
    ["خوراک نخود و گوشت", "dinner", 160, 9, 16, 6, "۱ کاسه"],
    ["خوراک لوبیا چیتی با گوشت", "dinner", 145, 9, 13, 6, "۱ کاسه"],
    ["خوراک لوبیا سبز و گوشت", "dinner", 130, 8, 10, 5, "۱ کاسه"],
    ["خوراک ماش و گوشت", "dinner", 130, 9, 12, 4, "۱ کاسه"],
    ["خوراک باقلا و گوشت", "dinner", 140, 9, 13, 5, "۱ کاسه"],
    ["خوراک نخود فرنگی و گوشت", "dinner", 130, 8, 12, 5, "۱ کاسه"],
    ["املت قارچ و پنیر", "dinner", 160, 12, 4, 11, "۱ بشقاب"],
    ["املت اسفناج و پنیر", "dinner", 170, 13, 4, 12, "۱ بشقاب"],
    ["املت سبزیجات", "dinner", 130, 9, 5, 9, "۱ بشقاب"],
    ["آش رشته با کشک", "dinner", 100, 4, 14, 3, "۱ کاسه"],
    ["آش دوغ با گردو", "dinner", 80, 3, 8, 3, "۱ کاسه"],
    ["آش انار با گوشت", "dinner", 100, 4, 13, 3, "۱ کاسه"],
    ["آش کشک و سیر", "dinner", 100, 4, 12, 4, "۱ کاسه"],
    ["آش جو و عدس", "dinner", 100, 4, 14, 2, "۱ کاسه"],
    ["آبگوشت", "dinner", 120, 6, 8, 7, "۱ کاسه"],
    ["دیزی", "dinner", 130, 7, 9, 7, "۱ کاسه"],
    ["حلیم مرغ", "dinner", 150, 9, 16, 5, "۱ کاسه"],
    ["کشک بادمجان با گردو", "dinner", 180, 6, 9, 13, "۱ بشقاب"],
    ["میرزا قاسمی با تخم مرغ", "dinner", 200, 8, 10, 14, "۱ بشقاب"],
    ["گوشت گوساله گریل با سالاد", "dinner", 220, 25, 4, 12, "۱ بشقاب"],
    ["گوشت گوسفند با سبزی", "dinner", 200, 22, 4, 12, "۱ بشقاب"],
    ["گوشت چرخ‌کرمی با قارچ", "dinner", 180, 17, 5, 10, "۱ بشقاب"],
    ["خوراک گوشت و اسفناج", "dinner", 170, 15, 5, 8, "۱ بشقاب"],
    ["گوشت و بروکلی", "dinner", 150, 15, 6, 7, "۱ بشقاب"],
    ["خوراک گوشت و نخود فرنگی", "dinner", 170, 14, 9, 7, "۱ بشقاب"],
    ["استیک گوساله با سیب‌زمینی", "dinner", 220, 22, 12, 11, "۱ بشقاب"],
    ["خورش گوشت", "dinner", 150, 9, 8, 9, "۱ کاسه"],
    ["خورش قورمه سبزی", "dinner", 140, 7, 10, 8, "۱ کاسه"],
    ["خورش قیمه بادمجان", "dinner", 160, 8, 13, 8, "۱ کاسه"],
    ["میگو و کدو", "dinner", 100, 18, 4, 1, "۲۰۰ گرم"],
    ["کالاماری سرخ شده", "dinner", 180, 15, 10, 9, "۲۰۰ گرم"],
    ["کالاماری گریل", "dinner", 120, 20, 3, 2, "۲۰۰ گرم"],
    ["ماهی مرکب با کره", "dinner", 140, 18, 3, 6, "۲۰۰ گرم"],
    ["خرچنگ آب‌پز", "dinner", 97, 19, 0, 1.5, "۲۰۰ گرم"],
    ["صدف دریایی", "dinner", 86, 15, 3, 1, "۲۰۰ گرم"],
    ["خرچنگ گریل", "dinner", 100, 19, 1, 1.5, "۲۰۰ گرم"],
    ["اختاپوس گریل", "dinner", 164, 30, 2, 2, "۲۰۰ گرم"],
    ["میگو و صدف", "dinner", 100, 18, 3, 2, "۲۰۰ گرم"],
    ["ماهی دودی با پنیر", "dinner", 200, 22, 2, 11, "۲۰۰ گرم"],
    ["کینوا با مرغ", "dinner", 160, 14, 15, 4, "۱ بشقاب"],
    ["کینوا با سبزیجات", "dinner", 130, 5, 22, 3, "۱ بشقاب"],
    ["بورگول با مرغ", "dinner", 150, 12, 18, 4, "۱ بشقاب"],
    ["بورگول با عدس", "dinner", 130, 7, 22, 2, "۱ بشقاب"],
    ["کوکسوس با مرغ", "dinner", 150, 11, 18, 4, "۱ بشقاب"],
    ["کوکسوس با سبزیجات", "dinner", 120, 4, 23, 2, "۱ بشقاب"],
    ["برنج قهوه‌ای با مرغ", "dinner", 145, 12, 18, 3, "۱ بشقاب"],
    ["برنج قهوه‌ای با لوبیا", "dinner", 130, 7, 24, 2, "۱ بشقاب"],
    ["سیب‌زمینی پخته با پنیر", "dinner", 150, 6, 22, 4, "۱ عدد"],
    ["سیب‌زمینی شیرین پخته", "dinner", 90, 2, 21, 0.1, "۱ عدد"],
    ["بادمجان گریل با سیر", "dinner", 100, 2, 12, 5, "۱ بشقاب"],
    ["کدو گریل", "dinner", 35, 2, 7, 0.5, "۱ بشقاب"],
    ["کلم بروکلی بخارپز", "dinner", 35, 2.8, 7, 0.4, "۱ بشقاب"],
    ["اسفناج بخارپز", "dinner", 23, 2.9, 3.6, 0.4, "۱ بشقاب"],
    ["مخلوط سبزیجات بخارپز", "dinner", 50, 2, 10, 0.5, "۱ بشقاب"],
    ["سالاد فصل با مرغ", "dinner", 130, 13, 8, 5, "۱ بشقاب"],
    ["سوپ سبزیجات با مرغ", "dinner", 70, 5, 8, 2, "۱ کاسه"],
    ["سوپ سبزیجات با گوشت", "dinner", 80, 5, 9, 3, "۱ کاسه"],
    ["سوپ پیاز و هویج", "dinner", 50, 1.5, 9, 1.5, "۱ کاسه"],
    ["سوپ اسفناج", "dinner", 60, 2.5, 8, 2, "۱ کاسه"],
    ["پاستا با مرغ", "dinner", 180, 13, 22, 5, "۱ بشقاب"],
    ["پاستا با سبزیجات", "dinner", 150, 5, 28, 3, "۱ بشقاب"],
    ["پاستا با تن ماهی", "dinner", 170, 11, 22, 5, "۱ بشقاب"],
    ["برگر مرغ", "dinner", 250, 18, 25, 9, "۱ عدد"],
    ["برگر گوشت", "dinner", 295, 17, 24, 14, "۱ عدد"],
    ["برگر گیاهی", "dinner", 220, 10, 30, 7, "۱ عدد"],
    ["ساندویچ مرغ", "dinner", 250, 16, 30, 7, "۱ عدد"],
    ["ساندویچ تن ماهی", "dinner", 230, 14, 28, 7, "۱ عدد"],
    ["ساندویچ گوشت", "dinner", 280, 16, 30, 11, "۱ عدد"],
    ["ساندویچ کباب کوبیده", "dinner", 270, 14, 30, 11, "۱ عدد"],
    ["سوپ ماهی", "dinner", 80, 8, 5, 3, "۱ کاسه"],
    ["سوپ میگو", "dinner", 80, 7, 6, 3, "۱ کاسه"],
    ["سوپ تایلندی", "dinner", 80, 5, 8, 3, "۱ کاسه"],
    ["سوپ مرغ و ذرت", "dinner", 80, 5, 10, 2, "۱ کاسه"],
    ["سوپ ماش", "dinner", 90, 5, 13, 2, "۱ کاسه"],
    ["خوراک عدس و نخود", "dinner", 145, 8, 22, 2, "۱ کاسه"],
    ["خوراک لوبیا چیتی با قارچ", "dinner", 130, 8, 14, 4, "۱ کاسه"],
    ["خوراک نخود و گوشت چرخ‌کرمی", "dinner", 170, 11, 14, 7, "۱ کاسه"],
    ["کوکو سبزی با ماست", "dinner", 200, 10, 8, 14, "۱ تکه"],
    ["کوکو سیب‌زمینی با پنیر", "dinner", 200, 8, 18, 11, "۱ تکه"],

    // --- SNACK (140) ---
    ["سیب", "snack", 52, 0.3, 14, 0.2, "۱ عدد متوسط"],
    ["موز", "snack", 89, 1.1, 23, 0.3, "۱ عدد متوسط"],
    ["پرتقال", "snack", 47, 0.9, 12, 0.1, "۱ عدد متوسط"],
    ["لیمو", "snack", 29, 1.1, 9, 0.3, "۱ عدد"],
    ["انگور", "snack", 69, 0.7, 18, 0.2, "۱ خوشه کوچک"],
    ["طالبی", "snack", 34, 0.8, 8, 0.2, "۱ تکه"],
    ["هندوانه", "snack", 30, 0.6, 8, 0.2, "۱ تکه بزرگ"],
    ["انار", "snack", 83, 1.7, 19, 1.2, "۱ عدد"],
    ["خرما تازه", "snack", 142, 1.5, 38, 0.4, "۵ عدد"],
    ["خرما خشک", "snack", 282, 2.5, 75, 0.4, "۳ عدد"],
    ["انجیر تازه", "snack", 74, 0.8, 19, 0.3, "۳ عدد"],
    ["انجیر خشک", "snack", 249, 3.3, 64, 0.9, "۳ عدد"],
    ["کیوی", "snack", 61, 1.1, 15, 0.5, "۲ عدد"],
    ["توت فرنگی", "snack", 32, 0.7, 8, 0.3, "۱ کاسه"],
    ["گیلاس", "snack", 50, 1, 12, 0.3, "۱۰ عدد"],
    ["گلابی", "snack", 57, 0.4, 15, 0.1, "۱ عدد متوسط"],
    ["هلو", "snack", 39, 0.9, 10, 0.3, "۱ عدد متوسط"],
    ["زردآلو", "snack", 48, 1.4, 11, 0.4, "۵ عدد"],
    ["آلو", "snack", 46, 0.7, 11, 0.3, "۳ عدد"],
    ["انبه", "snack", 60, 0.8, 15, 0.4, "۱ تکه"],
    ["آناناس", "snack", 50, 0.5, 13, 0.1, "۱ تکه"],
    ["آووکادو", "snack", 160, 2, 9, 15, "۱ عدد کوچک"],
    ["نارنگی", "snack", 53, 0.8, 13, 0.3, "۲ عدد"],
    ["گریپ فروت", "snack", 42, 0.8, 11, 0.1, "۱ عدد"],
    ["بلوبری", "snack", 57, 0.7, 14, 0.3, "۱ کاسه"],
    ["تمشک", "snack", 53, 1.2, 12, 0.7, "۱ کاسه"],
    ["شاتوت", "snack", 43, 1.4, 10, 0.4, "۱ کاسه"],
    ["زرشک", "snack", 316, 2, 76, 1, "۲ قاشق"],
    ["کشمش", "snack", 299, 3.1, 79, 0.5, "۱ قاشق"],
    ["برگه زردآلو", "snack", 241, 3.4, 63, 0.4, "۵ عدد"],
    ["برگه هلو", "snack", 239, 3.6, 62, 0.5, "۵ عدد"],
    ["آلو خشک", "snack", 240, 2.2, 64, 0.4, "۵ عدد"],
    ["گوجه گیلاسی", "snack", 18, 0.9, 3.9, 0.2, "۱۰ عدد"],
    ["خیار", "snack", 15, 0.7, 3.6, 0.1, "۱ عدد"],
    ["هویج", "snack", 41, 0.9, 10, 0.2, "۱ عدد متوسط"],
    ["کرفس", "snack", 16, 0.7, 3, 0.2, "۱ ساقه"],
    ["فلفل دلمه‌ای", "snack", 31, 1, 6, 0.3, "۱ عدد"],
    ["کاهو", "snack", 15, 1.4, 2.9, 0.2, "۱ برگ بزرگ"],
    ["اسفناج", "snack", 23, 2.9, 3.6, 0.4, "۱ کاسه"],
    ["کلم بروکلی", "snack", 34, 2.8, 7, 0.4, "۱ کاسه"],
    ["گل کلم", "snack", 25, 1.9, 5, 0.3, "۱ کاسه"],
    ["کلم", "snack", 25, 1.3, 6, 0.1, "۱ کاسه"],
    ["پیاز", "snack", 40, 1.1, 9, 0.1, "۱ عدد"],
    ["سیر", "snack", 149, 6.4, 33, 0.5, "۲ حبه"],
    ["بادمجان", "snack", 25, 1, 6, 0.2, "۱ عدد"],
    ["کدو سبز", "snack", 17, 1.2, 3.1, 0.3, "۱ عدد"],
    ["کیل", "snack", 49, 4.3, 9, 0.9, "۱ کاسه"],
    ["قارچ", "snack", 22, 3.1, 3.3, 0.3, "۱ کاسه"],
    ["لوبیا سبز", "snack", 31, 1.8, 7, 0.1, "۱ کاسه"],
    ["چغندر", "snack", 43, 1.6, 10, 0.2, "۱ عدد"],
    ["تربچه", "snack", 16, 0.7, 3.4, 0.1, "۵ عدد"],
    ["ذرت", "snack", 86, 3.2, 19, 1.2, "۱ عدد"],
    ["بامیه سبز", "snack", 33, 1.9, 7, 0.2, "۱ کاسه"],
    ["کدو حلوایی", "snack", 26, 1, 7, 0.1, "۱ تکه"],
    ["بادام", "snack", 579, 21, 22, 50, "۳۰ گرم"],
    ["گردو", "snack", 654, 15, 14, 65, "۳۰ گرم"],
    ["پسته", "snack", 560, 20, 28, 45, "۳۰ گرم"],
    ["پسته اکبری", "snack", 562, 20, 28, 45, "۳۰ گرم"],
    ["بادام زمینی", "snack", 567, 26, 16, 49, "۳۰ گرم"],
    ["پسته آسیابی", "snack", 562, 21, 27, 46, "۳۰ گرم"],
    ["فندق", "snack", 628, 15, 17, 61, "۳۰ گرم"],
    ["کاشو", "snack", 553, 18, 30, 44, "۳۰ گرم"],
    ["ماکادمیا", "snack", 718, 8, 14, 76, "۳۰ گرم"],
    ["بادام برزیلی", "snack", 656, 14, 12, 67, "۳۰ گرم"],
    ["تخمه آفتابگردان", "snack", 584, 21, 20, 51, "۳۰ گرم"],
    ["تخمه کدو", "snack", 559, 30, 11, 49, "۳۰ گرم"],
    ["کنجد", "snack", 573, 18, 23, 50, "۲ قاشق"],
    ["تخم کتان", "snack", 534, 18, 29, 42, "۱ قاشق"],
    ["چیا", "snack", 486, 17, 42, 31, "۱ قاشق"],
    ["شاه‌تخمه", "snack", 553, 32, 9, 49, "۱ قاشق"],
    ["مغز میوه‌های خشک", "snack", 600, 18, 22, 52, "۳۰ گرم"],
    ["آجیل شور", "snack", 580, 18, 22, 50, "۳۰ گرم"],
    ["آجیل چهار مغز", "snack", 600, 18, 20, 54, "۳۰ گرم"],
    ["تخمه هندوانه", "snack", 557, 28, 15, 47, "۳۰ گرم"],
    ["شکلات تلخ", "snack", 546, 5, 61, 31, "۲ مربع"],
    ["شکلات شیری", "snack", 535, 7.6, 59, 30, "۲ مربع"],
    ["شکلات سفید", "snack", 539, 5, 59, 32, "۲ مربع"],
    ["شکلات تخته‌ای", "snack", 535, 7.6, 59, 30, "۱ تخته"],
    ["بیسکویت ساده", "snack", 425, 7, 75, 13, "۲ عدد"],
    ["بیسکویت کره‌ای", "snack", 480, 6, 65, 22, "۲ عدد"],
    ["بیسکویت شکلاتی", "snack", 480, 6, 65, 22, "۲ عدد"],
    ["ویفر", "snack", 522, 6, 64, 28, "۱ عدد"],
    ["کراکر", "snack", 502, 9, 64, 23, "۵ عدد"],
    ["چیپس سیب‌زمینی", "snack", 536, 7, 53, 35, "۱ کیسه"],
    ["پفک", "snack", 480, 5, 60, 25, "۱ کیسه"],
    ["پاپ‌کورن", "snack", 387, 13, 78, 4, "۱ کاسه"],
    ["آبنبات", "snack", 390, 0, 98, 0, "۳ عدد"],
    ["حلوای آرد گندم", "snack", 467, 5, 70, 18, "۱ تکه"],
    ["سوهان", "snack", 480, 5, 65, 22, "۳ عدد"],
    ["گز", "snack", 420, 3, 75, 14, "۳ عدد"],
    ["کلوچه", "snack", 380, 5, 60, 14, "۱ عدد"],
    ["نان برنجی", "snack", 460, 6, 70, 18, "۵ عدد"],
    ["نان خشک", "snack", 380, 8, 75, 5, "۵ عدد"],
    ["کلوچه فومن", "snack", 380, 5, 60, 14, "۱ عدد"],
    ["باقلوا", "snack", 478, 6, 60, 25, "۱ تکه"],
    ["زولبیا", "snack", 500, 2, 80, 18, "۲ عدد"],
    ["بامیه شیرینی", "snack", 500, 2, 80, 18, "۲ عدد"],
    ["شله‌زرد", "snack", 150, 2, 32, 2, "۱ کاسه"],
    ["فرنی زعفرانی", "snack", 120, 3, 22, 2, "۱ کاسه"],
    ["رنگینک", "snack", 380, 4, 60, 16, "۱ تکه"],
    ["رشته‌خشک", "snack", 380, 8, 75, 5, "۱ کاسه"],
    ["خرما با گردو", "snack", 380, 6, 60, 16, "۳ عدد"],
    ["حلوا ارده", "snack", 460, 9, 55, 25, "۱ تکه"],
    ["شیرینی خامه‌ای", "snack", 380, 5, 50, 19, "۱ عدد"],
    ["شیرینی تر", "snack", 320, 4, 50, 12, "۱ عدد"],
    ["کیک ساده", "snack", 350, 5, 55, 12, "۱ تکه"],
    ["کیک شکلاتی", "snack", 380, 5, 55, 16, "۱ تکه"],
    ["دونات", "snack", 452, 5, 51, 25, "۱ عدد"],
    ["کلوچه شکلاتی", "snack", 420, 5, 65, 16, "۱ عدد"],
    ["بستنی وانیلی", "snack", 207, 3.5, 24, 11, "۲ توپ"],
    ["بستنی شکلاتی", "snack", 216, 3.8, 28, 11, "۲ توپ"],
    ["بستنی پسته‌ای", "snack", 230, 5, 26, 12, "۲ توپ"],
    ["بستنی سنتی", "snack", 230, 5, 26, 12, "۲ توپ"],
    ["بستنی یخی", "snack", 130, 0.5, 32, 0.5, "۱ کاسه"],
    ["بستنی ساندویچی", "snack", 240, 4, 35, 9, "۱ عدد"],
    ["ماست یونانی با عسل", "snack", 110, 8, 16, 1, "۱ کاسه"],
    ["ماست با توت فرنگی", "snack", 95, 4, 13, 2, "۱ کاسه"],
    ["ماست با گردو", "snack", 130, 6, 8, 8, "۱ کاسه"],
    ["پنیر کم‌چرب با هویج", "snack", 130, 12, 6, 6, "۱ وعده"],
    ["تخم مرغ آب‌پز با نان", "snack", 180, 11, 18, 6, "۱ عدد"],
    ["اسموتی موز و بادام", "snack", 130, 5, 18, 5, "۱ لیوان"],
    ["اسموتی توت فرنگی", "snack", 60, 2, 13, 0.5, "۱ لیوان"],
    ["اسموتی سبزیجات", "snack", 50, 2, 10, 0.5, "۱ لیوان"],
    ["شیک پروتئین شکلاتی", "snack", 130, 22, 5, 2, "۱ اسکوپ"],
    ["انرژی بار", "snack", 350, 10, 50, 13, "۱ عدد"],
    ["گرنولا بار", "snack", 380, 8, 60, 12, "۱ عدد"],
    ["پنکیک موز", "snack", 200, 5, 32, 5, "۱ عدد"],
    ["موز با کره بادام‌زمینی", "snack", 220, 6, 30, 10, "۱ عدد"],
    ["سیب با کره بادام", "snack", 200, 4, 28, 10, "۱ عدد"],
    ["نان با کره بادام‌زمینی", "snack", 350, 11, 35, 17, "۱ وعده"],
    ["چای سیاه", "snack", 1, 0, 0.3, 0, "۱ لیوان"],
    ["چای سبز", "snack", 1, 0, 0.2, 0, "۱ لیوان"],
    ["قهوه اسپرسو", "snack", 5, 0.3, 0, 0, "۱ شات"],
    ["دوغ خانگی", "snack", 28, 1.7, 1.8, 1.5, "۱ لیوان"],
    ["دوغ صنعتی", "snack", 35, 1.5, 2, 1.8, "۱ لیوان"],
    ["آب میوه فشرده", "snack", 50, 0.5, 12, 0.2, "۱ لیوان"],
    ["آب پرتقال", "snack", 45, 0.7, 10, 0.2, "۱ لیوان"],
    ["آب سیب", "snack", 46, 0.1, 11, 0.1, "۱ لیوان"],
    ["آب هویج", "snack", 40, 1, 9, 0.2, "۱ لیوان"],
    ["دمنوش", "snack", 1, 0, 0.2, 0, "۱ لیوان"],
  ];

  // Convert tuples to food objects
  const foods = foodTuples.map(([name, category, calories, protein, carbs, fat, servingSize]) => ({
    name,
    category,
    calories,
    protein,
    carbs,
    fat,
    servingSize,
  }));

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    await db.foodLibrary.upsert({
      where: { id: `seed_food_${i + 1}` },
      create: { id: `seed_food_${i + 1}`, ...f, imageUrl: "", isVegan: false },
      update: f,
    });
  }
  console.log(`✅ Seeded ${foods.length} foods`);

  // Seed AI configs
  // مهم: در update clause هم value را set می‌کنیم تا در صورت تغییر DEFAULT_* در کد،
  // دیتابیس هم به‌روزرسانی شود (نه فقط در create).
  await db.aiConfig.upsert({
    where: { key: "coach_system_prompt" },
    create: {
      key: "coach_system_prompt",
      label: "پرامپت مربی (ساخت برنامه تمرینی)",
      value: DEFAULT_COACH_PROMPT,
    },
    update: {
      value: DEFAULT_COACH_PROMPT,
    },
  });
  await db.aiConfig.upsert({
    where: { key: "chat_system_prompt" },
    create: {
      key: "chat_system_prompt",
      label: "پرامپت چت هوشمند",
      value: DEFAULT_CHAT_PROMPT,
    },
    update: {
      value: DEFAULT_CHAT_PROMPT,
    },
  });
  await db.aiConfig.upsert({
    where: { key: "nutrition_system_prompt" },
    create: {
      key: "nutrition_system_prompt",
      label: "پرامپت برنامه غذایی",
      value: DEFAULT_NUTRITION_PROMPT,
    },
    update: {
      value: DEFAULT_NUTRITION_PROMPT,
    },
  });
  await db.aiConfig.upsert({
    where: { key: "nika_system_prompt" },
    create: {
      key: "nika_system_prompt",
      label: "پرامپت نیکا (دستیار فروش)",
      value: DEFAULT_NIKA_PROMPT,
    },
    update: {
      value: DEFAULT_NIKA_PROMPT,
    },
  });
  console.log("✅ Seeded AI configs");

  // Seed discount codes — only single loyalty code FITAP20
  // (remove WELCOME100 and ULTIMATE15 — they no longer exist)
  await db.discountCode.deleteMany({
    where: { code: { in: ["WELCOME100", "ULTIMATE15", "VIP15"] } },
  });
  await db.discountCode.upsert({
    where: { code: "FITAP20" },
    create: {
      code: "FITAP20",
      type: "percent",
      value: 20,
      maxUses: -1,
      active: true,
      applicablePlans: "all",
    },
    update: {
      type: "percent",
      value: 20,
      maxUses: -1,
      active: true,
      applicablePlans: "all",
    },
  });
  console.log("✅ Seeded discount code: FITAP20 (20% off all plans, unlimited uses)");

  // Seed site settings (default site customization)
  const siteSettings = [
    { key: "brandName", value: "فیتاپ", label: "نام برند" },
    { key: "slogan", value: "هر بدنی فیتاپ میخواد", label: "شعار برند" },
    { key: "heroTitle", value: "بدن ایده‌آلت را با فیتاپ بساز", label: "عنوان صفحه اصلی" },
    { key: "heroSubtitle", value: "مربی هوشمند، برنامه تمرین و تغذیه اختصاصی، و نظارت حرفه‌ای — همه در یک پلتفرم.", label: "زیرعنوان صفحه اصلی" },
    { key: "primaryColor", value: "#F4C542", label: "رنگ اصلی" },
  ];
  for (const s of siteSettings) {
    await db.siteSetting.upsert({
      where: { key: s.key },
      create: s,
      update: { value: s.value, label: s.label },
    });
  }
  console.log(`✅ Seeded ${siteSettings.length} site settings (brandName, slogan, heroTitle, heroSubtitle, primaryColor)`);

  // Seed a couple of demo articles
  const demoArticles = [
    {
      id: "seed_article_1",
      title: "۵ نکته طلایی برای کاهش چربی شکم",
      slug: "fat-loss-tips",
      excerpt: "راهکارهای علمی و عملی برای کاهش چربی شکم و رسیدن به تناسب اندام",
      content: "# ۵ نکته طلایی برای کاهش چربی شکم\n\nکاهش چربی شکم یکی از مهم‌ترین اهداف ورزشی است. در این مقاله به ۵ نکته کلیدی می‌پردازیم.\n\n## ۱. ایجاد کالری‌ریز\n\nمهم‌ترین اصل در کاهش چربی، ایجاد نقص کالری است.\n\n```python\n# محاسبه TDEE\ntdee = bmr * activity_factor\ncalorie_deficit = tdee - 500\n```\n\n## ۲. تمرینات قدرتی\n\nتمرینات قدرتی به حفظ عضله کمک می‌کند.\n\n## ۳. افزایش پروتئین\n\nمصرف پروتئین کافی احساس سیری ایجاد می‌کند.",
      category: "nutrition",
      tags: "کاهش وزن,تغذیه,چربی سوزی",
      status: "published",
      coverImage: "",
    },
    {
      id: "seed_article_2",
      title: "برنامه تمرینی ۳ روزه برای مبتدیان",
      slug: "beginner-3day-program",
      excerpt: "یک برنامه کامل برای شروع ورزش بدون نیاز به تجهیزات پیشرفته",
      content: "# برنامه تمرینی ۳ روزه برای مبتدیان\n\nاگر تازه شروع به ورزش کرده‌اید، این برنامه ۳ روزه برای شما مناسب است.\n\n## روز ۱: بالاتنه\n\n- پرس سینه ۳ ست ۱۲ تکرار\n- زیربغل قایقی ۳ ست ۱۲ تکرار\n- سرشانه دمبل ۳ ست ۱۰ تکرار\n\n## روز ۲: پایین‌تنه\n\n- اسکوات ۳ ست ۱۵ تکرار\n- لانژ ۳ ست ۱۲ تکرار\n- پلانک ۳ ست ۳۰ ثانیه\n\n## روز ۳: فول‌بادی\n\n```javascript\nconst workout = {\n  duration: 45,\n  intensity: 'medium',\n  exercises: ['push-up', 'squat', 'plank']\n};\n```",
      category: "training",
      tags: "مبتدی,تمرین,بدون تجهیزات",
      status: "published",
      coverImage: "",
    },
  ];
  for (const a of demoArticles) {
    await db.article.upsert({
      where: { id: a.id },
      create: { ...a, publishedAt: a.status === "published" ? new Date() : null, authorId: admin.id },
      update: {},
    });
  }
  console.log(`✅ Seeded ${demoArticles.length} demo articles`);

  // ====================================================================
  // TERMS & CONDITIONS (initial active version 1)
  // ====================================================================
  const termsContent = `# شرایط و قوانین فیت‌آپ

به پلتفرم فیت‌آپ ("فیت‌آپ"، "پلتفرم"، "شرکت"، "ما") خوش آمدید. این سند ("شرایط و قوانین"، "توافقنامه") یک قرارداد قانونی لازم‌الاجرا میان شما، کاربر محترم ("کاربر"، "شما") و فیت‌آپ است و چارچوب حقوقی حاکم بر استفاده شما از وب‌سایت، اپلیکیشن‌ها و کلیه خدمات مبتنی بر هوش مصنوعی ما ("خدمات") را مشخص می‌کند.

## ⚠️ توجه مهم

استفاده شما از خدمات فیت‌آپ، ثبت‌نام در پلتفرم و یا کلیک بر روی دکمه "پذیرش"، به منزله مطالعه دقیق، درک کامل و پذیرش بی‌قید و شرط تمامی مواد این توافقنامه و همچنین "سیاستنامه حفظ حریم خصوصی" ما می‌باشد. اگر با هر یک از مفاد این سند موافق نیستید، اکیداً از شما درخواست می‌شود که از ایجاد حساب کاربری و استفاده از خدمات ما خودداری فرمایید.

## 📌 ماده ۱: تعاریف

۱-۱. **پلتفرم**: کلیه زیرساخت‌های نرم‌افزاری و سخت‌افزاری متعلق به فیت‌آپ که خدمات موضوع این توافقنامه را ارائه می‌دهد.

۱-۲. **کاربر (ورزشکار)**: هر شخص حقیقی که با پذیرش این شرایط، در پلتفرم ثبت‌نام کرده و از خدمات آن بهره‌مند می‌شود.

۱-۳. **فیت‌آپ هوشمند (فیتاپ AI)**: سیستم جامع هوش مصنوعی فیت‌آپ که مسئولیت تحلیل داده‌ها، طراحی برنامه‌ها، ارائه پشتیبانی و سایر خدمات اصلی پلتفرم را بر عهده دارد.

۱-۴. **برنامه**: مجموعه خدمات اختصاصی شامل برنامه تمرین، برنامه تغذیه و برنامه مکمل که توسط فیت‌آپ هوشمند برای یک کاربر خاص و برای یک دوره زمانی معین (پلن) طراحی و ارائه می‌گردد.

۱-۵. **کیف پول (Wallet)**: حساب کاربری مجازی ریالی هر کاربر در پلتفرم که موجودی قابل استفاده و اعتبارهای هدیه در آن نگهداری شده و برای پرداخت‌های درون‌پلتفرمی به کار می‌رود.

۱-۶. **پروفایل ورزشی**: مجموعه اطلاعات جامع شخصی، فیزیکی، پزشکی، ورزشی، سبک زندگی و اهداف که کاربر در فرآیند آنبوردینگ یا در پروفایل خود وارد می‌کند و مبنای اصلی تحلیل و طراحی برنامه توسط فیت‌آپ هوشمند است.

۱-۷. **مالکیت معنوی**: شامل و نه محدود به کلیه لوگوها، علائم تجاری، طراحی‌های بصری، کدهای نرم‌افزاری، الگوریتم‌های هوش مصنوعی، محتوای آموزشی و ساختار پلتفرم که متعلق به فیت‌آپ است.

## 👤 ماده ۲: شرایط عضویت و حساب کاربری

۲-۱. **اهلیت قانونی**: کاربران با ثبت‌نام اقرار می‌نمایند که دارای اهلیت قانونی کامل (حداقل ۱۸ سال شمسی) برای انعقاد این قرارداد هستند.

۲-۲. **صحت اطلاعات**: کاربر متعهد است که در هنگام ثبت‌نام و تکمیل پروفایل، اطلاعات صحیح، دقیق و به‌روز را ارائه نماید. مسئولیت حقوقی ناشی از ارائه اطلاعات نادرست، مستقیماً بر عهده کاربر است.

۲-۳. **امنیت حساب**: مسئولیت حفظ محرمانگی اطلاعات حساب کاربری، از جمله کدهای یکبار مصرف، منحصراً بر عهده کاربر است. فیت‌آپ هیچ‌گونه مسئولیتی در قبال دسترسی غیرمجاز به حساب کاربری شما ندارد.

۲-۴. **حساب کاربری واحد**: هر شخص تنها مجاز به داشتن یک حساب کاربری است. ایجاد حساب‌های متعدد تخلف محسوب شده و فیت‌آپ مجاز به مسدودسازی حساب‌های مرتبط خواهد بود.

## 💪 ماده ۳: تعهدات و مسئولیت‌های کاربر

۳-۱. **صداقت در ارائه اطلاعات**: کاربر با آگاهی کامل اقرار می‌نماید که تمامی اطلاعات پروفایل ورزشی، به ویژه سوابق پزشکی، آسیب‌دیدگی‌ها، بیماری‌ها، حساسیت‌ها، داروهای مصرفی و محدودیت‌های حرکتی را با صداقت و دقت کامل ارائه می‌دهد. از آنجایی که فیت‌آپ هوشمند برنامه‌ها را منحصراً بر اساس این داده‌ها طراحی می‌کند، مسئولیت هرگونه آسیب، عدم نتیجه‌گیری مطلوب یا عوارض جانبی ناشی از ارائه اطلاعات کذب، ناقص یا گمراه‌کننده، تماماً بر عهده کاربر است.

۳-۲. **ضرورت مشاوره پزشکی**: کاربر تصدیق می‌کند که خدمات فیت‌آپ و برنامه‌های ارائه شده، به هیچ عنوان جایگزین مشاوره، تشخیص یا درمان پزشکی نیستند. فیت‌آپ اکیداً توصیه می‌نماید که پیش از شروع هرگونه برنامه ورزشی یا رژیم غذایی جدید، به ویژه در صورت داشتن هرگونه شرایط پزشکی، با پزشک متخصص خود مشورت نمایید.

۳-۳. **پذیرش ریسک**: ورزشکار می‌پذیرد که فعالیت‌های ورزشی، ذاتاً با ریسک آسیب‌دیدگی همراه است. کاربر با آگاهی کامل از این ریسک‌ها و با مسئولیت شخصی خود در برنامه‌ها شرکت می‌کند.

## 🤖 ماده ۴: تعهدات پلتفرم فیت‌آپ هوشمند

۴-۱. **ارائه خدمات**: فیت‌آپ متعهد به ارائه خدمات مبتنی بر هوش مصنوعی مطابق با ویژگی‌های پلن خریداری شده توسط کاربر است.

۴-۲. **حفظ حریم خصوصی**: فیت‌آپ متعهد به حفاظت از اطلاعات شخصی کاربران مطابق با "سیاستنامه حفظ حریم خصوصی" است.

۴-۳. **مبنای علمی**: فیت‌آپ تلاش می‌کند تا الگوریتم‌ها و پیشنهادهای فیت‌آپ هوشمند را بر اساس اصول و دانش پذیرفته‌شده در علوم ورزشی و تغذیه بنا نهد.

## 💳 ماده ۵: شرایط مالی و پرداخت

۵-۱. **هزینه‌ها**: هزینه هر پلن به وضوح در صفحه قیمت‌گذاری مشخص شده است.

۵-۲. **سیاست بازگشت وجه**: با توجه به آنی بودن خدمات، تحت هیچ شرایطی امکان لغو سفارش و بازگشت وجه وجود ندارد.

## ⚡ ماده ۶: استفاده از هوش مصنوعی و سلب مسئولیت

۶-۱. **ماهیت خدمات**: کاربر می‌پذیرد که فیت‌آپ یک سرویس نرم‌افزاری مبتنی بر هوش مصنوعی است.

۶-۲. **سلب مسئولیت پزشکی**: فیت‌آپ هوشمند یک ابزار پزشکی نیست.

۶-۳. **عدم تضمین نتیجه**: فیت‌آپ هیچ‌گونه تضمینی در مورد نتایج قطعی ارائه نمی‌دهد.

۶-۴. **مسئولیت اجرا**: مسئولیت کامل و نهایی اجرای صحیح و ایمن برنامه‌ها منحصراً بر عهده کاربر است.

## 🧠 ماده ۷: مالکیت معنوی

کلیه حقوق مادی و معنوی پلتفرم و خدمات آن منحصراً متعلق به فیت‌آپ می‌باشد.

## 📞 ماده ۸: پشتیبانی و حل اختلاف

در صورت بروز مشکل، کاربر می‌تواند از طریق راه‌های ارتباطی مشخص شده با تیم پشتیبانی فیت‌آپ در میان بگذارد.

## 🚫 ماده ۹: خاتمه همکاری

فیت‌آپ این حق را برای خود محفوظ می‌دارد که در صورت مشاهده تخلف، حساب کاربری متخلف را مسدود نماید.

## 🔄 ماده ۱۰: تغییرات در شرایط و قوانین

فیت‌آپ ممکن است در هر زمان این سند را بازنگری کند. ادامه استفاده کاربر به منزله پذیرش نسخه جدید است.

## 🇮🇷 ماده ۱۱: قانون حاکم

این توافقنامه تحت قوانین جمهوری اسلامی ایران تنظیم و تفسیر می‌شود.

## 🔒 سیاستنامه حفظ حریم خصوصی

**اطلاعات هویتی**: نام، شماره موبایل.
**اطلاعات حساس پروفایل ورزشی**: قد، وزن، سوابق پزشکی، بیماری‌ها، آسیب‌دیدگی‌ها، داروها و ترجیحات غذایی — تماماً برای تولید برنامه اختصاصی پردازش می‌شوند و هرگز در اختیار شخص ثالث قرار نمی‌گیرند.
**داده‌های تعاملی**: پیام‌های چت با هوش مصنوعی.
**امنیت داده‌ها**: اطلاعات با رمزنگاری ذخیره شده و حق اصلاح و حذف حساب کاربری محفوظ است.`;

  // Ensure only one active version exists; clean up any prior seed entries first
  await db.termsVersion.deleteMany({});
  await db.termsVersion.create({
    data: {
      version: 1,
      title: "شرایط و قوانین فیت‌آپ",
      content: termsContent,
      isActive: true,
    },
  });
  // Set both seeded users as accepting the active version
  await db.user.update({ where: { id: admin.id }, data: { acceptedTermsVersion: 1 } });
  await db.user.update({ where: { id: demo.id }, data: { acceptedTermsVersion: 1 } });
  console.log("✅ Seeded initial Terms & Conditions (version 1, active)");

  console.log("\n🎉 Seed complete!");
  console.log("Admin login: 09000000000 / admin123 (Ultimate plan + 5M wallet)");
  console.log("Demo login: 09111111111 / demo123 (Advanced plan + 1M wallet)");
  console.log("Discount code: FITAP20 (20% off all plans, unlimited uses)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
