"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Clock, Eye, Calendar, Share2, ChevronLeft, Sparkles, Dumbbell } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/fitness/types";
import { toWebp } from "@/lib/fitness/image-utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { NikaWidget } from "../nika-widget";
import { PreferredSourceCard } from "./preferred-source-card";
import { pushScreen, replaceScreen } from "@/lib/fitness/navigation";

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string;
  status: string;
  authorName: string;
  coverImage: string;
  views: number;
  readingMinutes: number;
  seoTitle?: string;
  seoDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  robots?: string;
  createdAt: string;
  updatedAt: string;
  // تاریخ انتشار واقعی — از API برمی‌گردد. null برای draftها.
  publishedAt?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  // فارسی
  "تمرین": "تمرین", "تغذیه": "تغذیه", "مکمل": "مکمل", "بازیابی": "بازیابی",
  "انگیزشی": "انگیزشی", "عمومی": "عمومی", "حرکات": "حرکات", "اخبار": "اخبار",
  "روش‌های-تمرینی": "روش‌های تمرینی", "اندازه‌گیری": "اندازه‌گیری", "ورزشکاران": "ورزشکاران", "آموزش-استروئیدها": "آموزش استروئیدها",
  // انگلیسی (backward compat)
  general: "عمومی", nutrition: "تغذیه", training: "تمرین", motivation: "انگیزشی", news: "اخبار",
  supplement: "مکمل", recovery: "بازیابی", exercises: "حرکات", "training-methods": "روش‌های تمرینی",
  metrics: "اندازه‌گیری", athletes: "ورزشکاران", "steroids-education": "آموزش استروئیدها",
};

const CATEGORY_COLORS: Record<string, string> = {
  // فارسی
  "عمومی": "bg-slate-100 text-slate-600",
  "تغذیه": "bg-emerald-100 text-emerald-700",
  "تمرین": "bg-orange-100 text-orange-700",
  "انگیزشی": "bg-purple-100 text-purple-700",
  "مکمل": "bg-amber-100 text-amber-700",
  "بازیابی": "bg-teal-100 text-teal-700",
  "حرکات": "bg-rose-100 text-rose-700",
  "اخبار": "bg-blue-100 text-blue-700",
  "روش‌های-تمرینی": "bg-indigo-100 text-indigo-700",
  "اندازه‌گیری": "bg-cyan-100 text-cyan-700",
  "ورزشکاران": "bg-pink-100 text-pink-700",
  "آموزش-استروئیدها": "bg-red-100 text-red-700",
  // انگلیسی (backward compat)
  general: "bg-slate-100 text-slate-600",
  nutrition: "bg-emerald-100 text-emerald-700",
  training: "bg-orange-100 text-orange-700",
  motivation: "bg-purple-100 text-purple-700",
  news: "bg-blue-100 text-blue-700",
  supplement: "bg-amber-100 text-amber-700",
  recovery: "bg-teal-100 text-teal-700",
  exercises: "bg-rose-100 text-rose-700",
};

/**
 * استخراج سؤالات و پاسخ‌های متداول از محتوای Markdown مقاله.
 *
 * این تابع به‌دنبال بخش «سوالات متداول» یا «پرسش‌های متداول» یا «FAQ»
 * (با هر سطح heading از # تا ##) می‌گردد. سپس تمام سؤالات H3 (### ...)
 * که بعد از آن بخش می‌آیند را به‌همراه پاسخشان (متن بین این H3 و H3 بعدی)
 * استخراج می‌کند. کاربرد: تولید JSON-LD FAQPage برای مقالات.
 *
 * اگر هیچ بخش FAQ پیدا نشد، آرایه خالی برمی‌گرداند.
 */
