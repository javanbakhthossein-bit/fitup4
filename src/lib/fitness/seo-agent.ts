/**
 * SEO Agent — Fully Automated, Self-Sustaining Agentic SEO System
 *
 * Pipeline:
 *  1. analyzeSite() — بررسی دقیق سایت: مقالات موجود، صفحات کلیدی، ساختار URL، کلمات کلیدی فعلی
 *  2. extractKeywords() — استخراج کلمات کلیدی متناسب با کسب‌وکار فیتاپ (با درنظرگرفتن کلمات موجود)
 *  3. generateStrategy() — نوشتن استراتژی جامع سئو: content pillars، کلاسترها، تقویم محتوا، نقشه لینک‌سازی
 *  4. planArticles() — برنامه‌ریزی N مقاله با عنوان، slug، کلمات کلیدی، لینک‌های داخلی، پرامپت تصویر
 *  5. generateArticle() — تولید محتوای کامل + تصاویر + انتشار
 *
 * Self-sustaining features:
 *  - استراتژی و نقشه سایت در DB ذخیره می‌شود
 *  - مقالات برنامه‌ریزی‌شده در صف (SeoArticlePlan) نگهداری می‌شوند
 *  - هر اجرا، قبل از تولید، سایت را دوباره تحلیل می‌کند تا لینک‌سازی همیشه به‌روز باشد
 *  - در صورت شکست تولید یک مقاله، بقیه مقالات ادامه می‌دهند
 *  - slug تکراری تولید نمی‌شود (چک در DB + plan)
 *  - تصاویر با نام SEO-friendly و در ۳ سایز (cover/thumb/full) ذخیره می‌شوند
 */
import { db } from "@/lib/db";
import OpenAI from "openai";
import { avalaiClient, getAvalaiClient, TEXT_MODEL, withSystemDirectives } from "@/lib/fitness/ai";
import { generateImage, type AspectRatio } from "@/lib/fitness/avalai-image";
import {
  processAndSaveArticleImage,
  processAndSaveInlineImage,
} from "@/lib/fitness/image-processing";

// ─── Types ───
export interface SiteAnalysis {
  pages: { url: string; title: string; type: "landing" | "tool" | "list" }[];
  articles: {
    id: string;
    title: string;
    slug: string;
    category: string;
    tags: string;
    excerpt: string;
  }[];
  /**
   * صفحات پویای حرکت ورزشی (۳۰۰ مورد اول، الفبایی) — درخواست مالک 12-e:
   * ایجنت سئو باید به صفحات پویا هم لینک بدهد تا آن‌ها هم رتبه بگیرند.
   * slug لینک: /?exercise={id}
   */
  exercises: { id: string; name: string }[];
  /** صفحات پویای ماده غذایی (۳۰۰ مورد اول، الفبایی) — slug لینک: /?food={id} */
  foods: { id: string; name: string }[];
  existingKeywords: string[];
  totalArticles: number;
  totalViews: number;
}

export interface SeoStrategyContent {
  brand: string;
  domain: string;
  market: string;
  contentPillars: { id: string; name: string; description: string }[];
  targetKeywords: {
    keyword: string;
    intent: "informational" | "commercial" | "transactional" | "navigational";
    difficulty: "low" | "medium" | "high";
    pillar: string;
    /** حجم جستجوی ماهانه تقریبی در بازار ایران */
    searchVolume?: "high" | "medium" | "low";
    /** پتانسیل درآمدزایی — تبدیل به خرید پلن فیتاپ */
    monetization?: "high" | "medium" | "low";
    /** امتیاز فرصت ۰-۱۰۰ — ترکیب ولوم، پولسازی و سختی */
    opportunityScore?: number;
    /** دلیل ارزشمندی — یک خط */
    reason?: string;
  }[];
  clusters: { pillar: string; theme: string; keywords: string[] }[];
  contentCalendar: { week: number; topic: string; keyword: string }[];
  internalLinkMap: { from: string; to: string; anchor: string }[];
  competitiveNotes: string;
  sustainabilityPlan: string;
}

export interface ArticlePlan {
  id?: string;
  keyword: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  pillar: string;
  secondaryKeywords: string[];
  internalLinks: { slug: string; title: string; anchor: string }[];
  coverImagePrompt: string;
  inlineImagePrompts: string[];
}

export interface RunProgress {
  level: "info" | "success" | "warn" | "error";
  msg: string;
  ts: number;
}

export interface RunContext {
  runId: string;
  mode: "full" | "continue" | "strategy_only" | "content_refresh";
  count: number;
  logs: RunProgress[];
  adminId: string;
  startedAt: number;
  successCount: number;
  failCount: number;
  articles: any[];
  errors: string[];
  /**
   * If true, generated articles are published immediately instead of being
   * scheduled for future publishing. Defaults to false (schedule articles).
   */
  publishImmediately?: boolean;
}

/**
 * پارس امنِ فیلد JSON آرایه‌ای رشته‌ای از دیتابیس.
 * یک رکورد خراب (محتوای غیر JSON) نباید کل اجرای ایجنت را بکشد —
 * نتیجه در بدترین حالت آرایه خالی است.
 */
function safeParseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/**
 * پارس امنِ internalLinks ذخیره‌شده در دیتابیس.
 * مقدار ذخیره‌شده آرایه‌ای از {slug, title, anchor} است — پارس با
 * safeParseStringArray آن را به "[object Object]" تبدیل می‌کرد.
 * هر عضو غیرمعتبر حذف می‌شود تا رکورد خراب کل اجرا را نکشد.
 */
function safeParseInternalLinks(
  raw: string | null | undefined
): { slug: string; title: string; anchor: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is { slug: string; title: string; anchor: string } =>
          !!x &&
          typeof x === "object" &&
          typeof (x as any).slug === "string" &&
          typeof (x as any).title === "string" &&
          typeof (x as any).anchor === "string"
      )
      .map((x) => ({ slug: x.slug, title: x.title, anchor: x.anchor }));
  } catch {
    return [];
  }
}

// ─── Logger helper ───
export function log(
  ctx: RunContext,
  level: RunProgress["level"],
  msg: string
): void {
  const entry: RunProgress = { level, msg, ts: Date.now() };
  ctx.logs.push(entry);
  // Also print to server log for debugging
  const prefix =
    level === "error"
      ? "[SEO-AGENT:ERROR]"
      : level === "warn"
      ? "[SEO-AGENT:WARN]"
      : level === "success"
      ? "[SEO-AGENT:OK]"
      : "[SEO-AGENT]";
  console.log(`${prefix} ${msg}`);
  // Persist to DB every 5 logs or every 3 seconds — for live UI updates
  const now = Date.now();
  const lastPersist = (ctx as any)._lastPersist || 0;
  if (ctx.logs.length % 5 === 0 || now - lastPersist > 3000) {
    (ctx as any)._lastPersist = now;
    // fire-and-forget — don't block the agent
    db.seoAgentRun
      .update({
        where: { id: ctx.runId },
        data: {
          logs: JSON.stringify(ctx.logs.slice(-200)),
          successCount: ctx.successCount,
          failCount: ctx.failCount,
        },
      })
      .catch(() => null);
  }
}

// ─── JSON extraction helper ───
function extractJson(content: string): any | null {
  if (!content) return null;
  // Try code block first
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeBlock ? codeBlock[1].trim() : content.trim();
  // Find the first balanced { ... }
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === "{") depth++;
    else if (candidate[i] === "}") {
      depth--;
      if (depth === 0) {
        const jsonStr = candidate.slice(start, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          // try to fix common issues
          try {
            return JSON.parse(
              jsonStr
                .replace(/,\s*}/g, "}")
                .replace(/,\s*]/g, "]")
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/[\u2018\u2019]/g, "'")
            );
          } catch {
            // نازل‌تر: شاید JSON سالم داخل متن است (بعد از بستن اولین آبجکت، دوباره تلاش نکن — همان null)
            return repairTruncatedJson(candidate.slice(start));
          }
        }
      }
    }
  }
  // JSON بسته نشده (truncated) — تلاش برای تعمیر
  return repairTruncatedJson(candidate.slice(start));
}

/**
 * تعمیر JSON بریده‌شده (truncated).
 *
 * ریشه‌بگ: مدل‌های AvalAI (پروکسی gemini) گاهی با وجود finish_reason=stop
 * پاسخ را در میانه JSON قطع می‌کنند (سقف واقعی خروجی از max_tokens کمتر است).
 * نتیجه: extractJson null برمی‌گرداند و کل استراتژی/برنامه‌ریزی به fallback
 * ثابت سقوط می‌کرد — یعنی کلمات پولساز واقعی هرگز تولید نمی‌شدند.
 *
 * الگوریتم: جایگاه‌های «پایان مقدار کامل» را (بعد از } ] " یا قبل از کاما)
 * اسکن می‌کنیم؛ از آخرین به اولین، رشته را در آن نقطه می‌بُریم، کامای آویزان
 * را حذف و براکت‌های باز را می‌بندیم و parse می‌کنیم. اولین parse موفق
 * برمی‌گردد — یعنی «نسخه کامل‌ترِ قابل‌دسترس» از پاسخ، هرچند بخش انتهایی
 * ایندکس‌های آخر حذف شده باشد.
 */
function repairTruncatedJson(s: string): any | null {
  if (!s || s[0] !== "{") return null;
  // اسکن تک‌گذری: ردیابی string/escape و پشته براکت + ثبت نقاط امن پایان مقدار
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  const safeEnds: Array<{ idx: number; stackLen: number }> = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') { inString = false; safeEnds.push({ idx: i + 1, stackLen: stack.length }); }
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === "{" || c === "[") { stack.push(c); continue; }
    if (c === "}" || c === "]") { stack.pop(); safeEnds.push({ idx: i + 1, stackLen: stack.length }); continue; }
    if (c === ",") { safeEnds.push({ idx: i, stackLen: stack.length }); continue; }
  }
  // بالانس است؟ پس مشکل truncation نیست — دست نزن
  if (stack.length === 0 && !inString) return null;

  // از آخرین نقطه امن به عقب — حداکثر ۳۰۰ تلاش
  const tries = Math.min(safeEnds.length, 300);
  for (let k = 0; k < tries; k++) {
    const { idx, stackLen } = safeEnds[safeEnds.length - 1 - k];
    let frag = s.slice(0, idx).trimEnd();
    // کامای آویزان آخر را حذف کن
    while (frag.endsWith(",")) frag = frag.slice(0, -1).trimEnd();
    if (!frag.endsWith("}") && !frag.endsWith("]") && !frag.endsWith('"') && !/[0-9truefalsnl]/.test(frag.slice(-1))) {
      continue; // این نقطه امن در واقع نیست (مثلاً داخل عدد بریده‌شده)
    }
    // کلید بی‌مقدار آخر ("key":) → parse شکست می‌خورد و حلقه جلوتر می‌رود
    // بازسازی پشته براکت‌های باز از روی fragment (تک‌گذری مطمئن)
    const st2: string[] = [];
    let inStr2 = false;
    let esc2 = false;
    for (let i = 0; i < frag.length; i++) {
      const c = frag[i];
      if (inStr2) {
        if (esc2) { esc2 = false; continue; }
        if (c === "\\") { esc2 = true; continue; }
        if (c === '"') inStr2 = false;
        continue;
      }
      if (c === '"') { inStr2 = true; continue; }
      if (c === "{" || c === "[") st2.push(c);
      else if (c === "}" || c === "]") st2.pop();
    }
    // اگر داخل string باز مانده‌ایم → این نقطه برش داخل رشته است → نقطه قبل
    if (inStr2) continue;
    let closed = frag;
    for (let j = st2.length - 1; j >= 0; j--) closed += st2[j] === "{" ? "}" : "]";
    try { return JSON.parse(closed); } catch { /* نقطه قبل */ }
    try { return JSON.parse(closed.replace(/,\s*([}\]])/g, "$1")); } catch { /* نقطه قبل */ }
  }
  return null;
}

// ─── نرمال‌سازی دسته مقاله به فارسی ───
// مدل ممکن است دسته را با کلید انگلیسی برگرداند (training, nutrition, ...)
// اما سایت فیتاپ دسته‌ها را با مقدار فارسی ذخیره و نمایش می‌دهد
// (معادل CATEGORY_LABELS در article-page.tsx و articles-page.tsx).
// این تابع هنگام «ساخت» plan و مقاله، مقدار را به فارسی نرمال می‌کند.
const PERSIAN_CATEGORY_MAP: Record<string, string> = {
  training: "تمرین",
  nutrition: "تغذیه",
  supplement: "مکمل",
  recovery: "بازیابی",
  motivation: "انگیزشی",
  general: "عمومی",
  exercises: "حرکات",
  news: "اخبار",
  "training-methods": "روش‌های-تمرینی",
  metrics: "اندازه‌گیری",
  athletes: "ورزشکاران",
  "steroids-education": "آموزش-استروئیدها",
  // نگاشت دفاعی: pillar هایی که مدل گاهی به‌اشتباه به‌جای category برمی‌گرداند
  vitamins: "مکمل",
  herbal: "مکمل",
  "pre-workout": "مکمل",
  "recovery-supps": "مکمل",
  prehab: "حرکات",
  calisthenics: "تمرین",
  "olympic-lifts": "حرکات",
};

export function normalizeCategoryToPersian(category: string): string {
  if (!category || !category.trim()) return "عمومی";
  const trimmed = category.trim();
  const mapped = PERSIAN_CATEGORY_MAP[trimmed.toLowerCase()];
  if (mapped) return mapped;
  // اگر از قبل فارسی است، همان برگردد (حتی دسته‌های سفارشی)
  if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed;
  // مقدار انگلیسی ناشناخته → عمومی (تا هرگز دسته انگلیسی روی سایت نمایش داده نشود)
  return "عمومی";
}

async function callLlm(system: string, user: string, maxTokens = 4000): Promise<string> {
  // timeout ۶ دقیقه به‌عنوان سقف سخت (backstop) — این ایجنت در پس‌زمینه اجرا می‌شود
  // و تولید مقاله ۳۰۰۰+ کلمه‌ای با مدل slow گاهی بیش از ۶۰ ثانیه طول می‌کشد.
  // + timeout ۹۰ ثانیه‌ای SDK در options برای هر تلاش (fail-fast برای لغزش‌های شبکه).
  // ⚠️ C2b: signal و timeout باید در آرگومان دوم create (options) پاس داده شوند؛
  // اگر داخل body (آرگومان اول) بروند، سریالایز می‌شوند ("signal":{}) و abort هرگز اجرا نمی‌شود.
  // retry: گیت‌وی ArvanCloud جلوی api.avalai.ir به‌صورت ناپایدار 504 می‌دهد (~۳۰s)
  // — تا ۳ تلاش برای خطاهای گذرا، تا مقاله‌ها به‌خاطر یک لغزش شبکه از دست نروند.
  const timeoutMs = 360000;
  const perAttemptTimeoutMs = 90_000;
  const maxAttempts = 3;
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // مهم: از avalaiClient (Proxy) استفاده می‌کنیم، نه getAvalaiClient() مستقیم.
      // Proxy به‌صورت خودکار پارامترهای مخصوص gemini-3.x را اضافه می‌کند
      // (thinkingConfig.thinkingLevel = "low" و انتقال max_tokens/temperature به generationConfig).
      // مهم: دایرکتیو برند (فیتاپ/FitUp) به ابتدای system prompt تزریق می‌شود تا
      // مدل هرگز نام برند را اشتباه ننویسد.
      const completion = await avalaiClient.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: withSystemDirectives(system) },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      } as any, {
        signal: controller.signal,
        timeout: perAttemptTimeoutMs,
        maxRetries: 0, // retry دستی اینجا
      });
      return completion.choices[0]?.message?.content || "";
    } catch (e: any) {
      lastErr = e;
      // SDK خطای abort را به APIUserAbortError و تایم‌اوت را به APIConnectionTimeoutError تبدیل می‌کند
      if (
        e?.name === "AbortError" ||
        e instanceof OpenAI.APIUserAbortError ||
        e instanceof OpenAI.APIConnectionTimeoutError
      ) {
        lastErr = new Error(`AI timeout after ${timeoutMs / 1000}s`);
      }
      const msg = String(e?.message || e);
      const retriable = /50[234]|429|timed out|timeout|ECONNRESET|ECONNREFUSED|fetch failed|socket hang up|AI timeout/i.test(msg);
      console.error(`[seo-agent callLlm] attempt ${attempt}/${maxAttempts} failed:`, msg.slice(0, 150));
      if (!retriable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 3000)); // backoff کوتاه
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastErr;
}

// ─── لینک‌سازی relevance-based (درخواست مالک 12-e) ───
// «سئوی هوشمند باید بدونه چه مقالاتی منتشر شده تا به همشون بتونه لینک درست
// بده» + «میتونه به صفحات پویا هم لینک بده تا لینک‌سازی داخلی قوی‌تر بشه».
// به‌جای «N مقاله اول»، کاندیدهای لینک بر اساس «ارتباط» با کلمات کلیدی هدفِ
// همان مقاله انتخاب می‌شوند — و صفحات پویا (حرکت/غذا) هم کاندید می‌شوند.

/** برچسب نوع آیتم لینک — در رندر پرامپت برای تمایز مقاله/حرکت/غذا/صفحه */
const LINK_KIND_EXERCISE = "حرکت ورزشی";
const LINK_KIND_FOOD = "ماده غذایی";
const LINK_KIND_PAGE = "صفحه";

/** شکل کاندید لینک — همان shape قبلی existingForLinks */
interface LinkCandidate {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string;
  excerpt: string;
}

/**
 * توکنایز متن فارسی برای امتیازدهی هم‌پوشانی کلمات:
 *  - ZWNJ (نیم‌فاصله) و RLM/LE → فاصله (تا «حرکات‌ورزشی» و «حرکات ورزشی» توکن یکسان بگیرند)
 *  - ی/ک عربی → فارسی
 *  - علائم نگارشی/خط تیره → فاصله
 *  - توکن‌های تک‌حرفی حذف می‌شوند (حذف نویز بی‌معنی)
 */
