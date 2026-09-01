/**
 * Zarinpal Payment Gateway — Production Setup
 *
 * To go live, set ONE environment variable in .env:
 *   ZARINPAL_MERCHANT_ID=your-merchant-uuid-here
 *
 * That's it. The system automatically:
 * - Uses real Zarinpal API (not sandbox)
 * - Builds the correct callback URL
 * - Verifies payments server-side
 *
 * For sandbox/testing: set PAYMENT_SANDBOX=true (no real merchant needed)
 *
 * Docs: https://www.zarinpal.com/docs/paymentGateway/
 *
 * -----------------------------------------------------------------------------
 *
 * پروایدر پرداخت زرین‌پال — پیاده‌سازی PaymentProvider
 *
 * این فایل منطق موجود در src/lib/fitness/zarinpal.ts را به عنوان یک
 * PaymentProvider ثبت‌شده در رجیستری پیاده‌سازی می‌کند.
 *
 * پشتیبانی Sandbox:
 *   - اگر ZARINPAL_MERCHANT_ID = "TEST" یا تنظیم نشده باشد
 *     و PAYMENT_SANDBOX=true باشد → حالت شبیه‌سازی (simulated: true).
 *     در این حالت، هیچ درخواست واقعی به زرین‌پال ارسال نمی‌شود و
 *     authority/refId شبیه‌سازی‌شده تولید می‌شود.
 *   - اگر ZARINPAL_MERCHANT_ID یک UUID واقعی باشد → حالت production (simulated: false).
 *     درخواست‌ها به API واقعی زرین‌پال ارسال می‌شود.
 *
 * سازگاری با گذشته:
 *   - توابع قدیمی (zarinpalRequest، zarinpalVerify، isZarinpalConfigured، buildCallbackUrl)
 *     حفظ شده‌اند و به صورت wrapper روی provider singleton عمل می‌کنند.
 *   - src/lib/fitness/zarinpal.ts این توابع را re-export می‌کند.
 */

import type {
  PaymentProvider,
  PaymentRequestParams,
  PaymentRequestResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
} from "../types";
import { registerProvider } from "../registry";

// ─── API Endpoints (طبق مستندات رسمی: payment.zarinpal.com) ───
const ZARINPAL_REQUEST_URL = "https://payment.zarinpal.com/pg/v4/payment/request.json";
const ZARINPAL_VERIFY_URL = "https://payment.zarinpal.com/pg/v4/payment/verify.json";
const ZARINPAL_REVERSE_URL = "https://payment.zarinpal.com/pg/v4/payment/reverse.json";
const ZARINPAL_INQUIRY_URL = "https://payment.zarinpal.com/pg/v4/payment/inquiry.json";
const ZARINPAL_UNVERIFIED_URL = "https://payment.zarinpal.com/pg/v4/payment/unVerified.json";
const ZARINPAL_STARTPAY_URL = "https://payment.zarinpal.com/pg/StartPay";

// ─── Backward-compatible types (همان چیزی که کد قدیمی انتظار دارد) ───
export interface ZarinpalRequestParams {
  amount: number; // Tomans
  description: string;
  callbackUrl: string;
  mobile?: string;
}

export interface ZarinpalRequestResult {
  ok: boolean;
  authority: string | null;
  gatewayUrl: string | null;
  code: number | null;
  error?: string;
}

export interface ZarinpalVerifyParams {
  authority: string;
  amount: number; // Tomans — must match the original request
}

export interface ZarinpalVerifyResult {
  ok: boolean;
  code: number | null;
  refId: string | null;
  cardPan?: string | null;
  cardHash?: string | null;
  fee?: number | null;
  error?: string;
  alreadyVerified?: boolean;
  /** خطای غیرقطعی شبکه/timeout — کالر نباید failed کند (claim آزاد و retry) */
  transportError?: boolean;
}

// ─── Sandbox helpers ───

