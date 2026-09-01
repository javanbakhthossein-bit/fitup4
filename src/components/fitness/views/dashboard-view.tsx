"use client";

import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  ListChecks,
  Trophy,
  Zap,
  Clock,
  ChevronLeft,
  Dumbbell,
  Target,
  Lock,
  Music,
  TestTube,
  Video,
  Salad,
  Crown,
  Calendar,
  History,
  Sparkles,
  Loader2,
  ClipboardList,
  Activity,
  TrendingDown,
  Ruler,
  Camera,
  RefreshCw,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/lib/fitness/fetch-json";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  toPersianDigits,
  PERSIAN_WEEKDAYS,
  PLAN_LABELS,
  canAccess,
  type WorkoutPlanContent,
  type MealPlanContent,
} from "@/lib/fitness/types";
import { BodyAnalysisBanner } from "./body-analysis-banner";
import { PrerequisitesBanner } from "./prerequisites-banner";
import { ProgramStatusBanner } from "./program-status-banner";
import { PlanProgressCard } from "./plan-progress-card"; // کارت یکپارچه: پیشرفت پلن + جملات انگیزشی

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

/** ساعت فعلی تهران (۰-۲۳) — با Intl و timeZone Asia/Tehran، نه timezone مرورگر */
function getTehranHour(): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tehran",
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    const parsed = parseInt(h, 10);
    if (Number.isFinite(parsed)) return parsed % 24;
  } catch {
    // Intl در دسترس نیست — fallback به ساعت محلی
  }
  return new Date().getHours();
}