function tokenizeFa(text: string): string[] {
  if (!text) return [];
  return text
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[،؛,.!؟?:()[\]{}"'«»…\-–—_/\\|*&%$#+=~`<>]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/**
 * انتخاب کاندیدهای لینک داخلی بر اساس ارتباط با کلمات کلیدی هدف:
 *  - ~۴۰ مقاله منتشرشده با بیشترین هم‌پوشانی توکنی با (عنوان+تگ+دسته+خلاصه).
 *    tie/امتیاز صفر → جدیدترین‌ها (site.articles از قبل newest-first است؛
 *    پس همیشه حداقل ۱۵ مقاله در لیست هست اگر سایت ۱۵+ مقاله داشته باشد).
 *  - ~۱۲ حرکت ورزشی و ~۱۲ ماده غذایی با بیشترین هم‌پوشانی نام با کلمات کلیدی
 *    (صفحات پویا — slug کامل /?exercise=ID و /?food=ID).
 *  - ۶ صفحه کلیدی ثابت (بدون تغییر).
 * سقف ~۷۰ آیتم — سایز پرامپت معقول می‌ماند.
 */
function buildLinkCandidates(
  site: SiteAnalysis,
  keywords: string[],
  maxArticles = 40,
  maxExercises = 12,
  maxFoods = 12
): LinkCandidate[] {
  // توکن‌های یکتای کلمات کلیدی هدف (مقاله/مقالاتی که قرار است ساخته شوند)
  const kwTokens = new Set<string>();
  for (const k of keywords) {
    for (const t of tokenizeFa(k)) kwTokens.add(t);
  }

  /** امتیاز = تعداد توکن‌های مشترک متن با کلمات کلیدی هدف */
  const scoreOf = (text: string): number => {
    let score = 0;
    for (const t of tokenizeFa(text)) {
      if (kwTokens.has(t)) score++;
    }
    return score;
  };

  // مقالات — امتیاز هم‌پوشانی با عنوان + تگ + دسته + خلاصه
  const topArticles = site.articles
    .map((a, idx) => ({
      a,
      idx,
      score: scoreOf(`${a.title} ${a.tags} ${a.category} ${a.excerpt}`),
    }))
    .sort((x, y) => y.score - x.score || x.idx - y.idx)
    .slice(0, maxArticles);

  // حرکات ورزشی — امتیاز هم‌پوشانی نام حرکت با کلمات کلیدی
  const topExercises = site.exercises
    .map((e, idx) => ({ e, idx, score: scoreOf(e.name) }))
    .sort((x, y) => y.score - x.score || x.idx - y.idx)
    .slice(0, maxExercises);

  // مواد غذایی — امتیاز هم‌پوشانی نام غذا با کلمات کلیدی
  const topFoods = site.foods
    .map((f, idx) => ({ f, idx, score: scoreOf(f.name) }))
    .sort((x, y) => y.score - x.score || x.idx - y.idx)
    .slice(0, maxFoods);

  return [
    // مقالات: slug خام (همان قرارداد قبلی — لینک نهایی /?article=slug)
    ...topArticles.map((s) => ({
      id: s.a.id,
      title: s.a.title,
      slug: s.a.slug,
      category: s.a.category,
      tags: s.a.tags,
      excerpt: s.a.excerpt,
    })),
    // صفحات پویا: slug کامل — مستقیم قابل لینک شدن
    ...topExercises.map((s) => ({
      id: s.e.id,
      title: s.e.name,
      slug: `/?exercise=${s.e.id}`,
      category: LINK_KIND_EXERCISE,
      tags: "",
      excerpt: "",
    })),
    ...topFoods.map((s) => ({
      id: s.f.id,
      title: s.f.name,
      slug: `/?food=${s.f.id}`,
      category: LINK_KIND_FOOD,
      tags: "",
      excerpt: "",
    })),
    ...site.pages.map((p) => ({
      id: "",
      title: p.title,
      slug: p.url,
      category: LINK_KIND_PAGE,
      tags: "",
      excerpt: "",
    })),
  ];
}

/** رندر یکسان کاندیدهای لینک برای پرامپت — با برچسب نوع آیتم */
function renderLinkCandidates(items: LinkCandidate[]): string {
  return items
    .map((p) => {
      if (
        p.category === LINK_KIND_EXERCISE ||
        p.category === LINK_KIND_FOOD ||
        p.category === LINK_KIND_PAGE
      ) {
        return `- (${p.category}) slug="${p.slug}" title="${p.title}"`;
      }
      return `- (مقاله) slug="${p.slug}" title="${p.title}"`;
    })
    .join("\n");
}

// ─── Step 1: Analyze site ───
export async function analyzeSite(ctx: RunContext): Promise<SiteAnalysis> {
  log(ctx, "info", "🔍 شروع تحلیل سایت — استخراج صفحات و مقالات موجود");
  // Static landing pages & tools (همیشه در سایت فیتاپ وجود دارند)
  // مهم: همه مسیرهای معتبر لینک داخلی در سایت فیتاپ. از این لیست برای لینک‌سازی استفاده کن.
  const pages = [
    { url: "/", title: "فیتاپ — مربی هوشمند بدنسازی و تغذیه", type: "landing" as const },
    { url: "/?screen=articles", title: "مقالات ورزشی و تغذیه فیتاپ", type: "list" as const },
    { url: "/?tool=tdee", title: "محاسبه‌گر کالری و TDEE", type: "tool" as const },
    { url: "/?tool=exercises", title: "بانک حرکات ورزشی", type: "tool" as const },
    { url: "/?tool=foods", title: "جدول کالری غذاها", type: "tool" as const },
    { url: "/?screen=auth", title: "ورود / ثبت‌نام فیتاپ", type: "landing" as const },
  ];

  const articles = await db.article.findMany({
    where: { status: "published" },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      tags: true,
      excerpt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // ─── صفحات پویا برای لینک‌سازی داخلی (درخواست مالک 12-e) ───
  // ایجنت سئو باید به صفحات پویا (حرکت ورزشی / ماده غذایی) هم لینک بدهد تا
  // صفحات پویا هم به رتبه یک گوگل برسند. ۳۰۰ مورد اول هر کدام (الفبایی —
  // مدل‌های ExerciseLibrary/FoodLibrary آمار بازدید ندارند؛ مرتب‌سازی الفبایی
  // deterministic است و با sitemap هم‌راستا). خطای هر کدام کل تحلیل را نمی‌کشد.
  let exercises: { id: string; name: string }[] = [];
  try {
    exercises = await db.exerciseLibrary.findMany({
      orderBy: { name: "asc" },
      take: 300,
      select: { id: true, name: true },
    });
  } catch (e: any) {
    log(ctx, "warn", `واکشی حرکات ورزشی برای لینک‌سازی شکست خورد: ${e?.message || e}`);
  }

  let foods: { id: string; name: string }[] = [];
  try {
    foods = await db.foodLibrary.findMany({
      orderBy: { name: "asc" },
      take: 300,
      select: { id: true, name: true },
    });
  } catch (e: any) {
    log(ctx, "warn", `واکشی مواد غذایی برای لینک‌سازی شکست خورد: ${e?.message || e}`);
  }

  // Collect existing keywords from tags
  const existingKeywords = new Set<string>();
  for (const a of articles) {
    if (a.tags) {
      for (const t of a.tags.split(",").map((s) => s.trim()).filter(Boolean)) {
        existingKeywords.add(t);
      }
    }
  }

  const totalViewsAgg = await db.article.aggregate({
    where: { status: "published" },
    _sum: { views: true },
  });

  const result: SiteAnalysis = {
    pages,
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category: a.category,
      tags: a.tags,
      excerpt: a.excerpt,
    })),
    exercises,
    foods,
    existingKeywords: Array.from(existingKeywords),
    totalArticles: articles.length,
    totalViews: totalViewsAgg._sum.views || 0,
  };

  log(
    ctx,
    "success",
    `✅ تحلیل سایت کامل شد: ${result.pages.length} صفحه کلیدی، ${result.totalArticles} مقاله موجود، ${result.exercises.length} حرکت ورزشی، ${result.foods.length} ماده غذایی، ${result.existingKeywords.length} کلمه کلیدی موجود، ${result.totalViews} بازدید کل`
  );
  return result;
}

// ─── Step 2 & 3: Generate strategy ───
export async function generateStrategy(
  ctx: RunContext,
  site: SiteAnalysis
): Promise<SeoStrategyContent> {
  log(ctx, "info", "🧠 شروع تولید استراتژی جامع سئو با هوش مصنوعی");

  // ─── T4: داده‌های واقعی سرچ کنسول (از کش ۲۴ ساعته — T6) ───
  // استراتژی حالا بر اساس تقاضای واقعی جستجوی کاربران ساخته می‌شود؛
  // فرصت‌های «فاصله ضربه‌ای» (جایگاه ۴-۲۰) اولویت آپدیت محتوا هستند.
  let gscSummary = "";
  try {
    const { getGscSummaryForSeo } = await import("@/lib/fitness/search-console");
    gscSummary = await getGscSummaryForSeo();
    if (gscSummary) {
      log(ctx, "info", "📊 داده‌های Google Search Console (کش‌شده) به استراتژی تزریق شد");
    } else {
      log(ctx, "info", "ℹ️ سرچ کنسول پیکربندی نشده — استراتژی بدون داده‌ی جستجوی واقعی ساخته می‌شود");
    }
  } catch {
    // نبود GSC نباید استراتژی را متوقف کند
  }

  const siteSummary = `
صفحات موجود در سایت:
${site.pages.map((p) => `- ${p.url} — ${p.title} (${p.type})`).join("\n")}

مقالات موجود (${site.totalArticles} مقاله):
${site.articles
  .slice(0, 30)
  .map((a, i) => `${i + 1}. "${a.title}" — slug: ${a.slug} — دسته: ${a.category}${a.tags ? ` — تگ‌ها: ${a.tags}` : ""}`)
  .join("\n")}

کلمات کلیدی موجود در سایت:
${site.existingKeywords.join("، ") || "(هیچ)"}
${gscSummary}
`.trim();

  const systemPrompt = `تو یک متخصص ارشد سئو (SEO Strategist) هستی که برای پلتفرم ایرانی فیتاپ (FitUp) کار می‌کنی.
فیتاپ یک پلتفرم هوشمند بدنسازی و تغذیه با هوش مصنوعی است که خدمات زیر را ارائه می‌دهد:
- ۴ پلن اشتراک: اقتصادی (۳۵۰هزار تومان/۴۵روز)، استاندارد (۸۰۰هزار)، پیشرفته (۱.۲ میلیون)، حرفه‌ای (۱.۸ میلیون)
- برنامه تمرینی هوشمند (شامل سوپرست و تری‌ست)
- برنامه غذایی شخصی‌سازی‌شده (با ترکیب و جایگزینی غذا)
- مکمل‌ها با دوز ایمن
- مربی هوشمند ۲۴ ساعته (چت)
- تحلیل عکس غذا، عکس بدن، ویدیو تمرین، آزمایش خون (۴۷ ماده)
- ۳ ابزار رایگان: محاسبه TDEE، بانک حرکات، جدول کالری غذاها
- سیستم معرفی دوست (۱۵۰هزار تومان پاداش برای هر دو نفر)
- مقالات ورزشی و تغذیه

بازار هدف: ایران، فارسی‌زبانان
دامنه: ${process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir"}

شما باید یک استراتژی سئوی جامع، حرفه‌ای و پایدار طراحی کنید که:
۱. **اولویت اول — کلمات پولساز**: کلماتی که مستقیم به فروش پلن فیتاپ تبدیل می‌شوند (تعرفه/قیمت/خرید/آنلاین/بهترین/مقایسه + برنامه بدنسازی/برنامه غذایی/مربی). این کلمات با CPC بالا و نیت خرید (transactional/commercial) ارزش تجاری مستقیم دارند و باید در صدر targetKeywords با بالاترین opportunityScore بیایند.
۲. **دوم — پرسرچ‌ترین‌ها**: کلمات با بالاترین حجم جستجوی ماهانه در بازار ایران (مثل: برنامه بدنسازی، پروتئین وی، کراتین، عضله سازی، لاغری، شکم دوپیک، مکمل بدنسازی، افزایش وزن) — حجم ترافیک سازمان‌دهنده (top/mid-funnel) که بعداً به پلن تبدیل می‌شوند.
۳. **سوم — لانگ‌تیل با رقابت پایین**: عبارات خاص با سختی کم که سریع‌ترین راه رسیدن به صفحه اول گوگل هستند (quick wins).
۴. بر اساس content pillars و topic clusters سازمان‌دهی شود
۵. نقشه لینک‌سازی داخلی دقیق بر اساس صفحات و مقالات موجود بسازد
۶. پایدار باشد — یعنی بعد از ۲ ماه هم کار کند و به‌روز باشد
۷. کلمات کلیدی موجود در سایت را گسترش دهد، نه تکرار کند

— چارچوب ارزش‌گذاری کلمات کلیدی (الزامی برای هر کلمه در targetKeywords):
• searchVolume: حجم جستجوی ماهانه تقریبی در ایران (high=۱۰هزار+ / medium=۲-۱۰هزار / low=کمتر از ۲هزار)
• monetization: پتانسیل تبدیل به خرید پلن فیتاپ — high=نیت خرید واضح (تعرفه، خرید، بهترین، آنلاین) / medium=مستقل به کسب‌وکار ربط دارد / low=صرفاً اطلاعاتی
• opportunityScore: عدد ۰ تا ۱۰۰ = (ارزش ولوم × ارزش پولسازی) ÷ سختی رقابت — بالاتر = اولویت بیشتر
• دلیل (reason): در یک خط بگو چرا این کلمه ارزش دارد
• ترتیب targetKeywords باید بر اساس opportunityScore نزولی باشد (پولسازترین و پرسرچ‌ترین‌ها اول)
• حداقل ۴۰٪ از کلمات باید monetization=high یا intent=transactional/commercial باشند
• ستون تقویم محتوا هم باید بر همین اولویت باشد — هفته‌های اول = کلمات پولساز

فقط و فقط با ساختار JSON زیر پاسخ بده. هیچ متن اضافه‌ای ننویس:
{
  "brand": "فیتاپ",
  "domain": process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir",
  "market": "ایران — فارسی",
  "contentPillars": [
    { "id": "training", "name": "تمرین و بدنسازی", "description": "..." },
    { "id": "nutrition", "name": "تغذیه و رژیم", "description": "..." },
    ...
  ],
  "targetKeywords": [
    { "keyword": "برنامه بدنسازی", "intent": "informational", "difficulty": "medium", "pillar": "training", "searchVolume": "high", "monetization": "high", "opportunityScore": 85, "reason": "پرسرچ‌ترین کلمه حوزه — مستقیم به فروش پلن مربوط است" },
    { "keyword": "تعرفه برنامه بدنسازی", "intent": "transactional", "difficulty": "low", "pillar": "training", "searchVolume": "medium", "monetization": "high", "opportunityScore": 90, "reason": "نیت خرید واضح — آماده پرداخت" },
    ...
  ],
  "clusters": [
    { "pillar": "training", "theme": "تمرینات قفسه سینه", "keywords": ["پرس سینه", "فلای سینه", "..."] },
    ...
  ],
  "contentCalendar": [
    { "week": 1, "topic": "...", "keyword": "..." },
    ...
  ],
  "internalLinkMap": [
    { "from": "new-article-slug", "to": "existing-article-slug-or-page-url", "anchor": "متن لینک" }
  ],
  "competitiveNotes": "نکات رقابتی و فرصت‌ها",
  "sustainabilityPlan": "برنامه پایداری — چگونه بعد از ۲ ماه هم کار کند"
}

مهم: حداقل ۸ content pillar، حداقل ۶۰ کلمه کلیدی هدف، حداقل ۲۰ کلاستر، حداقل ۲۴ هفته تقویم محتوا، حداقل ۲۰ لینک داخلی پیشنهادی.

موضوعاتی که حتماً باید پوشش داده شوند:
۱. مکمل‌های تخصصی (هر مکمل یک کلاستر جداگانه): کراتین مونوهیدرات، پروتئین وی، کازئین پروتئین، پروتئین ایزوله، گینر، BCAA، EAA، گلوتامین، آرژنین، سیترین، بتاآلانین، کافئین، ملاتونین، زینک، منیزیم، ویتامین D، B12، C، E، K، امگا ۳، فیش اویل، مولتی‌ویتامین، ZMA، ال-کارنیتین، تریبولوس، مک جا، اشواگاندا، گینسنگ، کلاژن، اسید هیالورونیک، MSM.
۱-ب) ویتامین‌ها به‌صورت تفکیک‌شده — هر ویتامین یک کلاستر جداگانه: ویتامین A، B1 (تیامین)، B2 (ریبوفلاوین)، B3 (نیاسین)، B5 (پانتوتنیک اسید)، B6 (پیریدوکسین)، B7 (بیوتین)، B9 (فولیک اسید)، B12 (کوبالامین)، C (اسید اسکوربیک)، D، E (توکوفرول)، K (کینون).
۱-ج) مکمل‌های گیاهی و آداپتوژن: جینسنگ قرمز کره‌ای، ماکا روت (پرویی)، اشواگاندا، تورین، شیلجیت (شیلاجیت)، تونکات علی، فنوگریک.
۱-د) مکمل‌های پیش‌تمرین (Pre-Workout): N.O. booster، آرژنین AKG (آلفا کتوگلوتارات)، سیترین مالات، کافئین، بتاآلانین.
۱-هـ) مکمل‌های ریکاوری: گلوتامین، کلاژن هیدرولیز شده، کراتین HCL (هیدروکلراید)، کراتین مونوهیدرات، امگا ۳، ZMA.
۲. استروئیدها و داروها (فقط جنبه آموزشی و هشدار — تشویق به بدنسازی طبیعی): تستوسترون انانتات، سیپیونات، پروپیونات، ناندولون، دکا دورابولین، ترنبالون، وینسترول، آناور، دیانابول، کلن بوترول، HGH، IGF-1، انسولین، PCT، کلومید، نولوادکس، آرمیدکس، پروویرون، HCG.
۲-ب) استروئیدهای بیشتر (فقط آموزشی): اکسی‌مثلون (آنادرول)، فلویوکسترون (هالوتستین)، مسترولون (پروویرون)، دروستانولون (مسترولون)، متندیلون، تورینابول، پارابولان.
۲-ج) SARMs (فقط آموزشی — هشدار): اوستارین (MK-2866)، لیناگولوتامید (Ligandrol)، رادارین (RAD-140)، آندارین (S4) — تأکید بر عوارض و قانونی نبودن.
۲-د) پروتکل‌های PCT (فقط آموزشی): کلومید + نولوادکس، HCG + آرمیدکس (آریمازول)، ترتیب مصرف، تایمینگ، دوز.
۳. حرکات تخصصی (هر حرکت یک کلاستر): پرس سینه، پرس بالاسینه، پرس زیرسینه، اسکوات، اسکوات جلو، ددلیفت، ددلیفت رومانیایی، لات پولدان، بارفیکس، پرس سرشانه، پرس نظامی، شنا، دیپ، لانگز، پرس پا، جلو ران، پشت ران، ساق پا، زیربغل قایقی، زیربغل دمبل، جلو بازو، پشت بازو، ساعد، کرانچ، پلانک، هایپراکستنشن، کشش، فوم رولر.
۳-ب) حرکات کلاژن و کور (Rotator Cuff / Prehab): face pull، external rotation (چرخش خارجی شانه)، internal rotation (چرخش داخلی شانه)، Y-Raise، T-Raise، روتاتور کاف.
۳-ج) حرکات کالیشتیک (Calisthenics): muscle up، front lever، back lever، human flag، planche، handstand، پارالترال.
۳-د) حرکات المپیکی (Olympic Lifts): clean and jerk، snatch، power clean، split jerk — تأکید بر تکنیک و ایمنی.
۴. روش‌های تمرینی: سوپرست، تری‌ست، جاینت‌ست، دراپ‌ست، رست پاز، فش با پول، تدریجی اضافه بار، RPE، RIR، volume training، intensity training، فرکانسی تمرین، دوره‌بندی خطی، دوره‌بندی موجی.
۴-ب) روش‌های تمرینی پیشرفته: German Volume Training (GVT)، 5/3/1 (Wendler)، Starting Strength، PPL (Push/Pull/Legs)، Upper/Lower، Bro Split، Blood Flow Restriction (BFR)، Compensatory Acceleration Training (CAT)، Pre-Exhaust، Post-Exhaust، Rest-Pause، Cluster Sets.
۵. تغذیه تخصصی: کالری مازاد، کالری نقصان، بولکینگ (تمیز و کثیف)، کاتینگ، رفلید، روز تقلب، سایکل کربوهیدرات، کتوژنیک، اینترمیتنت فاستینگ، پالئو، وگان بدنسازی، رژیم پروتئین بالا، رژیم کم کربوهیدرات، تایمینگ تغذیه، پری و پست ورک‌اوت.
۶. آنالیز و اندازه‌گیری: درصد چربی بدن، شاخص توده بدنی (BMI)، BMR، TDEE، متابولیسم پایه، اندازه‌گیری عضلات، پیشرفت ورزشی، رکورد شخصی، 1RM، تست استقامت، تست قدرت.
۷. مربیان و ورزشکاران بزرگ: هانی رامبد، هادی چوپان، کریس بامستد، رونال کلمن، جی کاتلر، فیل هیت، برنون رامبد، دکستر جکسون، مسابقات بدنسازی، المپیا، مستر المپیا.
۸. بیماری‌ها و مصدومیت‌های ورزشی: کمردرد ورزشی، آسیب شانه، کشیدگی عضله، التهاب تاندون، کف پای صافی، دیسک کمر، آسیب زانو، رباط صلیبی، تنگی نفس ورزشی، خستگی مزمن، overtraining، overreaching، ریکاوری ورزشی، استراحت فعال، روز استراحت.
۹. تعرفه و قیمت: تعرفه برنامه بدنسازی، قیمت برنامه بدنسازی، قیمت برنامه ورزشی، تعرفه برنامه تمرینی، قیمت برنامه تمرینی، تعرفه برنامه غذایی، هزینه برنامه بدنسازی، خرید برنامه بدنسازی، خرید برنامه ورزشی، قیمت برنامه بدنسازی آنلاین، تعرفه مربی بدنسازی.

⚠️ برای استروئیدها و SARMs فقط محتوای آموزشی و هشدار تولید کن — هرگز تشویق به مصرف نکن. هدف: آگاه‌سازی کاربران درباره عوارض و ترویج بدنسازی طبیعی.

مهم: در مقالات مربوط به تعرفه و قیمت، همیشه به صفحه پلن‌ها (/?screen=plans یا #pricing) لینک بده تا کاربر بتواند قیمت‌های به‌روز را ببیند. قیمت‌های عددی را در مقاله ننویس چون ممکن است تغییر کنند — به‌جای آن بنویس «برای مشاهده قیمت‌های به‌روز به صفحه پلن‌ها مراجعه کنید».`;

  const userPrompt = `سایت را تحلیل کن و استراتژی سئو بنویس:\n\n${siteSummary}`;

  let strategy: SeoStrategyContent | null = null;
  try {
    // ۱۶۰۰۰ توکن — خروجی JSON استراتژی (۶۰+ کلمه با فیلدهای ارزش‌گذاری)
    // بزرگ است و با ۸۰۰۰ توکن وسط JSON بریده می‌شد (ریشه سقوط به fallback).
    const content = await callLlm(systemPrompt, userPrompt, 16000);
    const parsed = extractJson(content);
    if (parsed) {
      strategy = parsed as SeoStrategyContent;
      // اگر پاسخ بریده شد و تعمیر شد، مقادیر ناقص مشکلی ندارند — ولی
      // حداقل‌ها را چک کن تا استراتژی خالی ذخیره نشود
      if (!Array.isArray(strategy.targetKeywords) || strategy.targetKeywords.length < 10) {
        log(ctx, "warn", `پاسخ استراتژی ناقص بود (${strategy.targetKeywords?.length ?? 0} کلمه) — fallback`);
        strategy = null;
      }
    }
  } catch (e: any) {
    log(ctx, "error", `خطا در تولید استراتژی: ${e.message}`);
  }

  if (!strategy) {
    // Fallback strategy — ensures sustainability even if AI fails
    log(ctx, "warn", "استفاده از استراتژی fallback (پیش‌فرض)");
    strategy = {
      brand: "فیتاپ",
      domain: process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir",
      market: "ایران — فارسی",
      contentPillars: [
        { id: "training", name: "تمرین و بدنسازی", description: "برنامه‌های تمرینی، حرکات، تکنیک‌ها، روش‌های تمرینی" },
        { id: "nutrition", name: "تغذیه و رژیم", description: "رژیم غذایی، درشت‌مغذی‌ها، کالری، بولکینگ، کاتینگ، رژیم‌های تخصصی" },
        { id: "supplement", name: "مکمل‌های ورزشی", description: "کراتین، پروتئین، ویتامین‌ها، آمینواسیدها، مکمل‌های طبیعی" },
        { id: "vitamins", name: "ویتامین‌ها و مواد معدنی (تفکیک‌شده)", description: "هر ویتامین به‌صورت جداگانه: A، B1-B12، C، D، E، K + منیزیم، زینک، کلسیم، آهن" },
        { id: "herbal", name: "مکمل‌های گیاهی و آداپتوژن", description: "جینسنگ قرمز، ماکا روت، اشواگاندا، تورین، شیلجیت، تونکات علی" },
        { id: "pre-workout", name: "مکمل‌های پیش‌تمرین", description: "N.O. booster، آرژنین AKG، سیترین مالات، کافئین، بتاآلانین" },
        { id: "recovery-supps", name: "مکمل‌های ریکاوری", description: "گلوتامین، کلاژن هیدرولیز شده، کراتین HCL، امگا ۳، ZMA" },
        { id: "exercises", name: "بانک حرکات تخصصی", description: "هر حرکت یک مقاله: پرس سینه، اسکوات، ددلیفت، بارفیکس و..." },
        { id: "calisthenics", name: "کالیشتیک و وزن بدن", description: "muscle up، front lever، back lever، human flag، planche، handstand" },
        { id: "olympic-lifts", name: "حرکات المپیکی", description: "clean and jerk، snatch، power clean — تکنیک و ایمنی" },
        { id: "prehab", name: "حرکات پیشگیرانه و روتاتور کاف", description: "face pull، external/internal rotation، Y/T-Raise — جلوگیری از آسیب شانه" },
        { id: "training-methods", name: "روش‌های تمرینی پیشرفته", description: "سوپرست، تری‌ست، GVT، 5/3/1، Starting Strength، PPL، BFR، Rest-Pause" },
        { id: "metrics", name: "آنالیز و اندازه‌گیری", description: "BMI، BMR، TDEE، درصد چربی بدن، 1RM، تست‌های قدرت و استقامت" },
        { id: "recovery", name: "بازیابی، استراحت و مصدومیت‌ها", description: "خواب، ریکاوری، جلوگیری از آسیب، درمان مصدومیت‌های ورزشی" },
        { id: "athletes", name: "مربیان و ورزشکاران بزرگ", description: "هادی چوپان، هانی رامبد، کریس بامستد، رونال کلمن، مستر المپیا" },
        { id: "steroids-education", name: "آموزش آگاه‌سازی استروئیدها و SARMs", description: "اطلاعات آموزشی درباره استروئیدها، SARMs، عوارض، PCT — فقط هشدار، نه تشویق" },
        { id: "motivation", name: "انگیزه و روان‌شناسی", description: "هدف‌گذاری، استمرار، روان‌شناسی ورزش" },
      ],
      targetKeywords: [
        // ─── تمرین و بدنسازی ───
        { keyword: "برنامه بدنسازی", intent: "informational", difficulty: "medium", pillar: "training" },
        { keyword: "برنامه غذایی کاهش وزن", intent: "informational", difficulty: "medium", pillar: "nutrition" },
        { keyword: "تمرین پرس سینه", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "اسکوات صحیح", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "کاهش چربی شکم", intent: "informational", difficulty: "high", pillar: "training" },
        { keyword: "افزایش عضله", intent: "informational", difficulty: "medium", pillar: "training" },
        { keyword: "برنامه عضله‌سازی", intent: "informational", difficulty: "medium", pillar: "training" },
        { keyword: "بادی بیلدینگ", intent: "informational", difficulty: "high", pillar: "training" },
        { keyword: "تناسب اندام", intent: "informational", difficulty: "high", pillar: "training" },
        // ─── مکمل‌ها ───
        { keyword: "کراتین چیست", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "پروتئین وی چیست", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "کراتین مونوهیدرات", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "پروتئین ایزوله", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "کازئین پروتئین", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "گینر وزن", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "BCAA چیست", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "EAA آمینو اسید", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "گلوتامین ورزشی", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "بتاآلانین", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "ویتامین D ورزشکاران", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "ZMA مکمل خواب", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "اشواگاندا ورزش", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "تریتین HCL", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "کلاژن مفاصل", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "ال-کارنیتین چربی سوز", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "مک جا تستوسترون", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "مولتی ویتامین ورزشی", intent: "informational", difficulty: "low", pillar: "supplement" },
        { keyword: "امگا ۳ ورزشکاران", intent: "informational", difficulty: "low", pillar: "supplement" },
        // ─── حرکات تخصصی ───
        { keyword: "آموزش پرس بالاسینه", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "پرس زیرسینه", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "اسکوات جلو", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "ددلیفت رومانیایی", intent: "informational", difficulty: "medium", pillar: "exercises" },
        { keyword: "ددلیفت صحیح", intent: "informational", difficulty: "medium", pillar: "exercises" },
        { keyword: "لات پولدان", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "بارفیکس آموزش", intent: "informational", difficulty: "medium", pillar: "exercises" },
        { keyword: "پرس سرشانه", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "پرس نظامی", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "شنا سوئدی", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "دیپ سینه", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "لانگز پا", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "پرس پا دستگاه", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "جلو ران دستگاه", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "پشت ران پشت", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "ساق پا ایستاده", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "زیربغل قایقی", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "زیربغل دمبل", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "جلو بازو دمبل", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "پشت بازو سیم‌کش", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "ساعد بدنسازی", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "کرانچ شکم", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "پلانک کمری", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "هایپراکستنشن کمر", intent: "informational", difficulty: "low", pillar: "exercises" },
        { keyword: "فوم رولر ریکاوری", intent: "informational", difficulty: "low", pillar: "exercises" },
        // ─── روش‌های تمرینی ───
        { keyword: "سوپرست تمرین", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "تری‌ست بدنسازی", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "جاینت‌ست عضله", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "دراپ‌ست هایپرتروفی", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "رست پاز روش", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "فش با پول تمرین", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "تدریجی اضافه بار", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "RPE تمرین", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "RIR بدنسازی", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "دوره‌بندی موجی", intent: "informational", difficulty: "medium", pillar: "training-methods" },
        { keyword: "دوره‌بندی خطی", intent: "informational", difficulty: "medium", pillar: "training-methods" },
        { keyword: "فرکانسی تمرین عضله", intent: "informational", difficulty: "low", pillar: "training-methods" },
        // ─── تغذیه تخصصی ───
        { keyword: "بولکینگ تمیز", intent: "informational", difficulty: "medium", pillar: "nutrition" },
        { keyword: "بولک کثیف", intent: "informational", difficulty: "medium", pillar: "nutrition" },
        { keyword: "کاتینگ چربی سوزی", intent: "informational", difficulty: "medium", pillar: "nutrition" },
        { keyword: "رفلید کربوهیدرات", intent: "informational", difficulty: "low", pillar: "nutrition" },
        { keyword: "روز تقلب رژیم", intent: "informational", difficulty: "low", pillar: "nutrition" },
        { keyword: "سایکل کربوهیدرات", intent: "informational", difficulty: "medium", pillar: "nutrition" },
        { keyword: "رژیم کتوژنیک بدنسازی", intent: "informational", difficulty: "medium", pillar: "nutrition" },
        { keyword: "اینترمیتنت فاستینگ", intent: "informational", difficulty: "low", pillar: "nutrition" },
        { keyword: "رژیم پالئو", intent: "informational", difficulty: "low", pillar: "nutrition" },
        { keyword: "وگان بدنسازی", intent: "informational", difficulty: "medium", pillar: "nutrition" },
        { keyword: "تغذیه قبل تمرین", intent: "informational", difficulty: "low", pillar: "nutrition" },
        { keyword: "تغذیه بعد تمرین", intent: "informational", difficulty: "low", pillar: "nutrition" },
        { keyword: "محاسبه BMR", intent: "informational", difficulty: "low", pillar: "metrics" },
        { keyword: "کالری روزانه", intent: "informational", difficulty: "low", pillar: "metrics" },
        { keyword: "محاسبه TDEE", intent: "informational", difficulty: "low", pillar: "metrics" },
        { keyword: "درصد چربی بدن", intent: "informational", difficulty: "low", pillar: "metrics" },
        { keyword: "شاخص توده بدنی BMI", intent: "informational", difficulty: "low", pillar: "metrics" },
        { keyword: "محاسبه 1RM", intent: "informational", difficulty: "low", pillar: "metrics" },
        // ─── بازیابی و مصدومیت ───
        { keyword: "خواب و ریکاوری عضله", intent: "informational", difficulty: "low", pillar: "recovery" },
        { keyword: "کمردرد ورزشی", intent: "informational", difficulty: "medium", pillar: "recovery" },
        { keyword: "آسیب شانه بدنسازی", intent: "informational", difficulty: "medium", pillar: "recovery" },
        { keyword: "کشیدگی عضله درمان", intent: "informational", difficulty: "low", pillar: "recovery" },
        { keyword: "التهاب تاندون ورزش", intent: "informational", difficulty: "low", pillar: "recovery" },
        { keyword: "دیسک کمر بدنسازی", intent: "informational", difficulty: "medium", pillar: "recovery" },
        { keyword: "آسیب زانو ورزشکار", intent: "informational", difficulty: "medium", pillar: "recovery" },
        { keyword: "رباط صلیبی آسیب", intent: "informational", difficulty: "medium", pillar: "recovery" },
        { keyword: "overtraining علائم", intent: "informational", difficulty: "low", pillar: "recovery" },
        { keyword: "استراحت فعال ریکاوری", intent: "informational", difficulty: "low", pillar: "recovery" },
        // ─── مربیان و ورزشکاران ───
        { keyword: "هادی چوپان زندگینامه", intent: "informational", difficulty: "low", pillar: "athletes" },
        { keyword: "هانی رامبد مربی", intent: "informational", difficulty: "low", pillar: "athletes" },
        { keyword: "کریس بامستد کلاسیک فیزیک", intent: "informational", difficulty: "low", pillar: "athletes" },
        { keyword: "رونال کلمن بدنساز", intent: "informational", difficulty: "low", pillar: "athletes" },
        { keyword: "جی کاتلر بدنسازی", intent: "informational", difficulty: "low", pillar: "athletes" },
        { keyword: "فیل هیت مستر المپیا", intent: "informational", difficulty: "low", pillar: "athletes" },
        { keyword: "مستر المپیا مسابقات", intent: "informational", difficulty: "low", pillar: "athletes" },
        // ─── استروئیدها (آموزشی) ───
        { keyword: "استروئید آنابولیک عوارض", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "تستوسترون انانتات آموزش", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "ناندولون دکا دورابولین", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "ترنبالون خطرات", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "وینسترول اطلاعات", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "دیانابول عوارض", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "HGH هورمون رشد انسانی", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "PCT درمان پس از دوره", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "کلومید نولوادکس", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "بدنسازی طبیعی بدون استروئید", intent: "informational", difficulty: "low", pillar: "steroids-education" },
        // ─── ویتامین‌ها به‌صورت تفکیک‌شده (Each Vitamin — Deep) ───
        { keyword: "ویتامین A ورزشکاران", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین B1 تیامین", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین B2 ریبوفلاوین", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین B3 نیاسین", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین B5 پانتوتنیک اسید", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین B6 پیریدوکسین", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین B7 بیوتین", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین B9 فولیک اسید", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین C اسید اسکوربیک", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین E توکوفرول", intent: "informational", difficulty: "low", pillar: "vitamins" },
        { keyword: "ویتامین K کینون", intent: "informational", difficulty: "low", pillar: "vitamins" },
        // ─── مکمل‌های گیاهی و آداپتوژن (Herbal — Deep) ───
        { keyword: "جینسنگ قرمز کره‌ای", intent: "informational", difficulty: "low", pillar: "herbal" },
        { keyword: "ماکا روت پرویی", intent: "informational", difficulty: "low", pillar: "herbal" },
        { keyword: "تورین مکمل", intent: "informational", difficulty: "low", pillar: "herbal" },
        { keyword: "شیلجیت شیلاجیت", intent: "informational", difficulty: "low", pillar: "herbal" },
        { keyword: "تونکات علی", intent: "informational", difficulty: "low", pillar: "herbal" },
        { keyword: "فنوگریک تستوسترون", intent: "informational", difficulty: "low", pillar: "herbal" },
        // ─── مکمل‌های پیش‌تمرین (Pre-Workout — Deep) ───
        { keyword: "N.O. booster نیتریک اکساید", intent: "informational", difficulty: "low", pillar: "pre-workout" },
        { keyword: "آرژنین AKG آلفا کتوگلوتارات", intent: "informational", difficulty: "low", pillar: "pre-workout" },
        { keyword: "سیترین مالات پمپ", intent: "informational", difficulty: "low", pillar: "pre-workout" },
        { keyword: "بهترین پیش تمرین", intent: "informational", difficulty: "medium", pillar: "pre-workout" },
        // ─── مکمل‌های ریکاوری (Recovery Supps — Deep) ───
        { keyword: "گلوتامین ریکاوری", intent: "informational", difficulty: "low", pillar: "recovery-supps" },
        { keyword: "کلاژن هیدرولیز شده", intent: "informational", difficulty: "low", pillar: "recovery-supps" },
        { keyword: "کراتین HCL هیدروکلراید", intent: "informational", difficulty: "low", pillar: "recovery-supps" },
        // ─── حرکات کلاژن و کور (Prehab/Rotator Cuff — Deep) ───
        { keyword: "face pull فیس پول", intent: "informational", difficulty: "low", pillar: "prehab" },
        { keyword: "external rotation چرخش خارجی شانه", intent: "informational", difficulty: "low", pillar: "prehab" },
        { keyword: "internal rotation چرخش داخلی شانه", intent: "informational", difficulty: "low", pillar: "prehab" },
        { keyword: "Y-Raise تمرین شانه", intent: "informational", difficulty: "low", pillar: "prehab" },
        { keyword: "T-Raise تمرین کتف", intent: "informational", difficulty: "low", pillar: "prehab" },
        { keyword: "rotator cuff روتاتور کاف", intent: "informational", difficulty: "medium", pillar: "prehab" },
        // ─── حرکات کالیشتیک (Calisthenics — Deep) ───
        { keyword: "muscle up ماسل آپ آموزش", intent: "informational", difficulty: "medium", pillar: "calisthenics" },
        { keyword: "front lever فرانت لور", intent: "informational", difficulty: "high", pillar: "calisthenics" },
        { keyword: "back lever بک لور", intent: "informational", difficulty: "high", pillar: "calisthenics" },
        { keyword: "human flag پرچم انسانی", intent: "informational", difficulty: "high", pillar: "calisthenics" },
        { keyword: "planche پلانش آموزش", intent: "informational", difficulty: "high", pillar: "calisthenics" },
        { keyword: "handstand هندستند", intent: "informational", difficulty: "medium", pillar: "calisthenics" },
        // ─── حرکات المپیکی (Olympic Lifts — Deep) ───
        { keyword: "clean and jerk کلین اند جِرک", intent: "informational", difficulty: "high", pillar: "olympic-lifts" },
        { keyword: "snatch اسنچ آموزش", intent: "informational", difficulty: "high", pillar: "olympic-lifts" },
        { keyword: "power clean پاور کلین", intent: "informational", difficulty: "medium", pillar: "olympic-lifts" },
        // ─── استروئیدهای بیشتر + SARMs + PCT (Steroids Deep) ───
        { keyword: "اکسی‌مثلون آنادرول", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "فلویوکسترون هالوتستین", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "دروستانولون مسترولون", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "متندیلون آموزش", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "اوستارین SARM", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "لیگاندرول SARM عوارض", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "رادارین RAD-140", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "آندارین S4 خطرات", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "پروتکل PCT کلومید نولوادکس", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        { keyword: "HCG و آرمیدکس PCT", intent: "informational", difficulty: "medium", pillar: "steroids-education" },
        // ─── روش‌های تمرینی پیشرفته (Training Methods — Deep) ───
        { keyword: "German Volume Training GVT", intent: "informational", difficulty: "medium", pillar: "training-methods" },
        { keyword: "5/3/1 وندلر برنامه", intent: "informational", difficulty: "medium", pillar: "training-methods" },
        { keyword: "Starting Strength برنامه", intent: "informational", difficulty: "medium", pillar: "training-methods" },
        { keyword: "PPL Push Pull Legs", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "Upper/Lower اسپلیت", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "Bro Split بادی پارت", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "BFR Blood Flow Restriction", intent: "informational", difficulty: "medium", pillar: "training-methods" },
        { keyword: "Compensatory Acceleration Training CAT", intent: "informational", difficulty: "medium", pillar: "training-methods" },
        { keyword: "Pre-Exhaust پیش تخلیه", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "Post-Exhaust پس تخلیه", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "Rest-Pause رست پاز", intent: "informational", difficulty: "low", pillar: "training-methods" },
        { keyword: "Cluster Sets کلاستر ست", intent: "informational", difficulty: "low", pillar: "training-methods" },
        // ─── انگیزه ───
        { keyword: "انگیزه ورزش", intent: "informational", difficulty: "low", pillar: "motivation" },
        { keyword: "هدف‌گذاری ورزشی", intent: "informational", difficulty: "low", pillar: "motivation" },
      ],
      clusters: [
        // ─── تمرین ───
        { pillar: "training", theme: "حرکات پایه بدنسازی", keywords: ["اسکوات", "ددلیفت", "پرس سینه", "پرس بالاسینه"] },
        { pillar: "training", theme: "تمرینات بازو", keywords: ["جلو بازو", "پشت بازو", "بازو با دمبل", "ساعد"] },
        { pillar: "training", theme: "تمرینات پا", keywords: ["اسکوات", "پرس پا", "جلو ران", "پشت ران", "ساق پا", "لانگز"] },
        { pillar: "training", theme: "تمرینات پشت", keywords: ["ددلیفت", "لات پولدان", "زیربغل قایقی", "زیربغل دمبل", "بارفیکس"] },
        { pillar: "training", theme: "تمرینات سرشانه", keywords: ["پرس سرشانه", "پرس نظامی", "نشر جانب", "نشر جلو"] },
        // ─── تغذیه ───
        { pillar: "nutrition", theme: "رژیم کاهش وزن", keywords: ["کالری دریافتی", "نقص کالری", "چربی‌سوزی", "کاتینگ"] },
        { pillar: "nutrition", theme: "رژیم عضله‌سازی", keywords: ["مازاد کالری", "پروتئین بالا", "کربو بالانس", "بولکینگ"] },
        { pillar: "nutrition", theme: "رژیم‌های تخصصی", keywords: ["کتوژنیک", "اینترمیتنت فاستینگ", "پالئو", "وگان بدنسازی", "سایکل کربوهیدرات"] },
        { pillar: "nutrition", theme: "تایمینگ تغذیه", keywords: ["پری ورک‌اوت", "پست ورک‌اوت", "تغذیه قبل تمرین", "تغذیه بعد تمرین", "رفلید"] },
        // ─── مکمل‌ها ───
        { pillar: "supplement", theme: "مکمل‌های پایه", keywords: ["کراتین", "پروتئین وی", "مولتی‌ویتامین", "امگا ۳"] },
        { pillar: "supplement", theme: "پروتئین‌ها", keywords: ["پروتئین ایزوله", "پروتئین کنسانتره", "کازئین پروتئین", "گینر"] },
        { pillar: "supplement", theme: "آمینواسیدها", keywords: ["BCAA", "EAA", "گلوتامین", "آرژنین", "سیترین"] },
        { pillar: "supplement", theme: "ویتامین‌ها و مواد معدنی", keywords: ["ویتامین D", "B12", "C", "E", "K", "زینک", "منیزیم", "کلسیم", "آهن"] },
        { pillar: "supplement", theme: "مکمل‌های طبیعی و گیاهی", keywords: ["اشواگاندا", "گینسنگ", "تریبولوس", "مک جا", "کلاژن"] },
        { pillar: "supplement", theme: "مکمل‌های تخصصی", keywords: ["بتاآلانین", "ZMA", "ال-کارنیتین", "اسید هیالورونیک", "MSM"] },
        // ─── حرکات تخصصی ───
        { pillar: "exercises", theme: "حرکات سینه", keywords: ["پرس سینه", "پرس بالاسینه", "پرس زیرسینه", "فلای سینه", "کراس‌اور"] },
        { pillar: "exercises", theme: "حرکات پا", keywords: ["اسکوات", "اسکوات جلو", "ددلیفت", "پرس پا", "لانگز", "جلو ران", "پشت ران", "ساق پا"] },
        { pillar: "exercises", theme: "حرکات پشت", keywords: ["ددلیفت رومانیایی", "لات پولدان", "بارفیکس", "زیربغل قایقی", "زیربغل دمبل"] },
        { pillar: "exercises", theme: "حرکات شانه", keywords: ["پرس سرشانه", "پرس نظامی", "نشر جانب دمبل", "نشر جلو"] },
        { pillar: "exercises", theme: "حرکات بازو", keywords: ["جلو بازو دمبل", "جلو بازو هالتر", "پشت بازو سیم‌کش", "پشت بازو دمبل", "ساعد"] },
        { pillar: "exercises", theme: "حرکات شکم و مرکز بدن", keywords: ["کرانچ", "پلانک", "نشستن چهارزانو", "هایپراکستنشن"] },
        { pillar: "exercises", theme: "حرکات بدنسازی با وزن بدن", keywords: ["شنا", "بارفیکس", "دیپ", "اسکوات با وزن بدن"] },
        { pillar: "exercises", theme: "ریکاوری و انعطاف", keywords: ["کشش", "فوم رولر", "حرکات انعطاف‌پذیری"] },
        // ─── روش‌های تمرینی ───
        { pillar: "training-methods", theme: "تکنیک‌های شدت", keywords: ["سوپرست", "تری‌ست", "جاینت‌ست", "دراپ‌ست", "رست پاز", "فش با پول"] },
        { pillar: "training-methods", theme: "اصول بارگذاری", keywords: ["تدریجی اضافه بار", "RPE", "RIR", "volume training", "intensity training"] },
        { pillar: "training-methods", theme: "دوره‌بندی تمرین", keywords: ["دوره‌بندی خطی", "دوره‌بندی موجی", "فرکانسی تمرین"] },
        // ─── آنالیز و اندازه‌گیری ───
        { pillar: "metrics", theme: "محاسبات بدنی", keywords: ["BMR", "TDEE", "BMI", "درصد چربی بدن", "متابولیسم پایه"] },
        { pillar: "metrics", theme: "تست‌های عملکردی", keywords: ["1RM", "رکورد شخصی", "تست استقامت", "تست قدرت", "پیشرفت ورزشی"] },
        // ─── ریکاوری و مصدومیت ───
        { pillar: "recovery", theme: "خواب و ریکاوری", keywords: ["خواب عمیق", "استراحت عضله", "ریکاوری فعال", "روز استراحت"] },
        { pillar: "recovery", theme: "مصدومیت‌های شایع", keywords: ["کمردرد ورزشی", "آسیب شانه", "کشیدگی عضله", "التهاب تاندون", "دیسک کمر", "آسیب زانو", "رباط صلیبی"] },
        { pillar: "recovery", theme: "استراحت و پیشگیری", keywords: ["overtraining", "overreaching", "استراحت فعال", "خستگی مزمن"] },
        // ─── مربیان و ورزشکاران ───
        { pillar: "athletes", theme: "قهرمانان ایرانی", keywords: ["هادی چوپان", "هانی رامبد", "برنون رامبد"] },
        { pillar: "athletes", theme: "قهرمانان جهانی", keywords: ["کریس بامستد", "رونال کلمن", "جی کاتلر", "فیل هیت", "دکستر جکسون"] },
        { pillar: "athletes", theme: "مسابقات بدنسازی", keywords: ["مستر المپیا", "المپیا", "مسابقات بدنسازی"] },
        // ─── استروئیدها (آموزشی) ───
        { pillar: "steroids-education", theme: "استروئیدهای آنابولیک", keywords: ["تستوسترون انانتات", "تستوسترون سیپیونات", "تستوسترون پروپیونات", "ناندولون", "دکا دورابولین", "ترنبالون", "وینسترول", "آناور", "دیانابول"] },
        { pillar: "steroids-education", theme: "هورمون‌ها و داروهای مرتبط", keywords: ["HGH", "IGF-1", "انسولین", "کلن بوترول"] },
        { pillar: "steroids-education", theme: "درمان پس از دوره (PCT)", keywords: ["PCT", "کلومید", "نولوادکس", "آرمیدکس", "پروویرون", "HCG", "آنتی استروژن"] },
        { pillar: "steroids-education", theme: "استروئیدهای پیشرفته (فقط آموزشی)", keywords: ["اکسی‌مثلون", "آنادرول", "فلویوکسترون", "هالوتستین", "مسترولون", "دروستانولون", "متندیلون", "تورینابول", "پارابولان"] },
        { pillar: "steroids-education", theme: "SARMs (فقط آموزشی — هشدار)", keywords: ["SARM", "SARMs", "اوستارین", "MK-2866", "لیناگولوتامید", "لیگاندرول", "رادارین", "RAD-140", "آندارین", "S4"] },
        { pillar: "steroids-education", theme: "پروتکل‌های PCT (فقط آموزشی)", keywords: ["پروتکل PCT", "کلومید و نولوادکس", "HCG و آرمیدکس", "تایمینگ PCT", "دوز PCT"] },
        { pillar: "steroids-education", theme: "بدنسازی طبیعی", keywords: ["بدنسازی طبیعی", "بدون استروئید", "جلوگیری از استروئید"] },
        // ─── ویتامین‌ها به‌صورت تفکیک‌شده (Each Vitamin) ───
        { pillar: "vitamins", theme: "ویتامین‌های گروه B", keywords: ["ویتامین B1", "تیامین", "ویتامین B2", "ریبوفلاوین", "ویتامین B3", "نیاسین", "ویتامین B5", "ویتامین B6", "پیریدوکسین", "ویتامین B7", "بیوتین", "ویتامین B9", "فولیک اسید", "ویتامین B12", "کوبالامین"] },
        { pillar: "vitamins", theme: "ویتامین‌های چرب‌محلول", keywords: ["ویتامین A", "ویتامین D", "ویتامین E", "توکوفرول", "ویتامین K", "کینون"] },
        { pillar: "vitamins", theme: "ویتامین C و آنتی‌اکسیدان‌ها", keywords: ["ویتامین C", "اسید اسکوربیک", "آنتی‌اکسیدان ورزشی"] },
        { pillar: "vitamins", theme: "مواد معدنی کلیدی", keywords: ["منیزیم", "زینک", "کلسیم", "آهن", "پتاسیم", "سلنیوم"] },
        // ─── مکمل‌های گیاهی و آداپتوژن ───
        { pillar: "herbal", theme: "آداپتوژن‌های کلاسیک", keywords: ["اشواگاندا", "آشواگاندا", "جینسنگ قرمز", "جینسنگ کره‌ای", "ماکا روت", "ماکا پرویی"] },
        { pillar: "herbal", theme: "گیاهان تقویتی تستوسترون", keywords: ["تریبولوس", "مک جا", "تونکات علی", "فنوگریک", "شیلجیت", "شیلاجیت"] },
        { pillar: "herbal", theme: "آمینواسیدهای ویژه", keywords: ["تورین", "ال-کارنیتین", "ال-تیروزین", "ال-سیستئین"] },
        // ─── مکمل‌های پیش‌تمرین ───
        { pillar: "pre-workout", theme: "پمپ و نیتریک اکساید", keywords: ["N.O. booster", "نیتریک اکساید بوستر", "آرژنین AKG", "آرژنین آلفا کتوگلوتارات", "سیترین مالات", "سیترین"] },
        { pillar: "pre-workout", theme: "انرژی و تمرکز پیش‌تمرین", keywords: ["کافئین پیش تمرین", "بتاآلانین", "بهترین پیش تمرین", "پری ورک‌اوت"] },
        // ─── مکمل‌های ریکاوری ───
        { pillar: "recovery-supps", theme: "ریکاوری عضلانی", keywords: ["گلوتامین ریکاوری", "کراتین HCL", "کراتین هیدروکلراید", "کراتین مونوهیدرات", "ZMA"] },
        { pillar: "recovery-supps", theme: "مفاصل و بافت همبند", keywords: ["کلاژن هیدرولیز شده", "کلاژن هیدرولیزاته", "اسید هیالورونیک", "MSM"] },
        // ─── حرکات پیشگیرانه و روتاتور کاف (Prehab) ───
        { pillar: "prehab", theme: "حرکات روتاتور کاف", keywords: ["face pull", "فیس پول", "external rotation", "چرخش خارجی شانه", "internal rotation", "چرخش داخلی شانه", "rotator cuff", "روتاتور کاف"] },
        { pillar: "prehab", theme: "حرکات اصلاحی کتف و شانه", keywords: ["Y-Raise", "Y ریز", "T-Raise", "T ریز", "حرکات کلاژن", "حرکات کور", "فرم اصلاحی"] },
        // ─── حرکات کالیشتیک ───
        { pillar: "calisthenics", theme: "حرکات پیشرفته کالیشتیک", keywords: ["muscle up", "ماسل آپ", "front lever", "فرانت لور", "back lever", "بک لور", "human flag", "پرچم انسانی", "planche", "پلانش"] },
        { pillar: "calisthenics", theme: "تعادل و هندستند", keywords: ["handstand", "هندستند", "پارالترال", "بارفیکس کالیشتیک", "کرن کالیشتیک", "کالیشتیک"] },
        // ─── حرکات المپیکی ───
        { pillar: "olympic-lifts", theme: "حرکات المپیکی پایه", keywords: ["clean and jerk", "کلین اند جِرک", "snatch", "اسنچ", "power clean", "پاور کلین", "split jerk", "وزنه‌برداری المپیکی", "حرکات المپیکی"] },
        // ─── روش‌های تمرینی پیشرفته ───
        { pillar: "training-methods", theme: "برنامه‌های معروف (Splits & Programs)", keywords: ["German Volume Training", "GVT", "5/3/1", "وندلر", "Starting Strength", "PPL", "Push Pull Legs", "Upper/Lower", "Bro Split"] },
        { pillar: "training-methods", theme: "تکنیک‌های پیشرفته شدت", keywords: ["BFR", "Blood Flow Restriction", "CAT", "Compensatory Acceleration Training", "Pre-Exhaust", "Post-Exhaust", "Rest-Pause", "Cluster Sets"] },
        // ─── انگیزه ───
        { pillar: "motivation", theme: "استمرار ورزش", keywords: ["انگیزه روزانه", "هدف‌گذاری ورزشی", "غلبه بر تنبلی"] },
      ],
      contentCalendar: [
        { week: 1, topic: "آماده‌سازی بدن برای شروع بدنسازی", keyword: "برنامه بدنسازی" },
        { week: 2, topic: "تغذیه قبل و بعد تمرین", keyword: "تغذیه قبل تمرین" },
        { week: 3, topic: "آموزش صحیح اسکوات", keyword: "اسکوات صحیح" },
        { week: 4, topic: "مکمل کراتین و نحوه مصرف", keyword: "کراتین چیست" },
        { week: 5, topic: "محاسبه کالری روزانه", keyword: "کالری روزانه" },
        { week: 6, topic: "تکنیک صحیح ددلیفت", keyword: "ددلیفت صحیح" },
        { week: 7, topic: "سوپرست تمرینی چیست", keyword: "سوپرست تمرین" },
        { week: 8, topic: "بولکینگ تمیز و کثیف", keyword: "بولکینگ تمیز" },
        { week: 9, topic: "پروتئین وی و انواع آن", keyword: "پروتئین وی چیست" },
        { week: 10, topic: "آموزش پرس سینه صحیح", keyword: "تمرین پرس سینه" },
        { week: 11, topic: "اینترمیتنت فاستینگ و بدنسازی", keyword: "اینترمیتنت فاستینگ" },
        { week: 12, topic: "محاسبه TDEE و BMR", keyword: "محاسبه TDEE" },
        { week: 13, topic: "آسیب شانه در بدنسازی و پیشگیری", keyword: "آسیب شانه بدنسازی" },
        { week: 14, topic: "overtraining و علائم آن", keyword: "overtraining علائم" },
        { week: 15, topic: "BCAA و EAA تفاوت و کاربرد", keyword: "BCAA چیست" },
        { week: 16, topic: "دوره‌بندی موجی تمرین", keyword: "دوره‌بندی موجی" },
        { week: 17, topic: "رژیم کتوژنیک برای بدنسازی", keyword: "رژیم کتوژنیک بدنسازی" },
        { week: 18, topic: "اشواگاندا و تاثیر بر تستوسترون", keyword: "اشواگاندا ورزش" },
        { week: 19, topic: "بارفیکس؛ آموزش گام‌به‌گام", keyword: "بارفیکس آموزش" },
        { week: 20, topic: "استروئید آنابولیک و عوارض آن", keyword: "استروئید آنابولیک عوارض" },
        { week: 21, topic: "هادی چوپان؛ مسیر قهرمانی", keyword: "هادی چوپان زندگینامه" },
        { week: 22, topic: "PCT درمان پس از دوره استروئید", keyword: "PCT درمان پس از دوره" },
        { week: 23, topic: "کلاژن و سلامت مفاصل", keyword: "کلاژن مفاصل" },
        { week: 24, topic: "بدنسازی طبیعی بدون استروئید", keyword: "بدنسازی طبیعی بدون استروئید" },
        // ─── هفته‌های اضافه‌شده — کلمات کلیدی جدید (COACH-TIP-GYM-SEO) ───
        { week: 25, topic: "ویتامین D ورزشکاران؛ اهمیت و دوز صحیح", keyword: "ویتامین D ورزشکاران" },
        { week: 26, topic: "ویتامین B12 برای انرژی ورزشکاران", keyword: "ویتامین B12" },
        { week: 27, topic: "جینسنگ قرمز کره‌ای؛ آداپتوژن قدرتمند", keyword: "جینسنگ قرمز کره‌ای" },
        { week: 28, topic: "ماکا روت؛ افزایش استقامت و انرژی", keyword: "ماکا روت پرویی" },
        { week: 29, topic: "سیترین مالات؛ بهترین پمپ پیش‌تمرین", keyword: "سیترین مالات پمپ" },
        { week: 30, topic: "N.O. booster چیست و چگونه کار می‌کند", keyword: "N.O. booster نیتریک اکساید" },
        { week: 31, topic: "کلاژن هیدرولیز شده برای مفاصل", keyword: "کلاژن هیدرولیز شده" },
        { week: 32, topic: "کراتین HCL یا مونوهیدرات؟", keyword: "کراتین HCL هیدروکلراید" },
        { week: 33, topic: "آموزش face pull؛ پیشگیری از آسیب شانه", keyword: "face pull فیس پول" },
        { week: 34, topic: "تمرینات روتاتور کاف برای شانه سالم", keyword: "rotator cuff روتاتور کاف" },
        { week: 35, topic: "ماسل آپ؛ آموزش گام‌به‌گام", keyword: "muscle up ماسل آپ آموزش" },
        { week: 36, topic: "پلانش؛ سخت‌ترین حرکت کالیشتیک", keyword: "planche پلانش آموزش" },
        { week: 37, topic: "clean and jerk؛ آموزش حرکت المپیکی", keyword: "clean and jerk کلین اند جِرک" },
        { week: 38, topic: "snatch؛ پادشاه حرکات المپیکی", keyword: "snatch اسنچ آموزش" },
        { week: 39, topic: "German Volume Training؛ ۱۰ ست ۱۰ تکرار", keyword: "German Volume Training GVT" },
        { week: 40, topic: "5/3/1 وندلر؛ برنامه قدرت ساده و موثر", keyword: "5/3/1 وندلر برنامه" },
        { week: 41, topic: "PPL اسپلیت؛ پوش پول پا", keyword: "PPL Push Pull Legs" },
        { week: 42, topic: "BFR تمرین با محدودیت جریان خون", keyword: "BFR Blood Flow Restriction" },
        { week: 43, topic: "Rest-Pause؛ تکنیک رست پاز برای هایپرتروفی", keyword: "Rest-Pause رست پاز" },
        { week: 44, topic: "SARMs عوارض و خطرات (آموزشی)", keyword: "اوستارین SARM" },
        { week: 45, topic: "پروتکل PCT کامل (آموزشی)", keyword: "پروتکل PCT کلومید نولوادکس" },
        { week: 46, topic: "اکسی‌مثلون (آنادرول)؛ عوارض و هشدار", keyword: "اکسی‌مثلون آنادرول" },
        { week: 47, topic: "Cluster Sets؛ تکنیک کلاستر ست برای قدرت", keyword: "Cluster Sets کلاستر ست" },
        { week: 48, topic: "Y-Raise و T-Raise؛ تقویت کتف فوقانی", keyword: "Y-Raise تمرین شانه" },
      ],
      internalLinkMap: [],
      competitiveNotes:
        "بازار ایران در حوزه فیتنس به شدت در حال رشد است. کلمات کلیدی فارسی رقابت کمتری نسبت به انگلیسی دارند. تمرکز روی long-tail keywords فارسی (مثل آموزش هر حرکت، هر مکمل، عوارض استروئیدها) مزیت رقابتی ایجاد می‌کند. پوشش گسترده موضوعات (مکمل، حرکات، روش‌های تمرینی، تغذیه تخصصی، مصدومیت‌ها، مربیان) فیتاپ را به مرجع کامل بدنسازی فارسی تبدیل می‌کند.",
      sustainabilityPlan:
        "هر هفته ۳ مقاله جدید تولید می‌شود. استراتژی هر ۲ ماه یک‌بار با تحلیل مقالات جدید و کلمات کلیدی در حال ظهور بازبینی می‌شود. صف planned articles همیشه حاوی حداقل ۲۰ ایده آماده تولید است. با داشتن ۱۷ content pillar و ۵۰+ کلاستر (شامل ویتامین‌های تفکیک‌شده، مکمل‌های گیاهی، پیش‌تمرین، ریکاوری، حرکات کالیشتیک، حرکات المپیکی، حرکات روتاتور کاف، SARMs و پروتکل‌های PCT)، حداقل ۲۴۰ مقاله قابل تولید است.",
    };
  }

  // Save strategy to DB
  const siteMap = JSON.stringify(site);
  const summary = `استراتژی سئو ${strategy.contentPillars?.length || 0} ستون محتوایی، ${
    strategy.targetKeywords?.length || 0
  } کلمه کلیدی هدف، ${strategy.clusters?.length || 0} کلاستر، ${
    strategy.contentCalendar?.length || 0
  } هفته تقویم محتوا.`;

  // Deactivate previous strategies, save new one
  await db.seoStrategy.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });
  const prev = await db.seoStrategy.findFirst({
    orderBy: { version: "desc" },
  });
  await db.seoStrategy.create({
    data: {
      version: (prev?.version || 0) + 1,
      isActive: true,
      content: JSON.stringify(strategy),
      summary,
      targetKeywords: (strategy.targetKeywords || [])
        .map((k) => k.keyword)
        .join(", "),
      siteMap,
      plannedCount: 0,
      autoMode: true,
      lastRunAt: new Date(),
    },
  });

  log(
    ctx,
    "success",
    `✅ استراتژی سئو ذخیره شد (نسخه ${(prev?.version || 0) + 1}): ${summary}`
  );
  return strategy;
}

// ─── Step 4: Plan articles ───
export async function planArticles(
  ctx: RunContext,
  strategy: SeoStrategyContent,
  site: SiteAnalysis,
  count: number
): Promise<ArticlePlan[]> {
  log(ctx, "info", `📅 برنامه‌ریزی ${count} مقاله جدید بر اساس استراتژی`);

  // Build list of existing slugs to avoid duplicates
  const existingSlugs = new Set(site.articles.map((a) => a.slug));
  const existingTitles = new Set(
    site.articles.map((a) => a.title.toLowerCase())
  );

  // Get already-planned articles (not yet published)
  const planned = await db.seoArticlePlan.findMany({
    where: { status: { in: ["planned", "queued", "generating"] } },
    select: { keyword: true, title: true, slug: true },
  });
  for (const p of planned) {
    existingSlugs.add(p.slug);
    existingTitles.add(p.title.toLowerCase());
  }

  // Pick top keywords not already covered (avoid duplicate keywords)
  const coveredKeywords = new Set([
    ...site.existingKeywords.map((k) => k.toLowerCase()),
    ...planned.map((p) => p.keyword.toLowerCase()),
  ]);

  const candidateKeywords = (strategy.targetKeywords || [])
    .filter((k) => !coveredKeywords.has(k.keyword.toLowerCase()))
    .slice(0, count * 3); // گروه بزرگ‌تر — بعد از ارزش‌گذاری، بهترین‌ها انتخاب می‌شوند

  if (candidateKeywords.length < count) {
    // also consider cluster keywords
    for (const cluster of strategy.clusters || []) {
      for (const kw of cluster.keywords || []) {
        if (!coveredKeywords.has(kw.toLowerCase()) && candidateKeywords.length < count * 3) {
          candidateKeywords.push({
            keyword: kw,
            intent: "informational" as const,
            difficulty: "low" as const,
            pillar: cluster.pillar,
          });
        }
      }
    }
  }

  // ─── مرتب‌سازی بر اساس ارزش تجاری (الزامی برای پولسازی) ───
  // اولویت: کلمات پولساز (transactional/commercial + monetization بالا) و
  // پرسرچ (volume بالا) با رقابت پایین — بر اساس فریمورک opportunityScore.
  // کلمات بدون امتیاز از استراتژی‌های قدیمی انتهای صف می‌مانند (ترتیب خودشان حفظ می‌شود).
  const MONETIZATION_WEIGHT: Record<string, number> = { high: 40, medium: 20, low: 0 };
  const VOLUME_WEIGHT: Record<string, number> = { high: 30, medium: 15, low: 5 };
  const INTENT_WEIGHT: Record<string, number> = {
    transactional: 30,
    commercial: 25,
    informational: 0,
    navigational: 0,
  };
  const DIFFICULTY_PENALTY: Record<string, number> = { low: 0, medium: 10, high: 25 };

  function keywordValue(k: (typeof candidateKeywords)[number]): number {
    // اگر استراتژی جدید opportunityScore دارد، همان مبنای اصلی است
    if (typeof k.opportunityScore === "number" && k.opportunityScore > 0) {
      return k.opportunityScore;
    }
    // fallback: محاسبه از فیلدهای موجود
    const monetization = k.monetization ? MONETIZATION_WEIGHT[k.monetization] ?? 0 : 0;
    const volume = k.searchVolume ? VOLUME_WEIGHT[k.searchVolume] ?? 0 : 0;
    const intent = k.intent ? INTENT_WEIGHT[k.intent] ?? 0 : 0;
    const penalty = k.difficulty ? DIFFICULTY_PENALTY[k.difficulty] ?? 10 : 10;
    // heuristic: نشانه‌های تجاری فارسی در خود کلمه (برای استراتژی‌های قدیمی
    // که فیلدهای ارزش‌گذاری ندارند — پولسازها همیشه صدرصف)
    const moneyMarkers =
      /تعرفه|قیمت|خرید|هزینه|آنلاین|بهترین|مقایسه|ارزان|کدام|انتخاب|راهنمای خرید/;
    const moneyBonus = moneyMarkers.test(k.keyword) ? 45 : 0;
    return Math.max(0, monetization + volume + intent + moneyBonus - penalty);
  }

  const sorted = [...candidateKeywords].sort(
    (a, b) => keywordValue(b) - keywordValue(a)
  );

  // Pick top N — پولسازترین‌ها اول
  const selected = sorted.slice(0, count);

  const systemPrompt = `تو یک متخصص سئو و برنامه‌ریز محتوای فارسی هستی. برای هر کلمه کلیدی، یک ایده مقاله سئوشده با عنوان جذاب، slug انگلیسی مناسب، و خلاصه تولید کن.
همچنین برای هر مقاله:
- ۳-۵ کلمه کلیدی ثانویه مرتبط (شامل مترادف‌ها و عبارات لانگ‌تیل) پیشنهاد بده
- ۲-۴ لینک داخلی به صفحات/مقالات/حرکات ورزشی/مواد غذایی موجود پیشنهاد بده (با anchor text مناسب)
- یک پرامپت حرفه‌ای به انگلیسی برای تولید تصویر کاور بنویس (photorealistic, fitness-related, no text in image)
- ۲-۳ پرامپت انگلیسی برای تصاویر داخل مقاله (هر کدام با موضوع متفاوت)

فقط با ساختار JSON زیر پاسخ بده:
{
  "articles": [
    {
      "keyword": "کلمه کلیدی",
      "title": "عنوان جذاب مقاله (شامل کلمه کلیدی — بدون سال)",
      "slug": "english-slug-with-hyphens",
      "category": "training|nutrition|motivation|general|supplement|recovery|exercises|training-methods|metrics|athletes|steroids-education|news",
      "excerpt": "خلاصه ۱-۲ خطی",
      "pillar": "training|nutrition|...",
      "secondaryKeywords": ["کلمه مترادف ۱", "کلمه لانگ‌تیل ۲", "کلمه هم‌معنی ۳"],
      "internalLinks": [
        { "slug": "existing-article-slug", "title": "عنوان مقاله هدف", "anchor": "متن لینک" }
      ],
      "coverImagePrompt": "English prompt for cover image — unique to this article",
      "inlineImagePrompts": ["English prompt 1 — unique subject", "English prompt 2 — unique subject"]
    }
  ]
}`;

  // ─── انتخاب لینک‌ها بر اساس ارتباط (درخواست مالک 12-e) ───
  // به‌جای «۱۵ مقاله اول»: ~۴۰ مقاله مرتبط + ~۱۲ حرکت ورزشی + ~۱۲ ماده غذایی
  // (صفحات پویا) + ۶ صفحه کلیدی — امتیازدهی با هم‌پوشانی توکن کلمات کلیدیِ
  // مقالاتی که قرار است برنامه‌ریزی شوند (selected). tie/امتیاز صفر → جدیدترین‌ها.
  const plannedKeywords = selected.map((k) => k.keyword);
  const existingForLinks = buildLinkCandidates(site, plannedKeywords);

  const userPrompt = `برای این ${selected.length} کلمه کلیدی، ایده مقاله تولید کن:
${selected
  .map(
    (k, i) =>
      `${i + 1}. "${k.keyword}" — ستون: ${k.pillar} — سختی: ${k.difficulty}` +
      (k.intent ? ` — نیت: ${k.intent}` : "") +
      (k.searchVolume ? ` — حجم جستجو: ${k.searchVolume}` : "") +
      (k.monetization ? ` — پتانسیل درآمد: ${k.monetization}` : "") +
      (typeof k.opportunityScore === "number" ? ` — امتیاز فرصت: ${k.opportunityScore}` : "")
  )
  .join("\n")}

⚠️ این کلمات بر اساس ارزش تجاری مرتب شده‌اند (پولسازترین‌ها اول). برای کلمات با نیت خرید (transactional/commercial) یا پتانسیل درآمد بالا:
- عنوان باید حس مقایسه/انتخاب/اقدام بدهد (مثلاً «... کدام برای شما مناسب است؟» یا «راهنمای انتخاب + قیمت»)
- در بخش‌های بعدی محتوا، CTA (دعوت به اقدام) قوی به صفحه پلن‌ها یا ابزارهای رایگان فیتاپ گنجانده می‌شود

صفحات/مقالات/حرکات/غذاها موجود برای لینک‌سازی داخلی (فقط به این‌ها لینک بده — انتخاب‌شده بر اساس ارتباط با کلمات کلیدی بالا):
${renderLinkCandidates(existingForLinks)}

قوانین مهم:
- slug باید انگلیسی، با خط تیره، کوتاه و توصیفی باشد (مثلاً: bench-press-form-guide, nutrition-plan-guide).
  ❌ هرگز از slug فارسی یا ترکیب فارسی-انگلیسی استفاده نکن.
- عنوان باید جذاب، شامل کلمه کلیدی و قابل کلیک باشد.
  ❌ هرگز سال (۱۴۰۵، ۲۰۲۶ و ...) را به عنوان اضافه نکن، مگر اینکه کلمه کلیدی خودش شامل سال باشد.
- category باید یکی از مقادیر انگلیسی: training, nutrition, supplement, recovery, motivation, general, exercises, training-methods, metrics, athletes, steroids-education, news
- حداقل ۲ لینک داخلی به مقالات/صفحات موجود بساز + ۱-۲ لینک به صفحات پویا (حرکت ورزشی/ماده غذایی) — صفحات پویا هم باید رتبه بگیرند.
- آیتم‌های «(مقاله)» slug خام دارند — همان slug را در internalLinks بگذار (لینک نهایی: /?article=slug).
- آیتم‌های «(حرکت ورزشی)»، «(ماده غذایی)» و «(صفحه)» slug کامل دارند (مثل /?exercise=آیدی یا /?food=آیدی یا /?tool=tdee) — عیناً همان slug کامل را در internalLinks استفاده کن.
- ⚠️ فقط به مقالاتی که در لیست بالا هستند لینک بده. هرگز به مقاله‌ای که قرار است ساخته شود لینک نده.
- coverImagePrompt: باید یک پرامپت انگلیسی کوتاه و **کاملاً منحصر** برای هر مقاله باشد.
  سبک عکس: عکس ورزشی حرفه‌ای، نورپردازی طبیعی روشن (daylight)، پس‌زمینه باشگاه مدرن،
  رنگ‌های واقعی و زنده، شخص ورزشکار در حال تمرین با فرم صحیح.
  ❌ ممنوع مطلق: نورپردازی دراماتیک، پس‌زمینه تاریک، سبک سینمایی، تم نارنجی-طلایی غالب، "dramatic lighting"، "dark background"، "cinematic".
  ✅ الزامی: anatomically correct, proper proportions, natural pose, no weird anatomy, no extra limbs, bright natural daylight.
  ✅ مهم: هر مقاله باید یک صحنه بصری متفاوت و منحصر داشته باشد. مثلاً:
    - مقاله «پرس سینه» → "athlete performing bench press on flat bench with barbell, spotter standing behind, bright gym daylight"
    - مقاله «اسکوات» → "athlete performing barbell back squat in squat rack, bright natural daylight, modern gym"
    - مقاله «تغذیه ورزشی» → "healthy meal prep with chicken, rice, vegetables on wooden table, bright kitchen daylight"
- inlineImagePrompts: هر کدام باید یک موضوع **کاملاً متفاوت** از کاور و از همدیگر داشته باشند.
  مثلاً اگر کاور "bench press" است، inline ها می‌توانند "dumbbell fly close-up" و "cable crossover from side angle" باشند.
  ❌ هرگز inline با موضوع مشابه کاور نسازید.
  ❌ هرگز inline خالی یا با موضوع کلی (مثل "fitness equipment") ندهید — باید موضوع خاص و مرتبط با بخشی از مقاله باشد.`;

  let articles: ArticlePlan[] = [];
  try {
    const content = await callLlm(systemPrompt, userPrompt, 8000);
    const parsed = extractJson(content);
    if (parsed?.articles && Array.isArray(parsed.articles)) {
      articles = parsed.articles
        .filter(
          (a: any) =>
            a.keyword &&
            a.title &&
            a.slug &&
            !existingSlugs.has(a.slug) &&
            !existingTitles.has(a.title.toLowerCase())
        )
        // نرمال‌سازی دسته به فارسی هنگام ساخت plan (باگ دسته انگلیسی)
        .map((a: any) => ({
          ...a,
          category: normalizeCategoryToPersian(a.category || "general"),
        }));
    }
  } catch (e: any) {
    log(ctx, "error", `خطا در برنامه‌ریزی مقالات: ${e.message}`);
  }

  // Save plans to DB
  const savedPlans: ArticlePlan[] = [];
  for (const plan of articles) {
    try {
      // priority واقعی بر اساس ارزش کلمه (نه عدد ثابت) — صف تولید همیشه
      // پولسازترین مقاله‌ها را اول می‌سازد (orderBy priority desc)
      const matchedKw = selected.find(
        (k) => k.keyword.trim() === plan.keyword.trim()
      );
      const planPriority = Math.max(
        1,
        Math.min(
          100,
          Math.round(
            typeof matchedKw?.opportunityScore === "number"
              ? matchedKw.opportunityScore
              : keywordValue(
                  matchedKw || {
                    keyword: plan.keyword,
                    intent: "informational" as const,
                    difficulty: "medium" as const,
                    pillar: plan.pillar || "general",
                  }
                )
          )
        )
      );
      const dbPlan = await db.seoArticlePlan.create({
        data: {
          keyword: plan.keyword,
          title: plan.title,
          slug: plan.slug,
          category: normalizeCategoryToPersian(plan.category || "general"),
          excerpt: plan.excerpt || "",
          pillar: plan.pillar || "general",
          secondaryKeywords: (plan.secondaryKeywords || []).join(", "),
          internalLinks: JSON.stringify(plan.internalLinks || []),
          coverImagePrompt: plan.coverImagePrompt || "",
          inlineImagePrompts: JSON.stringify(plan.inlineImagePrompts || []),
          status: "planned",
          priority: planPriority,
        },
      });
      savedPlans.push({ ...plan, id: dbPlan.id });
    } catch (e: any) {
      log(ctx, "warn", `ذخیره plan برای "${plan.title}" شکست خورد: ${e.message}`);
    }
  }

  log(
    ctx,
    "success",
    `✅ ${savedPlans.length} مقاله برنامه‌ریزی و در صف ذخیره شد`
  );

  // Update strategy planned count
  await db.seoStrategy.updateMany({
    where: { isActive: true },
    data: { plannedCount: savedPlans.length },
  });

  return savedPlans;
}

/**
 * Compute the scheduled publish date for a new article.
 *
 * Scheduling rules:
 *  1. If the strategy's contentCalendar has an entry whose keyword matches
 *     (case-insensitive substring) the article's plan keyword, the article is
 *     scheduled for `now + (week * 7 days)`. Week 1 = next week, week 2 = 2
 *     weeks from now, etc. — this spreads articles across the calendar as the
 *     strategy intends.
 *  2. Otherwise, the article is scheduled 7 days after the latest already-scheduled
 *     draft article (so articles never collide on the same day). If no draft is
 *     currently scheduled, it's scheduled 1 day from now as a sensible default.
 *  3. The returned date is always strictly in the future (>= now + 1 hour) so the
 *     cron publisher won't immediately fire on the same run.
 *
 * Returns null when `publishImmediately` is true (caller should publish now).
 */
export async function computeScheduledAt(
  plan: ArticlePlan,
  strategy: SeoStrategyContent | null | undefined,
  publishImmediately: boolean = false
): Promise<Date | null> {
  if (publishImmediately) return null;

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  // 1) پیدا کردن آخرین مقاله زمان‌بندی‌شده (draft با scheduledAt)
  const latestScheduled = await db.article.findFirst({
    where: {
      status: "draft",
      scheduledAt: { not: null },
    },
    orderBy: { scheduledAt: "desc" },
    select: { scheduledAt: true },
  });

  // 2) محاسبه تاریخ پایه
  // اگر مقاله زمان‌بندی‌شده‌ای وجود دارد، از آن استفاده کن
  // در غیر این صورت، از امروز استفاده کن
  let baseDate = now;
  if (latestScheduled?.scheduledAt) {
    baseDate = new Date(latestScheduled.scheduledAt);
  }

  // 3) فاصله دقیقاً ۴ روز بین هر مقاله
  const gapDays = 4;

  const target = new Date(baseDate);
  target.setDate(target.getDate() + gapDays);
  // ساعت ۹ صبح به وقت تهران (UTC+3:30)
  // سرور ممکن است timezone متفاوتی داشته باشد، پس UTC را تنظیم می‌کنیم
  // ۹ صبح تهران = ۵:۳۰ UTC
  target.setUTCHours(5, 30, 0, 0);

  // 4) مطمئن شو که تاریخ در آینده است
  if (target.getTime() < oneHourFromNow.getTime()) {
    // اگر تاریخ محاسبه‌شده در گذشته است، فردا ساعت ۹ صبح تهران استفاده کن
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + 1);
    fallback.setUTCHours(5, 30, 0, 0); // ۹ صبح تهران
    return fallback;
  }

  return target;
}

