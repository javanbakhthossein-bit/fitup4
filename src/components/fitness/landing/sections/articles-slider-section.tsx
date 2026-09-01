"use client";

import { useEffect, useState, useRef } from "react";
import { Sparkles, ChevronLeft, ChevronRight, ArrowLeft, Calendar, Eye } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/fitness/types";
import { toWebp } from "@/lib/fitness/image-utils";
import { pushScreen } from "@/lib/fitness/navigation";

interface ArticleCard {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  coverImage: string;
  views: number;
  createdAt: string;
  // تاریخ انتشار واقعی — از API برمی‌گردد.
  publishedAt?: string | null;
}

// نقشه دسته‌بندی → برچسب فارسی — هم کلیدهای فارسی و هم انگلیسی
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

export function ArticlesSliderSection() {
  const { setScreen, setArticleSlug } = useAppStore();
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  // Lazy fetch — فقط وقتی کاربر به این بخش اسکرول کرد، articles لود شوند
  useEffect(() => {
    if (!sectionRef.current || fetchedRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true;
          (async () => {
            try {
              const res = await fetch("/api/articles?pageSize=10", { cache: "no-store" });
              const data = await res.json();
              setArticles(data.articles || []);
            } catch {} finally { setLoading(false); }
          })();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  function openArticle(slug: string) {
    setArticleSlug(slug);
    setScreen("article");
    pushScreen("article", { article: slug });
  }

  // در RTL: دکمه چپ (ChevronLeft) = بعدی، دکمه راست (ChevronRight) = قبلی
  // scrollBy با مقدار مثبت به راست می‌رود (قبلی در RTL)
  // scrollBy با مقدار منفی به چپ می‌رود (بعدی در RTL)
  function scrollNext() {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: -340, behavior: "smooth" });
  }

  function scrollPrev() {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: 340, behavior: "smooth" });
  }

  // wrapper div با id="articles" — همیشه در DOM وجود دارد
  // این باعث می‌شود دکمه «مقالات» در منو همیشه کار کند
  return (
    <div id="articles" ref={sectionRef} className="scroll-mt-16">
    {loading ? (
      <section className="py-16 bg-gradient-to-b from-white to-orange-50/30">
        <div className="max-w-6xl mx-auto px-4">
          <Skeleton className="h-8 w-48 rounded-xl mx-auto mb-8" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-72 w-72 rounded-2xl shrink-0" />
            ))}
          </div>
        </div>
      </section>
    ) : articles.length === 0 ? null : (
    <section className="py-20 bg-gradient-to-b from-white to-orange-50/30 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-orange-100/40 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-amber-100/40 blur-3xl" />

      <div className="max-w-6xl mx-auto px-4 relative">
        {/* Header + Controls در یک ردیف */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div
              className="animate-fade-in-up inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-orange-100 text-orange-600 font-bold mb-3"
            >
              <Sparkles className="w-3.5 h-3.5" />
              مجله تخصصی فیتاپ
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-1">
              مقالات کلیدی{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                بدنسازی و تغذیه
              </span>
            </h2>
          </div>

          {/* دکمه‌های اسکرول — کنار هدر، فقط دسکتاپ */}
          <div className="hidden md:flex items-center gap-2 shrink-0 pb-1">
            <button
              onClick={scrollPrev}
              className="w-10 h-10 rounded-full bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-400 transition flex items-center justify-center shadow-sm"
              aria-label="قبلی"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={scrollNext}
              className="w-10 h-10 rounded-full bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-400 transition flex items-center justify-center shadow-sm"
              aria-label="بعدی"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slider — اسکرول افقی در همه دستگاه‌ها */}
        <div
          ref={scrollRef}
          className="flex gap-5 pb-4 -mx-4 px-4 overflow-x-auto no-scrollbar"
          style={{ scrollbarWidth: "none", touchAction: "pan-x pan-y" }}
        >
          {articles.map((a, i) => (
            <div
              key={a.id}
              className="shrink-0 w-[85vw] max-w-[340px]"
            >
              <button
                onClick={() => openArticle(a.slug)}
                className="text-right w-full group"
              >
                <Card className="overflow-hidden border-2 border-orange-100 hover:border-orange-300 transition-all hover:shadow-xl h-full bg-white">
                  {/* Cover image */}
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
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

                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition text-sm leading-6 min-h-[3rem]">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-5">{a.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-50">
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
              </button>
            </div>
          ))}
        </div>

        {/* See all button */}
        <div className="text-center mt-8">
          <Button
            onClick={() => { setScreen("articles"); pushScreen("articles"); }}
            className="rounded-xl text-white gap-2"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            مشاهده همه مقالات
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
    )}
    </div>
  );
}
