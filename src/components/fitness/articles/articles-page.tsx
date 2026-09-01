"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Calendar, Clock, Eye, ArrowLeft, Sparkles, TrendingUp } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/fitness/types";
import { toWebp } from "@/lib/fitness/image-utils";
import { NikaWidget } from "../nika-widget";
import { pushScreen, replaceScreen } from "@/lib/fitness/navigation";

interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string;
  status: string;
  authorName: string;
  coverImage: string;
  views: number;
  createdAt: string;
  // تاریخ انتشار واقعی — از API برمی‌گردد.
  publishedAt?: string | null;
}

// دسته‌بندی‌های مقالات — هم انگلیسی (مقالات قدیمی) و هم فارسی (مقالات جدید)
// فیلتر روی هر دو نوع کار می‌کند.
const CATEGORIES = [
  { value: "", label: "همه" },
  { value: "تمرین", label: "تمرین" },
  { value: "تغذیه", label: "تغذیه" },
  { value: "مکمل", label: "مکمل" },
  { value: "بازیابی", label: "بازیابی" },
  { value: "انگیزشی", label: "انگیزشی" },
  { value: "عمومی", label: "عمومی" },
  { value: "حرکات", label: "حرکات" },
  { value: "اخبار", label: "اخبار" },
];

// نقشه value → label برای استفاده در عنوان صفحه و canonical
// شامل هم کلیدهای فارسی و هم انگلیسی (مقالات قدیمی)
const CATEGORY_LABELS: Record<string, string> = {
  // فارسی
  "تمرین": "تمرین", "تغذیه": "تغذیه", "مکمل": "مکمل", "بازیابی": "بازیابی",
  "انگیزشی": "انگیزشی", "عمومی": "عمومی", "حرکات": "حرکات", "اخبار": "اخبار",
  "روش‌های-تمرینی": "روش‌های تمرینی", "اندازه‌گیری": "اندازه‌گیری", "ورزشکاران": "ورزشکاران", "آموزش-استروئیدها": "آموزش استروئیدها",
  // انگلیسی (backward compat)
  training: "تمرین", nutrition: "تغذیه", motivation: "انگیزشی", general: "عمومی", news: "اخبار",
  supplement: "مکمل", recovery: "بازیابی", exercises: "حرکات", "training-methods": "روش‌های تمرینی",
  metrics: "اندازه‌گیری", athletes: "ورزشکاران", "steroids-education": "آموزش استروئیدها",
};

// گروه معادل‌های هر دسته (فارسی + انگلیسی) بر اساس لیبل مشترک در CATEGORY_LABELS
// مثال: «تمرین» ← ["تمرین", "training"] — چون مقالات قدیمی با دسته انگلیسی و مقالات
// جدید با دسته فارسی ذخیره می‌شوند، فیلتر هر دو معادل را fetch و merge می‌کند.
const CATEGORY_ALIASES: Record<string, string[]> = (() => {
  const groups: Record<string, string[]> = {};
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    if (!groups[label]) groups[label] = [];
    if (!groups[label].includes(key)) groups[label].push(key);
  }
  return groups;
})();

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

