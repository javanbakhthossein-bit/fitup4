/**
 * Fetch REAL Persian YouTube video IDs for each exercise "family".
 *
 * Strategy:
 * 1. Define a list of ~30-40 Persian search queries (one per exercise family).
 * 2. For each query, scrape YouTube search results page, pick first valid
 *    Persian-language video via oembed (fallback to English if needed).
 * 3. Cache videoId per family in a JSON file (videos-cache.json).
 *
 * Run: bun run src/lib/fitness/fetch-real-videos.ts
 */
import { writeFileSync, readFileSync, existsSync } from "fs";

const CACHE_PATH = __dirname + "/videos-cache.json";

// ---------- helpers ----------
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "accept-language": "en-US,en;q=0.9,fa;q=0.8",
        },
      });
      if (res.ok) return await res.text();
      if (res.status === 429) {
        console.log(`  ⏳ rate-limited, sleeping 3s...`);
        await sleep(3000);
        continue;
      }
      console.log(`  ! HTTP ${res.status}`);
      await sleep(1500);
    } catch (e: any) {
      console.log(`  ! fetch err: ${e.message}`);
      await sleep(1500);
    }
  }
  return "";
}

async function searchYouTube(query: string, maxResults = 8): Promise<string[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const html = await fetchWithRetry(url);
  if (!html) return [];
  const ids = new Set<string>();
  const re = /"videoId":"([A-Za-z0-9_-]{11})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && ids.size < maxResults) {
    ids.add(m[1]);
  }
  return Array.from(ids);
}

interface OembedInfo {
  title: string;
  author_name: string;
}

async function getOembed(videoId: string): Promise<OembedInfo | null> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const txt = await fetchWithRetry(url);
  if (!txt) return null;
  try {
    const j = JSON.parse(txt);
    if (j && j.title) return { title: j.title, author_name: j.author_name || "" };
  } catch {
    return null;
  }
  return null;
}

// ---------- family definitions ----------
// Each family maps to a Persian search query (preferred) and English fallback.
interface Family {
  key: string;
  faQuery: string;
  enQuery?: string;
}