/** Format a JS Date as a Persian (Jalali) string with day-of-week + date + Tehran time */
function formatPersianDateTime(d: Date): string {
  try {
    const weekdayNames = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
    // Intl supports islamic-civil but for Persian (Jalali) use fa-IR with persian calendar
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Tehran",
    }).formatToParts(d);
    // Extract parts
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const day = get("weekday");
    const date = `${get("day")} ${get("month")} ${get("year")}`;
    // Time — بر اساس ساعت تهران (نه timezone مرورگر)
    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const hh = timeParts.find((p) => p.type === "hour")?.value ?? "00";
    const mm = timeParts.find((p) => p.type === "minute")?.value ?? "00";
    return `${day}، ${date} - ${toPersianDigits(hh)}:${toPersianDigits(mm)}`;
  } catch {
    // Fallback if Intl calendar is unavailable
    const dayIdx = (d.getDay() + 1) % 7;
    const wd = PERSIAN_WEEKDAYS[dayIdx];
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${wd} - ${toPersianDigits(hh)}:${toPersianDigits(mm)}`;
  }
}

/**
 * ساعت زنده تهران — کامپوننت ایزوله (FE-M2):
 * interval یک‌ثانیه‌ای فقط این کامپوننت کوچک را re-render می‌کند، نه کل
 * داشبورد (که شامل LineChart ری‌چارت و کارت‌های متعدد است).
 */
const TehranClock = memo(function TehranClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(formatPersianDateTime(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-stat truncate">{now || "در حال بارگذاری..."}</span>;
});

/** Estimate calories burned during a workout using MET × weight × hours */
function estimateCaloriesBurned(
  minutes: number,
  userWeightKg: number,
  metValue = 6.5
): number {
  const hours = minutes / 60;
  return Math.round(metValue * userWeightKg * hours);
}

export function DashboardView() {
  const {
    user,
    setMainTab,
    setOverlay,
    setScreen,
    setBodyAnalysisOpen,
    workoutPlan,
    setWorkoutPlan,
    setMealPlan,
    lastKnownWeightKg,
  } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");
  // greeting باید hydration-safe باشد — در useEffect set می‌شود.
  const [greeting, setGreeting] = useState("سلام");
  // آیا کاربر پلن advanced/ultimate دارد و هنوز عکس بدن خود را آپلود نکرده است؟
  // برای برجسته کردن دکمه «آپلود عکس بدن» با badge «الزامی» استفاده می‌شود.
  const [bodyPhotoAwaiting, setBodyPhotoAwaiting] = useState(false);
  // وضعیت تولید برنامه (generating / failed / ready / ...) از program-history —
  // برای بنر «برنامه شما در حال طراحی است» در همه پلن‌ها (basic/standard هم)
  const [programStatus, setProgramStatus] = useState<string | null>(null);

  // set greeting در mount (hydration-safe) — بر اساس ساعت تهران (FE-M1)،
  // نه timezone مرورگر (کاربر ایرانی خارج از کشور ساعت درست را ببیند)
  useEffect(() => {
    const h = getTehranHour();
    if (h < 12) setGreeting("صبح بخیر");
    else if (h < 18) setGreeting("بعد از ظهر بخیر");
    else setGreeting("شب بخیر");
  }, []);

  // بررسی وضعیت awaitingMedia برای کاربران پلن پیشرفته/حرفه‌ای.
  // گوش دادن به رویداد prereq-updated برای refresh بدون رفرش صفحه.
  useEffect(() => {
    if (!user?.planName || (user.planName !== "advanced" && user.planName !== "ultimate")) {
      setBodyPhotoAwaiting(false);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/coach/submit-body-analysis", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBodyPhotoAwaiting(Boolean(data?.awaitingMedia));
      } catch {
        // ignore
      }
    };
    check();
    // refresh بدون رفرش صفحه وقتی پیش‌نیازی تعیین تکلیف شد
    function onPrereqUpdate() { check(); }
    if (typeof window !== "undefined") window.addEventListener("prereq-updated", onPrereqUpdate);
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") window.removeEventListener("prereq-updated", onPrereqUpdate);
    };
  }, [user?.planName]);

  // ─── وضعیت تولید برنامه برای «همه پلن‌ها» ───
  // در تمام پلن‌ها، از لحظه خرید تا تحویل برنامه باید بنویسد که «برنامه در حال
  // طراحی است» — GET /api/coach/program-history فقط status آخرین درخواست را
  // می‌خوانیم (بدون ?analyze=1 → بدون کال AI).
  // تا وقتی status=generating است هر ۳۰ ثانیه دوباره چک می‌کنیم تا بنر به‌محض
  // آماده‌شدن/خطا به‌روز شود؛ با رویداد prereq-updated هم refresh می‌شود.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function checkStatus() {
      try {
        // fetchJson: پاسخ HTML (خطای گیت‌وی/سرور) → خطای فارسی (اینجا نادیده)
        const { res, data } = await fetchJson<{ programStatus?: string }>(
          "/api/coach/program-history",
          { cache: "no-store" }
        );
        if (cancelled) return;
        if (res.ok) {
          const s = data?.programStatus;
          setProgramStatus(typeof s === "string" ? s : null);
          // تا وقتی در حال تولید است، دوره‌ای چک کن تا بنر به‌روز بماند
          if (s === "generating") timer = setTimeout(checkStatus, 30000);
        }
      } catch {
        // خطای شبکه — بعداً دوباره تلاش کن
        if (!cancelled) timer = setTimeout(checkStatus, 60000);
      }
    }

    checkStatus();
    // وقتی پیش‌نیازی تعیین تکلیف شد، تولید برنامه ممکن است شروع شده باشد
    function onPrereqUpdate() {
      if (timer) clearTimeout(timer);
      checkStatus();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("prereq-updated", onPrereqUpdate);
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof window !== "undefined") {
        window.removeEventListener("prereq-updated", onPrereqUpdate);
      }
    };
  }, []);

  // Live clock — در کامپوننت ایزوله TehranClock (بالا) تا هر ثانیه کل داشبورد
  // re-render نشود (FE-M2). ساعت با timezone تهران نمایش داده می‌شود (FE-M1).

  useEffect(() => {
    const dayIdx = new Date().getDay();
    const persianIdx = (dayIdx + 1) % 7;
    setToday(PERSIAN_WEEKDAYS[persianIdx]);

    let mounted = true;
    const loadPlans = async () => {
      try {
        const res = await fetch("/api/coach/plan", { cache: "no-store" });
        const data = await res.json();
        if (!mounted) return;
        // فقط اگر داده واقعاً تغییر کرده باشد، state را آپدیت کن (جلوگیری از flicker)
        // مهم: مقایسه با آخرین state از store (getState) انجام می‌شود نه closure
        // effect — قبلاً workoutPlan/mealPlan از closure زمان mount خوانده می‌شدند
        // و بعد از اولین set موفق، هر poll دوباره «تغییر» تشخیص داده و set صدا
        // زده می‌شد (re-render بی‌مورد کل داشبورد هر ۶۰ ثانیه — الگوی مشابه polling
        // نوتیف‌ها در main-app.tsx).
        if (data.workout) {
          const newJson = JSON.stringify(data.workout);
          const currentWorkout = useAppStore.getState().workoutPlan;
          const oldJson = currentWorkout ? JSON.stringify(currentWorkout) : "";
          if (newJson !== oldJson) {
            setWorkoutPlan(data.workout as WorkoutPlanContent);
          }
        }
        if (data.meal) {
          const newJson = JSON.stringify(data.meal);
          const currentMeal = useAppStore.getState().mealPlan;
          const oldJson = currentMeal ? JSON.stringify(currentMeal) : "";
          if (newJson !== oldJson) {
            setMealPlan(data.meal as MealPlanContent);
          }
        }
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadPlans();
    // Poll هر 60 ثانیه (به‌جای 30) برای کاهش flicker
    const interval = setInterval(loadPlans, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayWorkout = workoutPlan?.days.find((d) => d.day === today);

  // Estimated calories to burn during today's workout (MET-based)
  // وزن واقعی کاربر از store (که از داده‌های progress/checkup پر می‌شود)؛
  // فقط در نبود داده به ۷۵ fallback می‌کنیم (FE-H7 — قبلاً ۷۵ هاردکد بود)
  const userWeight = lastKnownWeightKg ?? 75;
  const estimatedBurnCal = todayWorkout
    ? estimateCaloriesBurned(todayWorkout.estimatedMinutes, userWeight)
    : 0;

  const gymModeUnlocked = canAccess(user?.planName, "gymMode");

  // ─── روزهای باقیمانده تا انقضای اشتراک فعال (برای کارت یادآور تمدید) ───
  const planExpiryDate = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const daysToExpiry = planExpiryDate
    ? Math.ceil((planExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  // کارت اقدام مهم فقط وقتی مرتبط است رندر می‌شود:
  // ۱) اشتراک فعال و ≤ ۱۴ روز تا انقضا → یادآور تمدید
  // ۲) پلن دارد ولی اشتراک فعال نیست (pending/منقضی) → CTA فعال‌سازی/تمدید پلن
  const showPriorityAction =
    (user?.hasActiveSubscription && daysToExpiry > 0 && daysToExpiry <= 14) ||
    (!user?.hasActiveSubscription && !!user?.planName);

  // بنر وضعیت تولید برنامه فقط برای پلن‌های basic/standard (و بدون پلن) —
  // برای advanced/ultimate بنر PrerequisitesBanner همین حالت‌ها را نشان می‌دهد
  // و نباید بنر تکراری رندر شود.
  const coveredByPrereqBanner =
    user?.planName === "advanced" || user?.planName === "ultimate";
  const showGeneratingBanner =
    !coveredByPrereqBanner && !loading && !workoutPlan && programStatus === "generating";
  const showFailedBanner = !coveredByPrereqBanner && programStatus === "failed";

  return (
    <div className="px-4 py-4 space-y-4 max-w-5xl mx-auto lg:px-6">
      {/* ─── T12: بنر آنبوردینگ ناقص — بسیار برجسته و جذاب ─── */}
      {/* کاربر لاگین کرده ولی آنبوردینگ را کامل نکرده؛ خرید پلن هم برای او مسدود است. */}
      {!loading && user && user.onboardingDone !== true && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-4 sm:p-5 text-white shadow-lg shadow-orange-500/30"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          role="alert"
          aria-live="polite"
        >
          <div className="absolute -top-10 -left-10 w-36 h-36 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <div className="absolute -bottom-12 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-sm sm:text-base">برنامه اختصاصی تو منتظرته! 🚀</h3>
              <p className="text-[11px] sm:text-xs text-white/90 mt-1 leading-relaxed">
                فقط ۲ دقیقه اطلاعات آنبوردینگ را تکمیل کن تا مربی هوشمند برنامه تمرین و غذایی مخصوص خودت را بسازد. تا آن‌ موقع، خرید پلن فعال نیست.
              </p>
            </div>
            <button
              onClick={() => setScreen("onboarding")}
              className="shrink-0 bg-white text-orange-600 font-bold text-xs sm:text-sm px-3.5 sm:px-4 h-10 sm:h-11 rounded-xl shadow hover:scale-[1.04] active:scale-95 transition min-w-[96px]"
            >
              تکمیل آنبوردینگ
            </button>
          </div>
        </motion.div>
      )}

      {/* Hero greeting with live date/time */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-5 bg-white border-2 border-orange-200 shadow-sm"
      >
        <div className="absolute -left-8 -top-8 w-40 h-40 rounded-full bg-orange-100 blur-3xl opacity-60" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Live date/time — کامپوننت ایزوله (فقط خودش هر ثانیه re-render می‌شود) */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              <TehranClock />
            </div>
            <h2 className="text-lg font-bold mb-1 truncate">
              {greeting}، {user?.name || "ورزشکار"}!{" "}
              <span
                style={{
                  background: goldGradient,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                🔥
              </span>
            </h2>
            <p className="text-sm text-slate-500">
              {user?.planName ? (
                user.hasActiveSubscription ? (
                  // فقط وقتی اشتراک واقعاً فعال است «فعال» می‌نویسیم —
                  // planName برای اشتراک pending هم ست می‌شود (auth.ts:69)
                  `پلن ${PLAN_LABELS[user.planName]} فعال`
                ) : (
                  // اشتراک pending: بج متمایز «در انتظار فعال‌سازی» به‌جای متن متناقض «فعال»
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-bold text-amber-700"
                    style={{ background: "rgba(245,158,11,0.15)" }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    پلن {PLAN_LABELS[user.planName]} در انتظار فعال‌سازی
                  </span>
                )
              ) : (
                "برای دسترسی کامل، پلن خودت رو فعال کن"
              )}
            </p>
          </div>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-5xl shrink-0"
          >
            💪
          </motion.div>
        </div>
      </motion.div>

      {/* ─── B2+B3: کارت یکپارچه «پیشرفت پلن + جملات انگیزشی» — برای همه کاربران ─── */}
      <PlanProgressCard />

      {/* ─── کارت اقدام مهم (PriorityActionCard) ───
          یادآور تمدید/فعال‌سازی پلن — کامپوننت از قبل در این فایل تعریف شده بود
          ولی هرگز رندر نمی‌شد (باگ ممیزی 2-b: هشدار انقضای اشتراک گم شده بود).
          فقط در حالت‌های مرتبط رندر می‌شود (showPriorityAction بالا). */}
      {showPriorityAction && <PriorityActionCard />}

      {/* ─── بنر وضعیت تولید برنامه (همه پلن‌ها) ───
          در تمام پلن‌ها، از خرید تا لحظه تحویل برنامه: «برنامه در حال طراحی است» */}
      {(showGeneratingBanner || showFailedBanner) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <ProgramStatusBanner
            status={showGeneratingBanner ? "generating" : "failed"}
            generatingTitle="برنامه شما در حال طراحی است ⏳"
          />
        </motion.div>
      )}

      {/* Prerequisites banner (Advanced/Ultimate) — نمایش پیش‌نیازها در بالای داشبورد */}
      <PrerequisitesBanner />

      {/* Body analysis modal manager — فقط مودال آپلود عکس بدن را مدیریت می‌کند (بنر حذف شده) */}
      <BodyAnalysisBanner />

      {/* ─── باکس شخصی‌سازی‌شده: مسیر تمرین امروز (۳ دکمه در یک قاب زیبا) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-[1.5px] shadow-lg shadow-orange-500/10"
        style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.9), rgba(251,191,36,0.55), rgba(234,88,12,0.85))" }}
      >
        <div className="rounded-[22px] bg-white p-3.5 sm:p-4">
          {/* هدر شخصی‌سازی‌شده با نام کاربر */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <Flame className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-sm sm:text-base text-slate-900 leading-tight truncate">
                  {user?.name ? `${user.name} جان، بریم سراغ امروز؟` : "بریم سراغ امروز؟"}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight mt-0.5">
                  برنامه، جلسه‌ی امروز و حالت باشگاه — همه یک‌جا
                </p>
              </div>
            </div>
            {user?.planName ? (
              <span
                className="shrink-0 text-[10px] px-2.5 py-1 rounded-full text-white font-bold shadow-sm"
                style={{ background: goldGradient }}
              >
                پلن {PLAN_LABELS[user.planName]}
              </span>
            ) : null}
          </div>

          {/* ۳ دکمه سریع */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              onClick={() => setMainTab("programs")}
              className="relative overflow-hidden rounded-2xl text-white font-bold py-3.5 sm:py-4 px-2 sm:px-3 flex flex-col items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all"
              style={{ background: goldGradient }}
            >
              <ListChecks className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              <span className="text-xs sm:text-sm leading-tight">مشاهده برنامه</span>
              <span className="text-[9px] sm:text-[10px] opacity-80">برنامه تمرینی</span>
            </button>
            {/* تمرین امروز — بدون گیت پلن، برای همه فعال (B4) — داینامیک به روز جاری */}
            <button
              onClick={() => setMainTab("workouts")}
              className="relative overflow-hidden rounded-2xl font-bold py-3.5 sm:py-4 px-2 sm:px-3 flex flex-col items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all bg-gradient-to-b from-amber-50 to-white border-2 border-amber-300 hover:border-amber-400"
            >
              <Zap
                className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500"
                strokeWidth={2.5}
                fill="currentColor"
                style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.45))" }}
              />
              <span className="text-xs sm:text-sm leading-tight text-slate-900">تمرین امروز</span>
              <span className="text-[9px] sm:text-[10px] text-amber-600/80">
                {todayWorkout ? "آماده اجرا" : "استراحت و ریکاوری"}
              </span>
            </button>
            <button
              onClick={() => {
                if (gymModeUnlocked) {
                  setOverlay("gymMode");
                } else {
                  toastInfo("حالت باشگاه فقط برای پلن پیشرفته و حرفه‌ای فعال است.");
                  setMainTab("plans");
                }
              }}
              className={`relative overflow-hidden rounded-2xl font-bold py-3.5 sm:py-4 px-2 sm:px-3 flex flex-col items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition-all ${
                gymModeUnlocked
                  ? "premium-gym-btn"
                  : "text-slate-400 bg-slate-100 border-2 border-dashed border-slate-300"
              }`}
              style={gymModeUnlocked ? {
                background: "linear-gradient(135deg, #0c0a09 0%, #1c1917 55%, #292524 100%)",
                border: "1.5px solid rgba(217, 164, 65, 0.65)",
                boxShadow: "0 10px 24px -10px rgba(217, 164, 65, 0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
              } : {}}
            >
              {/* خط طلایی درخشان بالای دکمه — حس پرمیوم */}
              {gymModeUnlocked && (
                <span
                  aria-hidden
                  className="absolute top-0 right-0 left-0 h-[3px]"
                  style={{ background: "linear-gradient(90deg, transparent, #e9b949, #d9a441, #e9b949, transparent)" }}
                />
              )}
              <Dumbbell className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} style={gymModeUnlocked ? { color: "#e9b949", filter: "drop-shadow(0 0 6px rgba(233,185,73,0.45))" } : undefined} />
              <span className="text-xs sm:text-sm leading-tight" style={gymModeUnlocked ? { color: "#f5e6c4" } : undefined}>حالت باشگاه</span>
              <span className="text-[9px] sm:text-[10px] flex items-center gap-1" style={gymModeUnlocked ? { color: "#d9a441" } : undefined}>
                {gymModeUnlocked ? (
                  <>
                    <Crown className="w-3 h-3" />
                    پرمیوم
                  </>
                ) : (
                  "🔒 پلن پیشرفته"
                )}
              </span>
            </button>
          </div>
        </div>
      </motion.div>


      {/* ─── باکس واحد جذاب: امکانات ویژه‌ی پلن (همه ابزارها در یک قاب) ─── */}
      <div
        className="rounded-3xl p-[1.5px] shadow-lg shadow-orange-500/10"
        style={{ background: "linear-gradient(135deg, rgba(234,88,12,0.8), rgba(251,191,36,0.55), rgba(249,115,22,0.75))" }}
      >
        <div
          className="rounded-[22px] p-3.5 sm:p-4"
          style={{ background: "linear-gradient(165deg, #fffdf8 0%, #fff6e9 100%)" }}
        >
          {/* هدر باکس */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(249,115,22,0.14)" }}
              >
                <Sparkles className="w-5 h-5 text-orange-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-sm sm:text-base text-slate-900 leading-tight">امکانات ویژه‌ی پلن شما</h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight mt-0.5">
                  همه‌ی ابزارهای پلنت — یک‌جا
                </p>
              </div>
            </div>
            {user?.planName ? (
              <span
                className="shrink-0 text-[10px] px-2.5 py-1 rounded-full text-white font-bold shadow-sm flex items-center gap-1"
                style={{ background: goldGradient }}
              >
                <Crown className="w-3 h-3" /> {PLAN_LABELS[user.planName]}
              </span>
            ) : (
              <button
                onClick={() => setMainTab("plans")}
                className="shrink-0 text-[10px] px-2.5 py-1 rounded-full text-white font-bold shadow-sm"
                style={{ background: goldGradient }}
              >
                خرید پلن ←
              </button>
            )}
          </div>

          {/* ابزارها */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* ─── تمرین امروز — بدون گیت پلن، برای همه فعال (B4) ─── */}
            <GatedFeature
              icon={Zap}
              label="تمرین امروز"
              sub={todayWorkout ? "جلسه امروز" : "استراحت و ریکاوری"}
              unlocked={true}
              onClick={() => setMainTab("workouts")}
            />
            {/* ─── آپلود عکس بدن (پیش‌نیاز همه برنامه‌های اختصاصی) ─── */}
            {/* برای کاربران پلن پیشرفته/حرفه‌ای که هنوز عکس آپلود نکرده‌اند، badge «الزامی» نمایش
                داده می‌شود تا توجه آن‌ها جلب شود. */}
            <GatedFeature
              icon={Camera}
              label="آپلود عکس بدن"
              sub="برای برنامه اختصاصی"
              unlocked={canAccess(user?.planName, "bodyPhotoAnalysis")}
              badge={bodyPhotoAwaiting ? "الزامی" : undefined}
              highlight={bodyPhotoAwaiting}
              onClick={() => {
                if (canAccess(user?.planName, "bodyPhotoAnalysis")) {
                  // همیشه مودال باز شود — کاربر می‌تواند عکس جدید آپلود کند
                  setBodyAnalysisOpen(true);
                } else {
                  toastInfo("آپلود عکس بدن نیازمند پلن پیشرفته است");
                  setMainTab("plans");
                }
              }}
            />
            {/* حالت باشگاه — برای همه کاربران نمایش داده می‌شود (قفل برای بدون پلن) */}
            <GatedFeature
              icon={Dumbbell}
              label="حالت باشگاه"
              sub="تمرین با موسیقی و چت"
              unlocked={canAccess(user?.planName, "gymMode")}
              onClick={() => {
                if (canAccess(user?.planName, "gymMode")) {
                  setOverlay("gymMode");
                } else {
                  toastInfo("حالت باشگاه نیازمند پلن پیشرفته است");
                  setMainTab("plans");
                }
              }}
            />
            {/* ─── دستیار تغذیه — برای همه ۴ پلن فعال (B5) ─── */}
            <GatedFeature
              icon={Salad}
              label="دستیار تغذیه"
              sub="برنامه غذایی و مکمل"
              unlocked={true}
              onClick={() => setMainTab("nutrition")}
            />
            {/* ─── تحلیل عکس غذا — پیشرفته/حرفه‌ای (B6) ─── */}
            <GatedFeature
              icon={UtensilsCrossed}
              label="تحلیل عکس غذا"
              sub="کالری با یک عکس"
              unlocked={canAccess(user?.planName, "mealPhotoAnalysis")}
              onClick={() => {
                if (canAccess(user?.planName, "mealPhotoAnalysis")) {
                  setMainTab("nutrition");
                } else {
                  toastInfo("تحلیل عکس غذا در پلن پیشرفته و بالاتر فعال است");
                  setMainTab("plans");
                }
              }}
            />
            <GatedFeature
              icon={Video}
              label="آنالیز ویدیویی"
              sub="بررسی فرم بدن"
              unlocked={canAccess(user?.planName, "videoBodyAnalysis")}
              onClick={() => {
                if (canAccess(user?.planName, "videoBodyAnalysis")) setOverlay("videoAnalysis");
                else { toastInfo("آنالیز ویدیویی نیازمند پلن حرفه‌ای است"); setMainTab("plans"); }
              }}
            />
            <GatedFeature
              icon={TestTube}
              label="آزمایش خون"
              sub="تحلیل تخصصی"
              unlocked={canAccess(user?.planName, "bloodTestAnalysis")}
              onClick={() => {
                if (canAccess(user?.planName, "bloodTestAnalysis")) setOverlay("bloodTest");
                else { toastInfo("تحلیل آزمایش خون نیازمند پلن حرفه‌ای است"); setMainTab("plans"); }
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── NEW (BODY-COMPOSITION-PRO): Body Progress Card ─── */}
      <BodyProgressCard />
    </div>
  );
}

/** کارت قابلیت با گیت پلن — فرمت یک‌شکل، فشرده و جذاب (B7) */
function GatedFeature({
  icon: Icon,
  label,
  sub,
  unlocked,
  onClick,
  badge,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  unlocked: boolean;
  onClick: () => void;
  /** متن badge اختیاری (مثلاً «الزامی») — فقط وقتی unlocked=true نمایش داده می‌شود */
  badge?: string;
  /** برجسته کردن کارت (مثلاً وقتی پیش‌نیاز است و هنوز تکمیل نشده) */
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-1.5 min-h-[122px] p-3.5 rounded-2xl border-2 transition-all text-center active:scale-[0.98] ${
        unlocked && highlight
          ? "bg-orange-50 border-orange-400 hover:border-orange-500 hover:shadow-lg ring-2 ring-orange-300/50 animate-pulse"
          : unlocked
            ? "bg-white border-orange-200 hover:border-orange-400 hover:shadow-md hover:-translate-y-0.5"
            : // قفل: چیدمان یکسان + بج کوچک قفل — بدون کم‌رنگ‌شدن شدید تا خوانا بماند (B7)
              "bg-white border-slate-200 border-dashed hover:border-amber-400 hover:shadow-sm"
      }`}
    >
      {!unlocked && (
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
          <Lock className="w-3 h-3 text-slate-400" />
        </div>
      )}
      {unlocked && badge && (
        <span
          className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full text-white font-bold flex items-center gap-1 shadow-sm"
          style={{ background: goldGradient }}
        >
          {badge}
        </span>
      )}
      {/* آیکون در مربع گرد رنگ‌مایه‌دار */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={unlocked ? { background: "rgba(245,158,11,0.15)" } : { background: "rgba(148,163,184,0.14)" }}
      >
        <Icon className={`w-5 h-5 ${unlocked ? "text-orange-500" : "text-slate-400"}`} />
      </div>
      <span className={`text-sm font-bold leading-tight ${unlocked ? "text-slate-900" : "text-slate-500"}`}>{label}</span>
      <span className="text-xs text-slate-400 leading-tight w-full truncate px-1">{sub}</span>
    </button>
  );
}