/**
 * درج خودکار یک جای‌نگهدار تصویر inline وقتی مدل هیچ placeholder ای در متن نگذاشته است.
 * (ریشه باگ «تصاویر inline در مقاله نمی‌آیند»)
 * جای درج (به‌ترتیب اولویت):
 *  ۱. قبل از اولین هدینگ H2/H3 بعد از کاراکتر ~۱۵۰۰ (معادل بعد از بخش دوم H2)
 *  ۲. قبل از سومین هدینگ H2/H3 (مقاله با بخش‌های کوتاه)
 *  ۳. قبل از بخش سوالات متداول (FAQ)
 *  ۴. در ~۶۰٪ طول محتوا (نزدیک‌ترین شکست پاراگراف)
 */
function insertFallbackInlinePlaceholder(content: string, keyword: string): string {
  const placeholder = `![${keyword} — تصویر آموزشی](IMAGE_PLACEHOLDER_1)`;

  // هدینگ‌های H2/H3 مقاله (اندیس هر کدام به «\n» قبل از ## اشاره دارد)
  const headingRegex = /\n#{2,3}\s/g;
  const headings: number[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = headingRegex.exec(content)) !== null) {
    headings.push(hm.index);
  }

  // ۱) اولین هدینگ بعد از کاراکتر ~۱۵۰۰ (تقریباً پایان بخش دوم H2)
  const late = headings.find((p) => p >= 1500);
  if (late !== undefined) {
    return (
      content.slice(0, late).trimEnd() +
      "\n\n" +
      placeholder +
      "\n\n" +
      content.slice(late).trimStart()
    );
  }

  // ۲) سومین هدینگ (مقاله‌ای که بخش‌های کوتاهی دارد)
  if (headings.length >= 3) {
    const t = headings[2];
    return (
      content.slice(0, t).trimEnd() +
      "\n\n" +
      placeholder +
      "\n\n" +
      content.slice(t).trimStart()
    );
  }

  // ۳) قبل از بخش FAQ
  const faqMatch = content.match(
    /\n#{2,3}\s[^\n]*(سوالات\s+متداول|پرسش‌?های\s+متداول|FAQ)/i
  );
  if (faqMatch && faqMatch.index !== undefined) {
    const t = faqMatch.index;
    return (
      content.slice(0, t).trimEnd() +
      "\n\n" +
      placeholder +
      "\n\n" +
      content.slice(t).trimStart()
    );
  }

  // ۴) ~۶۰٪ طول محتوا — نزدیک‌ترین شکست پاراگراف
  let cut = Math.floor(content.length * 0.6);
  let nl = content.indexOf("\n\n", cut);
  if (nl === -1) nl = content.lastIndexOf("\n\n", cut);
  if (nl === -1) nl = cut;
  return (
    content.slice(0, nl).trimEnd() +
    "\n\n" +
    placeholder +
    "\n\n" +
    content.slice(nl).trimStart()
  );
}

