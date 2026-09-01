"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, Flame, Beef, Wheat, Droplet, Save, RefreshCw, Target, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { toPersianDigits, GENDER_LABELS } from "@/lib/fitness/types";
import { toast } from "sonner";

type Gender = "male" | "female";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type Goal = "fast_loss" | "slow_loss" | "maintain" | "gain";

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "بی‌تحرک (کار پشت میز)", light: "کم‌تحرک (۱-۳ روز ورزش)", moderate: "متوسط (۳-۵ روز ورزش)", active: "فعال (۶-۷ روز ورزش)", very_active: "بسیار فعال (ورزشکار حرفه‌ای)",
};

const GOAL_ADJUST: Record<Goal, number> = {
  fast_loss: -500, slow_loss: -250, maintain: 0, gain: 400,
};

const GOAL_LABELS: Record<Goal, string> = {
  fast_loss: "کاهش وزن سریع", slow_loss: "کاهش وزن آهسته", maintain: "تثبیت وزن", gain: "افزایش وزن",
};

const GOAL_MACROS: Record<Goal, { protein: number; carbs: number; fat: number }> = {
  fast_loss: { protein: 0.40, carbs: 0.30, fat: 0.30 },
  slow_loss: { protein: 0.35, carbs: 0.35, fat: 0.30 },
  maintain: { protein: 0.30, carbs: 0.40, fat: 0.30 },
  gain: { protein: 0.30, carbs: 0.45, fat: 0.25 },
};

