"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Apple,
  Flame,
  Beef,
  Wheat,
  Droplet,
  Plus,
  Trash2,
  Utensils,
  Sparkles,
  X,
  Check,
  Salad,
  Pill,
  ChevronLeft,
  Camera,
  Loader2,
  Upload,
  AlertTriangle,
  Search,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useAppStore, type LoggedFood } from "@/lib/fitness/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { fetchJson, fetchJsonOrThrow } from "@/lib/fitness/fetch-json";
import {
  canAccess,
  toPersianDigits,
  fixUnitOrder,
  stripUnitFromFoodName,
  type MealPlanContent,
} from "@/lib/fitness/types";

/**
 * فرمت اعداد تغذیه برای نمایش تمیز:
 * - گرد کردن به حداکثر یک رقم اعشار (۱۲.۳۴۵۶۷ → ۱۲.۳)
 * - حذف صفرهای بی‌مورد انتهایی (۱۲.۰ → ۱۲)
 * - تبدیل به ارقام فارسی
 *
 * باگ قبلی: مقادیر خام AI (مثل ۳۱.۵۴۹۹۹۹) یا جمع‌های floating-point
 * (مثل ۱۲۵.۴۰۰۰۰۰۰۰۰۰۰۰۰۱) بدون گرد شدن نمایش داده می‌شدند.
 */
function fmtNutrient(n: number | null | undefined): string {
  const v = Number(n) || 0;
  const r = Math.round(v * 10) / 10;
  return toPersianDigits(r % 1 === 0 ? String(Math.round(r)) : String(r));
}

/** گرد کردن مقدار عددی در لحظه ثبت/دریافت — ریشه‌ای‌ترین جای رفع باگ اعشار */
function roundNutrient<T extends number | null | undefined>(v: T): number {
  const n = Number(v) || 0;
  return Math.round(n * 10) / 10;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "صبحانه",
  lunch: "ناهار",
  dinner: "شام",
  snack: "میان‌وعده",
};