export function ArticlesPage() {
  const { setScreen, setArticleSlug } = useAppStore();
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // FIX: جستجوی debounced — قبلاً هر کلید یک fetch فوری می‌زد؛ حالا ۳۰۰ms
  // بعد از آخرین تایپ فقط یک fetch انجام می‌شود.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // URL را برای articles تنظیم کن (برای refresh)
  useEffect(() => {
    replaceScreen("articles");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── SEO ───
  // مهم: canonical باید شامل category باشد تا Google صفحات دسته‌بندی مختلف
  // را به‌عنوان صفحات مجزا تشخیص دهد (نه duplicate).
  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    // اگر category انتخاب شده، canonical آن را شامل شود
    const pageUrl = category
      ? `${siteUrl}/?screen=articles&category=${encodeURIComponent(category)}`
      : `${siteUrl}/?screen=articles`;
    const title = category
      ? `${CATEGORY_LABELS[category] || "مقالات"} — مقالات بدنسازی و تناسب اندام | فیتاپ`
      : "مقالات بدنسازی و تناسب اندام | فیتاپ";
    const description =
      "مقالات تخصصی بدنسازی، تغذیه، چربی‌سوزی، عضله‌سازی و مکمل‌های ورزشی به زبان فارسی. جامع‌ترین مرجع برنامه بدنسازی، رژیم غذایی و تناسب اندام — توسط مربیان هوشمند فیتاپ.";
    const keywords =
      "مقالات بدنسازی، مقالات تناسب اندام، مقالات ورزشی، مقالات تغذیه، مقالات عضله‌سازی، مقالات چربی‌سوزی، مقالات رژیم غذایی، مجله فیتاپ";
    const ogImage = `${siteUrl}/fitup-logo.png`;

    document.title = title;
    setMetaTag("description", description);
    setMetaTag("keywords", keywords);
    setMetaTag("robots", "index,follow");
    setLinkTag("canonical", pageUrl);

    setMetaProp("og:title", title);
    setMetaProp("og:description", description);
    setMetaProp("og:type", "website");
    setMetaProp("og:locale", "fa_IR");
    setMetaProp("og:url", pageUrl);
    setMetaProp("og:image", ogImage);
    setMetaProp("og:site_name", "فیتاپ");

    setMetaProp("twitter:card", "summary_large_image");
    setMetaProp("twitter:title", title);
    setMetaProp("twitter:description", description);
    setMetaProp("twitter:image", ogImage);

    // BreadcrumbList schema
    setJsonLd("breadcrumb-schema", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "فیتاپ", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "مقالات", item: pageUrl },
      ],
    });

    // ItemList schema — اطلاعات پایه لیست مقالات (آیتم‌ها بعد از fetch اضافه می‌شوند)
    setJsonLd("itemlist-schema", {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "مقالات فیتاپ",
      description: "مقالات تخصصی بدنسازی، تغذیه و تناسب اندام",
      url: pageUrl,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
    });

    return () => {
      ["breadcrumb-schema", "itemlist-schema"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      document.title =
        "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه با AI";
    };
  }, [category]); // ← canonical و title باید وقتی category عوض می‌شود به‌روزرسانی شوند

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const PAGE_SIZE = 12;
        const buildParams = (cat: string, pg: number, ps: string) => {
          const params = new URLSearchParams({ pageSize: ps, page: String(pg) });
          if (cat) params.set("category", cat);
          if (debouncedSearch) params.set("search", debouncedSearch);
          return params;
        };
        // معادل‌های فارسی/انگلیسی دسته انتخاب‌شده — API با تطابق دقیق فیلتر می‌کند،
        // پس هر دو معادل باید fetch شوند تا مقالات قدیمی (انگلیسی) و جدید (فارسی)
        // هر دو در نتیجه فیلتر بیایند.
        const aliases = category ? CATEGORY_ALIASES[category] || [category] : [];
        if (aliases.length <= 1) {
          // «همه» یا دسته تک‌معادل — صفحه‌بندی سمت سرور (مثل قبل)
          const res = await fetch(`/api/articles?${buildParams(aliases[0] || "", page, String(PAGE_SIZE))}`, { cache: "no-store" });
          const data = await res.json();
          setArticles(data.articles || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
          // آپدیت ItemList با مقالات fetch شده (برای سئوی بهتر)
          updateItemListSchema(data.articles || []);
        } else {
          // دسته + معادل انگلیسی آن — دو fetch موازی، merge و صفحه‌بندی سمت کلاینت
          const responses = await Promise.allSettled(
            aliases.map((c) =>
              fetch(`/api/articles?${buildParams(c, 1, "100")}`, { cache: "no-store" }).then((r) => r.json())
            )
          );
          const seen = new Set<string>();
          const merged: ArticleListItem[] = [];
          for (const r of responses) {
            if (r.status !== "fulfilled" || !r.value?.articles) continue;
            for (const a of r.value.articles as ArticleListItem[]) {
              if (seen.has(a.id)) continue;
              seen.add(a.id);
              merged.push(a);
            }
          }
          // مرتب‌سازی مثل سرور: publishedAt نزولی، سپس createdAt نزولی
          merged.sort((a, b) => {
            const ta = new Date(a.publishedAt || a.createdAt).getTime();
            const tb = new Date(b.publishedAt || b.createdAt).getTime();
            if (tb !== ta) return tb - ta;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          const total = merged.length;
          const pageItems = merged.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
          setArticles(pageItems);
          setTotal(total);
          setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
          updateItemListSchema(pageItems);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [debouncedSearch, category, page]);

  function openArticle(slug: string) {
    setArticleSlug(slug);
    setScreen("article");
    pushScreen("article", { article: slug });
  }

  function goHome() {
    setScreen("landing");
    replaceScreen("landing");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={goHome} className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 transition">
            <ArrowLeft className="w-4 h-4" />
            صفحه اصلی
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

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-orange-100">
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-orange-100 blur-3xl opacity-50" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-amber-100 blur-3xl opacity-50" />
        <div className="max-w-5xl mx-auto px-4 py-10 relative">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-orange-100 text-orange-600 font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              مجله تخصصی فیتاپ
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
              مقالات تخصصی <span style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>بدنسازی و تغذیه</span>
            </h1>
            <p className="text-sm text-slate-500 max-w-xl mx-auto">
              جامع‌ترین مرجع برنامه بدنسازی، برنامه تغذیه، مکمل‌های ورزشی و کاهش وزن به زبان فارسی — توسط مربیان هوشمند فیتاپ
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="جستجو در مقالات..."
              className="pr-10 rounded-xl"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => { setCategory(c.value); setPage(1); }}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${
                  category === c.value
                    ? "text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                style={category === c.value ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-slate-500 mb-4 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          {toPersianDigits(total)} مقاله یافت شد
        </div>

        {/* Articles grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500">مقاله‌ای یافت نشد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((a, i) => (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openArticle(a.slug)}
                className="text-right group"
              >
                <Card className="overflow-hidden border-2 border-slate-100 hover:border-orange-300 transition-all hover:shadow-xl h-full flex flex-col">
                  {a.coverImage ? (
                    <div className="aspect-[16/9] overflow-hidden relative bg-orange-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={toWebp(a.coverImage)}
                        alt={a.title}
                        width={336}
                        height={189}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.style.display = "none";
                          const parent = img.parentElement;
                          if (parent && !parent.querySelector(".img-fallback")) {
                            const fb = document.createElement("div");
                            fb.className = "img-fallback absolute inset-0 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center";
                            fb.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="1.5"><path d="M6.5 6.5h11v11h-11z"/><circle cx="9" cy="9" r="1.5"/><path d="m14.5 14.5-2-2"/></svg>';
                            parent.appendChild(fb);
                          }
                        }}
                      />
                      <span className={`absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full font-bold ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS.general}`}>
                        {CATEGORY_LABELS[a.category] || a.category}
                      </span>
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center relative">
                      <Sparkles className="w-10 h-10 text-orange-300" />
                      <span className={`absolute top-2 right-2 text-[10px] px-2 py-1 rounded-full font-bold ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS.general}`}>
                        {CATEGORY_LABELS[a.category] || a.category}
                      </span>
                    </div>
                  )}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 flex-1">{a.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-50">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(a.publishedAt || a.createdAt).toLocaleDateString("fa-IR")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {toPersianDigits(a.views)}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl"
            >
              قبلی
            </Button>
            <span className="text-sm text-slate-600 px-3">
              {toPersianDigits(page)} از {toPersianDigits(totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl"
            >
              بعدی
            </Button>
          </div>
        )}
      </div>

      <NikaWidget />
    </div>
  );
}

// ─── SEO helper functions ───
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

function setLinkTag(rel: string, href: string) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

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

// آپدیت ItemList schema با مقالات fetch شده (به‌صورت داینامیک)
function updateItemListSchema(articles: ArticleListItem[]) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
  const pageUrl = `${siteUrl}/?screen=articles`;
  setJsonLd("itemlist-schema", {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "مقالات فیتاپ",
    description: "مقالات تخصصی بدنسازی، تغذیه و تناسب اندام",
    url: pageUrl,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: articles.length,
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: a.title,
      url: `${siteUrl}/?article=${a.slug}`,
    })),
  });
}