// ─── Step 5: Generate single article with images ───
export async function generateArticle(
  ctx: RunContext,
  plan: ArticlePlan,
  site: SiteAnalysis,
  strategy?: SeoStrategyContent | null
): Promise<{ articleId: string; slug: string; coverUrl: string; wordCount: number; scheduledAt: Date | null }> {
  log(ctx, "info", `📝 شروع تولید مقاله: "${plan.title}" (slug: ${plan.slug})`);

  // Mark plan as generating
  if (plan.id) {
    await db.seoArticlePlan.update({
      where: { id: plan.id },
      data: { status: "generating", attempts: { increment: 1 } },
    });
  }

  // ─── انتخاب لینک‌ها بر اساس ارتباط (درخواست مالک 12-e) ───
  // به‌جای «۲۰ مقاله اول»: ~۴۰ مقاله مرتبط + ~۱۲ حرکت ورزشی + ~۱۲ ماده غذایی
  // (صفحات پویا) + ۶ صفحه کلیدی — امتیازدهی با هم‌پوشانی توکنی کلمات کلیدی
  // همین مقاله (اصلی + ثانویه). tie/امتیاز صفر → جدیدترین مقالات.
  const planKeywords = [plan.keyword, ...plan.secondaryKeywords];
  const existingForLinks = buildLinkCandidates(site, planKeywords);

  // Generate full article content (2000+ words)
  const contentSystem = `تو یک نویسنده حرفه‌ای محتوای ورزشی و تغذیه فارسی هستی. مقالات تو:
- حداقل ۱۸۰۰ کلمه هستند
- کاملاً سئوشده هستند (کلمه کلیدی اصلی در H1، پاراگراف اول، چند بار در متن، و در نتیجه‌گیری)
- ساختار حرفه‌ای دارند: H1، چند H2، چند H3، لیست‌ها، نقل‌قول‌های برجسته
- علمی، دقیق و کاربردی هستند (نه کلی‌گویی)
- لحن حرفه‌ای اما قابل فهم دارند
- شامل ایموجی‌های مرتبط برای خوانایی بهتر
- با فرمت Markdown هستند
- الزامی: شامل ۱ تا ۲ جای‌نگهدار تصویر داخل متن با فرمت دقیق ![توضیح فارسی تصویر حاوی کلمه کلیدی](IMAGE_PLACEHOLDER_1)
  • حتماً حداقل یک جای‌نگهدار تصویر با همین فرمت در میانه مقاله (بعد از بخش دوم H2) بگذار.
  • در مقالات خیلی طولانی می‌توانی تصویر دوم را با فرمت ![توضیح فارسی دیگر](IMAGE_PLACEHOLDER_2) در بخشی متفاوت اضافه کن.
  • مهم: alt text باید توصیفی، فارسی و حاوی کلمه کلیدی باشد (حداقل ۵ کلمه). مثال: ![جدول کالری غذاها و مواد مغذی](IMAGE_PLACEHOLDER_1)
  • تصویر inline باید موضوعی مکمل و متفاوت از کاور داشته باشد (مثلاً کاور صحنه کلی است؛ inline نمای نزدیک تکنیک، جزئیات اجرا یا مرحله‌ای از حرکت).
  • ⚠️ الزامی: جای‌نگهدار تصویر دقیقاً با همین ساختار ![...](IMAGE_PLACEHOLDER_1) باید در Markdown نهایی بیاید — هرگز آن را حذف نکن، جابه‌جا نکن یا به‌صورت متن ساده ننویس.
- شامل جدول مقایسه‌ای (Markdown table) حداقل در یک بخش
- شامل سؤالات متداول (FAQ) با ساختار H3 در انتها
- شامل نتیجه‌گیری انگیزشی

قوانین بسیار مهم (حتماً رعایت کن):
- هر مقاله حتماً باید یک H1 در ابتدا داشته باشد (عنوان مقاله).
- هیچ‌گاه دو تصویر را پشت سر هم قرار نده — همیشه حداقل یک پاراگراف متن بین دو تصویر باشد.
- هیچ‌گاه کلمات h1, h2, h3, H1, H2, H3 را به‌عنوان متن در heading‌ها ننویس. مثلاً ننویس '### h3 سوال' یا '### H3: سوال' — فقط بنویس '### سوال'.
- از جدول Markdown (table) برای مقایسه‌ها و داده‌های ساختاریافته استفاده کن — حداقل یک جدول در هر مقاله.

قوانین مهم لینک‌های داخلی (بسیار مهم):
لینک‌های داخلی فقط با این فرمت‌ها مجاز هستند:
۱. لینک به صفحه اصلی: [متن](/)
۲. لینک به ابزارها: [متن](/?tool=tdee) یا [متن](/?tool=exercises) یا [متن](/?tool=foods)
۳. لینک به مقاله دیگر: [متن](/?article=slug) — slug را از لیست مقالات موجود انتخاب کن
۴. لینک به لیست مقالات: [متن](/?screen=articles)
۵. لینک به صفحه حرکت ورزشی: [متن](/?exercise=آیدی) — آیدی را فقط از لیست «حرکات ورزشی موجود» بردار
۶. لینک به صفحه ماده غذایی: [متن](/?food=آیدی) — آیدی را فقط از لیست «مواد غذایی موجود» بردار
هیچ‌گاه از فرمت /article/slug استفاده نکن — این کار نمی‌کند. همیشه /?article=slug استفاده کن.
هیچ‌گاه از /blog استفاده نکن — این مسیر وجود ندارد. از /?screen=articles استفاده کن.
⚠️ فقط به مقالاتی که در لیست "مقالات موجود" هستند لینک بده. هرگز به مقاله‌ای که هنوز ساخته نشده لینک نده.
⚠️ آیدی exercise/food را هرگز از خودت نساز — فقط آیدی‌های موجود در لیست‌های «حرکات ورزشی/مواد غذایی موجود» معتبرند.
💡 ۲-۳ لینک به صفحات پویا (حرکت ورزشی/ماده غذایی) هم در متن بگذار — لینک‌سازی داخلی قوی‌تر می‌شود و صفحات پویا هم رتبه می‌گیرند.

قوانین محتوایی فوق‌حرفه‌ای:
- مقاله باید کاملاً یونیک و اصلی باشد — نه کپی از سایت‌های دیگر
- محتوا باید بر اساس آخرین تحقیقات علمی و پزشکی باشد
- از آمار، اعداد و داده‌های علمی استفاده کن (با ذکر منبع در متن)
- لحن باید ترغیب‌کننده و فروش‌محور باشد — کاربر را به خرید برنامه بدنسازی تشویق کن
- در پایان مقاله، یک پاراگراف CTA (دعوت به اقدام) برای خرید برنامه فیتاپ اضافه کن
- از کلمات کلیدی سئو به‌صورت طبیعی در متن استفاده کن (keyword density 1-2٪)
- مقاله باید حداقل ۲۰۰۰ کلمه باشد
- شامل نکات عملی و کاربردی باشد که کاربر بلافاصله استفاده کند`;

  // دسته «آموزش استروئیدها» — با هر دو مقدار انگلیسی و فارسی (پس از نرمال‌سازی)
  const isSteroidsEducation =
    plan.category === "steroids-education" || plan.category === "آموزش-استروئیدها";

  // ─── ارزش تجاری کلمه کلیدی (برای CTA و لحن فروش) ───
  const kwMeta = (strategy?.targetKeywords || []).find(
    (k) => k.keyword.trim() === plan.keyword.trim()
  );
  const isMoneyKeyword =
    kwMeta?.intent === "transactional" ||
    kwMeta?.intent === "commercial" ||
    kwMeta?.monetization === "high" ||
    /تعرفه|قیمت|خرید|هزینه|آنلاین|بهترین|مقایسه/.test(plan.keyword);

  const contentUser = `یک مقاله کامل بنویس با مشخصات زیر:

عنوان: ${plan.title}
کلمه کلیدی اصلی: ${plan.keyword}
کلمات کلیدی ثانویه: ${plan.secondaryKeywords.join("، ")}
دسته: ${plan.category}
خلاصه: ${plan.excerpt}
${isMoneyKeyword ? `
💰 این مقاله یک «کلمه کلیدی پولساز» است (نیت خرید/مقایسه — امتیاز فرصت: ${kwMeta?.opportunityScore ?? "بالا"}):
- لحن و ساختار مقاله باید بازدیدکننده را به مشتری تبدیل کند — مستقیم و بدون تعارف
- یک بخش «مقایسه گزینه‌ها» یا «راهنمای انتخاب» با جدول Markdown حتماً داشته باش
- CTA نهایی قوی بنویس: مزیت فیتاپ (برنامه شخصی‌سازی‌شده هوشمند، مربی AI ۲۴ ساعته، تحلیل بدن/غذا/ویدیو) + دعوت به صفحه پلن‌ها [مشاهده پلن‌ها](/?screen=plans)
- اگر موضوع قیمت است، قیمت عددی ننویس — به صفحه پلن‌ها ارجاع بده
- در میانه مقاله هم یک CTA ملایم به ابزار رایگان (مثل [محاسبه TDEE](/?tool=tdee)) بگذار که کاربر را وارد قیف فروش کند
` : ""}

${isSteroidsEducation ? `
⚠️ هشدار بسیار مهم برای این دسته:
این مقاله در دسته «آموزش آگاه‌سازی استروئیدها» است. هدف فقط و فقط آگاه‌سازی کاربران درباره عوارض، خطرات و پیامدهای مصرف استروئید است. در مقاله:
- هرگز به مصرف استروئید تشویق نکن
- عوارض کوتاه‌مدت و بلندمدت (مثل آسیب کبد، ناباروری، مشکلات قلبی، تغییرات هورمونی، ریزش مو، آکنه، نوسانات خلقی) را با جزئیات شرح بده
- مهم‌ترین بخش مقاله باید «راهکارهای جایگزین طبیعی» باشد — افزایش تستوسترون طبیعی، تغذیه، مکمل‌های قانونی، خواب، استرس
- در انتهای مقاله، یک هشدار جدی پزشکی اضافه کن: «مصرف استروئید بدون نسخه پزشک غیرقانونی و خطرناک است»
- CTA فروش‌محور استفاده نکن — به جای آن، کاربر را به مشاوره با مربی فیتاپ برای بدنسازی طبیعی دعوت کن
- لحن باید جدی، علمی و پزشکی باشد — نه ترغیب‌کننده و فروش‌محور
` : ""}

لینک‌های داخلی پیشنهادی (حتماً در متن از این‌ها استفاده کن):
${plan.internalLinks
  .map((l) =>
    // slug کامل (صفحات پویا/ابزار — مثل /?exercise=آیدی) عیناً؛ slug خام مقاله با پیشوند /?article=
    l.slug.startsWith("/")
      ? `- [${l.anchor}](${l.slug}) — هدف: "${l.title}"`
      : `- [${l.anchor}](/?article=${l.slug}) — هدف: "${l.title}"`
  )
  .join("\n")}

سایر صفحات/مقالات/حرکات/غذاها موجود برای لینک‌سازی اضافی (به این‌ها هم با فرمت /?article=slug یا /?tool=... یا /?exercise=آیدی یا /?food=آیدی لینک بزن):
${renderLinkCandidates(existingForLinks)}

یادآوری فرمت لینک‌ها:
- لینک به ابزار: [متن](/?tool=tdee) یا [متن](/?tool=exercises) یا [متن](/?tool=foods)
- لینک به مقاله: [متن](/?article=slug)
- لینک به صفحه اصلی: [متن](/)
- لینک به لیست مقالات: [متن](/?screen=articles)
- لینک به صفحه حرکت ورزشی: [متن](/?exercise=آیدی)
- لینک به صفحه ماده غذایی: [متن](/?food=آیدی)

فقط محتوای Markdown بنویس. بدون توضیح اضافه در ابتدا یا انتها.`;

  let articleContent = "";
  try {
    articleContent = await callLlm(contentSystem, contentUser, 8000);
  } catch (e: any) {
    throw new Error(`خطا در تولید محتوا: ${e.message}`);
  }

  // Strip code fences if present
  articleContent = articleContent.replace(/^```(?:markdown)?\s*/i, "").replace(/\s*```\s*$/i, "");

  // === Post-processing: clean "h1/h2/h3/H1/H2/H3" literal text from headings ===
  // The AI sometimes literally writes "### h3 سوال" or "### H3: سوال" instead of "### سوال".
  // این regex تمام موارد را تمیز می‌کند.
  const beforeClean = articleContent;
  articleContent = articleContent.replace(
    /^(#{1,6})\s*[hH][1-6][:：\-\s]+/gm,
    "$1 "
  );
  if (articleContent !== beforeClean) {
    log(ctx, "info", `🧹 پاک‌سازی h1/h2/h3 literal از heading‌ها انجام شد.`);
  }

  // === Post-processing: fix broken internal link patterns ===
  // AI گاهی از فرمت اشتباه /article/slug یا /article// یا /blog استفاده می‌کند.
  // این Step همه موارد را به فرمت صحیح تبدیل می‌کند.
  const beforeLinkFix = articleContent;
  // 1) /article// (double slash) → / (e.g. /article//?tool=tdee → /?tool=tdee)
  articleContent = articleContent.replace(/\/article\/\//g, "/");
  // 2) Markdown links ](/article/slug) → ](/?article=slug)
  articleContent = articleContent.replace(/\]\(\/article\/([^)]+)\)/g, (match, rest: string) => {
    if (rest.includes("?")) {
      const [slug, query] = rest.split("?");
      return `](/?article=${slug}&${query})`;
    }
    return `](/?article=${rest})`;
  });
  // 3) ](/blog) → ](/?screen=articles)
  articleContent = articleContent.replace(/\]\(\/blog\)/g, "](/?screen=articles)");
  // 4) standalone /blog references (not in markdown links)
  articleContent = articleContent.replace(/(^|[\s(])\/blog(?=[\s)]|$)/g, "$1/?screen=articles");
  if (articleContent !== beforeLinkFix) {
    log(ctx, "info", `🔗 اصلاح لینک‌های داخلی شکسته (double-slash, /article/slug, /blog) انجام شد.`);
  }

  // === Post-processing: نرمال‌سازی جای‌نگهدارهای تصویر (inline images) ===
  // مدل گاهی placeholder را با فرمت‌های غیراستاندارد می‌نویسد:
  //   ![alt](image_placeholder_1) / ![alt](IMAGE PLACEHOLDER 1) / IMAGE_PLACEHOLDER_1 (متن خالی بدون markdown)
  // همه را به فرمت استاندارد ![alt](IMAGE_PLACEHOLDER_N) تبدیل می‌کنیم تا تصویر inline هرگز گم نشود.
  {
    const beforePhNorm = articleContent;
    articleContent = articleContent.replace(
      /(!\[([^\]]*)\]\(\s*)?IMAGE[-_ ]?PLACEHOLDER[-_ ]?(\d+)(\s*\))?/gi,
      (_full: string, _prefix: string | undefined, alt: string | undefined, num: string) =>
        `![${alt && alt.trim() ? alt.trim() : `تصویر ${num} — ${plan.keyword}`}](IMAGE_PLACEHOLDER_${num})`
    );
    if (articleContent !== beforePhNorm) {
      log(ctx, "info", `🖼 جای‌نگهدارهای تصویر با فرمت غیراستاندارد به فرمت استاندارد نرمال شدند.`);
    }
  }

  // === Fallback: اگر مدل هیچ جای‌نگهدار تصویری نگذاشته بود، خودمان یکی درج می‌کنیم ===
  // (ریشه باگ «تصاویر inline در مقاله نمی‌آیند»: مدل اغلب placeholder را کلاً حذف می‌کرد)
  if (!/!\[[^\]]*\]\(IMAGE_PLACEHOLDER_\d+\)/.test(articleContent)) {
    articleContent = insertFallbackInlinePlaceholder(articleContent, plan.keyword);
    log(ctx, "info", `🖼 هیچ جای‌نگهدار تصویری در متن نبود — یک placeholder به‌صورت خودکار درج شد.`);
  }

  // === Post-processing safety net: insert a paragraph between consecutive images ===
  // حتی اگر AI دستورالعمل «دو تصویر پشت سر هم نده» را نادیده بگیرد، این Step اطمینان می‌دهد
  // که هیچ دو تصویری بدون متن بینشان در خروجی نهایی نباشد.
  const beforeImgFix = articleContent;
  let iterations = 0;
  while (iterations < 10) {
    const next = articleContent.replace(
      /(!\[[^\]]*\]\([^\)]+\))[\s\n]+(!\[[^\]]*\]\([^\)]+\))/g,
      "$1\n\nبرای درک بهتر، تصویر زیر نکات کلیدی را نشان می‌دهد:\n\n$2"
    );
    if (next === articleContent) break;
    articleContent = next;
    iterations++;
  }
  if (articleContent !== beforeImgFix) {
    log(ctx, "info", `🖼 درج پاراگراف انتقالی بین ${iterations} جفت تصویر متوالی انجام شد.`);
  }

  const wordCount = articleContent.trim().split(/\s+/).length;
  log(ctx, "info", `📄 محتوای مقاله تولید شد (${wordCount} کلمه) — شروع تولید تصاویر`);

  // ─── Generate cover image ───
  // مهم: هر مقاله باید یک تصویر کاور کاملاً منحصر به خود داشته باشد.
  // برای جلوگیری از تولید تصاویر مشابه، یک شناسه یکتا به پرامپت اضافه می‌کنیم.
  // همچنین سبک طبیعی و واقع‌گرایانه برای تمام کاورها یکدست است.
  let coverUrl = "";
  try {
    const uniqueSeed = `${plan.slug}-${Date.now()}`;
    const coverPrompt =
      plan.coverImagePrompt
        ? `${plan.coverImagePrompt}. Unique scene ID: ${uniqueSeed}`
        : `Professional fitness photograph of ${plan.keyword}, natural bright daylight, modern gym environment, realistic colors, athletic person in natural pose, proper form, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, magazine editorial style. Unique scene ID: ${uniqueSeed}`;
    log(ctx, "info", `🖼 تولید تصویر کاور منحصر برای: ${plan.slug}`);
    const coverImg = await generateImage({
      prompt: coverPrompt,
      aspectRatio: "16:9" as AspectRatio,
      timeoutMs: 120000,
    });
    const processed = await processAndSaveArticleImage({
      buffer: coverImg.buffer,
      articleSlug: plan.slug,
      descriptiveName: plan.keyword.replace(/\s+/g, "-").slice(0, 40),
    });
    coverUrl = processed.cover.url;
    log(
      ctx,
      "success",
      `✅ تصویر کاور تولید و بهینه شد: ${coverUrl} (${Math.round(processed.cover.bytes / 1024)}KB)`
    );
  } catch (e: any) {
    log(ctx, "warn", `تولید تصویر کاور شکست خورد: ${e.message}`);
  }

  // ─── Generate inline images ───
  // Find IMAGE_PLACEHOLDER_N in content — regex tolerant (حروف کوچک/بزرگ، خط تیره/فاصله)
  // نکته: مرحله نرمال‌سازی بالاتر همه را به فرمت استاندارد برده؛ این regex هم به‌صورت
  // defensive با فرمت‌های متفاوت match می‌شود تا هیچ placeholder ای از دست نرود.
  const placeholderRegex = /!\[([^\]]*)\]\(\s*IMAGE[_ ]?PLACEHOLDER[_ ]?(\d+)\s*\)/gi;
  const placeholders: { alt: string; index: number; fullMatch: string }[] = [];
  let match;
  while ((match = placeholderRegex.exec(articleContent)) !== null) {
    placeholders.push({
      alt: match[1],
      index: parseInt(match[2], 10),
      fullMatch: match[0],
    });
  }

  // Generate inline images — تا ۳ تصویر (هماهنگ با پرامپت: ۱ تا ۲ placeholder الزامی)
  const inlinePrompts = plan.inlineImagePrompts || [];
  const maxInlineImages = 3; // مقالات طولانی به تصاویر بیشتری نیاز دارند
  for (let i = 0; i < Math.min(placeholders.length, maxInlineImages); i++) {
    const ph = placeholders[i];
    const prompt =
      inlinePrompts[i] ||
      `Photorealistic fitness photo showing: ${ph.alt || plan.keyword}, natural bright daylight, gym or athletic setting, realistic human body in natural exercise pose, proper anatomy, correct proportions, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, no backwards phone, magazine editorial style`;
    try {
      log(ctx, "info", `🖼 تولید تصویر داخل متن ${i + 1}/${placeholders.length}...`);
      const img = await generateImage({
        prompt,
        aspectRatio: "16:9" as AspectRatio,
        timeoutMs: 120000,
      });
      const processed = await processAndSaveInlineImage({
        buffer: img.buffer,
        articleSlug: plan.slug,
        descriptiveName: ph.alt.slice(0, 40),
        index: ph.index,
      });
      // Replace placeholder with actual image URL
      articleContent = articleContent.replace(
        ph.fullMatch,
        `![${ph.alt}](${processed.url})`
      );
      log(
        ctx,
        "success",
        `✅ تصویر داخل متن ${i + 1} تولید و جایگزین شد: ${processed.url}`
      );
    } catch (e: any) {
      log(ctx, "warn", `تولید تصویر داخل متن ${i + 1} شکست خورد: ${e.message}`);
      // Remove the placeholder on failure
      articleContent = articleContent.replace(ph.fullMatch, "");
    }
  }

  // Remove any remaining placeholders (فرمت‌های غیراستاندارد هم پاک شوند)
  articleContent = articleContent.replace(
    /!\[[^\]]*\]\(\s*IMAGE[_ ]?PLACEHOLDER[_ ]?\d+\s*\)/gi,
    ""
  );

  // ─── بررسی نهایی: حذف inline تکراری ───
  // اگر چند inline به یک URL اشاره کنند، فقط اولی را نگه می‌داریم.
  // همچنین اگر inline با cover یکی باشد (URL یکسان)، آن inline را حذف می‌کنیم.
  {
    const inlineRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const inlineMatches: { alt: string; url: string; fullMatch: string }[] = [];
    let im;
    while ((im = inlineRegex.exec(articleContent)) !== null) {
      if (im[2].startsWith("http") || im[2].includes("IMAGE_PLACEHOLDER")) continue;
      inlineMatches.push({ alt: im[1], url: im[2], fullMatch: im[0] });
    }

    const seenInlineUrls = new Set<string>();
    let inlineRemovedCount = 0;
    for (const im of inlineMatches) {
      // اگر inline با cover یکی است → حذف
      if (coverUrl && im.url === coverUrl) {
        articleContent = articleContent.replace(im.fullMatch, "");
        inlineRemovedCount++;
        continue;
      }
      // اگر inline قبلاً دیده شده → حذف
      if (seenInlineUrls.has(im.url)) {
        articleContent = articleContent.replace(im.fullMatch, "");
        inlineRemovedCount++;
        continue;
      }
      seenInlineUrls.add(im.url);
    }
    if (inlineRemovedCount > 0) {
      log(ctx, "info", `🧹 ${inlineRemovedCount} inline تکراری حذف شد (URL یکسان با cover یا تکراری).`);
    }
  }

  // ─── Generate SEO fields ───
  const seoSystem = `تو متخصص سئو هستی. فیلدهای سئو برای یک مقاله ورزشی/تغذیه فارسی تولید کن. فقط JSON.
مهم: همه فیلدها باید فارسی و حاوی کلمه کلیدی اصلی یا ثانویه باشند.
seoTitle باید ترغیب‌کننده و قابل کلیک باشد (CTR بالا) و حداکثر ۶۰ کاراکتر باشد.
seoDescription باید در سرچ نتایج گوگل جذاب به‌نظر برسد و حداکثر ۱۶۰ کاراکتر باشد.
metaKeywords باید ۵ تا ۸ کلمه کلیدی مرتبط (با کاما جدا شود) باشد.`;
  const seoUser = `برای مقاله زیر فیلدهای سئو بنویس:
عنوان: ${plan.title}
کلمه کلیدی اصلی: ${plan.keyword}
کلمات کلیدی ثانویه: ${plan.secondaryKeywords.join("، ")}
خلاصه: ${plan.excerpt}

JSON:
{
  "seoTitle": "عنوان سئو حداکثر ۶۰ کاراکتر (شامل کلمه کلیدی)",
  "seoDescription": "توضیحات متا حداکثر ۱۶۰ کاراکتر (شامل کلمه کلیدی، ترغیب‌کننده)",
  "metaKeywords": "کلمه۱, کلمه۲, کلمه۳, کلمه۴, کلمه۵"
}`;

  let seo = { seoTitle: "", seoDescription: "", metaKeywords: "" };
  try {
    const seoContent = await callLlm(seoSystem, seoUser, 500);
    const parsed = extractJson(seoContent);
    if (parsed) seo = { ...seo, ...parsed };
  } catch {
    // keep defaults
  }

  // ─── اعمال محدودیت‌های سخت (hard limits) روی فیلدهای سئو ───
  // حتی اگر LLM مقدار طولانی‌تری برگرداند، آن را کوتاه می‌کنیم تا با
  // بهترین شیوه‌های گوگل هم‌خوانی داشته باشد.
  if (!seo.seoTitle) seo.seoTitle = plan.title;
  seo.seoTitle = seo.seoTitle.slice(0, 60);

  if (!seo.seoDescription) seo.seoDescription = plan.excerpt;
  seo.seoDescription = seo.seoDescription.slice(0, 160);

  if (!seo.metaKeywords) {
    seo.metaKeywords = [plan.keyword, ...plan.secondaryKeywords.slice(0, 4)].join(", ");
  }
  // محدود کردن metaKeywords به ۸ کلمه کلیدی (و حذف موارد خالی/تکراری)
  const kwList = seo.metaKeywords
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  // حذف تکراری‌ها (case-insensitive)
  const seenKw = new Set<string>();
  const dedupKw: string[] = [];
  for (const k of kwList) {
    const lower = k.toLowerCase();
    if (!seenKw.has(lower)) {
      seenKw.add(lower);
      dedupKw.push(k);
    }
  }
  seo.metaKeywords = dedupKw.slice(0, 8).join(", ");

  // ─── Ensure FAQ section exists in content (for FAQPage JSON-LD) ───
  // اگر مقاله FAQ نداشت، یک بخش FAQ با ۳-۴ سؤال متداول اضافه می‌کنیم
  // تا article-page.tsx بتواند FAQPage JSON-LD تولید کند.
  if (!/##\s+سوالات\s+متداول|##\s+پرسش.*متداول|##\s+FAQ/i.test(articleContent)) {
    const faqSection = `

## سوالات متداول

### ${plan.keyword} چیست؟

${plan.keyword} یکی از مفاهیم کلیدی در مسیر تناسب اندام و سلامتی است. در این مقاله به‌طور کامل توضیح دادیم که چرا برای رسیدن به هدف ورزشی شما اهمیت دارد و چطور می‌توانید آن را به‌درستی پیاده کنید.

### چطور می‌توانم ${plan.keyword} را در برنامه تمرینی خود بگنجانم؟

با استفاده از اصولی که در این مقاله توضیح دادیم و با کمک مربی هوشمند فیتاپ، می‌توانید ${plan.keyword} را به‌صورت شخصی‌سازی‌شده در برنامه خود داشته باشید. کافیست برنامه اختصاصی فیتاپ را تهیه کنید.

### آیا ${plan.keyword} برای مبتدی‌ها مناسب است؟

بله — با رعایت نکات ایمنی و شروع تدریجی، ${plan.keyword} برای ورزشکاران مبتدی هم مناسب است. توصیه می‌کنیم قبل از شروع، با مربی هوشمند فیتاپ مشورت کنید تا برنامه‌ای متناسب با سطح شما طراحی شود.
`;
    articleContent = articleContent.trimEnd() + "\n" + faqSection;
    log(ctx, "info", `📋 بخش FAQ به مقاله اضافه شد (برای FAQPage JSON-LD).`);
  }

  // ─── Compute reading time ───
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  // ─── Compute scheduled publish date (space out over weeks per strategy calendar) ───
  // The article is saved as "draft" with a scheduledAt in the future. The
  // /api/cron/publish-scheduled endpoint will flip it to "published" when the
  // scheduledAt arrives. This gives a steady drip of fresh content rather than
  // dumping N articles on the same day.
  const scheduledAt = await computeScheduledAt(plan, strategy, ctx.publishImmediately === true);

  // ─── SEO fields: canonical URL, OG image, robots ───
  // canonical URL: همیشه مطلق (https://...) باشد تا گوگل آن را به‌عنوان canonical
  // صفحه قبول کند. در غیر این صورت، مقاله‌های تولیدشده canonical خالی دارند و
  // article-page.tsx به‌صورت fallback از ?article=slug استفاده می‌کند — اما
  // ذخیره URL مطلق در DB تمرین بهتری است و با مقاله‌های دستی هم‌خوانی دارد.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir").replace(/\/$/, "");

  // ─── یکتاسازی slug قبل از ذخیره (ممیزی 2-c P1) ───
  // ادغام فقط با مقاله‌ی draft هم‌slug (اجرای قبلی نیمه‌کاره). اگر مقاله‌ی PUBLISHED
  // با همین slug وجود دارد (مقاله دستی/قدیمی)، هرگز بازنویسی نمی‌شود — به‌جای آن
  // slug یکتای جدید (-2، -3، …) برای مقاله‌ی جدید ساخته می‌شود تا مقاله‌ی زنده‌ی سایت
  // دست‌نخورده بماند (قبلاً findFirst بدون فیلتر status بود و مقاله‌ی منتشرشده را
  // بی‌صدا draft + زمان‌بندی می‌کرد یعنی حذف از سایت).
  const existingDraft = await db.article.findFirst({
    where: { slug: plan.slug, status: "draft" },
    select: { id: true },
  });
  let finalSlug = plan.slug;
  if (!existingDraft) {
    let taken = await db.article.findFirst({ where: { slug: finalSlug }, select: { id: true } });
    let suffix = 2;
    while (taken) {
      finalSlug = `${plan.slug}-${suffix}`;
      suffix++;
      taken = await db.article.findFirst({ where: { slug: finalSlug }, select: { id: true } });
    }
  }

  const canonicalUrl = `${siteUrl}/?article=${finalSlug}`;
  const ogImage = coverUrl; // OG image همان تصویر کاور است
  const robots = "index,follow";

  // ─── Save article to DB ───
  // اگر زمان‌بندی نشده → مستقیماً منتشر می‌شود، پس publishedAt را روی now تنظیم کن.
  // ⚠️ ادغام با مقاله موجود هم‌slug: اگر اجرای قبلی ایجنت وسط کار شکست خورده باشد،
  // ممکن است مقاله‌ای draft با همین slug از قبل موجود باشد (unique constraint).
  // در این صورت محتوای جدید جایگزین محتوای قدیمی می‌شود (update) نه خطا.
  const articleData = {
    title: plan.title,
    excerpt: plan.excerpt,
    content: articleContent,
    // نرمال‌سازی دسته به فارسی — مقالات جدید سئو همیشه دسته فارسی می‌گیرند
    category: normalizeCategoryToPersian(plan.category),
    tags: [plan.keyword, ...plan.secondaryKeywords].slice(0, 8).join(", "),
    // If a schedule was computed → keep draft + scheduledAt; otherwise publish now.
    status: scheduledAt ? "draft" : "published",
    // در مسیر update هم باید صریحاً null شود (undefined یعنی دست‌ن‌زده — مقدار قدیمی می‌ماند)
    scheduledAt: scheduledAt ?? null,
    // publishedAt فقط برای مقالات منتشرشده set می‌شود (تاریخ انتشار واقعی).
    publishedAt: scheduledAt ? null : new Date(),
    authorId: ctx.adminId,
    coverImage: coverUrl,
    seoTitle: seo.seoTitle,
    seoDescription: seo.seoDescription,
    metaKeywords: seo.metaKeywords,
    ogImage,
    canonicalUrl,
    robots,
    readingMinutes,
  };
  const article = existingDraft
    ? await db.article.update({ where: { id: existingDraft.id }, data: articleData })
    : await db.article.create({ data: { slug: finalSlug, ...articleData } });

  // Update plan as published
  if (plan.id) {
    await db.seoArticlePlan.update({
      where: { id: plan.id },
      data: { status: "published", articleId: article.id },
    });
  }

  if (scheduledAt) {
    log(
      ctx,
      "success",
      `🗓 مقاله زمان‌بندی شد: "${plan.title}" — ${wordCount} کلمه، ${readingMinutes} دقیقه مطالعه، ${coverUrl ? "با تصویر" : "بدون تصویر"} — انتشار: ${scheduledAt.toLocaleDateString("fa-IR")} ساعت ${scheduledAt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`
    );
  } else {
    log(
      ctx,
      "success",
      `✅ مقاله منتشر شد: "${plan.title}" — ${wordCount} کلمه، ${readingMinutes} دقیقه مطالعه، ${coverUrl ? "با تصویر" : "بدون تصویر"}`
    );
  }

  return { articleId: article.id, slug: article.slug, coverUrl, wordCount, scheduledAt };
}

