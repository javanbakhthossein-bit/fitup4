/**
 * ─────────────────────────────────────────────────────────────────────────────
 * سرویس خودترمیم رسانه مقالات (Article Media Self-Heal)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * مشکل:
 *   مقالاتی که در دیتابیس‌های مختلف وجود دارند ممکن است:
 *    ۱. کاور نداشته باشند (coverImage خالی) یا به فایلی اشاره کنند که روی
 *       سرور موجود نیست.
 *    ۲. در متنشان ![alt](url) داشته باشند که فایلش روی سرور نیست (تصویر
 *       نمایش داده نمی‌شود) یا هنوز IMAGE_PLACEHOLDER_N باشد.
 *    ۳. اصلاً هیچ تصویر inline نداشته باشند.
 *
 * راه‌حل:
 *   این سرویس به‌صورت خودکار (هنگام boot سرور + به‌صورت throttled هنگام
 *   بازدید از لیست مقالات) همه مقالات را اسکن می‌کند و مشکلات را ترمیم می‌کند:
 *    - کاور/inline خراب → اول دنبال فایل موجود مشابه در همان پوشه می‌گردد
 *      (مصرف صفر API)؛ اگر نبود با AvalAI تولید می‌کند و رفرنس را آپدیت می‌کند.
 *    - مقاله بدون inline → یک تصویر مرتبط تولید و بعد از اولین تیتر درج می‌کند.
 *    - alt text خالی → alt فارسی حاوی کلمه کلیدی.
 *
 *   همه‌چیز idempotent است: بعد از ترمیم، اسکن بعدی چیزی برای کار پیدا نمی‌کند.
 *
 * خاموش‌کردن (اختیاری — مثلاً برای محیط dev):
 *   - فایل `.selfheal-off` در ریشه پروژه، یا
 *   - متغیر محیطی DISABLE_ARTICLE_MEDIA_SELFHEAL=1
 *
 * توجه: این سرویس «فقط» فیلدهای تصویر (coverImage/ogImage/content) را در
 * دیتابیس پر می‌کند — هیچ داده دیگری را دست نمی‌زند و اسکیما تغییر نمی‌کند.
 */
