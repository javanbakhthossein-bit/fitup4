/**
 * Image Processing Utility for SEO-optimized images
 *
 * - Resize to multiple sizes (cover, thumbnail, full)
 * - Convert to WebP (better compression for web)
 * - Save with SEO-friendly filenames (descriptive slug-based names)
 * - Strip metadata for smaller files
 * - Returns URLs relative to /uploads
 *
 * مهم: عکس‌ها در `uploads/articles/` در ریشه پروژه ذخیره می‌شوند (نه در public).
 * این کار از از دست رفتن عکس‌ها در زمان build جلوگیری می‌کند، چون Next.js
 * در زمان `next build` پوشه `public/` را در standalone کپی می‌کند ولی پوشه `uploads/`
 * (در ریشه) کپی نمی‌شود. عکس‌ها از طریق API route `/api/serve-upload/[...path]`
 * سرو می‌شوند و در `next.config.ts` یک rewrite از `/uploads/*` به آن API وجود دارد.
 */
import sharp from "sharp";
import { writeFile, mkdir, copyFile } from "fs/promises";
import path from "path";
import { UPLOADS_ROOT, getArticlesDir } from "./uploads-config";

export { UPLOADS_ROOT, getArticlesDir };

/**
 * کش آینه‌ای امنیتی برای تصاویر مقالات.
 *
 * مشکل: بعضی فرآیندهای دیپلوی (پاک‌سازی .next، git clean، sync پوشه پروژه)
 * فایل‌های تازه‌تولیدشده را حذف می‌کنند — بدون اینکه دیتابیس خبردار شود.
 * نتیجه: عکس‌ها «بعد از چند روز» گم می‌شوند.
 *
 * راه‌حل: هر فایلی که در uploads/articles ذخیره می‌شود یک نسخه
 * پشتیبان هم در uploads/.cache/articles می‌گیرد. سرویس خودترمیم
 * (article-media-selfheal) قبل از تولید مجدد با AI اول کش را چک می‌کند —
 * بازیابی رایگان و آنی بدون صرف بودجه API.
 */
export const MEDIA_CACHE_ROOT = path.join(UPLOADS_ROOT, ".cache");

/**
 * کپی best-effort یک فایل ذخیره‌شده به کش آینه‌ای.
 * هرگز خطا نمی‌دهد — کش فقط یک ابزار بهینه‌سازی است.
 */
async function mirrorToCache(absPath: string, relativeToUploads: string): Promise<void> {
  try {
    const cachePath = path.join(MEDIA_CACHE_ROOT, relativeToUploads);
    await mkdir(path.dirname(cachePath), { recursive: true });
    await copyFile(absPath, cachePath);
  } catch {
    // best-effort — نادیده بگیر
  }
}

export interface ProcessedImageOutput {
  /** relative URL for serving, e.g. /uploads/articles/.../cover-16x9.webp */
  url: string;
  /** absolute filesystem path */
  absPath: string;
  /** width in px */
  width: number;
  /** height in px */
  height: number;
  /** file size in bytes */
  bytes: number;
}

export interface ProcessedImageSet {
  cover: ProcessedImageOutput; // 16:9, 1200x675 — for OG image and hero
  thumbnail: ProcessedImageOutput; // 4:3, 600x450 — for article cards
  full: ProcessedImageOutput; // original aspect, max 1600px — for inline content
}

/**
 * Convert Persian/Arabic digits and chars to ASCII for slug
 */