/**
 * آیا در حالت sandbox هستیم؟
 *
 * طبق قرارداد:
 *   - اگر ZARINPAL_MERCHANT_ID = "TEST" یا تنظیم‌نشده باشد
 *     و PAYMENT_SANDBOX=true باشد → sandbox فعال است.
 *   - اگر merchant واقعی باشد → sandbox فعال نیست (production).
 *   - اگر merchant=TEST/unset و PAYMENT_SANDBOX تنظیم‌نشده باشد →
 *     sandbox فعال نیست (حالت قدیمی: not configured → fallback به simulated در لایه route).
 */
function isSandboxMode(): boolean {
  const m = process.env.ZARINPAL_MERCHANT_ID;
  const sandboxFlag = process.env.PAYMENT_SANDBOX === "true";
  // Sandbox فقط زمانی فعال می‌شود که merchant واقعی نباشد
  // و PAYMENT_SANDBOX صراحتاً true شده باشد.
  if (!m || m === "TEST") {
    // ─── گارد production (ممیزی 2-a باگ #6) ───
    // sandbox = تایید خودکار پرداخت بدون پول واقعی. در production هرگز
    // نباید فعال شود — حتی اگر env اشتباهاً تنظیم شده باشد (الگوی devCode در
    // send-otp). چرخش پیش‌فرض: فقط محیط توسعه.
    if (process.env.NODE_ENV === "production") return false;
    return sandboxFlag;
  }
  // merchant واقعی → production، sandbox غیرفعال
  return false;
}

/**
 * آیا merchant واقعی پیکربندی شده است؟ (UUID معتبر، نه TEST)
 */
function hasRealMerchant(): boolean {
  const m = process.env.ZARINPAL_MERCHANT_ID;
  return !!m && m !== "TEST";
}

