"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell, Sparkles, ChevronLeft, ChevronRight, TrendingUp, Target,
  Activity, Crown, RefreshCw, Flame, Beef, Wheat, Droplet,
  Scale, Calendar, Ruler, Award, Heart, Bot,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  toPersianDigits, PLAN_LABELS,
  formatToman, type Plan,
} from "@/lib/fitness/types";
import { usePlans } from "@/lib/fitness/use-plans";
import { PurchaseModal } from "@/components/fitness/landing/sections/purchase-modal";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────────────
// Types returned by /api/onboarding/analysis
// ─────────────────────────────────────────────────────────────────────────────
interface MacroRec {
  targetCalories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  proteinPerKg: number;
  deficitPercent: number;
}

interface Trajectory {
  currentWeight: number;
  targetWeight: number;
  weeksToGoal: number;
  weeklyRate: number;
  weeklyCalorieAdjustment: number;
}

interface PlanRec {
  recommendedPlan: Plan;
  reason: string;
}

interface Measurements {
  chest?: number;
  arm?: number;
  waist?: number;
  hip?: number;
  thigh?: number;
  neck?: number;
}

interface BodyCompositionData {
  bodyFatPercent: number;
  leanBodyMass: number;
  fatMass: number;
  bodyFatCategory: string;
  bodyFatColor: string;
  muscleMassPercent: number | null;
  muscleMass: number | null;
}

interface AnalysisResponse {
  analysis: string;
  bmi: number;
  bmr: number;
  tdee: number;
  macros?: MacroRec;
  trajectory?: Trajectory | null;
  planRecommendation?: PlanRec;
  measurements?: Measurements;
  bodyComposition?: BodyCompositionData | null;
  fromCache?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Macro ring — circular progress for protein/carbs/fat (pure SVG, no deps)
// ─────────────────────────────────────────────────────────────────────────────
function MacroRing({
  label,
  grams,
  calories,
  color,
  icon,
}: {
  label: string;
  grams: number;
  calories: number;
  color: string;
  icon: React.ReactNode;
}) {
  const size = 84;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Each macro is shown as a fraction of its calorie contribution vs the
  // other two. This gives a sense of proportion rather than a fixed max.
  // We just render a fully-stroked ring with the grams label inside.
  const fillFraction = 0.78; // visual fill — purely aesthetic

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - fillFraction) }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-slate-400">{icon}</span>
          <span className="text-base font-black font-stat text-slate-900 leading-none">
            {toPersianDigits(grams)}
          </span>
          <span className="text-[9px] text-slate-400">گرم</span>
        </div>
      </div>
      <p className="text-xs font-bold text-slate-700">{label}</p>
      <p className="text-[10px] text-slate-400">{toPersianDigits(calories)} کیلوکالری</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Measurement chip
