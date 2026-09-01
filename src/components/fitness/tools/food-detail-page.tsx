"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Apple,
  ChevronLeft,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Share2,
  Search,
  SearchX,
  Leaf,
  Scale,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { toPersianDigits } from "@/lib/fitness/types";
import { pushScreen, replaceScreen } from "@/lib/fitness/navigation";
import { toast } from "sonner";
import { NikaWidget } from "@/components/fitness/nika-widget";
import { CtaSection } from "./cta-section";

interface Food {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  imageUrl: string;
  isVegan: boolean;
}

interface RelatedFood {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  isVegan: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  breakfast: "صبحانه",
  lunch: "ناهار",
  dinner: "شام",
  snack: "میان‌وعده",
};

export function FoodDetailPage() {
  const { foodId, setFoodId, setScreen } = useAppStore();
  const [food, setFood] = useState<Food | null>(null);
  const [related, setRelated] = useState<RelatedFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Detect ID from URL on initial mount (so refresh + deep-link works)
  useEffect(() => {
    if (!foodId) {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get("food");
      if (urlId) {
        setFoodId(urlId);
        return;
      }
      // no food id → back to food calorie index
      setScreen("tool-foods");
      replaceScreen("tool-foods", { tool: "foods" });
      return;
    }
  }, []);

  useEffect(() => {
    if (!foodId) return;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const res = await fetch(`/api/foods/${encodeURIComponent(foodId)}`);
        const data = await res.json();
        if (res.ok && data.food) {
          setFood(data.food);
          setRelated(data.related || []);
          applySeo(data.food as Food);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [foodId]);

  function applySeo(f: Food) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    const foodUrl = `${siteUrl}/?food=${f.id}`;
    const desc = `کالری ${f.name} ${toPersianDigits(f.calories)} کالری در هر وعده. پروتئین ${toPersianDigits(f.protein)}گ، کربوهیدرات ${toPersianDigits(f.carbs)}گ، چربی ${toPersianDigits(f.fat)}گ`;
    const ogImage = f.imageUrl || `${siteUrl}/fitup-logo.png`;

    document.title = `کالری ${f.name} - مقدار کالری و درشت‌مغذی‌ها | فیتاپ`;
    setMetaTag("description", desc);
    setMetaTag(
      "keywords",
      `کالری ${f.name}, ارزش غذایی ${f.name}, ${f.name}, پروتئین, کربوهیدرات, چربی, رژیم غذایی, فیتاپ`
    );
    setMetaTag("robots", "index,follow");

    // ─── Canonical ───
    setLinkTag("canonical", foodUrl);

    // Open Graph
    setMetaProp("og:title", `کالری ${f.name} - مقدار کالری و درشت‌مغذی‌ها | فیتاپ`);
    setMetaProp("og:description", desc);
    setMetaProp("og:type", "article");
    setMetaProp("og:locale", "fa_IR");
    setMetaProp("og:url", foodUrl);
    setMetaProp("og:image", ogImage);
    setMetaProp("og:site_name", "فیتاپ");

    // Twitter
    setMetaProp("twitter:card", "summary_large_image");
    setMetaProp("twitter:title", `کالری ${f.name} | فیتاپ`);
    setMetaProp("twitter:description", desc);
    setMetaProp("twitter:image", ogImage);

    // ─── BreadcrumbList schema ───
    setJsonLd("breadcrumb-schema", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "فیتاپ", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "جدول کالری غذاها", item: `${siteUrl}/?tool=foods` },
        { "@type": "ListItem", position: 3, name: f.name, item: foodUrl },
      ],
    });

    // JSON-LD: NutritionInformation
    setJsonLd("nutrition-schema", {
      "@context": "https://schema.org",
      "@type": "NutritionInformation",
      name: `ارزش غذایی ${f.name}`,
      description: desc,
      servingSize: f.servingSize || "۱ وعده",
      calories: {
        "@type": "Energy",
        value: f.calories,
        unit: "kcal",
      },
      proteinContent: {
        "@type": "Mass",
        value: f.protein,
        unit: "g",
      },
      carbohydrateContent: {
        "@type": "Mass",
        value: f.carbs,
        unit: "g",
      },
      fatContent: {
        "@type": "Mass",
        value: f.fat,
        unit: "g",
      },
    });

    // JSON-LD: Food
    setJsonLd("food-schema", {
      "@context": "https://schema.org",
      "@type": "Food",
      name: f.name,
      description: `ارزش غذایی و کالری ${f.name}`,
      suitableForDiet: f.isVegan ? "https://schema.org/VeganDiet" : undefined,
      nutrition: {
        "@type": "NutritionInformation",
        calories: {
          "@type": "Energy",
          value: f.calories,
          unit: "kcal",
        },
        proteinContent: {
          "@type": "Mass",
          value: f.protein,
          unit: "g",
        },
        carbohydrateContent: {
          "@type": "Mass",
          value: f.carbs,
          unit: "g",
        },
        fatContent: {
          "@type": "Mass",
          value: f.fat,
          unit: "g",
        },
      },
    });

    // JSON-LD: FAQPage
    setJsonLd("faq-schema", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `${f.name} چند کالری دارد؟`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${f.name} حدود ${toPersianDigits(f.calories)} کالری در هر وعده (${f.servingSize}) دارد.`,
          },
        },
        {
          "@type": "Question",
          name: `درشت‌مغذی‌های ${f.name} چیست؟`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `هر وعده ${f.name} شامل ${toPersianDigits(f.protein)} گرم پروتئین، ${toPersianDigits(f.carbs)} گرم کربوهیدرات و ${toPersianDigits(f.fat)} گرم چربی است.`,
          },
        },
        {
          "@type": "Question",
          name: `${f.name} برای رژیم غذایی مناسب است؟`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `بستگی به هدف شما دارد. با توجه به ${toPersianDigits(f.calories)} کالری و ترکیب درشت‌مغذی‌ها می‌توانید این غذا را در برنامه غذایی خود بگنجانید. برای مشاوره دقیق، کل کالری و درشت‌مغذی روزانه خود را با محاسبه‌گر TDEE فیتاپ محاسبه کنید.`,
          },
        },
      ],
    });
  }

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

  function goBack() {
    setFoodId(null);
    setScreen("tool-foods");
    replaceScreen("tool-foods", { tool: "foods" });
  }

  function goLanding() {
    setScreen("landing");
    replaceScreen("landing");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openFood(id: string) {
    setFoodId(id);
    setScreen("food-detail");
    pushScreen("food-detail", { food: id });
  }

  function shareLink() {
    if (!food) return;
    const url = `${window.location.origin}/?food=${encodeURIComponent(food.id)}`;
    if (navigator.share) {
      navigator.share({ title: `کالری ${food.name}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("لینک غذا کپی شد ✓");
    }
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <DetailTopNav onBack={goBack} onLogo={goLanding} />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 rounded-xl mb-4" />
          <Skeleton className="h-48 rounded-2xl mb-6" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ─── 404 state ───
  if (notFound || !food) {
    return (
      <div className="min-h-screen bg-white">
        <DetailTopNav onBack={goBack} onLogo={goLanding} />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-slate-100">
            <SearchX className="w-10 h-10 text-slate-400" />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">غذا یافت نشد</h1>
          <p className="text-sm text-slate-500 mb-6">
            متأسفانه غذای موردنظر در بانک فیتاپ موجود نیست. شاید آدرس را اشتباه وارد کرده‌اید.
          </p>
          <Button
            onClick={goBack}
            className="text-white rounded-xl"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Search className="w-4 h-4" /> جستجوی غذاهای دیگر
          </Button>
        </div>
      </div>
    );
  }

  const totalMacros = food.protein + food.carbs + food.fat;
  const proteinPct = totalMacros > 0 ? Math.round((food.protein / totalMacros) * 100) : 0;
  const carbsPct = totalMacros > 0 ? Math.round((food.carbs / totalMacros) * 100) : 0;
  const fatPct = totalMacros > 0 ? Math.round((food.fat / totalMacros) * 100) : 0;

  return (
    <div className="min-h-screen bg-white">
      <DetailTopNav onBack={goBack} onLogo={goLanding} onShare={shareLink} />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {/* Breadcrumb / category badge */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge className="bg-orange-100 text-orange-700 text-[11px]">
            {CATEGORY_LABELS[food.category] || food.category}
          </Badge>
          {food.isVegan && (
            <Badge className="bg-emerald-100 text-emerald-700 text-[11px]">
              <Leaf className="w-3 h-3 ml-1" /> گیاهی
            </Badge>
          )}
        </div>

        {/* Title (H1) */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-black text-slate-900 mb-2 leading-tight"
        >
          کالری {food.name}
        </motion.h1>
        <p className="text-sm text-slate-500 mb-6 flex items-center gap-1.5">
          <Scale className="w-4 h-4" /> اندازه وعده: {food.servingSize}
        </p>

        {/* Big calorie hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl p-6 text-center text-white mb-4 shadow-lg"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-2">
            <Flame className="w-7 h-7" />
          </div>
          <p className="text-5xl font-black font-stat leading-none mb-1">
            {toPersianDigits(food.calories)}
          </p>
          <p className="text-xs opacity-90">کیلوکالری در هر وعده</p>
        </motion.div>

        {/* Macros grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4 rounded-2xl border-2 text-center" style={{ borderColor: "#fed7aa" }}>
            <Beef className="w-5 h-5 mx-auto mb-1.5 text-orange-500" />
            <p className="text-2xl font-black font-stat text-slate-900">{toPersianDigits(food.protein)}</p>
            <p className="text-[10px] text-slate-400">پروتئین (g)</p>
            <p className="text-[9px] text-orange-500 font-bold mt-0.5">{toPersianDigits(proteinPct)}٪</p>
          </Card>
          <Card className="p-4 rounded-2xl border-2 text-center" style={{ borderColor: "#fed7aa" }}>
            <Wheat className="w-5 h-5 mx-auto mb-1.5 text-cyan-500" />
            <p className="text-2xl font-black font-stat text-slate-900">{toPersianDigits(food.carbs)}</p>
            <p className="text-[10px] text-slate-400">کربوهیدرات (g)</p>
            <p className="text-[9px] text-cyan-500 font-bold mt-0.5">{toPersianDigits(carbsPct)}٪</p>
          </Card>
          <Card className="p-4 rounded-2xl border-2 text-center" style={{ borderColor: "#fed7aa" }}>
            <Droplet className="w-5 h-5 mx-auto mb-1.5 text-purple-500" />
            <p className="text-2xl font-black font-stat text-slate-900">{toPersianDigits(food.fat)}</p>
            <p className="text-[10px] text-slate-400">چربی (g)</p>
            <p className="text-[9px] text-purple-500 font-bold mt-0.5">{toPersianDigits(fatPct)}٪</p>
          </Card>
        </div>

        {/* Macro bar */}
        <div className="mb-6">
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
            <div style={{ width: `${proteinPct}%`, background: "#f97316" }} />
            <div style={{ width: `${carbsPct}%`, background: "#06b6d4" }} />
            <div style={{ width: `${fatPct}%`, background: "#a855f7" }} />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-500">
            <span>توزیع درشت‌مغذی‌ها</span>
            <span>مجموع: {toPersianDigits(totalMacros.toFixed(1))}گ</span>
          </div>
        </div>

        {/* CTA — دعوت به خرید برنامه */}
        <CtaSection context="food" />

        {/* Related foods */}
        {related.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2">
              <Apple className="w-5 h-5 text-orange-500" />
              غذاهای مشابه
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {related.map((rel, i) => (
                <motion.button
                  key={rel.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  onClick={() => openFood(rel.id)}
                  className="flex items-center justify-between p-3 rounded-xl border-2 transition hover:shadow-md text-right"
                  style={{ borderColor: "#fed7aa" }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)" }}>
                      <Apple className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900">{rel.name}</p>
                      <p className="text-[10px] text-slate-400">{rel.servingSize}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-black font-stat text-slate-900 text-sm">{toPersianDigits(rel.calories)}</p>
                    <p className="text-[9px] text-slate-400">کالری</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* ── SEO content with FAQ ── */}
        <section className="mt-10 space-y-6">
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            <h2 className="text-2xl font-black text-slate-900">
              کالری {food.name} — ارزش غذایی و درشت‌مغذی‌ها
            </h2>
            <p>
              <strong>{food.name}</strong> یکی از موارد دسته‌بندی{" "}
              <strong>{CATEGORY_LABELS[food.category] || food.category}</strong> در جدول کالری
              غذاهاست. هر وعده از این غذا (به اندازه {food.servingSize}) دارای{" "}
              <strong>{toPersianDigits(food.calories)} کالری</strong> است و شامل{" "}
              <strong>{toPersianDigits(food.protein)} گرم پروتئین</strong>،{" "}
              <strong>{toPersianDigits(food.carbs)} گرم کربوهیدرات</strong> و{" "}
              <strong>{toPersianDigits(food.fat)} گرم چربی</strong> می‌باشد.
            </p>
            <p>
              آگاهی از کالری و درشت‌مغذی‌های {food.name} برای طراحی{" "}
              <strong>برنامه غذایی بدنسازی</strong>، کنترل وزن در دوره‌های{" "}
              <strong>حجم</strong> و <strong>کات</strong> و رسیدن به اهداف تناسب اندام ضروری
              است. با توجه به میزان کالری این غذا می‌توانید آن را در منوی روزانه خود بگنجانید
              و کل کالری دریافتی را با کالری هدف (TDEE) مقایسه کنید.
            </p>
            {food.isVegan && (
              <p>
                <strong>{food.name}</strong> یک گزینه گیاهی است و می‌تواند در رژیم‌های{" "}
                <strong>گیاه‌خواری</strong> و وگان جایگزین منابع پروتئینی حیوانی شود. برای
                دستیابی به پروتئین کافی در رژیم گیاهی، ترکیب چندین منبع پروتئین گیاهی در طول
                روز توصیه می‌شود.
              </p>
            )}
            <p>
              برای محاسبه دقیق کالری موردنیاز روزانه خود از{" "}
              <strong>محاسبه‌گر TDEE فیتاپ</strong> استفاده کنید و سپس با توجه به آن، غذاهایی
              مانند {food.name} را در مقادیر مناسب در برنامه غذایی خود بگنجانید.
            </p>
          </div>

          {/* FAQ */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-slate-900">
              سوالات متداول درباره کالری {food.name}
            </h3>
            <Accordion
              type="single"
              collapsible
              className="w-full bg-white rounded-2xl border-2 px-4"
              style={{ borderColor: "#fed7aa" }}
            >
              <AccordionItem value="q1">
                <AccordionTrigger>{food.name} چند کالری دارد؟</AccordionTrigger>
                <AccordionContent>
                  هر وعده از {food.name} (به اندازه {food.servingSize}) حدود{" "}
                  <strong>{toPersianDigits(food.calories)} کالری</strong> دارد. برای محاسبه
                  کالری مقدار متفاوت از این غذا، می‌توانید به‌صورت نسبی محاسبه کنید: مثلاً اگر
                  دو برابر اندازه وعده مصرف کنید، کالری دریافتی نیز دو برابر می‌شود.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>
                  درشت‌مغذی‌های {food.name} چیست؟
                </AccordionTrigger>
                <AccordionContent>
                  هر وعده {food.name} شامل {toPersianDigits(food.protein)} گرم پروتئین،{" "}
                  {toPersianDigits(food.carbs)} گرم کربوهیدرات و {toPersianDigits(food.fat)} گرم
                  چربی است. توزیع درشت‌مغذی‌ها به‌صورت حدود {toPersianDigits(proteinPct)}٪
                  پروتئین، {toPersianDigits(carbsPct)}٪ کربوهیدرات و {toPersianDigits(fatPct)}٪
                  چربی است (بر اساس کالری هر درشت‌مغذی).
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>
                  آیا {food.name} برای کاهش وزن مناسب است؟
                </AccordionTrigger>
                <AccordionContent>
                  مناسب بودن {food.name} برای کاهش وزن به کل کالری روزانه شما و مقدار مصرفی
                  بستگی دارد. این غذا {toPersianDigits(food.calories)} کالری در هر وعده دارد؛
                  اگر در چارچوب کسری کالری روزانه‌تان قرار بگیرد، مشکلی ندارد. برای کاهش وزن
                  موفق، روزانه ۲۵۰ تا ۵۰۰ کالری کمتر از TDEE خود مصرف کنید و دریافت پروتئین
                  را بالا نگه دارید تا عضله‌ها حفظ شوند.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </article>

      <NikaWidget />
    </div>
  );
}

function DetailTopNav({
  onBack,
  onLogo,
  onShare,
}: {
  onBack: () => void;
  onLogo?: () => void;
  onShare?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b" style={{ borderColor: "#fed7aa" }}>
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          جدول کالری
        </button>
        <button
          onClick={onLogo}
          className="flex items-center gap-2 group cursor-pointer"
          aria-label="رفتن به صفحه اصلی"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden group-hover:scale-105 transition"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <span className="font-black text-sm text-slate-900 group-hover:text-orange-600 transition">فیتاپ</span>
        </button>
        {onShare && (
          <button
            onClick={onShare}
            className="p-2 rounded-lg hover:bg-slate-100 transition"
            aria-label="اشتراک‌گذاری"
          >
            <Share2 className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>
    </header>
  );
}