function slugify(s: string): string {
  return s
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Generate SEO-friendly image filename
 * Format: {descriptive-name}-{width}x{height}.webp
 */
function seoFilename(parts: {
  articleSlug: string;
  descriptiveName: string;
  variant: "cover" | "thumb" | "full";
  width: number;
  height: number;
}): string {
  const base = `${slugify(parts.articleSlug) || "article"}-${slugify(
    parts.descriptiveName
  ) || "image"}-${parts.variant}-${parts.width}x${parts.height}.webp`;
  return base;
}

/**
 * Process a single generated PNG buffer into 3 SEO-optimized WebP variants.
 * Files saved under /public/uploads/articles/{articleSlug}/
 *
 * هر سه نسخه (cover, thumbnail, full) واترمارک FitUp را دریافت می‌کنند —
 * این یک سیاست ثابت برای تمام تصاویر مقالات سایت است.
 *
 * Returns relative URLs.
 */
export async function processAndSaveArticleImage(params: {
  /** raw PNG/JPEG buffer from AI image generator */
  buffer: Buffer;
  /** article slug — used for the folder name */
  articleSlug: string;
  /** short descriptive name in English (e.g. "chest-workout", "protein-foods") */
  descriptiveName: string;
}): Promise<ProcessedImageSet> {
  const { buffer, articleSlug, descriptiveName } = params;
  const articleDir = path.join(getArticlesDir(), articleSlug);
  await mkdir(articleDir, { recursive: true });

  // Get original metadata
  const meta = await sharp(buffer).metadata();
  const origWidth = meta.width || 1024;
  const origHeight = meta.height || 1024;

  // === Cover: 16:9 cropped to 1200x675 + واترمارک FitUp ===
  const coverWidth = 1200;
  const coverHeight = 675;
  const coverResized = await sharp(buffer)
    .resize(coverWidth, coverHeight, {
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  const coverBuffer = await addFitUpWatermark(coverResized);
  const coverName = seoFilename({
    articleSlug,
    descriptiveName,
    variant: "cover",
    width: coverWidth,
    height: coverHeight,
  });
  const coverAbs = path.join(articleDir, coverName);
  await writeFile(coverAbs, coverBuffer);
  await mirrorToCache(coverAbs, `articles/${articleSlug}/${coverName}`);

  // === Thumbnail: 4:3 cropped to 600x450 + واترمارک FitUp ===
  const thumbWidth = 600;
  const thumbHeight = 450;
  const thumbResized = await sharp(buffer)
    .resize(thumbWidth, thumbHeight, { fit: "cover", position: "attention" })
    .webp({ quality: 75, effort: 4 })
    .toBuffer();
  const thumbBuffer = await addFitUpWatermark(thumbResized);
  const thumbName = seoFilename({
    articleSlug,
    descriptiveName,
    variant: "thumb",
    width: thumbWidth,
    height: thumbHeight,
  });
  const thumbAbs = path.join(articleDir, thumbName);
  await writeFile(thumbAbs, thumbBuffer);
  await mirrorToCache(thumbAbs, `articles/${articleSlug}/${thumbName}`);

  // === Full: max width 1600, preserve aspect + واترمارک FitUp ===
  const fullWidth = Math.min(1600, origWidth);
  const fullHeight = Math.round((origHeight / origWidth) * fullWidth);
  const fullResized = await sharp(buffer)
    .resize(fullWidth, fullHeight, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();
  const fullBuffer = await addFitUpWatermark(fullResized);
  const fullName = seoFilename({
    articleSlug,
    descriptiveName,
    variant: "full",
    width: fullWidth,
    height: fullHeight,
  });
  const fullAbs = path.join(articleDir, fullName);
  await writeFile(fullAbs, fullBuffer);
  await mirrorToCache(fullAbs, `articles/${articleSlug}/${fullName}`);

  return {
    cover: {
      url: `/uploads/articles/${articleSlug}/${coverName}`,
      absPath: coverAbs,
      width: coverWidth,
      height: coverHeight,
      bytes: coverBuffer.length,
    },
    thumbnail: {
      url: `/uploads/articles/${articleSlug}/${thumbName}`,
      absPath: thumbAbs,
      width: thumbWidth,
      height: thumbHeight,
      bytes: thumbBuffer.length,
    },
    full: {
      url: `/uploads/articles/${articleSlug}/${fullName}`,
      absPath: fullAbs,
      width: fullWidth,
      height: fullHeight,
      bytes: fullBuffer.length,
    },
  };
}

/**
 * Add FitUp watermark to an image buffer
 * واترمارک "FitUp" با گرادیان نارنجی در گوشه پایین-راست
 *
 * مهم: فرمت اصلی تصویر حفظ می‌شود. اگر ورودی WebP باشد، خروجی هم WebP است.
 * اگر PNG باشد، خروجی PNG است. اگر JPEG باشد، خروجی JPEG است.
 * این از خراب شدن فایل‌های PNG/JPG (که با فرمت اشتباه ذخیره می‌شدند) جلوگیری می‌کند.
 */
export async function addFitUpWatermark(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1200;
  const height = meta.height || 675;
  const format = meta.format || "webp"; // webp | png | jpeg | ...

  const fontSize = Math.round(width * 0.06);
  const padding = Math.round(width * 0.03);

  const svgBuffer = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f97316;stop-opacity:1" />
        </linearGradient>
      </defs>
      <text x="${width - padding}" y="${height - padding}"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="900"
        fill="url(#grad)"
        text-anchor="end"
        opacity="0.85">FitUp</text>
    </svg>
  `);

  const composited = sharp(buffer).composite([
    { input: svgBuffer, top: 0, left: 0, blend: "over" },
  ]);

  // حفظ فرمت اصلی تصویر — اگر WebP بود WebP، اگر PNG بود PNG، اگر JPEG بود JPEG
  switch (format) {
    case "png":
      return composited.png({ quality: 82, compressionLevel: 6 }).toBuffer();
    case "jpeg":
      return composited.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    case "webp":
    default:
      return composited.webp({ quality: 82, effort: 4 }).toBuffer();
  }
}

/**
 * Process an inline (content) image — single full-width WebP with FitUp watermark
 */
export async function processAndSaveInlineImage(params: {
  buffer: Buffer;
  articleSlug: string;
  descriptiveName: string;
  index: number;
}): Promise<ProcessedImageOutput> {
  const { buffer, articleSlug, descriptiveName, index } = params;
  const articleDir = path.join(getArticlesDir(), articleSlug);
  await mkdir(articleDir, { recursive: true });

  const meta = await sharp(buffer).metadata();
  const origWidth = meta.width || 1024;
  const origHeight = meta.height || 1024;

  // Inline images: max width 1200, preserve aspect
  const fullWidth = Math.min(1200, origWidth);
  const fullHeight = Math.round((origHeight / origWidth) * fullWidth);

  const out = await sharp(buffer)
    .resize(fullWidth, fullHeight, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  // افزودن واترمارک FitUp به تصویر inline
  const watermarked = await addFitUpWatermark(out);

  const name = `${slugify(articleSlug) || "article"}-${slugify(
    descriptiveName
  ) || "image"}-${index}-${fullWidth}x${fullHeight}.webp`;
  const abs = path.join(articleDir, name);
  await writeFile(abs, watermarked);
  await mirrorToCache(abs, `articles/${articleSlug}/${name}`);

  return {
    url: `/uploads/articles/${articleSlug}/${name}`,
    absPath: abs,
    width: fullWidth,
    height: fullHeight,
    bytes: out.length,
  };
}

/**
 * بررسی می‌کند که آیا یک عکس واترمارک FitUp دارد یا نه.
 *
 * منطق: ناحیه ۱۰۰×۱۰۰ پیکسل در گوشه پایین-راست استخراج می‌شود و تعداد پیکسل‌های
 * نارنجی (رنگ واترمارک) شمرده می‌شود. اگر ≥ ۲۰ پیکسل نارنجی باشد، یعنی واترمارک دارد.
 *
 * @param input - Buffer عکس یا مسیر فایل
 * @returns true اگر عکس واترمارک FitUp دارد
 */
export async function hasFitUpWatermark(input: Buffer | string): Promise<boolean> {
  try {
    const meta = await sharp(input).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (w < 100 || h < 100) return false;

    // استخراج ناحیه ۱۰۰×۱۰۰ از گوشه پایین-راست
    const region = await sharp(input)
      .extract({ left: w - 100, top: h - 100, width: 100, height: 100 })
      .raw()
      .toBuffer();

    // شمارش پیکسل‌های نارنجی (رنگ واترمارک FitUp)
    let orangePixels = 0;
    for (let i = 0; i < region.length; i += meta.channels || 3) {
      const r = region[i];
      const g = region[i + 1];
      const b = region[i + 2];
      // رنگ نارنجی: r بالا، g متوسط، b پایین
      if (r > 180 && g > 100 && g < 200 && b < 100) {
        orangePixels++;
        if (orangePixels >= 20) return true; // زودتر return کن
      }
    }
    return orangePixels >= 20;
  } catch {
    return false;
  }
}