// ─────────────────────────────────────────────────────────────────────────────
function MeasurementChip({ label, value, unit = "سانتی‌متر" }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-2xl border-2 border-orange-100 bg-white p-3 text-center">
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-black font-stat text-slate-900 leading-none">
        {toPersianDigits(value)}
      </p>
      <p className="text-[9px] text-slate-400 mt-0.5">{unit}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// صفحه انتظار جذاب و اختصاصی برای تحلیل هوشمند
// ─────────────────────────────────────────────────────────────────────────────
function AnalysisLoadingScreen({ userName }: { userName?: string | null }) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: Scale, text: "تحلیل وزن و ترکیب بدن" },
    { icon: Target, text: "بررسی هدف و سطح فعالیت" },
    { icon: Activity, text: "محاسبه کالری و درشت‌مغذی‌ها" },
    { icon: Dumbbell, text: "طراحی برنامه تمرینی اختصاصی" },
    { icon: Sparkles, text: "تولید تحلیل هوشمند فیتاپ" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-amber-50 flex flex-col items-center justify-center px-6">
      {/* لوگو با انیمیشن */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="mb-8"
      >
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" width={80} height={80} className="object-cover" style={{ width: 80, height: 80 }} />
          </motion.div>
        </div>
      </motion.div>

      {/* نام کاربر + پیام */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-xl font-black text-slate-900 mb-2 text-center"
      >
        {userName ? `${userName} عزیز` : "ورزشکار گرامی"}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-slate-500 mb-10 text-center max-w-xs"
      >
        فیتاپ هوشمند در حال تحلیل اطلاعات شما و طراحی برنامه اختصاصی شماست
      </motion.p>

      {/* مراحل تحلیل */}
      <div className="w-full max-w-sm space-y-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isDone = i < step;
          const isActive = i === step;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.15 }}
              className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                isActive
                  ? "bg-white shadow-lg border-2 border-orange-200"
                  : isDone
                  ? "bg-emerald-50 border border-emerald-100"
                  : "bg-white/50 border border-slate-100"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isDone
                    ? "bg-emerald-500"
                    : isActive
                    ? "bg-gradient-to-br from-amber-500 to-orange-500"
                    : "bg-slate-100"
                }`}
              >
                {isDone ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <Sparkles className="w-5 h-5 text-white" />
                  </motion.div>
                ) : (
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400"}`} />
                )}
              </div>
              <span
                className={`text-sm font-medium transition-colors ${
                  isDone ? "text-emerald-700" : isActive ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {s.text}
              </span>
              {isActive && (
                <motion.div
                  className="mr-auto"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-4 h-4 text-orange-500" />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* نوار پیشرفت */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="w-full max-w-xs mt-8"
      >
        <div className="h-1.5 bg-orange-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #f59e0b, #f97316)" }}
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-[11px] text-slate-400 text-center mt-2">
          لطفاً صبر کنید — این پردازش چند ثانیه طول می‌کشد
        </p>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export function AnalysisScreen() {
  const { user, setScreen, setMainTab, pendingPlanId, setPendingPlanId } = useAppStore();
  const { plans: SUBSCRIPTION_PLANS } = usePlans();
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasePlanId, setPurchasePlanId] = useState<Plan | null>(null);

  async function loadAnalysis(force = false) {
    if (force) setRefreshing(true);
    try {
      const url = force ? "/api/onboarding/analysis?force=1" : "/api/onboarding/analysis";
      const res = await fetch(url);
      const json = await res.json();
      if (json.analysis) {
        setData(json as AnalysisResponse);
      }
    } catch {
      if (force) toast.error("خطا در بازخوانی تحلیل");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the pending plan object (if user came from landing)
  const pendingPlan = pendingPlanId
    ? SUBSCRIPTION_PLANS.find((p) => p.id === pendingPlanId) ?? null
    : null;

  // Resolve recommended plan object
  const recommendedPlan = data?.planRecommendation
    ? SUBSCRIPTION_PLANS.find((p) => p.id === data.planRecommendation!.recommendedPlan) ?? null
    : null;

  const bmi = data?.bmi ?? 0;
  const bmiCategory = bmi < 18.5 ? "کم‌وزن" : bmi < 25 ? "وزن نرمال" : bmi < 30 ? "اضافه‌وزن" : "چاق";
  const bmiColor = bmi < 18.5 ? "text-cyan-500" : bmi < 25 ? "text-emerald-500" : bmi < 30 ? "text-amber-500" : "text-red-500";

  function openPurchase(planId: Plan) {
    setPurchasePlanId(planId);
  }

  function handlePurchaseClose() {
    setPurchasePlanId(null);
    // Clear pendingPlanId once the user has gone through the purchase flow
    setPendingPlanId(null);
  }

  if (loading && !data) {
    return <AnalysisLoadingScreen userName={user?.name} />;
  }

  // ─── FE-M4: گارد حالت خالی/خطا ───
  // قبلاً اگر fetch fail می‌شد یا analysis وجود نداشت، data=null ولی رندر
  // ادامه می‌یافت و BMI=0 به‌عنوان «کم‌وزن» با توصیه‌های غلط نمایش داده می‌شد.
  if (!data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "rgba(245,158,11,0.12)" }}
        >
          <Activity className="w-8 h-8 text-orange-500" />
        </div>
        <h2 className="text-lg font-black text-slate-900 mb-2">تحلیلی برای نمایش وجود ندارد</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed max-w-xs">
          تحلیل شما پیدا نشد یا در دریافت آن خطایی رخ داد. لطفاً دوباره تلاش کنید.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setLoading(true);
              loadAnalysis();
            }}
          >
            <RefreshCw className="w-4 h-4" />
            تلاش مجدد
          </Button>
          <Button
            className="rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            onClick={() => setScreen("landing")}
          >
            بازگشت
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-lg border-b border-orange-100 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setScreen("landing")} className="p-2 rounded-lg hover:bg-orange-50" aria-label="بازگشت">
          {/* در RTL جهت بازگشت به راست است */}
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <span className="font-black text-slate-900">فیتاپ</span>
        </div>
        <div className="w-9" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">
            تحلیل اختصاصی شما
          </h1>
          <p className="text-sm text-slate-500">
            {user?.name ? `${user.name} عزیز، ` : ""}فیتاپ هوشمند اطلاعات شما را تحلیل کرد
          </p>
        </motion.div>

        {/* تحلیل فیتاپ هوشمند (مربی) — در اول صفحه */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="p-5 border-2 border-orange-200 relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-orange-100/40 blur-2xl" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-amber-100/40 blur-2xl" />

            <div className="relative">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">تحلیل فیتاپ هوشمند</h3>
                  <p className="text-[10px] text-slate-500">مربی هوشمند شما</p>
                </div>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-3 bg-orange-100 rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50/50 to-amber-50/30 border border-orange-100/50">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data?.analysis}</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Biometric cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <Card className="p-4 text-center border-2 border-orange-100">
            <p className="text-[10px] text-slate-500">شاخص BMI</p>
            <p className={`text-2xl font-black font-stat ${bmiColor}`}>{toPersianDigits(bmi.toFixed(1))}</p>
            <p className={`text-[10px] font-bold ${bmiColor}`}>{bmiCategory}</p>
          </Card>
          <Card className="p-4 text-center border-2 border-orange-100">
            <p className="text-[10px] text-slate-500">متابولیسم (BMR)</p>
            <p className="text-2xl font-black font-stat text-slate-900">{toPersianDigits(data?.bmr ?? 0)}</p>
            <p className="text-[10px] text-slate-400">کیلوکالری</p>
          </Card>
          <Card className="p-4 text-center border-2 border-orange-100">
            <p className="text-[10px] text-slate-500">کالری روزانه (TDEE)</p>
            <p className="text-2xl font-black font-stat text-slate-900">{toPersianDigits(data?.tdee ?? 0)}</p>
            <p className="text-[10px] text-slate-400">کیلوکالری</p>
          </Card>
        </motion.div>

        {/* Weight goal trajectory card */}
        {data?.trajectory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <Card className="p-5 border-2 border-orange-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <Target className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-slate-900">مسیر رسیدن به وزن هدف</h3>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 mb-1">وزن فعلی</p>
                  <p className="text-xl font-black font-stat text-slate-900">
                    {toPersianDigits(data.trajectory.currentWeight)}
                  </p>
                  <p className="text-[9px] text-slate-400">کیلوگرم</p>
                </div>

                {/* Progress bar */}
                <div className="flex-1 mx-3 relative">
                  <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #f59e0b, #f97316)" }}
                    />
                  </div>
                  <div className="flex items-center justify-center mt-1">
                    <Scale className="w-3 h-3 text-orange-500" />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-slate-500 mb-1">وزن هدف</p>
                  <p className="text-xl font-black font-stat text-orange-600">
                    {toPersianDigits(data.trajectory.targetWeight)}
                  </p>
                  <p className="text-[9px] text-slate-400">کیلوگرم</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-orange-50 p-3 text-center">
                  <Calendar className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-500">زمان رسیدن به هدف</p>
                  <p className="text-sm font-black font-stat text-slate-900">
                    {toPersianDigits(data.trajectory.weeksToGoal)} هفته
                  </p>
                </div>
                <div className="rounded-xl bg-orange-50 p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-500">نرخ هفتگی</p>
                  <p className="text-sm font-black font-stat text-slate-900">
                    {data.trajectory.weeklyRate > 0 ? "+" : ""}
                    {toPersianDigits(data.trajectory.weeklyRate.toFixed(2))} kg
                  </p>
                </div>
                <div className="rounded-xl bg-orange-50 p-3 text-center">
                  <Flame className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-500">تنظیم کالری روزانه</p>
                  <p className="text-sm font-black font-stat text-slate-900">
                    {data.trajectory.weeklyCalorieAdjustment > 0 ? "+" : ""}
                    {toPersianDigits(data.trajectory.weeklyCalorieAdjustment)}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-slate-500 text-center leading-relaxed">
                این مسیر بر اساس نرخ ایمن{" "}
                {data.trajectory.weeklyRate < 0
                  ? `کاهش ${toPersianDigits(0.5)} کیلوگرم در هفته`
                  : `افزایش ${toPersianDigits(0.25)} کیلوگرم در هفته`}{" "}
                محاسبه شده است. روند تغییر وزن نرمال و پایدار است.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Body measurements card */}
        {data?.measurements && Object.keys(data.measurements).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-5 border-2 border-orange-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <Ruler className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-slate-900">اندازه‌های بدن شما</h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {data.measurements.chest != null && (
                  <MeasurementChip label="دور سینه" value={data.measurements.chest} />
                )}
                {data.measurements.arm != null && (
                  <MeasurementChip label="دور بازو" value={data.measurements.arm} />
                )}
                {data.measurements.waist != null && (
                  <MeasurementChip label="دور کمر" value={data.measurements.waist} />
                )}
                {data.measurements.hip != null && (
                  <MeasurementChip label="دور باسن" value={data.measurements.hip} />
                )}
                {data.measurements.thigh != null && (
                  <MeasurementChip label="دور ران" value={data.measurements.thigh} />
                )}
                {data.measurements.neck != null && (
                  <MeasurementChip label="دور گردن" value={data.measurements.neck} />
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ─── NEW (BODY-COMPOSITION-PRO): Body Composition card ─── */}
        {data?.bodyComposition && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <Card className="p-5 border-2 border-orange-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900">ترکیب بدن شما</h3>
                </div>
              </div>

              {/* 3 main stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {/* Body Fat % */}
                <div
                  className="rounded-2xl p-4 text-center border-2"
                  style={{
                    borderColor: data.bodyComposition.bodyFatColor + "60",
                    background: data.bodyComposition.bodyFatColor + "10",
                  }}
                >
                  <p className="text-[10px] text-slate-500 mb-1">درصد چربی بدن</p>
                  <p
                    className="text-3xl font-black font-stat leading-none"
                    style={{ color: data.bodyComposition.bodyFatColor }}
                  >
                    {toPersianDigits(data.bodyComposition.bodyFatPercent.toFixed(1))}
                    <span className="text-base">٪</span>
                  </p>
                  <p
                    className="text-[10px] font-bold mt-1.5"
                    style={{ color: data.bodyComposition.bodyFatColor }}
                  >
                    {data.bodyComposition.bodyFatCategory}
                  </p>
                </div>

                {/* Lean Body Mass */}
                <div className="rounded-2xl p-4 text-center border-2 border-orange-100 bg-white">
                  <p className="text-[10px] text-slate-500 mb-1">جرم بدون چربی</p>
                  <p className="text-3xl font-black font-stat text-slate-900 leading-none">
                    {toPersianDigits(data.bodyComposition.leanBodyMass)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5">کیلوگرم</p>
                </div>

                {/* Fat Mass */}
                <div className="rounded-2xl p-4 text-center border-2 border-orange-100 bg-white">
                  <p className="text-[10px] text-slate-500 mb-1">جرم چربی</p>
                  <p className="text-3xl font-black font-stat text-slate-900 leading-none">
                    {toPersianDigits(data.bodyComposition.fatMass)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1.5">کیلوگرم</p>
                </div>
              </div>

              {/* Muscle mass (estimated) */}
              {data.bodyComposition.muscleMass != null && (
                <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-bold text-slate-700">درصد عضله تقریبی</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black font-stat text-orange-600">
                        {toPersianDigits(data.bodyComposition.muscleMassPercent?.toFixed(1) ?? "0")}
                      </span>
                      <span className="text-[10px] text-slate-500">٪</span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        ({toPersianDigits(data.bodyComposition.muscleMass)} کیلوگرم)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Scientific note */}
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  محاسبه بر اساس <b>فرمول علمی US Navy</b> (Hodgdon & Beckett, 1984).
                  این روش با اندازه‌گیری دور کمر، گردن و قد، معتبرترین تخمین بدون‌دستگاه چربی بدن را ارائه می‌دهد.
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Plan recommendation card */}
        {data?.planRecommendation && recommendedPlan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card
              className="p-5 border-2"
              style={{ borderColor: "#fed7aa", background: "linear-gradient(135deg, #fffbeb 0%, #ffffff 60%)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <Award className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-slate-900">پلن پیشنهادی فیتاپ</h3>
              </div>

              {/* Recommended plan mini-card */}
              <div
                className="rounded-2xl p-4 mb-3 text-white relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <div className="absolute -left-6 -top-6 w-20 h-20 rounded-full bg-white/10" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-black text-lg leading-tight">{recommendedPlan.label}</p>
                      <p className="text-[11px] opacity-90">{recommendedPlan.tagline}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-black font-stat text-lg leading-none">
                      {toPersianDigits(formatToman(recommendedPlan.price))}
                    </p>
                    <p className="text-[10px] opacity-80">تومان</p>
                  </div>
                </div>
                <div className="relative flex flex-wrap gap-1.5 mt-3">
                  {recommendedPlan.features.slice(0, 3).map((f, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 backdrop-blur">
                      ✓ {f}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {data.planRecommendation.reason}
              </p>

              <Button
                onClick={() => openPurchase(recommendedPlan.id)}
                className="w-full h-11 rounded-xl font-bold text-white"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <Crown className="w-4 h-4" />
                خرید پلن {PLAN_LABELS[recommendedPlan.id]}
              </Button>

              {/* ─── دیگر پلن‌ها — انتخاب هر پلن آزاد است (درخواست مالک) ─── */}
              {/* پلن پیشنهادی بالا فقط یک «پیشنهاد» هوشمند است؛ کاربر می‌تواند
                  همین‌جا هر پلنی (از جمله اقتصادی) را مستقیم انتخاب و بخرد. */}
              {(() => {
                const others = SUBSCRIPTION_PLANS.filter((p) => p.id !== recommendedPlan.id);
                if (others.length === 0) return null;
                return (
                  <div className="mt-3">
                    <p className="text-[11px] text-slate-500 text-center mb-2">
                      یا هر پلن دیگری را انتخاب کنید — انتخاب با خود شماست
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {others.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => openPurchase(p.id)}
                          className="rounded-xl border border-slate-200 bg-white p-2.5 text-center transition hover:border-orange-300 hover:shadow-md active:scale-95"
                        >
                          <p className="text-[11px] font-bold text-slate-700 truncate">{p.label}</p>
                          <p className="text-[11px] font-black font-stat mt-0.5" style={{ color: "#f97316" }}>
                            {toPersianDigits(formatToman(p.price))}
                          </p>
                          <p className="text-[9px] text-slate-400">تومان</p>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Card>
          </motion.div>
        )}

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-3 pt-2"
        >
          <p className="text-center text-sm font-bold text-slate-700">مسیر بعدی شما؟</p>

          {/* Pending plan CTA — primary */}
          {pendingPlan && (
            <button
              onClick={() => openPurchase(pendingPlan.id)}
              className="w-full p-5 rounded-2xl text-white shadow-xl shadow-orange-500/30 transition hover:scale-[1.02] flex items-center gap-4"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-right">
                <p className="font-black text-base">ادامه خرید پلن {pendingPlan.label}</p>
                <p className="text-xs opacity-90">
                  پلنی که انتخاب کردید — {toPersianDigits(formatToman(pendingPlan.price))} تومان
                </p>
              </div>
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* See all plans */}
          <button
            onClick={() => { setMainTab("plans"); setScreen("main"); }}
            className="w-full p-5 rounded-2xl border-2 border-orange-200 bg-white text-slate-700 shadow-sm transition hover:scale-[1.02] hover:border-orange-300 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6 text-orange-500" />
            </div>
            <div className="flex-1 text-right">
              <p className="font-black text-base">مشاهده همه پلن‌ها</p>
              <p className="text-xs text-slate-500">۴ پلن متناسب با هر هدف و بودجه</p>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>

          {/* Go to dashboard */}
          <button
            onClick={() => { setMainTab("dashboard"); setScreen("main"); }}
            className="w-full p-5 rounded-2xl border-2 border-slate-200 bg-white text-slate-700 shadow-sm transition hover:scale-[1.02] hover:border-slate-300 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-slate-500" />
            </div>
            <div className="flex-1 text-right">
              <p className="font-black text-base">رفتن به داشبورد</p>
              <p className="text-xs text-slate-500">از ابزارهای رایگان و امکانات پنل استفاده کنید</p>
            </div>
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>
        </motion.div>
      </div>

      {/* Purchase modal — user is already logged in at this point so checkout works */}
      {purchasePlanId && (() => {
        const plan = SUBSCRIPTION_PLANS.find((p) => p.id === purchasePlanId);
        return plan ? (
          <PurchaseModal
            plan={plan}
            onClose={handlePurchaseClose}
            onNeedLogin={() => handlePurchaseClose()}
          />
        ) : null;
      })()}
    </div>
  );
}
