/**
 * Helper: تبدیل مسیر تصویر به WebP
 *
 * این تابع تضمین می‌کند که تمام تصاویر مقالات، آواتارها و سایر تصاویر
 * همیشه با فرمت WebP لود شوند — حتی اگر در دیتابیس PNG/JPG ثبت شده باشند.
 *
 * مزایا:
 *  - کاهش حجم تصاویر تا ۸۰٪
 *  - بهبود LCP و Speed Index در Lighthouse
 *
 * نکته: این تابع فقط URL را بازنویسی می‌کند — خودش فایلی نمی‌سازد. برای اینکه
 * فایل .webp واقعاً روی دیسک وجود داشته باشد، آپلودهای PNG/JPG سمت سرور در
 * /api/articles/upload-image با sharp به WebP تبدیل می‌شوند (و در صورت شکست
 * تبدیل، همان فرمت اصلی ذخیره و برگردانده می‌شود)، پس URL ذخیره‌شده در DB
 * همیشه به فایل واقعی اشاره می‌کند.
 *
 * استفاده:
 *   import { toWebp } from "@/lib/fitness/image-utils";
 *   <img src={toWebp(article.coverImage)} />
 */

/**
 * مسیر تصویر را به WebP تبدیل می‌کند.
 * اگر مسیر خالی است یا قبلاً WebP/SVG/GIF است، همان را برمی‌گرداند.
 *
 * این تابع SSR-safe است — اگر window در دسترس نیست (server-side rendering)،
 * فقط URL خارجی را بدون بررسی hostname برمی‌گرداند.
 *
 * @param url مسیر تصویر (مثلاً /uploads/articles/art-muscle-gain.png)
 * @returns مسیر WebP (مثلاً /uploads/articles/art-muscle-gain.webp)
 */
export function toWebp(url: string | null | undefined): string {
  if (!url) return "";
  // اگر قبلاً WebP است، SVG است، یا GIF متحرک است، تغییر نده
  if (/\.(webp|svg|gif)$/i.test(url)) return url;
  // اگر از یک دامنه خارجی است (مثل CDN)، تغییر نده
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // SSR-safe: اگر window در دسترس نیست (server-side)، URL خارجی را همانطور که هست برگردان
    if (typeof window === "undefined") return url;
    if (!url.includes(window.location.hostname)) return url;
  }
  // PNG/JPG/JPEG → WebP
  return url.replace(/\.(png|jpe?g)$/i, ".webp");
}

/**
 * نسخه server-side (بدون window) برای استفاده در SSR
 */
export function toWebpServer(url: string | null | undefined): string {
  if (!url) return "";
  if (/\.(webp|svg|gif)$/i.test(url)) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return url.replace(/\.(png|jpe?g)$/i, ".webp");
}
