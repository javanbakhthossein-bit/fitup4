"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  Video,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Camera,
  Clock,
  FileVideo,
  Maximize,
  Lightbulb,
  Shirt,
  Eye,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { toPersianDigits, getCapabilities } from "@/lib/fitness/types";
import { toast } from "sonner";

const GUIDE_ITEMS: { icon: LucideIcon; title: string; desc: string; color: string }[] = [
  { icon: Shirt, title: "لباس مناسب", desc: "لباس تنگ یا ورزشی که فرم بدن مشخص باشد", color: "#f59e0b" },
  { icon: Camera, title: "زاویه دوربین", desc: "از روبرو، پهلو و پشت — سه زاویه", color: "#f97316" },
  { icon: Clock, title: "مدت زمان", desc: "۳۰ ثانیه تا ۱ دقیقه برای هر زاویه", color: "#10b981" },
  { icon: FileVideo, title: "فرمت فایل", desc: "MP4، MOV یا WebM", color: "#06b6d4" },
  { icon: Maximize, title: "حداکثر حجم", desc: "حداکثر ۳۰ مگابایت", color: "#8b5cf6" },
  { icon: Lightbulb, title: "نور محیط", desc: "نور کافی و یکنواخت", color: "#eab308" },
  { icon: Eye, title: "نکته ضبط", desc: "بدون کفش، روی سطح صاف بایستید", color: "#ec4899" },
];