import { db } from "@/lib/db";
import { generateImage, type AspectRatio } from "./avalai-image";
import {
  processAndSaveArticleImage,
  processAndSaveInlineImage,
  addFitUpWatermark,
  hasFitUpWatermark,
  MEDIA_CACHE_ROOT,
} from "./image-processing";
import { UPLOADS_ROOT } from "./uploads-config";
import { readdir, stat, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const LOG_PREFIX = "[media-selfheal]";
const MIN_BG_SCAN_INTERVAL_MS = 30 * 60 * 1000; // حداقل ۳۰ دقیقه بین اسکن‌های پس‌زمینه
const BG_CONTINUE_DELAY_MS = 90 * 1000; // ادامه pass بعدی اگر budget تمام شد
const DELAY_BETWEEN_GENERATIONS_MS = 1500; // جلوگیری از rate-limit

/** حالت درون‌حافظه‌ای سرویس */
let bgRunning = false;
let lastBgScanAt = 0;
let lastReport: HealReport | null = null;
let bgContinueTimer: NodeJS.Timeout | null = null;

// ─────────────────────────────── انواع ───────────────────────────────

export interface BrokenInline {
  /** alt text فعلی (ممکن است خالی باشد) */
  alt: string;
  /** URL فعلی (ممکن است IMAGE_PLACEHOLDER یا مسیر مفقود باشد) */
  url: string;
  /** کل markdown ![alt](url) */
  fullMatch: string;
  /** نوع مشکل */
  kind: "missing-file" | "placeholder" | "invalid";
  /** شماره تصویر (برای نام‌گذاری فایل جدید) */
  index: number;
}

export interface MediaIssue {
  id: string;
  slug: string;
  title: string;
  status: string;
  /** کاور خالی است یا فایلش موجود نیست */
  coverMissing: boolean;
  coverUrl: string;
  brokenInlines: BrokenInline[];
  /** مقاله هیچ تصویر inline ندارد */
  noInlines: boolean;
  /** تعداد alt text های خالی */
  emptyAlts: number;
}

export interface ScanStats {
  totalArticles: number;
  articlesWithIssues: number;
  coversMissing: number;
  brokenInlineRefs: number;
  articlesWithoutInlines: number;
  emptyAltTexts: number;
}

export interface HealReport {
  scanned: number;
  articlesWithIssues: number;
  /** کاورهایی که با فایل موجودِ همان پوشه ترمیم شدند (بدون API) */
  coversRewritten: number;
  /** کاورهایی که با AI تولید شدند */
  coversGenerated: number;
  /** فایل‌هایی که از کش آینه‌ای (.cache) بازگردانده شدند — بدون API */
  restoredFromCache: number;
  /** inline هایی که با فایل موجود ترمیم شدند (بدون API) */
  inlinesRewritten: number;
  /** inline هایی که با AI تولید شدند */
  inlinesGenerated: number;
  /** تصویر inline جدید برای مقالاتی که هیچ نداشتند */
  inlinesAdded: number;
  altFixed: number;
  /** budget تولید تمام شد و هنوز مشکل مانده */
  capped: boolean;
  /** تعداد مسائل باقی‌مانده بعد از این pass */
  remainingIssues: number;
  skippedNoApiKey: boolean;
  errors: string[];
  durationMs: number;
}

// ─────────────────────────── ابزارهای کمکی ───────────────────────────

function log(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

/** آیا سرویس خاموش شده؟ */
export function isSelfHealDisabled(): boolean {
  if (process.env.DISABLE_ARTICLE_MEDIA_SELFHEAL === "1") return true;
  try {
    return existsSync(path.join(process.cwd(), ".selfheal-off"));
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

/** URL لوکال (/uploads/...) → مسیر مطلق فایل */
function localUrlToPath(url: string): string {
  return path.join(UPLOADS_ROOT, url.replace(/^\/uploads\//, ""));
}

/**
 * بازیابی رایگان فایل از کش آینه‌ای (uploads/.cache/...).
 * اگر فایل اصلی حذف شده باشد (مثلاً توسط فرآیند دیپلوی) ولی نسخه
 * پشتیبان در کش موجود باشد → کپی برمی‌گرداند و true می‌دهد — بدون صرف API.
 */
async function restoreFromCache(url: string): Promise<boolean> {
  try {
    if (!url.startsWith("/uploads/")) return false;
    const rel = url.replace(/^\/uploads\//, "");
    // مسیرهای کش را هم مختصات ذخیره‌سازی — مسیرهای dot رد شوند
    if (rel.split("/").some((p) => p.startsWith("."))) return false;
    const cachePath = path.join(MEDIA_CACHE_ROOT, rel);
    if (!existsSync(cachePath)) return false;
    const target = path.join(UPLOADS_ROOT, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(cachePath, target);
    return true;
  } catch {
    return false;
  }
}

/** استخراج شماره تصویر از URL یا placeholder */
function extractImageIndex(url: string): number {
  const m = url.match(/(\d+)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

/**
 * پیدا کردن فایل کاور موجود در پوشه مقاله (هر الگوی *-cover-*.webp).
 * اگر DB به نام قدیمی اشاره کند ولی فایل با نام جدید موجود باشد،
 * بدون تولید مجدد، رفرنس اصلاح می‌شود — مصرف API صفر.
 */
async function findExistingCoverInFolder(slug: string): Promise<string | null> {
  try {
    const folder = path.join(UPLOADS_ROOT, "articles", slug);
    const files = await readdir(folder);
    const cover = files.find(
      (f) => /-cover-\d+x\d+\.webp$/i.test(f)
    );
    return cover ? `/uploads/articles/${slug}/${cover}` : null;
  } catch {
    return null;
  }
}

/**
 * پیدا کردن فایل inline موجود در پوشه مقاله با شماره N.
 * الگوی inline: slug-...-N-WxH.webp (بدون cover/thumb/full).
 */
async function findExistingInlineInFolder(
  slug: string,
  index: number
): Promise<string | null> {
  try {
    const folder = path.join(UPLOADS_ROOT, "articles", slug);
    const files = await readdir(folder);
    const candidates = files.filter((f) => {
      const lower = f.toLowerCase();
      if (!lower.endsWith(".webp")) return false;
      if (lower.includes("-cover-") || lower.includes("-thumb-") || lower.includes("-full-")) {
        return false;
      }
      const m = lower.match(/-(\d+)-\d+x\d+\.webp$/);
      return m && parseInt(m[1], 10) === index;
    });
    if (candidates.length === 0) return null;
    candidates.sort();
    return `/uploads/articles/${slug}/${candidates[0]}`;
  } catch {
    return null;
  }
}

/** alt text فارسی توصیفی حاوی کلمه کلیدی */
function buildAltText(keyword: string, articleTitle: string, index: number): string {
  const templates = [
    `تصویر ${keyword} — ${articleTitle.slice(0, 40)}`,
    `${keyword} در عمل — تصویر آموزشی شماره ${index}`,
    `نمونه تصویری ${keyword} برای راهنمای جامع`,
    `${articleTitle.slice(0, 30)} — ${keyword} (تصویر ${index})`,
  ];
  return templates[index % templates.length];
}

const COVER_PROMPT_TEMPLATE = (keyword: string) =>
  `Professional fitness photograph of ${keyword}, natural bright daylight, modern gym environment, realistic colors, athletic person in natural pose, proper form, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, magazine editorial style`;

const INLINE_PROMPT_TEMPLATE = (subject: string) =>
  `Photorealistic fitness photo showing: ${subject}, natural bright daylight, gym or athletic setting, realistic human body in natural exercise pose, proper anatomy, correct proportions, photorealistic, high quality, sharp focus, no text, no watermark, no weird anatomy, no extra limbs, no distorted faces, magazine editorial style`;

/**
 * درج markdown تصویر بعد از اولین تیتر (H1/H2) مقاله.
 * اگر تیتری نبود، بعد از اولین پاراگراف.
 */
function insertInlineAfterFirstHeading(content: string, inlineMarkdown: string): string {
  const lines = content.split("\n");
  let insertPos = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s+\S/.test(lines[i])) {
      insertPos = i + 1;
      // بعد از پاراگراف اولِ آن بخش (تا خط خالی بعدی)
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (lines[j].trim() === "") {
          insertPos = j + 1;
          break;
        }
      }
      break;
    }
  }
  // اگر هیچ تیتری نبود، بعد از اولین پاراگراف غیرخالی
  if (insertPos === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== "") {
        // تا پایان پاراگراف
        let j = i;
        while (j < lines.length && lines[j].trim() !== "") j++;
        insertPos = j;
        break;
      }
    }
  }
  lines.splice(insertPos, 0, inlineMarkdown);
  return lines.join("\n");
}

// ───────────────────────────── اسکن ─────────────────────────────

/**
 * اسکن همه مقالات و پیدا کردن مسائل رسانه‌ای.
 * سریع است (فقط چک وجود فایل) و هیچ API ای صدا نمی‌زند.
 */
export async function scanArticleMediaIssues(): Promise<{
  issues: MediaIssue[];
  stats: ScanStats;
}> {
  const articles = await db.article.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      coverImage: true,
      content: true,
      status: true,
      tags: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const issues: MediaIssue[] = [];
  const stats: ScanStats = {
    totalArticles: articles.length,
    articlesWithIssues: 0,
    coversMissing: 0,
    brokenInlineRefs: 0,
    articlesWithoutInlines: 0,
    emptyAltTexts: 0,
  };

  for (const article of articles) {
    const issue: MediaIssue = {
      id: article.id,
      slug: article.slug,
      title: article.title,
      status: article.status,
      coverMissing: false,
      coverUrl: article.coverImage || "",
      brokenInlines: [],
      noInlines: false,
      emptyAlts: 0,
    };

    // ── کاور ──
    const cover = (article.coverImage || "").trim();
    if (!cover) {
      issue.coverMissing = true;
    } else if (cover.startsWith("/uploads/")) {
      if (!(await fileExists(localUrlToPath(cover)))) {
        issue.coverMissing = true;
      }
    }
    // کاور http(s) خارجی سالم فرض می‌شود

    // ── inline ها ──
    const content = article.content || "";
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let m: RegExpExecArray | null;
    let inlineCount = 0;
    let idx = 0;
    while ((m = imgRegex.exec(content)) !== null) {
      inlineCount++;
      const alt = m[1] || "";
      const url = (m[2] || "").trim();
      if (!alt.trim()) issue.emptyAlts++;

      // فقط رفرنس‌های داخلی و placeholder ها مسئولیت ما هستند
      if (/^IMAGE_PLACEHOLDER_\d+$/i.test(url)) {
        issue.brokenInlines.push({
          alt,
          url,
          fullMatch: m[0],
          kind: "placeholder",
          index: extractImageIndex(url),
        });
      } else if (!url.startsWith("/") && !url.startsWith("http")) {
        // URL نامعتبر (مثلاً خالی یا نسبتی خراب)
        issue.brokenInlines.push({
          alt,
          url,
          fullMatch: m[0],
          kind: "invalid",
          index: ++idx,
        });
      } else if (url.startsWith("/uploads/")) {
        if (!(await fileExists(localUrlToPath(url)))) {
          issue.brokenInlines.push({
            alt,
            url,
            fullMatch: m[0],
            kind: "missing-file",
            index: extractImageIndex(url),
          });
        }
      }
    }

    if (inlineCount === 0 && (article.content || "").trim().length > 200) {
      issue.noInlines = true;
    }

    if (
      issue.coverMissing ||
      issue.brokenInlines.length > 0 ||
      issue.noInlines ||
      issue.emptyAlts > 0
    ) {
      issues.push(issue);
      stats.articlesWithIssues++;
      if (issue.coverMissing) stats.coversMissing++;
      stats.brokenInlineRefs += issue.brokenInlines.length;
      if (issue.noInlines) stats.articlesWithoutInlines++;
      stats.emptyAltTexts += issue.emptyAlts;
    }
  }

  return { issues, stats };
}

// ───────────────────────────── ترمیم ─────────────────────────────

export interface HealOptions {
  /** فقط این slug ها ترمیم شوند */
  slugs?: string[];
  /** تولید کاور حتی اگر موجود باشد (برای rebuild دستی) */
  force?: boolean;
  /** برای مقالات بدون inline، تصویر جدید اضافه شود؟ (پیش‌فرض true) */
  addMissingInlines?: boolean;
  /** سقف تولید تصویر با AI در این pass (پیش‌فرض ۳۰) */
  maxGenerations?: number;
  /** alt text های خالی اصلاح شوند؟ (پیش‌فرض true — رایگان است) */
  fixAlts?: boolean;
}

/**
 * ترمیم مسائل رسانه‌ای مقالات.
 *
 * ترتیب اولویت:
 *   ۱. کاورهای مفقود (پر بازدیدترین چیز)
 *   ۲. inline های خراب (فایل مفقود / placeholder / نامعتبر)
 *   ۳. مقالات بدون inline (یک تصویر اضافه می‌شود)
 *   ۴. alt text های خالی (رایگان)
 *
 * برای هر مورد، اول دنبال فایل موجود مشابه در همان پوشه می‌گردیم (بدون API)؛
 * اگر نبود با AvalAI تولید می‌کنیم — تا سقف maxGenerations.
 */
export async function healArticleMedia(options: HealOptions = {}): Promise<HealReport> {
  const {
    slugs,
    force = false,
    addMissingInlines = true,
    maxGenerations = 30,
    fixAlts = true,
  } = options;

  const startedAt = Date.now();
  const report: HealReport = {
    scanned: 0,
    articlesWithIssues: 0,
    coversRewritten: 0,
    coversGenerated: 0,
    restoredFromCache: 0,
    inlinesRewritten: 0,
    inlinesGenerated: 0,
    inlinesAdded: 0,
    altFixed: 0,
    capped: false,
    remainingIssues: 0,
    skippedNoApiKey: false,
    errors: [],
    durationMs: 0,
  };

  let budget = maxGenerations;
  const hasApiKey = Boolean(process.env.AVALAI_IMAGE_API_KEY);
  if (!hasApiKey) {
    report.skippedNoApiKey = true;
    log("⚠ AVALAI_IMAGE_API_KEY تنظیم نیست — فقط ترمیم‌های بدون API انجام می‌شود");
  }

  let { issues, stats } = await scanArticleMediaIssues();
  report.scanned = stats.totalArticles;
  report.articlesWithIssues = stats.articlesWithIssues;

  // فیلتر بر اساس slug (برای ترمیم تکی)
  if (slugs && slugs.length > 0) {
    issues = issues.filter((i) => slugs.includes(i.slug));
  }

  log(
    `اسکن: ${stats.totalArticles} مقاله — ${stats.articlesWithIssues} مشکل‌دار ` +
      `(کاور: ${stats.coversMissing}، inline خراب: ${stats.brokenInlineRefs}، بدون inline: ${stats.articlesWithoutInlines})`
  );

  for (const issue of issues) {
    try {
      await healSingleArticle(issue, {
        force,
        addMissingInlines,
        fixAlts,
        hasApiKey,
        budgetRef: { get: () => budget, dec: () => budget-- },
        report,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errors.push(`${issue.slug}: ${msg}`);
      log(`❌ خطا در ترمیم ${issue.slug}: ${msg}`);
    }
    // اگر budget تمام شد و API هم لازم است، بقیه را به pass بعدی واگذار کن
    if (budget <= 0 && hasApiKey) {
      report.capped = true;
      break;
    }
  }

  // شمارش مسائل باقی‌مانده (برای تصمیم ادامه)
  const after = await scanArticleMediaIssues();
  report.remainingIssues = after.stats.articlesWithIssues;
  report.durationMs = Date.now() - startedAt;

  lastReport = report;
  log(
    `پایان pass: کاور(${report.coversGenerated} تولید / ${report.coversRewritten} اصلاح)، ` +
      `inline(${report.inlinesGenerated} تولید / ${report.inlinesRewritten} اصلاح / ${report.inlinesAdded} جدید)، ` +
      `alt ${report.altFixed} — باقی‌مانده: ${report.remainingIssues}` +
      (report.capped ? " (budget تمام شد — ادامه بعدی)" : "")
  );

  return report;
}

/** ترمیم یک مقاله — به‌روزرسانی DB فقط اگر تغییری بوده باشد */
async function healSingleArticle(
  issue: MediaIssue,
  ctx: {
    force: boolean;
    addMissingInlines: boolean;
    fixAlts: boolean;
    hasApiKey: boolean;
    budgetRef: { get: () => number; dec: () => void };
    report: HealReport;
  }
): Promise<void> {
  const { report } = ctx;
  const article = await db.article.findUnique({
    where: { id: issue.id },
    select: {
      id: true,
      slug: true,
      title: true,
      tags: true,
      coverImage: true,
      ogImage: true,
      content: true,
    },
  });
  if (!article) return;

  // پرامپت‌ها از SeoArticlePlan (اگر موجود)
  const seoPlan = await db.seoArticlePlan.findFirst({
    where: { articleId: article.id },
    select: { keyword: true, coverImagePrompt: true, inlineImagePrompts: true },
  });
  let inlinePrompts: string[] = [];
  try {
    const raw = (seoPlan as unknown as { inlineImagePrompts?: unknown })?.inlineImagePrompts;
    if (Array.isArray(raw)) inlinePrompts = raw as string[];
    else if (typeof raw === "string") inlinePrompts = JSON.parse(raw || "[]");
  } catch {
    inlinePrompts = [];
  }

  const keyword =
    seoPlan?.keyword || article.tags?.split(",")[0]?.trim() || article.title;

  const updateData: {
    coverImage?: string;
    ogImage?: string;
    content?: string;
  } = {};
  let content = article.content || "";

  // ─── ۱. کاور ───
  const coverMissing = issue.coverMissing || ctx.force;
  if (coverMissing) {
    let healed = false;

    // ۱-الف) بازیابی رایگان از کش آینه‌ای (بدون API) — فایل دقیقاً همان نام
    if (!ctx.force && issue.coverUrl.startsWith("/uploads/")) {
      if (await restoreFromCache(issue.coverUrl)) {
        report.restoredFromCache++;
        healed = true;
        log(`📦 کاور ${article.slug} از کش بازگردانده شد: ${issue.coverUrl}`);
      }
    }

    // ۱-ب) فایل موجود در همان پوشه؟ (بدون API)
    if (!healed && !ctx.force) {
      const existing = await findExistingCoverInFolder(article.slug);
      if (existing && existing !== article.coverImage) {
        updateData.coverImage = existing;
        updateData.ogImage = existing;
        report.coversRewritten++;
        healed = true;
        log(`↻ کاور ${article.slug} با فایل موجود اصلاح شد: ${existing}`);
      }
    }

    // ۱-ج) تولید با AI
    if (!healed && ctx.hasApiKey && ctx.budgetRef.get() > 0) {
      try {
        ctx.budgetRef.dec();
        const img = await generateImage({
          prompt: seoPlan?.coverImagePrompt || COVER_PROMPT_TEMPLATE(keyword),
          aspectRatio: "16:9" as AspectRatio,
          timeoutMs: 120000,
        });
        const processed = await processAndSaveArticleImage({
          buffer: img.buffer,
          articleSlug: article.slug,
          descriptiveName: keyword.replace(/\s+/g, "-").slice(0, 40),
        });
        updateData.coverImage = processed.cover.url;
        updateData.ogImage = processed.cover.url;
        report.coversGenerated++;
        log(`🖼 کاور ${article.slug} تولید شد: ${processed.cover.url}`);
        await sleep(DELAY_BETWEEN_GENERATIONS_MS);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        report.errors.push(`${article.slug} cover: ${msg}`);
        log(`❌ تولید کاور ${article.slug} ناموفق: ${msg}`);
      }
    }
  }

  // ─── ۲. inline های خراب ───
  for (const inline of issue.brokenInlines) {
    // alt خالی؟ (در همان جایگزینی اصلاح می‌شود)
    const newAlt =
      inline.alt.trim() || buildAltText(keyword, article.title, inline.index);

    // ۲-الف) بازیابی رایگان از کش آینه‌ای (بدون API) — فایل دقیقاً همان نام
    if (inline.kind === "missing-file" && (await restoreFromCache(inline.url))) {
      report.restoredFromCache++;
      // فایل برگشت — اگر alt خالی بود همین‌جا اصلاح شود
      if (newAlt !== inline.alt) {
        const replacement = `![${newAlt}](${inline.url})`;
        content = content.split(inline.fullMatch).join(replacement);
        report.altFixed++;
      }
      log(`📦 inline ${article.slug} #${inline.index} از کش بازگردانده شد`);
      continue;
    }

    // ۲-ب) فایل موجود با همان شماره؟ (بدون API)
    if (inline.kind === "missing-file") {
      const existing = await findExistingInlineInFolder(article.slug, inline.index);
      if (existing && existing !== inline.url) {
        const replacement = `![${newAlt}](${existing})`;
        content = content.split(inline.fullMatch).join(replacement);
        report.inlinesRewritten++;
        if (newAlt !== inline.alt) report.altFixed++;
        log(`↻ inline ${article.slug} #${inline.index} با فایل موجود اصلاح شد`);
        continue;
      }
    }

    // ۲-ب) تولید با AI
    if (ctx.hasApiKey && ctx.budgetRef.get() > 0) {
      try {
        ctx.budgetRef.dec();
        const promptIdx = Math.min(inline.index - 1, Math.max(0, inlinePrompts.length - 1));
        const prompt =
          inlinePrompts[promptIdx] ||
          INLINE_PROMPT_TEMPLATE(newAlt || keyword);
        const img = await generateImage({
          prompt,
          aspectRatio: "16:9" as AspectRatio,
          timeoutMs: 120000,
        });
        const processed = await processAndSaveInlineImage({
          buffer: img.buffer,
          articleSlug: article.slug,
          descriptiveName: (newAlt || keyword).replace(/\s+/g, "-").slice(0, 40),
          index: inline.index,
        });
        const replacement = `![${newAlt}](${processed.url})`;
        content = content.split(inline.fullMatch).join(replacement);
        report.inlinesGenerated++;
        if (newAlt !== inline.alt) report.altFixed++;
        log(`🖼 inline ${article.slug} #${inline.index} تولید شد: ${processed.url}`);
        await sleep(DELAY_BETWEEN_GENERATIONS_MS);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        report.errors.push(`${article.slug} inline#${inline.index}: ${msg}`);
        log(`❌ تولید inline ${article.slug} #${inline.index} ناموفق: ${msg}`);
      }
    }
    // اگر نه فایل داشتیم نه budget — رفرنس دست‌نخورده می‌ماند (pass بعدی)
  }

  // ─── ۳. مقاله بدون inline → یک تصویر اضافه ───
  if (
    issue.noInlines &&
    ctx.addMissingInlines &&
    ctx.hasApiKey &&
    ctx.budgetRef.get() > 0
  ) {
    try {
      ctx.budgetRef.dec();
      const prompt = inlinePrompts[0] || INLINE_PROMPT_TEMPLATE(keyword);
      const img = await generateImage({
        prompt,
        aspectRatio: "16:9" as AspectRatio,
        timeoutMs: 120000,
      });
      const processed = await processAndSaveInlineImage({
        buffer: img.buffer,
        articleSlug: article.slug,
        descriptiveName: keyword.replace(/\s+/g, "-").slice(0, 40),
        index: 1,
      });
      const alt = buildAltText(keyword, article.title, 1);
      const markdown = `\n\n![${alt}](${processed.url})\n\n`;
      content = insertInlineAfterFirstHeading(content, markdown);
      report.inlinesAdded++;
      log(`➕ inline جدید برای ${article.slug}: ${processed.url}`);
      await sleep(DELAY_BETWEEN_GENERATIONS_MS);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errors.push(`${article.slug} add-inline: ${msg}`);
      log(`❌ افزودن inline به ${article.slug} ناموفق: ${msg}`);
    }
  }

  // ─── ۴. alt text های خالی (رایگان — بدون API) ───
  if (ctx.fixAlts) {
    let altIdx = 0;
    content = content.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (fullMatch: string, alt: string, url: string) => {
        altIdx++;
        if (alt.trim()) return fullMatch;
        const newAlt = buildAltText(keyword, article.title, altIdx);
        report.altFixed++;
        return `![${newAlt}](${url})`;
      }
    );
  }

  // ─── ذخیره ───
  if (content !== article.content) {
    updateData.content = content;
  }
  if (Object.keys(updateData).length > 0) {
    await db.article.update({
      where: { id: article.id },
      data: updateData,
    });
    log(`✓ ${article.slug} در دیتابیس به‌روزرسانی شد`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ────────────────────── جاروی واترمارک ──────────────────────

const WATERMARK_SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // حداکثر یک sweep در ۶ ساعت
let lastWatermarkSweepAt = 0;

export interface WatermarkSweepResult {
  checked: number;
  watermarked: number;
  /** فایل‌هایی که از قبل واترمارک داشتند */
  alreadyOk: number;
  /** فایل‌های جدیدی که به کش آینه‌ای اضافه شدند */
  cached: number;
  failed: number;
  durationMs: number;
}

/**
 * جاروی واترمارک — همه تصاویر uploads/articles را بررسی می‌کند:
 *   - اگر فایل واترمارک FitUp ندارد → درجا (in-place) واترمارک می‌شود
 *   - اگر نسخه کش آینه‌ای ندارد → کپی به کش (پشتیبان برای حذف‌های ناخواسته)
 *
 * این کار CPU-only است (هیچ API ای صدا زده نمی‌شود) و برای هر فایل فقط
 * یک استخراج ۱۰۰×۱۰۰ پیکسل انجام می‌شود — سبک است.
 *
 * «هیچ مقاله‌ای نباید بدون واترمارک باشد» — به همین دلیل سقف پیش‌فرض بالا
 * است (۲۵۰ فایل) تا یک sweep کامل همه فایل‌ها را پوشش دهد.
 *
 * @param maxFiles سقف فایل در هر اجرا (پیش‌فرض ۲۵۰) — باقی در sweep بعدی
 */
export async function sweepWatermarks(maxFiles = 250): Promise<WatermarkSweepResult> {
  const startedAt = Date.now();
  const result: WatermarkSweepResult = {
    checked: 0,
    watermarked: 0,
    alreadyOk: 0,
    cached: 0,
    failed: 0,
    durationMs: 0,
  };

  const articlesDir = path.join(UPLOADS_ROOT, "articles");
  let slugs: string[];
  try {
    slugs = (await readdir(articlesDir)).filter(
      (s) => !s.startsWith(".")
    );
  } catch {
    result.durationMs = Date.now() - startedAt;
    return result;
  }

  for (const slug of slugs) {
    if (result.checked >= maxFiles) break;
    const dir = path.join(articlesDir, slug);
    let files: string[];
    try {
      files = (await readdir(dir)).filter((f) => /\.webp$/i.test(f));
    } catch {
      continue;
    }
    for (const file of files) {
      if (result.checked >= maxFiles) break;
      const absPath = path.join(dir, file);
      const rel = `articles/${slug}/${file}`;
      result.checked++;
      try {
        // ─── کش آینه‌ای: اگر نسخه پشتیبان نیست، بساز ───
        const cachePath = path.join(MEDIA_CACHE_ROOT, rel);
        if (!existsSync(cachePath)) {
          try {
            await mkdir(path.dirname(cachePath), { recursive: true });
            await copyFile(absPath, cachePath);
            result.cached++;
          } catch {
            // best-effort
          }
        }

        // ─── واترمارک ───
        if (await hasFitUpWatermark(absPath)) {
          result.alreadyOk++;
        } else {
          const { readFile, writeFile } = await import("fs/promises");
          const buffer = await readFile(absPath);
          const watermarked = await addFitUpWatermark(buffer);
          await writeFile(absPath, watermarked);
          // کش را هم به‌روز کن (نسخه بدون واترمارک را جایگزین نکن — جدیدتر بهتر است)
          try {
            await copyFile(absPath, cachePath);
          } catch {}
          result.watermarked++;
        }
      } catch {
        result.failed++;
      }
    }
  }

  result.durationMs = Date.now() - startedAt;
  if (result.watermarked > 0 || result.cached > 0) {
    log(
      `🪔 جاروی واترمارک: ${result.checked} فایل — ${result.watermarked} واترمارک شد، ${result.cached} به کش اضافه شد`
    );
  }
  return result;
}

/** نسخه throttled برای استفاده داخلی — حداکثر یک بار در ۶ ساعت */
async function sweepWatermarksThrottled(): Promise<void> {
  try {
    const now = Date.now();
    if (now - lastWatermarkSweepAt < WATERMARK_SWEEP_INTERVAL_MS) return;
    lastWatermarkSweepAt = now;
    await sweepWatermarks(250);
  } catch (e) {
    console.error(LOG_PREFIX, "خطای جاروی واترمارک:", e);
  }
}

// ────────────────────── تریگر پس‌زمینه (throttled) ──────────────────────

/**
 * تریگر امن برای صدا زدن از مسیرهای داغ (مثل GET /api/articles):
 *   - اگر سرویس خاموش باشد → هیچ
 *   - اگر pass در حال اجراست → هیچ
 *   - اگر کمتر از ۳۰ دقیقه از اسکن قبلی گذشته → هیچ
 * وگرنه یک heal کامل در پس‌زمینه شروع می‌شود (fire-and-forget).
 */
export function scheduleBackgroundHeal(opts?: { force?: boolean }): void {
  try {
    if (isSelfHealDisabled()) return;
    if (bgRunning) return;
    const now = Date.now();
    if (!opts?.force && now - lastBgScanAt < MIN_BG_SCAN_INTERVAL_MS) return;
    lastBgScanAt = now;
    bgRunning = true;

    log("شروع self-heal پس‌زمینه...");
    void (async () => {
      try {
        const report = await healArticleMedia({ maxGenerations: 30 });
        // اگر budget تمام شد و هنوز مشکل مانده → pass بعدی بعد از تاخیر
        if (
          report.capped &&
          report.remainingIssues > 0 &&
          !report.skippedNoApiKey
        ) {
          log(`${report.remainingIssues} مشکل باقی‌مانده — pass بعدی در ${BG_CONTINUE_DELAY_MS / 1000}s`);
          bgRunning = false;
          if (bgContinueTimer) clearTimeout(bgContinueTimer);
          bgContinueTimer = setTimeout(() => {
            bgContinueTimer = null;
            scheduleBackgroundHeal({ force: true });
          }, BG_CONTINUE_DELAY_MS);
          return;
        }
        if (report.remainingIssues === 0) {
          log("✅ همه مسائل رسانه‌ای مقالات ترمیم شدند");
        }
        // ─── جاروی واترمارک + کش آینه‌ای (throttled — حداکثر یک بار در ۶ ساعت) ───
        // همه تصاویر مقالات به‌تدریج واترمارک FitUp می‌گیرند و در کش آینه‌ای
        // پشتیبان می‌شوند (بازیابی رایگان در صورت حذف ناخواسته توسط دیپلوی).
        await sweepWatermarksThrottled();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(LOG_PREFIX, "خطای pass پس‌زمینه:", msg);
      } finally {
        bgRunning = false;
      }
    })();
  } catch (e: unknown) {
    // هرگز نباید تریگر باعث خطا در مسیر اصلی شود
    console.error(LOG_PREFIX, "خطای scheduleBackgroundHeal:", e);
  }
}

/** وضعیت فعلی سرویس (برای endpoint ادمین) */
export function getSelfHealStatus(): {
  enabled: boolean;
  running: boolean;
  lastBgScanAt: number | null;
  lastReport: HealReport | null;
  uploadsRoot: string;
  mediaCacheRoot: string;
  lastWatermarkSweepAt: number | null;
} {
  return {
    enabled: !isSelfHealDisabled(),
    running: bgRunning,
    lastBgScanAt: lastBgScanAt > 0 ? lastBgScanAt : null,
    lastReport,
    uploadsRoot: UPLOADS_ROOT,
    mediaCacheRoot: MEDIA_CACHE_ROOT,
    lastWatermarkSweepAt: lastWatermarkSweepAt > 0 ? lastWatermarkSweepAt : null,
  };
}
