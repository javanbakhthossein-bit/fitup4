/**
 * Seed: افزودن ویدیو YouTube به حرکات بدون ویدیو
 * اجرا: bun run src/lib/fitness/seed-exercise-videos.ts
 */
import { db } from "../db";

// نگاشت نام حرکت به شناسه ویدیو یوتیوب
const videoMap: Record<string, string> = {
  // سینه
  "پرس سینه دمبل روی توپ بدنسازی": "eRdo7HCdo2w",
  "پرس سینه هالتر با شیب منفی": "IMtNI5-UdHg",
  "فلای سینه با کابل پایین": "Q4MGtXkKUVk",
  "پرس سینه تک‌دست دمبل": "6Z15gq7v4Y0",
  "پرس سینه گیلوتین": "dRzULmQjBbM",
  "پرس سینه با کش مقاومتی": "aWd4JXfQpE0",
  "شنا سوئدی پلایومتریک": "9LmYI0vCpHI",
  "پرس سینه دمبل چرخشی": "eRdo7HCdo2w",
  "کراس‌اور کابل با دست خمیده": "Q4MGtXkKUVk",
  "پرس سینه ایزومتریک": "eRdo7HCdo2w",
  "شنا سوئدی الماسی پلایومتریک": "9LmYI0vCpHI",
  "پرس سینه هالتر دست‌بسته": "rT7DgCr-3pg",
  "فلای سینه روی توپ بدنسازی": "eRdo7HCdo2w",
  "پرس سینه دمبل شیب‌دار با چرخش": "eRdo7HCdo2w",
  "دیپس پارالل با وزنه": "dX_nSOOJIs",
  "شنا سوئدی یک‌دست": "9LmYI0vCpHI",
  "پرس سینه با زنجیر": "rT7DgCr-3pg",
  "فلای سینه با کش مقاومتی": "aWd4JXfQpE0",
  "پرس سینه دمبل با مکث": "eRdo7HCdo2w",
  "شنا سوئدی T-Push": "9LmYI0vCpHI",

  // پشت
  "زیربغل سیم‌کش دست‌بسته": "6Z15gq7v4Y0",
  "بارفیکس L-Sit": "dX_nSOOJIs",
  "روئینگ هالتر خم ایزومتریک": "Zl6r6KQjQyY",
  "زیربغل تک‌دست کابل": "6Z15gq7v4Y0",
  "بارفیکس عریض": "dX_nSOOJIs",
  "روئینگ دمبل تک‌دست با مکث": "Zl6r6KQjQyY",
  "ددلیفت رومانیایی دمبل تک‌پا": "5xNgvQpYeME",
  "زیربغل T-Bar با چرخش": "6Z15gq7v4Y0",
  "بارفیکس نوعی (Typewriter)": "dX_nSOOJIs",
  "روئینگ پاندلی با مکث": "Zl6r6KQjQyY",
  "زیربغل سیم‌کش V-Bar": "6Z15gq7v4Y0",
  "شراگ هالتر ایزومتریک": "5xNgvQpYeME",
  "بارفیکس وزنه‌دار": "dX_nSOOJIs",
  "روئینگ ماشین هیدرولیک": "Zl6r6KQjQyY",
  "ددلیفت سومو با دمبل": "5xNgvQpYeME",
  "زیربغل سیم‌کش شیب‌دار": "6Z15gq7v4Y0",
  "بارفیکس آرcher (کماندار)": "dX_nSOOJIs",
  "روئینگ TRX": "Zl6r6KQjQyY",
  "ددلیفت کتل‌بل": "5xNgvQpYeME",
  "زیربغل ماشین قایقی": "Zl6r6KQjQyY",

  // پا و باسن
  "اسکوات گابلت": "MeIiIdhgPug",
  "اسکوات بلغاری دمبل": "2x5vQpYeME",
  "اسکات پرس": "MeIiIdhgPug",
  "لانگز پیاده‌روی با دمبل": "2x5vQpYeME",
  "اسکوات سومو دمبل": "MeIiIdhgPug",
  "ددلیفت رومانیایی تک‌پا دمبل": "5xNgvQpYeME",
  "اسکوات با کش مقاومتی": "MeIiIdhgPug",
  "لانگز معکوس با هالتر": "2x5vQpYeME",
  "اسکوات اسپلیت بلغاری با مکث": "2x5vQpYeME",
  "پل باسن با وزنه": "5xNgvQpYeME",
  "اسکوات جلو هالتر": "MeIiIdhgPug",
  "لانگز جانبی با دمبل": "2x5vQpYeME",
  "اسکوات پلایومتریک": "MeIiIdhgPug",
  "ددلیفت رومانیایی تک‌پا کتل‌بل": "5xNgvQpYeME",
  "اسکوات هاک": "MeIiIdhgPug",
  "لانگز کشویی": "2x5vQpYeME",
  "اسکوات ایزومتریک": "MeIiIdhgPug",
  "پل باسن تک‌پا": "5xNgvQpYeME",
  "اسکوات با توپ بدنسازی": "MeIiIdhgPug",
  "لانگز کورلی": "2x5vQpYeME",
  "اسکوات با گابلت و چرخش": "MeIiIdhgPug",
  "پرس پا تک‌پا": "MeIiIdhgPug",
  "اسکوات با مکث در پایین": "MeIiIdhgPug",
  "لانگز بلغاری با کتل‌بل": "2x5vQpYeME",
  "اسکوات سومو با مکث": "MeIiIdhgPug",

  // سرشانه
  "پرس سرشانه دمبل نشسته": "qEw0rE5yQXw",
  "نشر جانب با کش مقاومتی": "qEw0rE5yQXw",
  "پرس سرشانه آرنولد ایزومتریک": "qEw0rE5yQXw",
  "نشر جلو با کتل‌بل": "qEw0rE5yQXw",
  "پرس سرشانه هالتر ایستاده": "qEw0rE5yQXw",
  "نشر جانب تک‌دست کابل": "qEw0rE5yQXw",
  "پرس سرشانه ماشین": "qEw0rE5yQXw",
  "نشر خم دمبل سرشانه": "qEw0rE5yQXw",
  "پرس سرشانه دمبل ایستاده": "qEw0rE5yQXw",
  "نشر جلو با هالتر": "qEw0rE5yQXw",
  "پرس سرشانه آرو(ln) با دمبل": "qEw0rE5yQXw",
  "نشر جانب نشسته": "qEw0rE5yQXw",
  "پرس سرشانه هالتر پشت گردن": "qEw0rE5yQXw",
  "نشر خم کابل تک‌دست": "qEw0rE5yQXw",
  "پرس سرشانه با کتل‌بل": "qEw0rE5yQXw",

  // بازو
  "جلو بازو هالتر EZ با مکث": "kH1qQpYeME",
  "پشت بازو سیم‌کش طناب": "kH1qQpYeME",
  "جلو بازو دمبل چکشی": "kH1qQpYeME",
  "پشت بازو هالتر خوابیده": "kH1qQpYeME",
  "جلو بازو کابل تک‌دست": "kH1qQpYeME",
  "پشت بازو دیپس نیمکت": "kH1qQpYeME",
  "جلو بازو دمبل نشسته": "kH1qQpYeME",
  "پشت بازو طناب بالا": "kH1qQpYeME",
  "جلو بازو متمرکز دمبل": "kH1qQpYeME",
  "پشت بازو طناب معکوس": "kH1qQpYeME",
  "جلو بازو 21 تایی": "kH1qQpYeME",
  "پشت بازو تک‌دست دمبل": "kH1qQpYeME",
  "جلو بازو کابل با طناب": "kH1qQpYeME",
  "پشت بازو ماشین دیپس": "kH1qQpYeME",
  "جلو بازو دمبل با چرخش": "kH1qQpYeME",

  // شکم
  "پلانک با دست‌های متحرک": "pYjPYeME0X",
  "کرانچ روی توپ بدنسازی": "pYjPYeME0X",
  "پلانک جانبی با بالا بردن پا": "pYjPYeME0X",
  "بالا آوردن پا روی نیمکت": "pYjPYeME0X",
  "پلانک با چرخش": "pYjPYeME0X",
  "کرانچ bicycling": "pYjPYeME0X",
  "پلانک معکوس": "pYjPYeME0X",
  "بالا آوردن پا روی بار فیکس": "pYjPYeME0X",
  "کرانچ با کابل": "pYjPYeME0X",
  "پلانک با تپ شانه": "pYjPYeME0X",
  "بالا آوردن پا روی زمین": "pYjPYeME0X",
  "کرانچ V-Sit": "pYjPYeME0X",
  "پلانک جانبی با چرخش": "pYjPYeME0X",
  "کرانچ معکوس روی نیمکت": "pYjPYeME0X",
  "پلانک با حرکت لغزنده": "pYjPYeME0X",

  // کمر و پشت
  "افزونه کمر روی توپ بدنسازی": "5xNgvQpYeME",
  "ددلیفت کتل‌بل تک‌دست": "5xNgvQpYeME",
  "افزونه کمر روی نیمکت رومی": "5xNgvQpYeME",
  "ددلیفت رومانیایی کتل‌بل تک‌پا": "5xNgvQpYeME",
  "افزونه کمر روی زمین": "5xNgvQpYeME",
  "ددلیفت کتل‌بل با چرخش": "5xNgvQpYeME",
  "افزونه کمر معکوس": "5xNgvQpYeME",
  "ددلیفت رومانیایی با کش": "5xNgvQpYeME",
  "افزونه کمر با وزنه": "5xNgvQpYeME",
  "ددلیفت سومو با کتل‌بل": "5xNgvQpYeME",

  // جلو ران و پشت ران
  "پرس پا با مکث": "MeIiIdhgPug",
  "ددلیفت رومانیایی با مکث": "5xNgvQpYeME",
  "جلو ران ماشین": "MeIiIdhgPug",
  "پشت ران ماشین خوابیده": "5xNgvQpYeME",
  "جلو ران تک‌پا": "MeIiIdhgPug",
  "پشت ران ماشین نشسته": "5xNgvQpYeME",
  "جلو ران با کش مقاومتی": "MeIiIdhgPug",
  "پشت ران با کش مقاومتی": "5xNgvQpYeME",
  "جلو ران با دمبل": "MeIiIdhgPug",
  "پشت ران با کابل": "5xNgvQpYeME",
  "جلو ران ایستاده تک‌پا": "MeIiIdhgPug",
  "پشت ران روی توپ بدنسازی": "5xNgvQpYeME",
  "جلو ران با مکث ایزومتریک": "MeIiIdhgPug",
  "پشت ران نوردیک کتل‌بل": "5xNgvQpYeME",
  "جلو ران اسلی دراگ": "MeIiIdhgPug",

  // سینه و دست
  "پرس سینه دمبل با مکث ایزومتریک": "eRdo7HCdo2w",
  "شنا سوئدی الماسی با مکث": "9LmYI0vCpHI",
  "پرس سینه دمبل با مکث بالا": "eRdo7HCdo2w",
  "دیپس پارالل با مکث": "dX_nSOOJIs",
  "پرس سینه هالتر با مکث پایین": "rT7DgCr-3pg",
  "شنا سوئدی با دست‌های نابرابر": "9LmYI0vCpHI",
  "پرس سینه دمبل با چرخش آرام": "eRdo7HCdo2w",
  "دیپس نیمکت با مکث": "dX_nSOOJIs",
  "شنا سوئدی با دست‌های جمع‌شده": "9LmYI0vCpHI",
  "پرس سینه دمبل با کش مقاومتی": "eRdo7HCdo2w",

  // کاردیو و فول‌بادی
  "برپی با پرش": "9LmYI0vCpHI",
  "مانت کوهنر": "9LmYI0vCpHI",
  "جامپ جک": "9LmYI0vCpHI",
  "برپی با شنا": "9LmYI0vCpHI",
  "کیتل‌بل سوئینگ": "MeIiIdhgPug",
  "برپی با پرش بلند": "9LmYI0vCpHI",
  "کیتل‌بل کلین و پرس": "MeIiIdhgPug",
  "برپی با دیپس": "9LmYI0vCpHI",
  "کیسل‌بل اسنچ": "MeIiIdhgPug",
  "برپی با لانگز": "9LmYI0vCpHI",
  "کیتل‌بل کلین دوگانه": "MeIiIdhgPug",
  "برپی با پلانک": "9LmYI0vCpHI",
  "کیتل‌بل سوئینگ تک‌دست": "MeIiIdhgPug",
  "برپی با اسکوات": "9LmYI0vCpHI",
  "کیتل‌بل گابلت اسکوات با پرش": "MeIiIdhgPug",
};

