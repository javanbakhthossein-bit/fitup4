/**
 * Zarinpal Payment Gateway helper (legacy wrapper)
 *
 * این فایل برای حفظ سازگاری با کد قدیمی نگه داشته شده است.
 * پیاده‌سازی واقعی اکنون در src/lib/payment/providers/zarinpal.ts قرار دارد
 * و به عنوان یک PaymentProvider در رجیستری ثبت می‌شود.
 *
 * توابع و تایپ‌های قدیمی از محل جدید re-export می‌شوند تا هیچ breaking change‌ای
 * در import‌های موجود (مثل src/app/api/payment/checkout/route.ts و verify/route.ts)
 * رخ ندهد.
 *
 * رفتار جدید isZarinpalConfigured():
 *   - اگر merchant واقعی باشد → true
 *   - اگر PAYMENT_SANDBOX=true و merchant=TEST/unset باشد → true (حالت sandbox)
 *   - در غیر این صورت → false (حالت قدیمی: fallback به simulated در لایه route)
 *
 * Docs: https://www.zarinpal.com/docs/paymentGateway/
 * Amount unit: Tomans (تومان) — Zarinpal uses تومان, not ریال
 */

export {
  zarinpalRequest,
  zarinpalVerify,
  isZarinpalConfigured,
  isZarinpalSandbox,
  buildCallbackUrl,
  type ZarinpalRequestParams,
  type ZarinpalRequestResult,
  type ZarinpalVerifyParams,
  type ZarinpalVerifyResult,
} from "@/lib/payment/providers/zarinpal";
