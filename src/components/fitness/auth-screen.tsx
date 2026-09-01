"use client";

import { recoverPendingPayments } from "@/lib/fitness/recover-payments-client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Phone,
  ShieldCheck,
  ChevronLeft,
  RefreshCw,
  MessageSquare,
  Timer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAppStore } from "@/lib/fitness/store";
import { isFitUpBazaarApp } from "@/lib/fitness/bazaar-bridge";
import { toast } from "sonner";
import { pushScreen, replaceScreen } from "@/lib/fitness/navigation";

type Step = "mobile" | "otp";

const RESEND_COOLDOWN_SEC = 90;
// اعتبار پیش‌فرض کد (ثانیه) — سرور expiresIn می‌فرستد؛ این fallback است
const OTP_VALIDITY_FALLBACK_SEC = 600;

// ۰۹:۵۹ → "۹:۵۹" فارسی — شمارش معکوس اعتبار کد
function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// FIX: تبدیل ارقام فارسی (۰-۹) و عربی (٠-٩) به لاتین قبل از فیلتر.
// regex \d فقط ارقام ASCII را می‌گیرد و قبلاً ارقام فارسی (کیبورد فارسی)
// بی‌صدا حذف می‌شدند — کاربر نمی‌توانست شماره/کد را تایپ کند.
function normalizeDigits(input: string): string {
  return input
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)) // ۰-۹
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)); // ٠-٩
}

// Validate Iranian mobile format (09XXXXXXXXX)
function isValidIranMobile(mobile: string): boolean {
  return /^09\d{9}$/.test(mobile.replace(/\s/g, ""));
}