const families: Family[] = [
  // سینه / chest
  { key: "پرس سینه دمبل", faQuery: "آموزش پرس سینه دمبل", enQuery: "dumbbell bench press tutorial" },
  { key: "پرس سینه هالتر", faQuery: "آموزش پرس سینه هالتر", enQuery: "barbell bench press form" },
  { key: "پرس سینه هالتر شیب منفی", faQuery: "پرس سینه شیب منفی هالتر", enQuery: "reverse grip decline bench press" },
  { key: "پرس سینه گیلوتین", faQuery: "پرس سینه گیلوتین هالتر", enQuery: "guillotine press exercise" },
  { key: "پرس سینه تک‌دست دمبل", faQuery: "پرس سینه تک دست دمبل", enQuery: "single arm dumbbell bench press" },
  { key: "پرس سینه با کش", faQuery: "پرس سینه با کش مقاومتی", enQuery: "resistance band chest press" },
  { key: "پرس سینه هالتر دست‌بسته", faQuery: "پرس سینه هالتر دست بسته", enQuery: "close grip bench press" },
  { key: "پرس سینه ایزومتریک", faQuery: "پرس سینه ایزومتریک", enQuery: "isometric bench press hold" },
  { key: "فلای سینه کابل", faQuery: "فلای سینه کابل کراس اور", enQuery: "cable chest fly" },
  { key: "فلای سینه توپ", faQuery: "فلای سینه روی توپ بدنسازی", enQuery: "swiss ball dumbbell fly" },
  { key: "فلای سینه کش", faQuery: "فلای سینه با کش", enQuery: "resistance band chest fly" },
  { key: "کراس‌اور کابل", faQuery: "کراس اور کابل سینه", enQuery: "cable crossover chest" },
  { key: "شنا سوئدی", faQuery: "آموزش شنا سوئدی درست", enQuery: "push up proper form" },
  { key: "شنا سوئدی الماسی", faQuery: "شنا سوئدی الماسی", enQuery: "diamond push up" },
  { key: "شنا سوئدی پلایومتریک", faQuery: "شنا سوئدی پلایومتریک", enQuery: "plyometric push up" },
  { key: "شنا سوئدی یک‌دست", faQuery: "شنا سوئدی یک دست", enQuery: "one arm push up" },
  { key: "شنا سوئدی T-Push", faQuery: "شنا سوئدی T پوش", enQuery: "T push up" },
  { key: "دیپس پارالل", faQuery: "آموزش دیپس پارالل", enQuery: "parallel bar dip form" },
  { key: "دیپس نیمکت", faQuery: "دیپس نیمکت آموزش", enQuery: "bench triceps dip" },

  // پشت / back
  { key: "زیربغل سیم‌کش", faQuery: "آموزش زیربغل سیم کش", enQuery: "lat pulldown tutorial" },
  { key: "زیربغل تک‌دست کابل", faQuery: "زیربغل تک دست کابل", enQuery: "single arm cable row" },
  { key: "زیربغل T-Bar", faQuery: "زیربغل تی بار", enQuery: "T-bar row form" },
  { key: "زیربغل ماشین قایقی", faQuery: "زیربغل ماشین قایقی", enQuery: "seated cable row machine" },
  { key: "بارفیکس", faQuery: "آموزش بارفیکس", enQuery: "pull up tutorial" },
  { key: "بارفیکس L-Sit", faQuery: "بارفیکس ال سایت", enQuery: "L-sit pull up" },
  { key: "بارفیکس وزنه‌دار", faQuery: "بارفیکس وزنه دار", enQuery: "weighted pull up" },
  { key: "روئینگ هالتر", faQuery: "آموزش روئینگ هالتر", enQuery: "barbell bent over row" },
  { key: "روئینگ دمبل تک‌دست", faQuery: "روئینگ دمبل تک دست", enQuery: "single arm dumbbell row" },
  { key: "روئینگ پاندلی", faQuery: "روئینگ پاندلی", enQuery: "pendlay row" },
  { key: "روئینگ TRX", faQuery: "روئینگ تی آر ایکس", enQuery: "TRX row" },
  { key: "ددلیفت رومانیایی", faQuery: "ددلیفت رومانیایی آموزش", enQuery: "romanian deadlift form" },
  { key: "ددلیفت رومانیایی تک‌پا", faQuery: "ددلیفت رومانیایی تک پا", enQuery: "single leg RDL" },
  { key: "ددلیفت سومو", faQuery: "ددلیفت سومو", enQuery: "sumo deadlift" },
  { key: "ددلیفت کتل‌بل", faQuery: "ددلیفت کتل بل", enQuery: "kettlebell deadlift" },
  { key: "شراگ هالتر", faQuery: "شراگ هالتر آموزش", enQuery: "barbell shrug" },

  // پا / legs
  { key: "اسکوات گابلت", faQuery: "اسکوات گابلت آموزش", enQuery: "goblet squat" },
  { key: "اسکوات بلغاری", faQuery: "اسکوات بلغاری دمبل", enQuery: "bulgarian split squat" },
  { key: "اسکوات سومو", faQuery: "اسکوات سومو دمبل", enQuery: "sumo squat dumbbell" },
  { key: "اسکوات جلو هالتر", faQuery: "اسکوات جلو هالتر", enQuery: "front squat barbell" },
  { key: "اسکوات هاک", faQuery: "اسکوات هاک ماشین", enQuery: "hack squat machine" },
  { key: "اسکوات پلایومتریک", faQuery: "اسکوات پرشی پلایومتریک", enQuery: "jump squat plyometric" },
  { key: "اسکوات ایزومتریک", faQuery: "اسکوات ایزومتریک", enQuery: "isometric squat hold" },
  { key: "اسکوات با توپ", faQuery: "اسکوات روی توپ بدنسازی", enQuery: "swiss ball squat" },
  { key: "اسکوات با کش", faQuery: "اسکوات با کش مقاومتی", enQuery: "resistance band squat" },
  { key: "اسکات پرس", faQuery: "اسکوات پرس دمبل", enQuery: "squat to press dumbbell" },
  { key: "لانگز دمبل", faQuery: "آموزش لانگز دمبل", enQuery: "dumbbell walking lunges" },
  { key: "لانگز معکوس هالتر", faQuery: "لانگز معکوس هالتر", enQuery: "reverse lunge barbell" },
  { key: "لانگز جانبی", faQuery: "لانگز جانبی دمبل", enQuery: "lateral lunge dumbbell" },
  { key: "لانگز کشویی", faQuery: "لانگز کشویی اسلاید", enQuery: "sliding lateral lunge" },
  { key: "لانگز کورلی", faQuery: "لانگز کورلی", enQuery: "curtsy lunge" },
  { key: "پل باسن", faQuery: "پل باسن آموزش", enQuery: "glute bridge tutorial" },
  { key: "پل باسن تک‌پا", faQuery: "پل باسن تک پا", enQuery: "single leg glute bridge" },
  { key: "پرس پا", faQuery: "پرس پا ماشین آموزش", enQuery: "leg press machine form" },
  { key: "پرس پا تک‌پا", faQuery: "پرس پا تک پا", enQuery: "single leg press" },

  // سرشانه / shoulders
  { key: "پرس سرشانه دمبل", faQuery: "پرس سرشانه دمبل آموزش", enQuery: "dumbbell shoulder press" },
  { key: "پرس سرشانه آرنولد", faQuery: "پرس آرنولد آموزش", enQuery: "arnold press" },
  { key: "پرس سرشانه هالتر ایستاده", faQuery: "پرس سرشانه هالتر ایستاده", enQuery: "standing barbell shoulder press" },
  { key: "پرس سرشانه ماشین", faQuery: "پرس سرشانه ماشین", enQuery: "machine shoulder press" },
  { key: "پرس سرشانه هالتر پشت گردن", faQuery: "پرس پشت گردن هالتر", enQuery: "behind the neck press" },
  { key: "پرس سرشانه کتل‌بل", faQuery: "پرس سرشانه کتل بل", enQuery: "kettlebell shoulder press" },
  { key: "نشر جانب", faQuery: "نشر جانب دمبل آموزش", enQuery: "lateral raise dumbbell" },
  { key: "نشر جانب کش", faQuery: "نشر جانب با کش", enQuery: "lateral raise resistance band" },
  { key: "نشر جانب کابل", faQuery: "نشر جانب کابل تک دست", enQuery: "cable lateral raise" },
  { key: "نشر جلو هالتر", faQuery: "نشر جلو هالتر", enQuery: "front raise barbell" },
  { key: "نشر جلو کتل‌بل", faQuery: "نشر جلو کتل بل", enQuery: "kettlebell front raise" },
  { key: "نشر خم دمبل", faQuery: "نشر خم دمبل سرشانه", enQuery: "bent over lateral raise" },
  { key: "نشر خم کابل", faQuery: "نشر خم کابل", enQuery: "cable bent over lateral raise" },
  { key: "نشر جانب نشسته", faQuery: "نشر جانب نشسته دمبل", enQuery: "seated lateral raise" },

  // بازو / arms
  { key: "جلو بازو هالتر EZ", faQuery: "جلو بازو هالتر EZ آموزش", enQuery: "EZ bar bicep curl" },
  { key: "جلو بازو دمبل چکشی", faQuery: "جلو بازو چکشی دمبل", enQuery: "hammer curl dumbbell" },
  { key: "جلو بازو دمبل نشسته", faQuery: "جلو بازو دمبل نشسته", enQuery: "seated dumbbell curl" },
  { key: "جلو بازو متمرکز", faQuery: "جلو بازو متمرکز دمبل", enQuery: "concentration curl" },
  { key: "جلو بازو 21 تایی", faQuery: "جلو بازو 21 تایی", enQuery: "21s bicep curl" },
  { key: "جلو بازو کابل", faQuery: "جلو بازو کابل تک دست", enQuery: "cable bicep curl" },
  { key: "جلو بازو دمبل چرخشی", faQuery: "جلو بازو دمبل چرخشی", enQuery: "supinating dumbbell curl" },
  { key: "پشت بازو سیم‌کش طناب", faQuery: "پشت بازو سیم کش طناب", enQuery: "triceps rope pushdown" },
  { key: "پشت بازو هالتر خوابیده", faQuery: "پشت بازو هالتر خوابیده", enQuery: "skull crusher barbell" },
  { key: "پشت بازو دیپس نیمکت", faQuery: "پشت بازو دیپس نیمکت", enQuery: "bench dip triceps" },
  { key: "پشت بازو طناب بالا", faQuery: "پشت بازو طناب بالاسر", enQuery: "overhead triceps rope" },
  { key: "پشت بازو طناب معکوس", faQuery: "پشت بازو طناب معکوس", enQuery: "reverse grip triceps pushdown" },
  { key: "پشت بازو تک‌دست دمبل", faQuery: "پشت بازو تک دست دمبل", enQuery: "single arm dumbbell triceps extension" },
  { key: "پشت بازو ماشین دیپس", faQuery: "ماشین دیپس پشت بازو", enQuery: "assisted dip machine" },
  { key: "جلو بازو کابل طناب", faQuery: "جلو بازو کابل طناب", enQuery: "cable rope curl" },

  // شکم / abs
  { key: "پلانک", faQuery: "آموزش پلانک درست", enQuery: "plank proper form" },
  { key: "پلانک جانبی", faQuery: "پلانک جانبی آموزش", enQuery: "side plank form" },
  { key: "کرانچ", faQuery: "آموزش کرانچ شکم", enQuery: "crunch abs tutorial" },
  { key: "کرانچ توپ", faQuery: "کرانچ روی توپ بدنسازی", enQuery: "swiss ball crunch" },
  { key: "کرانچ کابل", faQuery: "کرانچ کابل ایستاده", enQuery: "cable crunch" },
  { key: "کرانچ V-Sit", faQuery: "کرانچ وی سایت", enQuery: "v sit crunch" },
  { key: "کرانچ معکوس", faQuery: "کرانچ معکوس نیمکت", enQuery: "reverse crunch bench" },
  { key: "بالا آوردن پا", faQuery: "بالا آوردن پا شکم", enQuery: "leg raise abs" },
  { key: "کرانچ bicycling", faQuery: "کرانچ دوچرخه", enQuery: "bicycle crunch" },
  { key: "پلانک معکوس", faQuery: "پلانک معکوس", enQuery: "reverse plank" },

  // کمر / lower back
  { key: "افزونه کمر", faQuery: "افزونه کمر نیمکت رومی", enQuery: "back extension roman chair" },
  { key: "افزونه کمر توپ", faQuery: "افزونه کمر روی توپ بدنسازی", enQuery: "swiss ball back extension" },
  { key: "افزونه کمر معکوس", faQuery: "افزونه کمر معکوس", enQuery: "reverse hyperextension" },

  // ران / thighs
  { key: "جلو ران ماشین", faQuery: "جلو ران ماشین آموزش", enQuery: "leg extension machine" },
  { key: "پشت ران ماشین", faQuery: "پشت ران ماشین خوابیده", enQuery: "leg curl machine" },
  { key: "جلو ران تک‌پا", faQuery: "جلو ران تک پا", enQuery: "single leg extension" },
  { key: "جلو ران کش", faQuery: "جلو ران با کش", enQuery: "resistance band leg extension" },
  { key: "پشت ران کش", faQuery: "پشت ران با کش", enQuery: "resistance band leg curl" },
  { key: "پشت ران کابل", faQuery: "پشت ران کابل", enQuery: "cable leg curl" },
  { key: "پشت ران نوردیک", faQuery: "پشت ران نوردیک", enQuery: "nordic hamstring curl" },
  { key: "جلو ران اسلی دراگ", faQuery: "اسلی دراگ جلو ران", enQuery: "sissy squat drag" },

  // کاردیو / cardio
  { key: "برپی", faQuery: "آموزش برپی", enQuery: "burpee form" },
  { key: "مانت کوهنر", faQuery: "مانت کوهنر آموزش", enQuery: "mountain climber exercise" },
  { key: "جامپ جک", faQuery: "جامپ جک آموزش", enQuery: "jumping jacks" },
  { key: "کیتل‌بل سوئینگ", faQuery: "کتل بل سوئینگ آموزش", enQuery: "kettlebell swing" },
  { key: "کیتل‌بل کلین و پرس", faQuery: "کتل بل کلین و پرس", enQuery: "kettlebell clean and press" },
  { key: "کیتل‌بل اسنچ", faQuery: "کتل بل اسنچ", enQuery: "kettlebell snatch" },
  { key: "کیتل‌بل کلین دوگانه", faQuery: "کتل بل کلین دوگانه", enQuery: "double kettlebell clean" },
];

