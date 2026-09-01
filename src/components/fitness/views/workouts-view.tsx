"use client";

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Clock,
  ChevronLeft,
  Check,
  Play,
  RotateCcw,
  Timer,
  Info,
  Zap,
  FileText,
  Image as ImageIcon,
  Pill,
  Repeat,
  Lightbulb,
  MoonStar,
  CalendarDays,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { downloadDataUrl } from "@/lib/fitness/bazaar-bridge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  toPersianDigits,
  PERSIAN_WEEKDAYS,
  sortWeekdaysByPersianOrder,
  canAccess,
  type WorkoutPlanContent,
  type PlanExercise,
} from "@/lib/fitness/types";
import { toast } from "sonner";

// Track set completion locally
interface SetState {
  done: boolean;
  weight: string;
}

// ============================================================
//  Group helper — گروه‌بندی حرکات بر اساس supersetGroup
//  خروجی: لیستی از آیتم‌ها که هر کدام یا تک‌حرکت است یا یک گروه
//  (سوپرست / تری‌ست / جاینت‌ست)
// ============================================================
export type GroupedExercise =
  | { type: "single"; exercise: PlanExercise }
  | {
      type: "group";
      group: string;
      groupType: "superset" | "triset" | "giant";
      circuitRounds?: number;
      restBetweenRounds?: number;
      exercises: PlanExercise[];
    };

export function groupExercises(exercises: PlanExercise[]): GroupedExercise[] {
  const result: GroupedExercise[] = [];
  const seen = new Set<string>();
  for (const ex of exercises) {
    if (ex.supersetGroup && ex.supersetType) {
      if (seen.has(ex.supersetGroup)) continue; // قبلاً به‌عنوان گروه اضافه شده
      seen.add(ex.supersetGroup);
      const members = exercises.filter((e) => e.supersetGroup === ex.supersetGroup);
      // ─── Fix: اگر گروه فقط ۱ عضو دارد، آن را به‌عنوان تک‌حرکت نمایش بده ───
      // این باگ «سوپرست با ۱ حرکت» را در روز آخر حل می‌کند.
      if (members.length <= 1) {
        result.push({ type: "single", exercise: ex });
        continue;
      }
      const withRounds = members.find((e) => typeof e.circuitRounds === "number");
      const withRest = members.find((e) => typeof e.restBetweenRounds === "number");
      result.push({
        type: "group",
        group: ex.supersetGroup,
        groupType: ex.supersetType,
        circuitRounds: withRounds?.circuitRounds,
        restBetweenRounds: withRest?.restBetweenRounds,
        exercises: members,
      });
    } else {
      result.push({ type: "single", exercise: ex });
    }
  }
  return result;
}

/** برچسب فارسی نوع گروه */
export function groupTypeLabel(t: "superset" | "triset" | "giant"): string {
  if (t === "giant") return "جاینت‌ست";
  if (t === "triset") return "تری‌ست";
  return "سوپرست";
}