// ─── Main entry point: run the agent ───
export async function runSeoAgent(opts: {
  runId: string;
  adminId: string;
  mode: "full" | "continue" | "strategy_only" | "content_refresh";
  count: number;
  /**
   * If true, generated articles are published immediately instead of being
   * scheduled for future publishing. Defaults to false (schedule articles).
   */
  publishImmediately?: boolean;
}): Promise<RunContext> {
  const ctx: RunContext = {
    runId: opts.runId,
    mode: opts.mode,
    count: opts.count,
    logs: [],
    adminId: opts.adminId,
    startedAt: Date.now(),
    successCount: 0,
    failCount: 0,
    articles: [],
    errors: [],
    publishImmediately: opts.publishImmediately === true,
  };

  const startedRun = await db.seoAgentRun.update({
    where: { id: opts.runId },
    data: {
      status: "running",
      mode: opts.mode,
      requestedCount: opts.count,
      startedAt: new Date(),
    },
  }).catch(() => null);

  try {
    // ─── T4: حالت آپدیت محتواها بر اساس گزارش سرچ کنسول ───
    // مستقل از فلوی تولید مقاله — مقالات منتشرشده را برای رتبه ۱ بازنویسی می‌کند.
    if (opts.mode === "content_refresh") {
      const { runContentRefresh } = await import("@/lib/fitness/content-refresh");
      await runContentRefresh(ctx, opts.count);
      await finishRun(ctx, ctx.failCount > 0 && ctx.successCount === 0 ? "failed" : "completed");
      return ctx;
    }

    // Step 1: Always analyze site first (for accurate internal linking)
    const site = await analyzeSite(ctx);

    // Step 2: Generate/refresh strategy (in full mode) or load existing
    let strategy: SeoStrategyContent;
    if (opts.mode === "full") {
      strategy = await generateStrategy(ctx, site);
    } else {
      const existing = await db.seoStrategy.findFirst({
        where: { isActive: true },
        orderBy: { version: "desc" },
      });
      if (existing) {
        // پارس امن: یک رکورد خراب نباید کل اجرای ایجنت را بکشد —
        // اگر content قابل پارس نبود، استراتژی جدید تولید می‌شود.
        try {
          strategy = JSON.parse(existing.content) as SeoStrategyContent;
        } catch (e) {
          log(ctx, "warn", `⚠️ محتوای استراتژی موجود خراب است (نسخه ${existing.version}) — استراتژی جدید تولید می‌شود: ${e instanceof Error ? e.message : String(e)}`);
          strategy = await generateStrategy(ctx, site);
        }
        log(ctx, "info", `📋 استفاده از استراتژی موجود (نسخه ${existing.version})`);
      } else {
        // No strategy yet — must generate
        log(ctx, "warn", "استراتژی موجود نیست — تولید استراتژی جدید");
        strategy = await generateStrategy(ctx, site);
      }
    }

    if (opts.mode === "strategy_only") {
      log(ctx, "success", "🏁 حالت strategy_only — استراتژی تولید شد، بدون تولید مقاله");
      await finishRun(ctx, "completed");
      return ctx;
    }

    // Step 3: Plan articles (or use existing planned ones)
    let plans: ArticlePlan[] = [];

    // First: use existing planned articles (continue mode)
    const existingPlans = await db.seoArticlePlan.findMany({
      where: { status: "planned" },
      orderBy: { priority: "desc" },
      take: opts.count,
    });

    if (existingPlans.length >= opts.count && opts.mode === "continue") {
      plans = existingPlans.map((p) => ({
        id: p.id,
        keyword: p.keyword,
        title: p.title,
        slug: p.slug,
        category: normalizeCategoryToPersian(p.category),
        excerpt: p.excerpt,
        pillar: p.pillar,
        secondaryKeywords: p.secondaryKeywords.split(", ").filter(Boolean),
        internalLinks: safeParseInternalLinks(p.internalLinks),
        coverImagePrompt: p.coverImagePrompt,
        inlineImagePrompts: (() => {
          try {
            const val = (p as any).inlineImagePrompts;
            if (Array.isArray(val)) return val;
            if (typeof val === "string") return JSON.parse(val || "[]") as string[];
            return [];
          } catch { return []; }
        })(),
      }));
      log(ctx, "info", `📋 استفاده از ${plans.length} مقاله برنامه‌ریزی‌شده موجود در صف`);
    } else {
      // Plan new articles
      const needed = opts.count - existingPlans.length;
      if (needed > 0) {
        log(ctx, "info", `📅 نیاز به ${needed} مقاله جدید — برنامه‌ریزی...`);
        await planArticles(ctx, strategy, site, Math.max(needed, opts.count));
      }
      // Now fetch all planned
      const allPlanned = await db.seoArticlePlan.findMany({
        where: { status: "planned" },
        orderBy: { priority: "desc" },
        take: opts.count,
      });
      plans = allPlanned.map((p) => ({
        id: p.id,
        keyword: p.keyword,
        title: p.title,
        slug: p.slug,
        category: normalizeCategoryToPersian(p.category),
        excerpt: p.excerpt,
        pillar: p.pillar,
        secondaryKeywords: p.secondaryKeywords.split(", ").filter(Boolean),
        internalLinks: safeParseInternalLinks(p.internalLinks),
        coverImagePrompt: p.coverImagePrompt,
        inlineImagePrompts: (() => {
          try {
            const val = (p as any).inlineImagePrompts;
            if (Array.isArray(val)) return val;
            if (typeof val === "string") return JSON.parse(val || "[]") as string[];
            return [];
          } catch { return []; }
        })(),
      }));
    }

    if (plans.length === 0) {
      log(ctx, "warn", "هیچ مقاله‌ای برای تولید یافت نشد");
      await finishRun(ctx, "completed");
      return ctx;
    }

    log(ctx, "info", `🚀 شروع تولید ${plans.length} مقاله`);

    // Step 4: Generate each article (sequentially to avoid rate limits)
    // Re-analyze site before each article to ensure accurate internal linking (new articles get added)
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      log(ctx, "info", `━━━ مقاله ${i + 1}/${plans.length} ━━━`);
      try {
        // Refresh site analysis (so newly-published articles can be linked)
        const freshSite = i === 0 ? site : await analyzeSite(ctx);
        const result = await generateArticle(ctx, plan, freshSite, strategy);
        ctx.articles.push({
          id: result.articleId,
          title: plan.title,
          // slug نهایی ممکن است با پسوند یکتا (-2/…) از plan.slug متفاوت باشد
          slug: result.slug || plan.slug,
          keyword: plan.keyword,
          coverImage: result.coverUrl ? "✓" : "✗",
          words: result.wordCount,
          scheduledAt: result.scheduledAt ? result.scheduledAt.toISOString() : null,
        });
        ctx.successCount++;
      } catch (e: any) {
        log(ctx, "error", `مقاله "${plan.title}" شکست خورد: ${e.message}`);
        ctx.errors.push(`${plan.title}: ${e.message}`);
        ctx.failCount++;
        if (plan.id) {
          await db.seoArticlePlan.update({
            where: { id: plan.id },
            data: { status: "failed", errorMessage: e.message.slice(0, 500) },
          }).catch(() => null);
        }
      }
      // Persist progress to DB after each article
      await persistRunProgress(ctx);
    }

    log(
      ctx,
      "success",
      `🏁 پایان اجرا — ${ctx.successCount} موفق، ${ctx.failCount} ناموفق`
    );

    await finishRun(ctx, ctx.failCount === 0 ? "completed" : "partial");
    return ctx;
  } catch (e: any) {
    log(ctx, "error", `خطای بحرانی در اجرای ایجنت: ${e.message}`);
    ctx.errors.push(`CRITICAL: ${e.message}`);
    await finishRun(ctx, "failed");
    return ctx;
  }
}