// BMI categories — Persian label + color (Tailwind text color)
function getBmiCategory(bmi: number): { label: string; hexColor: string; bg: string } {
  if (bmi < 18.5) return { label: "کم‌وزن", hexColor: "#06b6d4", bg: "rgba(6,182,212,0.12)" };
  if (bmi < 25) return { label: "وزن نرمال", hexColor: "#10b981", bg: "rgba(16,185,129,0.12)" };
  if (bmi < 30) return { label: "اضافه‌وزن", hexColor: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  return { label: "چاق", hexColor: "#ef4444", bg: "rgba(239,68,68,0.12)" };
}

export function TdeeCalculator() {
  // Initialize state from localStorage using lazy initializers
  const savedData = typeof window !== "undefined" ? (() => {
    try {
      const saved = localStorage.getItem("fitap_tdee_data");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })() : null;

  const [age, setAge] = useState(savedData?.age || "");
  const [height, setHeight] = useState(savedData?.height || "");
  const [weight, setWeight] = useState(savedData?.weight || "");
  const [gender, setGender] = useState<Gender>(savedData?.gender || "male");
  const [activity, setActivity] = useState<ActivityLevel>(savedData?.activity || "moderate");
  const [goal, setGoal] = useState<Goal>(savedData?.goal || "maintain");
  const [result, setResult] = useState<{ bmr: number; tdee: number; targetCal: number; protein: number; carbs: number; fat: number; bmi: number } | null>(null);

  function calculate() {
    const a = Number(age), h = Number(height), w = Number(weight);
    if (!a || !h || !w || a < 10 || a > 100 || h < 100 || h > 250 || w < 30 || w > 300) {
      toast.error("لطفاً اطلاعات معتبر وارد کنید");
      return;
    }

    // Harris-Benedict formula
    let bmr: number;
    if (gender === "male") {
      bmr = 88.362 + (13.397 * w) + (4.799 * h) - (5.677 * a);
    } else {
      bmr = 447.593 + (9.247 * w) + (3.098 * h) - (4.330 * a);
    }

    const tdee = Math.round(bmr * ACTIVITY_FACTORS[activity]);
    const targetCal = Math.round(tdee + GOAL_ADJUST[goal]);
    const macros = GOAL_MACROS[goal];
    const protein = Math.round((targetCal * macros.protein) / 4);
    const carbs = Math.round((targetCal * macros.carbs) / 4);
    const fat = Math.round((targetCal * macros.fat) / 9);

    // BMI: weight (kg) / (height (m))^2
    const heightM = h / 100;
    const bmi = Math.round((w / (heightM * heightM)) * 10) / 10;

    setResult({ bmr: Math.round(bmr), tdee, targetCal, protein, carbs, fat, bmi });

    // Save to localStorage
    localStorage.setItem("fitap_tdee_data", JSON.stringify({ age, height, weight, gender, activity, goal }));
    toast.success("محاسبه انجام شد! 💪");
  }

  function reset() {
    setAge(""); setHeight(""); setWeight(""); setResult(null);
    localStorage.removeItem("fitap_tdee_data");
  }

  // ─── SEO ───
  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    const pageUrl = `${siteUrl}/?tool=tdee`;
    const title = "محاسبه‌گر کالری روزانه TDEE — چقدر کالری بخورم؟ | فیتاپ";
    const description =
      "محاسبه‌گر آنلاین کالری روزانه TDEE با فرمول علمی هریس-بندیکت. محاسبه BMR، کالری هدف، درشت‌مغذی‌ها (پروتئین، کربوهیدرات، چربی) و شاخص BMI برای عضله‌سازی، چربی‌سوزی و کاهش وزن. ابزار طراحی برنامه غذایی بدنسازی.";
    const keywords =
      "TDEE، کالری روزانه، محاسبه کالری، نیاز کالری، BMR، متابولیسم پایه، محاسبه BMI، درشت‌مغذی‌ها، فرمول هریس-بندیکت، رژیم غذایی، فیتاپ";
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
        { "@type": "ListItem", position: 2, name: "محاسبه‌گر کالری", item: pageUrl },
      ],
    });

    // FAQPage schema
    setJsonLd("faq-schema", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "چگونه کالری روزانه خود را محاسبه کنم؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "برای محاسبه کالری روزانه، ابتدا BMR (متابولیسم پایه) را با فرمول هریس-بندیکت بر اساس سن، جنسیت، قد و وزن به‌دست آورید، سپس آن را در ضریب فعالیت روزانه ضرب کنید تا TDEE به‌دست آید. این مقدار همان کالری روزانه شما برای تثبیت وزن است. سپس بر اساس هدف (حجم، کات یا تثبیت) ۳۰۰ تا ۵۰۰ کالری به آن اضافه یا کم کنید.",
          },
        },
        {
          "@type": "Question",
          name: "برای عضله‌سازی چند کالری نیاز دارم؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "برای عضله‌سازی و افزایش حجم عضلانی، باید حدود ۳۰۰ تا ۵۰۰ کالری بیشتر از TDEE مصرف کنید (Calorie Surplus). دریافت پروتئین باید بین ۱.۶ تا ۲.۲ گرم به ازای هر کیلوگرم وزن بدن باشد. این مازاد کالری به همراه برنامه تمرینی بدنسازی اصولی، شرط اصلی رشد عضلانی است.",
          },
        },
        {
          "@type": "Question",
          name: "برای کاهش وزن چقدر کالری کم بخورم؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "برای کاهش وزن و چربی‌سوزی پایدار، کسری کالری ۲۵۰ تا ۵۰۰ کالری در روز پیشنهاد می‌شود — معادل کاهش ۰.۲۵ تا ۰.۵ کیلوگرم در هفته. کسری بیش از ۵۰۰ کالری باعث تحلیل عضلانی، افت انرژی و کاهش متابولیسم می‌شود. در دوره کات، دریافت پروتئین را بالا نگه دارید تا عضلات حفظ شوند.",
          },
        },
        {
          "@type": "Question",
          name: "درشت‌مغذی‌ها چیست و چگونه محاسبه می‌شود؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "درشت‌مغذی‌ها شامل پروتئین، کربوهیدرات و چربی هستند. برای محاسبه، ابتدا کالری هدف را تعیین کنید، سپس نسبت هر یک را بر اساس هدف تنظیم کنید: برای دوره حجم حدود ۳۰٪ پروتئین، ۴۵٪ کربوهیدرات، ۲۵٪ چربی؛ برای دوره کات حدود ۴۰٪ پروتئین، ۳۰٪ کربوهیدرات، ۳۰٪ چربی. هر گرم پروتئین و کربوهیدرات ۴ کالری و هر گرم چربی ۹ کالری دارد.",
          },
        },
        {
          "@type": "Question",
          name: "تفاوت BMR و TDEE چیست؟",
          acceptedAnswer: {
            "@type": "Answer",
            text: "BMR (Basal Metabolic Rate) کالری مصرفی بدن در حالت استراحت کامل برای حفظ عملکردهای حیاتی مثل تنفس، ضربان قلب و فعالیت مغز است. TDEE (Total Daily Energy Expenditure) برابر BMR ضرب در ضریب فعالیت روزانه است و کل کالری مصرفی شما را در طول روز نشان می‌دهد. TDEE همیشه بیشتر از BMR است و مبنای طراحی برنامه غذایی بدنسازی است.",
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">محاسبه‌گر کالری و TDEE</h1>
          <p className="text-sm text-slate-500">با فرمول علمی هریس-بندیکت، کالری روزانه، درشت‌مغذی‌ها و شاخص BMI خود را محاسبه کن</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <Card className="p-5 bg-white border-2" style={{ borderColor: "#fed7aa" }}>
            <h2 className="font-bold text-slate-900 mb-4">اطلاعات خود را وارد کنید</h2>
            <div className="space-y-4">
              {/* Gender */}
              <div>
                <Label className="mb-2 block text-slate-700">جنسیت</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["male", "female"] as const).map(g => (
                    <button key={g} onClick={() => setGender(g)} className={`p-3 rounded-xl border-2 transition font-bold text-sm ${gender === g ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-600"}`}>
                      {g === "male" ? "👨 آقا" : "👩 خانم"}
                    </button>
                  ))}
                </div>
              </div>
              {/* Age */}
              <div>
                <Label className="mb-2 block text-slate-700">سن (سال)</Label>
                <Input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="۲۵" className="rounded-xl text-center font-stat text-lg" />
              </div>
              {/* Height + Weight */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="mb-2 block text-slate-700">قد (cm)</Label>
                  <Input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="۱۷۵" className="rounded-xl text-center font-stat text-lg" />
                </div>
                <div>
                  <Label className="mb-2 block text-slate-700">وزن (kg)</Label>
                  <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="۷۵" className="rounded-xl text-center font-stat text-lg" />
                </div>
              </div>
              {/* Activity */}
              <div>
                <Label className="mb-2 block text-slate-700">سطح فعالیت روزانه</Label>
                <div className="space-y-1.5">
                  {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map(a => (
                    <button key={a} onClick={() => setActivity(a)} className={`w-full p-2.5 rounded-xl border-2 text-xs text-right transition ${activity === a ? "border-orange-500 bg-orange-50" : "border-slate-200"}`}>
                      <span className="font-bold text-slate-900">{ACTIVITY_LABELS[a]}</span>
                      <span className="text-slate-400 mr-2">×{ACTIVITY_FACTORS[a]}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Goal */}
              <div>
                <Label className="mb-2 block text-slate-700">هدف</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(GOAL_LABELS) as Goal[]).map(g => (
                    <button key={g} onClick={() => setGoal(g)} className={`p-2.5 rounded-xl border-2 text-xs font-bold transition ${goal === g ? "border-orange-500 bg-orange-50 text-orange-600" : "border-slate-200 text-slate-600"}`}>
                      {GOAL_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={calculate} className="flex-1 rounded-xl text-white font-bold" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <Flame className="w-4 h-4" /> محاسبه
                </Button>
                <Button onClick={reset} variant="outline" className="rounded-xl">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Results */}
          <div>
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div key="result" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                  {/* Target calories */}
                  <Card className="p-5 text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                    <div className="flex items-center gap-2 mb-2"><Flame className="w-5 h-5" /><span className="text-sm">کالری هدف روزانه</span></div>
                    <p className="text-4xl font-black font-stat">{toPersianDigits(result.targetCal.toLocaleString("en-US"))}</p>
                    <p className="text-xs opacity-80 mt-1">کیلوکالری در روز</p>
                  </Card>

                  {/* BMR + TDEE */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="p-4 bg-white border-2" style={{ borderColor: "#fed7aa" }}>
                      <p className="text-[10px] text-slate-500">BMR (متابولیسم پایه)</p>
                      <p className="text-2xl font-black font-stat text-slate-900">{toPersianDigits(result.bmr.toLocaleString("en-US"))}</p>
                      <p className="text-[10px] text-slate-400">کیلوکالری</p>
                    </Card>
                    <Card className="p-4 bg-white border-2" style={{ borderColor: "#fed7aa" }}>
                      <p className="text-[10px] text-slate-500">TDEE (مصرف کل)</p>
                      <p className="text-2xl font-black font-stat text-slate-900">{toPersianDigits(result.tdee.toLocaleString("en-US"))}</p>
                      <p className="text-[10px] text-slate-400">کیلوکالری</p>
                    </Card>
                  </div>

                  {/* BMI */}
                  <Card className="p-5 bg-white border-2" style={{ borderColor: "#fed7aa" }}>
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-orange-500" /> شاخص توده بدنی (BMI)
                    </h3>
                    <BmiDisplay bmi={result.bmi} />
                  </Card>

                  {/* Macros */}
                  <Card className="p-5 bg-white border-2" style={{ borderColor: "#fed7aa" }}>
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-orange-500" /> درشت‌مغذی‌ها</h3>
                    <div className="space-y-3">
                      <MacroBar icon={Beef} label="پروتئین" grams={result.protein} calories={result.protein * 4} total={result.targetCal} color="#f59e0b" />
                      <MacroBar icon={Wheat} label="کربوهیدرات" grams={result.carbs} calories={result.carbs * 4} total={result.targetCal} color="#06b6d4" />
                      <MacroBar icon={Droplet} label="چربی" grams={result.fat} calories={result.fat * 9} total={result.targetCal} color="#a855f7" />
                    </div>
                  </Card>

                  <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                    <Save className="w-3.5 h-3.5" />
                    اطلاعات شما در مرورگر ذخیره شد
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                  <Flame className="w-16 h-16 text-slate-200 mb-3" />
                  <p className="text-sm text-slate-400">اطلاعات خود را وارد کن و روی «محاسبه» کلیک کن</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── SEO Content Section ── */}
        <section className="mt-16 space-y-8">
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            <h2 className="text-2xl font-black text-slate-900">
              محاسبه‌گر کالری و TDEE فیتاپ
            </h2>
            <p>
              محاسبه‌گر کالری و TDEE فیتاپ یکی از مهم‌ترین ابزارها برای طراحی{" "}
              <strong>برنامه غذایی بدنسازی</strong> و <strong>رژیم غذایی</strong> هدفمند است.{" "}
              TDEE (Total Daily Energy Expenditure) نشان‌دهنده کل کالری مصرفی بدن شما در طول یک روز است و پایه طراحی هر{" "}
              <strong>برنامه حجمی</strong> یا <strong>برنامه کات (چربی‌سوزی)</strong> به‌شمار می‌رود. با دانستن دقیق کالری روزانه، می‌توانید برای{" "}
              <strong>افزایش حجم عضلانی</strong> در دوره حجم یا <strong>کاهش وزن</strong> و{" "}
              <strong>خشک کردن بدن</strong> در دوره کات برنامه‌ریزی دقیق داشته باشید.
            </p>
            <p>
              این ابزار با استفاده از فرمول علمی <strong>هریس-بندیکت (Harris-Benedict)</strong>، ابتدا BMR یا نرخ متابولیسم پایه (Basal Metabolic Rate) شما را محاسبه می‌کند — یعنی کالری مورد نیاز بدن در حالت استراحت کامل برای حفظ عملکردهای حیاتی. سپس با در نظر گرفتن سطح فعالیت روزانه شما، مقدار TDEE به‌دست می‌آید که نشان می‌دهد روزانه چند کالری مصرف می‌کنید.
            </p>

            <h3 className="text-xl font-bold text-slate-900 pt-2">
              کالری برای افزایش حجم عضلانی (Calorie Surplus)
            </h3>
            <p>
              برای <strong>عضله‌سازی</strong> و <strong>افزایش حجم عضلانی</strong> در دوره حجم (Bulking)، باید کالری دریافتی خود را حدود {toPersianDigits("۳۰۰")} تا {toPersianDigits("۵۰۰")} کالری بیشتر از TDEE مصرف کنید. این مازاد کالری به همراه <strong>برنامه تمرینی بدنسازی</strong> اصولی و دریافت کافی <strong>پروتئین</strong>، شرط اصلی رشد عضلانی است. توجه کنید که مازاد بیش از حد به جای عضله، چربی ذخیره می‌کند.
            </p>

            <h3 className="text-xl font-bold text-slate-900 pt-2">
              کالری برای چربی‌سوزی و کاهش وزن (Calorie Deficit)
            </h3>
            <p>
              برای <strong>چربی‌سوزی</strong>، <strong>کاهش وزن</strong> و <strong>خشک کردن بدن</strong> در دوره کات (Cutting)، باید کالری دریافتی خود را {toPersianDigits("۲۵۰")} تا {toPersianDigits("۵۰۰")} کالری کمتر از TDEE مصرف کنید. این کسری کالری باعث می‌شود بدن به ذخایر چربی رجوع کند. حفظ دریافت پروتئین بالا در این دوره، از تحلیل رفتن عضلات جلوگیری می‌کند و کیفیت <strong>بدنسازی طبیعی</strong> را بالا می‌برد.
            </p>

            <h3 className="text-xl font-bold text-slate-900 pt-2">
              درشت‌مغذی‌ها (Macros): پروتئین، کربوهیدرات، چربی
            </h3>
            <p>
              <strong>درشت‌مغذی‌ها</strong> سه جزء اصلی هر <strong>برنامه غذایی بدنسازی</strong> هستند:
            </p>
            <ul className="list-disc pr-5 space-y-1.5">
              <li>
                <strong>پروتئین</strong> ({toPersianDigits("۴")} کالری در هر گرم): بلوک سازنده عضله — برای عضله‌سازی و جلوگیری از تحلیل عضلانی در دوره کات ضروری است.
              </li>
              <li>
                <strong>کربوهیدرات</strong> ({toPersianDigits("۴")} کالری در هر گرم): سوخت اصلی تمرین بدنسازی و بازسازی ذخایر گلیکوژن عضلانی.
              </li>
              <li>
                <strong>چربی</strong> ({toPersianDigits("۹")} کالری در هر گرم): تنظیم‌کننده هورمون‌ها از جمله تستوسترون — حیاتی برای سلامتی و رشد عضلانی.
              </li>
            </ul>
            <p>
              با محاسبه کالری هدف و تعیین نسبت درشت‌مغذی‌ها، می‌توانید بهترین <strong>برنامه غذایی بدنسازی</strong> را برای هدف خود — چه حجم، چه کات و چه تثبیت وزن — طراحی کنید.
            </p>
          </div>

          {/* FAQ */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              سوالات متداول درباره محاسبه کالری و TDEE
            </h3>
            <Accordion
              type="single"
              collapsible
              className="w-full bg-white rounded-2xl border-2 px-4"
              style={{ borderColor: "#fed7aa" }}
            >
              <AccordionItem value="q1">
                <AccordionTrigger>چگونه کالری روزانه خود را محاسبه کنم؟</AccordionTrigger>
                <AccordionContent>
                  برای محاسبه کالری روزانه، ابتدا BMR (متابولیسم پایه) را با فرمول هریس-بندیکت بر اساس سن، جنسیت، قد و وزن به‌دست آورید، سپس آن را در ضریب فعالیت روزانه ضرب کنید تا TDEE به‌دست آید. این مقدار همان کالری روزانه شما برای تثبیت وزن است. سپس بر اساس هدف (حجم، کات یا تثبیت) ۳۰۰ تا ۵۰۰ کالری به آن اضافه یا کم کنید.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>برای عضله‌سازی چند کالری نیاز دارم؟</AccordionTrigger>
                <AccordionContent>
                  برای عضله‌سازی و افزایش حجم عضلانی، باید حدود ۳۰۰ تا ۵۰۰ کالری بیشتر از TDEE مصرف کنید (Calorie Surplus). دریافت پروتئین باید بین ۱.۶ تا ۲.۲ گرم به ازای هر کیلوگرم وزن بدن باشد. این مازاد کالری به همراه برنامه تمرینی بدنسازی اصولی، شرط اصلی رشد عضلانی است.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>برای کاهش وزن چقدر کالری کم بخورم؟</AccordionTrigger>
                <AccordionContent>
                  برای کاهش وزن و چربی‌سوزی پایدار، کسری کالری ۲۵۰ تا ۵۰۰ کالری در روز پیشنهاد می‌شود — معادل کاهش ۰.۲۵ تا ۰.۵ کیلوگرم در هفته. کسری بیش از ۵۰۰ کالری باعث تحلیل عضلانی، افت انرژی و کاهش متابولیسم می‌شود. در دوره کات، دریافت پروتئین را بالا نگه دارید تا عضلات حفظ شوند.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger>درشت‌مغذی‌ها چیست و چگونه محاسبه می‌شود؟</AccordionTrigger>
                <AccordionContent>
                  درشت‌مغذی‌ها شامل پروتئین، کربوهیدرات و چربی هستند. برای محاسبه، ابتدا کالری هدف را تعیین کنید، سپس نسبت هر یک را بر اساس هدف تنظیم کنید: برای دوره حجم حدود ۳۰٪ پروتئین، ۴۵٪ کربوهیدرات، ۲۵٪ چربی؛ برای دوره کات حدود ۴۰٪ پروتئین، ۳۰٪ کربوهیدرات، ۳۰٪ چربی. هر گرم پروتئین و کربوهیدرات ۴ کالری و هر گرم چربی ۹ کالری دارد.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5">
                <AccordionTrigger>تفاوت BMR و TDEE چیست؟</AccordionTrigger>
                <AccordionContent>
                  BMR (Basal Metabolic Rate) کالری مصرفی بدن در حالت استراحت کامل برای حفظ عملکردهای حیاتی مثل تنفس، ضربان قلب و فعالیت مغز است. TDEE (Total Daily Energy Expenditure) برابر BMR ضرب در ضریب فعالیت روزانه است و کل کالری مصرفی شما را در طول روز نشان می‌دهد. TDEE همیشه بیشتر از BMR است و مبنای طراحی برنامه غذایی بدنسازی است.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </div>
    </div>
  );
}

function BmiDisplay({ bmi }: { bmi: number }) {
  const cat = getBmiCategory(bmi);
  // BMI scale: 15 to 40 mapped to 0-100%
  const scalePct = Math.max(0, Math.min(100, ((bmi - 15) / (40 - 15)) * 100));
  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-3xl font-black font-stat text-slate-900">{toPersianDigits(bmi.toFixed(1))}</p>
          <p className="text-[10px] text-slate-400">kg/m²</p>
        </div>
        <div
          className="px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ background: cat.bg, color: cat.hexColor }}
        >
          {cat.label}
        </div>
      </div>
      {/* BMI scale bar */}
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{
        background: "linear-gradient(to left, #06b6d4 0%, #06b6d4 14%, #10b981 14%, #10b981 40%, #f59e0b 40%, #f59e0b 60%, #ef4444 60%, #ef4444 100%)"
      }}>
        {/* Marker for current BMI */}
        <motion.div
          initial={{ left: "0%" }}
          animate={{ left: `${scalePct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-800 shadow-md"
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-2">
        <span>کم‌وزن &lt; ۱۸.۵</span>
        <span>نرمال ۱۸.۵-۲۵</span>
        <span>اضافه‌وزن ۲۵-۳۰</span>
        <span>چاق &gt; ۳۰</span>
      </div>
    </div>
  );
}

function MacroBar({ icon: Icon, label, grams, calories, total, color }: { icon: any; label: string; grams: number; calories: number; total: number; color: string }) {
  const pct = Math.round((calories / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className="text-sm font-bold text-slate-700">{label}</span>
        </div>
        <div className="text-left">
          <span className="text-sm font-black font-stat text-slate-900">{toPersianDigits(grams)}g</span>
          <span className="text-[10px] text-slate-400 mr-1">({toPersianDigits(pct)}٪)</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color, width: `${pct}%` }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
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
