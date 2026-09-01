"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Utensils,
  Flame,
  Beef,
  Wheat,
  Droplet,
  RefreshCw,
  Check,
  Droplets,
  Sparkles,
  Loader2,
  Lock,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  toPersianDigits,
  canAccess,
  fixUnitOrder,
  stripUnitFromFoodName,
  type MealPlanContent,
  type MealItem,
} from "@/lib/fitness/types";
import { toast } from "sonner";

export function NutritionOverlay() {
  const { user, mealPlan, setMealPlan, setOverlay } = useAppStore();
  const [loading, setLoading] = useState(!mealPlan);
  const canSwap = canAccess(user?.planName ?? null, "nutritionCompanion");
  const [swapping, setSwapping] = useState<string | null>(null);
  const [doneItems, setDoneItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!mealPlan) {
      (async () => {
        try {
          const res = await fetch("/api/coach/plan", { cache: "no-store" });
          const data = await res.json();
          if (data.meal) setMealPlan(data.meal as MealPlanContent);
        } catch {
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function swapFood(mealIdx: number, itemIdx: number, item: MealItem) {
    if (!canSwap) {
      toast.info("تغییر هوشمند غذا (Nutrition Companion) نیازمند پلن پیشرفته است");
      setOverlay("subscription");
      return;
    }
    setSwapping(`${mealIdx}_${itemIdx}`);
    try {
      const res = await fetch("/api/coach/swap-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodName: item.name, calories: item.calories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // ─── M1: گارد رندر — پاسخ نامعتبر/ناقص swap-food نباید undefined و NaN
      // وارد برنامه غذایی کند (مجموع کالری وعده/روز خراب می‌شد).
      const food = data?.food as
        | { name?: unknown; calories?: unknown; protein?: unknown; carbs?: unknown; fat?: unknown; servingSize?: unknown }
        | undefined;
      const foodName = typeof food?.name === "string" ? food.name.trim() : "";
      if (!foodName) {
        throw new Error("پاسخ نامعتبر از هوش مصنوعی. لطفاً دوباره تلاش کنید.");
      }
      const toNum = (v: unknown): number => {
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      // Update meal plan locally
      if (mealPlan) {
        const newMeals = [...mealPlan.meals];
        const newItems = [...newMeals[mealIdx].items];
        newItems[itemIdx] = {
          ...newItems[itemIdx],
          name: foodName,
          calories: toNum(food?.calories),
          protein: toNum(food?.protein),
          carbs: toNum(food?.carbs),
          fat: toNum(food?.fat),
          servingSize:
            typeof food?.servingSize === "string" && food.servingSize.trim()
              ? food.servingSize.trim()
              : "۱ وعده",
        };
        newMeals[mealIdx] = {
          ...newMeals[mealIdx],
          items: newItems,
          totalCalories: newItems.reduce((s, x) => s + (Number(x.calories) || 0), 0),
          totalProtein: newItems.reduce((s, x) => s + (Number(x.protein) || 0), 0),
          totalCarbs: newItems.reduce((s, x) => s + (Number(x.carbs) || 0), 0),
          totalFat: newItems.reduce((s, x) => s + (Number(x.fat) || 0), 0),
        };
        const updated = {
          ...mealPlan,
          meals: newMeals,
          totalCalories: newMeals.reduce((s, m) => s + (Number(m.totalCalories) || 0), 0),
          totalProtein: newMeals.reduce((s, m) => s + (Number(m.totalProtein) || 0), 0),
          totalCarbs: newMeals.reduce((s, m) => s + (Number(m.totalCarbs) || 0), 0),
          totalFat: newMeals.reduce((s, m) => s + (Number(m.totalFat) || 0), 0),
        };
        setMealPlan(updated);
        toast.success(`غذا با «${foodName}» جایگزین شد 🔄`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در جایگزینی غذا");
    } finally {
      setSwapping(null);
    }
  }

  function toggleDone(key: string) {
    setDoneItems((s) => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2">
          <Utensils className="w-5 h-5 text-primary" />
          <h2 className="font-bold">برنامه غذایی امروز</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOverlay(null)} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : !mealPlan ? (
          <div className="text-center py-12 text-muted-foreground">
            <Utensils className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>برنامه غذایی موجود نیست</p>
          </div>
        ) : (
          <>
            {/* Daily summary */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 text-white shadow-lg">
              <p className="text-sm text-white/80 mb-1">مجموع کالری امروز</p>
              <p className="text-3xl font-black mb-3">{toPersianDigits(mealPlan.totalCalories)} kcal</p>
              <div className="grid grid-cols-3 gap-2">
                <MacroPill icon={Beef} label="پروتئین" value={`${toPersianDigits(mealPlan.totalProtein)}g`} />
                <MacroPill icon={Wheat} label="کربو" value={`${toPersianDigits(mealPlan.totalCarbs)}g`} />
                <MacroPill icon={Droplet} label="چربی" value={`${toPersianDigits(mealPlan.totalFat)}g`} />
              </div>
            </div>

            {/* Water reminder */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
              <Droplets className="w-5 h-5 text-cyan-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">آب روزانه: {toPersianDigits(mealPlan.waterLiters)} لیتر</p>
                <p className="text-[11px] text-muted-foreground">منظم آب بنوشید!</p>
              </div>
            </div>

            {/* meals */}
            {mealPlan.meals.map((meal, mi) => {
              // M1: گارد NaN — قلم‌های نامعتبر (داده قدیمی/خراب) با ۰ جمع می‌شوند
              const mealProtein = meal.items.reduce((s, x) => s + (Number(x.protein) || 0), 0);
              const mealCarbs = meal.items.reduce((s, x) => s + (Number(x.carbs) || 0), 0);
              const mealFat = meal.items.reduce((s, x) => s + (Number(x.fat) || 0), 0);
              return (
              <div key={mi} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <span className="text-lg">{getMealIcon(meal.type)}</span>
                    {meal.label}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {toPersianDigits(meal.totalCalories)} کالری
                  </span>
                </div>
                <div className="space-y-2">
                  {meal.items.map((item, ii) => {
                    const key = `${mi}_${ii}`;
                    const isDone = doneItems[key];
                    const isSwapping = swapping === key;
                    return (
                      <motion.div
                        key={ii}
                        layout
                        className={`p-3 rounded-2xl border transition ${
                          isDone ? "border-emerald-500/30 bg-emerald-500/5" : "bg-card border-orange-100"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleDone(key)}
                            className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                              isDone
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-muted-foreground/30"
                            }`}
                            aria-label="علامت‌گذاری به عنوان خورده‌شده"
                          >
                            {isDone && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`font-medium text-sm ${isDone ? "line-through opacity-60" : ""}`}>
                                {/* نام غذا — واحد تکراری (اگر در نام بود و همان servingSize است) حذف می‌شود؛ واحد فقط یک‌بار در خط زیر */}
                                {stripUnitFromFoodName(item.name, item.servingSize)}
                              </p>
                              <button
                                onClick={() => swapFood(mi, ii, item)}
                                disabled={isSwapping}
                                className={`shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition disabled:opacity-50 ${
                                  canSwap
                                    ? "text-primary hover:bg-primary/10"
                                    : "text-muted-foreground/60 hover:bg-muted"
                                }`}
                                title={canSwap ? "تغییر هوشمند غذا" : "نیازمند پلن پیشرفته (Nutrition Companion)"}
                              >
                                {isSwapping ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : canSwap ? (
                                  <RefreshCw className="w-3 h-3" />
                                ) : (
                                  <Lock className="w-3 h-3" />
                                )}
                                {canSwap ? "تغییر" : "قفل"}
                              </button>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{fixUnitOrder(item.servingSize)}</p>
                            {/* Prominent calories + macros */}
                            <div className="flex items-center justify-between gap-2 mt-1.5">
                              <div className="flex items-baseline gap-1">
                                <span className="text-base font-black text-orange-500 leading-none">
                                  {toPersianDigits(item.calories)}
                                </span>
                                <span className="text-[10px] text-muted-foreground">کالری</span>
                              </div>
                              <div className="flex gap-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-yellow-50 text-yellow-700">
                                  <Beef className="w-2.5 h-2.5" /> {toPersianDigits(item.protein)}g
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-50 text-cyan-700">
                                  <Wheat className="w-2.5 h-2.5" /> {toPersianDigits(item.carbs)}g
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700">
                                  <Droplet className="w-2.5 h-2.5" /> {toPersianDigits(item.fat)}g
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Meal subtotal bar */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50 border border-orange-100 text-xs">
                  <span className="font-bold text-orange-700">جمع وعده</span>
                  <div className="flex items-center gap-3">
                    <span className="text-yellow-700 font-bold">P {toPersianDigits(mealProtein)}g</span>
                    <span className="text-cyan-700 font-bold">C {toPersianDigits(mealCarbs)}g</span>
                    <span className="text-purple-700 font-bold">F {toPersianDigits(mealFat)}g</span>
                    <span className="font-black text-orange-600">
                      {toPersianDigits(meal.totalCalories)} کالری
                    </span>
                  </div>
                </div>
              </div>
              );
            })}

            {/* Grand total */}
            <div
              className="sticky bottom-0 -mx-4 px-4 py-3 flex items-center justify-between text-white shadow-lg"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <span className="text-sm font-bold flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                مجموع کل امروز
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">{toPersianDigits(mealPlan.totalCalories)}</span>
                <span className="text-xs opacity-90">کالری</span>
              </div>
            </div>

            {/* AI note */}
            {mealPlan.notes && (
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-primary mb-1">یادداشت فیتاپ هوشمند</p>
                    <p className="text-xs text-muted-foreground">{mealPlan.notes}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function getMealIcon(type: string): string {
  const map: Record<string, string> = {
    breakfast: "🍳",
    lunch: "🍱",
    dinner: "🍽️",
    snack: "🍎",
  };
  return map[type] || "🍽️";
}

function MacroPill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-white/15 rounded-xl p-2 text-center">
      <Icon className="w-4 h-4 mx-auto mb-1" />
      <p className="text-xs font-bold">{value}</p>
      <p className="text-[10px] text-white/70">{label}</p>
    </div>
  );
}
