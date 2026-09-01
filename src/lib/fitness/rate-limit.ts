/**
 * Rate limiter ساده درون‌حافظه‌ای (sliding window) برای محافظت از endpointهای حساس.
 * برای تک‌نود (SQLite dev/prod) کافی است — بدون وابستگی خارجی.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 20000;

export interface RateLimitResult {
  ok: boolean;
  /** تعداد درخواست‌های مجاز باقی‌مانده در پنجره فعلی */
  remaining: number;
  /** ثانیه تا آزاد شدن مجدد */
  retryAfterSec: number;
}

/**
 * بررسی محدودیت نرخ درخواست.
 * @param key کلید یکتا (مثلاً `login:${ip}` یا `otp:${mobile}`)
 * @param limit حداکثر تعداد درخواست در پنجره
 * @param windowMs طول پنجره به میلی‌ثانیه
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) {
    // جلوگیری از نشت حافظه — پاکسازی دوره‌ای کلیدهای قدیمی
    for (const [k, b] of buckets) {
      if (!b.hits.length || now - b.hits[b.hits.length - 1] > windowMs * 4) buckets.delete(k);
    }
  }
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  // فقط hits داخل پنجره را نگه دار
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }
  bucket.hits.push(now);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

/** استخراج IP کلاینت از هدرهای Next.js (پشت Caddy/reverse-proxy) */
export function getClientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** پاسخ استاندارد 429 برای نقض rate limit */
export function rateLimitResponse(retryAfterSec: number, message?: string) {
  return Response.json(
    {
      error:
        message ??
        `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${retryAfterSec} ثانیه دیگر دوباره تلاش کنید.`,
      code: "RATE_LIMITED",
      retryAfterSec,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