async function persistRunProgress(ctx: RunContext) {
  await db.seoAgentRun
    .update({
      where: { id: ctx.runId },
      data: {
        successCount: ctx.successCount,
        failCount: ctx.failCount,
        logs: JSON.stringify(ctx.logs.slice(-100)), // keep last 100 logs
        results: JSON.stringify({
          articles: ctx.articles,
          errors: ctx.errors,
        }),
      },
    })
    .catch(() => null);
}

async function finishRun(ctx: RunContext, status: string) {
  const durationMs = Date.now() - ctx.startedAt;
  await db.seoAgentRun
    .update({
      where: { id: ctx.runId },
      data: {
        status,
        successCount: ctx.successCount,
        failCount: ctx.failCount,
        logs: JSON.stringify(ctx.logs),
        results: JSON.stringify({
          articles: ctx.articles,
          errors: ctx.errors,
        }),
        durationMs,
        finishedAt: new Date(),
      },
    })
    .catch(() => null);
  // Update strategy lastRunAt
  await db.seoStrategy
    .updateMany({
      where: { isActive: true },
      data: { lastRunAt: new Date() },
    })
    .catch(() => null);
}

// ─── Background runner (in-memory) ───
// Track running status globally so we don't start concurrent runs
declare global {
  var __seoAgentRunning: boolean | undefined;
  var __seoAgentRunId: string | undefined;
}