export function VideoAnalysisView() {
  const { setOverlay, user, setUser } = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [skipping, setSkipping] = useState(false);
  // آیا کاربر تعیین تکلیف کرده؟ — بر اساس وضعیت واقعی user از store
  const decided = user?.videoStatus === "uploaded" || user?.videoStatus === "skipped";

  // === سقف استفاده واقعی از پلن کاربر ===
  const limit = getCapabilities(user?.planName ?? null).videoAnalysisLimit;
  const usedCount = user?.videoAnalysisUsed ?? 0;
  const limitReached = limit > 0 && usedCount >= limit;

  // === بارگذاری آخرین نتیجه ذخیره‌شده در DB (تا رفرش صفحه اطلاعات را از دست ندهد) ===
  // همچنین بررسی وضعیت تعیین تکلیف ویدیو
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/coach/analyze-video", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.result) {
          setResult(data.result);
        }
      } catch {
        // سکوت
      }
    })();
  }, []);

  // تابع رد کردن ویدیو (تعیین تکلیف: آپلود نمی‌کنم)
  async function skipVideo() {
    setSkipping(true);
    try {
      const r = await fetch("/api/video-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "skipped" }),
      });
      if (!r.ok) throw new Error("خطا");
      toast.success("باشه! برنامه بدون تحلیل ویدیو طراحی می‌شود.");
      // آپدیت user در store
      if (user) setUser({ ...user, videoStatus: "skipped" });
      // اعلام به PrerequisitesBanner برای refresh بدون رفرش صفحه
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("prereq-updated"));
      }
      // بستن overlay بعد از ۱.۵ ثانیه
      setTimeout(() => setOverlay(null), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSkipping(false);
    }
  }

  // حداکثر حجم ویدیو: ۳۰ مگابایت (با سرور هم‌خوانی دارد)
  const MAX_VIDEO_MB = 30;
  const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("فقط فایل ویدیویی مجاز است");
      return;
    }
    // محدودیت حجم — ۳۰ مگابایت (MAX_VIDEO_BYTES سرور هم ۳۰MB است)
    // ویدیوی بزرگ‌تر هم خطای آپلود می‌دهد هم پهنای باند زیادی مصرف می‌کند.
    if (f.size > MAX_VIDEO_BYTES) {
      const mb = Math.round(f.size / (1024 * 1024));
      toast.error(`حجم ویدیو ${toPersianDigits(mb)} مگابایت است. حداکثر مجاز ${toPersianDigits(MAX_VIDEO_MB)} مگابایت است.`);
      return;
    }
    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setResult(null);
  }

  async function analyze() {
    if (!file) return;
    if (limitReached) {
      toast.error("سقف استفاده از این قابلیت پر شده است.");
      return;
    }
    // اعتبارسنجی حجم دوباره (در برابر تغییر فایل)
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(`حجم ویدیو بیش از حد مجاز (${toPersianDigits(MAX_VIDEO_MB)}MB) است.`);
      return;
    }
    setAnalyzing(true);
    try {
      // ─── ارسال به‌صورت multipart/form-data (نه base64) ───
      // base64 حجم payload را ~۱.۳۳ برابر می‌کند و باعث خطای «Unexpected token»
      // در پاسخ‌های بزرگ می‌شود. FormData از حالت باینری استفاده می‌کند.
      const formData = new FormData();
      formData.append("video", file);
      formData.append("userContext", "تحلیل فرم بدن و تکنیک حرکات ورزشی");

      const res = await fetch("/api/coach/analyze-video", {
        method: "POST",
        body: formData,
        // هدر Content-Type خودکار توسط browser برای FormData با boundary تنظیم می‌شود.
        // نباید دستی set شود.
      });
      // ─── بررسی وضعیت قبل از JSON parse ───
      // اگر سرور HTML برگرداند (مثلاً خطای 500)، res.json() خطای
      // "Unexpected token" می‌دهد. ابتدا res.ok را بررسی می‌کنیم.
      if (!res.ok) {
        let errMsg = "خطا در تحلیل ویدیو";
        try {
          const errData = await res.json();
          errMsg = errData?.error || errMsg;
        } catch {
          // اگر JSON parse ناموفق بود (مثلاً HTML خطا یا پاسخ خالی)
          errMsg = `خطای سرور (${res.status}). لطفاً دوباره تلاش کنید.`;
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      setResult(data);
      // آپدیت فوری شمارنده استفاده + وضعیت ویدیو در store — بدون نیاز به رفرش
      // (باگ 2-b: قبلاً فقط شمارنده آپدیت می‌شد؛ videoStatus عقب می‌ماند و کارت
      // سبز «تعیین تکلیف شده» تا رفرش صفحه نمایش داده نمی‌شد)
      useAppStore.setState((s) => ({
        user: s.user
          ? {
              ...s.user,
              videoAnalysisUsed: (s.user.videoAnalysisUsed ?? 0) + 1,
              videoStatus: "uploaded",
            }
          : s.user,
      }));
      // اعلام به PrerequisitesBanner برای refresh بدون رفرش صفحه (الگوی skipVideo)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("prereq-updated"));
      }
      toast.success("آنالیز ویدیویی کامل شد! 🎯");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در تحلیل");
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setFile(null);
    setVideoUrl("");
    setResult(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b glass-strong">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">آنالیز ویدیویی بدن</h2>
            <p className="text-[10px] text-muted-foreground">
              {limitReached
                ? "سقف استفاده پر شده"
                : `پلن حرفه‌ای — ${toPersianDigits(usedCount)}/${toPersianDigits(limit)} استفاده`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOverlay(null)} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 max-w-2xl mx-auto w-full">
        <div className="glass-yellow rounded-2xl p-4 text-sm text-center">
          <Sparkles className="w-5 h-5 text-primary mx-auto mb-1" />
          ویدیوی تمرینت رو آپلود کن تا هوش مصنوعی فرم بدن، تقارن و تکنیکت رو آنالیز کنه
        </div>

        {/* Recording guide */}
        <div className="bg-white rounded-2xl border-2 border-orange-200 overflow-hidden">
          <div
            className="flex items-center gap-2 px-4 py-3 text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Camera className="w-4 h-4" />
            <h3 className="font-bold text-sm">راهنمای ضبط ویدیو</h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {GUIDE_ITEMS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-orange-50/40"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${item.color}1a` }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900">{item.title}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="px-4 pb-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                ویدیوی باکیفیت‌تر، آنالیز دقیق‌تری به شما می‌دهد. هر سه زاویه را در یک فایل یا فایل‌های جداگانه آپلود کنید.
              </p>
            </div>
          </div>
        </div>

        {!file && (
          decided ? (
            <div className="glass rounded-3xl border-2 border-emerald-300 bg-emerald-50/50 p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-emerald-700 mb-1">
                {user?.videoStatus === "uploaded" ? "ویدیو آپلود شده ✓" : "ویدیو رد شد ✓"}
              </p>
              <p className="text-xs text-emerald-600">
                شما این پیش‌نیاز را تعیین تکلیف کرده‌اید.
              </p>
            </div>
          ) : limitReached ? (
            <div className="glass rounded-3xl border-2 border-amber-300 bg-amber-50/50 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="font-bold text-amber-700 mb-1">سقف استفاده از این قابلیت پر شده است</p>
              <p className="text-xs text-amber-600">
                شما از {toPersianDigits(usedCount)} از {toPersianDigits(limit)} تحلیل مجاز پلن حرفه‌ای خود استفاده کرده‌اید.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <div className="glass rounded-3xl border-2 border-dashed border-border hover:border-primary/50 transition p-10 text-center cursor-pointer">
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-primary" />
                  </motion.div>
                  <p className="font-bold mb-1">ویدیو را اینجا بکش یا کلیک کن</p>
                  <p className="text-xs text-muted-foreground">فرمت: MP4, MOV, WebM — حداکثر {toPersianDigits(MAX_VIDEO_MB)} مگابایت</p>
                </div>
                <input type="file" accept="video/*" className="hidden" onChange={handleFile} />
              </label>
              {/* دکمه «آپلود نمی‌کنم» — تعیین تکلیف اختیاری */}
              <Button
                variant="outline"
                className="w-full rounded-xl h-12 font-bold text-slate-600 border-2 border-slate-200 hover:bg-slate-50"
                disabled={skipping}
                onClick={skipVideo}
              >
                {skipping ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> در حال ثبت...</span>
                ) : (
                  "آپلود نمی‌کنم"
                )}
              </Button>
            </div>
          )
        )}

        {file && !result && (
          <div className="space-y-3">
            <div className="glass rounded-2xl overflow-hidden">
              <video src={videoUrl} controls className="w-full max-h-64" />
              <div className="p-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground truncate">{file.name}</p>
                <button onClick={reset} className="text-xs text-destructive flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> تغییر
                </button>
              </div>
            </div>
            <Button onClick={analyze} disabled={analyzing} className="w-full rounded-xl h-12 font-bold">
              {analyzing ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> در حال آنالیز هوشمند...</span>
              ) : (
                <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> شروع آنالیز ویدیو</span>
              )}
            </Button>
          </div>
        )}

        {analyzing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="space-y-2">
              {["بررسی فرم بدن...", "آنالیز تقارن...", "بررسی تکنیک حرکت...", "تولید توصیه‌ها..."].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.7 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  {s}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Score */}
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">امتیاز فرم بدن</p>
              <div className="relative w-24 h-24 mx-auto mb-2">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                  <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#F4C542" strokeWidth="3"
                    strokeDasharray={`${(result.score / 100) * 94.2} 94.2`} strokeLinecap="round"
                    initial={{ strokeDasharray: "0 94.2" }} animate={{ strokeDasharray: `${(result.score / 100) * 94.2} 94.2` }}
                    style={{ filter: "drop-shadow(0 0 4px #F4C54280)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-black gradient-text">{toPersianDigits(result.score)}</div>
              </div>
              <p className="text-sm font-bold">وضعیت فرم: {result.posture}</p>
              <p className="text-xs text-muted-foreground">تقارن بدن: {toPersianDigits(result.symmetry)}٪</p>
            </div>

            {/* Issues */}
            <div className="glass rounded-2xl p-4">
              <h4 className="font-bold text-sm flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-amber-500" /> نقاط قابل بهبود</h4>
              <ul className="space-y-1.5">
                {result.issues.map((issue: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" /> {issue}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="glass rounded-2xl p-4">
              <h4 className="font-bold text-sm flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-primary" /> توصیه‌های تخصصی</h4>
              <ul className="space-y-1.5">
                {result.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> {rec}
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={reset} variant="outline" className="w-full rounded-xl">
              <RefreshCw className="w-4 h-4" /> آنالیز ویدیوی جدید
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