function extractFaqFromMarkdown(markdown: string): { question: string; answer: string }[] {
  if (!markdown) return [];

  // 1) پیدا کردن شروع بخش FAQ
  // الگوهای قابل قبول: «## سوالات متداول» یا «## پرسش‌های متداول» یا «## FAQ»
  // (با هر تعداد #)
  const faqHeaderRegex = /^(#{1,6})\s+(سوالات\s+متداول|پرسش(?:‌|\s)?های?\s+متداول|FAQ|سؤالات\s+متداول)\s*$/imu;
  const headerMatch = faqHeaderRegex.exec(markdown);
  if (!headerMatch) return [];

  // از پایان خط هدر به بعد را به‌عنوان بدنه FAQ در نظر می‌گیریم
  const faqBodyStart = headerMatch.index + headerMatch[0].length;
  let faqBody = markdown.slice(faqBodyStart);

  // 2) اگر بعد از بخش FAQ یک H2 دیگری شروع شد، آن را قطع کن
  const nextH2Match = /^#{1,2}\s+\S/m.exec(faqBody);
  if (nextH2Match) {
    faqBody = faqBody.slice(0, nextH2Match.index);
  }

  // 3) پیدا کردن همه سؤالات H3 (### ...)
  const questionRegex = /^###\s+(.+?)\s*$/gm;
  const items: { question: string; answer: string }[] = [];
  let qMatch: RegExpExecArray | null;
  const positions: { q: string; start: number; contentStart: number }[] = [];
  while ((qMatch = questionRegex.exec(faqBody)) !== null) {
    positions.push({
      q: qMatch[1].trim(),
      start: qMatch.index,
      contentStart: qMatch.index + qMatch[0].length,
    });
  }
  if (positions.length === 0) return [];

  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i];
    const next = positions[i + 1];
    const answerEnd = next ? next.start : faqBody.length;
    let answer = faqBody.slice(cur.contentStart, answerEnd).trim();
    // 4) پاک‌سازی ساده Markdown از پاسخ (لینک‌ها، تصاویر، bold/italic، کد)
    answer = answer
      // حذف تصاویر ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "$1")
      // تبدیل لینک‌ها [text](url) → text
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      // حذف bold/italic
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // حذف inline code
      .replace(/`([^`]+)`/g, "$1")
      // حذف code blocks
      .replace(/```[\s\S]*?```/g, "")
      // حذف heading markers باقی‌مانده
      .replace(/^#{1,6}\s+/gm, "")
      // حذف لیست مارکرها
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      // فشرده‌سازی whitespace و خطوط خالی
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    // حذف علامت‌های سؤال/کولن اضافی از ابتدای سؤال
    const question = cur.q.replace(/^[:：\-\s]+/, "").trim();
    if (question && answer) {
      items.push({ question, answer });
    }
  }
  return items;
}

export function ArticlePage() {
  const { articleSlug, user, setScreen, setArticleSlug } = useAppStore();
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [related, setRelated] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverError, setCoverError] = useState(false);
  const articleContentRef = useRef<HTMLDivElement | null>(null);
  // جلوگیری از fetch تکراری: وقتی slug از URL خوانده می‌شود و در store set
  // می‌شود، effect دوباره اجرا می‌شود — با این ref همان مقاله دو بار fetch نمی‌شود.
  const lastFetchedSlug = useRef<string | null>(null);

  // ─── Image error fallback for inline (markdown) images ───
  // وقتی تصویری در متن مقاله لود نمی‌شود (مثلاً فایل روی سرور موجود نیست)،
  // به‌جای نشان دادن آیکون تصویر شکسته، یک placeholder نمایش می‌دهیم.
  useEffect(() => {
    const container = articleContentRef.current;
    if (!container) return;
    const handleImgError = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (img.tagName !== "IMG") return;
      // اگر قبلاً جایگزین شده، دوباره نکن
      if (img.dataset.errored === "true") return;
      img.dataset.errored = "true";
      // یک div placeholder جایگزین کن
      const placeholder = document.createElement("div");
      placeholder.className = "my-4 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center h-48 text-orange-400 text-sm";
      placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
      img.style.display = "none";
      img.parentNode?.insertBefore(placeholder, img.nextSibling);
    };
    container.addEventListener("error", handleImgError, true);
    return () => container.removeEventListener("error", handleImgError, true);
  }, [article]);

  // Note: دکمه back در page.tsx هندل می‌شود (popstate handler مرکزی)

  useEffect(() => {
    // FIX: هنگام رفرش، store ممکن است هنوز articleSlug را set نکرده باشد.
    // پس اگر store خالی است، از URL (?article=slug) می‌خوانیم تا از redirect به articles جلوگیری شود.
    const slug = articleSlug || (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("article")
      : null);
    if (!slug) {
      setScreen("articles");
      return;
    }
    // اگر slug از URL آمد ولی در store نبود، آن را set کن
    if (!articleSlug && slug) {
      setArticleSlug(slug);
    }
    // جلوگیری از fetch تکراری برای همان slug (اجرای دوم effect بعد از setArticleSlug)
    if (lastFetchedSlug.current === slug) return;
    lastFetchedSlug.current = slug;
    setCoverError(false);
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/articles/${slug}`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data.article) {
          setArticle(data.article);
          // fetch related articles (same category)
          const relRes = await fetch(`/api/articles?pageSize=4&category=${data.article.category}`, { cache: "no-store" });
          const relData = await relRes.json();
          // FIX: فیلتر با slug محلی (از URL/props) — قبلاً articleSlug از store
          // در ورود مستقیم با ?article=slug هنوز null بود و خودِ مقاله در
          // «مقالات مرتبط» ظاهر می‌شد.
          setRelated((relData.articles || []).filter((a: ArticleData) => a.slug !== slug).slice(0, 3));
          // --- SEO: dynamically set meta tags ---
          const a = data.article;
          document.title = (a.seoTitle || a.title) + " | فیتاپ";
          setMetaTag("description", a.seoDescription || a.excerpt || "");
          setMetaTag("keywords", a.metaKeywords || a.tags || "");
          setMetaTag("robots", a.robots || "index,follow");
          // ─── canonical: اگر مقاله canonicalUrl دارد، از آن استفاده کن
          // در غیر این صورت، canonical پیش‌فرض: https://fittup.ir/?article=slug
          // این مشکل «Alternative page with proper canonical tag» را در گوگل حل می‌کند
          const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir").replace(/\/$/, "");
          const articleCanonical = a.canonicalUrl || `${siteUrl}/?article=${slug}`;
          setLinkTag("canonical", articleCanonical);
          // Open Graph
          setMetaProp("og:title", a.seoTitle || a.title);
          setMetaProp("og:description", a.seoDescription || a.excerpt || "");
          setMetaProp("og:type", "article");
          setMetaProp("og:image", a.ogImage || a.coverImage || "");
          setMetaProp("og:url", articleCanonical);
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
            publisher: {
              "@type": "Organization",
              name: "فیتاپ",
              logo: { "@type": "ImageObject", url: `${siteUrl}/fitup-logo.png` },
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": articleCanonical },
          });

          // ─── JSON-LD BreadcrumbList: همیشه برای همه مقالات (دستی و AI) ───
          // مسیر: خانه ← مقالات ← مقاله فعلی
          setJsonLd("article-breadcrumb", {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "خانه", item: `${siteUrl}/` },
              { "@type": "ListItem", position: 2, name: "مقالات", item: `${siteUrl}/?screen=articles` },
              { "@type": "ListItem", position: 3, name: a.title, item: articleCanonical },
            ],
          });

          // ─── JSON-LD FAQPage: استخراج سؤالات H3 از بخش سوالات متداول ───
          // AI مقاله‌ها را با ساختار H3 برای سؤالات FAQ تولید می‌کند. این parser
          // آن سؤالات و پاسخ‌هایشان را از متن Markdown استخراج می‌کند.
          const faqItems = extractFaqFromMarkdown(a.content || "");
          if (faqItems.length > 0) {
            setJsonLd("article-faq", {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqItems.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: { "@type": "Answer", text: item.answer },
              })),
            });
          } else {
            // اگر FAQ یافت نشد، schema قبلی را پاک کن (در صورت وجود)
            const oldFaq = document.getElementById("article-faq");
            if (oldFaq) oldFaq.remove();
          }
        } else {
          toast.error("مقاله یافت نشد");
          setScreen("articles");
        }
      } catch {
        toast.error("خطا در بارگذاری مقاله");
        setScreen("articles");
      } finally {
        setLoading(false);
      }
    })();
    // scroll to top on article change
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleSlug]);

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
  // Helper: set link tag (canonical)
  function setLinkTag(rel: string, href: string) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
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

  function goBack() {
    // پاک کردن JSON-LD و meta tags مقاله قبل از خروج
    const schemaEl = document.getElementById("article-schema");
    if (schemaEl) schemaEl.remove();
    const breadcrumbEl = document.getElementById("article-breadcrumb");
    if (breadcrumbEl) breadcrumbEl.remove();
    const faqEl = document.getElementById("article-faq");
    if (faqEl) faqEl.remove();
    setArticleSlug(null);
    setScreen("articles");
    replaceScreen("articles");
  }

  function openArticle(slug: string) {
    setArticleSlug(slug);
    setScreen("article");
    pushScreen("article", { article: slug });
  }

  function shareArticle() {
    if (!article) return;
    const url = `${window.location.origin}/?article=${article.slug}`;
    if (navigator.share) {
      navigator.share({ title: article.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("لینک مقاله کپی شد ✓");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <ArticleTopNav onBack={goBack} />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 rounded-xl mb-4" />
          <Skeleton className="h-64 rounded-2xl mb-6" />
          <Skeleton className="h-4 rounded mb-3" />
          <Skeleton className="h-4 rounded mb-3" />
          <Skeleton className="h-4 rounded mb-3" />
        </div>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="min-h-screen bg-white">
      <ArticleTopNav onBack={goBack} />

      <article className="max-w-3xl mx-auto px-4 py-6">
        {/* Category + meta */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className={`text-[11px] px-3 py-1 rounded-full font-bold ${CATEGORY_COLORS[article.category] || CATEGORY_COLORS["عمومی"] || CATEGORY_COLORS.general}`}>
            {CATEGORY_LABELS[article.category] || article.category}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(article.publishedAt || article.createdAt).toLocaleDateString("fa-IR")}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            {toPersianDigits(article.readingMinutes || 3)} دقیقه مطالعه
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Eye className="w-3.5 h-3.5" />
            {toPersianDigits(article.views)} بازدید
          </span>
        </div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-black text-slate-900 mb-3 leading-tight"
        >
          {article.title}
        </motion.h1>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-base text-slate-600 mb-6 leading-relaxed">{article.excerpt}</p>
        )}

        {/* Cover image — با fallback در صورت شکست لود تصویر */}
        {article.coverImage && !coverError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl overflow-hidden mb-6 shadow-lg bg-orange-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={toWebp(article.coverImage)}
              alt={article.title}
              width={1200}
              height={675}
              className="w-full aspect-[16/9] object-cover"
              fetchPriority="high"
              onError={() => setCoverError(true)}
            />
          </motion.div>
        )}
        {article.coverImage && coverError && (
          <div className="rounded-2xl overflow-hidden mb-6 shadow-lg aspect-[16/9] bg-gradient-to-br from-orange-100 via-amber-100 to-orange-50 flex items-center justify-center">
            <Dumbbell className="w-16 h-16 text-orange-300" />
          </div>
        )}

        {/* Author + share */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50/50 border border-orange-100 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
              {article.authorName?.charAt(0) || "ف"}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">{article.authorName}</p>
              <p className="text-[10px] text-slate-500">نویسنده فیتاپ</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={shareArticle} className="rounded-xl gap-1.5 text-xs">
            <Share2 className="w-4 h-4" />
            اشتراک‌گذاری
          </Button>
        </div>

        {/* Content — internal links can't be overridden as components in react-markdown v10 (breaks tables), so we use event delegation on the article element */}
        <div ref={articleContentRef} className="prose prose-slate max-w-none article-content fitup-article">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Note: h1, img, a are NOT overridden — in react-markdown v10, these break table parsing.
              // They are styled via CSS (.fitup-article h1/img/a)
              h2: ({ node, ...p }) => <h2 className="text-xl font-black text-slate-900 mt-7 mb-3" {...p} />,
              h3: ({ node, ...p }) => <h3 className="text-lg font-bold text-slate-900 mt-6 mb-2" {...p} />,
              // ─── جدول‌ها در یک wrapper اسکرول‌پذیر قرار می‌گیرند ───
              // این مشکل «جدول بزرگ از کادر بیرون می‌زند» را در موبایل حل می‌کند.
              // جدول به‌جای شکستن layout کل صفحه، به‌صورت افقی اسکرول می‌شود.
              table: ({ node, ...p }) => (
                <div
                  dir="rtl"
                  style={{
                    overflowX: "auto",
                    margin: "1.5rem 0",
                    WebkitOverflowScrolling: "touch",
                    msOverflowStyle: "none",
                    scrollbarWidth: "thin",
                  }}
                  className="fitup-table-wrapper"
                >
                  <table dir="rtl" className="w-full text-sm" {...p} />
                </div>
              ),
              th: ({ node, ...p }) => <th dir="rtl" className="border border-slate-300 px-3 py-2.5 text-right font-bold text-slate-800 bg-orange-50 whitespace-nowrap" {...p} />,
              td: ({ node, ...p }) => <td dir="rtl" className="border border-slate-300 px-3 py-2.5 text-slate-700 text-right" {...p} />,
            }}
          >
            {/* Pre-process content: convert /article/slug links to ?article=slug (works with default navigation, doesn't break tables) */}
            {article.content.replace(/\/article\/([a-z0-9-]+)/g, "/?article=$1")}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {article.tags && (
          <div className="flex items-center gap-2 flex-wrap mt-8 pt-6 border-t border-slate-100">
            <span className="text-xs text-slate-400">تگ‌ها:</span>
            {article.tags.split(",").map((t, i) => (
              <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">#{t.trim()}</span>
            ))}
          </div>
        )}

        {/* بج Preferred Source گوگل — جایگاه ثابت در انتهای همه مقالات */}
        <PreferredSourceCard />

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 p-6 rounded-2xl text-center text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <Sparkles className="w-8 h-8 mx-auto mb-2" />
          <h3 className="text-xl font-black mb-1">آماده‌ای شروع کنی؟</h3>
          <p className="text-sm text-white/90 mb-4">برنامه تمرینی و غذایی اختصاصی خودت را با فیتاپ هوشمند بساز</p>
          <Button
            onClick={() =>
              // FIX: کاربرِ واردشده نباید به صفحه ورود (OTP) برود — مستقیم به پنل
              setScreen(user ? (user.role === "ADMIN" ? "admin" : "main") : "auth")
            }
            className="bg-white text-orange-600 hover:bg-white/90 rounded-xl font-bold"
          >
            شروع رایگان
          </Button>
        </motion.div>

        {/* Related articles */}
        {related.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              مقالات مرتبط
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openArticle(r.slug)}
                  className="text-right group"
                >
                  <Card className="overflow-hidden border-2 border-orange-100 hover:border-orange-300 transition-all hover:shadow-lg">
                    {r.coverImage ? (
                      <div className="aspect-[16/9] overflow-hidden relative bg-orange-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={toWebp(r.coverImage)}
                          alt={r.title}
                          width={280}
                          height={158}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.style.display = "none";
                            const parent = img.parentElement;
                            if (parent && !parent.querySelector(".img-fallback")) {
                              const fb = document.createElement("div");
                              fb.className = "img-fallback absolute inset-0 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center";
                              fb.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="1.5"><path d="M6.5 6.5h11v11h-11z"/><circle cx="9" cy="9" r="1.5"/><path d="m14.5 14.5-2-2"/></svg>';
                              parent.appendChild(fb);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/9] bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-orange-300" />
                      </div>
                    )}
                    <div className="p-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${CATEGORY_COLORS[r.category]}`}>{CATEGORY_LABELS[r.category]}</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-1.5 line-clamp-2 group-hover:text-orange-600 transition">{r.title}</h4>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}
      </article>

      <NikaWidget />
    </div>
  );
}

function ArticleTopNav({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 transition">
          <ChevronLeft className="w-4 h-4" />
          بازگشت به مقالات
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <span className="font-black text-sm text-slate-900">مجله فیتاپ</span>
        </div>
      </div>
    </header>
  );
}
