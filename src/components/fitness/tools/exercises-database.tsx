"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Search, Filter, Youtube } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface Exercise {
  id: string; name: string; muscle: string; category: string;
  equipment: string; description: string; tips: string;
  mediaUrl: string; youtubeUrl?: string; difficulty: string;
}

const MUSCLE_GROUPS = [
  { id: "all", label: "همه", icon: "💪" },
  { id: "سینه", label: "سینه", icon: "🏋️" },
  { id: "پشت", label: "پشت", icon: "🤸" },
  { id: "پا", label: "پا", icon: "🦵" },
  { id: "پا و باسن", label: "پا و باسن", icon: "🏃" },
  { id: "سرشانه", label: "سرشانه", icon: "🤾" },
  { id: "بازو", label: "بازو", icon: "💪" },
  { id: "زیربغل", label: "زیربغل", icon: "🏊" },
  { id: "شکم", label: "شکم", icon: "🧘" },
  { id: "کمر و پشت", label: "کمر و پشت", icon: "🦴" },
  { id: "جلو ران", label: "جلو ران", icon: "🦵" },
  { id: "پشت ران", label: "پشت ران", icon: "🦵" },
  { id: "سینه و دست", label: "سینه و دست", icon: "💪" },
];

const EQUIPMENT_FILTERS = [
  { id: "all", label: "همه تجهیزات" },
  { id: "dumbbell", label: "دمبل" },
  { id: "barbell", label: "هالتر" },
  { id: "machine", label: "دستگاه" },
  { id: "bodyweight", label: "وزن بدن" },
];

const DIFFICULTY_LABELS: Record<string, string> = { beginner: "مبتدی", intermediate: "متوسط", advanced: "پیشرفته" };
const DIFFICULTY_COLORS: Record<string, string> = { beginner: "bg-emerald-100 text-emerald-700", intermediate: "bg-amber-100 text-amber-700", advanced: "bg-red-100 text-red-700" };

