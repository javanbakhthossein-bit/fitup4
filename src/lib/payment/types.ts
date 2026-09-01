/**
 * تعاریف تایپ برای سیستم абстракція (Abstraction) درگاه‌های پرداخت فیتاپ
 *
 * این ماژول قرارداد (contract) بین لایه پرداخت و پروایدرهای مختلف
 * (زرین‌پال، نکت‌پی، آیدی‌پی و ...) را تعریف می‌کند.
 *
 * هر پروایدر جدید فقط کافی است اینترفیس PaymentProvider را پیاده‌سازی کند
 * و سپس خودش را از طریق registerProvider ثبت نماید.
 *
 * الگوی افزودن پروایدر جدید:
 *   1. ساخت src/lib/payment/providers/my-provider.ts
 *   2. پیاده‌سازی PaymentProvider و فراخوانی registerProvider(provider)
 *   3. افزودن import "./providers/my-provider"; به src/lib/payment/index.ts
 */

/**
 * قرارداد هر پروایدر پرداخت.
 * هر پروایدر (زرین‌پال، نکت‌پی، آیدی‌پی و ...) باید این اینترفیس را پیاده‌سازی کند.
 */
export interface PaymentProvider {
  /** شناسه یکتای پروایدر، مثلاً "zarinpal"، "nextpay"، "idpay" */
  id: string;
  /** نام نمایشی فارسی */
  name: string;
  /** آیا پروایدر به‌درستی پیکربندی شده است؟ (متغیرهای محیطی تنظیم شده‌اند) */
  isConfigured(): boolean;
  /** شروع یک پرداخت — برمی‌گرداند authority + URL درگاه */
  request(params: PaymentRequestParams): Promise<PaymentRequestResult>;
  /** تایید یک پرداخت پس از بازگشت کاربر از درگاه */
  verify(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
  /** ساخت URL کال‌بک که درگاه باید به آن redirect شود */
  buildCallbackUrl(origin: string): string;
}

/** پارامترهای شروع یک پرداخت */
export interface PaymentRequestParams {
  /** مبلغ به تومان */
  amount: number;
  /** توضیحات پرداخت (نمایش داده می‌شود به کاربر در درگاه) */
  description: string;
  /** URL کال‌بک که درگاه باید پس از پرداخت به آن redirect کند */
  callbackUrl: string;
  /** شماره موبایل کاربر (اختیاری — برای پیش‌fill در درگاه) */
  mobile?: string;
}

/** نتیجه شروع یک پرداخت */
export interface PaymentRequestResult {
  /** آیا درخواست موفق بود؟ */
  ok: boolean;
  /** کد authority (شناسه یکتای پرداخت در درگاه) — در صورت موفقیت */
  authority: string | null;
  /** URL درگاه که کاربر باید به آن redirect شود */
  gatewayUrl: string | null;
  /** آیا در حالت sandbox/test اجرا می‌شود؟ */
  simulated: boolean;
  /** پیام خطا در صورت شکست */
  error?: string;
}

/** پارامترهای تایید یک پرداخت */
export interface PaymentVerifyParams {
  /** کد authority که از درگاه برگشته */
  authority: string;
  /** مبلغ اصلی پرداخت (تومان) — باید با مبلغ درخواست مطابقت داشته باشد */
  amount: number;
}

/** نتیجه تایید یک پرداخت */
export interface PaymentVerifyResult {
  /** آیا تایید موفق بود؟ */
  ok: boolean;
  /** کد پیگیری (refId) — در صورت موفقیت */
  refId: string | null;
  /** آیا پرداخت قبلاً تایید شده بود؟ (code === 101 در زرین‌پال) */
  alreadyVerified?: boolean;
  /** شماره کارت ماسک‌شده (از زرین‌پال) */
  cardPan?: string | null;
  /** هش کارت SHA256 (از زرین‌پال) */
  cardHash?: string | null;
  /** کارمزد تراکنش (از زرین‌پال) */
  fee?: number | null;
  /** پیام خطا در صورت شکست */
  error?: string;
  /** آیا خطا «خطای شبکه/timeout» است (غیرقطعی)؟ — چنین پرداختی نباید failed شود
   *  (باگ: خطای موقت شبکه باعث failed شدن پرداختِ پرداخت‌شده می‌شد) */
  transportError?: boolean;
}
