"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Dumbbell, Salad, Pill, Calendar, ChevronDown,
  Sparkles, Loader2, Utensils, FileText, Image as ImageIcon, X, Repeat, Lightbulb,
  PlayCircle, Info, Camera, Video, TestTube, Ruler, Clock, AlertCircle,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toPersianDigits, PLAN_LABELS, sortWeekdaysByPersianOrder, fixUnitOrder, stripUnitFromFoodName } from "@/lib/fitness/types";
import { fetchJson, fetchJsonOrThrow } from "@/lib/fitness/fetch-json";
import { toast } from "sonner";
import { groupExercises, groupTypeLabel } from "./workouts-view";
import { PrerequisitesBanner } from "./prerequisites-banner";

interface ProgramItem {
  id: string;
  weekIndex: number;
  active: boolean;
  createdAt: string;
  days: number;
  exercises: number;
  weeklyGoal: string;
  notes: string;
  totalCalories: number;
  planName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  // تاریخ لغو توسط ادمین — اگر موجود باشد، برنامه از startDate تا cancelledAt نمایش داده می‌شود
  cancelledAt?: string | null;
  supplements?: { name: string; dose: string; timing: string; note?: string }[];
  // برنامه مکمل پیشرفته با دسته‌بندی (base / advanced / targeted) و هشدارهای پزشکی
  supplementStack?: {
    category: string; // base | advanced | targeted
    name: string;
    dose: string;
    timing: string;
    note?: string;
    contraindicatedFor?: string[]; // شرایطی که نباید مصرف کند
  }[];
  meals?: {
    label: string;
    totalCalories: number;
    combination?: string;
    items?: { name: string; calories: number; servingSize?: string; protein?: number; carbs?: number; fat?: number }[];
    alternatives?: { combination: string; totalCalories: number }[];
  }[];
  mealNotes?: string;
  waterLiters?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  workoutDays?: any[];
}

// ─── Helper: فرمت تاریخ امروز (فارسی شمسی) ───
// از toLocaleDateString("fa-IR") استفاده می‌کنیم تا تاریخ شمسی نمایش داده شود.
function formatToday(): string {
  try {
    return new Date().toLocaleDateString("fa-IR");
  } catch {
    return "";
  }
}

// ─── Helper: تاریخ پایان واقعی برنامه (از subscription.endDate) ───
// اگر program.endDate وجود داشته باشد (از دیتابیس)، همان را برمی‌گرداند.
// این تاریخ می‌تواند تاریخ واقعی پایان پلن باشد، یا اگر پلن توسط مدیر لغو شده باشد،
// تاریخ لغو را نشان می‌دهد (چون در manage-subscription، endDate به now تغییر می‌کند).
// اگر program.endDate وجود نداشت، fallback به امروز + ۴۵ روز.
function formatEndDate(program?: { endDate?: string | null }, days = 45): string {
  try {
    // اول: استفاده از endDate واقعی از دیتابیس
    if (program?.endDate) {
      const d = new Date(program.endDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("fa-IR");
      }
    }
    // fallback: امروز + ۴۵ روز
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("fa-IR");
  } catch {
    return "";
  }
}

// ─── Helper: دریافت videoUrl حرکت از ExerciseLibrary (با کش) ───
//export شده تا ویو‌های دیگر (مثل gym-mode-view) هم بتوانند از آن استفاده کنند.
const videoUrlCache = new Map<string, string>();

export async function fetchExerciseVideoUrl(name: string): Promise<string> {
  if (videoUrlCache.has(name)) return videoUrlCache.get(name)!;
  try {
    const res = await fetch(`/api/exercises?search=${encodeURIComponent(name)}`, { cache: "no-store" });
    if (!res.ok) return "";
    const data = await res.json();
    const exercises: any[] = data.exercises || [];
    // تطبیق دقیق نام، در غیر این صورت اولین نتیجه
    const match = exercises.find((e) => e.name === name) || exercises[0];
    const url = match?.youtubeUrl || "";
    videoUrlCache.set(name, url);
    return url;
  } catch {
    return "";
  }
}

/**
 * نوع یک پیش‌نیاز (با تمام فیلدهای برگشتی از API برنامه‌ریزی برنامه).
 * در سطح ماژول تعریف شده تا هم در ProgramsView و هم در PrerequisiteCard قابل
 * استفاده باشد.
 */
interface PrerequisiteItemT {
  id: string;
  type: "body_photo" | "video_body" | "blood_test" | "body_measurements";
  label: string;
  description: string;
  required: boolean;
  status: "completed" | "pending" | "pending_decision" | "incomplete";
  statusLabel: string;
  tab: string;
  actionLabel: string;
}

