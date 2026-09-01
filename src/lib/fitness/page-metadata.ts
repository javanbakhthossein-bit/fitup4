/**
 * Page Metadata Manager
 *
 * مدیریت یکپارچه title و meta tags و URL هنگام navigation بین صفحات.
 *
 * مشکل: وقتی کاربر از صفحه مقاله به صفحه مقالات برمی‌گردد، title و URL
 * هنوز روی مقاله باقی می‌ماند و refresh صفحه مقاله را دوباره بارگذاری می‌کند.
 *
 * راه‌حل: 
 *  - resetPageMetadata(): بازگشت title و meta tags به حالت پیش‌فرض
 *  - cleanArticleUrl(): حذف ?article=slug از URL
 *  - setArticleMetaTags(): تنظیم meta tags مخصوص مقاله
 *  - pushArticleUrl(): اضافه کردن ?article=slug به URL
 */

const DEFAULT_TITLE = "برنامه بدنسازی هوشمند | فیتاپ — برنامه تمرینی و تغذیه با AI";

/**
 * بازگشت title و meta tags به حالت پیش‌فرض سایت
 * این تابع باید هنگام خروج از صفحه مقاله صدا زده شود.
 */
export function resetPageMetadata(): void {
  if (typeof document === "undefined") return;

  // Reset title
  document.title = DEFAULT_TITLE;

  // Remove article-specific meta tags (by property)
  const propsToRemove = [
    "og:title",
    "og:description",
    "og:type",
    "og:image",
    "og:url",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
  ];
  for (const prop of propsToRemove) {
    const el = document.querySelector(`meta[property="${prop}"]`);
    if (el && el.id !== "default-og") el.remove();
  }

  // Reset description meta to default (remove if it was set by article)
  const descEl = document.querySelector('meta[name="description"]');
  if (descEl) {
    descEl.setAttribute(
      "content",
      "برنامه بدنسازی هوشمند با فیتاپ — برنامه تمرینی و غذایی شخصی‌سازی‌شده با هوش مصنوعی، برنامه تغذیه و مکمل، چت هوشمند ورزشی، آنالیز ویدیویی و آزمایش خون."
    );
  }

  // Remove article keywords override (let the default ones from layout.tsx stay)
  const kwEl = document.querySelector('meta[name="keywords"][data-article="true"]');
  if (kwEl) kwEl.remove();

  // Remove article canonical (let the default from layout.tsx stay)
  const canonicalEl = document.querySelector('link[rel="canonical"][data-article="true"]');
  if (canonicalEl) canonicalEl.remove();

  // Remove article JSON-LD schema (همه schema‌های مخصوص مقاله)
  const schemaIds = ["article-schema", "article-breadcrumb", "article-faq"];
  for (const id of schemaIds) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
}

/**
 * حذف پارامتر ?article=slug از URL
 * این تابع باید هنگام خروج از صفحه مقاله صدا زده شود تا refresh
 * صفحه مقالات را بارگذاری کند نه مقاله را.
 */
export function cleanArticleUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  if (url.searchParams.has("article")) {
    url.searchParams.delete("article");
    changed = true;
  }
  if (changed) {
    window.history.replaceState({}, "", url.toString());
  }
}

/**
 * حذف پارامتر ?tool=xxx از URL
 */
export function cleanToolUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.has("tool")) {
    url.searchParams.delete("tool");
    window.history.replaceState({}, "", url.toString());
  }
}

/**
 * حذف پارامتر ?screen=xxx از URL
 */
export function cleanScreenUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.has("screen")) {
    url.searchParams.delete("screen");
    window.history.replaceState({}, "", url.toString());
  }
}

/**
 * حذف تمام پارامترهای ناوبری (article, tool, screen, tab) از URL
 * این تابع باید هنگام بازگشت به صفحه اصلی صدا زده شود.
 */
export function cleanAllNavParams(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const param of ["article", "tool", "screen", "tab"]) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, "", url.toString());
  }
}

/**
 * اضافه کردن ?article=slug به URL
 * این تابع باید هنگام باز کردن مقاله صدا زده شود.
 */
export function pushArticleUrl(slug: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("article", slug);
  window.history.pushState({ articlePage: true }, "", url.toString());
}

/**
 * تنظیم title و meta tags مخصوص مقاله
 */
export function setArticleMetaTags(article: {
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  excerpt?: string;
  metaKeywords?: string;
  tags?: string;
  canonicalUrl?: string;
  ogImage?: string;
  coverImage?: string;
  robots?: string;
  createdAt?: string;
  updatedAt?: string;
  // تاریخ انتشار واقعی — اگر موجود باشد، برای JSON-LD datePublished استفاده می‌شود.
  publishedAt?: string | null;
  authorName?: string;
}): void {
  if (typeof document === "undefined") return;

  const a = article;
  const newTitle = (a.seoTitle || a.title) + " | فیتاپ";
  document.title = newTitle;
  // Ensure title persists — Next.js may re-apply default title during re-renders
  setTimeout(() => { document.title = newTitle; }, 50);
  setTimeout(() => { document.title = newTitle; }, 200);

  // Description
  setMetaTag("description", a.seoDescription || a.excerpt || "");

  // Keywords (mark as article-specific so we can remove it later)
  const kwEl = document.querySelector('meta[name="keywords"]');
  if (kwEl) {
    kwEl.setAttribute("content", a.metaKeywords || a.tags || "");
    kwEl.setAttribute("data-article", "true");
  } else {
    const newKw = document.createElement("meta");
    newKw.setAttribute("name", "keywords");
    newKw.setAttribute("content", a.metaKeywords || a.tags || "");
    newKw.setAttribute("data-article", "true");
    document.head.appendChild(newKw);
  }

  // Robots
  setMetaTag("robots", a.robots || "index,follow");

  // Canonical (mark as article-specific)
  if (a.canonicalUrl) {
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement("link");
      canonicalEl.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute("href", a.canonicalUrl);
    canonicalEl.setAttribute("data-article", "true");
  }

  // Open Graph
  setMetaProp("og:title", a.seoTitle || a.title);
  setMetaProp("og:description", a.seoDescription || a.excerpt || "");
  setMetaProp("og:type", "article");
  setMetaProp("og:image", a.ogImage || a.coverImage || "");

  // Twitter Card
  setMetaProp("twitter:card", "summary_large_image");
  setMetaProp("twitter:title", a.seoTitle || a.title);
  setMetaProp("twitter:description", a.seoDescription || a.excerpt || "");
  setMetaProp("twitter:image", a.ogImage || a.coverImage || "");

  // JSON-LD Article schema
  setJsonLd("article-schema", {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.seoDescription || a.excerpt || "",
    image: a.ogImage || a.coverImage || "",
    datePublished: a.publishedAt || a.createdAt,
    dateModified: a.updatedAt,
    author: { "@type": "Organization", name: a.authorName || "فیتاپ" },
    publisher: { "@type": "Organization", name: "فیتاپ" },
  });
}

// Helper: set meta tag by name
function setMetaTag(name: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Helper: set meta tag by property (og:*, twitter:*)
function setMetaProp(prop: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${prop}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", prop);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Helper: set JSON-LD structured data
function setJsonLd(id: string, data: any) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}
