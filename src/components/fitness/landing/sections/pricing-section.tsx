"use client";

import React, { useState, useRef, useEffect } from "react";
import { Crown, Check, Sparkles, Wallet, ShieldCheck, Info, Star, Zap, ChevronDown } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { pushScreen, smartNavigate } from "@/lib/fitness/navigation";
import {
  toPersianDigits,
  formatToman,
  type SubscriptionPlan,
} from "@/lib/fitness/types";
import { usePlans } from "@/lib/fitness/use-plans";
import { getFeatureDescription } from "@/lib/fitness/feature-descriptions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PurchaseModal } from "./purchase-modal";

// جدول مقایسه قابلیت‌ها بین ۴ پلن (اقتصادی/استاندارد/پیشرفته/حرفه‌ای)
const COMPARISON_ROWS: { category: string; label: string; values: boolean[] }[] = [
  // امکانات عمومی (۴ ردیف) — همه پلن‌ها
  { category: "امکانات عمومی", label: "آنالیز کامل پروفایل ورزشی", values: [true, true, true, true] },
  { category: "امکانات عمومی", label: "برنامه تمرینی اختصاصی (۴۵ روزه)", values: [true, true, true, true] },
  { category: "امکانات عمومی", label: "برنامه تغذیه اختصاصی", values: [true, true, true, true] },
  { category: "امکانات عمومی", label: "پیگیری پیشرفت وزن", values: [true, true, true, true] },
  { category: "امکانات عمومی", label: "دسترسی به برنامه‌های قبلی خریداری‌شده", values: [true, true, true, true] },
  // امکانات استاندارد (۴ ردیف) — از استاندارد به بعد
  { category: "امکانات استاندارد", label: "گالری تصاویر پیشرفت", values: [false, true, true, true] },
  { category: "امکانات استاندارد", label: "برنامه مکمل‌های ورزشی اختصاصی", values: [false, true, true, true] },
  { category: "امکانات استاندارد", label: "۳ چکاپ دوره‌ای برای رصد پیشرفت", values: [false, true, true, true] },
  { category: "امکانات استاندارد", label: "داشبورد پیشرفته با تاریخچه و سوابق", values: [false, true, true, true] },
  { category: "امکانات استاندارد", label: "حفظ تاریخچه در ذهن فیتاپ برای برنامه‌های بعدی", values: [false, true, true, true] },
  // هوش مصنوعی (۶ ردیف) — از پیشرفته به بعد
  { category: "هوش مصنوعی", label: "چت بی‌نهایت با مربی هوشمند (متن + عکس)", values: [false, false, true, true] },
  { category: "هوش مصنوعی", label: "آنالیز هوشمند وعده‌های غذایی با عکس", values: [false, false, true, true] },
  { category: "هوش مصنوعی", label: "آنالیز هوشمند بدن با عکس", values: [false, false, true, true] },
  { category: "هوش مصنوعی", label: "حالت باشگاه (Gym Mode)", values: [false, false, true, true] },
  { category: "هوش مصنوعی", label: "دستیار تغذیه (Nutrition Companion)", values: [false, false, true, true] },
  { category: "هوش مصنوعی", label: "دسترسی کامل به کتابخانه متحرک حرکات", values: [false, false, true, true] },
  // امکانات حرفه‌ای (۵ ردیف) — فقط حرفه‌ای
  { category: "امکانات حرفه‌ای", label: "ارسال ویدیو در چت با مربی", values: [false, false, false, true] },
  { category: "امکانات حرفه‌ای", label: "آنالیز ویدیویی بدن قبل از طراحی برنامه", values: [false, false, false, true] },
  { category: "امکانات حرفه‌ای", label: "اصلاح تکنیک حرکات با ارسال ویدیو", values: [false, false, false, true] },
  { category: "امکانات حرفه‌ای", label: "تحلیل آزمایش خون (۴۷ ماده)", values: [false, false, false, true] },
  { category: "امکانات حرفه‌ای", label: "پشتیبانی اختصاصی و اولویت پاسخگویی", values: [false, false, false, true] },
];