export function AuthScreen() {
  const { setUser, setScreen, setOverlay } = useAppStore();

  // ---- State ----
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // ── شمارش معکوس «اعتبار کد» ──
  // مشکل گزارش‌شده کاربران: «پیامک بعد از تموم شدن زمان میاد» — تایمر قبلی فقط
  // مال «ارسال مجدد» بود (۶۰ ثانیه) و کاربر فکر می‌کرد کد بعدش بی‌اعتبار است؛
  // پیامک می‌رسید، کد را می‌زد و (قبل از این فیکس) چون ریسند کرده بود کد اول
  // باطل شده بود. حالا: اعتبار واقعی (۱۰ دقیقه) شمرده و نمایش داده می‌شود تا
  // کاربر بداند پیامک دیررسیده هم هنوز معتبر است و شتاب‌زده ریسند نکند.
  // null = هنوز کدی نفرستاده‌ایم/نمی‌دانیم → چیزی نمایش نده؛ ۰ = واقعاً منقضی.
  const [validityIn, setValidityIn] = useState<number | null>(null);
  const otpWrapperRef = useRef<HTMLDivElement | null>(null);

  // ── کارت «ورود خودکار با پیامک» (فقط اپ بازار — درخواست مالک) ──
  // مجوزها باید شخصی‌سازی‌شده و با طراحی جذاب پرسیده شوند، نه دیالوگ بلند
  // سیستمی. این کارت با یک خط توضیح، دکمه فعال‌سازی و دکمه «خودم وارد می‌کنم»
  // قبل از دیالوگ کوتاه نیتیو نمایش داده می‌شود. انتخاب کاربر ذخیره می‌شود.
  const [showSmsPermissionCard, setShowSmsPermissionCard] = useState(false);

  useEffect(() => {
    if (step !== "otp") return;
    let optedOut = false;
    try {
      optedOut = window.localStorage.getItem("fitup_sms_autoread_choice") === "manual";
    } catch {}
    if (optedOut) return;
    // اگر از قبل مجوز داده شده، نیتیو ساکت است — کارت لازم نیست؛ فقط receiver وصل می‌شود
    let cardTimer: ReturnType<typeof setTimeout> | null = null;
    cardTimer = setTimeout(() => {
      if (isFitUpBazaarApp()) {
        setShowSmsPermissionCard(true);
      }
    }, 900);
    return () => { if (cardTimer) clearTimeout(cardTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function acceptSmsAutoRead() {
    setShowSmsPermissionCard(false);
    try { window.localStorage.setItem("fitup_sms_autoread_choice", "auto"); } catch {}
    try {
      (window as any).FitUpNative?.requestSmsAutoRead?.();
    } catch {}
  }

  function declineSmsAutoRead() {
    setShowSmsPermissionCard(false);
    try { window.localStorage.setItem("fitup_sms_autoread_choice", "manual"); } catch {}
    toast.info("کد را دستی وارد کنید — هر وقت خواستی از همین صفحه دوباره فعالش کن")
  }

  // NOTE: The "new terms" modal is rendered globally by `GlobalNewTermsModal`
  // (mounted in layout.tsx) whenever the `termsUpdateRequired` flag is set in
  // the store. The auth screen does NOT need to manage its own modal — the
  // global one overlays whatever screen the user is on (including this one).

  // ---- Resend cooldown ticker ----
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // ---- Code validity countdown ticker ----
  useEffect(() => {
    if (validityIn == null || validityIn <= 0) return;
    const t = setTimeout(() => setValidityIn((v) => (v == null ? null : Math.max(0, v - 1))), 1000);
    return () => clearTimeout(t);
  }, [validityIn]);

  // ---- Auto-focus OTP input when entering step 2 ----
  useEffect(() => {
    if (step === "otp") {
      // small delay to ensure DOM is ready
      const t = setTimeout(() => {
        const firstInput = otpWrapperRef.current?.querySelector<HTMLInputElement>(
          "input[data-input-otp='true'], input"
        );
        firstInput?.focus();
      }, 80);
      return () => clearTimeout(t);
    }
  }, [step]);

  // ---- Auto-fill OTP via Web OTP API (Android Chrome) ----
  // و autocomplete="one-time-code" برای iOS/Android system autofill
  useEffect(() => {
    if (step !== "otp") return;
    if (typeof navigator === "undefined") return;

    // Web OTP API — فقط در Android Chrome
    // بررسی دقیق‌تر: بعضی مرورگرها "credentials" دارند اما "OTPCredential" ندارند
    if ("credentials" in navigator && (window as any).OTPCredential) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 120000); // 2min timeout

      (navigator as any).credentials
        .get({
          otp: { transport: ["sms"] },
          signal: abortController.signal,
        })
        .then((otp: any) => {
          clearTimeout(timeout);
          if (otp?.code) {
            // فقط ارقام؛ اگر کد طولانی‌تر بود، آخرین ۴ رقم (فرمت @origin <code>)
            const digits = otp.code.replace(/\D/g, "");
            const cleanedCode = digits.length > 4 ? digits.slice(-4) : digits;
            if (cleanedCode.length === 4) {
              setCode(cleanedCode);
            }
          }
        })
        .catch(() => {
          clearTimeout(timeout);
          // User dismissed, timed out, or not supported — ignore
        });

      return () => {
        clearTimeout(timeout);
        abortController.abort();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ---- درج خودکار کد از اپ اندروید (بازار) ----
  // اپ با RECEIVE_SMS (اجازه صریح کاربر) پیامک کد فیتاپ را می‌خواند و از طریق
  // window.__fitupNativeSmsCode به سایت می‌دهد؛ همین‌جا کد درج می‌شود و
  // auto-verify (الکت بالا) بلافاصله وارد پنل می‌کند. کد کلیپ‌بورد هم از همین
  // مسیر می‌آید (اپ در onResume چک می‌کند).
  // ⚠️ درخواست مجوز از طریق کارت جذاب بالا (acceptSmsAutoRead) انجام می‌شود —
  // دیالوگ بلند سیستمی دیگر بی‌دلیل و بی‌سبق در لحظه ورود OTP نمی‌آید.
  useEffect(() => {
    if (step !== "otp") return;
    (window as any).__fitupNativeSmsCode = (raw: unknown) => {
      try {
        const digits = normalizeDigits(String(raw ?? "")).replace(/\D/g, "");
        if (digits.length === 4) {
          setCode(digits);
          setError("");
        }
      } catch {}
    };
    return () => {
      try {
        delete (window as any).__fitupNativeSmsCode;
      } catch {}
    };
  }, [step]);

  // ---- Auto-verify when code is complete (4 digits) ----
  useEffect(() => {
    if (step === "otp" && code.length === 4 && !loading) {
      // Small delay to ensure UI updates before verification
      const t = setTimeout(() => handleVerify(), 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  // ---- Send OTP ----
  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");

    if (!isValidIranMobile(mobile)) {
      setError("شماره موبایل نامعتبر است. مثال: 09123456789");
      toast.error("شماره موبایل نامعتبر است.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || "ارسال کد با خطا مواجه شد.";
        setError(msg);
        toast.error(msg);
        // If resend-too-soon, jump to OTP step anyway and apply the wait time
        if (data?.code === "RESEND_TOO_SOON" && typeof data.waitSeconds === "number") {
          setStep("otp");
          setResendIn(Math.min(RESEND_COOLDOWN_SEC, Math.max(1, data.waitSeconds)));
          // کد قبلی هنوز در راه است — تایمر اعتبارش را هم شروع کن
          setValidityIn(OTP_VALIDITY_FALLBACK_SEC);
        }
        return;
      }
      toast.success("کد ۴ رقمی به شماره شما ارسال شد.");
      setStep("otp");
      setCode("");
      setResendIn(RESEND_COOLDOWN_SEC);
      setValidityIn(
        typeof data?.expiresIn === "number" ? data.expiresIn : OTP_VALIDITY_FALLBACK_SEC
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطای ناشناخته";
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  // ---- Resend OTP ----
  async function handleResend() {
    if (resendIn > 0) return;
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || "ارسال مجدد با خطا مواجه شد.";
        if (data?.code === "RESEND_TOO_SOON" && typeof data.waitSeconds === "number") {
          setResendIn(Math.min(RESEND_COOLDOWN_SEC, Math.max(1, data.waitSeconds)));
          toast.error(msg);
          return;
        }
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("کد جدید ارسال شد.");
      setCode("");
      setResendIn(RESEND_COOLDOWN_SEC);
      setValidityIn(
        typeof data?.expiresIn === "number" ? data.expiresIn : OTP_VALIDITY_FALLBACK_SEC
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطای ناشناخته";
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  // ---- Verify OTP ----
  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");

    if (code.length !== 4) {
      setError("کد ۴ رقمی را وارد کنید.");
      return;
    }

    setLoading(true);
    try {
      // --- ارسال کد معرفی ذخیره‌شده در localStorage (در صورت وجود) ---
      // این کد در زمان ورود با لینک ?ref=CODE ذخیره شده است.
      let referralCode: string | undefined;
      try {
        const stored = window.localStorage.getItem("fitap_referral_code");
        if (stored) referralCode = stored.trim().toUpperCase();
      } catch {
        // localStorage may be unavailable — silently ignore
      }

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code, referralCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || "تأیید کد با خطا مواجه شد.";
        setError(msg);
        toast.error(msg);
        setCode(""); // clear OTP on error so user re-types
        return;
      }

      setUser(data);
      toast.success("خوش آمدید! 💪");
      // ─── FIX (بازیابی پرداخت معلق در همان لحظه‌ی لاگین) ───
      // کاربری که در درگاه پرداخت کرده ولی پلنش فعال نشده، معمولاً دوباره
      // لاگین می‌کند «تا ببیند چرا فعال نشده» — همین‌جا استعلام و تحویل خودکار
      // انجام می‌شود (قبلاً این نقطه وجود نداشت و بازیابی به رفرش بعدی می‌افتاد).
      recoverPendingPayments();
      // پاک کردن کد معرفی از localStorage پس از ثبت‌نام موفق
      try {
        window.localStorage.removeItem("fitap_referral_code");
      } catch {}
      // پاک کردن query params (?screen=auth) پس از ورود موفق
      // تا هنگام رفرش، صفحه OTP نمایش داده نشود
      try {
        // URL را به ?screen=panel تغییر بده برای رفرش
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("screen", "panel");
          window.history.replaceState({}, "", url.toString());
        } catch {}
      } catch {}
      // Admin users go directly to the admin panel (skip onboarding + main app)
      if (data.role === "ADMIN") {
        setScreen("admin");
      } else {
        setScreen(data.onboardingDone ? "main" : "onboarding");
        // ─── کاربر با لینک تمدید آمده بود → بعد از لاگین صفحه تمدید باز شود ───
        if (data.onboardingDone) {
          try {
            if (window.sessionStorage.getItem("fitap_open_renewal") === "1") {
              window.sessionStorage.removeItem("fitap_open_renewal");
              setOverlay("renewal");
            }
          } catch {}
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطای ناشناخته";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white relative overflow-hidden">
      {/* Subtle gold background accents */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-32 -right-24 w-80 h-80 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-amber-100/40 blur-3xl" />
      </div>

      {/* Brand header */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <motion.button
          type="button"
          onClick={() => { setScreen("landing"); replaceScreen("landing"); }}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-5 right-5 flex items-center gap-1 text-slate-500 hover:text-slate-900 transition text-sm"
        >
          بازگشت
          <ChevronLeft className="w-4 h-4" />
        </motion.button>

        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative mb-5"
        >
          <div className="absolute inset-0 bg-amber-300/40 blur-2xl rounded-full" />
          <div
            className="relative w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl overflow-hidden"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-black text-slate-900 text-center mb-2"
        >
          فیتاپ
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-slate-500 text-center text-sm max-w-xs"
        >
          هر بدنی فیتاپ میخواد
        </motion.p>
      </div>

      {/* Form card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-t-[2rem] border-2 border-orange-200 shadow-2xl shadow-orange-500/10 px-6 pt-6 pb-10 mx-3 mb-3"
      >
        <AnimatePresence mode="wait">
          {step === "mobile" ? (
            <motion.form
              key="mobile-step"
              onSubmit={handleSendOtp}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 mb-2">
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[11px]">
                  ۱
                </span>
                <span>شماره موبایل</span>
                <span className="w-8 h-px bg-slate-200" />
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[11px]">
                  ۲
                </span>
                <span>تأیید کد</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile" className="text-sm font-medium text-slate-700">
                  شماره موبایل
                </Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
                  <Input
                    id="mobile"
                    value={mobile}
                    onChange={(e) =>
                      setMobile(normalizeDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 11))
                    }
                    placeholder="09123456789"
                    inputMode="numeric"
                    dir="ltr"
                    className="pr-11 h-14 rounded-xl text-left bg-white border-2 border-orange-100 focus-visible:border-orange-400 focus-visible:ring-orange-300/40 text-slate-900 placeholder:text-slate-400 text-lg tracking-wider"
                    autoComplete="tel"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-center"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={sending || !isValidIranMobile(mobile)}
                className="w-full h-14 rounded-2xl text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/40 disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-lg flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                {sending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    در حال ارسال...
                  </span>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    ارسال کد
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 justify-center text-xs text-slate-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
                <span>کد ۴ رقمی از طریق پیامک برای شما ارسال می‌شود</span>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="otp-step"
              onSubmit={handleVerify}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("mobile");
                    setCode("");
                    setError("");
                    setResendIn(0);
                  }}
                  className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[11px] hover:bg-orange-600 transition"
                  aria-label="بازگشت به مرحله شماره موبایل"
                >
                  ۱
                </button>
                <span>شماره موبایل</span>
                <span className="w-8 h-px bg-orange-200" />
                <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-[11px]">
                  ۲
                </span>
                <span className="text-slate-700">تأیید کد</span>
              </div>

              <div className="space-y-3 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium">
                  <Phone className="w-3.5 h-3.5" />
                  <span dir="ltr" className="tracking-wider">
                    {mobile}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  کد ۴ رقمی ارسال‌شده به شماره بالا را وارد کنید
                </p>
              </div>

              {/* OTP input — فقط همین یک input با autocomplete="one-time-code" است.
                  ⚠️ input های قلابی نامرئی حذف شدند: سرویس‌های autofill اندروید/iOS
                  به آن‌ها هدف‌بندی می‌کردند و کاربر می‌دید «مجوز پرکردن می‌گیرد ولی
                  چیزی پر نمی‌شود». حالا هدفِ پرکردن، همین فیلد واقعیِ فوکوس‌شده است.
                  iOS: textContentType="one-time-code" + autocomplete → پیشنهاد "از پیام‌ها"
                  Android: autocomplete + WebOTP listener بالا → دیالوگ اجازه + پرکردن */}
              {/* ─── FIX (درخواست مالک): کد خودکار در «سایت و وب‌اپ» هم وارد شود ───
                  قبلاً: Chrome اندروید پیشنهاد درج کد (suggestion/autofill) را نشان
                  می‌داد ولی کد در باکس‌های ظاهری وارد نمی‌شد — چون کتابخانه input-otp
                  یک input مخفی دارد و autofill مرورگر گاهی فقط مقدار DOM را عوض می‌کند
                  بدون اینکه onChange ری‌اکت fire شود. این handler در فاز capture روی
                  «همه» input event های داخل wrapper می‌نشیند و مقدار مخفی را با state
                  سنکرون می‌کند — هر مسیری که کد را پر کند (WebOTP، autofill کیبورد،
                  paste، دلخواه مرورگر) نتیجه همان است: باکس‌ها پر می‌شوند. */}
              <div
                ref={otpWrapperRef}
                className="flex items-center justify-center gap-2 sm:gap-3 py-2"
                dir="ltr"
                onInputCapture={(e) => {
                  const el = e.target as HTMLInputElement;
                  if (!el || el.tagName !== "INPUT") return;
                  const digits = normalizeDigits(el.value || "").replace(/\D/g, "");
                  if (digits.length >= 4) {
                    const candidate = digits.length > 4 ? digits.slice(-4) : digits;
                    setCode((prev) => (prev === candidate ? prev : candidate));
                  }
                }}
              >
                <InputOTP
                  maxLength={4}
                  value={code}
                  onChange={(v) => setCode(normalizeDigits(v).replace(/\D/g, "").slice(0, 4))}
                  autoFocus
                  name="otp"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                >
                  <InputOTPGroup>
                    <InputOTPSlot
                      index={0}
                      className="w-14 h-16 sm:w-16 sm:h-18 text-2xl font-black rounded-xl border-2 first:border-l-2 first:rounded-l-xl last:rounded-r-xl border-orange-100 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-300/30 text-slate-900 bg-white"
                    />
                    <InputOTPSlot
                      index={1}
                      className="w-14 h-16 sm:w-16 sm:h-18 text-2xl font-black rounded-xl border-2 first:border-l-2 first:rounded-l-xl last:rounded-r-xl border-orange-100 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-300/30 text-slate-900 bg-white"
                    />
                    <InputOTPSlot
                      index={2}
                      className="w-14 h-16 sm:w-16 sm:h-18 text-2xl font-black rounded-xl border-2 first:border-l-2 first:rounded-l-xl last:rounded-r-xl border-orange-100 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-300/30 text-slate-900 bg-white"
                    />
                    <InputOTPSlot
                      index={3}
                      className="w-14 h-16 sm:w-16 sm:h-18 text-2xl font-black rounded-xl border-2 first:border-l-2 first:rounded-l-xl last:rounded-r-xl border-orange-100 data-[active=true]:border-orange-400 data-[active=true]:ring-orange-300/30 text-slate-900 bg-white"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {/* ── شمارش معکوس اعتبار کد (۱۰ دقیقه) ──
                  کاربر می‌بیند کد هنوز معتبر است حتی وقتی پیامک دیر رسید؛
                  و وقتی تمام شد پیام واضح «منقضی شد» + راهنمای ریسند. */}
              {step === "otp" && validityIn != null && validityIn > 0 && (
                <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-orange-500" />
                  کد تا
                  <span dir="ltr" className="font-black text-slate-700 tabular-nums">
                    {formatCountdown(validityIn)}
                  </span>
                  دیگر معتبر است
                </p>
              )}
              {step === "otp" && validityIn === 0 && (
                <p className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  ⏰ اعتبار کد به پایان رسید — دکمه «ارسال مجدد کد» را بزنید
                </p>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-center"
                >
                  {error}
                </motion.div>
              )}

              {/* ─── کارت «ورود خودکار با پیامک» — مجوز شخصی‌سازی‌شده اپ بازار ───
                  درخواست مالک: «در اپ موبایل دسترسی‌ها باید شخصی‌سازی‌شده اجازه بگیرن
                  و برای هر کدوم طراحی جذاب بذار — الان انگار کروم داره اجازه می‌گیره».
                  این کارت قبل از دیالوگ کوتاه سیستمی نمایش داده می‌شود؛ فقط با یک
                  خط توضیح + دو دکمه واضح. */}
              {showSmsPermissionCard && step === "otp" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-orange-200 bg-gradient-to-l from-orange-50 to-amber-50 p-3.5"
                  role="dialog"
                  aria-label="فعال‌سازی ورود خودکار با پیامک"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                    >
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-800">ورود خودکار با پیامک</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        کد ۴ رقمی خودش وارد می‌شود — فقط پیامک فیتاپ خوانده می‌شود.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={acceptSmsAutoRead}
                      className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition active:scale-95 hover:shadow-md"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                    >
                      فعال‌سازی
                    </button>
                    <button
                      type="button"
                      onClick={declineSmsAutoRead}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 transition active:scale-95 hover:bg-slate-50"
                    >
                      خودم وارد می‌کنم
                    </button>
                  </div>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 4}
                className="w-full h-14 rounded-2xl text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/40 disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-lg flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    در حال تأیید...
                  </span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    تأیید و ورود
                  </>
                )}
              </button>

              {/* Resend + change number */}
              <div className="flex flex-col items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendIn > 0 || sending}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 disabled:text-slate-400 disabled:cursor-not-allowed transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${sending ? "animate-spin" : ""}`} />
                  {resendIn > 0
                    ? `ارسال مجدد کد (${resendIn} ثانیه)`
                    : "ارسال مجدد کد"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("mobile");
                    setCode("");
                    setError("");
                    setResendIn(0);
                    setValidityIn(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 transition"
                >
                  تغییر شماره موبایل
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="px-6 pb-6 text-center text-xs text-slate-400">
        با ورود، شما{" "}
        <button
          onClick={() => { setScreen("terms"); pushScreen("terms"); }}
          className="font-bold text-orange-600 hover:text-orange-700 underline underline-offset-2"
        >
          شرایط و قوانین
        </button>{" "}
        فیتاپ را می‌پذیرید.
      </div>
    </div>
  );
}