export function ExercisesDatabase() {
  const { setExerciseId, setScreen } = useAppStore();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("all");
  const [equipment, setEquipment] = useState("all");

  function openExerciseDetail(id: string) {
    setExerciseId(id);
    setScreen("exercise-detail");
    pushScreen("exercise-detail", { exercise: id });
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (muscle !== "all") params.set("muscle", muscle);
        if (equipment !== "all") params.set("equipment", equipment);
        const res = await fetch(`/api/exercises?${params}`, { cache: "no-store" });
        const data = await res.json();
        setExercises(data.exercises || []);
      } catch {} finally { setLoading(false); }
    })();
  }, [search, muscle, equipment]);

  // ─── SEO ───
  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    const pageUrl = `${siteUrl}/?tool=exercises`;
    const title = "بانک حرکات بدنسازی — آموزش کامل حرکات ورزشی | فیتاپ";
    const description =
      "بانک کامل حرکات بدنسازی با آموزش گام‌به‌گام، نکات ایمنی و ویدیوهای تکنیکی. جستجو و فیلتر حرکات ورزشی بر اساس گروه عضلانی (سینه، پشت، پا، سرشانه، بازو) و تجهیزات (دمبل، هالتر، دستگاه). مرجع طراحی برنامه تمرینی بدنسازی در خانه و باشگاه.";
    const keywords =
      "حرکات بدنسازی، آموزش حرکات، بانک حرکات، تمرینات ورزشی، حرکات عضله‌سازی، آموزش بدنسازی، تکنیک حرکات، حرکات مرکب، برنامه تمرینی، فیتاپ";
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
        { "@type": "ListItem", position: 2, name: "بانک حرکات بدنسازی", item: pageUrl },
      ],
    });

    // FAQPage schema
    setJsonLd("faq-schema", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "بهترین حرکات بدنسازی برای مبتدیان کدامند؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "برای مبتدیان، حرکات مرکب (Compound) مثل اسکوات، ددلیفت رومانیایی، پرس سینه هالتر، پرس سرشانه دمبل، زیربغل سیم‌کش و بارفیکس بهترین انتخاب هستند. این حرکات چندین گروه عضلانی را همزمان درگیر می‌کنند، بیشترین تحریک آنابولیک ایجاد می‌کنند و پایه‌ی برنامه بدنسازی مبتدی را تشکیل می‌دهند.",
          },
        },
        {
          "@type": "Question",
          name: "حرکات مرکب (Compound) چیست و چرا مهم است؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "حرکات مرکب حرکاتی هستند که در آن‌ها بیش از یک مفصل و چند گروه عضلانی همزمان درگیر می‌شوند — مثل اسکوات، ددلیفت، پرس سینه و بارفیکس. این حرکات برای عضله‌سازی و افزایش حجم عضلانی بسیار مهم‌اند چون تحریک هورمونی بیشتری ایجاد می‌کنند، زمان تمرین را کوتاه می‌کنند و قدرت عملکردی بدن را بالا می‌برند.",
          },
        },
        {
          "@type": "Question",
          name: "چگونه حرکت جایگزین انتخاب کنم؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "برای انتخاب حرکت جایگزین، ابتدا عضله هدف و الگوی حرکتی حرکت اصلی را مشخص کنید. مثلاً جایگزین پرس سینه هالتر می‌تواند پرس سینه دمبل یا پرس بالاسینه دستگاه باشد. اگر آسیب‌دیدگی دارید، حرکاتی با بار کمتر روی مفصل انتخاب کنید. در بانک حرکات فیتاپ می‌توانید بر اساس گروه عضلانی و تجهیزات، حرکت جایگزین مناسب پیدا کنید.",
          },
        },
        {
          "@type": "Question",
          name: "حرکات Push و Pull چه تفاوتی دارند؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "حرکات Push (فشار) شامل حرکاتی هستند که در آن‌ها وزن را از بدن دور می‌کنید — مثل پرس سینه، پرس سرشانه و پشت بازو. حرکات Pull (کشش) شامل حرکاتی هستند که وزن را به سمت بدن می‌کشید — مثل زیربغل، لت و جلوبازو. تقسیم تمرینی PPL (Push-Pull-Legs) یکی از بهترین روش‌های برنامه‌ریزی بدنسازی است.",
          },
        },
        {
          "@type": "Question",
          name: "چند حرکت در هر جلسه تمرینی انجام دهم؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "برای اکثر افراد، ۴ تا ۶ حرکت در هر جلسه تمرینی بدنسازی کافی است. هر حرکت ۳ تا ۴ ست با ۸ تا ۱۲ تکرار. اگر برنامه بدنسازی ۳ جلسه در هفته دارید، می‌توانید از تقسیم Push-Pull-Legs یا Upper-Lower استفاده کنید. بیشتر از ۶ حرکت معمولاً باعث افت کیفیت تمرین می‌شود.",
          },
        },
      ],
    });

    return () => {
      ["breadcrumb-schema", "faq-schema"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      document.title =
        "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه با AI";
    };
  }, []);

  return (
    <div className="min-h-screen bg-white pt-28 sm:pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            <Dumbbell className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">بانک حرکات ورزشی</h1>
          <p className="text-sm text-slate-500">جستجو و فیلتر در میان حرکات ورزشی با آموزش گام‌به‌گام و نکات ایمنی</p>
        </div>

        {/* Search + filters */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجوی حرکات..." className="pr-10 rounded-xl border-2" style={{ borderColor: "#fed7aa" }} />
          </div>

          {/* Muscle groups */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {MUSCLE_GROUPS.map(m => (
              <button key={m.id} onClick={() => setMuscle(m.id)} className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${muscle === m.id ? "text-white shadow-md" : "bg-slate-100 text-slate-600"}`} style={muscle === m.id ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}>
                <span className="ml-1">{m.icon}</span>{m.label}
              </button>
            ))}
          </div>

          {/* Equipment filter */}
          <div className="flex gap-2 flex-wrap">
            {EQUIPMENT_FILTERS.map(e => (
              <button key={e.id} onClick={() => setEquipment(e.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${equipment === e.id ? "bg-orange-100 text-orange-600 border border-orange-300" : "bg-slate-50 text-slate-500 border border-slate-200"}`}>
                <Filter className="w-3 h-3 inline ml-1" />{e.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-slate-400 mb-3">{toPersianDigits(exercises.length)} حرکت یافت شد</p>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : exercises.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="w-16 h-16 mx-auto mb-3 text-slate-200" />
            <p className="text-sm text-slate-400">حرکتی با این فیلتر یافت نشد</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exercises.map((ex, i) => (
              <motion.button
                key={ex.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -4 }}
                onClick={() => openExerciseDetail(ex.id)}
                className="text-right bg-white rounded-2xl border-2 p-4 transition hover:shadow-lg"
                style={{ borderColor: "#fed7aa" }}
              >
                {/* Badges row — ویدیو + سطح دشواری */}
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                    <Dumbbell className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {ex.youtubeUrl && ex.youtubeUrl.trim() !== "" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[9px] font-bold text-red-600 shrink-0">
                        <Youtube className="w-3 h-3" />
                        ویدیو
                      </span>
                    )}
                    <Badge className={`text-[9px] shrink-0 ${DIFFICULTY_COLORS[ex.difficulty] || "bg-slate-100 text-slate-600"}`}>
                      {DIFFICULTY_LABELS[ex.difficulty] || ex.difficulty}
                    </Badge>
                  </div>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">{ex.name}</h3>
                <p className="text-[11px] text-slate-500 mb-2">{ex.muscle}</p>
                {ex.equipment && (
                  <div className="flex flex-wrap gap-1">
                    {ex.equipment.split(",").slice(0, 3).map((eq, j) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{eq.trim()}</span>
                    ))}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {/* Detail modal was removed in favor of dedicated SEO page (?exercise=ID) */}

        {/* ── SEO Content Section ── */}
        <section className="mt-16 space-y-8">
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            <h2 className="text-2xl font-black text-slate-900">
              بانک حرکات ورزشی فیتاپ — مرجع کامل حرکات بدنسازی
            </h2>
            <p>
              بانک حرکات ورزشی فیتاپ شامل بیش از <strong>{toPersianDigits("۱۰۰")} حرکت بدنسازی</strong> با
              آموزش تصویری گام‌به‌گام، نکات ایمنی و ویدیوهای تکنیکی است. این مرجع کامل برای طراحی{" "}
              <strong>برنامه تمرینی بدنسازی</strong>، انتخاب حرکت جایگزین و یادگیری تکنیک صحیح اجرا در{" "}
              <strong>برنامه حجمی</strong> و <strong>برنامه کات</strong> به کار می‌آید. هر حرکت شامل توضیح
              کامل نحوه اجرا، عضله هدف، تجهیزات مورد نیاز و سطح دشواری (مبتدی، متوسط، پیشرفته) است.
            </p>
            <p>
              حرکات این بانک بر اساس <strong>گروه عضلانی</strong> (سینه، پشت، پا، سرشانه، بازو، زیربغل، شکم) و{" "}
              <strong>نوع تجهیزات</strong> (دمبل، هالتر، دستگاه، وزن بدن) دسته‌بندی شده‌اند تا بتوانید به‌سادگی
              حرکت مناسب <strong>برنامه بدنسازی در خانه</strong> یا <strong>برنامه بدنسازی در باشگاه</strong> را
              پیدا کنید. این ساختار برای <strong>برنامه بدنسازی مبتدی</strong> تا <strong>حرفه‌ای</strong> مناسب است.
            </p>

            <h3 className="text-xl font-bold text-slate-900 pt-2">
              دسته‌بندی حرکات: Push، Pull، Legs، Core، Cardio
            </h3>
            <p>
              در <strong>برنامه پرورش اندام</strong> مدرن، حرکات بر اساس الگوی حرکتی (Movement Pattern) دسته‌بندی می‌شوند:
            </p>
            <ul className="list-disc pr-5 space-y-1.5">
              <li>
                <strong>Push (فشار):</strong> حرکاتی مثل پرس سینه، پرس سرشانه و پشت بازو — برای عضله‌سازی بالاتنه.
              </li>
              <li>
                <strong>Pull (کشش):</strong> حرکاتی مثل زیربغل، لت و جلوبازو — برای رشد پشت بدن و تعادل عضلانی.
              </li>
              <li>
                <strong>Legs (پا):</strong> اسکوات، ددلیفت و لانگز — مهم‌ترین <strong>حرکات مرکب</strong> برای افزایش حجم و قدرت کل بدن.
              </li>
              <li>
                <strong>Core (مرکز):</strong> حرکات شکم و کمر برای تثبیت مرکز بدن و پیشگیری از آسیب کمر.
              </li>
              <li>
                <strong>Cardio (هوازی):</strong> برای چربی‌سوزی، سلامتی قلب و بهبود استقامت در دوره کات.
              </li>
            </ul>

            <h3 className="text-xl font-bold text-slate-900 pt-2">
              نحوه انتخاب حرکت برای برنامه تمرینی
            </h3>
            <p>
              برای انتخاب حرکت مناسب در <strong>روال تمرینی</strong> خود، به سه عامل توجه کنید: گروه عضلانی هدف، تجهیزات در دسترس و سطح آمادگی. اگر مبتدی هستید، از حرکات <strong>مرکب (Compound)</strong> مثل اسکوات، ددلیفت و پرس شروع کنید که چند عضله را همزمان درگیر می‌کنند و بیشترین تحریک را برای عضله‌سازی ایجاد می‌کنند.
            </p>

            <h3 className="text-xl font-bold text-slate-900 pt-2">
              تکنیک صحیح اجرای حرکات بدنسازی
            </h3>
            <p>
              تکنیک صحیح مهم‌ترین اصل <strong>بدنسازی طبیعی</strong> و پیشگیری از آسیب است. قبل از افزایش وزنه،
              مطمئن شوید فرم اجرای حرکت کامل درست است. کنترل حرکت در فاز منفی (Eccentric)، تنفس صحیح و گرم کردن
              مناسب، از ارکان اصلی اجرای اصولی هر حرکت به‌شمار می‌آیند. در صورت داشتن آسیب‌دیدگی، از حرکت جایگزین
              با تجهیزات سبک‌تر استفاده کنید.
            </p>
          </div>

          {/* FAQ */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              سوالات متداول درباره بانک حرکات بدنسازی
            </h3>
            <Accordion
              type="single"
              collapsible
              className="w-full bg-white rounded-2xl border-2 px-4"
              style={{ borderColor: "#fed7aa" }}
            >
              <AccordionItem value="q1">
                <AccordionTrigger>بهترین حرکات بدنسازی برای مبتدیان کدامند؟</AccordionTrigger>
                <AccordionContent>
                  برای مبتدیان، حرکات مرکب (Compound) مثل اسکوات، ددلیفت رومانیایی، پرس سینه هالتر، پرس سرشانه دمبل، زیربقل سیم‌کش و بارفیکس بهترین انتخاب هستند. این حرکات چندین گروه عضلانی را همزمان درگیر می‌کنند، بیشترین تحریک آنابولیک ایجاد می‌کنند و پایه‌ی برنامه بدنسازی مبتدی را تشکیل می‌دهند. توصیه می‌شود ابتدا تکنیک را با وزنه سبک تمرین کنید.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>حرکات مرکب (Compound) چیست و چرا مهم است؟</AccordionTrigger>
                <AccordionContent>
                  حرکات مرکب حرکاتی هستند که در آن‌ها بیش از یک مفصل و چند گروه عضلانی همزمان درگیر می‌شوند — مثل اسکوات، ددلیفت، پرس سینه و بارفیکس. این حرکات برای عضله‌سازی و افزایش حجم عضلانی بسیار مهم‌اند چون تحریک هورمونی بیشتری ایجاد می‌کنند، زمان تمرین را کوتاه می‌کنند و قدرت عملکردی بدن را بالا می‌برند. در هر برنامه تمرینی بدنسازی باید حداقل یک حرکت مرکب برای هر گروه عضلانی وجود داشته باشد.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>چگونه حرکت جایگزین انتخاب کنم؟</AccordionTrigger>
                <AccordionContent>
                  برای انتخاب حرکت جایگزین، ابتدا عضله هدف و الگوی حرکتی حرکت اصلی را مشخص کنید. مثلاً جایگزین پرس سینه هالتر می‌تواند پرس سینه دمبل یا پرس بالاسینه دستگاه باشد. اگر آسیب‌دیدگی دارید، حرکاتی با بار کمتر روی مفصل انتخاب کنید (مثلاً زیربغل سیم‌کش به جای بارفیکس). در بانک حرکات فیتاپ می‌توانید بر اساس گروه عضلانی و تجهیزات، حرکت جایگزین مناسب پیدا کنید.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger>حرکات Push و Pull چه تفاوتی دارند؟</AccordionTrigger>
                <AccordionContent>
                  حرکات Push (فشار) شامل حرکاتی هستند که در آن‌ها وزن را از بدن دور می‌کنید — مثل پرس سینه، پرس سرشانه، پشت بازو و اسکوات. این حرکات عمدتاً سینه، سرشانه، پشت بازو و پا را درگیر می‌کنند. حرکات Pull (کشش) شامل حرکاتی هستند که وزن را به سمت بدن می‌کشید — مثل زیربغل، لت، جلوبازو و ددلیفت. این حرکات پشت، زیربغل، جلوبازو و پشت ران را درگیر می‌کنند. تقسیم تمرینی PPL (Push-Pull-Legs) یکی از بهترین روش‌های برنامه‌ریزی بدنسازی است.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5">
                <AccordionTrigger>چند حرکت در هر جلسه تمرینی انجام دهم؟</AccordionTrigger>
                <AccordionContent>
                  برای اکثر افراد، ۴ تا ۶ حرکت در هر جلسه تمرینی بدنسازی کافی است. هر حرکت ۳ تا ۴ ست با ۸ تا ۱۲ تکرار. اگر برنامه بدنسازی ۳ جلسه در هفته دارید، می‌توانید از تقسیم Push-Pull-Legs یا Upper-Lower استفاده کنید. بیشتر از ۶ حرکت در یک جلسه معمولاً باعث افت کیفیت تمرین و خستگی اضافی می‌شود.
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