/** id یکتا برای غذاهای موقت — پسوند تصادفی برای جلوگیری از تصادم id (FE-L6) */
function tempFoodId(): string {
  return `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

type MealAnalysisStage = "idle" | "uploading" | "analyzing" | "done" | "error";

interface MealAnalysisResult {
  analysis: string;
  imageUrl: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: { name: string; calories: number; protein: number; carbs: number; fat: number }[];
  isFood: boolean;
}

export function NutritionView() {
  const {
    user,
    setMainTab,
    mealPlan,
    setMealPlan,
    caloriesConsumed,
    caloriesBurned,
    loggedFoods,
    addLoggedFood,
    removeLoggedFood,
    loadTodayFoodLogs,
  } = useAppStore();
  const [loading, setLoading] = useState(!mealPlan);
  const [showAddFood, setShowAddFood] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(0);

  // --- آنالیز عکس غذا (پلن پیشرفته+) ---
  const canAnalyzeMeal = canAccess(user?.planName ?? null, "mealPhotoAnalysis");
  const mealPhotoInputRef = useRef<HTMLInputElement>(null);

  // مرحله‌بندی مجزا برای آنالیز عکس غذا (وظیفه ۱)
  const [mealStage, setMealStage] = useState<MealAnalysisStage>("idle");
  const [mealUploadProgress, setMealUploadProgress] = useState(0); // 0-100
  const [mealAnalysisResult, setMealAnalysisResult] = useState<MealAnalysisResult | null>(null);
  const [mealAnalysisError, setMealAnalysisError] = useState<string>("");
  // پیش‌نمایش محلی عکس (قبل از آپلود) — برای نمایش فوری به کاربر
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>("");
  const [addingToLog, setAddingToLog] = useState(false);
  // وعده‌ای که غذا به آن اضافه می‌شود (پس از تحلیل)
  const [targetMealForAnalysis, setTargetMealForAnalysis] = useState<MealType>("snack");

  // بارگذاری غذاهای ثبت‌شده امروز از سرور (وظیفه ۴/۵)
  useEffect(() => {
    loadTodayFoodLogs();
  }, [loadTodayFoodLogs]);

  useEffect(() => {
    // Always fetch the CURRENT user's active meal plan fresh from the server
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coach/plan", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        setMealPlan(data.meal ? (data.meal as MealPlanContent) : null);
      } catch {
        // network error — keep whatever is in store
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** پاک‌سازی object URL هنگام unmount یا تغییر */
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  /**
   * انتخاب عکس غذا و شروع فرآیند ۳-مرحله‌ای:
   *  ۱) آپلود (با progress bar) — پیش‌نمایش محلی فوری
   *  ۲) تحلیل توسط هوش مصنوعی (spinner)
   *  ۳) نمایش نتایج + دکمه «افزودن به غذاهای امروز»
   *
   * fetch با keepalive: true → اگر کاربر از صفحه خارج شد، آپلود/تحلیل در پس‌زمینه ادامه می‌یابد.
   */
  const handleMealPhotoSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // ریست مقدار input تا همان فایل دوباره قابل انتخاب باشد
      e.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("فقط فایل تصویری مجاز است.");
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        toast.error("حداکثر حجم فایل ۳۰ مگابایت است.");
        return;
      }

      // پیش‌نمایش محلی فوری (وظیفه ۳: نمایش عکس آپلودشده)
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      const preview = URL.createObjectURL(file);
      setLocalPreviewUrl(preview);

      setMealAnalysisResult(null);
      setMealAnalysisError("");
      setMealStage("uploading");
      setMealUploadProgress(5);

      // شبیه‌سازی پیشرفت آپلود (fetch پیشرفت واقعی نمی‌دهد، اما حس بهتر می‌دهد)
      const fileSizeKB = file.size / 1024;
      const uploadEstimateMs = Math.min(4000, Math.max(800, fileSizeKB / 200));
      const tickInterval = uploadEstimateMs / 20;
      const tick = setInterval(() => {
        setMealUploadProgress((p) => {
          if (p >= 90) return p;
          return p + Math.max(1, Math.round((90 - p) / 8));
        });
      }, tickInterval);

      // مرحله ۲: ارسال به سرور برای تحلیل AI
      const fd = new FormData();
      fd.append("image", file);

      // مکث کوتاه برای اینکه کاربر مرحله آپلود را ببیند
      await new Promise((r) => setTimeout(r, 400));

      try {
        // مرحله: در حال تحلیل توسط هوش مصنوعی
        setMealStage("analyzing");
        setMealUploadProgress(100);

        // fetchJson: پاسخ HTML (خطای گیت‌وی/سرور) → خطای فارسی دوستانه
        // به‌جای «Unexpected token '<'» — پیام خطا مستقیم به کاربر نمایش داده می‌شود
        const { res, data } = await fetchJson<any>("/api/coach/meal-photo-analysis", {
          method: "POST",
          body: fd,
          // توجه: keepalive نگذارید — کروم بدنه‌های keepalive بزرگتر از 64KB را رد می‌کند
          // و عکس‌های واقعی دوربین هرگز به سرور نمی‌رسند.
        });

        if (!res.ok) {
          const errMsg =
            (data && (data.error || data.message)) ||
            `خطای سرور (${res.status}). لطفاً دوباره تلاش کنید.`;
          throw new Error(errMsg);
        }

        // موفقیت → مرحله ۳
        setMealAnalysisResult({
          analysis: data.analysis || "",
          imageUrl: data.imageUrl || preview, // fallback به پیش‌نمایش محلی
          description: data.description,
          calories: roundNutrient(data.calories),
          protein: roundNutrient(data.protein),
          carbs: roundNutrient(data.carbs),
          fat: roundNutrient(data.fat),
          items: Array.isArray(data.items) ? data.items : [],
          isFood: data.isFood !== false,
        });
        setMealStage("done");
        toast.success("آنالیز عکس غذا انجام شد! 🍽️");
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "خطا در ارتباط با سرور. لطفاً اتصال اینترنت را بررسی کنید.";
        setMealAnalysisError(msg);
        setMealStage("error");
        toast.error(msg);
      } finally {
        clearInterval(tick);
      }
    },
    [localPreviewUrl]
  );

  /** افزودن غذای تحلیل‌شده به لیست غذاهای امروز (وظیفه ۴) */
  function addAnalysisToToday() {
    if (!mealAnalysisResult) return;
    if (!mealAnalysisResult.isFood) {
      toast.error("این عکس غذا تشخیص داده نشد — نمی‌توان آن را ثبت کرد.");
      return;
    }
    setAddingToLog(true);
    try {
      addLoggedFood({
        id: tempFoodId(),
        name: mealAnalysisResult.items[0]?.name || "غذای تحلیل‌شده",
        meal: targetMealForAnalysis,
        calories: roundNutrient(mealAnalysisResult.calories),
        protein: roundNutrient(mealAnalysisResult.protein),
        carbs: roundNutrient(mealAnalysisResult.carbs),
        fat: roundNutrient(mealAnalysisResult.fat),
        loggedAt: new Date().toISOString(),
        servingSize: "۱ وعده (تخمین AI)",
        source: "ai_photo",
        imageUrl: mealAnalysisResult.imageUrl,
      });
      toast.success("به غذاهای امروز اضافه شد ✓");
    } catch (e) {
      toast.error("خطا در افزودن غذا");
    } finally {
      setAddingToLog(false);
    }
  }

  const targetCal = mealPlan?.totalCalories ?? 2200;
  // کالری سوزانده‌شده از store — جلسه تمرین (active-workout-session) آن را ست می‌کند
  // (قبلاً ۰ هاردکد بود؛ بخش «سوزانده» حالا داده واقعی نشان می‌دهد)
  const burnedCal = caloriesBurned;
  const remainingCal = Math.max(0, targetCal - caloriesConsumed + burnedCal);

  // Aggregate macros from logged foods (fallback to meal plan)
  const macroTotals = loggedFoods.length
    ? {
        protein: loggedFoods.reduce((s, f) => s + f.protein, 0),
        carbs: loggedFoods.reduce((s, f) => s + f.carbs, 0),
        fat: loggedFoods.reduce((s, f) => s + f.fat, 0),
      }
    : {
        protein: mealPlan?.totalProtein ?? 0,
        carbs: mealPlan?.totalCarbs ?? 0,
        fat: mealPlan?.totalFat ?? 0,
      };

  return (
    <div className="px-4 py-4 space-y-4 max-w-5xl mx-auto lg:px-6">
      {/* فایل مخفی برای انتخاب عکس غذا */}
      <input
        ref={mealPhotoInputRef}
        type="file"
        accept="image/*"
       
        className="hidden"
        onChange={handleMealPhotoSelect}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-2xl font-black">کالری‌شمار و تغذیه</h2>
          <p className="text-sm text-muted-foreground">هر لقمه رو ثبت کن، به هدفت نزدیک‌تر شو</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canAnalyzeMeal ? (
            <Button
              onClick={() => mealPhotoInputRef.current?.click()}
              disabled={mealStage === "uploading" || mealStage === "analyzing"}
              className="rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              title="عکس غذا رو آپلود کن، هوش مصنوعی کالری و درشت‌مغذی‌ها رو می‌شناسه"
            >
              {mealStage === "uploading" || mealStage === "analyzing" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
              {/* C5: موبایل فقط آیکون نباشد — متن کوتاه «عکس غذا» (text-xs) + لیبل کامل دسکتاپ */}
              <span className="text-xs sm:hidden">عکس غذا</span>
              <span className="hidden sm:inline">آنالیز عکس غذا</span>
            </Button>
          ) : (
            /* C5: پلن اقتصادی/استاندارد — دکمه همیشه دیده می‌شود (قفل‌شده با upsell) */
            <button
              onClick={() => {
                toast.info("تحلیل عکس غذا در پلن پیشرفته و بالاتر فعال است");
                setMainTab("plans");
              }}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50/40 text-orange-600 text-sm font-bold transition hover:bg-orange-50 shrink-0"
              title="تحلیل عکس غذا در پلن پیشرفته و بالاتر فعال است"
            >
              <Lock className="w-5 h-5 shrink-0" />
              <span className="text-xs sm:hidden">عکس غذا</span>
              <span className="hidden sm:inline">آنالیز عکس غذا</span>
            </button>
          )}
          <Button onClick={() => setShowAddFood(true)} className="rounded-xl">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">ثبت غذا</span>
          </Button>
        </div>
      </div>

      {/* ═════ کارت مراحل آنالیز عکس غذا (وظیفه ۱) ═════ */}
      <AnimatePresence mode="wait">
        {(mealStage !== "idle" || mealAnalysisResult) && (
          <motion.div
            key={mealStage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <MealAnalysisCard
              stage={mealStage}
              progress={mealUploadProgress}
              result={mealAnalysisResult}
              error={mealAnalysisError}
              localPreviewUrl={localPreviewUrl}
              targetMeal={targetMealForAnalysis}
              onTargetMealChange={setTargetMealForAnalysis}
              onAddToToday={addAnalysisToToday}
              adding={addingToLog}
              alreadyAdded={false}
              onClose={() => {
                setMealStage("idle");
                setMealAnalysisResult(null);
                setMealAnalysisError("");
                if (localPreviewUrl) {
                  URL.revokeObjectURL(localPreviewUrl);
                  setLocalPreviewUrl("");
                }
              }}
              onRetry={() => mealPhotoInputRef.current?.click()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : !mealPlan ? (
        <Card className="p-8 text-center border-2 border-orange-200 bg-orange-50/30">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Salad className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-black text-lg text-slate-900 mb-2">برنامه غذایی شما ساخته نشده</h3>
          <p className="text-sm text-slate-500 mb-5">
            {user?.planName
              ? "فیتاپ هوشمند می‌تواند همین حالا برنامه غذایی شخصی‌سازی‌شده برای شما بسازد."
              : "برای دریافت برنامه غذایی اختصاصی، ابتدا یک پلن خریداری کنید."}
          </p>
          {user?.planName ? (
            <Button
              onClick={async () => {
                try {
                  // قرارداد جدید: PUT /api/coach/plan برنامه را سینکرون نمی‌سازد —
                  // پاسخ فوری {started, programStatus, message} برمی‌گردد و تولید
                  // در پس‌زمینه انجام می‌شود. fetchJsonOrThrow خطای HTML گیت‌وی را
                  // هم به پیام فارسی تبدیل می‌کند.
                  await fetchJsonOrThrow<any>(
                    "/api/coach/plan",
                    { method: "PUT" },
                    "خطا در ساخت برنامه"
                  );
                  toast.success(
                    "برنامه شما در حال ساخت است ⏳ پس از آماده‌سازی به شما اطلاع می‌دهیم."
                  );
                  // دوباره GET بزن — تا تولید کامل شود mealPlan هنوز null است
                  // (طبیعی است؛ پس از آماده‌شدن نوتیفیکیشن می‌دهد)
                  const { res: planRes, data: planData } = await fetchJson<any>(
                    "/api/coach/plan",
                    { cache: "no-store" }
                  );
                  if (planRes.ok) {
                    setMealPlan(planData?.meal ? (planData.meal as MealPlanContent) : null);
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "خطا در ساخت برنامه");
                }
              }}
              className="rounded-xl text-white gap-2"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <Sparkles className="w-4 h-4" /> ساخت برنامه غذایی
            </Button>
          ) : (
            <Button
              onClick={() => useAppStore.getState().setMainTab("plans")}
              className="rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              خرید پلن
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Calorie formula bar */}
          <Card className="p-5 glass">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-400" />
              <h3 className="font-bold">وضعیت کالری امروز</h3>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs mb-4">
              <span className="px-2.5 py-1 rounded-lg bg-muted/60">
                <b className="text-cyan-400">{toPersianDigits(targetCal)}</b> هدف
              </span>
              <span className="text-muted-foreground">−</span>
              <span className="px-2.5 py-1 rounded-lg bg-muted/60">
                <b className="text-orange-400">{toPersianDigits(caloriesConsumed)}</b> مصرف
              </span>
              <span className="text-muted-foreground">+</span>
              <span className="px-2.5 py-1 rounded-lg bg-muted/60">
                <b className="text-emerald-400">{toPersianDigits(burnedCal)}</b> تمرین
              </span>
              <span className="text-muted-foreground">=</span>
              <span className="px-2.5 py-1 rounded-lg bg-primary/15">
                <b className="text-primary">{toPersianDigits(remainingCal)}</b> باقی‌مانده
              </span>
            </div>
            <div className="h-4 rounded-full bg-muted overflow-hidden flex relative">
              <motion.div
                className="h-full bg-gradient-to-l from-orange-400 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (caloriesConsumed / targetCal) * 100)}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              {remainingCal > 0
                ? `${toPersianDigits(remainingCal)} کالری دیگه می‌تونی بخوری`
                : "به هدف کالری رسیدی! 🎯"}
            </p>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Macro donut */}
            <Card className="p-5 glass">
              <div className="flex items-center gap-2 mb-4">
                <Beef className="w-5 h-5 text-primary" />
                <h3 className="font-bold">درشت‌مغذی‌ها (ماکروها)</h3>
              </div>
              <MacroDonut
                protein={macroTotals.protein}
                carbs={macroTotals.carbs}
                fat={macroTotals.fat}
              />
            </Card>

            {/* Today's meals from plan — full meal plan with food items */}
            <Card className="p-5 glass border-2 border-orange-200">
              <div className="flex items-center gap-2 mb-4">
                <Utensils className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-slate-900">برنامه غذایی امروز — چه بخوریم؟</h3>
              </div>
              <div className="space-y-2">
                {mealPlan?.meals.map((meal, i) => {
                  const expanded = expandedMeal === i;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-orange-100 overflow-hidden bg-white"
                    >
                      <button
                        onClick={() => setExpandedMeal(expanded ? null : i)}
                        className="w-full flex items-center justify-between p-3 hover:bg-orange-50/50 transition"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getMealIcon(meal.type)}</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-slate-900">{meal.label}</span>
                            <span className="block text-[10px] text-slate-400">
                              {toPersianDigits(meal.items?.length || 0)} مورد •{" "}
                              {fmtNutrient(meal.totalCalories)} کالری
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">
                            P: {toPersianDigits(Math.round(meal.totalProtein))}g
                          </span>
                          <motion.div
                            animate={{ rotate: expanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronLeft className="w-4 h-4 text-orange-500" />
                          </motion.div>
                        </div>
                      </button>
                      {expanded && meal.items && meal.items.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="border-t border-orange-50 bg-orange-50/30"
                        >
                          {meal.combination && (
                            <div className="p-2 bg-emerald-50/50 border-b border-emerald-100">
                              <p className="text-[11px] text-emerald-700 font-medium">
                                🍽 ترکیب این وعده:{" "}
                                <span className="font-bold">{meal.combination}</span>
                              </p>
                            </div>
                          )}
                          {meal.items.map((item, j) => (
                            <div
                              key={j}
                              className="flex items-start justify-between p-2.5 border-b last:border-0 border-orange-50/50"
                            >
                              <div className="flex-1 min-w-0">
                                {/* نام غذا — واحد تکراری (اگر در نام بود و همان servingSize است) حذف می‌شود (رفع باگ T10) */}
                                <p className="text-xs font-bold text-slate-900">{stripUnitFromFoodName(item.name, item.servingSize)}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                                  {item.servingSize && <span>🍽 {fixUnitOrder(item.servingSize)}</span>}
                                  <span>🔥 {fmtNutrient(item.calories)} کالری</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-[9px] text-slate-400 shrink-0 mr-2">
                                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                                  P {fmtNutrient(item.protein)}g
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                                  C {fmtNutrient(item.carbs)}g
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                                  F {fmtNutrient(item.fat)}g
                                </span>
                              </div>
                            </div>
                          ))}
                          {meal.alternatives && meal.alternatives.length > 0 && (
                            <div className="p-2.5 bg-purple-50/30 border-t border-purple-100">
                              <p className="text-[10px] font-bold text-purple-700 mb-1.5 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> غذاهای جایگزین (یکی را انتخاب کنید):
                              </p>
                              <div className="space-y-1.5">
                                {meal.alternatives.map((alt, ai) => (
                                  <div
                                    key={ai}
                                    className="p-2 rounded-lg bg-white border border-purple-100"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] font-bold text-purple-800">
                                        گزینه {toPersianDigits(ai + 1)}: {alt.combination}
                                      </span>
                                      <span className="text-[9px] text-purple-500">
                                        {fmtNutrient(alt.totalCalories)} کالری
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {alt.items.map((it, ii) => (
                                        <span
                                          key={ii}
                                          className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600"
                                        >
                                          {/* واحد تکراری نام حذف می‌شود؛ servingSize فقط همین‌جا یک‌بار */}
                                          {stripUnitFromFoodName(it.name, it.servingSize)} ({it.servingSize})
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
              {mealPlan?.notes && (
                <div className="mt-3 p-3 rounded-xl bg-orange-50/50 border border-orange-100">
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    💡 {mealPlan.notes}
                  </p>
                </div>
              )}
              {mealPlan?.waterLiters && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-cyan-600">
                  <Droplet className="w-3.5 h-3.5" />
                  آب روزانه: {toPersianDigits(mealPlan.waterLiters)} لیتر
                </div>
              )}
            </Card>
          </div>

          {/* Supplements */}
          {mealPlan?.supplements && mealPlan.supplements.length > 0 && (
            <Card className="p-5 border-2 border-orange-200 bg-orange-50/30">
              <div className="flex items-center gap-2 mb-3">
                <Pill className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-slate-900">برنامه مکمل‌های شما</h3>
              </div>
              <div className="space-y-2">
                {mealPlan.supplements.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-3 rounded-xl bg-white border border-orange-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{s.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                        {s.dose && <span>💊 {fixUnitOrder(s.dose)}</span>}
                        {s.timing && <span>⏰ {fixUnitOrder(s.timing)}</span>}
                      </div>
                      {s.note && <p className="text-[10px] text-slate-400 mt-1">{s.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Logged foods today */}
          <Card className="p-5 glass">
            <div className="flex items-center gap-2 mb-3">
              <Apple className="w-5 h-5 text-primary" />
              <h3 className="font-bold">غذاهای ثبت‌شده امروز</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground mr-auto">
                {toPersianDigits(loggedFoods.length)} مورد
              </span>
            </div>
            {loggedFoods.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Apple className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">هنوز غذایی ثبت نشده</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 rounded-xl"
                  onClick={() => setShowAddFood(true)}
                >
                  <Plus className="w-4 h-4" />
                  اولین غذات رو ثبت کن
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {loggedFoods.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-3 rounded-xl bg-white border-2 border-orange-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{getMealIcon(f.meal)}</span>
                          <p className="text-sm font-bold truncate">{stripUnitFromFoodName(f.name, f.servingSize)}</p>
                          {f.source === "ai_photo" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-bold shrink-0">
                              AI
                            </span>
                          )}
                          {f.source === "library" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-bold shrink-0">
                              بانک
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {MEAL_LABELS[f.meal]}
                          {f.servingSize ? ` • ${f.servingSize}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-orange-500 leading-none">
                            {fmtNutrient(f.calories)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">کالری</span>
                        </div>
                        <button
                          onClick={() => removeLoggedFood(f.id)}
                          className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive mt-1"
                          aria-label="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Macros row */}
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-orange-50">
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-yellow-50 text-yellow-700">
                        <Beef className="w-2.5 h-2.5" /> P {fmtNutrient(f.protein)}g
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700">
                        <Wheat className="w-2.5 h-2.5" /> C {fmtNutrient(f.carbs)}g
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700">
                        <Droplet className="w-2.5 h-2.5" /> F {fmtNutrient(f.fat)}g
                      </span>
                    </div>
                  </motion.div>
                ))}

                {/* Total bar */}
                <div
                  className="flex items-center justify-between p-3 rounded-xl text-white mt-3"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                >
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <Flame className="w-4 h-4" />
                    مجموع
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black">{toPersianDigits(caloriesConsumed)}</span>
                    <span className="text-xs opacity-90">کالری</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Add food modal — با autocomplete از بانک غذاها (وظیفه ۵) */}
      <AnimatePresence>
        {showAddFood && (
          <AddFoodModal
            onClose={() => setShowAddFood(false)}
            onAdd={(food) => {
              addLoggedFood(food);
              setShowAddFood(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// کارت مراحل آنالیز عکس غذا (وظیفه ۱: نمایش مراحل مجزا)
// ════════════════════════════════════════════════════════════════════════════
function MealAnalysisCard({
  stage,
  progress,
  result,
  error,
  localPreviewUrl,
  targetMeal,
  onTargetMealChange,
  onAddToToday,
  adding,
  onClose,
  onRetry,
}: {
  stage: MealAnalysisStage;
  progress: number;
  result: MealAnalysisResult | null;
  error: string;
  localPreviewUrl: string;
  targetMeal: MealType;
  onTargetMealChange: (m: MealType) => void;
  onAddToToday: () => void;
  adding: boolean;
  alreadyAdded: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  // نمایش عکس: اولویت با عکس سرور است، fallback به پیش‌نمایش محلی
  // (FOOD-IMG-FALLBACK): اگر عکس سرور لود نشد (مثلاً 404 یا شبکه)، به پیش‌نمایش
  // محلی (object URL در حافظه مرورگر) برمی‌گردیم تا کاربر هرگز عکسش را از دست ندهد.
  const [serverImageFailed, setServerImageFailed] = useState(false);
  const serverImage = result?.imageUrl || "";
  const displayImage =
    (serverImage && !serverImageFailed) ? serverImage : (localPreviewUrl || serverImage);

  return (
    <Card className="p-0 overflow-hidden border-2 border-orange-200 bg-orange-50/30">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 text-white"
        style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
      >
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4" />
          <h3 className="font-bold text-sm">آنالیز عکس غذا</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/20 transition"
          aria-label="بستن"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4">
        {/* ─── مرحله ۱: در حال آپلود ─── */}
        {stage === "uploading" && (
          <div className="flex items-start gap-3">
            {displayImage && (
              <img
                src={displayImage}
                alt="عکس غذای ارسالی"
                className="w-20 h-20 object-cover rounded-xl border border-orange-200 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-orange-500" />
                <p className="font-bold text-slate-900 text-sm">در حال آپلود عکس...</p>
              </div>
              <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-l from-orange-400 to-orange-500"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">{toPersianDigits(progress)}٪</p>
            </div>
          </div>
        )}

        {/* ─── مرحله ۲: در حال تحلیل توسط هوش مصنوعی ─── */}
        {stage === "analyzing" && (
          <div className="flex items-start gap-3">
            {displayImage && (
              <img
                src={displayImage}
                alt="عکس غذای ارسالی"
                className="w-20 h-20 object-cover rounded-xl border border-orange-200 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                <p className="font-bold text-slate-900 text-sm">در حال تحلیل توسط هوش مصنوعی...</p>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                هوش مصنوعی در حال شناسایی مواد غذایی، تخمین کالری و درشت‌مغذی‌هاست. چند ثانیه
                طول می‌کشد.
              </p>
              <div className="mt-2 space-y-1">
                {["شناسایی مواد غذایی...", "تخمین کالری و درشت‌مغذی‌ها...", "تدوین تحلیل..."].map(
                  (s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.6 }}
                      className="flex items-center gap-1.5 text-[11px] text-slate-600"
                    >
                      <CheckCircle2 className="w-3 h-3 text-orange-400" /> {s}
                    </motion.div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── مرحله ۳: تحلیل کامل شد ─── */}
        {stage === "done" && result && (
          <div className="space-y-3">
            {/* عکس + خلاصه */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="shrink-0">
                <img
                  src={displayImage}
                  alt="عکس غذای تحلیل‌شده"
                  className="w-full sm:w-28 h-28 object-cover rounded-xl border border-orange-200"
                  onError={() => setServerImageFailed(true)}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {!result.isFood && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-[11px] text-red-700 font-medium">
                      به‌نظر می‌رسد این عکس غذا نیست.
                    </p>
                  </div>
                )}
                <p className="text-sm text-slate-700 leading-relaxed">{result.description}</p>
                {result.isFood && (
                  <div className="grid grid-cols-4 gap-1.5">
                    <MacroStat label="کالری" value={fmtNutrient(result.calories)} color="orange" />
                    <MacroStat
                      label="پروتئین"
                      value={`${fmtNutrient(result.protein)}g`}
                      color="yellow"
                    />
                    <MacroStat
                      label="کربو"
                      value={`${fmtNutrient(result.carbs)}g`}
                      color="cyan"
                    />
                    <MacroStat
                      label="چربی"
                      value={`${fmtNutrient(result.fat)}g`}
                      color="purple"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* مواد غذایی شناسایی‌شده */}
            {result.items.length > 0 && (
              <div className="rounded-xl bg-white border border-orange-100 p-2.5">
                <p className="text-[11px] font-bold text-slate-700 mb-1.5">🍽 مواد شناسایی‌شده:</p>
                <div className="space-y-1">
                  {result.items.map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[11px] py-0.5"
                    >
                      <span className="text-slate-700">• {it.name}</span>
                      <span className="text-slate-500">{fmtNutrient(it.calories)} کالری</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* متن کامل تحلیل (collapsible) */}
            {result.analysis && (
              <details className="rounded-xl bg-orange-50/50 border border-orange-100 p-2.5">
                <summary className="text-[11px] font-bold text-orange-700 cursor-pointer">
                  مشاهده تحلیل کامل
                </summary>
                <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap mt-1.5">
                  {result.analysis}
                </p>
              </details>
            )}

            {/* دکمه «افزودن به غذاهای امروز» (وظیفه ۴) */}
            {result.isFood && (
              <div className="pt-1 space-y-2">
                <div>
                  <Label className="mb-1.5 block text-[11px] text-slate-700">
                    افزودن به کدام وعده؟
                  </Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => onTargetMealChange(m)}
                        className={`py-1.5 rounded-lg text-[11px] font-medium transition ${
                          targetMeal === m
                            ? "text-white"
                            : "bg-white text-slate-600 border border-orange-100"
                        }`}
                        style={
                          targetMeal === m
                            ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" }
                            : undefined
                        }
                      >
                        {MEAL_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={onAddToToday}
                  disabled={adding}
                  className="w-full rounded-xl h-10 font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                >
                  {adding ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> در حال افزودن...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus className="w-4 h-4" /> افزودن به غذاهای امروز
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ─── مرحله خطا ─── */}
        {stage === "error" && (
          <div className="space-y-3">
            {displayImage && (
              <img
                src={displayImage}
                alt="عکس غذای ارسالی"
                className="w-full max-h-40 object-cover rounded-xl border border-red-200"
              />
            )}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-red-700 text-sm">خطا در آنالیز عکس غذا</p>
                <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
            <Button
              onClick={onRetry}
              variant="outline"
              className="w-full rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              <Camera className="w-4 h-4" /> تلاش دوباره با عکس دیگر
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function MacroStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "orange" | "yellow" | "cyan" | "purple";
}) {
  const colorMap = {
    orange: "bg-orange-50 text-orange-600",
    yellow: "bg-yellow-50 text-yellow-700",
    cyan: "bg-cyan-50 text-cyan-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className={`rounded-lg p-1.5 text-center ${colorMap[color]}`}>
      <p className="text-sm font-black leading-none">{value}</p>
      <p className="text-[9px] mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Macro Donut
// ════════════════════════════════════════════════════════════════════════════
function MacroDonut({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein + carbs + fat || 1;
  const pPct = (protein / total) * 100;
  const cPct = (carbs / total) * 100;
  const fPct = (fat / total) * 100;

  const segments = [
    { pct: pPct, color: "#F4C542", label: "پروتئین", value: protein, icon: Beef },
    { pct: cPct, color: "#06b6d4", label: "کربوهیدرات", value: carbs, icon: Wheat },
    { pct: fPct, color: "#a855f7", label: "چربی", value: fat, icon: Droplet },
  ];

  let offset = 0;
  const c = 2 * Math.PI * 40;

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-32 h-32 shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted/30"
          />
          {segments.map((seg, i) => {
            const len = (seg.pct / 100) * c;
            const dasharray = `${len} ${c - len}`;
            const el = (
              <motion.circle
                key={i}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeDasharray={dasharray}
                strokeDashoffset={-offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.2 }}
                style={{ filter: `drop-shadow(0 0 3px ${seg.color}60)` }}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black">{toPersianDigits(Math.round(total))}</span>
          <span className="text-[10px] text-muted-foreground">گرم کل</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: seg.color }} />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{seg.label}</p>
              <p className="text-sm font-bold">
                {toPersianDigits(Math.round(seg.value))}g{" "}
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({toPersianDigits(Math.round(seg.pct))}٪)
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Add Food Modal — با autocomplete از بانک غذاها (وظیفه ۵)
// ════════════════════════════════════════════════════════════════════════════
interface FoodLibraryItem {
  id: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  imageUrl?: string;
  isVegan?: boolean;
}

function AddFoodModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (f: LoggedFood) => void;
}) {
  const [name, setName] = useState("");
  const [meal, setMeal] = useState<MealType>("snack");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [servings, setServings] = useState("1"); // تعداد وعده (ضریب)
  const [servingSize, setServingSize] = useState("۱ وعده");

  // autocomplete state
  const [searchResults, setSearchResults] = useState<FoodLibraryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodLibraryItem | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** جستجوی debounced در بانک غذاها وقتی کاربر تایپ می‌کند */
  function handleNameChange(value: string) {
    setName(value);
    setSelectedFood(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    setShowDropdown(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/foods/search?q=${encodeURIComponent(value.trim())}&limit=15`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({ foods: [] }));
        setSearchResults(Array.isArray(data.foods) ? data.foods : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  /** وقتی کاربر یک غذای از بانک را انتخاب کرد → پر کردن خودکار فیلدها */
  function selectFood(food: FoodLibraryItem) {
    setSelectedFood(food);
    setName(food.name);
    setServingSize(food.servingSize || "۱ وعده");
    setServings("1");
    setCalories(String(food.calories));
    setProtein(String(food.protein));
    setCarbs(String(food.carbs));
    setFat(String(food.fat));
    setShowDropdown(false);
  }

  /** وقتی تعداد وعده تغییر می‌کند، مقادیر غذایی را به نسبت ضریب محاسبه کن */
  function handleServingsChange(value: string) {
    setServings(value);
    if (!selectedFood) return;
    const mult = Number(value) || 1;
    setCalories(String(Math.round(selectedFood.calories * mult)));
    setProtein(String(Math.round(selectedFood.protein * mult * 10) / 10));
    setCarbs(String(Math.round(selectedFood.carbs * mult * 10) / 10));
    setFat(String(Math.round(selectedFood.fat * mult * 10) / 10));
  }

  function submit() {
    if (!name || !calories) return;
    onAdd({
      id: tempFoodId(),
      name,
      meal,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      loggedAt: new Date().toISOString(),
      servingSize: `${toPersianDigits(Number(servings) || 1)} وعده${
        selectedFood ? ` (${selectedFood.servingSize})` : ""
      }`,
      source: selectedFood ? "library" : "manual",
      foodLibraryId: selectedFood?.id ?? null,
      imageUrl: selectedFood?.imageUrl ?? null,
    });
  }

  // بستن dropdown با کلیک بیرون
  function onNameBlur() {
    setTimeout(() => setShowDropdown(false), 200);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Apple className="w-5 h-5 text-primary" />
            ثبت سریع غذا
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* نام غذا با autocomplete (وظیفه ۵) */}
          <div className="relative">
            <Label className="mb-1.5 block text-sm">
              نام غذا{" "}
              <span className="text-[10px] text-muted-foreground">
                (از بانک غذاها جستجو کن یا دستی وارد کن)
              </span>
            </Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={onNameBlur}
                onFocus={() => name.trim() && setShowDropdown(true)}
                placeholder="مثلاً سینه مرغ، برنج، تخم‌مرغ..."
                className="rounded-xl pr-9"
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Dropdown نتایج جستجو */}
            {showDropdown && (searchResults.length > 0 || (!searching && name.trim())) && (
              <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl bg-white border border-orange-100 shadow-lg custom-scrollbar">
                {searchResults.length === 0 ? (
                  <div className="p-3 text-center text-[11px] text-muted-foreground">
                    {name.trim().length < 2
                      ? "برای جستجو حداقل ۲ حرف تایپ کن"
                      : "غذایی پیدا نشد — مقادیر رو دستی وارد کن"}
                  </div>
                ) : (
                  searchResults.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => selectFood(food)}
                      className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-orange-50 transition text-right border-b last:border-0 border-orange-50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{stripUnitFromFoodName(food.name, food.servingSize)}</p>
                        <p className="text-[10px] text-slate-500">
                          {food.servingSize} •{" "}
                          <span className="text-orange-600 font-bold">
                            {toPersianDigits(food.calories)} کالری
                          </span>
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-bold">
                          P{toPersianDigits(food.protein)}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 font-bold">
                          C{toPersianDigits(food.carbs)}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">
                          F{toPersianDigits(food.fat)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* وعده غذایی */}
          <div>
            <Label className="mb-1.5 block text-sm">وعده غذایی</Label>
            <div className="grid grid-cols-4 gap-2">
              {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMeal(m)}
                  className={`py-2 rounded-xl text-xs font-medium transition ${
                    meal === m
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {MEAL_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* تعداد وعده (فقط وقتی غذای بانک انتخاب شده) */}
          {selectedFood && (
            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <Label className="mb-1 block text-xs text-emerald-700">
                تعداد وعده (ضریب)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  dir="ltr"
                  value={servings}
                  onChange={(e) => handleServingsChange(e.target.value)}
                  className="rounded-lg text-center text-sm h-9 w-24 bg-white"
                  min="0.5"
                  step="0.5"
                />
                <span className="text-[11px] text-emerald-700">
                  × {selectedFood.servingSize}
                </span>
                <div className="flex gap-1 ml-auto">
                  {[0.5, 1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleServingsChange(String(n))}
                      className="px-2 py-1 rounded-md bg-white border border-emerald-200 text-[11px] text-emerald-700 hover:bg-emerald-100"
                    >
                      {toPersianDigits(n)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* کالری + درشت‌مغذی‌ها */}
          <div>
            <Label className="mb-1.5 block text-sm">کالری</Label>
            <Input
              type="number"
              dir="ltr"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="250"
              className="rounded-xl text-center"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="mb-1 block text-xs text-yellow-500">پروتئین (g)</Label>
              <Input
                type="number"
                dir="ltr"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                placeholder="20"
                className="rounded-lg text-center text-sm h-9"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-cyan-400">کربو (g)</Label>
              <Input
                type="number"
                dir="ltr"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                placeholder="30"
                className="rounded-lg text-center text-sm h-9"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-purple-400">چربی (g)</Label>
              <Input
                type="number"
                dir="ltr"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                placeholder="8"
                className="rounded-lg text-center text-sm h-9"
              />
            </div>
          </div>

          <Button
            onClick={submit}
            disabled={!name || !calories}
            className="w-full rounded-xl h-11 font-bold text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Check className="w-4 h-4" />
            ثبت غذا
          </Button>

          {selectedFood && (
            <p className="text-[10px] text-emerald-600 text-center">
              ✓ از بانک غذاها — مقادیر به‌صورت خودکار پر شده‌اند
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function getMealIcon(type: string): string {
  const map: Record<string, string> = { breakfast: "🍳", lunch: "🍱", dinner: "🍽️", snack: "🍎" };
  return map[type] || "🍽️";
}