const CATEGORY_LABELS = ["امکانات عمومی", "امکانات استاندارد", "هوش مصنوعی", "امکانات حرفه‌ای"];

export function PricingSection() {
  const { setScreen, user, setPendingPlanId } = useAppStore();
  const { plans: PLANS } = usePlans();
  const [purchasePlan, setPurchasePlan] = useState<SubscriptionPlan | null>(null);

  // When a plan is clicked: if user is logged in, open the purchase modal as before;
  // otherwise persist the chosen plan id and route to auth. After auth+onboarding+analysis,
  // the analysis screen will offer a one-tap purchase of the pending plan.
  function handleSelectPlan(plan: SubscriptionPlan) {
    if (user) {
      setPurchasePlan(plan);
    } else {
      setPendingPlanId(plan.id);
      smartNavigate(false, setScreen, false);
    }
  }

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-white relative overflow-hidden scroll-mt-20">
      {/* subtle background */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 right-0 w-96 h-96 rounded-full bg-amber-100/40 blur-3xl" />
        <div className="absolute bottom-20 left-0 w-80 h-80 rounded-full bg-orange-100/40 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div
          className="animate-fade-in-up text-center mb-12"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4"
            style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c" }}
          >
            <Crown className="w-4 h-4" />
            ۴ پلن اشتراک — هر بدنی فیتاپ میخواد
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 text-slate-900">
            پلن متناسب با{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #f59e0b, #f97316)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              هدف و بودجه
            </span>{" "}
            خودت را انتخاب کن
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            از پلن اقتصادی شروع کن یا با پلن حرفه‌ای، آنالیز ویدیویی و آزمایش خون را تجربه کن. همه پلن‌ها ۴۵ روزه و شامل ۱ فاز تمرینی هستند.
          </p>
        </div>

        {/* ۴ کارت قیمت‌گذاری — سفید با حاشیه طلایی پررنگ */}
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12 max-w-6xl mx-auto items-stretch">
          {PLANS.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              index={i}
              onSelect={() => handleSelectPlan(plan)}
            />
          ))}
        </div>

        {/* لینک برجسته‌تر به جدول مقایسه */}
        <div className="max-w-5xl mx-auto mb-6">
          <div
            className="animate-fade-in-up flex items-center justify-center gap-2 text-center"
          >
            <a
              href="#comparison-table"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 text-orange-700 text-sm font-bold hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10 transition-all"
            >
              <Info className="w-4 h-4" />
              مقایسه کامل ۴ پلن را ببینید
              <span className="text-orange-400">↓</span>
            </a>
          </div>
        </div>

        {/* جدول مقایسه تاشو */}
        <div id="comparison-table">
          <ComparisonTable />
        </div>

        {/* نشانه‌های اعتماد */}
        <div
          className="animate-fade-in flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-slate-500"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-orange-500" />
            پرداخت امن زرین‌پال
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-orange-500" />
            پرداخت با کیف پول
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            ۴۵ روز دسترسی کامل به پلتفرم
          </div>
        </div>
      </div>

      {purchasePlan && (
        <PurchaseModal
          plan={purchasePlan}
          onClose={() => setPurchasePlan(null)}
          onNeedLogin={() => {
            setPurchasePlan(null);
            smartNavigate(!!user, setScreen, user?.onboardingDone);
          }}
        />
      )}
    </section>
  );
}

