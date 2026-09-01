"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  TestTube,
  Upload,
  Loader2,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Download,
  Printer,
  Pill,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { toPersianDigits, getCapabilities } from "@/lib/fitness/types";
import {
  BLOOD_TEST_CATEGORIES,
  TOTAL_BLOOD_TESTS,
  type BloodTestCategory,
} from "@/lib/fitness/blood-tests";
import { toast } from "sonner";

/**
 * تبدیل ArrayBuffer به base64 بدون سرریز پشته.
 *
 * رفع باگ: قبلاً `String.fromCharCode(...new Uint8Array(buffer))` استفاده می‌شد
 * که برای عکس‌های موبایل (چند مگابایت = میلیون‌ها آرگومان) با خطای
 * `RangeError: Maximum call stack size exceeded` کرش می‌کرد.
 * راه‌حل استاندارد: تبدیل تکه‌تکه (۳۲KB در هر گام).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000; // ۳۲ کیلوبایت — امن برای پشته فراخوانی
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

const STATUS_COLORS: Record<string, string> = {
  normal: "text-emerald-500 bg-emerald-500/10",
  low: "text-amber-500 bg-amber-500/10",
  high: "text-red-500 bg-red-500/10",
  borderline: "text-orange-500 bg-orange-500/10",
  unknown: "text-slate-500 bg-slate-500/10",
};

const STATUS_LABELS: Record<string, string> = {
  normal: "نرمال",
  low: "پایین",
  high: "بالا",
  borderline: "مرزی",
  unknown: "نامشخص",
};

export function BloodTestView() {
  const { setOverlay, user, setUser } = useAppStore();
  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  /** When true, the hidden printable prescription becomes visible (offscreen) for html-to-image capture. */
  const [isCapturing, setIsCapturing] = useState(false);
  const prescriptionRef = useRef<HTMLDivElement>(null);

  // آیا کاربر تعیین تکلیف کرده؟
  const isDecided = user?.bloodTestStatus === "declined" || user?.bloodTestStatus === "pending_blood_test" || user?.bloodTestStatus === "waiting";

  // === سقف استفاده واقعی از پلن کاربر ===
  const limit = getCapabilities(user?.planName ?? null).bloodTestLimit;
  const usedCount = user?.bloodTestUsed ?? 0;
  const limitReached = limit > 0 && usedCount >= limit;

  // === بارگذاری آخرین نتیجه ذخیره‌شده در DB (تا رفرش صفحه اطلاعات را از دست ندهد) ===
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/coach/analyze-blood", { cache: "no-store" });
        const data = await res.json();
        if (data?.result) {
          setResult(data.result);
        }
      } catch {
        // سکوت — خطای شبکه در بارگذاری نتیجه ذخیره‌شده نباید تجربه کاربر را خراب کند
      }
    })();
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("فقط تصویر مجاز است");
      return;
    }
    // گیت حجم — سرور هم payloadهای بالای ۸MB base64 (≈۶MB فایل خام) را رد می‌کند؛
    // اینجا زودتر و دوستانه‌تر خطا می‌دهیم تا کاربر آپلود بی‌فایده نکند.
    if (f.size > 6 * 1024 * 1024) {
      toast.error("حجم تصویر نباید بیشتر از ۶ مگابایت باشد");
      return;
    }
    setFile(f);
    setImgUrl(URL.createObjectURL(f));
    setResult(null);
  }

  async function analyze() {
    if (!file) return;
    if (limitReached) {
      toast.error("سقف استفاده از این قابلیت پر شده است.");
      return;
    }
    setAnalyzing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(arrayBuffer);
      const res = await fetch("/api/coach/analyze-blood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Image: base64, mimeType: file.type }),
      });
      // ─── بررسی وضعیت قبل از JSON parse ───
      // اگر سرور HTML برگرداند (مثلاً خطای 500)، res.json() خطای
      // "Unexpected token" می‌دهد. ابتدا res.ok را بررسی می‌کنیم (الگوی analyze-video).
      if (!res.ok) {
        let errMsg = "خطا در تحلیل آزمایش";
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
      // آپدیت فوری شمارنده استفاده در store — بدون نیاز به رفرش
      useAppStore.setState((s) => ({
        user: s.user ? { ...s.user, bloodTestUsed: (s.user.bloodTestUsed ?? 0) + 1 } : s.user,
      }));
      toast.success("آنالیز آزمایش خون کامل شد! 🩸");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در تحلیل");
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    if (imgUrl) URL.revokeObjectURL(imgUrl);
    setFile(null);
    setImgUrl("");
    setResult(null);
  }

  /** Download the prescription as a PNG image (html-to-image).
   *  We temporarily reveal the hidden printable div so html-to-image can capture its layout,
   *  then hide it again. The div is positioned offscreen so it never overlaps visible content.
   */
  async function downloadPrescriptionImage() {
    if (!prescriptionRef.current) return;
    setDownloading(true);
    setIsCapturing(true);
    try {
      // Wait two animation frames so React has flushed the display:block style.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(prescriptionRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: 800,
      });
      const link = document.createElement("a");
      link.download = `fitap-blood-test-prescription-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("فرم آزمایش دانلود شد ✓");
    } catch (e) {
      console.error("[downloadPrescriptionImage]", e);
      toast.error("خطا در ساخت تصویر فرم آزمایش");
    } finally {
      setIsCapturing(false);
      setDownloading(false);
    }
  }

  /** Group markers by category id for display. */
  const groupedMarkers: { category: BloodTestCategory | null; items: any[] }[] = (() => {
    if (!result?.markers) return [];
    const map = new Map<string, any[]>();
    for (const m of result.markers) {
      const catId = m.category || "_other";
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId)!.push(m);
    }
    const out: { category: BloodTestCategory | null; items: any[] }[] = [];
    // Preserve canonical category order from BLOOD_TEST_CATEGORIES
    for (const c of BLOOD_TEST_CATEGORIES) {
      const items = map.get(c.id);
      if (items && items.length) out.push({ category: c, items });
    }
    const other = map.get("_other");
    if (other && other.length) out.push({ category: null, items: other });
    return out;
  })();

  return (
    <div className="flex flex-col h-full relative">
      {/* ============================================================
          HIDDEN PRINTABLE PRESCRIPTION
          display:none by default — ONLY revealed during download capture.
          Offscreen (left: -9999px) so it never overlaps visible content.
         ============================================================ */}
      <div
        ref={prescriptionRef}
        style={{
          position: "fixed",
          top: 0,
          left: "-9999px",
          width: "800px",
          background: "#ffffff",
          padding: "32px",
          fontFamily: "Vazirmatn, Tahoma, Arial, system-ui, sans-serif",
          direction: "rtl",
          color: "#1e293b",
          pointerEvents: "none",
          display: isCapturing ? "block" : "none",
        }}
        aria-hidden
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "3px solid #f59e0b",
            paddingBottom: "16px",
            marginBottom: "20px",
          }}
        >
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
              <h1 style={{ fontSize: "28px", fontWeight: 900, margin: 0, color: "#1e293b" }}>
                فیتاپ
              </h1>
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
                فرم جامع آزمایش خون توصیه‌شده
              </p>
            </div>
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>تاریخ صدور</p>
            <p style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
              {new Date().toLocaleDateString("fa-IR")}
            </p>
          </div>
        </div>

        {/* Intro banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
            border: "1px solid #fed7aa",
            borderRadius: "16px",
            padding: "14px 18px",
            marginBottom: "20px",
          }}
        >
          <p style={{ fontSize: "12px", color: "#ea580c", fontWeight: 700, margin: "0 0 4px 0" }}>
            🩸 موارد آزمایش ({toPersianDigits(TOTAL_BLOOD_TESTS)} نشانگر در {toPersianDigits(BLOOD_TEST_CATEGORIES.length)} دسته)
          </p>
          <p style={{ fontSize: "13px", color: "#1e293b", margin: 0 }}>
            این آزمایش‌ها برای طراحی برنامه بهینه ورزشی و تغذیه‌ای ضروری هستند. لطفاً با مراجعه به آزمایشگاه، نتایج را پس از انجام به پلتفرم آپلود کنید.
          </p>
        </div>

        {/* Tests list grouped by category */}
        {BLOOD_TEST_CATEGORIES.map((cat) => (
          <div key={cat.id} style={{ marginBottom: "18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: "10px 10px 0 0",
                padding: "8px 12px",
                fontWeight: 800,
                fontSize: "14px",
                color: "#9a3412",
              }}
            >
              <span style={{ fontSize: "16px" }}>{cat.icon}</span>
              <span>{cat.name}</span>
              <span style={{ marginRight: "auto", fontSize: "11px", fontWeight: 600, color: "#c2410c" }}>
                {toPersianDigits(cat.tests.length)} آزمایش
              </span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", border: "1px solid #fed7aa", borderTop: "none" }}>
              <thead>
                <tr style={{ background: "#fffbeb" }}>
                  <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #fef3c7", width: "28px", color: "#9a3412" }}>#</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #fef3c7", color: "#9a3412" }}>نام آزمایش</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #fef3c7", color: "#9a3412" }}>محدوده نرمال</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid #fef3c7", color: "#9a3412" }}>توضیحات</th>
                </tr>
              </thead>
              <tbody>
                {cat.tests.map((t, i) => (
                  <tr key={t.key} style={{ borderBottom: "1px solid #fef3c7" }}>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#9a3412", fontWeight: 700 }}>{toPersianDigits(i + 1)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#1e293b" }}>
                      {t.name}
                      <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 400, display: "block" }}>{t.enName}</span>
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748b", fontSize: "11px" }}>{t.refRange || "—"}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748b", fontSize: "11px" }}>{t.desc || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Notes */}
        <div
          style={{
            background: "#fff7ed",
            border: "1px dashed #fdba74",
            borderRadius: "12px",
            padding: "12px 16px",
            marginTop: "8px",
          }}
        >
          <p style={{ fontSize: "12px", color: "#ea580c", fontWeight: 700, margin: "0 0 4px 0" }}>
            📝 نکات مهم
          </p>
          <p style={{ fontSize: "12px", color: "#1e293b", margin: 0, lineHeight: 1.7 }}>
            این آزمایش‌ها برای طراحی برنامه بهینه ضروری هستند. نتایج را پس از انجام به پلتفرم آپلود کنید.
            حداقل ۱۲ ساعت قبل از آزمایش ناشتا باشید. داروهای مصرفی را پیش از آزمایش با پزشک مشورت کنید.
          </p>
        </div>

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
          <span>fitap.ir</span>
        </div>
      </div>

      {/* ============================================================
          VISIBLE UI — header
         ============================================================ */}
      <div className="flex items-center justify-between p-4 border-b glass-strong">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
            <TestTube className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm">آنالیز آزمایش خون</h2>
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

      {/* ============================================================
          VISIBLE UI — scrollable body
         ============================================================ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 max-w-2xl mx-auto w-full">
        <div className="glass-yellow rounded-2xl p-4 text-sm text-center">
          <Sparkles className="w-5 h-5 text-primary mx-auto mb-1" />
          عکس آزمایش خونت رو آپلود کن تا هوش مصنوعی نتایج رو در {toPersianDigits(BLOOD_TEST_CATEGORIES.length)} دسته و {toPersianDigits(TOTAL_BLOOD_TESTS)} نشانگر آنالیز و با برنامه‌ت تطبیق بده
        </div>

        {/* === Step 1: Upload section (only if no file) === */}
        {!file && (
          limitReached ? (
            <div className="glass rounded-3xl border-2 border-amber-300 bg-amber-50/50 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="font-bold text-amber-700 mb-1">سقف استفاده از این قابلیت پر شده است</p>
              <p className="text-xs text-amber-600">
                شما از {toPersianDigits(usedCount)} از {toPersianDigits(limit)} تحلیل مجاز پلن حرفه‌ای خود استفاده کرده‌اید.
                برای تحلیل آزمایش جدید، پلن خود را تمدید کنید.
              </p>
            </div>
          ) : (
            <label className="block">
              <div className="glass rounded-3xl border-2 border-dashed border-border hover:border-primary/50 transition p-10 text-center cursor-pointer">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4"
                >
                  <Upload className="w-8 h-8 text-red-400" />
                </motion.div>
                <p className="font-bold mb-1">عکس آزمایش خون را آپلود کن</p>
                <p className="text-xs text-muted-foreground">فرمت: JPG, PNG — عکس واضح از برگه آزمایش</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
          )
        )}

        {/* === کارت دانلود فرم (فقط قبل از تعیین تکلیف) === */}
        {!file && !result && !limitReached && !isDecided && (
          <div className="glass rounded-2xl border-2 border-orange-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
              <Download className="w-4 h-4" />
              <h3 className="font-bold text-sm">فرم درخواست آزمایش خون</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">برای داشتن برنامه کاملاً شخصی‌سازی‌شده، فرم را دانلود یا پرینت بگیرید و به آزمایشگاه ببرید.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => window.open("/api/blood-test/form", "_blank")} className="rounded-xl text-white font-bold" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <span className="flex items-center gap-2"><Printer className="w-4 h-4" /> پرینت / PDF</span>
                </Button>
                <Button onClick={downloadPrescriptionImage} disabled={downloading} variant="outline" className="rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50">
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-2"><Download className="w-4 h-4" /> دانلود عکس</span>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* === کارت تعیین تکلیف شده (سبز) === */}
        {!file && !result && !limitReached && isDecided && (
          <div className="glass rounded-3xl border-2 border-emerald-300 bg-emerald-50/50 p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="font-bold text-emerald-700 mb-1">{user?.bloodTestStatus === "declined" ? "آزمایش خون رد شد ✓" : "در انتظار نتایج آزمایش ⏳"}</p>
            <p className="text-xs text-emerald-600">{user?.bloodTestStatus === "declined" ? "شما این پیش‌نیاز را تعیین تکلیف کرده‌اید." : "وقتی جواب آزمایش آماده شد، عکس آن را آپلود کنید."}</p>
          </div>
        )}

        {/* === گزینه‌های تعیین تکلیف (فقط قبل از تصمیم) === */}
        {!file && !result && !limitReached && !isDecided && (
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-700 text-center">اگر هنوز آزمایش خون ندارید، یکی از گزینه‌ها را انتخاب کنید:</p>
            <div className="flex flex-col gap-2">
              <button onClick={async () => {
                try {
                  // ─── بررسی res.ok مثل الگوی skipVideo (video-analysis-view) ───
                  // fetch روی 403/500 هم resolve می‌شود؛ بدون این چک، با شکست سرور
                  // toast موفقیت نشان داده می‌شد در حالی که سرور چیزی ثبت نکرده بود.
                  const r = await fetch("/api/blood-test-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "pending_blood_test" }) });
                  if (!r.ok) throw new Error("خطا");
                  toast.success("باشه! تا زمان آپلود نتایج، تولید برنامه متوقف می‌ماند.");
                  if (user) setUser({ ...user, bloodTestStatus: "pending_blood_test" });
                  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("prereq-updated"));
                } catch { toast.error("خطا"); }
              }} className="w-full p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm font-medium text-amber-700 hover:bg-amber-100 transition text-center">
                🔄 آزمایش دادم و منتظر جوابم
              </button>
              <button onClick={async () => {
                setSkipping(true);
                try {
                  // ─── بررسی res.ok مثل الگوی skipVideo (video-analysis-view) ───
                  const r = await fetch("/api/blood-test-status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "declined" }) });
                  if (!r.ok) throw new Error("خطا");
                  toast.success("باشه! برنامه بدون آزمایش خون طراحی می‌شود.");
                  if (user) setUser({ ...user, bloodTestStatus: "declined" });
                  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("prereq-updated"));
                } catch { toast.error("خطا"); }
                finally { setSkipping(false); }
              }} disabled={skipping} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition text-center disabled:opacity-50">
                {skipping ? "در حال ثبت..." : "❌ آپلود نمی‌کنم"}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center">برنامه در هر صورت طراحی می‌شود. آزمایش خون فقط برای دقت بیشتر است.</p>
          </div>
        )}


        {/* === Step 2: Image preview + Analyze button === */}
        {file && !result && (
          <div className="space-y-3">
            <div className="glass rounded-2xl overflow-hidden">
              <img src={imgUrl} alt="آزمایش خون آپلودشده" className="w-full max-h-72 object-contain bg-muted/20" />
              <div className="p-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground truncate">{file.name}</p>
                <button onClick={reset} className="text-xs text-destructive flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> تغییر عکس
                </button>
              </div>
            </div>
            <Button onClick={analyze} disabled={analyzing} className="w-full rounded-xl h-12 font-bold">
              {analyzing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> در حال آنالیز نتایج...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> شروع آنالیز آزمایش
                </span>
              )}
            </Button>
          </div>
        )}

        {/* === Step 3: Analyzing progress === */}
        {analyzing && (
          <div className="space-y-2">
            {[
              "استخراج مقادیر از عکس آزمایش...",
              "مقایسه با محدوده نرمال...",
              "شناسایی کمبودها و موارد بحرانی...",
              "تطبیق با برنامه غذایی و مکمل...",
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.8 }}
                className="flex items-center gap-2 text-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-primary" /> {s}
              </motion.div>
            ))}
          </div>
        )}

        {/* === Step 4: AI Analysis Results === */}
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Overall health score */}
            <div className="glass rounded-2xl p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">سلامت عمومی</p>
              <p className="text-3xl font-black gradient-text mb-1">{toPersianDigits(result.score)}</p>
              <p className="text-sm font-bold text-emerald-500">{result.overall}</p>
            </div>

            {/* Markers grouped by category */}
            {groupedMarkers.length > 0 && (
              <div className="space-y-3">
                {groupedMarkers.map(({ category, items }, gi) => (
                  <div key={gi} className="glass rounded-2xl p-4">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                      {category ? (
                        <>
                          <span className="text-base">{category.icon}</span>
                          <span>{category.name}</span>
                        </>
                      ) : (
                        <span>سایر نشانگرها</span>
                      )}
                      <span className="text-[10px] text-muted-foreground mr-auto">
                        {toPersianDigits(items.length)} مورد
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {items.map((m: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-xs">{m.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-bold text-xs" dir="ltr">
                                {m.value}
                                {m.unit ? ` ${m.unit}` : ""}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLORS[m.status] || STATUS_COLORS.unknown}`}
                              >
                                {STATUS_LABELS[m.status] || STATUS_LABELS.unknown}
                              </span>
                            </div>
                          </div>
                          {m.reference && (
                            <p className="text-[10px] text-muted-foreground mb-1" dir="rtl">
                              محدوده نرمال: <span dir="ltr">{m.reference}</span>
                            </p>
                          )}
                          {m.explanation && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{m.explanation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Deficiencies */}
            {result.deficiencies?.length > 0 && (
              <div className="glass rounded-2xl p-4 border border-amber-500/30">
                <h4 className="font-bold text-sm flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> کمبودهای شناسایی‌شده
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.deficiencies.map((d: string, i: number) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Food recommendations */}
            {result.recommendations?.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <h4 className="font-bold text-sm flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" /> توصیه‌های تغذیه‌ای و سبک زندگی
                </h4>
                <ul className="space-y-1.5">
                  {result.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Supplement recommendations */}
            {result.supplements?.length > 0 && (
              <div className="glass rounded-2xl p-4 border border-orange-500/30">
                <h4 className="font-bold text-sm flex items-center gap-2 mb-2">
                  <Pill className="w-4 h-4 text-orange-500" /> مکمل‌های پیشنهادی
                </h4>
                <ul className="space-y-1.5">
                  {result.supplements.map((s: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <Pill className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Medical warnings */}
            {result.warnings?.length > 0 &&
              result.warnings.map((w: string, i: number) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {w}
                </div>
              ))}

            <Button onClick={reset} variant="outline" className="w-full rounded-xl">
              <RefreshCw className="w-4 h-4" /> آپلود آزمایش جدید
            </Button>
          </motion.div>
        )}

        {/* === Step 5: Download / print prescription form (always available at bottom) === */}
        <div className="bg-white rounded-2xl border-2 border-orange-200 overflow-hidden">
          <div
            className="flex items-center gap-2 px-4 py-3 text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <TestTube className="w-4 h-4" />
            <h3 className="font-bold text-sm">فرم جامع آزمایش خون فیتاپ</h3>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              برای داشتن یک برنامه ورزشی و تغذیه‌ای کاملاً شخصی‌سازی‌شده، توصیه می‌کنیم آزمایش‌های زیر ({toPersianDigits(TOTAL_BLOOD_TESTS)} نشانگر در {toPersianDigits(BLOOD_TEST_CATEGORIES.length)} دسته) را انجام دهید. فرم را دانلود یا پرینت بگیرید و به آزمایشگاه ببرید.
            </p>
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto custom-scrollbar">
              {BLOOD_TEST_CATEGORIES.map((cat) => (
                <div key={cat.id} className="rounded-lg bg-orange-50/50 border border-orange-100 overflow-hidden">
                  <div className="px-2.5 py-1.5 bg-orange-100/50 flex items-center gap-1.5">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-xs font-bold text-slate-900">{cat.name}</span>
                    <span className="text-[10px] text-slate-500 mr-auto">{toPersianDigits(cat.tests.length)} آزمایش</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {cat.tests.map((t) => (
                      <div key={t.key} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-medium text-slate-700">{t.name}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[50%] text-left" dir="ltr">
                          {t.refRange || t.enName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
