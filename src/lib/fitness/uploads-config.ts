/**
 * مسیر ریشه ذخیره‌سازی تصاویر — در ریشه پروژه (نه در public).
 *
 * مهم: این فایل جداگانه است تا `sharp` import نشود. فایل‌های API route
 * (مثل /api/serve-upload) فقط به مسیر نیاز دارند و نباید sharp را بارگذاری
 * کنند، چون sharp یک native module است و در standalone ممکن است مشکل داشته
 * باشد (libvips موجود نیست).
 */
import path from "path";
import { existsSync, statSync } from "fs";

/**
 * یافتن مسیر واقعی پوشه `uploads`.
 *
 * مشکل: در حالت standalone (`node .next/standalone/server.js`) ممکن است
 * process.cwd() داخل `.next/standalone` باشد، در حالی که پوشه uploads در
 * ریشه پروژه است. اگر مسیر فقط بر اساس cwd ساخته شود، همه تصاویر 404
 * می‌شوند (نه کاورها نمایش داده می‌شوند، نه تصاویر inline).
 *
 * راه‌حل — به این ترتیب جستجو می‌کنیم (اولین مورد موجود برنده است):
 *   ۱. متغیر محیطی UPLOADS_DIR (override صریح — مسیر مطلق)
 *   ۲. process.cwd()/uploads (رفتار قبلی — اگر وجود داشته باشد)
 *   ۳. بالا رفتن تا ۴ سطح از cwd تا پیدا شدن پوشه uploads موجود
 *      (برای standalone که داخل .next/standalone اجرا می‌شود)
 *   ۴. fallback: process.cwd()/uploads (نمونه قبلی — نوشتن‌ها همان‌جا mkdir می‌کنند)
 */
function resolveUploadsRoot(): string {
  // ۱) override صریح با env
  const envDir = process.env.UPLOADS_DIR;
  if (envDir && path.isAbsolute(envDir)) {
    return envDir;
  }

  const isUploadsDir = (p: string): boolean => {
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  };

  // ۲) cwd/uploads (رفتار پیش‌فرض قبلی)
  const cwdUploads = path.join(process.cwd(), "uploads");
  if (isUploadsDir(cwdUploads)) {
    return cwdUploads;
  }

  // ۳) بالا رفتن از cwd تا ۴ سطح والد
  try {
    let dir = process.cwd();
    for (let i = 0; i < 4; i++) {
      dir = path.dirname(dir);
      const candidate = path.join(dir, "uploads");
      if (isUploadsDir(candidate)) {
        return candidate;
      }
    }
  } catch {
    // ignore — به fallback می‌رسیم
  }

  // ۴) fallback — همان رفتار قبلی (پوشه موقع اولین نوشتن ساخته می‌شود)
  return cwdUploads;
}

/**
 * مسیر ریشه ذخیره‌سازی تصاویر — در ریشه پروژه (نه در public).
 *
 * این مسیر در زمان `next build` کپی نمی‌شود، پس تصاویر runtime (مثل مقالات
 * سئوی تولیدشده در production) از بین نمی‌روند.
 */
export const UPLOADS_ROOT = resolveUploadsRoot();

/**
 * مسیر ذخیره‌سازی تصاویر مقالات.
 */
export function getArticlesDir(): string {
  return path.join(UPLOADS_ROOT, "articles");
}
