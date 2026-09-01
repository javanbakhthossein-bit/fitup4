"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Apple } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { toPersianDigits } from "@/lib/fitness/types";
import { useAppStore } from "@/lib/fitness/store";
import { pushScreen } from "@/lib/fitness/navigation";

interface Food {
  id: string; name: string; category: string;
  calories: number; protein: number; carbs: number; fat: number;
  servingSize: string;
}

const FOOD_GROUPS = [
  { id: "all", label: "همه", icon: "🍽️" },
  { id: "breakfast", label: "صبحانه", icon: "🍳" },
  { id: "lunch", label: "ناهار", icon: "🍱" },
  { id: "dinner", label: "شام", icon: "🍽️" },
  { id: "snack", label: "میان‌وعده", icon: "🍎" },
];

export function FoodCalorieIndex() {
  const { setFoodId, setScreen } = useAppStore();
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  function openFoodDetail(id: string) {
    setFoodId(id);
    setScreen("food-detail");
    pushScreen("food-detail", { food: id });
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (category !== "all") params.set("category", category);
        const res = await fetch(`/api/foods?${params}`, { cache: "no-store" });
        const data = await res.json();
        setFoods(data.foods || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [search, category]);

  // ─── SEO ───
  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    const pageUrl = `${siteUrl}/?tool=foods`;
    const title = "جدول کالری غذاها — مرجع کامل کالری و درشت‌مغذی‌های مواد غذایی ایرانی | فیتاپ";
    const description =
      "جدول کامل کالری غذاها با بیش از ۱۰۰۰ ماده غذایی ایرانی و خارجی. محاسبه آنلاین کالری، پروتئین، کربوهیدرات و چربی هر غذا بر اساس وزن مصرفی. مرجع طراحی برنامه غذایی بدنسازی، رژیم غذایی و کنترل وزن.";
    const keywords =
      "کالری غذاها، جدول کالری، ارزش غذایی، پروتئین، کربوهیدرات، چربی، درشت‌مغذی‌ها، رژیم غذایی، برنامه غذایی بدنسازی، کالری مواد غذایی، محاسبه کالری، فیتاپ";
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
        { "@type": "ListItem", position: 2, name: "جدول کالری غذاها", item: pageUrl },
      ],
    });

    // ItemList schema — لیست دسته‌بندی‌های غذایی
    setJsonLd("itemlist-schema", {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "جدول کالری غذاها",
      description: "لیست کالری و درشت‌مغذی‌های بیش از ۱۰۰۰ ماده غذایی ایرانی",
      url: pageUrl,
      numberOfItems: 1000,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
    });

    // FAQPage schema
    setJsonLd("faq-schema", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "کالری هر غذا را چگونه محاسبه کنم؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "کالری هر غذا بر اساس وزن آن محاسبه می‌شود. در جدول کالری فیتاپ، ارزش غذایی هر ماده غذایی به ازای ۱۰۰ گرم ارائه شده است. برای محاسبه کالری مقدار مصرفی خود، کافی است وزن غذا (به گرم) را بر ۱۰۰ تقسیم کنید و در کالری هر ۱۰۰ گرم ضرب کنید. در بخش جزئیات هر غذا، با تغییر اسلایدر وزن، کالری و درشت‌مغذی‌ها به‌صورت خودکار محاسبه می‌شوند.",
          },
        },
        {
          "@type": "Question",
          name: "برای کاهش وزن چه غذاهایی بخورم؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "برای کاهش وزن و چربی‌سوزی، غذاهای کم‌کالری و حجم بالا مثل سبزیجات، سالاد، مرغ بدون پوست، ماهی، تخم مرغ، عدس و میوه‌های کم‌شکر را در رژیم غذایی خود بگنجانید. مهم‌ترین اصل، ایجاد کسری کالری ۲۵۰ تا ۵۰۰ کالری در روز است. حفظ دریافت پروتئین بالا (۱.۶ تا ۲.۲ گرم به ازای هر کیلو وزن بدن) از تحلیل عضلانی جلوگیری می‌کند.",
          },
        },
        {
          "@type": "Question",
          name: "برای عضله‌سازی چه غذاهایی مفید است؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "برای عضله‌سازی و افزایش حجم عضلانی، غذاهای پروتئین‌دار مثل سینه مرغ، گوشت قرمز، ماهی، تخم مرغ، ماست یونانی، پنیر cottage، عدس و لوبیا بسیار مفیدند. دریافت کالری ۳۰۰ تا ۵۰۰ کالری بیشتر از TDEE به همراه برنامه تمرینی بدنسازی اصولی شرط اصلی رشد عضلانی است.",
          },
        },
        {
          "@type": "Question",
          name: "پروتئین روزانه چقدر نیاز است؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "میزان پروتئین روزانه بستگی به هدف و وزن بدن دارد: برای افراد کم‌تحرک حدود ۰.۸ گرم به ازای هر کیلوگرم وزن بدن، برای عضله‌سازی ۱.۶ تا ۲.۲ گرم، و برای دوره کات (حفظ عضله هنگام چربی‌سوزی) ۲.۰ تا ۲.۴ گرم به ازای هر کیلوگرم وزن بدن.",
          },
        },
        {
          "@type": "Question",
          name: "آیا این جدول کالری برای غذاهای ایرانی مناسب است؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "بله، جدول کالری فیتاپ شامل غذاهای ایرانی رایج مثل چلوکباب، قرمه‌سبزی، قورمه‌سبزی، عدس‌پلو، باقالی‌پلو، کوفته، اشکنه و خورشت‌های مختلف است تا کاربران ایرانی بتوانند کالری و درشت‌مغذی‌های غذاهای روزانه خود را به‌سادگی محاسبه کنند.",
          },
        },
      ],
    });

    return () => {
      // پاک کردن JSON-LD های اختصاصی صفحه هنگام خروج
      ["breadcrumb-schema", "faq-schema", "itemlist-schema"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      // عنوان پیش‌فرض سایت
      document.title =
        "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه با AI";
    };
  }, []);

  return (
    <div className="min-h-screen bg-white pt-28 sm:pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            <Apple className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">جدول کالری غذاها</h1>
          <p className="text-sm text-slate-500">جستجو در بانک مواد غذایی با محاسبه‌گر داینامیک ارزش غذایی</p>
        </div>

        {/* Search + groups */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی غذا..." className="pr-10 rounded-xl border-2" style={{ borderColor: "#fed7aa" }} />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {FOOD_GROUPS.map(g => (
              <button key={g.id} onClick={() => setCategory(g.id)} className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${category === g.id ? "text-white shadow-md" : "bg-slate-100 text-slate-600"}`} style={category === g.id ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}>
                <span className="ml-1">{g.icon}</span>{g.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-3">{toPersianDigits(foods.length)} ماده غذایی یافت شد</p>

        {/* Food list */}
        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : foods.length === 0 ? (
          <div className="text-center py-12">
            <Apple className="w-16 h-16 mx-auto mb-3 text-slate-200" />
            <p className="text-sm text-slate-400">ماده غذایی یافت نشد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {foods.map((food, i) => (
              <motion.button
                key={food.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => openFoodDetail(food.id)}
                className="w-full flex items-center justify-between p-3 rounded-xl border-2 hover:shadow-md transition text-right"
                style={{ borderColor: "#fed7aa", background: "#fff" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)" }}>
                    <Apple className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{food.name}</p>
                    <p className="text-[10px] text-slate-400">{food.servingSize}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-black font-stat text-slate-900">{toPersianDigits(food.calories)}</p>
                  <p className="text-[10px] text-slate-400">کالری/۱۰۰گ</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Detail modal was removed in favor of dedicated SEO page (?food=ID) */}

        {/* ── SEO Content Section ── */}
        <section className="mt-16 space-y-8">
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            <h2 className="text-2xl font-black text-slate-900">
              جدول کالری غذاها — مرجع کامل کالری مواد غذایی
            </h2>
            <p>
              جدول کالری غذاها فیتاپ شامل بیش از <strong>{toPersianDigits("۱۰۰۰")} نوع غذا</strong> با
              مقدار دقیق <strong>کالری</strong> و <strong>درشت‌مغذی‌ها</strong> (پروتئین، کربوهیدرات، چربی) است.
              این مرجع کامل برای طراحی <strong>برنامه غذایی بدنسازی</strong>، کنترل کالری در{" "}
              <strong>رژیم غذایی</strong> و انتخاب غذاهای مناسب در <strong>دوره حجم</strong> و{" "}
              <strong>دوره کات</strong> به کار می‌آید. با جستجوی نام غذا، می‌توانید ارزش غذایی هر ماده غذایی را
              بر اساس وزن مصرفی به‌صورت داینامیک محاسبه کنید.
            </p>
            <p>
              <strong>شمارش کالری</strong> یکی از مهم‌ترین اصول موفقیت در <strong>برنامه غذایی بدنسازی</strong> و
              رسیدن به تناسب اندام است. بدون آگاهی از کالری و درشت‌مغذی‌های غذاها، حتی بهترین{" "}
              <strong>برنامه تمرینی بدنسازی</strong> هم نتیجه مطلوب نخواهد داشت. این جدول به شما کمک می‌کند تا
              منوی غذایی هدفمند و متناسب با هدف خود — چه <strong>افزایش حجم عضلانی</strong>، چه{" "}
              <strong>چربی‌سوزی</strong> و چه کاهش وزن — طراحی کنید.
            </p>

            <h3 className="text-xl font-bold text-slate-900 pt-2">
              دسته‌بندی غذاها: صبحانه، ناهار، شام، میان‌وعده
            </h3>
            <p>
              غذاها در این جدول بر اساس وعده غذایی دسته‌بندی شده‌اند تا طراحی <strong>منوی غذایی</strong> روزانه ساده‌تر شود:
            </p>
            <ul className="list-disc pr-5 space-y-1.5">
              <li>
                <strong>صبحانه:</strong> تخم مرغ، جو دوسر، پنیر، ماست، نان سبوس‌دار — سرشار از پروتئین و کربوهیدرات پیچیده برای شروع روز.
              </li>
              <li>
                <strong>ناهار:</strong> برنج، مرغ، گوشت، عدس، سالاد — وعده اصلی برای دریافت انرژی و پروتئین.
              </li>
              <li>
                <strong>شام:</strong> ماهی، تخم مرغ، سوپ، سبزیجات — سبک‌تر و مناسب هضم شبانه.
              </li>
              <li>
                <strong>میان‌وعده:</strong> آجیل، میوه، ماست، پروتئین شیک — برای کنترل گرسنگی و دریافت پروتئین اضافی.
              </li>
            </ul>

            <h3 className="text-xl font-bold text-slate-900 pt-2">
              چگونه از جدول کالری برای رژیم غذایی استفاده کنیم؟
            </h3>
            <p>
              برای استفاده از این جدول در <strong>رژیم غذایی بدنسازی</strong>، ابتدا با <strong>محاسبه‌گر TDEE</strong> کالری
              روزانه هدف خود را تعیین کنید. سپس کالری هر وعده را از این جدول استخراج کرده و جمع کل را با کالری هدف مقایسه
              کنید. اگر هدف <strong>عضله‌سازی</strong> است، کالری دریافتی را بالاتر از TDEE نگه دارید و اگر هدف{" "}
              <strong>خشک کردن بدن</strong> است، کسری کالری ایجاد کنید. توجه به <strong>درشت‌مغذی‌ها</strong> به‌ویژه{" "}
              پروتئین، در هر دو حالت حیاتی است.
            </p>
          </div>

          {/* FAQ */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              سوالات متداول درباره جدول کالری غذاها
            </h3>
            <Accordion
              type="single"
              collapsible
              className="w-full bg-white rounded-2xl border-2 px-4"
              style={{ borderColor: "#fed7aa" }}
            >
              <AccordionItem value="q1">
                <AccordionTrigger>کالری هر غذا را چگونه محاسبه کنم؟</AccordionTrigger>
                <AccordionContent>
                  کالری هر غذا بر اساس وزن آن محاسبه می‌شود. در جدول کالری فیتاپ، ارزش غذایی هر ماده غذایی به ازای ۱۰۰ گرم ارائه شده است. برای محاسبه کالری مقدار مصرفی خود، کافی است وزن غذا (به گرم) را بر ۱۰۰ تقسیم کنید و در کالری هر ۱۰۰ گرم ضرب کنید. در بخش جزئیات هر غذا، با تغییر اسلایدر وزن، کالری و درشت‌مغذی‌ها به‌صورت خودکار محاسبه می‌شوند.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>برای کاهش وزن چه غذاهایی بخورم؟</AccordionTrigger>
                <AccordionContent>
                  برای کاهش وزن و چربی‌سوزی، غذاهای کم‌کالری و حجم‌ بالا مثل سبزیجات، سالاد، مرغ بدون پوست، ماهی، تخم مرغ، عدس و میوه‌های کم‌شکر را در رژیم غذایی خود بگنجانید. از غذاهای فرآوری‌شده، سرخ‌کردنی، شیرینی‌جات و نوشابه‌ها دوری کنید. مهم‌ترین اصل، ایجاد کسری کالری ۲۵۰ تا ۵۰۰ کالری در روز است. حفظ دریافت پروتئین بالا (۱.۶ تا ۲.۲ گرم به ازای هر کیلو وزن بدن) از تحلیل عضلانی جلوگیری می‌کند.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>برای عضله‌سازی چه غذاهایی مفید است؟</AccordionTrigger>
                <AccordionContent>
                  برای عضله‌سازی و افزایش حجم عضلانی، غذاهای پروتئین‌دار مثل سینه مرغ، گوشت قرمز، ماهی، تخم مرغ، ماست یونانی، پنیر cottage، عدس و لوبیا بسیار مفیدند. همچنین کربوهیدرات‌های پیچیده مثل برنج، سیب‌زمینی، جو دوسر و نان سبوس‌دار برای تأمین انرژی تمرین ضروری هستند. چربی‌های سالم مثل آجیل، زیتون و آووکادو هم برای تنظیم هورمون‌ها لازم‌اند. دریافت کالری ۳۰۰ تا ۵۰۰ کالری بیشتر از TDEE را فراموش نکنید.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger>پروتئین روزانه چقدر نیاز است؟</AccordionTrigger>
                <AccordionContent>
                  میزان پروتئین روزانه بستگی به هدف و وزن بدن دارد: برای افراد کم‌تحرک حدود ۰.۸ گرم به ازای هر کیلوگرم وزن بدن، برای عضله‌سازی و افزایش حجم عضلانی ۱.۶ تا ۲.۲ گرم، و برای دوره کات (حفظ عضله هنگام چربی‌سوزی) ۲.۰ تا ۲.۴ گرم به ازای هر کیلوگرم وزن بدن. مثلاً یک فرد ۷۵ کیلوگرمی برای عضله‌سازی به ۱۲۰ تا ۱۶۵ گرم پروتئین در روز نیاز دارد که باید در ۴ تا ۵ وعده توزیع شود.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5">
                <AccordionTrigger>آیا این جدول کالری برای غذاهای ایرانی مناسب است؟</AccordionTrigger>
                <AccordionContent>
                  بله، جدول کالری فیتاپ شامل غذاهای ایرانی رایج مثل چلوکباب، قرمه‌سبزی، قورمه‌سبزی، عدس‌پلو، باقالی‌پلو، کوفته، اشکنه و خورشت‌های مختلف است. این انتخاب طراحی شده تا کاربران ایرانی بتوانند بدون نیاز به جستجوی غذا‌های خارجی، کالری و درشت‌مغذی‌های غذاهای روزانه خود را به‌سادگی محاسبه کنند و برنامه غذایی بدنسازی متناسب با سلیقه و فرهنگ غذایی خود داشته باشند.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </div>
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
