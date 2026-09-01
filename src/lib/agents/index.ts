/**
 * Barrel export برای سیستم ایجنت‌های هوش مصنوعی فیتاپ
 *
 * این فایل:
 *   1. تمام تایپ‌ها و توابع رجیستری را re-export می‌کند
 *   2. تمام ایجنت‌های built-in را import می‌کند تا هنگام بارگذاری ماژول،
 *      خودشان را در رجیستری ثبت کنند (side-effect registration)
 *
 * الگوی افزودن ایجنت جدید:
 *   1. ساخت src/lib/agents/agents/my-agent.ts با پیاده‌سازی AIAgent
 *   2. فراخوانی registerAgent(myAgent) در انتهای فایل
 *   3. افزودن import "./agents/my-agent"; به این فایل (در بخش زیر)
 */

// ─── تایپ‌ها و رجیستری ───
export * from "./types";
export * from "./registry";

// ─── ثبت ایجنت‌های built-in (side-effect imports) ───
// ترتیب import مهم نیست — هر فایل خودش را در رجیستری ثبت می‌کند.
import "./agents/seo-agent";
import "./agents/onboarding-analyzer";
// (ایجنت‌های آینده اینجا اضافه می‌شوند)