function toastInfo(msg: string) {
  import("sonner").then(({ toast }) => toast.info(msg));
}


/* ============ ACTIVITY RINGS (Apple-style SVG) ============ */
function ActivityRings({
  workout,
  calories,
  water,
}: {
  workout: number;
  calories: number;
  water: number;
}) {
  const rings = [
    { progress: workout, color: "#F4C542", radius: 52, label: "تمرین" },
    { progress: calories, color: "#10b981", radius: 40, label: "کالری" },
    { progress: water, color: "#06b6d4", radius: 28, label: "آب" },
  ];
  return (
    <div className="relative w-44 h-44 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        {rings.map((ring, i) => {
          const c = 2 * Math.PI * ring.radius;
          return (
            <g key={i}>
              <circle
                cx="60"
                cy="60"
                r={ring.radius}
                fill="none"
                stroke={ring.color}
                strokeWidth="9"
                strokeOpacity="0.15"
              />
              <motion.circle
                cx="60"
                cy="60"
                r={ring.radius}
                fill="none"
                stroke={ring.color}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={{ strokeDashoffset: c * (1 - ring.progress) }}
                transition={{ duration: 1.2, delay: i * 0.15, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${ring.color}80)` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <Flame className="w-6 h-6 text-orange-500 mx-auto mb-0.5" />
          <p className="text-[10px] text-slate-500">امروز</p>
        </div>
      </div>
    </div>
  );
}

function RingLegend({ color, label, value, sub }: { color: string; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}80` }} />
      <div className="flex-1">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-bold font-stat text-slate-900">{value} <span className="text-[10px] text-slate-500 font-normal">{sub}</span></p>
      </div>
    </div>
  );
}

