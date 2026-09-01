/**
 * پیاده‌سازی رجیستری پروایدرهای پرداخت فیتاپ
 *
 * رجیستری یک آرایه مرکزی در سطح ماژول است که پروایدرها هنگام بارگذاری
 * ماژول خودشان (از طریق side-effect) در آن ثبت می‌شوند.
 *
 * نحوه کار:
 *   - هر فایل پروایدر در src/lib/payment/providers/ هنگام import شدن،
 *     registerProvider() را صدا می‌زند و خودش را ثبت می‌کند.
 *   - src/lib/payment/index.ts تمام فایل‌های پروایدر را import می‌کند
 *     تا از ثبت شدن آن‌ها اطمینان حاصل شود.
 *   - getActiveProvider() اولین پروایدر پیکربندی‌شده را برمی‌گرداند
 *     (برای استفاده در API route‌های checkout/verify).
 */

import type { PaymentProvider } from "./types";

/** آرایه مرکزی پروایدرهای ثبت‌شده (mutable) */
const PROVIDERS: PaymentProvider[] = [];

/**
 * ثبت یک پروایدر در رجیستری.
 * اگر پروایدری با همین id قبلاً ثبت شده باشد، با نسخه جدید جایگزین می‌شود
 * (برای جلوگیری از ثبت تکراری در حالت HMR/Hot Reload).
 */
export function registerProvider(p: PaymentProvider): void {
  const existingIdx = PROVIDERS.findIndex((x) => x.id === p.id);
  if (existingIdx >= 0) {
    PROVIDERS[existingIdx] = p;
  } else {
    PROVIDERS.push(p);
  }
}

/**
 * گرفتن یک پروایدر با شناسه.
 * @returns پروایدر یا undefined اگر یافت نشد
 */
export function getProvider(id: string): PaymentProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * گرفتن پروایدر فعال — اولین پروایدری که isConfigured() === true باشد.
 * ترتیب بررسی همان ترتیب ثبت است (معمولاً zarinpal اول ثبت می‌شود).
 *
 * @returns پروایدر فعال یا null اگر هیچ پروایدری پیکربندی نشده باشد
 */
export function getActiveProvider(): PaymentProvider | null {
  for (const p of PROVIDERS) {
    if (p.isConfigured()) return p;
  }
  return null;
}

/**
 * لیست تمام پروایدرهای ثبت‌شده (بدون فیلتر پیکربندی).
 */
export function listProviders(): PaymentProvider[] {
  return [...PROVIDERS];
}

/**
 * لیست پروایدرهایی که به‌درستی پیکربندی شده‌اند.
 */
export function listConfiguredProviders(): PaymentProvider[] {
  return PROVIDERS.filter((p) => p.isConfigured());
}
