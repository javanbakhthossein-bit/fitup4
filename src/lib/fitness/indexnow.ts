/**
 * IndexNow — اطلاع‌رسانی سریع به موتورهای جستجو (Google, Bing, Yandex, Naver)
 * برای ایندکس فوری صفحات جدید یا به‌روزرسانی‌شده.
 *
 * نحوه کار:
 *  ۱. وقتی مقاله‌ای منتشر یا به‌روزرسانی می‌شود، این تابع صدا زده می‌شود.
 *  ۲. یک POST به https://api.indexnow.org/IndexNow ارسال می‌کند با:
 *     - host: fittup.ir
 *     - key: کلید IndexNow (که در public/<key>.txt قرار دارد)
 *     - urlList: لیست URLهایی که باید ایندکس شوند
 *  ۳. موتورهای جستجو سپس آن URLها را کرال و ایندکس می‌کنند (معمولاً در چند دقیقه).
 *
 * کلید: ae7f3b2c1d9e4a8b6f5d7c9e2a1b4f8d
 * فایل کلید: https://fittup.ir/ae7f3b2c1d9e4a8b6f5d7c9e2a1b4f8d.txt
 */

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "ae7f3b2c1d9e4a8b6f5d7c9e2a1b4f8d";
const INDEXNOW_API = "https://api.indexnow.org/IndexNow";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

export interface IndexNowResult {
  ok: boolean;
  submitted: number;
  status?: number;
  error?: string;
}

/**
 * ارسال لیست URLها به IndexNow برای ایندکس سریع.
 *
 * @param urls - لیست URLهای کامل (مثلاً https://fittup.ir/?article=slug)
 * @returns نتیجه ارسال
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult> {
  if (!urls || urls.length === 0) {
    return { ok: true, submitted: 0 };
  }

  // حداکثر ۱۰۰۰۰ URL در هر درخواست
  const batch = urls.slice(0, 10000);

  try {
    const res = await fetch(INDEXNOW_API, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: batch,
      }),
      // timeout ۳۰ ثانیه
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok || res.status === 200 || res.status === 202) {
      return { ok: true, submitted: batch.length, status: res.status };
    }

    return {
      ok: false,
      submitted: 0,
      status: res.status,
      error: `IndexNow returned ${res.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      submitted: 0,
      error: err?.message || "IndexNow request failed",
    };
  }
}

/**
 * ارسال یک URL تکی به IndexNow.
 */
export async function submitUrlToIndexNow(url: string): Promise<IndexNowResult> {
  return submitToIndexNow([url]);
}

/**
 * ساخت URL کامل برای مقاله.
 */
export function articleUrl(slug: string): string {
  return `${SITE_URL}/?article=${encodeURIComponent(slug)}`;
}

/**
 * ساخت URL کامل برای صفحه اصلی.
 */
export function homePageUrl(): string {
  return `${SITE_URL}/`;
}
