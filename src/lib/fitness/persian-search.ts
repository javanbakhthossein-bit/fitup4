/**
 * نرمال‌سازی جستجوی فارسی — رفع باگ «جستجو با نیم‌فاصله نتیجه نمی‌دهد»
 *
 * مشکل: متن فارسی چند نمایش معادل دارد:
 *  - نیم‌فاصله (ZWNJ، U+200C): «آب‌پز»
 *  - فاصله معمولی: «آب پز»
 *  - چسبیده: «آبپز»
 *  - حروف عربی به‌جای فارسی: «ي» به‌جای «ی»، «ك» به‌جای «ک»
 *  - اعراب/تشدید (redundant diacritics)
 *
 * جستجوی `contains` در SQLite کاملاً literal است؛ اگر کاربر «آب پز» بنویسد
 * و نام غذا «آب‌پز» باشد → صفر نتیجه.
 *
 * راه‌حل: کوئری را به چندین معادل نرمال‌شده تبدیل می‌کنیم (variants) و
 * شرط OR می‌سازیم تا همه نمایش‌های رایج پوشش داده شوند.
 */

/** حذف اعراب و حروف بی‌اثر + یکسان‌سازی ی/ک عربی */
export function normalizePersianText(input: string): string {
  return input
    // حذف اعراب (فتحه، ضمه، کسره، تنوین، تشدید، سکون…)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    // ي عربی → ی فارسی
    .replace(/\u064A/g, "\u06CC")
    // ك عربی → ک فارسی
    .replace(/\u0643/g, "\u06A9")
    // هٔ / ة → ه
    .replace(/\u06C0/g, "\u0647")
    .replace(/\u0629/g, "\u0647")
    // حذف کاراکترهای کنترلی RTL/LTR mark
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "")
    .trim();
}

/**
 * همه معادل‌های قابل‌جستجوی یک کوئری:
 *  ۱. خود کوئری نرمال‌شده (بدون تغییر نیم‌فاصله‌ها)
 *  ۲. نیم‌فاصله → فاصله  («آب‌پز» → «آب پز»)
 *  ۳. نیم‌فاصله حذف      («آب‌پز» → «آبپز»)
 *  ۴. فاصله → نیم‌فاصله  («آب پز» → «آب‌پز»)
 * (نتیجه‌ها یکتا و خالی‌زدایی‌شده)
 */
export function persianSearchVariants(query: string): string[] {
  const base = normalizePersianText(query);
  if (!base) return [];
  const variants = new Set<string>([
    base,
    base.replace(/\u200C/g, " "), // نیم‌فاصله → فاصله
    base.replace(/\u200C/g, ""), // نیم‌فاصله حذف
    base.replace(/ /g, "\u200C"), // فاصله → نیم‌فاصله
  ]);
  return [...variants].filter((v) => v.length > 0);
}

/**
 * ساخت شرط Prisma `OR` برای جستجوی contains روی یک فیلد —
 * با همه معادل‌های نیم‌فاصله/فاصله/ی/ک.
 *
 * مثال:
 *   where.OR = persianContainsVariants("آب پز", "name");
 *   // → [{ name: { contains: "آب پز" } }, { name: { contains: "آب‌پز" } }, …]
 */
export function persianContainsVariants(
  query: string,
  field: string
): Record<string, { contains: string }>[] {
  return persianSearchVariants(query).map((v) => ({
    [field]: { contains: v },
  }));
}

/** فیلتر سمت کلاینت: مقایسه با نرمال‌سازی کامل (فاصله/نیم‌فاصله حذف می‌شوند) */
export function persianFuzzyIncludes(haystack: string, needle: string): boolean {
  const norm = (s: string) =>
    normalizePersianText(s).replace(/[\s\u200C]+/g, "");
  const h = norm(haystack);
  const n = norm(needle);
  return n.length > 0 && h.includes(n);
}