export function isAgentRunning(): boolean {
  return !!globalThis.__seoAgentRunning;
}

export function getCurrentRunId(): string | undefined {
  return globalThis.__seoAgentRunId;
}

export async function startBackgroundRun(opts: {
  adminId: string;
  mode: "full" | "continue" | "strategy_only" | "content_refresh";
  count: number;
  publishImmediately?: boolean;
}): Promise<{ runId: string; alreadyRunning: boolean }> {
  if (isAgentRunning()) {
    return { runId: getCurrentRunId() || "", alreadyRunning: true };
  }
  // Create run record
  const run = await db.seoAgentRun.create({
    data: {
      mode: opts.mode,
      requestedCount: opts.count,
      status: "running",
      startedAt: new Date(),
    },
  });
  globalThis.__seoAgentRunning = true;
  globalThis.__seoAgentRunId = run.id;

  // Fire and forget — run in background
  runSeoAgent({
    runId: run.id,
    adminId: opts.adminId,
    mode: opts.mode,
    count: opts.count,
    publishImmediately: opts.publishImmediately,
  })
    .catch((e) => {
      console.error("[SEO-AGENT] background run crashed:", e);
    })
    .finally(() => {
      globalThis.__seoAgentRunning = false;
      globalThis.__seoAgentRunId = undefined;
    });

  return { runId: run.id, alreadyRunning: false };
}
