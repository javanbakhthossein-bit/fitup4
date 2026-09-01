"use client";

/**
 * fetchJson — ابزار مشترک fetch + parse JSON با خطاهای فارسی دوستانه.
 *
 * چرا این فایل وجود دارد:
 * وقتی سرور در حال ری‌استارت است یا درخواست از سقف تایم‌اوت گیت‌وی عبور می‌کند،
 * مرورگر پاسخ HTML (صفحه خطای Caddy/Next) می‌گیرد. `res.json()` در این حالت
 * خطای خام انگلیسی می‌دهد: «Unexpected token '<', "<!DOCTYPE "... is not valid JSON»
 * که برای کاربر فارسی‌زبان بی‌معنی است.
 *
 * این ابزار:
 *  ۱) قبل از parse، content-type را چک می‌کند
 *  ۲) پاسخ‌های HTML/غیر JSON را به خطای فارسی «ارتباط با سرور برقرار نشد» تبدیل می‌کند
 *  ۳) خطای شبکه را هم به همین شکل فارسی می‌دهد
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const SERVER_UNREACHABLE_MESSAGE =
  "ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید.";

export async function fetchJson<T = any>(
  input: RequestInfo,
  init?: RequestInit
): Promise<{ res: Response; data: T }> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    // خطای شبکه (سرور در دسترس نیست، DNS، offline و ...)
    throw new ApiError(SERVER_UNREACHABLE_MESSAGE, 0);
  }

  const contentType = res.headers.get("content-type") || "";
  const bodyText = await res.text();

  if (!contentType.includes("application/json")) {
    // پاسخ HTML (صفحه خطای گیت‌وی/سرور) یا هر چیز غیر JSON
    console.error(
      `[fetchJson] non-JSON response (${res.status}, ${contentType || "no content-type"}):`,
      bodyText.slice(0, 150)
    );
    if (res.status >= 500 || res.status === 0) {
      throw new ApiError(SERVER_UNREACHABLE_MESSAGE, res.status);
    }
    throw new ApiError("پاسخ سرور نامعتبر است. لطفاً دوباره تلاش کنید.", res.status);
  }

  let data: any = null;
  try {
    data = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    console.error("[fetchJson] JSON parse failed:", bodyText.slice(0, 150));
    throw new ApiError("پاسخ سرور نامعتبر است. لطفاً دوباره تلاش کنید.", res.status);
  }

  return { res, data: data as T };
}

/**
 * نسخه پرکاربرد: خطای API (res.ok=false) را هم به Error فارسی تبدیل می‌کند.
 * data.error از پاسخ سرور در صورت وجود استفاده می‌شود.
 */
export async function fetchJsonOrThrow<T = any>(
  input: RequestInfo,
  init?: RequestInit,
  fallbackError = "خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید."
): Promise<T> {
  const { res, data } = await fetchJson<T>(input, init);
  if (!res.ok) {
    const apiError = (data as any)?.error || (data as any)?.message;
    throw new ApiError(apiError || fallbackError, res.status);
  }
  return data;
}