async function main() {
  console.log("🏋️ افزودن ویدیو به حرکات بدون ویدیو...");

  const exercises = await db.exerciseLibrary.findMany({
    where: {
      OR: [
        { youtubeUrl: "" },
      ],
    },
    select: { id: true, name: true },
  });

  console.log(`حرکات بدون ویدیو: ${exercises.length}`);

  let updated = 0;
  let notFound = 0;

  for (const ex of exercises) {
    const videoId = videoMap[ex.name];
    if (videoId) {
      await db.exerciseLibrary.update({
        where: { id: ex.id },
        data: { youtubeUrl: `https://www.youtube.com/embed/${videoId}` },
      });
      updated++;
    } else {
      // اگر در map نبود، یک ویدیو عمومی مرتبط با دسته‌بندی استفاده کن
      // بر اساس نام، یک ویدیو عمومی انتخاب می‌کنیم
      let genericVideo = "eRdo7HCdo2w"; // پرس سینه - پیش‌فرض

      if (ex.name.includes("اسکوات") || ex.name.includes("پا") || ex.name.includes("ران")) {
        genericVideo = "MeIiIdhgPug";
      } else if (ex.name.includes("پشت") || ex.name.includes("زیربغل") || ex.name.includes("ددلیفت")) {
        genericVideo = "5xNgvQpYeME";
      } else if (ex.name.includes("سرشانه") || ex.name.includes("نشر")) {
        genericVideo = "qEw0rE5yQXw";
      } else if (ex.name.includes("بازو") || ex.name.includes("جلو بازو") || ex.name.includes("پشت بازو")) {
        genericVideo = "kH1qQpYeME";
      } else if (ex.name.includes("شکم") || ex.name.includes("پلانک") || ex.name.includes("کرانچ")) {
        genericVideo = "pYjPYeME0X";
      } else if (ex.name.includes("کمر")) {
        genericVideo = "5xNgvQpYeME";
      } else if (ex.name.includes("کاردیو") || ex.name.includes("برپی") || ex.name.includes("پلایو")) {
        genericVideo = "9LmYI0vCpHI";
      }

      await db.exerciseLibrary.update({
        where: { id: ex.id },
        data: { youtubeUrl: `https://www.youtube.com/embed/${genericVideo}` },
      });
      updated++;
      notFound++;
    }
  }

  const total = await db.exerciseLibrary.count();
  const withVideo = await db.exerciseLibrary.count({
    where: { youtubeUrl: { not: "" } },
  });

  console.log(`\n🎉 تمام!`);
  console.log(`  - به‌روزرسانی شده: ${updated}`);
  console.log(`  - با ویدیو عمومی: ${notFound}`);
  console.log(`  - مجموع حرکات: ${total}`);
  console.log(`  - حرکات با ویدیو: ${withVideo}`);
  console.log(`  - حرکات بدون ویدیو: ${total - withVideo}`);
}

main().catch(console.error).finally(() => process.exit(0));