export function ProgramsView() {
  const { user, setMainTab, setBodyAnalysisOpen, setOverlay } = useAppStore();
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [viewModal, setViewModal] = useState<{ type: "workout" | "meal" | "supplement"; program: ProgramItem } | null>(null);

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
      toast.success("تحلیل فیتاپ هوشمند آماده شد ✨");
    } catch { toast.error("خطا در تحلیل"); }
    finally { setAnalyzing(false); }
  }

  async function regeneratePlan() {
    setRegenerating(true);
    try {
      // قرارداد جدید: PUT /api/coach/plan برنامه را سینکرون نمی‌سازد — پاسخ فوری
      // برمی‌گردد و تولید در پس‌زمینه انجام می‌شود. fetchJsonOrThrow پاسخ HTML
      // گیت‌وی/سرور را به پیام فارسی تبدیل می‌کند (قبلاً res.json() قبل از چک
      // res.ok اجرا می‌شد و خطای انگلیسی «Unexpected token» می‌داد).
      await fetchJsonOrThrow<any>(
        "/api/coach/plan",
        { method: "PUT" },
        "خطا در ساخت برنامه"
      );
      // تولید پس‌زمینه است — توست هم باید همین را بگوید (مثل nutrition-view)،
      // نه «با موفقیت ساخته شد» که هنوز رخ نداده است.
      toast.success("درخواست بازسازی ارسال شد — برنامه در حال ساخت است ⏳");
      // reload history — تا تولید کامل شود programStatus=generating می‌ماند
      const { res: hres, data: hdata } = await fetchJson<any>(
        "/api/coach/program-history",
        { cache: "no-store" }
      );
      if (hres.ok) setHistory(hdata);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت برنامه");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-3 max-w-3xl mx-auto">
        <Skeleton className="h-8 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const programs: ProgramItem[] = history?.programs || [];

  // ─── اطلاعات پیش‌نیازها از API (سیستم دانه‌دانه) ───
  const prerequisites: PrerequisiteItemT[] = history?.prerequisites || [];
  const pendingPrerequisites: PrerequisiteItemT[] =
    history?.pendingPrerequisites || [];
  const canGenerateProgram: boolean = history?.canGenerateProgram ?? false;
  const blockingReason: string | null = history?.blockingReason ?? null;
  const programStatus: string = history?.programStatus || "ready";
  const isGenerating = programStatus === "generating";

  // رنگ و آیکون بر اساس نوع پیش‌نیاز
  function prereqIcon(type: PrerequisiteItemT["type"]) {
    switch (type) {
      case "body_photo":
        return <Camera className="w-4 h-4 text-white" />;
      case "video_body":
        return <Video className="w-4 h-4 text-white" />;
      case "blood_test":
        return <TestTube className="w-4 h-4 text-white" />;
      case "body_measurements":
        return <Ruler className="w-4 h-4 text-white" />;
    }
  }

  // رنگ بکگراند بادج وضعیت
  function statusBadgeClass(status: PrerequisiteItemT["status"]) {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 border-green-200";
      case "pending":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "pending_decision":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "incomplete":
      default:
        return "bg-rose-100 text-rose-700 border-rose-200";
    }
  }

  // ─── نمایش پیش‌نیازهای تکمیل‌نشده ───
  // مهم: حتی اگر کاربر برنامه قبلی دارد (مثلاً از basic به advanced ارتقا پیدا کرده)،
  // اگر پیش‌نیازهای پلن جدید (مثل عکس بدن برای advanced) تکمیل نشده، باید banner نمایش داده شود.
  // این banner بالای برنامه‌های موجود نمایش داده می‌شود تا کاربر بداند باید پیش‌نیازها را تکمیل کند.
  const showPrerequisitesBanner = !!user?.planName && pendingPrerequisites.length > 0;

  if (programs.length === 0) {
    // ─── اگر کاربر پلن خریده ولی برنامه ندارد ───
    // پیش‌نیازها توسط PrerequisitesBanner در داشبورد نمایش داده می‌شوند.
    // اینجا فقط پیام «در انتظار» یا «در حال تولید» نشان می‌دهیم.

    // ─── حالت ۲: برنامه در حال تولید است ───
    if (user?.planName && isGenerating) {
      return (
        <div className="px-4 py-8 text-center max-w-md mx-auto">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 overflow-hidden" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">برنامه شما در حال ساخت است...</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            فیتاپ هوشمند در حال طراحی برنامه تمرینی و غذایی شخصی‌سازی‌شده شماست. این کار چند ثانیه طول می‌کشد. لطفاً این صفحه را رفرش کنید یا چند لحظه صبر کنید.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="rounded-xl text-white gap-2"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Loader2 className="w-4 h-4 animate-spin" /> بررسی مجدد
          </Button>
        </div>
      );
    }

    // ─── حالت ۳: کاربر پلن خریده، پیش‌نیازها تکمیل شده، ولی برنامه هنوز ساخته نشده ───
    return (
      <div className="px-4 py-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 overflow-hidden" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">هنوز برنامه‌ای ندارید</h2>
        <p className="text-sm text-slate-500 mb-6">
          {user?.planName
            ? "برنامه اختصاصی شما ساخته نشده است. همین حالا با فیتاپ هوشمند بسازید."
            : "برای دریافت برنامه اختصاصی، ابتدا یک پلن خریداری کنید."}
        </p>
        {user?.planName ? (
          <Button
            onClick={regeneratePlan}
            disabled={regenerating}
            className="rounded-xl text-white gap-2"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            {regenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> فیتاپ هوشمند در حال ساخت برنامه...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> ساخت برنامه با فیتاپ هوشمند</>
            )}
          </Button>
        ) : (
          <Button onClick={() => setMainTab("plans")} className="rounded-xl text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            خرید پلن
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-black text-slate-900">برنامه‌های من</h2>
        <p className="text-sm text-slate-500">{toPersianDigits(programs.length)} برنامه — برنامه جاری و برنامه‌های قبلی</p>
      </div>

      {/* پیش‌نیازها توسط PrerequisitesBanner در داشبورد نمایش داده می‌شوند */}

      {/* تحلیل فیتاپ هوشمند — با خرید هر برنامه یکبار قابل استفاده است */}

      {/* تحلیل فیتاپ هوشمند — با خرید هر برنامه یکبار قابل استفاده است */}
      {history?.aiAnalysis ? (
        <Card className="p-4 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-orange-600">تحلیل فیتاپ هوشمند</p>
              <p className="text-[10px] text-slate-400">با خرید هر برنامه، یک‌بار قابل استفاده است</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{history.aiAnalysis}</p>
        </Card>
      ) : programs.length > 0 && user?.planName ? (
        <Card className="p-4 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-orange-600">تحلیل فیتاپ هوشمند</p>
              <p className="text-[10px] text-slate-400">با خرید هر برنامه، یک‌بار قابل استفاده است</p>
            </div>
          </div>
          <Button onClick={generateAnalysis} disabled={analyzing} className="w-full rounded-xl text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
            {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> فیتاپ هوشمند در حال تحلیل...</> : <><Sparkles className="w-4 h-4" /> تحلیل پیشرفت توسط فیتاپ هوشمند</>}
          </Button>
        </Card>
      ) : null}

      {/* برنامه‌ها — جاری در بالا، قبلی در پایین */}
      {programs.map((p, i) => (
        <ProgramCard
          key={p.id}
          program={p}
          index={i}
          userHasPlan={!!user?.planName}
          onOpenView={(type, prog) => setViewModal({ type, program: prog })}
        />
      ))}

      {/* Plan View Modal with download — single type */}
      {viewModal && (
        <PlanViewModal
          type={viewModal.type}
          program={viewModal.program}
          onClose={() => setViewModal(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   PrerequisiteCard — کارت پیش‌نیاز با دکمه‌های جذاب و نوع‌خاص
   - body_photo: «آپلود عکس بدن» با آیکون Camera → باز کردن modal آپلود
   - video_body: «آپلود ویدیو» + «رد کردن» (هر دو اختیاری)
   - blood_test: «آپلود آزمایش» + «آزمایش دادم» + «رد کردن»
   - body_measurements: «ورود اندازه‌ها» با آیکون Ruler
   ============================================================ */
function PrerequisiteCard({
  pre,
  prereqIcon,
  statusBadgeClass,
  onOpenBodyAnalysis,
  onSkipVideo,
  onBloodTestUpload,
  onBloodTestWaiting,
  onBloodTestDecline,
  onOpenMeasurements,
}: {
  pre: PrerequisiteItemT;
  prereqIcon: (t: PrerequisiteItemT["type"]) => ReactNode;
  statusBadgeClass: (s: PrerequisiteItemT["status"]) => string;
  onOpenBodyAnalysis: () => void;
  onSkipVideo: () => Promise<void> | void;
  onBloodTestUpload: () => void;
  onBloodTestWaiting: () => Promise<void> | void;
  onBloodTestDecline: () => Promise<void> | void;
  onOpenMeasurements: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function wrap(fn: () => Promise<void> | void) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          {prereqIcon(pre.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-bold text-slate-900 text-sm leading-tight">{pre.label}</p>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusBadgeClass(pre.status)}`}
            >
              {pre.statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-2.5">{pre.description}</p>

          {/* دکمه‌های مخصوص هر نوع پیش‌نیاز */}
          {pre.type === "body_photo" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={onOpenBodyAnalysis}
                disabled={busy}
                className="rounded-xl text-white font-bold gap-1.5 text-xs shadow-md hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <Camera className="w-3.5 h-3.5" />
                {pre.status === "completed" ? "ارسال مجدد عکس بدن" : "آپلود عکس بدن"}
              </Button>
              <span className="text-[10px] text-rose-600 font-bold">الزامی</span>
            </div>
          )}

          {pre.type === "video_body" && pre.status === "pending_decision" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={onOpenBodyAnalysis}
                disabled={busy}
                className="rounded-xl text-white font-bold gap-1.5 text-xs shadow-md hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <Video className="w-3.5 h-3.5" />
                آپلود ویدیو
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => wrap(onSkipVideo)}
                className="rounded-xl border-2 border-orange-300 text-orange-700 bg-white/70 hover:bg-orange-50 text-xs gap-1.5"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                رد کردن ویدیو
              </Button>
              <span className="text-[10px] text-amber-600 font-bold">اختیاری — تعیین تکلیف الزامی</span>
            </div>
          )}

          {pre.type === "video_body" && pre.status === "completed" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenBodyAnalysis}
                disabled={busy}
                className="rounded-xl border-2 border-emerald-300 text-emerald-700 bg-white/70 hover:bg-emerald-50 text-xs gap-1.5"
              >
                <Video className="w-3.5 h-3.5" />
                ارسال مجدد
              </Button>
              <span className="text-[10px] text-emerald-600 font-bold">{pre.statusLabel}</span>
            </div>
          )}

          {pre.type === "blood_test" && pre.status === "pending_decision" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={onBloodTestUpload}
                disabled={busy}
                className="rounded-xl text-white font-bold gap-1.5 text-xs shadow-md hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <TestTube className="w-3.5 h-3.5" />
                آپلود آزمایش خون
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => wrap(onBloodTestWaiting)}
                className="rounded-xl border-2 border-blue-300 text-blue-700 bg-white/70 hover:bg-blue-50 text-xs gap-1.5"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                آزمایش دادم، منتظر جوابم
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => wrap(onBloodTestDecline)}
                className="rounded-xl border-2 border-orange-300 text-orange-700 bg-white/70 hover:bg-orange-50 text-xs gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                رد کردن
              </Button>
              <span className="text-[10px] text-amber-600 font-bold">اختیاری — تعیین تکلیف الزامی</span>
            </div>
          )}

          {pre.type === "blood_test" && pre.status === "pending" && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-700 leading-relaxed">
              ⏳ در انتظار نتایج آزمایش خون. وقتی جواب آماده شد، از بخش «آزمایش خون» آپلود کنید.
              <button
                type="button"
                disabled={busy}
                onClick={() => wrap(onBloodTestDecline)}
                className="block mt-1.5 text-[10px] text-rose-600 hover:text-rose-700 underline"
              >
                آپلود نمی‌کنم
              </button>
            </div>
          )}

          {pre.type === "blood_test" && pre.status === "completed" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={onBloodTestUpload}
                disabled={busy}
                className="rounded-xl border-2 border-emerald-300 text-emerald-700 bg-white/70 hover:bg-emerald-50 text-xs gap-1.5"
              >
                <TestTube className="w-3.5 h-3.5" />
                ارسال مجدد
              </Button>
              <span className="text-[10px] text-emerald-600 font-bold">{pre.statusLabel}</span>
            </div>
          )}

          {pre.type === "body_measurements" && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={onOpenMeasurements}
                disabled={busy}
                className="rounded-xl text-white font-bold gap-1.5 text-xs shadow-md hover:shadow-lg transition-all"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <Ruler className="w-3.5 h-3.5" />
                {pre.status === "completed" ? "ویرایش اندازه‌ها" : "ورود اندازه‌های بدنی"}
              </Button>
              <span className="text-[10px] text-slate-500 font-bold">اختیاری — تشویقی</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   ProgramCard — ردیزایش شده
   - هدر گرادیان با لوگو
   - ۳ دکمه اقدام (تمرین/تغذیه/مکمل) به‌صورت کارت
   ============================================================ */
function ProgramCard({ program, index, onOpenView, userHasPlan }: {
  program: ProgramItem;
  index: number;
  onOpenView: (type: "workout" | "meal" | "supplement", program: ProgramItem) => void;
  /** آیا کاربر پلن فعال دارد؟ اگر پلن توسط مدیر لغو شده باشد (planName=null)،
   *  هیچ برنامه‌ای نباید «جاری» نشان داده شود — حتی اگر active=true باشد. */
  userHasPlan: boolean;
}) {
  // یک برنامه فقط زمانی «جاری» است که هم active=true باشد و هم کاربر پلن فعال داشته باشد.
  // اگر مدیر پلن را لغو کرده باشد (planName=null)، حتی اگر program.active=true باشد،
  // نباید badge «جاری» نمایش داده شود.
  const isCurrent = program.active && userHasPlan;
  // وضعیت اشتراک — اگر "pending" باشد (advanced/ultimate هنوز پیش‌نیازها
  // تکمیل نشده)، دوره هنوز شروع نشده و پیشرفت نباید نمایش داده شود.
  const isPending = program.status === "pending";
  // در حالت pending، startDate/endDate در ProgramHistory به‌جای null با
  // fallback (wp.createdAt) پر می‌شوند — برای نمایش صحیح باید فقط در صورت
  // وجود endDate واقعی، progress محاسبه شود.
  const startDate = program.startDate ? new Date(program.startDate) : null;
  const endDate = program.endDate ? new Date(program.endDate) : null;
  // تاریخ لغو توسط ادمین — اگر موجود باشد، برنامه از startDate تا cancelledAt نمایش داده می‌شود
  // (نه endDate اصلی که ممکن است در آینده باشد).
  const cancelledAt = program.cancelledAt ? new Date(program.cancelledAt) : null;
  // تاریخ پایان واقعی برای نمایش: اگر لغو شده، cancelledAt، در غیر این صورت endDate.
  const effectiveEndDate = cancelledAt || endDate;

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const daysPassed = startDate
    ? Math.max(0, Math.floor((Date.now() - startDate.getTime()) / MS_PER_DAY))
    : 0;
  const daysTotal = startDate && effectiveEndDate
    ? Math.max(1, Math.ceil((effectiveEndDate.getTime() - startDate.getTime()) / MS_PER_DAY))
    : 0;
  // پیشرفت دوره: فقط وقتی اشتراک فعال و دارای startDate/endDate واقعی است.
  // برای pending: پیشرفت ۰ نمایش داده نمی‌شود (کارت نشان می‌دهد «در انتظار شروع»).
  // برای برنامه‌های قبلی (غیرفعال): ۱۰۰٪ نشان داده می‌شود.
  const progressPct = !isCurrent
    ? 100
    : isPending || !startDate || !effectiveEndDate || daysTotal === 0
    ? 0
    : Math.min(100, Math.max(0, (daysPassed / daysTotal) * 100));
  const showProgress = isCurrent && !isPending && !!startDate && !!effectiveEndDate && daysTotal > 0;
  const hasSupplements = !!(program.supplements && program.supplements.length > 0) || !!(program.supplementStack && program.supplementStack.length > 0);
  const hasMeals = !!(program.meals && program.meals.length > 0);

  // نمایش تاریخ: در حالت pending، endDate واقعی وجود ندارد → به‌جای تاریخ
  // نادرست، پیام «در انتظار شروع» نشان داده می‌شود.
  // اگر اشتراک توسط ادمین لغو شده (cancelledAt موجود است)، تاریخ لغو به‌عنوان
  // تاریخ پایان نمایش داده می‌شود و badge «لغو شده» نشان داده می‌شود.
  const dateLabel = isPending
    ? "در انتظار تکمیل پیش‌نیازها"
    : startDate && effectiveEndDate
    ? `${startDate.toLocaleDateString("fa-IR")} → ${effectiveEndDate.toLocaleDateString("fa-IR")}`
    : "—";
  const isCancelled = !!cancelledAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className={`p-0 overflow-hidden ${isCurrent ? "border-2 border-orange-300 shadow-xl" : "border-2 border-slate-200"}`}>
        {/* Header با گرادیان + لوگو */}
        <div
          className="p-4 text-white relative overflow-hidden"
          style={isCurrent
            ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" }
            : { background: "linear-gradient(135deg, #94a3b8, #64748b)" }
          }
        >
          <div className="absolute -left-4 -top-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/5 blur-lg" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-base font-black">
                {toPersianDigits(index + 1)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-base">برنامه {toPersianDigits(index + 1)}</h3>
                  {isCurrent && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/25 backdrop-blur font-bold">
                      ● جاری
                    </span>
                  )}
                  {isCancelled && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/90 text-white font-bold">
                      ⚠ لغو شده توسط ادمین
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {PLAN_LABELS[program.planName as keyof typeof PLAN_LABELS] || program.planName}
                </p>
              </div>
            </div>
            {/* Logo فیتاپ */}
            <div className="w-10 h-10 rounded-xl bg-white/95 overflow-hidden shrink-0 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* بدنه کارت */}
        <div className="p-4 space-y-3">
          {/* Date range */}
          <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${isCancelled ? "bg-red-50/60 border-red-100" : "bg-orange-50/60 border-orange-100"}`}>
            <Calendar className={`w-3.5 h-3.5 shrink-0 ${isCancelled ? "text-red-500" : "text-orange-500"}`} />
            <span className="text-[11px] text-slate-600 font-medium">
              {dateLabel}
            </span>
            {isCancelled && (
              <span className="text-[10px] text-red-600 font-bold mr-auto">
                (لغو توسط ادمین)
              </span>
            )}
          </div>

          {/* Progress bar for current program — فقط وقتی فعال و شروع‌شده باشد */}
          {showProgress ? (
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>پیشرفت دوره</span>
                <span className="font-bold text-orange-600">
                  {toPersianDigits(Math.round(progressPct))}٪
                  <span className="text-slate-400 font-normal mr-1">
                    ({toPersianDigits(daysPassed)}/{toPersianDigits(daysTotal)} روز)
                  </span>
                </span>
              </div>
              <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #f59e0b, #f97316)" }} />
              </div>
            </div>
          ) : isCurrent && isPending ? (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <p className="text-[11px] text-amber-700 font-medium">
                ⏳ دوره شما فعال شد — برای شروع، پیش‌نیازها را تکمیل کنید
              </p>
            </div>
          ) : null}

          {/* Stats grid — ۳ سلول */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 text-center border border-orange-100">
              <Dumbbell className="w-4 h-4 mx-auto mb-1 text-orange-500" />
              <p className="text-sm font-black text-slate-900">{toPersianDigits(program.exercises)}</p>
              <p className="text-[9px] text-slate-400">حرکت</p>
            </div>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 text-center border border-orange-100">
              <Calendar className="w-4 h-4 mx-auto mb-1 text-orange-500" />
              <p className="text-sm font-black text-slate-900">{toPersianDigits(program.days)}</p>
              <p className="text-[9px] text-slate-400">روز تمرین</p>
            </div>
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 text-center border border-orange-100">
              <Utensils className="w-4 h-4 mx-auto mb-1 text-orange-500" />
              <p className="text-sm font-black text-slate-900">{toPersianDigits(Math.round(program.totalCalories || 0))}</p>
              <p className="text-[9px] text-slate-400">کالری/روز</p>
            </div>
          </div>

          {/* Supplements preview */}
          {/* شمارش مکمل‌ها از هر دو منبع: اول supplementStack (استک دسته‌بندی‌شده)،
              بعد لیست تخت supplements — قبلاً فقط لیست تخت شمرده می‌شد و کاربرِ
              دارای فقط استک، «۰ مورد» می‌دید در حالی که hasSupplements true بود. */}
          {hasSupplements && (
            <div className="p-2.5 rounded-xl border border-purple-100 bg-purple-50/30">
              <div className="flex items-center gap-2">
                <Pill className="w-3.5 h-3.5 text-purple-500" />
                <p className="text-[11px] font-bold text-slate-700">برنامه مکمل‌ها</p>
                <span className="text-[9px] text-purple-500 mr-auto">{toPersianDigits(program.supplementStack?.length || program.supplements?.length || 0)} مورد</span>
              </div>
            </div>
          )}

          {/* Meal preview — macros mini */}
          {hasMeals && (
            <div className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/30">
              <div className="flex items-center gap-2 mb-1.5">
                <Salad className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-[11px] font-bold text-slate-700">برنامه غذایی</p>
                <span className="text-[9px] text-emerald-500 mr-auto">{toPersianDigits(program.meals!.length)} وعده</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <div className="text-center p-1 rounded bg-white/60">
                  <p className="text-[8px] text-slate-400">پروتئین</p>
                  <p className="text-[10px] font-bold text-slate-700">{toPersianDigits(Math.round(program.totalProtein || 0))}g</p>
                </div>
                <div className="text-center p-1 rounded bg-white/60">
                  <p className="text-[8px] text-slate-400">کربو</p>
                  <p className="text-[10px] font-bold text-slate-700">{toPersianDigits(Math.round(program.totalCarbs || 0))}g</p>
                </div>
                <div className="text-center p-1 rounded bg-white/60">
                  <p className="text-[8px] text-slate-400">چربی</p>
                  <p className="text-[10px] font-bold text-slate-700">{toPersianDigits(Math.round(program.totalFat || 0))}g</p>
                </div>
              </div>
            </div>
          )}

          {/* ۳ دکمه اقدام — ردیزایش شده به‌صورت کارت */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={() => onOpenView("workout", program)}
              className="group flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 border-orange-200 bg-orange-50/40 hover:bg-orange-100 hover:border-orange-300 transition"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                <Dumbbell className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] font-bold text-orange-700">تمرین</span>
            </button>
            <button
              onClick={() => onOpenView("meal", program)}
              className="group flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100 hover:border-emerald-300 transition"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                <Salad className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] font-bold text-emerald-700">تغذیه</span>
            </button>
            <button
              onClick={() => onOpenView("supplement", program)}
              disabled={!hasSupplements}
              title={hasSupplements ? "مشاهده برنامه مکمل‌ها" : "مکمل در پلن شما موجود نیست"}
              className="group flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 border-purple-200 bg-purple-50/40 hover:bg-purple-100 hover:border-purple-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}>
                <Pill className="w-4 h-4 text-white" />
              </div>
              <span className="text-[10px] font-bold text-purple-700">مکمل</span>
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ============================================================
   PlanViewModal — نمایش کامل برنامه + دانلود عکس/PDF
   - محتوای printable کاملاً مخفی (visibility:hidden) و فقط هنگام capture visible می‌شود
   - printable در سطح root (خارج از Dialog) تا position:fixed درست کار کند
   - برای تمرین: آکاردئون روزها + دکمه توضیحات/ویدیو برای هر حرکت
   ============================================================ */
function PlanViewModal({ type, program, onClose }: {
  type: "workout" | "meal" | "supplement";
  program: ProgramItem;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState<"image" | "pdf" | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  // آکاردئون روزهای تمرین — فقط یک روز باز در هر لحظه (پیش‌فرض: روز اول)
  const [openDay, setOpenDay] = useState<number>(0);
  // modal توضیحات حرکت (ویدیو همیشه داخل آن نمایش داده می‌شود)
  const [exerciseModal, setExerciseModal] = useState<{ exercise: any } | null>(null);

  if (!program) return null;

  const typeMeta = {
    workout: { label: "برنامه تمرینی", icon: Dumbbell, color: "#f59e0b", color2: "#f97316" },
    meal: { label: "برنامه غذایی", icon: Salad, color: "#10b981", color2: "#059669" },
    supplement: { label: "برنامه مکمل‌ها", icon: Pill, color: "#a855f7", color2: "#7c3aed" },
  }[type];
  const Icon = typeMeta.icon;

  async function downloadAsImage() {
    if (!printableRef.current) return;
    setDownloading("image");
    const node = printableRef.current;
    // ذخیره استایل اصلی + موقتاً visible کردن برای capture
    const orig = { visibility: node.style.visibility, opacity: node.style.opacity, zIndex: node.style.zIndex };
    node.style.visibility = "visible";
    node.style.opacity = "1";
    node.style.zIndex = "-9999";
    await new Promise(r => setTimeout(r, 80));
    try {
      const { toPng } = await import("html-to-image");
      // بدون width ثابت — از عرض واقعی محتوا استفاده می‌کند (رفع فضای سفید)
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `fitup-${type}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("تصویر دانلود شد ✓");
    } catch (e) {
      console.error("[downloadAsImage]", e);
      toast.error("خطا در ساخت تصویر");
    } finally {
      node.style.visibility = orig.visibility;
      node.style.opacity = orig.opacity;
      node.style.zIndex = orig.zIndex;
      setDownloading(null);
    }
  }

  async function downloadAsPDF() {
    if (!printableRef.current) return;
    setDownloading("pdf");
    const node = printableRef.current;
    const orig = { visibility: node.style.visibility, opacity: node.style.opacity, zIndex: node.style.zIndex };
    node.style.visibility = "visible";
    node.style.opacity = "1";
    node.style.zIndex = "-9999";
    await new Promise(r => setTimeout(r, 80));
    try {
      const { toPng } = await import("html-to-image");
      const { jsPDF } = await import("jspdf");
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      const img = new Image();
      img.src = dataUrl;
      await new Promise(res => { img.onload = res; });
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = img.height / img.width;
      const iw = pw - 40;
      const ih = iw * ratio;
      if (ih <= ph - 40) {
        pdf.addImage(dataUrl, "PNG", 20, 20, iw, ih);
      } else {
        // صفحه‌بندی خودکار بر اساس slice کردن تصویر
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const sliceH = Math.floor((img.width * (ph - 40)) / (pw - 40));
        let y = 0;
        let p = 0;
        while (y < img.height) {
          const sc = document.createElement("canvas");
          sc.width = img.width;
          sc.height = Math.min(sliceH, img.height - y);
          const sctx = sc.getContext("2d")!;
          sctx.drawImage(canvas, 0, y, img.width, sc.height, 0, 0, img.width, sc.height);
          if (p > 0) pdf.addPage();
          pdf.addImage(sc.toDataURL("image/png"), "PNG", 20, 20, iw, (sc.height / img.width) * iw);
          y += sliceH;
          p++;
        }
      }
      pdf.save(`fitup-${type}-${Date.now()}.pdf`);
      toast.success("PDF دانلود شد ✓");
    } catch (e) {
      console.error("[downloadAsPDF]", e);
      toast.error("خطا در ساخت PDF");
    } finally {
      node.style.visibility = orig.visibility;
      node.style.opacity = orig.opacity;
      node.style.zIndex = orig.zIndex;
      setDownloading(null);
    }
  }

  // پالت رنگ متمایز برای گروه‌های سوپرست/تری‌ست/جاینت‌ست
  const groupColors = [
    { bg: "#f3e8ff", border: "#d8b4fe", tint: "#faf5ff", text: "#7e22ce" }, // بنفش
    { bg: "#dbeafe", border: "#93c5fd", tint: "#eff6ff", text: "#1d4ed8" }, // آبی
    { bg: "#dcfce7", border: "#86efac", tint: "#f0fdf4", text: "#15803d" }, // سبز
    { bg: "#fef3c7", border: "#fcd34d", tint: "#fffbeb", text: "#b45309" }, // کهربایی
    { bg: "#ffe4e6", border: "#fb7185", tint: "#fff1f2", text: "#9f1239" }, // رز
    { bg: "#ccfbf1", border: "#5eead4", tint: "#f0fdfa", text: "#0f766e" }, // فیروزه‌ای
  ];

  return (
    <>
      {/* ─── Printable مخفی — خارج از Dialog تا position:fixed درست کار کند ─── */}
      {/* width: fit-content + max-width: 800px → رفع فضای سفید سمت چپ */}
      <div
        ref={printableRef}
        style={{
          position: "fixed",
          top: "0",
          left: "0",
          width: "fit-content",
          maxWidth: "800px",
          background: "#ffffff",
          padding: "0",
          zIndex: "-9999",
          pointerEvents: "none",
          visibility: "hidden",
          opacity: 0,
        }}
        aria-hidden
      >
        <PrintableProgram type={type} program={program} dateStr={formatToday()} endDateStr={formatEndDate(program)} />
      </div>

      <Dialog open onOpenChange={(open) => { if (!open && !exerciseModal) onClose(); }}>
        <DialogContent dir="rtl" className="max-w-[calc(100%-1rem)] sm:max-w-3xl max-h-[92vh] overflow-y-auto overflow-x-hidden custom-scrollbar p-4 sm:p-6 [&>*]:min-w-0">
          <DialogHeader>
            {/* pl-8: جای خالی برای ضربدرِ داخلی دیالوگ (اکنون بالا-چپ) تا روی دکمه‌های تصویر/PDF نیفتد */}
            <DialogTitle className="flex items-center justify-between gap-2 flex-wrap pl-8">
              <span className="flex items-center gap-2">
                <Icon className="w-5 h-5" style={{ color: typeMeta.color }} />
                {typeMeta.label}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={downloadAsImage} disabled={downloading !== null} className="rounded-xl gap-1.5">
                  {downloading === "image" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  تصویر
                </Button>
                <Button size="sm" variant="outline" onClick={downloadAsPDF} disabled={downloading !== null} className="rounded-xl gap-1.5">
                  {downloading === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  PDF
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* ═══ محتوای تعاملی — تمرین: آکاردئون روزها ═══ */}
          {type === "workout" && program.workoutDays && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 mb-2">
                💡 روی هر روز کلیک کنید تا حرکات آن باز شود. برای هر حرکت، توضیحات و ویدیو موجود است.
              </p>
              {sortWeekdaysByPersianOrder(program.workoutDays).map((day, di) => {
                const isOpen = openDay === di;
                const exCount = day.exercises?.length || 0;
                return (
                  <div key={di} className={`rounded-2xl border-2 overflow-hidden transition ${isOpen ? "border-orange-300 shadow-sm" : "border-slate-200"}`}>
                    {/* هدر روز — قابل کلیک (یکسان در موبایل و دسکتاپ) */}
                    <WorkoutDayHeader
                      day={day}
                      index={di}
                      exCount={exCount}
                      isOpen={isOpen}
                      onClick={() => setOpenDay(isOpen ? -1 : di)}
                    />
                    {/* بدنه روز — حرکات */}
                    {isOpen && (
                      <div className="p-3 space-y-2 bg-white">
                        {(() => {
                          const grouped = groupExercises(day.exercises || []);
                          let groupColorIdx = 0;
                          const items: ReactNode[] = [];

                          grouped.forEach((item, gi) => {
                            if (item.type === "single") {
                              const ex = item.exercise;
                              items.push(
                                <ExerciseRow
                                  key={`s-${gi}`}
                                  number={toPersianDigits(gi + 1)}
                                  exercise={ex}
                                  onShowInfo={(e) => setExerciseModal({ exercise: e })}
                                />
                              );
                            } else {
                              const label = groupTypeLabel(item.groupType);
                              const isGiant = item.groupType === "giant";
                              const colors = groupColors[groupColorIdx++ % groupColors.length];
                              const lastEx = item.exercises[item.exercises.length - 1];
                              const restBetweenGroups = lastEx?.sets?.slice(-1)[0]?.restSec ?? 0;
                              let bannerText = `🔗 ${label} ${item.group} (${toPersianDigits(item.exercises.length)} حرکت)`;
                              if (isGiant && item.circuitRounds) bannerText += ` • ${toPersianDigits(item.circuitRounds)} دور`;
                              if (restBetweenGroups > 0) bannerText += ` • استراحت: ${toPersianDigits(restBetweenGroups)} ثانیه`;

                              items.push(
                                <div key={`g-${gi}`} className="rounded-xl overflow-hidden border" style={{ borderColor: colors.border }}>
                                  <div className="px-3 py-2 font-bold text-xs flex items-center justify-between" style={{ background: colors.bg, color: colors.text }}>
                                    <span className="min-w-0 leading-snug">{bannerText}</span>
                                    <Repeat className="w-3.5 h-3.5 shrink-0" />
                                  </div>
                                  <div className="p-2 space-y-2" style={{ background: colors.tint }}>
                                    {item.exercises.map((ex, idx) => {
                                      const num = `${item.group}${toPersianDigits(idx + 1)}`;
                                      const isLast = idx === item.exercises.length - 1;
                                      const rest = isLast && restBetweenGroups > 0 ? restBetweenGroups : null;
                                      return (
                                        <ExerciseRow
                                          key={`g-${gi}-${idx}`}
                                          number={num}
                                          exercise={ex}
                                          accentColor={colors.text}
                                          forceRest={rest}
                                          onShowInfo={(e) => setExerciseModal({ exercise: e })}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }
                          });
                          return items;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ محتوای تعاملی — تغذیه ═══ */}
          {type === "meal" && program.meals && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">کالری</p>
                  <p className="font-black text-emerald-600">{toPersianDigits(Math.round(program.totalCalories || 0))}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">پروتئین</p>
                  <p className="font-bold text-red-600">{toPersianDigits(Math.round(program.totalProtein || 0))}g</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">کربو</p>
                  <p className="font-bold text-amber-600">{toPersianDigits(Math.round(program.totalCarbs || 0))}g</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500">چربی</p>
                  <p className="font-bold text-blue-600">{toPersianDigits(Math.round(program.totalFat || 0))}g</p>
                </div>
              </div>
              {program.meals.map((m, mi) => (
                <div key={mi} className="p-3 rounded-xl border border-emerald-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-900 text-sm">{m.label}</span>
                    <span className="text-xs text-emerald-600 font-bold">{toPersianDigits(Math.round(m.totalCalories))} کالری</span>
                  </div>
                  {m.combination && (
                    <p className="text-[11px] text-slate-600 mb-2 p-1.5 rounded bg-emerald-50/50">🍽 ترکیب: {m.combination}</p>
                  )}
                  <div className="space-y-1">
                    {m.items?.map((it, ii) => (
                      <div key={ii} className="flex items-center justify-between gap-2 text-[11px] py-1 border-b last:border-0 border-emerald-50">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-700 break-words">{stripUnitFromFoodName(it.name, it.servingSize)}</span>
                          {it.servingSize && <span className="text-slate-400 mr-2">({fixUnitOrder(it.servingSize)})</span>}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          <span className="text-slate-500">{toPersianDigits(Math.round(it.calories))} کالری</span>
                          <span className="text-[9px] px-1 rounded bg-red-50 text-red-600">P{toPersianDigits(Math.round(it.protein ?? 0))}</span>
                          <span className="text-[9px] px-1 rounded bg-amber-50 text-amber-600">C{toPersianDigits(Math.round(it.carbs ?? 0))}</span>
                          <span className="text-[9px] px-1 rounded bg-blue-50 text-blue-600">F{toPersianDigits(Math.round(it.fat ?? 0))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {m.alternatives && m.alternatives.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-emerald-50">
                      <p className="text-[10px] font-bold text-slate-500 mb-1">🔄 غذاهای جایگزین:</p>
                      {m.alternatives.map((alt, ai) => (
                        <div key={ai} className="text-[10px] text-slate-600 p-1.5 rounded bg-slate-50 mb-1">
                          <span className="font-medium">گزینه {toPersianDigits(ai + 1)}: {alt.combination}</span>
                          <span className="text-slate-400 mr-2">({toPersianDigits(Math.round(alt.totalCalories))} کالری)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {program.waterLiters && (
                <p className="text-[11px] text-cyan-600 text-center">💧 آب روزانه: {toPersianDigits(Math.round(program.waterLiters * 10) / 10)} لیتر</p>
              )}
            </div>
          )}

          {/* ═══ محتوای تعاملی — مکمل‌ها ═══ */}
          {type === "supplement" && (
            <div className="space-y-3">
              {/* برنامه مکمل پیشرفته (با دسته‌بندی) — فقط برای پلن‌های استاندارد به بالا */}
              {program.supplementStack && program.supplementStack.length > 0 && (
                <SupplementStackView stack={program.supplementStack} />
              )}

              {/* مکمل‌های ساده (لیست تخت) — fallback اگر supplementStack موجود نیست */}
              {(!program.supplementStack || program.supplementStack.length === 0) && program.supplements && program.supplements.length > 0 && (
                <div className="space-y-2">
                  {program.supplements.map((s, si) => (
                    <div key={si} className="p-3 rounded-xl border border-purple-100 bg-purple-50/30">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-sm min-w-0 break-words">{s.name}</span>
                        {/* دوز به‌صورت چیپ — عرض آزاد می‌گیرد و تمیز wrap می‌شود */}
                        <span className="min-w-0 flex-1 flex justify-end">
                          <span className="text-xs text-purple-600 font-bold leading-relaxed text-right bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-0.5 max-w-full break-words">{fixUnitOrder(s.dose)}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">⏰ {fixUnitOrder(s.timing)}</p>
                      {s.note && <p className="text-[10px] text-slate-400 mt-1">{s.note}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* اگر هیچ مکملی وجود ندارد */}
              {((!program.supplementStack || program.supplementStack.length === 0) && (!program.supplements || program.supplements.length === 0)) && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  برنامه مکمل برای این پلن موجود نیست.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal توضیحات حرکت (ویدیو همیشه نمایش داده می‌شود) */}
      {exerciseModal && (
        <ExerciseDetailModal
          exercise={exerciseModal.exercise}
          onClose={() => setExerciseModal(null)}
        />
      )}
    </>
  );
}

/* ============================================================
   SupplementStackView — نمایش برنامه مکمل با دسته‌بندی
   - base: مکمل‌های ضروری (ارزان و مؤثر — اول غذا، بعد مکمل)
   - advanced: اختیاری — فقط با نیاز واقعی (مثلاً پروتئین وی)
   - targeted: هدفمند (اختیاری — ارزان)
   - هشدارهای پزشکی (contraindicatedFor)
   ============================================================ */
const SUPPLEMENT_CATEGORY_LABELS: Record<string, string> = {
  base: "ضروری برای تو",
  advanced: "پوشش شکافِ خاص",
  targeted: "هدفمند و ارزان",
};

const SUPPLEMENT_CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  base: { bg: "bg-emerald-50/50", border: "border-emerald-100", text: "text-emerald-700", icon: "🌱" },
  advanced: { bg: "bg-amber-50/50", border: "border-amber-100", text: "text-amber-700", icon: "💰" },
  targeted: { bg: "bg-purple-50/50", border: "border-purple-100", text: "text-purple-700", icon: "🎯" },
};

function SupplementStackView({ stack }: { stack: { category: string; name: string; dose: string; timing: string; note?: string; contraindicatedFor?: string[] }[] }) {
  // دسته‌بندی مکمل‌ها بر اساس category
  const grouped: Record<string, typeof stack> = {};
  for (const s of stack) {
    const cat = s.category || "base";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  }

  // ترتیب نمایش: base → advanced → targeted
  const order = ["base", "advanced", "targeted"];
  const categories = order.filter((c) => grouped[c]?.length > 0);

  // اگر دسته‌بندی‌های دیگه هم هست، اضافه کن
  for (const cat of Object.keys(grouped)) {
    if (!order.includes(cat)) categories.push(cat);
  }

  return (
    <div className="space-y-4">
      {/* پیام فلسفه: اول غذا، بعد مکمل — داینامیک بر اساس تعدادِ تجویزِ همین کاربر */}
      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
        🍽️ <strong>اول غذا، بعد مکمل:</strong> این برنامه دقیقاً بر اساس نیازِ تو نوشته شده — {toPersianDigits(stack.length)} مکمل؛ لازم نیست همه را بخرید و هیچ‌کدام جای غذای واقعی را نمی‌گیرد. برای هر مکمل، دلیلِ تجویز و جایگزینِ غذاییِ ارزان را در نکته‌ها بخوانید.
      </div>

      {/* هشدار پزشکی کلی */}
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        ⚠️ <strong>توجه پزشکی:</strong> این مکمل‌ها توسط هوش مصنوعی پیشنهاد شده‌اند. قبل از شروع هر مکمل، حتماً با پزشک مشورت کنید، به‌ویژه اگر بیماری زمینه‌ای یا حساسیت دارید.
      </div>

      {/* دسته‌بندی مکمل‌ها */}
      {categories.map((cat) => {
        const items = grouped[cat];
        const colors = SUPPLEMENT_CATEGORY_COLORS[cat] || SUPPLEMENT_CATEGORY_COLORS.base;
        const label = SUPPLEMENT_CATEGORY_LABELS[cat] || cat;

        return (
          <div key={cat} className={`rounded-xl border ${colors.border} ${colors.bg} p-3`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{colors.icon}</span>
              <h4 className={`font-black text-sm ${colors.text}`}>{label}</h4>
              <span className="text-[10px] text-slate-400 mr-auto">{toPersianDigits(items.length)} مکمل</span>
            </div>
            <div className="space-y-2">
              {items.map((s, si) => (
                <div key={si} className="p-2.5 rounded-lg bg-white border border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm min-w-0 break-words">{s.name}</span>
                    {/* دوز به‌صورت چیپ گرد شده — عرض آزاد می‌گیرد و در چند خط تمیز می‌شکند (بدون سرریز/اسکرول افقی) */}
                    <span className="min-w-0 flex-1 flex justify-end">
                      <span className="text-xs text-slate-600 font-bold leading-relaxed text-right bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-0.5 max-w-full break-words">{fixUnitOrder(s.dose)}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">⏰ {fixUnitOrder(s.timing)}</p>
                  {s.note && <p className="text-[10px] text-slate-400 mt-1">💡 {s.note}</p>}
                  {/* هشدار منع مصرف */}
                  {s.contraindicatedFor && s.contraindicatedFor.length > 0 && (
                    <div className="mt-1.5 p-1.5 rounded bg-red-50 border border-red-100">
                      <p className="text-[10px] text-red-700 font-bold">⚠️ منع مصرف:</p>
                      <p className="text-[10px] text-red-600">{s.contraindicatedFor.join("، ")}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   WorkoutDayHeader — سربرگ مرتب و یکسان برای هر روز در آکاردئون
   - خط اول (bold): نام روز + عنوان روز (مثل «شنبه — روز سینه»)
   - خط دوم (کوچک‌تر، خاکستری): عضله هدف + مدت زمان (با آیکون ساعت) + تعداد حرکت
   - در موبایل و دسکتاپ یکسان
   ============================================================ */
function WorkoutDayHeader({
  day,
  index,
  exCount,
  isOpen,
  onClick,
}: {
  day: any;
  index: number;
  exCount: number;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 p-3 text-white text-right"
      style={{
        background: isOpen
          ? "linear-gradient(135deg, #f59e0b, #f97316)"
          : "linear-gradient(135deg, #fdba74, #fb923c)",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm shrink-0">
          {toPersianDigits(index + 1)}
        </div>
        <div className="min-w-0 flex-1">
          {/* خط اول: نام روز + عنوان روز (bold) */}
          <p className="font-black text-sm leading-tight truncate">
            {day.day}
            {day.title ? <span className="opacity-95"> — {day.title}</span> : null}
          </p>
          {/* خط دوم: عضله هدف + مدت زمان (با آیکون ساعت) + تعداد حرکت — کوچک‌تر و خاکستری‌تر */}
          <p className="text-[10px] opacity-90 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {day.focus && <span className="truncate">{day.focus}</span>}
            {day.estimatedMinutes != null && (
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                <Clock className="w-3 h-3 opacity-90" />
                {toPersianDigits(day.estimatedMinutes)} دقیقه
              </span>
            )}
            <span className="whitespace-nowrap">{toPersianDigits(exCount)} حرکت</span>
          </p>
        </div>
      </div>
      <ChevronDown
        className={`w-5 h-5 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
      />
    </button>
  );
}

/* ============================================================
   compactRepsDisplay — نمایش فشرده تکرارها در ردیف حرکت
   به‌جای چسباندن تکرارِ همه ست‌ها («۱۰-۱۲ / ۱۰-۱۲ / ۱۰-۱۲ / ۸-۱۰»)
   مقادیر یکتا با تعدادشان نمایش داده می‌شوند تا در موبایل
   رشته‌ی طولانی بدون شکستگی ایجاد نشود و اسکرول افقی رخ ندهد:
   ["10-12","10-12","10-12","8-10"] → «۱۰-۱۲ ×۳ + ۸-۱۰»
   ["10","10","10","10"]            → «۱۰ ×۴»
   ["10-12","10-12","10-12"]       → «۱۰-۱۲»
   ============================================================ */
function compactRepsDisplay(sets: any[]): string {
  const values = (sets || []).map((s: any) => String(s.reps ?? "").trim()).filter(Boolean);
  if (values.length === 0) return "—";
  // شمارش مقادیر یکتا به ترتیب اولین ظهور
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!counts.has(v)) order.push(v);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  // همه ست‌ها یکسان → فقط خود مقدار (تعداد ست در بج «ست» جداگانه هست)؛ عدد ساده → «۱۰ ×۴»
  if (order.length === 1) {
    const v = order[0];
    const c = counts.get(v) ?? 1;
    if (c > 1 && /^\d+$/.test(v)) return `${toPersianDigits(v)} ×${toPersianDigits(c)}`;
    return toPersianDigits(v);
  }
  // چند مقدار متفاوت → «۱۰-۱۲ ×۳ + ۸-۱۰»
  return order
    .map((v) => {
      const c = counts.get(v) ?? 1;
      return c > 1 ? `${toPersianDigits(v)} ×${toPersianDigits(c)}` : toPersianDigits(v);
    })
    .join(" + ");
}

/* ============================================================
   ExerciseRow — ردیف حرکت در آکاردئون (فقط نام/ست/تکرار/استراحت + دکمه توضیحات)
   ============================================================ */
function ExerciseRow({ number, exercise, accentColor, forceRest, onShowInfo }: {
  number: string;
  exercise: any;
  accentColor?: string;
  forceRest?: number | null;
  onShowInfo: (ex: any) => void;
}) {
  const setsCount = exercise.sets?.length || 0;
  const reps = compactRepsDisplay(exercise.sets);
  // forceRest: undefined → استراحت خود حرکت | null → "—" (داخل گروه، غیر آخر) | number → آن عدد
  const restDisplay = forceRest === undefined
    ? `${toPersianDigits(exercise.sets?.[0]?.restSec ?? 0)} ثانیه`
    : forceRest === null
    ? "—"
    : `${toPersianDigits(forceRest)} ثانیه`;

  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-slate-100">
      {/* شماره حرکت */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0"
        style={{ background: accentColor ? `${accentColor}15` : "#fff7ed", color: accentColor || "#ea580c" }}
      >
        {number}
      </div>
      {/* اطلاعات حرکت — فقط نام/ست/تکرار/استراحت */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm truncate">{exercise.name}</p>
        {exercise.muscle && (
          <p className="text-[10px] text-slate-400 mt-0.5">عضله: {exercise.muscle}</p>
        )}
        <div className="flex items-center gap-1.5 text-[10px] mt-1 flex-wrap">
          <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-bold">
            ست: {toPersianDigits(setsCount)}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
            تکرار: {reps}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
            استراحت: {restDisplay}
          </span>
        </div>
        {/* توصیه کوتاه مربی — فقط در صورت وجود */}
        {exercise.coachTip && (
          <div className="flex items-start gap-1 mt-1.5 px-1.5 py-1 rounded-lg bg-amber-50/70 border border-amber-100">
            <span className="text-[11px] leading-none shrink-0">💡</span>
            <p className="text-[10px] text-amber-800 leading-snug">{exercise.coachTip}</p>
          </div>
        )}
      </div>
      {/* دکمه توضیحات (ویدیو داخل مدال توضیحات نمایش داده می‌شود) */}
      <div className="flex flex-col gap-1 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[10px] rounded-lg gap-1"
          onClick={() => onShowInfo(exercise)}
        >
          <Info className="w-3 h-3" /> توضیحات
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
   ExerciseDetailModal — توضیحات حرکت + نکات تکنیکی + ویدیوی YouTube
   videoUrl از /api/exercises?search=... fetch می‌شود (با کش)
   export شده تا gym-mode-view هم بتواند برای نمایش جزئیات حرکت از آن
   استفاده کند (دریافت آیکون Info/Dumbbell روی هر حرکت در جیم‌مود).
   ============================================================ */
export function ExerciseDetailModal({ exercise, onClose }: {
  exercise: any;
  onClose: () => void;
}) {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const url = await fetchExerciseVideoUrl(exercise.name);
      if (active) {
        setVideoUrl(url);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [exercise.name]);

  // اضافه کردن autoplay به URL ویدیو (ویدیو همیشه نمایش داده می‌شود)
  const videoSrc = videoUrl
    ? (videoUrl.includes("?") ? videoUrl + "&autoplay=1" : videoUrl + "?autoplay=1")
    : "";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" showCloseButton={false} className="max-w-[calc(100%-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-orange-500" />
              {exercise.name}
            </span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100" aria-label="بستن">
              <X className="w-4 h-4" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* ویدیو — در حال بارگذاری */}
          {loading && (
            <div className="aspect-video rounded-xl bg-slate-100 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          )}
          {/* ویدیو — موجود */}
          {!loading && videoUrl && (
            <div>
              <div className="aspect-video rounded-xl overflow-hidden border border-slate-200">
                <iframe
                  src={videoSrc}
                  title={exercise.name}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 text-center">این ویدیو از یوتیوب پخش می‌شود</p>
            </div>
          )}
          {/* ویدیو — موجود نیست */}
          {!loading && !videoUrl && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <PlayCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-amber-700 font-medium">ویدیویی برای این حرکت موجود نیست</p>
              <p className="text-[10px] text-amber-500 mt-1">می‌توانید توضیحات زیر را مطالعه کنید.</p>
            </div>
          )}

          {/* بخش توضیحات — همیشه نمایش داده می‌شود */}
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> توضیحات حرکت
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {exercise.description || "توضیحاتی برای این حرکت ثبت نشده است."}
              </p>
            </div>
            {exercise.tips && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> نکات تکنیکی
                </p>
                <p className="text-xs text-amber-800 leading-relaxed">{exercise.tips}</p>
              </div>
            )}
            {exercise.coachTip && (
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
                <p className="text-xs font-bold text-orange-700 mb-1 flex items-center gap-1.5">
                  <span className="text-sm leading-none">💡</span> توصیه مربی
                </p>
                <p className="text-xs text-orange-800 leading-relaxed">{exercise.coachTip}</p>
              </div>
            )}
            {/* آمار سریع حرکت */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-orange-50 text-center">
                <p className="text-[9px] text-slate-500">ست</p>
                <p className="text-sm font-bold text-orange-700">{toPersianDigits(exercise.sets?.length || 0)}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 text-center">
                <p className="text-[9px] text-slate-500">تکرار</p>
                <p className="text-sm font-bold text-blue-700">
                  {compactRepsDisplay(exercise.sets)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-100 text-center">
                <p className="text-[9px] text-slate-500">استراحت</p>
                <p className="text-sm font-bold text-slate-700">
                  {toPersianDigits(exercise.sets?.[0]?.restSec ?? 0)}s
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   PrintableProgram — نسخه قابل دانلود (عکس/PDF) با برندینگ فیتاپ
   - هدر گرادیان نارنجی/طلایی + لوگوی بزرگ + شعار + تاریخ تولید
   - بدون daysPassed/progress bar (فقط اطلاعات برنامه)
   - سوپرست/تری‌ست/جاینت‌ست با رنگ متمایز و شماره A1/A2/B1/...
   - فوتر با fittup.ir و شعار فیتاپ
   ============================================================ */
function PrintableProgram({ type, program, dateStr, endDateStr }: {
  type: "workout" | "meal" | "supplement";
  program: ProgramItem;
  dateStr: string;
  endDateStr: string;
}) {
  const typeMeta = {
    workout: { label: "برنامه تمرینی", color: "#f59e0b", color2: "#f97316" },
    meal: { label: "برنامه غذایی", color: "#10b981", color2: "#059669" },
    supplement: { label: "برنامه مکمل‌ها", color: "#a855f7", color2: "#7c3aed" },
  }[type];

  const planLabel = PLAN_LABELS[program.planName as keyof typeof PLAN_LABELS] || program.planName || "";

  // پالت رنگ متمایز برای گروه‌ها (در printable هم اعمال می‌شود)
  const groupColors = [
    { bg: "#f3e8ff", border: "#d8b4fe", tint: "#faf5ff", text: "#7e22ce" },
    { bg: "#dbeafe", border: "#93c5fd", tint: "#eff6ff", text: "#1d4ed8" },
    { bg: "#dcfce7", border: "#86efac", tint: "#f0fdf4", text: "#15803d" },
    { bg: "#fef3c7", border: "#fcd34d", tint: "#fffbeb", text: "#b45309" },
    { bg: "#ffe4e6", border: "#fb7185", tint: "#fff1f2", text: "#9f1239" },
    { bg: "#ccfbf1", border: "#5eead4", tint: "#f0fdfa", text: "#0f766e" },
  ];

  return (
    <div style={{
      color: "#1e293b",
      width: "740px",
      fontFamily: "Vazirmatn, Tahoma, Arial, system-ui, sans-serif",
      direction: "rtl",
      padding: "28px",
      background: "#ffffff",
    }}>
      {/* ─── هدر برندینگ — گرادیان نارنجی/طلایی + لوگوی بزرگ + شعار + تاریخ ─── */}
      <div style={{
        background: `linear-gradient(135deg, ${typeMeta.color}, ${typeMeta.color2})`,
        padding: "22px 26px",
        borderRadius: "18px",
        marginBottom: "18px",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        gap: "18px",
      }}>
        {/* لوگوی بزرگ فیتاپ */}
        <div style={{
          width: "68px",
          height: "68px",
          borderRadius: "18px",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/fitup-logo.png"
            alt="فیتاپ"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            crossOrigin="anonymous"
          />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "32px", fontWeight: 900, margin: 0, color: "#ffffff", lineHeight: 1.1 }}>فیتاپ</h1>
          <p style={{ fontSize: "16px", color: "#ffffff", margin: "4px 0 0 0", opacity: 0.95, fontWeight: 700 }}>{typeMeta.label}</p>
          <p style={{ fontSize: "13px", color: "#ffffff", margin: "6px 0 0 0", opacity: 0.9, fontStyle: "italic" }}>هر بدنی فیتاپ میخواد! 💪</p>
        </div>
        {/* تاریخ ایجاد + تاریخ پایان (۴۵ روزه) — شمسی */}
        <div style={{ textAlign: "left", color: "#ffffff", flexShrink: 0 }}>
          <p style={{ fontSize: 10, margin: 0, opacity: 0.85 }}>تاریخ ایجاد</p>
          <p style={{ fontSize: 14, fontWeight: 700, margin: "2px 0 0 0" }}>{dateStr}</p>
          <p style={{ fontSize: 10, margin: "6px 0 0 0", opacity: 0.85 }}>تاریخ پایان</p>
          <p style={{ fontSize: 14, fontWeight: 700, margin: "2px 0 0 0" }}>{endDateStr}</p>
        </div>
      </div>

      {/* ─── نوار اطلاعات پلن ─── */}
      <div style={{
        display: "flex",
        gap: "16px",
        marginBottom: "22px",
        padding: "12px 18px",
        background: "#fff7ed",
        borderRadius: "12px",
        border: "1px solid #fed7aa",
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "9px", color: "#9a3412", margin: 0 }}>پلن</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", margin: "2px 0 0 0" }}>{planLabel}</p>
        </div>
        <div style={{ flex: 1, borderRight: "1px solid #fed7aa", paddingRight: "16px" }}>
          <p style={{ fontSize: "9px", color: "#9a3412", margin: 0 }}>روز تمرین</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", margin: "2px 0 0 0" }}>{toPersianDigits(program.days)}</p>
        </div>
        <div style={{ flex: 1, borderRight: "1px solid #fed7aa", paddingRight: "16px" }}>
          <p style={{ fontSize: "9px", color: "#9a3412", margin: 0 }}>تعداد حرکات</p>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", margin: "2px 0 0 0" }}>{toPersianDigits(program.exercises)}</p>
        </div>
        {program.totalCalories > 0 && (
          <div style={{ flex: 1, borderRight: "1px solid #fed7aa", paddingRight: "16px" }}>
            <p style={{ fontSize: "9px", color: "#9a3412", margin: 0 }}>کالری روزانه</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", margin: "2px 0 0 0" }}>{toPersianDigits(Math.round(program.totalCalories || 0))}</p>
          </div>
        )}
      </div>

      {/* ═══ محتوای تمرین — جدول روزانه با گروه‌بندی سوپرست/تری‌ست/جاینت‌ست ═══ */}
      {type === "workout" && program.workoutDays && (
        <div>
          {sortWeekdaysByPersianOrder(program.workoutDays).map((day, di) => (
            <div key={di} style={{ marginBottom: "20px" }}>
              {/* هدر روز */}
              <div style={{
                background: `linear-gradient(135deg, ${typeMeta.color}, ${typeMeta.color2})`,
                color: "#ffffff",
                padding: "10px 16px",
                borderRadius: "10px",
                marginBottom: "6px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  {/* خط اول: نام روز + عنوان روز (bold) */}
                  <p style={{ fontSize: "15px", fontWeight: 900, margin: 0 }}>
                    {day.day}
                    {day.title ? <span style={{ opacity: 0.95 }}> — {day.title}</span> : null}
                  </p>
                  {/* خط دوم: عضله هدف + مدت زمان + تعداد حرکت — کوچک‌تر و خاکستری‌تر */}
                  <p style={{ fontSize: "11px", margin: "2px 0 0 0", opacity: 0.9 }}>
                    {[
                      day.focus,
                      day.estimatedMinutes != null ? `⏱ ${toPersianDigits(day.estimatedMinutes)} دقیقه` : null,
                      `${toPersianDigits(day.exercises?.length || 0)} حرکت`,
                    ].filter(Boolean).join(" • ")}
                  </p>
                </div>
              </div>
              {/* جدول حرکات — فقط نام/ست/تکرار/استراحت (بدون توضیحات اضافه) */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#fff7ed" }}>
                    <th style={{ padding: "7px 8px", textAlign: "right", borderBottom: "1px solid #fed7aa", width: "34px", color: "#9a3412" }}>#</th>
                    <th style={{ padding: "7px 8px", textAlign: "right", borderBottom: "1px solid #fed7aa", color: "#9a3412" }}>حرکت</th>
                    <th style={{ padding: "7px 8px", textAlign: "center", borderBottom: "1px solid #fed7aa", color: "#9a3412", width: "40px" }}>ست</th>
                    <th style={{ padding: "7px 8px", textAlign: "center", borderBottom: "1px solid #fed7aa", color: "#9a3412", width: "100px" }}>تکرار</th>
                    <th style={{ padding: "7px 8px", textAlign: "center", borderBottom: "1px solid #fed7aa", color: "#9a3412", width: "60px" }}>استراحت</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const exercises = day.exercises || [];
                    const grouped = groupExercises(exercises);
                    let counter = 0;
                    let groupColorIdx = 0;
                    const rows: ReactNode[] = [];

                    grouped.forEach((item, gi) => {
                      if (item.type === "single") {
                        // ─── تک‌حرکت ───
                        const num = ++counter;
                        const ex = item.exercise;
                        rows.push(
                          <tr key={`s-${gi}`} style={{ borderBottom: "1px solid #fef3c7" }}>
                            <td style={{ padding: "8px", textAlign: "right", color: "#9a3412", fontWeight: 700, verticalAlign: "top" }}>{toPersianDigits(num)}</td>
                            <td style={{ padding: "8px", textAlign: "right", verticalAlign: "top" }}>
                              <p style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: "13px" }}>{ex.name}</p>
                              {ex.muscle && <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#94a3b8" }}>{ex.muscle}</p>}
                              {ex.coachTip && <p style={{ margin: "3px 0 0 0", fontSize: "9px", color: "#92400e", fontStyle: "italic" }}>💡 {ex.coachTip}</p>}
                            </td>
                            <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: "#1e293b", verticalAlign: "top" }}>{toPersianDigits(ex.sets?.length || 0)}</td>
                            <td style={{ padding: "8px", textAlign: "center", color: "#1e293b", verticalAlign: "top" }}>
                              {ex.sets?.map((s: any, k: number) => (
                                <span key={k}>{toPersianDigits(s.reps)}{k < (ex.sets?.length || 0) - 1 ? " / " : ""}</span>
                              ))}
                            </td>
                            <td style={{ padding: "8px", textAlign: "center", color: "#1e293b", verticalAlign: "top" }}>
                              {toPersianDigits(ex.sets?.[0]?.restSec ?? 0)} ثانیه
                            </td>
                          </tr>
                        );
                      } else {
                        // ─── گروه: سوپرست/تری‌ست/جاینت‌ست — با رنگ متمایز ───
                        const label = groupTypeLabel(item.groupType);
                        const isGiant = item.groupType === "giant";
                        const colors = groupColors[groupColorIdx++ % groupColors.length];
                        const lastEx = item.exercises[item.exercises.length - 1];
                        const restBetweenGroups = lastEx?.sets?.slice(-1)[0]?.restSec ?? 0;
                        const exCount = item.exercises.length;

                        // هدر گروه: «🔗 سوپرست A (۲ حرکت)» + اطلاعات استراحت
                        let bannerText = `🔗 ${label} ${item.group} (${toPersianDigits(exCount)} حرکت)`;
                        if (isGiant && item.circuitRounds) bannerText += ` • ${toPersianDigits(item.circuitRounds)} دور`;
                        if (isGiant && item.restBetweenRounds) bannerText += ` • استراحت بین دورها: ${toPersianDigits(item.restBetweenRounds)} ثانیه`;
                        if (restBetweenGroups > 0) bannerText += ` • استراحت بعد از گروه: ${toPersianDigits(restBetweenGroups)} ثانیه`;

                        rows.push(
                          <tr key={`b-${gi}`}>
                            <td colSpan={5} style={{
                              background: colors.bg,
                              color: colors.text,
                              padding: "8px 12px",
                              fontWeight: 800,
                              fontSize: "11px",
                              borderBottom: `2px solid ${colors.border}`,
                              borderTop: `2px solid ${colors.border}`,
                              textAlign: "right",
                            }}>
                              {bannerText}
                            </td>
                          </tr>
                        );

                        // ردیف‌های حرکات داخل گروه — شماره A1, A2, B1, ... با پس‌زمینه رنگی
                        item.exercises.forEach((ex, idx) => {
                          const num = ++counter;
                          const isLastInGroup = idx === item.exercises.length - 1;
                          rows.push(
                            <tr key={`g-${gi}-${idx}`} style={{ background: colors.tint, borderBottom: `1px solid ${colors.border}` }}>
                              <td style={{ padding: "8px", textAlign: "right", color: colors.text, fontWeight: 800, fontSize: "12px", verticalAlign: "top" }}>
                                {item.group}{toPersianDigits(idx + 1)}
                              </td>
                              <td style={{ padding: "8px", textAlign: "right", verticalAlign: "top" }}>
                                <p style={{ margin: 0, fontWeight: 700, color: "#1e293b", fontSize: "13px" }}>{ex.name}</p>
                                {ex.muscle && <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#94a3b8" }}>{ex.muscle}</p>}
                              </td>
                              <td style={{ padding: "8px", textAlign: "center", fontWeight: 700, color: "#1e293b", verticalAlign: "top" }}>{toPersianDigits(ex.sets?.length || 0)}</td>
                              <td style={{ padding: "8px", textAlign: "center", color: "#1e293b", verticalAlign: "top" }}>
                                {ex.sets?.map((s: any, k: number) => (
                                  <span key={k}>{toPersianDigits(s.reps)}{k < (ex.sets?.length || 0) - 1 ? " / " : ""}</span>
                                ))}
                              </td>
                              <td style={{ padding: "8px", textAlign: "center", verticalAlign: "top" }}>
                                {isLastInGroup && restBetweenGroups > 0 ? (
                                  <span style={{ color: colors.text, fontWeight: 700, fontSize: "11px" }}>{toPersianDigits(restBetweenGroups)} ثانیه</span>
                                ) : (
                                  <span style={{ color: colors.text, fontSize: "10px" }}>—</span>
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
        </div>
      )}

      {/* ═══ محتوای تغذیه ═══ */}
      {type === "meal" && program.meals && (
        <div>
          {/* خلاصه macros */}
          <div style={{
            display: "flex",
            gap: "12px",
            marginBottom: "16px",
            padding: "14px",
            background: "#ecfdf5",
            borderRadius: "12px",
            border: "1px solid #a7f3d0",
          }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <p style={{ fontSize: "10px", color: "#047857", margin: 0 }}>کالری</p>
              <p style={{ fontSize: "18px", fontWeight: 900, color: "#059669", margin: "2px 0 0 0" }}>{toPersianDigits(Math.round(program.totalCalories || 0))}</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid #a7f3d0", paddingRight: "12px" }}>
              <p style={{ fontSize: "10px", color: "#047857", margin: 0 }}>پروتئین</p>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#dc2626", margin: "2px 0 0 0" }}>{toPersianDigits(Math.round(program.totalProtein || 0))}g</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid #a7f3d0", paddingRight: "12px" }}>
              <p style={{ fontSize: "10px", color: "#047857", margin: 0 }}>کربو</p>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#d97706", margin: "2px 0 0 0" }}>{toPersianDigits(Math.round(program.totalCarbs || 0))}g</p>
            </div>
            <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid #a7f3d0", paddingRight: "12px" }}>
              <p style={{ fontSize: "10px", color: "#047857", margin: 0 }}>چربی</p>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#2563eb", margin: "2px 0 0 0" }}>{toPersianDigits(Math.round(program.totalFat || 0))}g</p>
            </div>
          </div>

          {program.meals.map((m, mi) => (
            <div key={mi} style={{ marginBottom: "12px", padding: "12px", borderRadius: "10px", border: "1px solid #a7f3d0", background: "#ffffff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "14px" }}>{m.label}</span>
                <span style={{ fontSize: "12px", color: "#059669", fontWeight: 700 }}>{toPersianDigits(Math.round(m.totalCalories))} کالری</span>
              </div>
              {m.combination && (
                <p style={{ fontSize: "11px", color: "#475569", margin: "0 0 8px 0", padding: "6px 8px", background: "#ecfdf5", borderRadius: "6px" }}>🍽 ترکیب: {m.combination}</p>
              )}
              <div>
                {m.items?.map((it, ii) => (
                  <div key={ii} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "5px 0", borderBottom: "1px solid #d1fae5" }}>
                    <div>
                      <span style={{ fontWeight: 500, color: "#334155" }}>{stripUnitFromFoodName(it.name, it.servingSize)}</span>
                      {it.servingSize && <span style={{ color: "#94a3b8", marginRight: "8px" }}>({fixUnitOrder(it.servingSize)})</span>}
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ color: "#64748b" }}>{toPersianDigits(Math.round(it.calories))} کالری</span>
                      <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", background: "#fee2e2", color: "#dc2626" }}>P{toPersianDigits(Math.round(it.protein ?? 0))}</span>
                      <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", background: "#fef3c7", color: "#d97706" }}>C{toPersianDigits(Math.round(it.carbs ?? 0))}</span>
                      <span style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", background: "#dbeafe", color: "#2563eb" }}>F{toPersianDigits(Math.round(it.fat ?? 0))}</span>
                    </div>
                  </div>
                ))}
              </div>
              {m.alternatives && m.alternatives.length > 0 && (
                <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #d1fae5" }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", margin: "0 0 4px 0" }}>🔄 غذاهای جایگزین:</p>
                  {m.alternatives.map((alt, ai) => (
                    <div key={ai} style={{ fontSize: "10px", color: "#475569", padding: "4px 6px", background: "#f8fafc", borderRadius: "4px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 500 }}>گزینه {toPersianDigits(ai + 1)}: {alt.combination}</span>
                      <span style={{ color: "#94a3b8", marginRight: "8px" }}>({toPersianDigits(Math.round(alt.totalCalories))} کالری)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {program.waterLiters && (
            <p style={{ fontSize: "11px", color: "#0891b2", textAlign: "center", marginTop: "8px" }}>💧 آب روزانه: {toPersianDigits(Math.round((program.waterLiters || 0) * 10) / 10)} لیتر</p>
          )}
        </div>
      )}

      {/* ═══ محتوای مکمل‌ها ═══ */}
      {type === "supplement" && (
        <div>
          {/* برنامه مکمل پیشرفته با دسته‌بندی (در صورت وجود) */}
          {program.supplementStack && program.supplementStack.length > 0 ? (
            <div style={{ marginBottom: "8px" }}>
              {/* پیام فلسفه: اول غذا، بعد مکمل */}
              <div style={{ marginBottom: "8px", padding: "10px", borderRadius: "8px", background: "#ecfdf5", border: "1px solid #a7f3d0", fontSize: "11px", color: "#065f46" }}>
                🍽️ <strong>اول غذا، بعد مکمل:</strong> این لیست حداقلیِ مؤثر است — لازم نیست همه را بخرید؛ برای هر مکمل گران، جایگزین غذایی داخل نکته‌ها آمده است.
              </div>
              {/* هشدار پزشکی */}
              <div style={{ marginBottom: "8px", padding: "10px", borderRadius: "8px", background: "#fffbeb", border: "1px solid #fde68a", fontSize: "11px", color: "#92400e" }}>
                ⚠️ <strong>توجه پزشکی:</strong> قبل از شروع هر مکمل، با پزشک مشورت کنید.
              </div>
              {/* دسته‌بندی */}
              {["base", "advanced", "targeted"].map((cat) => {
                const items = (program.supplementStack || []).filter((s) => (s.category || "base") === cat);
                if (items.length === 0) return null;
                const labels: Record<string, string> = { base: "ضروری‌ها (ارزان و مؤثر)", advanced: "اختیاری — فقط با نیاز", targeted: "هدفمند (اختیاری)" };
                const colors: Record<string, string> = { base: "#ecfdf5", advanced: "#fffbeb", targeted: "#faf5ff" };
                const borders: Record<string, string> = { base: "#a7f3d0", advanced: "#fde68a", targeted: "#ddd6fe" };
                return (
                  <div key={cat} style={{ marginBottom: "10px", padding: "10px", borderRadius: "10px", border: `1px solid ${borders[cat]}`, background: colors[cat] }}>
                    <div style={{ fontWeight: 800, fontSize: "13px", color: "#1e293b", marginBottom: "6px" }}>
                      {cat === "base" ? "🌱" : cat === "advanced" ? "💰" : "🎯"} {labels[cat]}
                    </div>
                    {items.map((s, si) => (
                      <div key={si} style={{ marginBottom: "6px", padding: "8px", borderRadius: "6px", background: "#fff", border: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "13px", minWidth: 0, overflowWrap: "break-word" }}>{s.name}</span>
                          {/* دوز به‌صورت چیپ — در نسخه چاپی هم wrap می‌شود تا از کادر بیرون نزند */}
                          <span style={{ minWidth: 0, flex: "1 1 0%", display: "flex", justifyContent: "flex-end" }}>
                            <span style={{ fontSize: "11px", color: "#475569", fontWeight: 700, textAlign: "right", lineHeight: 1.6, background: "#f1f5f9", borderRadius: "6px", padding: "1px 8px", maxWidth: "100%", overflowWrap: "break-word", wordBreak: "break-word" }}>{fixUnitOrder(s.dose)}</span>
                          </span>
                        </div>
                        <p style={{ fontSize: "10px", color: "#64748b", margin: "2px 0 0 0" }}>⏰ {fixUnitOrder(s.timing)}</p>
                        {s.note && <p style={{ fontSize: "9px", color: "#94a3b8", margin: "2px 0 0 0" }}>💡 {s.note}</p>}
                        {s.contraindicatedFor && s.contraindicatedFor.length > 0 && (
                          <p style={{ fontSize: "9px", color: "#dc2626", margin: "2px 0 0 0", fontWeight: 700 }}>⚠️ منع مصرف: {s.contraindicatedFor.join("، ")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : program.supplements && program.supplements.length > 0 ? (
            /* fallback: مکمل‌های ساده */
            program.supplements.map((s, si) => (
              <div key={si} style={{ marginBottom: "8px", padding: "12px", borderRadius: "10px", border: "1px solid #e9d5ff", background: "#faf5ff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "14px", minWidth: 0, overflowWrap: "break-word" }}>{s.name}</span>
                  <span style={{ minWidth: 0, flex: "1 1 0%", display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 700, textAlign: "right", lineHeight: 1.6, background: "#f5f3ff", borderRadius: "6px", padding: "1px 8px", maxWidth: "100%", overflowWrap: "break-word", wordBreak: "break-word" }}>{fixUnitOrder(s.dose)}</span>
                  </span>
                </div>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 0 0" }}>⏰ {fixUnitOrder(s.timing)}</p>
                {s.note && <p style={{ fontSize: "10px", color: "#94a3b8", margin: "4px 0 0 0" }}>{s.note}</p>}
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "12px" }}>
              برنامه مکمل برای این پلن موجود نیست.
            </div>
          )}
        </div>
      )}

      {/* ─── فوتر — برندینگ فیتاپ + سایت + شعار ─── */}
      <div style={{
        marginTop: "26px",
        paddingTop: "16px",
        borderTop: "2px solid #fed7aa",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #f59e0b, #f97316)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" style={{ width: "100%", height: "100%", objectFit: "cover" }} crossOrigin="anonymous" />
          </div>
          <div>
            <p style={{ fontSize: "16px", fontWeight: 900, color: "#f59e0b", margin: 0, lineHeight: 1 }}>فیتاپ</p>
            <p style={{ fontSize: "10px", color: "#94a3b8", margin: "2px 0 0 0" }}>هر بدنی فیتاپ میخواد! 💪</p>
          </div>
        </div>
        <div style={{ textAlign: "left" }}>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0, fontWeight: 700 }}>www.fittup.ir</p>
          <p style={{ fontSize: "10px", color: "#94a3b8", margin: "2px 0 0 0" }}>ساخته‌شده با فیتاپ هوشمند</p>
        </div>
      </div>
    </div>
  );
}