function PlanCard({
  plan,
  index,
  onSelect,
}: {
  plan: SubscriptionPlan;
  index: number;
  onSelect: () => void;
}) {
  const isUltimate = plan.id === "ultimate";
  const isAdvanced = plan.id === "advanced";
  const price = plan.price;

  // Border styles: 3px thick gold gradient for Advanced/Ultimate, lighter for others
  const borderStyle: React.CSSProperties = isUltimate
    ? {
        background:
          "linear-gradient(135deg, #f59e0b 0%, #f97316 35%, #fbbf24 65%, #f59e0b 100%)",
        padding: "3px",
        boxShadow:
          "0 25px 50px -12px rgba(249, 115, 22, 0.45), 0 0 0 1px rgba(245, 158, 11, 0.2)",
      }
    : isAdvanced
    ? {
        background:
          "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #f97316 100%)",
        padding: "3px",
        boxShadow:
          "0 20px 40px -12px rgba(245, 158, 11, 0.4), 0 0 0 1px rgba(245, 158, 11, 0.15)",
      }
    : plan.id === "standard"
    ? {
        background:
          "linear-gradient(135deg, #fcd34d, #fbbf24)",
        padding: "2px",
        boxShadow: "0 10px 25px -10px rgba(251, 191, 36, 0.35)",
      }
    : {
        background:
          "linear-gradient(135deg, #e5e7eb, #d1d5db)",
        padding: "2px",
        boxShadow: "0 10px 25px -10px rgba(0, 0, 0, 0.1)",
      };

  return (
    <div
      style={{ ...borderStyle, animationDelay: `${index * 0.08}s` }}
      className="animate-fade-in-up relative rounded-[1.75rem] transition-all hover:-translate-y-2.5"
    >
      <div className="relative h-full rounded-[1.65rem] bg-white flex flex-col text-slate-900 overflow-hidden">
        {/* Shimmer overlay for premium plans */}
        {(isAdvanced || isUltimate) && (
          <div className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
            <div
              className="absolute -inset-x-20 top-0 h-32 blur-2xl"
              style={{
                background:
                  "linear-gradient(110deg, transparent 30%, rgba(245, 158, 11, 0.25) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
                animation: "gold-shimmer 3s infinite linear",
              }}
            />
          </div>
        )}

        {/* پیشنهاد ویژه badge for Advanced plan */}
        {isAdvanced && (
          <div className="absolute top-0 right-0 z-10">
            <div
              className="relative inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black px-3 py-1.5 text-white shadow-lg rounded-bl-2xl rounded-tr-[1.55rem]"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #f97316)",
              }}
            >
              <Star className="w-3 h-3 fill-white" />
              پیشنهادی
            </div>
          </div>
        )}

        <div className="p-6 pt-8 flex flex-col h-full flex-1">
          {/* Header */}
          <div className="text-center mb-4 mt-2">
            <h3 className="font-black text-xl text-slate-900">{plan.label}</h3>
            <p className="text-xs text-slate-500 mt-1 min-h-[2.5rem] flex items-center justify-center px-2">
              {plan.tagline}
            </p>
          </div>

          {/* Price section — large with gradient text */}
          <div className="text-center mb-5 py-4 border-y border-slate-100">
            <div className="flex items-end justify-center gap-1">
              <span
                className="text-4xl font-black leading-none"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: isAdvanced || isUltimate ? "drop-shadow(0 2px 6px rgba(249,115,22,0.25))" : "none",
                }}
              >
                {toPersianDigits(formatToman(price))}
              </span>
              <span className="text-sm text-slate-500 mb-1">تومان</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
              {toPersianDigits(plan.durationDays)} روزه — {toPersianDigits(plan.phases)} فاز تمرینی
            </p>
          </div>

          {/* Features */}
          <div className="space-y-2 mb-5 flex-1">
            {plan.features.map((f, j) => (
              <FeatureItemLanding key={j} text={f} />
            ))}
          </div>

          {/* Button — larger, more prominent with glow */}
          <button
            onClick={onSelect}
            className="w-full rounded-2xl h-14 font-bold text-sm text-white transition-all hover:scale-[1.03] flex items-center justify-center gap-2 shadow-xl"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #f97316)",
              boxShadow: isAdvanced
                ? "0 14px 30px -8px rgba(249, 115, 22, 0.55)"
                : "0 10px 24px -8px rgba(249, 115, 22, 0.4)",
            }}
          >
            <Crown className="w-4 h-4" />
            انتخاب پلن {plan.label}
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ComparisonTable() {
  const { plans: PLANS } = usePlans();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const timer = setTimeout(() => {
        triggerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Highlights: index 0=basic, 1=standard, 2=advanced, 3=ultimate
  const planHeaders = PLANS.map((p, idx) => {
    const isUltimate = p.id === "ultimate";
    const isAdvanced = p.id === "advanced";
    return {
      plan: p,
      idx,
      isUltimate,
      isAdvanced,
    };
  });

  return (
    <div className="max-w-6xl mx-auto scroll-mt-20">
      {/* Toggle button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-5 rounded-3xl bg-white border-2 border-orange-200 shadow-sm hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10 transition-all scroll-mt-20"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Info className="w-5 h-5 text-white" />
          </div>
          <div className="text-right">
            <p className="font-black text-slate-900 text-sm sm:text-base">مقایسه کامل امکانات ۴ پلن</p>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">تفاوت‌ها را در یک نگاه ببینید</p>
          </div>
        </div>
        <div
          className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0 transition-transform duration-300"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDown className="w-5 h-5 text-orange-500" />
        </div>
      </button>

      {/* Comparison content */}
      {isOpen && (
          <div
            className="overflow-hidden animate-fade-in"
          >
            <div className="pt-5">
              {/* Premium container with rounded-3xl + shadow */}
              <div className="rounded-3xl bg-gradient-to-b from-orange-50/60 to-white border border-orange-100 shadow-xl shadow-orange-500/5 p-3 sm:p-5">
                {/* Horizontal scroll wrapper for mobile */}
                <div className="overflow-x-auto custom-scrollbar -mx-1 px-1 pb-2">
                  <div className="min-w-[680px]">
                    {/* Plan header row — sticky at top of scroll container */}
                    <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-4 sticky top-0 z-10">
                      {/* "قابلیت" label column (right in RTL) */}
                      <div className="flex items-end justify-end pr-2 pb-1.5">
                        <span className="text-[11px] sm:text-xs text-slate-500 font-medium">قابلیت‌ها</span>
                      </div>
                      {/* 4 plan header cards */}
                      {planHeaders.map(({ plan, isUltimate, isAdvanced }) => (
                        <div
                          key={plan.id}
                          className={`relative rounded-2xl p-2.5 sm:p-3.5 text-center border-2 transition-all ${
                            isUltimate
                              ? "border-slate-800 bg-slate-900 text-white shadow-lg"
                              : isAdvanced
                              ? "border-orange-400 bg-orange-50 shadow-md shadow-orange-500/10"
                              : "border-slate-200 bg-white shadow-sm"
                          }`}
                        >
                          <p
                            className={`font-black text-xs sm:text-sm leading-tight ${
                              isUltimate ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {plan.label}
                          </p>
                          <p
                            className={`text-[10px] sm:text-[11px] mt-1 ${
                              isUltimate ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {toPersianDigits(formatToman(plan.price))} ت
                          </p>
                          <p
                            className={`text-[9px] mt-0.5 ${
                              isUltimate ? "text-slate-500" : "text-slate-500"
                            }`}
                          >
                            {toPersianDigits(plan.durationDays)} روزه
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Category sections */}
                    <div className="space-y-3">
                      {CATEGORY_LABELS.map((cat) => {
                        const rows = COMPARISON_ROWS.filter((r) => r.category === cat);
                        return (
                          <div
                            key={cat}
                            className="rounded-2xl bg-white border border-orange-100 overflow-hidden shadow-sm"
                          >
                            {/* Category header */}
                            <div className="px-4 sm:px-5 py-2.5 bg-gradient-to-l from-orange-50 to-amber-50/50 border-b border-orange-100 flex items-center gap-2">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                              />
                              <p className="text-xs sm:text-sm font-black text-orange-700">{cat}</p>
                              <span className="text-[10px] text-orange-400 mr-auto">
                                {toPersianDigits(rows.length)} قابلیت
                              </span>
                            </div>
                            {/* Rows */}
                            <div className="divide-y divide-slate-50">
                              {rows.map((row, i) => (
                                <div
                                  key={i}
                                  className="grid grid-cols-5 gap-2 sm:gap-3 items-center px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-orange-50/40 transition-colors group"
                                >
                                  {/* Feature name (right in RTL) */}
                                  <p className="text-[11px] sm:text-xs text-slate-700 font-medium leading-snug pr-1 text-right group-hover:text-slate-900 transition-colors">
                                    {row.label}
                                  </p>
                                  {/* 4 value columns — Advanced column highlighted */}
                                  {row.values.map((v, j) => {
                                    const isAdvancedCol = j === 2; // Advanced is index 2
                                    return (
                                      <div
                                        key={j}
                                        className={`flex items-center justify-center py-1.5 rounded-lg transition-colors ${
                                          isAdvancedCol ? "bg-orange-50/70" : ""
                                        }`}
                                      >
                                        {v ? (
                                          <div
                                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center shadow-sm"
                                            style={{
                                              background: "linear-gradient(135deg, #f59e0b, #f97316)",
                                              boxShadow: "0 2px 6px -1px rgba(249, 115, 22, 0.4)",
                                            }}
                                          >
                                            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" strokeWidth={3.5} />
                                          </div>
                                        ) : (
                                          <span className="text-slate-300 text-sm sm:text-base">—</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend / footer note */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                        >
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                        </span>
                        شامل این قابلیت
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 text-xs">
                          —
                        </span>
                        شامل این قابلیت نیست
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-md"
                          style={{ background: "rgba(245, 158, 11, 0.12)" }}
                        />
                        ستون پلن پیشرفته
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}

function FeatureItemLanding({ text }: { text: string }) {
  // hoverTip: دسکتاپ (همان رفتار قبلی) — pinnedTip: تاچ/کلیک
  const [hoverTip, setHoverTip] = useState(false);
  const [pinnedTip, setPinnedTip] = useState(false);
  const desc = getFeatureDescription(text);
  const showTip = hoverTip || pinnedTip;
  return (
    <div
      className={`relative flex items-start gap-2.5 group p-1.5 rounded-lg transition-colors ${
        pinnedTip ? "bg-orange-50" : "hover:bg-orange-50"
      }`}
      onMouseEnter={() => setHoverTip(true)}
      onMouseLeave={() => setHoverTip(false)}
      // تاچ: با ضربه باز/بسته می‌شود (آیکون Info قبلاً روی موبایل کاری نمی‌کرد)
      onClick={() => desc && setPinnedTip((v) => !v)}
      role={desc ? "button" : undefined}
      aria-expanded={desc ? showTip : undefined}
      tabIndex={desc ? 0 : undefined}
      onKeyDown={(e) => {
        if (desc && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setPinnedTip((v) => !v);
        }
      }}
    >
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
        style={{
          background: "linear-gradient(135deg, #f59e0b, #f97316)",
          boxShadow: "0 3px 8px -2px rgba(249, 115, 22, 0.5)",
        }}
      >
        <Check className="w-3 h-3 text-white" strokeWidth={3.5} />
      </div>
      <span className="text-xs text-slate-700 leading-relaxed flex-1 group-hover:text-slate-900 transition-colors font-medium">{text}</span>
      {desc && (
        <Info className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5 group-hover:text-orange-500 transition" />
      )}
      {showTip && desc && (
        <div
          className="animate-scale-in absolute bottom-full right-0 mb-2 z-30 w-56 p-3 rounded-xl text-[11px] leading-relaxed shadow-2xl bg-white"
          style={{ border: "1px solid #fed7aa" }}
        >
          <p className="font-bold mb-1 flex items-center gap-1 text-orange-600">
            <Info className="w-3.5 h-3.5" /> توضیح قابلیت
          </p>
          <p className="text-slate-600">{desc}</p>
        </div>
      )}
    </div>
  );
}