export function WorkoutsView() {
  const { workoutPlan, setWorkoutPlan, setOverlay, setExerciseDetailId, startSession, user } = useAppStore();
  const [loading, setLoading] = useState(!workoutPlan);
  const [today, setToday] = useState("");
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  /** آیا کاربر خودش روزی را از نوار انتخاب کرده؟ (برای نمایش کارت استراحت تا قبل از انتخاب) */
  const [userPicked, setUserPicked] = useState(false);
  const [setStates, setSetStates] = useState<Record<string, SetState>>({});
  const [restTimer, setRestTimer] = useState<{ remaining: number; total: number } | null>(null);
  const [downloading, setDownloading] = useState<"image" | "pdf" | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  /** نوار روزهای هفته — برای اسکرول خودکار به چیپِ روزِ انتخاب‌شده */
  const dayStripRef = useRef<HTMLDivElement>(null);
  const autoScrolledRef = useRef(false);

  // اسکرول نوار روزها به چیپ فعال (فقط یک‌بار بعد از انتخاب خودکار روزِ امروز)
  useEffect(() => {
    if (autoScrolledRef.current || !dayStripRef.current) return;
    const el = dayStripRef.current.querySelector<HTMLElement>('[data-is-active="true"]');
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      autoScrolledRef.current = true;
    }
  }, [activeDayIdx, workoutPlan, loading]);

  // User plan capabilities — fullExerciseLibrary requires Advanced+ plan
  const canViewVideos = canAccess(user?.planName ?? null, "fullExerciseLibrary");

  useEffect(() => {
    const dayIdx = new Date().getDay();
    const persianIdx = (dayIdx + 1) % 7;
    const todayName = PERSIAN_WEEKDAYS[persianIdx];
    setToday(todayName);

    if (!workoutPlan) {
      (async () => {
        try {
          const res = await fetch("/api/coach/plan", { cache: "no-store" });
          const data = await res.json();
          if (data.workout) setWorkoutPlan(data.workout as WorkoutPlanContent);
        } catch {
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
    // Set active day to today if exists
    // ⚠️ FIX: ایندکس باید روی آرایه‌ی «مرتب‌شده» حساب شود (همان ترتیبی که رندر می‌شود)،
    // نه آرایه‌ی خام — وگرنه وقتی AI روزها را نامرتب برگرداند، روز اشتباهی انتخاب می‌شود.
    if (workoutPlan) {
      const sorted = sortWeekdaysByPersianOrder(workoutPlan.days);
      const idx = sorted.findIndex((d) => d.day === todayName);
      if (idx >= 0) setActiveDayIdx(idx);
      // اگر امروز روز استراحت است (در آرایه نیست)، ایندکس دست نمی‌خورد و
      // کارت ویژه‌ی «روز استراحت» نمایش داده می‌شود تا وقتی کاربر روزی را انتخاب کند.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutPlan, today]);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimer) return;
    if (restTimer.remaining <= 0) {
      const t = setTimeout(() => setRestTimer(null), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setRestTimer((prev) => (prev ? { ...prev, remaining: prev.remaining - 1 } : null));
    }, 1000);
    return () => clearTimeout(t);
  }, [restTimer]);

  const toggleSet = (exerciseId: string, setNumber: number, restSec: number) => {
    const key = `${exerciseId}_${setNumber}`;
    const wasDone = setStates[key]?.done;
    setSetStates((s) => ({
      ...s,
      [key]: { ...s[key], done: !wasDone, weight: s[key]?.weight || "" },
    }));
    if (!wasDone && restSec > 0) {
      setRestTimer({ remaining: restSec, total: restSec });
    }
  };

  const updateWeight = (exerciseId: string, setNumber: number, weight: string) => {
    const key = `${exerciseId}_${setNumber}`;
    setSetStates((s) => ({
      ...s,
      [key]: { done: s[key]?.done ?? false, weight },
    }));
  };

  // ===== Download handlers (Image + PDF) =====
  function formatToday(): string {
    try {
      const d = new Date();
      return `${toPersianDigits(d.getDate())}/${toPersianDigits(d.getMonth() + 1)}/${toPersianDigits(d.getFullYear())}`;
    } catch {
      return "";
    }
  }

  async function downloadAsImage() {
    if (!printableRef.current || !workoutPlan) return;
    setDownloading("image");
    try {
      const { toPng } = await import("html-to-image");
      const node = printableRef.current;
      // ذخیره استایل اصلی + موقتاً visible کردن برای capture
      const originalStyle = {
        visibility: node.style.visibility,
        opacity: node.style.opacity,
        zIndex: node.style.zIndex,
      };
      node.style.visibility = "visible";
      node.style.opacity = "1";
      node.style.zIndex = "-9999"; // زیر سایر عناصر ولی visible
      await new Promise((r) => setTimeout(r, 50));

      let dataUrl: string;
      try {
        dataUrl = await toPng(node, {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor: "#ffffff",
          width: 800,
        });
      } finally {
        // restore — دوباره مخفی کن
        node.style.visibility = originalStyle.visibility;
        node.style.opacity = originalStyle.opacity;
        node.style.zIndex = originalStyle.zIndex;
      }
      // دانلود — در اپ بازار از پل native (Downloads اندروید)، در مرورگر <a download>
      downloadDataUrl(`fitup-workout-${Date.now()}.png`, dataUrl);
      toast.success("تصویر برنامه تمرینی دانلود شد ✓");
    } catch (e) {
      console.error("[downloadAsImage]", e);
      toast.error("خطا در ساخت تصویر برنامه");
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAsPDF() {
    if (!printableRef.current || !workoutPlan) return;
    setDownloading("pdf");
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const node = printableRef.current;
      // ذخیره استایل اصلی + موقتاً visible کردن برای capture
      const originalStyle = {
        visibility: node.style.visibility,
        opacity: node.style.opacity,
        zIndex: node.style.zIndex,
      };
      node.style.visibility = "visible";
      node.style.opacity = "1";
      node.style.zIndex = "-9999";
      await new Promise((r) => setTimeout(r, 50));

      let dataUrl: string;
      try {
        dataUrl = await toPng(node, {
          cacheBust: true,
          pixelRatio: 3,
          backgroundColor: "#ffffff",
          width: 800,
        });
      } finally {
        // restore — دوباره مخفی کن
        node.style.visibility = originalStyle.visibility;
        node.style.opacity = originalStyle.opacity;
        node.style.zIndex = originalStyle.zIndex;
      }
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => {
        img.onload = res;
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
        compress: false,
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgRatio = img.height / img.width;
      const imgWidth = pageWidth - 40;
      const imgHeight = imgWidth * imgRatio;

      // Single page if it fits, otherwise paginate via canvas slicing
      if (imgHeight <= pageHeight - 40) {
        pdf.addImage(dataUrl, "PNG", 20, 20, imgWidth, imgHeight);
      } else {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        ctx.drawImage(img, 0, 0);
        const sliceHeightPx = Math.floor((img.width * (pageHeight - 40)) / (pageWidth - 40));
        let yOff = 0;
        let page = 0;
        while (yOff < img.height) {
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = img.width;
          sliceCanvas.height = Math.min(sliceHeightPx, img.height - yOff);
          const sliceCtx = sliceCanvas.getContext("2d");
          if (!sliceCtx) throw new Error("Canvas 2D context unavailable");
          sliceCtx.drawImage(canvas, 0, yOff, img.width, sliceCanvas.height, 0, 0, img.width, sliceCanvas.height);
          const sliceDataUrl = sliceCanvas.toDataURL("image/png");
          if (page > 0) pdf.addPage();
          const sliceImgHeight = (sliceCanvas.height / img.width) * imgWidth;
          pdf.addImage(sliceDataUrl, "PNG", 20, 20, imgWidth, sliceImgHeight);
          yOff += sliceHeightPx;
          page++;
        }
      }

      // pdf.save در WebView کار نمی‌کند — از طریق dataUrl (در اپ: پل native)
      const pdfDataUrl = pdf.output("datauristring");
      downloadDataUrl(`fitup-workout-${Date.now()}.pdf`, pdfDataUrl);
      toast.success("PDF برنامه تمرینی دانلود شد ✓");
    } catch (e) {
      console.error("[downloadAsPDF]", e);
      toast.error("خطا در ساخت PDF برنامه");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-3 max-w-md mx-auto">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!workoutPlan || !workoutPlan.days.length) {
    return (
      <div className="px-4 py-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Dumbbell className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">برنامه تمرینی موجود نیست</h2>
        <p className="text-muted-foreground text-sm mb-6">
          برای ساخت برنامه تمرینی شخصی‌سازی‌شده، آنبوردینگ را تکمیل کنید.
        </p>
      </div>
    );
  }

  // ─── مرتب‌سازی روزهای هفته بر اساس ترتیب استاندارد فارسی (شنبه → جمعه) ───
  // AI گاهی روزها را نامرتب برمی‌گرداند؛ این تابع آن‌ها را اصلاح می‌کند.
  const sortedDays = sortWeekdaysByPersianOrder(workoutPlan.days);
  const activeDay = sortedDays[activeDayIdx];
  const isToday = activeDay?.day === today;
  const todayInPlan = sortedDays.some((d) => d.day === today);
  /** امروز استراحت است و کاربر هنوز روز دیگری را انتخاب نکرده → کارت استراحت زیبا */
  const showRestToday = !todayInPlan && !userPicked;
  const doneCount = Object.values(setStates).filter((s) => s.done).length;
  const totalSets = activeDay?.exercises.reduce((s, e) => s + e.sets.length, 0) ?? 0;
  const progress = totalSets ? (doneCount / totalSets) * 100 : 0;

  return (
    <div className="px-4 py-4 space-y-4 max-w-md mx-auto">
      {/* Hidden printable workout plan for image/PDF export — کاملاً مخفی، فقط هنگام capture نمایش داده می‌شود */}
      <div
        ref={printableRef}
        style={{
          position: "fixed",
          top: "0",
          left: "0",
          width: "800px",
          background: "#ffffff",
          padding: "32px",
          fontFamily: "Vazirmatn, Tahoma, Arial, system-ui, sans-serif",
          direction: "rtl",
          zIndex: "-9999",
          pointerEvents: "none",
          visibility: "hidden",
          opacity: 0,
        }}
        aria-hidden
      >
        <PrintableWorkout plan={workoutPlan} dateStr={formatToday()} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-black mb-1">برنامه تمرینی</h2>
          <p className="text-sm text-muted-foreground truncate">برنامه تمرینی اختصاصی شما</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadAsImage}
            disabled={downloading !== null}
            title="دانلود تصویر برنامه"
            className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 transition flex items-center justify-center disabled:opacity-50"
          >
            {downloading === "image" ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={downloadAsPDF}
            disabled={downloading !== null}
            title="دانلود PDF"
            className="h-10 px-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {downloading === "pdf" ? (
              <RotateCcw className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span className="text-xs font-bold">PDF</span>
          </button>
        </div>
      </div>

      {/* Day selector */}
      <div
        ref={dayStripRef}
        className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
        style={{
          touchAction: "pan-x pan-y",
          willChange: "scroll-position",
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch",
          scrollSnapType: "x proximity",
        } as CSSProperties}
      >
        {sortedDays.map((day, i) => {
          const dayToday = day.day === today;
          return (
            <button
              key={i}
              onClick={() => {
                setActiveDayIdx(i);
                setUserPicked(true);
              }}
              data-is-active={activeDayIdx === i ? "true" : "false"}
              style={{ scrollSnapAlign: "start" }}
              className={`shrink-0 px-4 py-2.5 rounded-2xl border-2 transition-colors relative ${
                activeDayIdx === i
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              {dayToday && (
                <span className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
              )}
              <div className="text-xs font-bold">{day.day}</div>
              <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                {day.focus}
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── امروز روزِ استراحت است — کارت زیبا + امکان مرور سایر روزها ─── */}
      {showRestToday ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg"
          style={{ background: "linear-gradient(140deg, #292524 0%, #1c1917 55%, #292524 100%)", border: "1.5px solid rgba(217,164,65,0.55)" }}
        >
          <div className="absolute -top-10 -left-6 w-32 h-32 rounded-full blur-3xl opacity-25" style={{ background: "#f59e0b" }} aria-hidden />
          <div className="absolute -bottom-12 -right-8 w-36 h-36 rounded-full blur-3xl opacity-20" style={{ background: "#f97316" }} aria-hidden />
          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-400/15 flex items-center justify-center shrink-0">
              <MoonStar className="w-7 h-7 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-lg text-amber-50">امروز، روزِ استراحتِ توست</h3>
              <p className="text-xs leading-relaxed text-amber-100/70 mt-1.5">
                عضله در باشگاه تحریک می‌شود، اما در استراحت ساخته می‌شود. امروز به بدنت فرصت رشد بده:
                خواب کافی، آب کافی و غذای خوب — فردا قوی‌تر برمی‌گردی.
              </p>
              <p className="text-[11px] text-amber-400/80 mt-3 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                برای مرور برنامه‌ی روزهای دیگر، از نوار بالا روز دلخواهت را انتخاب کن.
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
      {/* Active day card */}
      {activeDay && (
        <>
          <Card className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-lg">{activeDay.title}</h3>
                  {isToday && (
                    <Badge className="bg-primary text-primary-foreground text-[10px]">
                      امروز
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {toPersianDigits(activeDay.estimatedMinutes)} دقیقه
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" />
                    {toPersianDigits(activeDay.exercises.length)} حرکت
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">پیشرفت امروز</span>
              <span className="font-bold text-primary">
                {toPersianDigits(doneCount)} / {toPersianDigits(totalSets)} ست
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-l from-primary to-amber-500"
                animate={{ width: `${progress}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              />
            </div>

            {/* شروع تمرین فعال */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => startSession(activeDay.day)}
              className="w-full mt-3 relative overflow-hidden rounded-2xl bg-gradient-to-l from-primary to-amber-500 text-primary-foreground font-black py-3 pulse-ring flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              شروع تمرین (حالت فعال)
            </motion.button>
          </Card>

          {/* Exercises — به‌صورت گروه‌بندی‌شده (سوپرست/تری‌ست/جاینت‌ست) یا تک‌حرکت */}
          <div className="space-y-3">
            {(() => {
              const grouped = groupExercises(activeDay.exercises);
              // محاسبه ایندکس مطلق هر حرکت برای حفظ رفتار auto-expand کارت اول
              let absIdx = 0;
              return grouped.map((item, itemIdx) => {
                if (item.type === "single") {
                  const ex = item.exercise;
                  const idx = absIdx++;
                  return (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      index={idx}
                      setStates={setStates}
                      onToggleSet={(sn, rest) => toggleSet(ex.id, sn, rest)}
                      onUpdateWeight={(sn, w) => updateWeight(ex.id, sn, w)}
                      onShowDetail={() => {
                        setExerciseDetailId(ex.id);
                        setOverlay("exerciseDetail");
                      }}
                    />
                  );
                }
                // گروه: سوپرست / تری‌ست / جاینت‌ست
                return (
                  <SupersetGroupCard
                    key={`group-${item.group}-${itemIdx}`}
                    group={item.group}
                    groupType={item.groupType}
                    circuitRounds={item.circuitRounds}
                    restBetweenRounds={item.restBetweenRounds}
                    restBetweenGroups={
                      item.exercises[item.exercises.length - 1]?.sets?.slice(-1)[0]?.restSec
                    }
                    groupSize={item.exercises.length}
                  >
                    {item.exercises.map((ex) => {
                      const idx = absIdx++;
                      return (
                        <ExerciseCard
                          key={ex.id}
                          exercise={ex}
                          index={idx}
                          hideSupersetBadge
                          setStates={setStates}
                          onToggleSet={(sn, rest) => toggleSet(ex.id, sn, rest)}
                          onUpdateWeight={(sn, w) => updateWeight(ex.id, sn, w)}
                          onShowDetail={() => {
                            setExerciseDetailId(ex.id);
                            setOverlay("exerciseDetail");
                          }}
                        />
                      );
                    })}
                  </SupersetGroupCard>
                );
              });
            })()}
          </div>

          {/* Notes */}
          {workoutPlan.notes && (
            <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-orange-600 mb-1">نکات هفته</p>
                  <p className="text-xs text-slate-600">{workoutPlan.notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Supplements — برنامه مکمل‌ها (Standard+) */}
          {workoutPlan.supplements && workoutPlan.supplements.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border-2 border-orange-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <Pill className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">برنامه مکمل‌های ورزشی</h3>
              </div>
              <div className="space-y-2">
                {workoutPlan.supplements.map((sup, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-orange-50/50 border border-orange-100">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold shrink-0">
                      {toPersianDigits(i + 1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900">{sup.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-slate-500">دوز: <b className="text-slate-700">{sup.dose}</b></span>
                        <span className="text-[11px] text-slate-500">زمان: <b className="text-slate-700">{sup.timing}</b></span>
                      </div>
                      {sup.note && <p className="text-[10px] text-slate-400 mt-1">{sup.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">⚠️ مشاوره با پزشک قبل از مصرف مکمل‌ها ضروری است</p>
            </div>
          )}
        </>
      )}
        </>
      )}
      {/* ─── پایان شرط showRestToday — بعد از انتخاب روز، کارت عادی نمایش داده می‌شود ─── */}

      {/* Rest timer overlay */}
      <AnimatePresence>
        {restTimer && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm"
          >
            <Card className="p-4 shadow-2xl border-primary/30 bg-card">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 shrink-0">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeDasharray={`${(restTimer.remaining / restTimer.total) * 94.2} 94.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-black">
                    {toPersianDigits(restTimer.remaining)}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-primary" />
                    زمان استراحت
                  </p>
                  <p className="text-xs text-muted-foreground">نفس بکش و آماده ست بعدی شو</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRestTimer(null)}
                  className="rounded-xl"
                >
                  رد کردن
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Printable workout plan — formatted nicely for image/PDF export.
 * Branded with فیتاپ logo + date + all exercises with sets/reps.
 */
function PrintableWorkout({ plan, dateStr }: { plan: WorkoutPlanContent; dateStr: string }) {
  return (
    <div style={{ color: "#1e293b" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #f59e0b", paddingBottom: "16px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #f59e0b, #f97316)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <img src="/fitup-logo.png" alt="فیتاپ" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 900, margin: 0, color: "#1e293b" }}>فیتاپ</h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>برنامه تمرینی هفتگی</p>
          </div>
        </div>
        <div style={{ textAlign: "left" }}>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>تاریخ</p>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>{dateStr}</p>
        </div>
      </div>

      {/* Days — مرتب‌شده بر اساس ترتیب هفته فارسی */}
      {sortWeekdaysByPersianOrder(plan.days).map((day, i) => (
        <div key={i} style={{ marginBottom: "20px", breakInside: "avoid" }}>
          {/* Day header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(135deg, #f59e0b, #f97316)",
              color: "#ffffff",
              padding: "10px 16px",
              borderRadius: "12px",
              marginBottom: "10px",
            }}
          >
            <div>
              <p style={{ fontSize: "18px", fontWeight: 900, margin: 0 }}>{day.day}</p>
              <p style={{ fontSize: "12px", margin: 0, opacity: 0.95 }}>{day.title} • {day.focus}</p>
            </div>
            <div style={{ textAlign: "left", fontSize: "12px" }}>
              <p style={{ margin: 0, fontWeight: 700 }}>⏱ {toPersianDigits(day.estimatedMinutes)} دقیقه</p>
              <p style={{ margin: 0, opacity: 0.95 }}>{toPersianDigits(day.exercises.length)} حرکت</p>
            </div>
          </div>

          {/* Exercise list */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#fff7ed" }}>
                <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #fed7aa", width: "30px", color: "#9a3412" }}>#</th>
                <th style={{ padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #fed7aa", color: "#9a3412" }}>حرکت</th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #fed7aa", color: "#9a3412" }}>ست</th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #fed7aa", color: "#9a3412" }}>تکرار</th>
                <th style={{ padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #fed7aa", color: "#9a3412" }}>استراحت</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // گروه‌بندی حرکات برای نمایش بصری حرفه‌ای در PDF
                const grouped = groupExercises(day.exercises);
                let counter = 0;
                let groupColorIdx = 0;
                const rows: ReactNode[] = [];
                grouped.forEach((item, gi) => {
                  if (item.type === "single") {
                    const num = ++counter;
                    const ex = item.exercise;
                    rows.push(
                      <tr key={`s-${gi}`} style={{ borderBottom: "2px solid #fef3c7" }}>
                        <td style={{ padding: "10px", textAlign: "right", color: "#9a3412", fontWeight: 700, verticalAlign: "top" }}>{toPersianDigits(num)}</td>
                        <td style={{ padding: "10px", textAlign: "right", verticalAlign: "top" }}>
                          <p style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: "14px" }}>{ex.name}</p>
                          <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#94a3b8" }}>{ex.muscle}</p>
                          {ex.description && (
                            <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#475569", lineHeight: 1.6 }}>{ex.description}</p>
                          )}
                          {ex.tips && (
                            <p style={{ margin: "3px 0 0 0", fontSize: "10px", color: "#b45309", lineHeight: 1.5 }}>💡 {ex.tips}</p>
                          )}
                        </td>
                        <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: "#1e293b", verticalAlign: "top" }}>{toPersianDigits(ex.sets.length)}</td>
                        <td style={{ padding: "10px", textAlign: "center", color: "#1e293b", verticalAlign: "top" }}>
                          {ex.sets.map((s, k) => (
                            <span key={k}>
                              {toPersianDigits(s.reps)}
                              {k < ex.sets.length - 1 ? " / " : ""}
                            </span>
                          ))}
                        </td>
                        <td style={{ padding: "10px", textAlign: "center", color: "#1e293b", verticalAlign: "top" }}>
                          {toPersianDigits(ex.sets[0]?.restSec ?? 0) + "s"}
                        </td>
                      </tr>
                    );
                  } else {
                    // گروه: بنر گروه + ردیف‌های حرکات با رنگ تنت
                    const isGiant = item.groupType === "giant";
                    const label = groupTypeLabel(item.groupType);

                    // پالت رنگ متمایز برای هر گروه (A=بنفش، B=آبی، C=سبز، ...)
                    const groupColors = [
                      { bg: "#f3e8ff", border: "#d8b4fe", tint: "#faf5ff", text: "#7e22ce" }, // بنفش
                      { bg: "#dbeafe", border: "#93c5fd", tint: "#eff6ff", text: "#1d4ed8" }, // آبی
                      { bg: "#dcfce7", border: "#86efac", tint: "#f0fdf4", text: "#15803d" }, // سبز
                      { bg: "#fef3c7", border: "#fcd34d", tint: "#fffbeb", text: "#b45309" }, // کهربایی
                      { bg: "#ffe4e6", border: "#fb7185", tint: "#fff1f2", text: "#9f1239" }, // رز
                      { bg: "#ccfbf1", border: "#5eead4", tint: "#f0fdfa", text: "#0f766e" }, // فیروزه‌ای
                    ];
                    const colors = groupColors[groupColorIdx++ % groupColors.length];
                    const bannerBg = colors.bg;
                    const bannerColor = colors.text;
                    const bannerBorder = colors.border;
                    const tintBg = colors.tint;
                    const numColor = colors.text;

                    // محاسبه استراحت بین گروه‌ها (آخرین ستِ آخرین حرکتِ گروه)
                    const lastExInGroup = item.exercises[item.exercises.length - 1];
                    const restBetweenGroups = lastExInGroup?.sets?.slice(-1)[0]?.restSec ?? 0;
                    const exCount = item.exercises.length;

                    // ردیف بنر گروه (تمام عرض) — شامل نوع، حرف، تعداد حرکات، و استراحت‌ها
                    let bannerText = `🔗 ${label} ${item.group} (${toPersianDigits(exCount)} حرکت) — بدون استراحت بین حرکات`;
                    if (isGiant && item.circuitRounds) {
                      bannerText += ` • ${toPersianDigits(item.circuitRounds)} دور`;
                    }
                    if (isGiant && item.restBetweenRounds) {
                      bannerText += ` • استراحت بین دورها: ${toPersianDigits(item.restBetweenRounds)} ثانیه`;
                    }
                    if (restBetweenGroups > 0) {
                      bannerText += ` • استراحت بعد از گروه: ${toPersianDigits(restBetweenGroups)} ثانیه`;
                    }

                    rows.push(
                      <tr key={`b-${gi}`}>
                        <td colSpan={5} style={{
                          background: bannerBg,
                          color: bannerColor,
                          padding: "8px 12px",
                          fontWeight: 800,
                          fontSize: "11px",
                          borderBottom: `2px solid ${bannerBorder}`,
                          borderTop: `2px solid ${bannerBorder}`,
                          textAlign: "right",
                        }}>
                          {bannerText}
                        </td>
                      </tr>
                    );

                    // ردیف‌های حرکات داخل گروه — با شماره A1, A2, ... و پس‌زمینه رنگی
                    item.exercises.forEach((ex, idx) => {
                      const num = ++counter;
                      const isLastInGroup = idx === item.exercises.length - 1;
                      rows.push(
                        <tr key={`g-${gi}-${idx}`} style={{ borderBottom: `1px solid ${bannerBorder}`, background: tintBg }}>
                          <td style={{ padding: "10px", textAlign: "right", color: numColor, fontWeight: 800, verticalAlign: "top", fontSize: "12px" }}>
                            {item.group}{toPersianDigits(idx + 1)}
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", verticalAlign: "top" }}>
                            <p style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: "14px" }}>{ex.name}</p>
                            <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#94a3b8" }}>{ex.muscle}</p>
                            {ex.description && (
                              <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#475569", lineHeight: 1.6 }}>{ex.description}</p>
                            )}
                            {ex.tips && (
                              <p style={{ margin: "3px 0 0 0", fontSize: "10px", color: "#b45309", lineHeight: 1.5 }}>💡 {ex.tips}</p>
                            )}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", fontWeight: 700, color: "#1e293b", verticalAlign: "top" }}>{toPersianDigits(ex.sets.length)}</td>
                          <td style={{ padding: "10px", textAlign: "center", color: "#1e293b", verticalAlign: "top" }}>
                            {ex.sets.map((s, k) => (
                              <span key={k}>
                                {toPersianDigits(s.reps)}
                                {k < ex.sets.length - 1 ? " / " : ""}
                              </span>
                            ))}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", verticalAlign: "top" }}>
                            {/* در سوپرست/تری‌ست/جاینت‌ست استراحت بین حرکات صفر است؛
                                فقط آخرین حرکتِ گروه، استراحتِ بین گروه‌ها را نشان می‌دهد */}
                            {isLastInGroup && restBetweenGroups > 0 ? (
                              <span style={{ fontSize: "11px", color: numColor, fontWeight: 700 }}>
                                {toPersianDigits(restBetweenGroups)}s
                              </span>
                            ) : (
                              <span style={{ fontSize: "10px", color: numColor }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  }
                });
                return rows;
              })()}
            </tbody>
          </table>
        </div>
      ))}

      {/* Notes */}
      {plan.notes && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px dashed #fdba74",
            borderRadius: "12px",
            padding: "12px 16px",
            marginTop: "12px",
          }}
        >
          <p style={{ fontSize: "12px", color: "#ea580c", fontWeight: 700, margin: "0 0 4px 0" }}>📝 نکات هفته</p>
          <p style={{ fontSize: "12px", color: "#1e293b", margin: 0, lineHeight: 1.6 }}>{plan.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: "24px",
          paddingTop: "14px",
          borderTop: "2px solid #fed7aa",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "#94a3b8",
        }}
      >
        <span>هر بدنی فیتاپ میخواد 💪</span>
        <span>ساخته‌شده با فیتاپ هوشمند</span>
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  index,
  setStates,
  onToggleSet,
  onUpdateWeight,
  onShowDetail,
  hideSupersetBadge = false,
}: {
  exercise: PlanExercise;
  index: number;
  setStates: Record<string, SetState>;
  onToggleSet: (setNumber: number, restSec: number) => void;
  onUpdateWeight: (setNumber: number, weight: string) => void;
  onShowDetail: () => void;
  /** اگر داخل SupersetGroupCard رندر می‌شود، بج درون‌کارت مخفی می‌شود */
  hideSupersetBadge?: boolean;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const doneSets = exercise.sets.filter((s) => setStates[`${exercise.id}_${s.setNumber}`]?.done).length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-right"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center shrink-0">
          <Dumbbell className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm truncate">{exercise.name}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground">{exercise.muscle}</span>
            <span className="text-[11px] text-muted-foreground">•</span>
            <span className="text-[11px] text-muted-foreground">
              {toPersianDigits(exercise.sets.length)} ست
            </span>
            {doneSets === exercise.sets.length && (
              <Badge className="bg-emerald-500 text-white text-[9px] h-4">کامل ✓</Badge>
            )}
          </div>
        </div>
        <ChevronLeft
          className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? "-rotate-90" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Superset badge if applicable (و فقط اگر داخل گروه نیست) */}
              {!hideSupersetBadge && exercise.supersetGroup && exercise.supersetType && (
                <div className="mb-2 p-2 rounded-xl bg-purple-50 border border-purple-200 flex items-center gap-2">
                  <Repeat className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-[10px] font-bold text-purple-700">
                    {groupTypeLabel(exercise.supersetType)} — گروه {exercise.supersetGroup}
                  </span>
                  <span className="text-[9px] text-purple-500 mr-auto">بدون استراحت بین حرکات</span>
                </div>
              )}

              {/* Description + tips from plan (always visible) */}
              {exercise.description && (
                <div className="mb-2 p-2.5 rounded-xl bg-orange-50/50 border border-orange-100">
                  <p className="text-[11px] text-slate-700 leading-relaxed">{exercise.description}</p>
                </div>
              )}
              {exercise.tips && (
                <div className="mb-2 flex items-start gap-1.5 p-2 rounded-xl bg-amber-50/50">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 leading-relaxed">{exercise.tips}</p>
                </div>
              )}

              {/* Action buttons: Show exercise detail (internal library) + Show detail */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={onShowDetail}
                  className="flex-1 flex items-center gap-2 p-3 rounded-xl bg-orange-50 hover:bg-orange-100 transition text-right border border-orange-200"
                >
                  <Dumbbell className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-xs font-medium text-orange-700 flex-1">توضیح حرکت</span>
                  <ChevronLeft className="w-4 h-4 text-orange-400" />
                </button>
                <button
                  onClick={onShowDetail}
                  className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 hover:bg-muted transition text-right"
                >
                  <Info className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground">جزئیات</span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Sets */}
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-muted-foreground px-2">
                  <div className="col-span-2 text-center">ست</div>
                  <div className="col-span-3 text-center">تکرار</div>
                  <div className="col-span-3 text-center">وزنه (kg)</div>
                  <div className="col-span-2 text-center">استراحت</div>
                  <div className="col-span-2 text-center">انجام</div>
                </div>
                {exercise.sets.map((set) => {
                  const state = setStates[`${exercise.id}_${set.setNumber}`];
                  return (
                    <div
                      key={set.setNumber}
                      className={`grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl border transition ${
                        state?.done
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="col-span-2 text-center text-sm font-bold">
                        {toPersianDigits(set.setNumber)}
                      </div>
                      <div className="col-span-3 text-center text-xs font-medium">
                        {toPersianDigits(set.reps)}
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={state?.weight || ""}
                          onChange={(e) => onUpdateWeight(set.setNumber, e.target.value)}
                          placeholder="—"
                          dir="ltr"
                          className="w-full h-8 text-center text-xs rounded-lg border bg-background px-1"
                        />
                      </div>
                      <div className="col-span-2 text-center text-[11px] text-muted-foreground">
                        {hideSupersetBadge && set.restSec === 0 ? (
                          <span className="text-[10px] opacity-70">—</span>
                        ) : (
                          `${toPersianDigits(set.restSec)}s`
                        )}
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <button
                          onClick={() => onToggleSet(set.setNumber, set.restSec)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                            state?.done
                              ? "bg-emerald-500 text-white"
                              : "bg-muted hover:bg-primary hover:text-primary-foreground"
                          }`}
                        >
                          <Check className="w-4 h-4" strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ============================================================
//  SupersetGroupCard — نگه‌دارنده بصری برای گروه سوپرست/تری‌ست/جاینت‌ست
//  - سوپرست/تری‌ست: بنفش (سازگار با رنگ قبلی)
//  - جاینت‌ست: رز/قرمز متمایز
//  - رابط خط‌چین عمودی بین کارت‌های حرکات
//  - فوتر استراحت بین گروه‌ها
// ============================================================
function SupersetGroupCard({
  group,
  groupType,
  circuitRounds,
  restBetweenRounds,
  restBetweenGroups,
  groupSize,
  children,
}: {
  group: string;
  groupType: "superset" | "triset" | "giant";
  circuitRounds?: number;
  restBetweenRounds?: number;
  restBetweenGroups?: number;
  groupSize?: number;
  children: ReactNode;
}) {
  const isGiant = groupType === "giant";
  const isTriset = groupType === "triset";
  const label = groupTypeLabel(groupType);

  // رنگ‌بندی متمایز: بنفش برای سوپرست/تری‌ست، رز/نارنجی برای جاینت‌ست
  const containerCls = isGiant
    ? "rounded-2xl border-2 border-rose-300/80 bg-gradient-to-br from-rose-50/70 via-orange-50/30 to-transparent p-2.5 space-y-2 shadow-sm"
    : "rounded-2xl border-2 border-purple-300/80 bg-gradient-to-br from-purple-50/70 via-orange-50/20 to-transparent p-2.5 space-y-2 shadow-sm";

  const headerCls = isGiant
    ? "bg-gradient-to-l from-rose-500 to-orange-500 text-white"
    : "bg-gradient-to-l from-purple-500 to-fuchsia-500 text-white";

  const infoCls = isGiant
    ? "bg-rose-100/70 border-rose-200 text-rose-700"
    : "bg-purple-100/70 border-purple-200 text-purple-700";

  const footerCls = isGiant
    ? "bg-rose-50/80 border-rose-200 text-rose-700"
    : "bg-purple-50/80 border-purple-200 text-purple-700";

  // رنگ خط رابط بین حرکات
  const connectorColor = isGiant ? "#fb7185" : "#c084fc";

  // خلاصه توضیح نوع گروه
  const typeHint = isGiant
    ? "۴ حرکت یا بیشتر — سیرکویت"
    : isTriset
      ? "۳ حرکت پشت سر هم"
      : "۲ حرکت پشت سر هم";

  return (
    <div className={containerCls}>
      {/* هدر گروه — نوع + حرف گروه + بدون استراحت بین حرکات */}
      <div className={`${headerCls} rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm`}>
        <span className="text-sm leading-none">🔗</span>
        <span className="text-xs font-black">
          {label} {group}
        </span>
        {groupSize ? (
          <span className="text-[10px] font-bold opacity-90 px-1.5 py-0.5 rounded-full bg-white/20">
            {toPersianDigits(groupSize)} حرکت
          </span>
        ) : null}
        <span className="text-[10px] opacity-95 mr-auto flex items-center gap-1">
          <Zap className="w-3 h-3" />
          {typeHint}
        </span>
      </div>

      {/* اطلاعات ویژه جاینت‌ست: تعداد دورها + استراحت بین دورها */}
      {isGiant && (circuitRounds || restBetweenRounds) && (
        <div className={`flex items-center flex-wrap gap-x-3 gap-y-1 px-3 py-1.5 rounded-lg border text-[10px] ${infoCls}`}>
          {circuitRounds ? (
            <span className="flex items-center gap-1 font-bold">
              <Repeat className="w-3 h-3" />
              {toPersianDigits(circuitRounds)} دور
            </span>
          ) : null}
          {restBetweenRounds ? (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              استراحت بین دورها: {toPersianDigits(restBetweenRounds)} ثانیه
            </span>
          ) : null}
        </div>
      )}

      {/* کارت‌های حرکات داخل گروه — با رابط خط‌چین عمودی */}
      <div className="relative pr-2">
        {/* خط چین عمودی روی راست — نماد اتصال حرکات به هم */}
        <div
          className="absolute right-2 top-2 bottom-2 border-r-2 border-dashed opacity-50 pointer-events-none"
          style={{ borderColor: connectorColor }}
        />
        <div className="space-y-2 relative">{children}</div>
      </div>

      {/* فوتر: استراحت واقعی بین گروه‌ها (پس از اتمام کل گروه) */}
      {restBetweenGroups != null && restBetweenGroups > 0 ? (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold ${footerCls}`}>
          <Clock className="w-3 h-3" />
          استراحت بعد از این گروه: {toPersianDigits(restBetweenGroups)} ثانیه
          <span className="font-normal opacity-80 mr-auto">سپس گروه بعدی را شروع کن</span>
        </div>
      ) : (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold ${footerCls}`}>
          <Clock className="w-3 h-3" />
          بدون استراحت بعد از این گروه — مستقیم گروه بعدی
        </div>
      )}
    </div>
  );
}