// Determine if an oembed title/author looks Persian
function looksPersian(text: string): boolean {
  // Persian/Arabic Unicode ranges
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

async function pickVideoForFamily(f: Family): Promise<{ videoId: string; title: string; author: string; persian: boolean } | null> {
  for (const query of [f.faQuery, f.enQuery].filter(Boolean) as string[]) {
    const ids = await searchYouTube(query, 10);
    if (ids.length === 0) {
      console.log(`  ⚠ no results for "${query}"`);
      continue;
    }
    for (const id of ids) {
      const info = await getOembed(id);
      if (!info) {
        // skip invalid
        continue;
      }
      const persian = looksPersian(info.title) || looksPersian(info.author_name);
      // Accept Persian immediately; for English fallback only accept if no Persian found
      if (persian) {
        return { videoId: id, title: info.title, author: info.author_name, persian: true };
      }
    }
    // No Persian found for this query; pick the first valid English one
    for (const id of ids) {
      const info = await getOembed(id);
      if (info) {
        return { videoId: id, title: info.title, author: info.author_name, persian: false };
      }
    }
  }
  return null;
}

async function main() {
  console.log(`🎬 Fetching real YouTube videos for ${families.length} exercise families...`);

  // Load cache
  let cache: Record<string, { videoId: string; title: string; author: string; persian: boolean }> = {};
  if (existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
      console.log(`📦 Loaded cache with ${Object.keys(cache).length} entries`);
    } catch {
      cache = {};
    }
  }

  let persianCount = 0;
  let englishCount = 0;
  let failedCount = 0;

  for (const f of families) {
    if (cache[f.key]) {
      console.log(`✓ [cached] ${f.key} → ${cache[f.key].videoId} (${cache[f.key].persian ? "FA" : "EN"})`);
      if (cache[f.key].persian) persianCount++;
      else englishCount++;
      continue;
    }
    console.log(`🔍 Searching: ${f.key} (fa: "${f.faQuery}")`);
    const pick = await pickVideoForFamily(f);
    if (pick) {
      cache[f.key] = pick;
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
      console.log(`  ✅ ${pick.videoId} — ${pick.title} (${pick.author}) [${pick.persian ? "FA" : "EN"}]`);
      if (pick.persian) persianCount++;
      else englishCount++;
    } else {
      console.log(`  ❌ no valid video found`);
      failedCount++;
    }
    await sleep(800); // be polite
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Persian videos: ${persianCount}`);
  console.log(`  English videos: ${englishCount}`);
  console.log(`  Failed: ${failedCount}`);
  console.log(`  Total families: ${families.length}`);
  console.log(`\n💾 Cache saved to: ${CACHE_PATH}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