/* ============ WATER GLASS — animated fill ============ */
function WaterGlass({ percentage, amount, goal }: { percentage: number; amount: number; goal: number }) {
  const glasses = Math.min(8, Math.floor(amount / 200));
  return (
    <div className="flex flex-col items-center">
      {/* Glass visual */}
      <div className="relative w-24 h-32 mx-auto mb-2">
        {/* Glass outline (trapezoid) */}
        <svg viewBox="0 0 80 110" className="w-full h-full" preserveAspectRatio="none">
          {/* Glass body — slightly tapered */}
          <defs>
            <clipPath id="glass-clip">
              <path d="M 12 6 L 68 6 L 62 104 L 18 104 Z" />
            </clipPath>
            <linearGradient id="water-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
          </defs>
          {/* Water fill */}
          <g clipPath="url(#glass-clip)">
            <motion.rect
              x="0"
              y={110 - 98 * percentage}
              width="80"
              height="110"
              fill="url(#water-grad)"
              initial={{ y: 110 }}
              animate={{ y: 110 - 98 * percentage }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
            {/* Wavy surface */}
            <motion.g
              animate={{ x: [0, -20, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg
                x="-10"
                y={110 - 98 * percentage - 4}
                width="100"
                height="8"
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
              >
                <path d="M0,4 Q25,0 50,4 T100,4 L100,8 L0,8 Z" fill="white" fillOpacity="0.5" />
              </svg>
            </motion.g>
          </g>
          {/* Glass outline on top */}
          <path
            d="M 12 6 L 68 6 L 62 104 L 18 104 Z"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2"
            strokeLinejoin="round"
            opacity="0.6"
          />
          {/* Glass shine */}
          <path d="M 18 12 L 22 12 L 26 96 L 22 96 Z" fill="white" fillOpacity="0.3" />
        </svg>
        {/* Amount text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-bold pointer-events-none">
          <span className="text-base drop-shadow font-stat">{toPersianDigits(amount)}</span>
          <span className="text-[10px] opacity-90">سی‌سی</span>
        </div>
      </div>

      {/* Glasses row — 8 small glass icons for visual progress */}
      <div className="flex gap-1 flex-wrap justify-center max-w-[160px]">
        {Array.from({ length: 8 }, (_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{ scale: i < glasses ? 1 : 0.85, opacity: i < glasses ? 1 : 0.4 }}
            className={`text-sm ${i < glasses ? "" : "grayscale"}`}
          >
            🥛
          </motion.div>
        ))}
      </div>
      <p className="text-[10px] text-slate-500 mt-1">
        {toPersianDigits(glasses)} از {toPersianDigits(8)} لیوان
      </p>
    </div>
  );
}

/* ============ CALORIE FORMULA BAR ============ */
function CalorieFormulaBar({ target, consumed, burned, remaining }: { target: number; consumed: number; burned: number; remaining: number }) {
  const total = target + burned;
  const consumedPct = total > 0 ? (consumed / total) * 100 : 0;
  const burnedPct = total > 0 ? (burned / total) * 100 : 0;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs mb-3">
        <span className="px-2.5 py-1 rounded-lg bg-slate-100"><b className="text-cyan-600">{toPersianDigits(target)}</b> <span className="text-slate-600">هدف</span></span>
        <span className="text-slate-400">−</span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-100"><b className="text-orange-500">{toPersianDigits(consumed)}</b> <span className="text-slate-600">مصرف</span></span>
        <span className="text-slate-400">+</span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-100"><b className="text-emerald-500">{toPersianDigits(burned)}</b> <span className="text-slate-600">سوزانده</span></span>
        <span className="text-slate-400">=</span>
        <span className="px-2.5 py-1 rounded-lg" style={{ background: "rgba(245,158,11,0.12)" }}><b className="text-orange-600">{toPersianDigits(remaining)}</b> <span className="text-slate-600">باقی‌مانده</span></span>
      </div>
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
        <motion.div
          className="h-full bg-orange-400"
          initial={{ width: 0 }}
          animate={{ width: `${consumedPct}%` }}
          transition={{ duration: 0.8 }}
        />
        <motion.div
          className="h-full bg-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${burnedPct}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 rounded-2xl bg-white border-2 border-orange-200 hover:border-orange-300 hover:shadow-md transition text-right"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(245,158,11,0.15)" }}
      >
        <Icon className="w-5 h-5 text-orange-500" />
      </div>
      <span className="text-sm font-medium text-slate-900">{label}</span>
    </button>
  );
}

// getGreeting حذف شد — greeting حالا در useState + useEffect مدیریت می‌شود (hydration-safe).

/**
 * کارت مهم‌ترین رویداد نزدیک — بر اساس وضعیت کاربر، مهم‌ترین اقدام را نشان می‌دهد
 * - بدون پلن: «پلن خود را فعال کن» → خرید پلن
 * - پلن فعال، امروز تمرین دارد: «مشاهده برنامه» → تمرینات
 * - پلن فعال، امروز استراحت: «چکاپ دوره‌ای» یا «ثبت وزن»
 * - پلن منقضی‌شده: «اشتراک خود را تمدید کن» → اشتراک‌ها
 */
function PriorityActionCard() {
  const { user, setMainTab, setOverlay, workoutPlan } = useAppStore();

  // Determine the most important action
  let config: {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    buttonText: string;
    onClick: () => void;
    gradient: string;
  };

  const now = new Date();
  const planExpires = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const daysLeft = planExpires ? Math.ceil((planExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  if (!user?.planName && !user?.hasActiveSubscription) {
    // هیچ پلنی نداشته → خرید پلن
    config = {
      icon: Crown,
      title: "پلن خود را فعال کن!",
      subtitle: "برای دریافت برنامه اختصاصی و چت با فیتاپ هوشمند، پلن مناسب خود را انتخاب کنید",
      buttonText: "انتخاب و خرید پلن",
      onClick: () => setMainTab("plans"),
      gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    };
  } else if (!user?.hasActiveSubscription) {
    // پلن داشته ولی تمام شده → تجربه تمدید (آمار دوره + کد تخفیف اختصاصی)
    config = {
      icon: RefreshCw,
      title: "پلنت تمام شده — دوباره روشن‌ش کن",
      subtitle: "پیشرفتت از بین نرفته؛ با تمدید، از همان‌جا ادامه می‌دی",
      buttonText: "تمدید اشتراک",
      onClick: () => setOverlay("renewal"),
      gradient: "linear-gradient(135deg, #64748b, #f97316)",
    };
  } else if (daysLeft > 0 && daysLeft <= 14) {
    // پلن فعال و ≤ ۱۴ روز تا انقضا → دعوت به «صفحه تمدید» (تجربه اختصاصی:
    // آمار دوره + کد تخفیف + مزایا + CTA) به‌جای رفتن مستقیم به لیست پلن‌ها
    config = {
      icon: Calendar,
      title: `اشتراک شما ${toPersianDigits(daysLeft)} روز دیگر منقضی می‌شود!`,
      subtitle: "برای تداوم برنامه تمرینی و دسترسی به امکانات، اشتراک خود را تمدید کنید",
      buttonText: "تمدید اشتراک",
      onClick: () => setOverlay("renewal"),
      gradient: "linear-gradient(135deg, #ef4444, #f97316)",
    };
  } else {
    // Has active plan → check today's workout
    const dayIdx = new Date().getDay();
    const persianIdx = (dayIdx + 1) % 7;
    const todayName = PERSIAN_WEEKDAYS[persianIdx];
    const todayWorkout = workoutPlan?.days.find((d) => d.day === todayName);

    if (todayWorkout) {
      config = {
        icon: Dumbbell,
        title: `مشاهده برنامه: ${todayWorkout.title}`,
        subtitle: `${toPersianDigits(todayWorkout.exercises.length)} حرکت • ${toPersianDigits(todayWorkout.estimatedMinutes)} دقیقه`,
        buttonText: "شروع تمرین",
        onClick: () => setMainTab("programs"),
        gradient: "linear-gradient(135deg, #10b981, #059669)",
      };
    } else {
      // Rest day → log weight or check progress
      config = {
        icon: Trophy,
        title: "امروز روز استراحت شماست",
        subtitle: "از بدن خود مراقبت کنید! وزن خود را ثبت کنید یا پیشرفت را بررسی کنید",
        buttonText: "ثبت وزن و پیشرفت",
        onClick: () => setMainTab("progress"),
        gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
      };
    }
  }

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 text-white shadow-lg relative overflow-hidden"
      style={{ background: config.gradient }}
    >
      <div className="absolute -left-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -left-2 bottom-0 w-16 h-16 rounded-full bg-white/10" />

      <div className="relative flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-base mb-0.5">{config.title}</h3>
          <p className="text-xs text-white/80 leading-snug">{config.subtitle}</p>
        </div>
      </div>

      <button
        onClick={config.onClick}
        className="w-full mt-4 py-3 rounded-xl bg-white/20 backdrop-blur-sm text-white font-bold text-sm hover:bg-white/30 transition flex items-center justify-center gap-2"
      >
        {config.buttonText}
        <ChevronLeft className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

/**
 * کارت تاریخچه برنامه‌های قبلی — برنامه‌های خریداری‌شده + تحلیل فیتاپ هوشمند
 */
function ProgramHistoryCard() {
  const { user } = useAppStore();
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/coach/program-history", { cache: "no-store" });
        const data = await res.json();
        setHistory(data);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  async function generateAnalysis() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/coach/program-history?analyze=1", { cache: "no-store" });
      const data = await res.json();
      setHistory(data);
    } catch {}
    finally { setAnalyzing(false); }
  }

  if (loading) return null;

  if (!history || !history.programs || history.totalPrograms === 0) {
    // کاربر بدون برنامه قبلی
    if (!user?.planName) {
      return (
        <Card className="p-5 border-2 border-orange-100 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-sm text-slate-900">تاریخچه برنامه‌ها</h3>
          </div>
          <p className="text-xs text-slate-500">هنوز برنامه‌ای خریداری نکرده‌اید. با خرید پلن، اولین برنامه اختصاصی شما توسط فیتاپ هوشمند ساخته می‌شود.</p>
        </Card>
      );
    }
    return null; // کاربر پلن دارد ولی برنامه هنوز ساخته نشده
  }

  return (
    <Card className="p-5 border-2 border-orange-100 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-sm text-slate-900">تاریخچه برنامه‌های شما</h3>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded-full text-orange-600" style={{ background: "rgba(245,158,11,0.12)" }}>
          {toPersianDigits(history.totalPrograms)} برنامه
        </span>
      </div>

      {/* لیست برنامه‌های قبلی */}
      <div className="space-y-2 mb-3">
        {(history.programs || []).slice(0, 3).map((p: any, i: number) => (
          <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50/50 border border-orange-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                {toPersianDigits(i + 1)}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  برنامه {toPersianDigits(i + 1)}
                  {p.active && <span className="text-emerald-500 mr-1">● فعال</span>}
                </p>
                <p className="text-[10px] text-slate-500">
                  {toPersianDigits(p.days)} روز • {toPersianDigits(p.exercises)} حرکت • {toPersianDigits(p.totalCalories)} کالری
                </p>
              </div>
            </div>
            <span className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleDateString("fa-IR")}</span>
          </div>
        ))}
      </div>

      {/* تحلیل فیتاپ هوشمند */}
      {history.aiAnalysis ? (
        <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/30 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-bold text-orange-600">تحلیل فیتاپ هوشمند</p>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{history.aiAnalysis}</p>
        </div>
      ) : (
        <button
          onClick={generateAnalysis}
          disabled={analyzing}
          className="w-full py-2.5 rounded-xl text-white text-xs font-bold transition hover:scale-[1.02] flex items-center justify-center gap-2 mb-3"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          {analyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> فیتاپ هوشمند در حال تحلیل...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> تحلیل پیشرفت توسط فیتاپ هوشمند</>
          )}
        </button>
      )}

      {/* خلاصه آماری */}
      {history.weightLogs?.length > 0 && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
          <span className="text-[11px] text-slate-500">تغییر وزن کل:</span>
          <span className="text-xs font-bold text-slate-900">
            {history.weightLogs[0].weight} → {history.weightLogs[history.weightLogs.length - 1].weight} کیلوگرم
          </span>
        </div>
      )}
    </Card>
  );
}

