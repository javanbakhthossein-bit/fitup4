/**
 * مدیریت رسانه‌های خصوصی کاربران (عکس بدن، ویدیو، چت، آزمایش خون و…)
 *
 * ─── چرا این فایل وجود دارد؟ ───
 * قبلاً همه فایل‌های خصوصی در `public/uploads/` ذخیره می‌شدند و Next.js
 * آن‌ها را «استاتیک و بدون احراز هویت» سرو می‌کرد. یعنی هر کسی با حدس/نشت
 * URL می‌توانست عکس بدن یا ویدیوی کاربر دیگری را ببیند.
 *
 * ─── راه‌حل ───
 * ۱) فایل‌های خصوصی در ریشه پروژه `uploads/{category}/` ذخیره می‌شوند
 *    (خارج از `public/` — مثل مقالات).
 * ۲) چون هیچ فایلی در `public/uploads/{category}` نیست، rewrite فایل
 *    `next.config.ts` (`/uploads/* → /api/serve-upload/*`) فعال می‌شود و
 *    سرو فایل از API با احراز هویت + بررسی مالکیت انجام می‌گیرد.
 * ۳) URL ها تغییری نمی‌کنند (`/uploads/body-analysis/x.webp`) پس هیچ
 *    رکورد دیتابیسی خراب نمی‌شود.
 *
 * مهم: این فایل نباید `sharp` را import کند (محدودیت standalone —
 * توضیح کامل در `uploads-config.ts`).
 */
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { UPLOADS_ROOT } from "./uploads-config";
import { db } from "@/lib/db";

/**
 * دسته‌های رسانه خصوصی — اولین جزء مسیر `/uploads/{category}/…`.
 * این پوشه‌ها فقط با سشن معتبر و مالکیت قابل دسترسی‌اند.
 */
export const PRIVATE_MEDIA_DIRS = [
  "body-analysis", // عکس/ویدیوی تحلیل بدن (آنبوردینگ)
  "body-photos", // مسیر قدیمی عکس بدن (پاک‌سازی خودکار)
  "blood-tests", // مدیای آزمایش خون
  "chat", // عکس/ویدیو/صوت چت با مربی AI
  "meal-analysis", // عکس غذا برای تحلیل کالری
  "progress", // عکس پیشرفت (front/side/back)
  "videos", // ویدیوی تحلیل فرم
] as const;

export type PrivateMediaCategory = (typeof PRIVATE_MEDIA_DIRS)[number];

/** آیا مسیر نسبی (مثل `chat/tts/x.mp3`) جزو رسانه خصوصی است؟ */
export function isPrivateMediaPath(relativePath: string): boolean {
  const first = relativePath.split("/")[0] ?? "";
  return (PRIVATE_MEDIA_DIRS as readonly string[]).includes(first);
}

/** مسیر مطلق پوشه یک دسته خصوصی (داخل ریشه uploads — نه public) */
export function getPrivateMediaDir(category: string): string {
  return path.join(UPLOADS_ROOT, category);
}

/**
 * ذخیره امن یک فایل خصوصی در `uploads/{subDir}/` (مثلاً `chat` یا `chat/tts`).
 * URL خروجی هم‌شکل الگوی قبلی است تا فرانت‌اند و دیتابیس تغییر نکنند.
 */
export async function savePrivateMediaFile(
  subDir: string,
  fileName: string,
  data: Buffer | Uint8Array
): Promise<{ url: string; filePath: string }> {
  // امنیت: جزء اول مسیر باید یکی از دسته‌های خصوصی مجاز باشد
  const root = path.join(UPLOADS_ROOT, path.normalize(subDir).split(path.sep)[0] || subDir);
  const dir = path.join(UPLOADS_ROOT, subDir);
  const resolvedDir = path.resolve(dir);
  if (!resolvedDir.startsWith(path.resolve(root) + path.sep) && resolvedDir !== path.resolve(root)) {
    throw new Error("INVALID_MEDIA_DIR");
  }
  await mkdir(dir, { recursive: true });
  const safeName = path.basename(fileName);
  const filePath = path.join(dir, safeName);
  await writeFile(filePath, data);
  return { url: `/uploads/${subDir}/${safeName}`, filePath };
}

/** مسیر مطلق فایل از روی URL نسبی `/uploads/…` (برای unlink/خواندن مستقیم) */
export function absolutePathForUploadUrl(url: string): string {
  const rel = url.replace(/^\/+/, "").replace(/^uploads\//, "");
  return path.join(UPLOADS_ROOT, rel);
}

// ─── بررسی مالکیت ───────────────────────────────────────────────

export type MediaViewer = { id: string; role: string };

/** پیشوندهای نام فایل که شناسه کاربر (cuid) را بعد از خود دارند */
const UID_FILENAME_PREFIXES = ["body-video-", "body-", "video-", "meal-", "progress-"];

/**
 * آیا کاربرِ لاگین‌شده اجازه دیدن این فایل خصوصی را دارد؟
 *
 * ترتیب بررسی (سریع → کند):
 *  ۱) ادمین همیشه مجاز است.
 *  ۲) شناسه کاربر داخل نام فایل (`body-{uid}-…`, `video-{uid}-…`, …)
 *  ۳) نگاشت دیتابیس — ProgressPhoto / ChatMessage / AnalysisResult / FoodLog
 *  ۴) فایل‌های TTS چت (`chat/tts/…`) برای هر کاربرِ لاگین‌شده مجازند
 *     (صوتِ پاسخ AI هستند، عمرشان ۷ روز است و URL تصادفی‌اند).
 *  ۵) در غیر این صورت → رد (۴۰۳)
 */
export async function canAccessPrivateMedia(
  viewer: MediaViewer,
  relativePath: string
): Promise<boolean> {
  if (viewer.role === "ADMIN") return true;

  const normalized = relativePath.replace(/^\/+/, "");
  const fileName = path.basename(normalized);
  const url = `/uploads/${normalized}`;

  // ۱) شناسه کاربر داخل نام فایل
  for (const prefix of UID_FILENAME_PREFIXES) {
    if (fileName.startsWith(prefix)) {
      const uid = fileName.slice(prefix.length).split("-")[0];
      if (uid && uid === viewer.id) return true;
    }
  }

  // ۲) فایل‌های TTS چت — صوت پاسخ AI؛ برای هر کاربر لاگین‌شده مجاز
  if (normalized.startsWith("chat/tts/")) return true;

  // ۳) نگاشت دیتابیس (هر چهار جدول به‌صورت موازی — حداکثر یک کوئری ایندکس‌دار)
  const [progress, chat, analysis, food] = await Promise.all([
    db.progressPhoto.findFirst({ where: { imageUrl: url }, select: { userId: true } }),
    db.chatMessage.findFirst({ where: { mediaUrl: url }, select: { userId: true } }),
    db.analysisResult.findFirst({ where: { mediaUrl: url }, select: { userId: true } }),
    db.foodLog.findFirst({ where: { imageUrl: url }, select: { userId: true } }),
  ]);

  if (
    progress?.userId === viewer.id ||
    chat?.userId === viewer.id ||
    analysis?.userId === viewer.id ||
    food?.userId === viewer.id
  ) {
    return true;
  }

  return false;
}
