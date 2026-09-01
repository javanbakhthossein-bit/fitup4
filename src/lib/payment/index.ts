/**
 * Barrel export برای سیستم پرداخت فیتاپ
 *
 * این فایل:
 *   1. تمام تایپ‌ها و توابع رجیستری را re-export می‌کند
 *   2. تمام پروایدرهای built-in را import می‌کند تا هنگام بارگذاری ماژول،
 *      خودشان را در رجیستری ثبت کنند (side-effect registration)
 *
 * الگوی افزودن پروایدر جدید:
 *   1. ساخت src/lib/payment/providers/my-provider.ts با پیاده‌سازی PaymentProvider
 *   2. فراخوانی registerProvider(provider) در انتهای فایل
 *   3. افزودن import "./providers/my-provider"; به این فایل
 */

// ─── تایپ‌ها و رجیستری ───
export * from "./types";
export * from "./registry";

// ─── ثبت پروایدرهای built-in (side-effect imports) ───
import "./providers/zarinpal";
// (پروایدرهای آینده اینجا اضافه می‌شوند — nextpay، idpay و ...)

// ─── Re-export توابع قدیمی زرین‌پال برای استفاده مستقیم ───
export {
  zarinpalRequest,
  zarinpalVerify,
  isZarinpalConfigured,
  isZarinpalSandbox,
  buildCallbackUrl,
  ZarinpalProviderInstance,
  type ZarinpalRequestParams,
  type ZarinpalRequestResult,
  type ZarinpalVerifyParams,
  type ZarinpalVerifyResult,
} from "./providers/zarinpal";
