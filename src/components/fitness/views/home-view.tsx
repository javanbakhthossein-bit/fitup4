"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Dumbbell,
  Apple,
  TrendingDown,
  Trophy,
  ChevronLeft,
  Calendar,
  Zap,
  Utensils,
  Sparkles,
  MessageCircle,
  Lock,
  Dumbbell as GymIcon,
  TestTube,
  Video,
  Crown,
  Salad,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  toPersianDigits,
  canAccess,
  PLAN_LABELS,
  GOAL_LABELS,
  PERSIAN_WEEKDAYS,
  type WorkoutPlanContent,
  type MealPlanContent,
} from "@/lib/fitness/types";

export function HomeView() {
  const { user, setMainTab, setOverlay, workoutPlan, setWorkoutPlan, mealPlan, setMealPlan } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");

  useEffect(() => {
    const dayIdx = new Date().getDay(); // 0 = Sunday
    // Convert to Persian week (Saturday = 0)
    const persianIdx = (dayIdx + 1) % 7;
    setToday(PERSIAN_WEEKDAYS[persianIdx]);

    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/coach/plan", { cache: "no-store" });
        const data = await res.json();
        if (data.workout) setWorkoutPlan(data.workout as WorkoutPlanContent);
        if (data.meal) setMealPlan(data.meal as MealPlanContent);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCal = mealPlan?.totalCalories ?? 0;

  return (
    <div className="px-4 py-4 space-y-4 max-w-md mx-auto">
      {/* Greeting hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-600 p-5 text-white shadow-xl"
      >
        <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -left-4 bottom-0 w-20 h-20 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-white/80 text-sm mb-1">{today}</p>
          <h2 className="text-2xl font-black mb-3">
            {getGreeting()}، {user?.name || "ورزشکار"}! 👋
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>برای امروز برنامه تمرینی و غذایی آماده داریم</span>
          </div>
        </div>
      </motion.div>

      {/* Subscription banner — بنر خرید پلن با مزایا */}
      {!user?.hasActiveSubscription && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setOverlay("subscription")}
          className="w-full text-right rounded-3xl overflow-hidden shadow-lg border-2 border-orange-200"
          style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)" }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-black text-sm text-slate-900">اشتراک فعال نیست</p>
                  <p className="text-[11px] text-slate-500">برای دسترسی به همه امکانات، پلن بخرید</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-white px-3 py-1.5 rounded-full shadow-sm">
                خرید پلن
                <ChevronLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            {/* مزایای خرید پلن */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "برنامه تمرینی هوشمند",
                "برنامه غذایی شخصی",
                "چت با مربی AI",
                "پیگیری پیشرفت",
              ].map((benefit) => (
                <span key={benefit} className="text-[10px] px-2 py-1 rounded-lg bg-white/70 text-slate-700 font-medium border border-orange-100">
                  ✓ {benefit}
                </span>
              ))}
            </div>
          </div>
        </motion.button>
      )}

      {/* Stats grid — کیف پول در top-bar نمایش داده می‌شود */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Flame}
          label="کالری هدف"
          value={loading ? null : toPersianDigits(totalCal)}
          unit="کیلوکالری"
          color="orange"
        />
        <StatCard
          icon={Dumbbell}
          label="حرکات تمرین"
          value={loading ? null : toPersianDigits(workoutPlan?.days.reduce((sum, d) => sum + d.exercises.length, 0) ?? 0)}
          unit="حرکت"
          color="emerald"
        />
        <StatCard
          icon={Calendar}
          label="روزهای تمرین"
          value={loading ? null : toPersianDigits(workoutPlan?.days.length ?? 0)}
          unit="روز در هفته"
          color="violet"
        />
        <button
          onClick={() => setOverlay("subscription")}
          className="text-right"
          aria-label="مشاهده اشتراک"
        >
          <StatCard
            icon={Trophy}
            label="پلن فعال"
            value={user?.planName ? PLAN_LABELS[user.planName as keyof typeof PLAN_LABELS] ?? "—" : "—"}
            unit={user?.hasActiveSubscription ? "اشتراک فعال" : "بدون اشتراک"}
            color="green"
            clickable
          />
        </button>
      </div>

      {/* برنامه تمرینی — نمایش کل برنامه */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Dumbbell className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold">برنامه تمرینی</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary text-xs"
            onClick={() => setMainTab("programs")}
          >
            مشاهده همه
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        {loading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : workoutPlan && workoutPlan.days.length > 0 ? (
          <button
            onClick={() => setMainTab("programs")}
            className="w-full text-right p-3 rounded-xl bg-muted/50 hover:bg-muted transition"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-bold">{workoutPlan.days.length} روز تمرین در هفته</p>
                <p className="text-xs text-muted-foreground">{workoutPlan.goal || "برنامه شخصی‌سازی‌شده"}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary font-medium">
                <Zap className="w-3.5 h-3.5" />
                {toPersianDigits(workoutPlan.days.reduce((s, d) => s + d.estimatedMinutes, 0))} دقیقه/هفته
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {workoutPlan.days.slice(0, 5).map((day, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-1 rounded-md bg-background border"
                >
                  {day.title}
                </span>
              ))}
              {workoutPlan.days.length > 5 && (
                <span className="text-[11px] px-2 py-1 rounded-md bg-background border">
                  +{toPersianDigits(workoutPlan.days.length - 5)}
                </span>
              )}
            </div>
          </button>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-3xl mb-2">💪</div>
            <p className="text-sm font-medium">برنامه تمرینی شما آماده نیست</p>
            <p className="text-xs">از بخش برنامه‌ها فعال کنید</p>
          </div>
        )}
      </Card>

      {/* Today's nutrition */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Utensils className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold">برنامه غذایی امروز</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary text-xs"
            onClick={() => setOverlay("nutrition")}
          >
            جزئیات
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        {loading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : mealPlan ? (
          <div>
            {/* Macro rings */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              <MacroMini label="کالری" value={toPersianDigits(mealPlan.totalCalories)} unit="kcal" pct={100} color="#f97316" />
              <MacroMini label="پروتئین" value={toPersianDigits(mealPlan.totalProtein)} unit="g" pct={Math.min(100, (mealPlan.totalProtein / 150) * 100)} color="#10b981" />
              <MacroMini label="کربو" value={toPersianDigits(mealPlan.totalCarbs)} unit="g" pct={Math.min(100, (mealPlan.totalCarbs / 250) * 100)} color="#06b6d4" />
              <MacroMini label="چربی" value={toPersianDigits(mealPlan.totalFat)} unit="g" pct={Math.min(100, (mealPlan.totalFat / 70) * 100)} color="#a855f7" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {mealPlan.meals.map((m, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-muted/60"
                >
                  {m.label}: {toPersianDigits(m.totalCalories)} کالری
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            برنامه غذایی در حال آماده‌سازی است...
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction
          icon={MessageCircle}
          label="سوال از مربی AI"
          onClick={() => setMainTab("chat")}
        />
        <QuickAction
          icon={TrendingDown}
          label="ثبت وزن جدید"
          onClick={() => setMainTab("progress")}
        />
      </div>

      {/* امکانات ویژه (Gated by plan) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-bold text-sm">امکانات ویژه پلن شما</h3>
          {user?.planName ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              پلن {PLAN_LABELS[user.planName]}
            </span>
          ) : (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              بدون پلن فعال
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GatedFeature
            icon={GymIcon}
            label="حالت باشگاه"
            unlocked={canAccess(user?.planName, "gymMode")}
            onClick={() => {
              if (canAccess(user?.planName, "gymMode")) {
                setOverlay("gymMode");
              } else {
                setOverlay("subscription");
              }
            }}
          />
          <GatedFeature
            icon={Salad}
            label="دستیار تغذیه"
            unlocked={canAccess(user?.planName, "nutritionCompanion")}
            onClick={() => setOverlay("nutrition")}
          />
          <GatedFeature
            icon={Video}
            label="آنالیز ویدیویی"
            unlocked={canAccess(user?.planName, "videoBodyAnalysis")}
            onClick={() => {
              if (canAccess(user?.planName, "videoBodyAnalysis")) {
                toastInfo("آپلود ویدیو برای آنالیز بدن");
              } else {
                setOverlay("subscription");
              }
            }}
          />
          <GatedFeature
            icon={TestTube}
            label="تحلیل آزمایش خون"
            unlocked={canAccess(user?.planName, "bloodTestAnalysis")}
            onClick={() => {
              if (canAccess(user?.planName, "bloodTestAnalysis")) {
                toastInfo("آپلود آزمایش خون");
              } else {
                setOverlay("subscription");
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "صبح بخیر";
  if (h < 18) return "بعد از ظهر بخیر";
  return "شب بخیر";
}

const COLOR_MAP: Record<string, string> = {
  orange: "from-orange-500/20 to-orange-500/5 text-orange-500",
  emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
  cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-500",
  violet: "from-violet-500/20 to-violet-500/5 text-violet-500",
  green: "from-emerald-500/25 to-emerald-500/5 text-emerald-600",
};

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
  clickable,
}: {
  icon: any;
  label: string;
  value: string | null;
  unit: string;
  color: string;
  clickable?: boolean;
}) {
  return (
    <Card
      className={`p-4 relative overflow-hidden ${
        clickable ? "hover:border-primary/40 hover:shadow-md transition cursor-pointer" : ""
      }`}
    >
      <div className={`absolute -left-4 -top-4 w-16 h-16 rounded-full bg-gradient-to-br ${COLOR_MAP[color]} opacity-50`} />
      <div className="relative">
        <Icon className={`w-5 h-5 mb-2 ${COLOR_MAP[color].split(" ").pop()}`} />
        {value === null ? (
          <Skeleton className="h-6 w-16 mb-1" />
        ) : (
          <p className="text-xl font-black">{value}</p>
        )}
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {unit && <p className="text-[10px] text-muted-foreground/70">{unit}</p>}
      </div>
    </Card>
  );
}

function MacroMini({ label, value, unit, pct, color }: { label: string; value: string; unit: string; pct: number; color: string }) {
  return (
    <div className="text-center">
      <div className="relative w-12 h-12 mx-auto mb-1">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
          {value}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-[9px] text-muted-foreground/70">{unit}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-2xl bg-card border hover:border-primary/40 transition text-right"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

/** کارت قابلیت با گیت پلن — اگر قفل باشد آیکون پادلاک نمایش می‌دهد */
function GatedFeature({
  icon: Icon,
  label,
  unlocked,
  onClick,
}: {
  icon: any;
  label: string;
  unlocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition text-center ${
        unlocked
          ? "bg-card hover:border-primary/40"
          : "bg-muted/30 border-dashed opacity-70 hover:opacity-100"
      }`}
    >
      {!unlocked && (
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-3 h-3 text-muted-foreground" />
        </div>
      )}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center ${
          unlocked ? "bg-primary/10" : "bg-muted/60"
        }`}
      >
        <Icon className={`w-5 h-5 ${unlocked ? "text-primary" : "text-muted-foreground/50"}`} />
      </div>
      <span
        className={`text-xs font-medium ${unlocked ? "" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </button>
  );
}

/** helper برای toast اطلاع‌رسانی */
function toastInfo(msg: string) {
  import("sonner").then(({ toast }) => toast.info(msg));
}
