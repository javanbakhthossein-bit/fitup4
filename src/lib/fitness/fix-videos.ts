/**
 * Fix specific cache entries that got wrong videos (off-topic).
 * Run: bun run src/lib/fitness/fix-videos.ts
 */
import { writeFileSync, readFileSync, existsSync } from "fs";

const CACHE_PATH = __dirname + "/videos-cache.json";

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

async function searchYouTube(query: string, maxResults = 12): Promise<string[]> {
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

async function getOembed(videoId: string): Promise<{ title: string; author_name: string } | null> {
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

function looksPersian(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

// Bad cache entries that need re-fetching with better queries
const fixes: { key: string; faQuery: string; enQuery: string }[] = [
  { key: "پشت ران نوردیک", faQuery: "نوردیک همسترینگ کرل آموزش", enQuery: "nordic hamstring curl tutorial" },
  { key: "جلو ران اسلی دراگ", faQuery: "سیسی اسکوات آموزش", enQuery: "sissy squat tutorial" },
  { key: "مانت کوهنر", faQuery: "ماونتن کلایمبر آموزش", enQuery: "mountain climbers exercise tutorial" },
  { key: "پشت ران کابل", faQuery: "پشت ران کابل خوابیده", enQuery: "cable lying leg curl" },
  { key: "پلانک معکوس", faQuery: "پلانک معکوس آموزش", enQuery: "reverse plank tutorial" },
  { key: "افزونه کمر توپ", faQuery: "فیله کمر روی توپ بدنسازی", enQuery: "swiss ball back extension" },
  { key: "لانگز کشویی", faQuery: "لانژ کشویی روی اسلاید", enQuery: "sliding lateral lunge tutorial" },
  { key: "لانگز کورلی", faQuery: "کراسی لانژ آموزش", enQuery: "curtsy lunge tutorial" },
  { key: "جلو بازو متمرکز", faQuery: "جلوبازو متمرکز دمبل نشسته", enQuery: "concentration curl tutorial" },
  { key: "اسکوات با توپ", faQuery: "اسکوات توپ بدنسازی دیواری", enQuery: "swiss ball wall squat tutorial" },
  { key: "افزونه کمر معکوس", faQuery: "فیله کمر معکوس دستگاه", enQuery: "reverse hyperextension machine" },
  { key: "بارفیکس L-Sit", faQuery: "بارفیکس ال سایت آموزش", enQuery: "L-sit pull up tutorial" },
  { key: "روئینگ پاندلی", faQuery: "روئینگ پاندلی هالتر", enQuery: "pendlay row barbell" },
  { key: "پرس سرشانه هالتر پشت گردن", faQuery: "پرس هالتر پشت گردن سرشانه", enQuery: "behind the neck barbell press" },
  { key: "پشت بازو طناب معکوس", faQuery: "پشت بازو سیم کش طناب معکوس", enQuery: "reverse rope triceps pushdown" },
];

async function main() {
  let cache: Record<string, any> = {};
  if (existsSync(CACHE_PATH)) cache = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));

  for (const fix of fixes) {
    console.log(`\n🔧 Fixing: ${fix.key}`);
    let chosen: { videoId: string; title: string; author: string; persian: boolean } | null = null;
    for (const q of [fix.faQuery, fix.enQuery]) {
      console.log(`  🔍 searching: ${q}`);
      const ids = await searchYouTube(q, 12);
      if (ids.length === 0) {
        console.log(`    no results`);
        continue;
      }
      // try Persian first
      for (const id of ids) {
        const info = await getOembed(id);
        if (!info) continue;
        const persian = looksPersian(info.title) || looksPersian(info.author_name);
        if (persian) {
          chosen = { videoId: id, title: info.title, author: info.author_name, persian: true };
          break;
        }
      }
      if (!chosen) {
        // English fallback
        for (const id of ids) {
          const info = await getOembed(id);
          if (info) {
            chosen = { videoId: id, title: info.title, author: info.author_name, persian: false };
            break;
          }
        }
      }
      if (chosen) break;
      await sleep(800);
    }
    if (chosen) {
      cache[fix.key] = chosen;
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
      console.log(`  ✅ ${chosen.videoId} — ${chosen.title.slice(0, 60)} [${chosen.persian ? "FA" : "EN"}]`);
    } else {
      console.log(`  ❌ could not find replacement, keeping old`);
    }
    await sleep(800);
  }

  console.log(`\n✅ Done. Cache saved.`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