/* ============ BODY PROGRESS CARD (BODY-COMPOSITION-PRO) ============ */
interface BodyCompHistoryItem {
  date: string; // YYYY-MM-DD
  weight: number;
  bodyFatPercent: number;
  leanBodyMass: number | null;
}

/** کارت پیشرفت بدنی — درصد چربی بدن + جرم خالص + نمودار پیشرفت */
function BodyProgressCard() {
  const { setMainTab } = useAppStore();
  const [history, setHistory] = useState<BodyCompHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/progress", { cache: "no-store" });
        const data = await res.json();
        setHistory(data.bodyCompositionHistory || []);
        // آخرین وزن شناخته‌شده را در store ذخیره کن تا تخمین کالری تمرین
        // (active-workout-session / داشبورد) به‌جای ۷۵kg هاردکد از آن استفاده کند (FE-H7)
        const hist = data.bodyCompositionHistory || [];
        const latestWeight = hist.length > 0 ? Number(hist[hist.length - 1].weight) : NaN;
        if (Number.isFinite(latestWeight) && latestWeight > 0) {
          useAppStore.getState().setLastKnownWeightKg(latestWeight);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <Card className="p-5 bg-white border-2 border-orange-200 shadow-sm">
        <Skeleton className="h-32 rounded-xl" />
      </Card>
    );
  }

  // اگر داده‌ای برای body composition نداریم، CTA نمایش می‌دهیم
  if (history.length === 0) {
    return (
      <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-orange-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-slate-900 mb-1">پیشرفت بدنی</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
              با وارد کردن اندازه‌های بدن (دور کمر و گردن)، فیتاپ هوشمند درصد چربی بدن شما را با فرمول علمی US Navy محاسبه می‌کند و پیشرفت شما را در طول زمان نمایش می‌دهد.
            </p>
            <Button
              size="sm"
              className="rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              onClick={() => setMainTab("progress")}
            >
              <Ruler className="w-4 h-4" />
              اندازه‌های بدنی خود را وارد کنید
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const latest = history[history.length - 1];
  const first = history[0];

  // تبدیل تاریخ میلادی به شمسی کوتاه
  const toJalali = (iso: string): string => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        month: "short",
        day: "numeric",
      }).format(d);
    } catch {
      return iso;
    }
  };

  // تغییرات نسبت به baseline
  const fatChange = latest.bodyFatPercent - first.bodyFatPercent;
  const weightChange = latest.weight - first.weight;

  // داده‌های نمودار
  const chartData = history.map((h) => ({
    name: toJalali(h.date),
    bodyFat: h.bodyFatPercent,
    leanMass: h.leanBodyMass ?? null,
  }));

  return (
    <Card className="p-5 bg-white border-2 border-orange-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(245,158,11,0.15)" }}
          >
            <Activity className="w-4 h-4 text-orange-500" />
          </div>
          <h3 className="font-bold text-slate-900">پیشرفت بدنی</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-orange-600 text-xs"
          onClick={() => setMainTab("progress")}
        >
          جزئیات
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Current body composition — 3 cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Body fat % with circular indicator */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-orange-200 p-3 text-center">
          <BodyFatRing percent={latest.bodyFatPercent} />
          <p className="text-[10px] text-slate-500 mt-1">درصد چربی</p>
          <p className="text-[9px] text-orange-600 font-bold">
            {fatChange !== 0 ? `${fatChange > 0 ? "+" : ""}${toPersianDigits(fatChange.toFixed(1))}٪` : "—"}
          </p>
        </div>
        {/* Lean body mass */}
        <div className="rounded-2xl bg-white border-2 border-orange-100 p-3 text-center">
          <p className="text-[10px] text-slate-500 mb-1">جرم خالص</p>
          {latest.leanBodyMass != null ? (
            <>
              <p className="text-xl font-black font-stat text-slate-900 leading-none">
                {toPersianDigits(latest.leanBodyMass)}
              </p>
              <p className="text-[9px] text-slate-400 mt-0.5">کیلوگرم</p>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-2">—</p>
          )}
        </div>
        {/* Weight */}
        <div className="rounded-2xl bg-white border-2 border-orange-100 p-3 text-center">
          <p className="text-[10px] text-slate-500 mb-1">وزن</p>
          <p className="text-xl font-black font-stat text-slate-900 leading-none">
            {toPersianDigits(latest.weight)}
          </p>
          <p className="text-[9px] text-slate-400 mt-0.5">کیلوگرم</p>
          {weightChange !== 0 && (
            <p className="text-[9px] mt-0.5 flex items-center justify-center gap-0.5"
              style={{ color: weightChange < 0 ? "#10b981" : "#f59e0b" }}
            >
              {weightChange < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : null}
              {toPersianDigits(Math.abs(weightChange).toFixed(1))}
            </p>
          )}
        </div>
      </div>

      {/* Line chart — body fat % (orange) + lean mass (green) */}
      {history.length >= 1 && (
        <div className="rounded-xl bg-slate-50/50 p-3 border border-slate-100">
          <div className="flex items-center justify-between mb-2 text-[10px]">
            <span className="text-slate-600">روند تغییرات</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: "#f97316" }} />
                چربی بدن (٪)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
                جرم خالص (kg)
              </span>
            </div>
          </div>
          <div style={{ width: "100%", height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#cbd5e1" }}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: "11px",
                    borderRadius: "8px",
                    border: "1px solid #fed7aa",
                    background: "#fffbeb",
                  }}
                  labelStyle={{ color: "#92400e" }}
                />
                <Line
                  type="monotone"
                  dataKey="bodyFat"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  dot={{ fill: "#f97316", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="چربی بدن"
                />
                <Line
                  type="monotone"
                  dataKey="leanMass"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: "#10b981", r: 3 }}
                  activeDot={{ r: 5 }}
                  name="جرم خالص"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Footer note */}
      <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
        محاسبه بر اساس فرمول علمی US Navy (دور کمر، گردن و قد)
      </p>
    </Card>
  );
}

/** Circular progress indicator for body fat percentage */
function BodyFatRing({ percent }: { percent: number }) {
  const size = 56;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // درصد چربی را به فرکانس بصری (5-35) تبدیل می‌کنیم تا نمودار معنادار باشد
  const visualFraction = Math.min(1, Math.max(0.05, (percent - 3) / 35));
  const offset = circumference * (1 - visualFraction);
  const color = percent < 14 ? "#06b6d4" : percent < 21 ? "#10b981" : percent < 26 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
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
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-black font-stat text-slate-900 leading-none">
          {toPersianDigits(percent.toFixed(1))}
        </span>
      </div>
    </div>
  );
}