// ─── تولید authority/refId شبیه‌سازی‌شده ───
function generateSimulatedAuthority(): string {
  return `A000${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

function generateSimulatedRefId(): string {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

// ─── ZarinpalProvider (پیاده‌سازی PaymentProvider) ───
class ZarinpalProvider implements PaymentProvider {
  id = "zarinpal";
  name = "زرین‌پال";

  /**
   * آیا پروایدر پیکربندی شده است؟
   * - اگر merchant واقعی باشد → true
   * - اگر sandbox فعال باشد → true
   * - در غیر این صورت → false
   */
  isConfigured(): boolean {
    return hasRealMerchant() || isSandboxMode();
  }

  /**
   * شروع یک پرداخت.
   * - در حالت sandbox: authority شبیه‌سازی‌شده تولید می‌کند (بدون فراخوانی API).
   * - در حالت production: به API واقعی زرین‌پال متصل می‌شود.
   */
  async request(
    params: PaymentRequestParams
  ): Promise<PaymentRequestResult> {
    // حالت sandbox — شبیه‌سازی
    if (isSandboxMode()) {
      const authority = generateSimulatedAuthority();
      return {
        ok: true,
        authority,
        gatewayUrl: `${ZARINPAL_STARTPAY_URL}/${authority}`,
        simulated: true,
      };
    }

    // حالت production — فراخوانی API واقعی زرین‌پال
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) {
      return {
        ok: false,
        authority: null,
        gatewayUrl: null,
        simulated: false,
        error: "ZARINPAL_MERCHANT_ID not configured",
      };
    }

    const body: Record<string, unknown> = {
      merchant_id: merchantId,
      amount: params.amount,
      currency: "IRT", // واحد پولی: تومان (طبق مستندات)
      description: params.description,
      callback_url: params.callbackUrl,
      metadata: {
        ...(params.mobile ? { mobile: params.mobile } : {}),
      },
    };

    try {
      const res = await fetch(ZARINPAL_REQUEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json", // طبق مستندات: Accept header الزامی است
        },
        body: JSON.stringify(body),
        cache: "no-store",
        // تایم‌اوت خروجی — درگاه هنگ‌شده نباید checkout را بی‌نهایت معلق کند
        signal: AbortSignal.timeout(30_000),
      });

      const data = await res.json();

      // ساختار پاسخ زرین‌پال: { data: { authority, code }, errors: [...] }
      if (data?.data?.authority && data?.data?.code === 100) {
        const authority = data.data.authority as string;
        return {
          ok: true,
          authority,
          gatewayUrl: `${ZARINPAL_STARTPAY_URL}/${authority}`,
          simulated: false,
        };
      }

      // لاگ دقیق برای دیباگ
      const errMsg =
        Array.isArray(data?.errors) && data.errors[0]
          ? data.errors[0].message ?? "Zarinpal request failed"
          : typeof data?.errors === "object" && data?.errors?.message
            ? data.errors.message
            : "Zarinpal request failed";
      console.error("[zarinpal] request failed — response:", JSON.stringify(data));

      return {
        ok: false,
        authority: null,
        gatewayUrl: null,
        simulated: false,
        error: errMsg,
      };
    } catch (e) {
      console.error("[zarinpal] request exception:", e instanceof Error ? e.message : e);
      return {
        ok: false,
        authority: null,
        gatewayUrl: null,
        simulated: false,
        error: e instanceof Error ? e.message : "Network error",
      };
    }
  }

  /**
   * تایید یک پرداخت پس از بازگشت کاربر از درگاه.
   * - در حالت sandbox: همیشه موفق با refId شبیه‌سازی‌شده.
   * - در حالت production: به API واقعی زرین‌پال متصل می‌شود.
   */
  async verify(
    params: PaymentVerifyParams
  ): Promise<PaymentVerifyResult> {
    // حالت sandbox — شبیه‌سازی موفق
    if (isSandboxMode()) {
      return {
        ok: true,
        refId: generateSimulatedRefId(),
        alreadyVerified: false,
      };
    }

    // حالت production — فراخوانی API واقعی زرین‌پال
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    if (!merchantId) {
      return {
        ok: false,
        refId: null,
        error: "ZARINPAL_MERCHANT_ID not configured",
      };
    }

    try {
      const res = await fetch(ZARINPAL_VERIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json", // طبق مستندات: Accept header الزامی است
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          authority: params.authority,
          amount: params.amount,
        }),
        cache: "no-store",
        // تایم‌اوت خروجی — درگاه هنگ‌شده نباید verify را بی‌نهایت معلق کند
        signal: AbortSignal.timeout(30_000),
      });

      const data = await res.json();

      // کدهای موفق: 100 → موفق، 101 → قبلاً تایید شده
      const code = data?.data?.code;
      if (code === 100 || code === 101) {
        return {
          ok: true,
          refId:
            data?.data?.ref_id != null ? String(data.data.ref_id) : null,
          alreadyVerified: code === 101,
          // استخراج اطلاعات کارت و کارمزد از پاسخ verify (طبق مستندات)
          cardPan: data?.data?.card_pan ?? null,
          cardHash: data?.data?.card_hash ?? null,
          fee: data?.data?.fee ?? null,
        };
      }

      const errMsg =
        Array.isArray(data?.errors) && data.errors[0]
          ? data.errors[0].message ?? "Zarinpal verify failed"
          : "Zarinpal verify failed";

      return {
        ok: false,
        refId: null,
        error: errMsg,
      };
    } catch (e) {
      // خطای شبکه/timeout — «غیرقطعی»: زرین‌پال پاسخ نداد؛ پرداخت ممکن است
      // انجام شده باشد. کالر نباید این را failed کند (claim آزاد و retry).
      return {
        ok: false,
        refId: null,
        error: e instanceof Error ? e.message : "Network error",
        transportError: true,
      };
    }
  }

  /**
   * ساخت URL کال‌بک که زرین‌پال باید به آن redirect کند.
   * همیشه از NEXT_PUBLIC_SITE_URL استفاده می‌کند تا مطمئن باشیم
   * زرین‌پال آن را قبول می‌کند (callback باید با دامنه ثبت‌شده مطابقت داشته باشد).
   * origin پارامتر فقط برای fallback استفاده می‌شود.
   */
  buildCallbackUrl(origin: string): string {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const base = siteUrl || origin;
    // حذف / انتهایی اگر وجود دارد
    const cleanBase = base.replace(/\/$/, "");
    return `${cleanBase}/?payment_verify=1`;
  }
}

// ─── Singleton instance ───
const zarinpalProvider = new ZarinpalProvider();

// ثبت پروایدر هنگام بارگذاری ماژول (side-effect registration)
registerProvider(zarinpalProvider);

// ─── Backward-compatible API (توابع قدیمی به عنوان wrapper) ───
// این توابع برای حفظ سازگاری با کد قدیمی نگه داشته شده‌اند.
// src/lib/fitness/zarinpal.ts این توابع را re-export می‌کند.

/**
 * شروع یک پرداخت زرین‌پال (API قدیمی).
 * در حالت sandbox، authority شبیه‌سازی‌شده برمی‌گرداند.
 */
export async function zarinpalRequest(
  params: ZarinpalRequestParams
): Promise<ZarinpalRequestResult> {
  const result = await zarinpalProvider.request({
    amount: params.amount,
    description: params.description,
    callbackUrl: params.callbackUrl,
    mobile: params.mobile,
  });

  // نگاشت نتیجه جدید به نوع قدیمی (با فیلد code، بدون simulated)
  // در حالت sandbox، code = 100 (موفق) فرض می‌کنیم.
  return {
    ok: result.ok,
    authority: result.authority,
    gatewayUrl: result.gatewayUrl,
    code: result.ok ? 100 : null,
    error: result.error,
  };
}

/**
 * تایید یک پرداخت زرین‌پال (API قدیمی).
 * در حالت sandbox، refId شبیه‌سازی‌شده برمی‌گرداند.
 */
export async function zarinpalVerify(
  params: ZarinpalVerifyParams
): Promise<ZarinpalVerifyResult> {
  const result = await zarinpalProvider.verify({
    authority: params.authority,
    amount: params.amount,
  });

  // نگاشت نتیجه جدید به نوع قدیمی (با فیلدهای code، cardPan، cardHash، fee)
  // در حالت sandbox، code = 100 (موفق) فرض می‌کنیم.
  // code واقعی پاسخ درگاه هم expose می‌شود (100 = موفق، 101 = قبلاً verify شده)
  // تا فراخواننده‌ها بتوانند replay با authority قدیمی را تشخیص دهند (F2).
  return {
    ok: result.ok,
    code: result.ok ? (result.alreadyVerified ? 101 : 100) : null,
    refId: result.refId,
    cardPan: result.cardPan ?? null,
    cardHash: result.cardHash ?? null,
    fee: result.fee ?? null,
    error: result.error,
    alreadyVerified: result.alreadyVerified,
    transportError: result.transportError === true,
  };
}

// ─── توابع جدید: reverse (استرداد) و inquiry (استعلام وضعیت) ───

export interface ZarinpalReverseParams {
  authority: string;
}

export interface ZarinpalReverseResult {
  ok: boolean;
  code: number | null;
  message?: string;
  error?: string;
}

/**
 * استرداد تراکنش (Reverse) — طبق مستندات زرین‌پال
 *
 * تراکنش‌های موفقی که از پرداخت آنها نهایت ۳۰ دقیقه گذشته باشد را
 * بدون کارمزد به حساب خریدار سریعاً استرداد می‌زند.
 *
 * URL: https://payment.zarinpal.com/pg/v4/payment/reverse.json
 *
 * نکته: برای استفاده از این سرویس باید حتماً برای درگاه آی‌پی سرور خود را ست کنید.
 * در غیر این صورت خطای -62 دریافت می‌کنید.
 */
export async function zarinpalReverse(
  params: ZarinpalReverseParams
): Promise<ZarinpalReverseResult> {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId || merchantId === "TEST") {
    return {
      ok: false,
      code: null,
      error: "ZARINPAL_MERCHANT_ID not configured",
    };
  }

  try {
    const res = await fetch(ZARINPAL_REVERSE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        merchant_id: merchantId,
        authority: params.authority,
      }),
      cache: "no-store",
      // تایم‌اوت خروجی — درگاه هنگ‌شده نباید استرداد را بی‌نهایت معلق کند
      signal: AbortSignal.timeout(30_000),
    });

    const data = await res.json();

    // code 100 = Reversed (موفق)
    if (data?.data?.code === 100) {
      return {
        ok: true,
        code: 100,
        message: data?.data?.message ?? "Reversed",
      };
    }

    const errMsg =
      Array.isArray(data?.errors) && data.errors[0]
        ? data.errors[0].message ?? "Zarinpal reverse failed"
        : data?.errors?.message ?? "Zarinpal reverse failed";
    const errCode = data?.errors?.code ?? data?.data?.code ?? null;

    return {
      ok: false,
      code: errCode,
      error: errMsg,
    };
  } catch (e) {
    return {
      ok: false,
      code: null,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

export interface ZarinpalInquiryParams {
  authority: string;
}

export interface ZarinpalInquiryResult {
  ok: boolean;
  code: number | null;
  status?: string; // VERIFIED | PAID | IN_BANK | FAILED | REVERSED
  message?: string;
  error?: string;
}

/**
 * استعلام وضعیت تراکنش (Inquiry) — طبق مستندات زرین‌پال
 *
 * این متد فقط وضعیت تراکنش را اعلام می‌کند.
 * از این متد به هیچ عنوان برای تایید و وریفای کردن تراکنش استفاده نکنید.
 *
 * URL: https://payment.zarinpal.com/pg/v4/payment/inquiry.json
 *
 * وضعیت‌های ممکن:
 *   VERIFIED : وریفای شده
 *   PAID : پرداخت شده (وریفای نشده)
 *   IN_BANK : درحال پرداخت
 *   FAILED : ناموفق (تکمیل نشده)
 *   REVERSED : تراکنش ریورس شده
 */
export async function zarinpalInquiry(
  params: ZarinpalInquiryParams
): Promise<ZarinpalInquiryResult> {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId || merchantId === "TEST") {
    return {
      ok: false,
      code: null,
      error: "ZARINPAL_MERCHANT_ID not configured",
    };
  }

  try {
    const res = await fetch(ZARINPAL_INQUIRY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        merchant_id: merchantId,
        authority: params.authority,
      }),
      cache: "no-store",
      // تایم‌اوت خروجی — درگاه هنگ‌شده نباید استعلام را بی‌نهایت معلق کند
      signal: AbortSignal.timeout(30_000),
    });

    const data = await res.json();

    if (data?.data?.code === 100) {
      return {
        ok: true,
        code: 100,
        status: data?.data?.status ?? null,
        message: data?.data?.message ?? "Success",
      };
    }

    const errMsg =
      Array.isArray(data?.errors) && data.errors[0]
        ? data.errors[0].message ?? "Zarinpal inquiry failed"
        : data?.errors?.message ?? "Zarinpal inquiry failed";

    return {
      ok: false,
      code: data?.data?.code ?? null,
      error: errMsg,
    };
  } catch (e) {
    return {
      ok: false,
      code: null,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

/**
 * آیا زرین‌پال پیکربندی شده است؟
 * - اگر merchant واقعی باشد → true
 * - اگر sandbox فعال باشد (PAYMENT_SANDBOX=true یا merchant=TEST) → true
 * - در غیر این صورت → false
 *
 * نکته مهم: این تابع رفتارش نسبت به نسخه قدیمی تغییر کرده است.
 * در نسخه قدیمی، merchant=TEST یا خالی → false.
 * در نسخه جدید، اگر PAYMENT_SANDBOX=true باشد → true (sandbox فعال).
 * اگر نه merchant واقعی باشد و نه sandbox → false.
 */
export function isZarinpalConfigured(): boolean {
  return zarinpalProvider.isConfigured();
}

/**
 * آیا در حالت sandbox هستیم؟ (تابع کمکی جدید)
 */
export function isZarinpalSandbox(): boolean {
  return isSandboxMode();
}

/**
 * ساخت URL کال‌بک زرین‌پال.
 */
export function buildCallbackUrl(origin: string): string {
  return zarinpalProvider.buildCallbackUrl(origin);
}

/** دسترسی به singleton پروایدر زرین‌پال (برای استفاده مستقیم در کد جدید) */
export { zarinpalProvider as ZarinpalProviderInstance };
