"use client";

import Script from "next/script";
import { motion } from "framer-motion";
import { BadgeCheck, ShieldCheck, ExternalLink } from "lucide-react";
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * بج «Preferred Source» گوگل — دعوت از خواننده مقاله برای ثبت فیتاپ به‌عنوان
 * «منبع مورد اعتماد» در گوگل؛ باعث برجسته‌شدن محتوای تازه‌ی سایت در
 * AI Overviews و Top Stories همان کاربر می‌شود (۲× نرخ کلیک — اعلام رسمی گوگل).
 *
 * پیاده‌سازی طبق مستندات رسمی گوگل — «روش ۲: کنترل برنامه‌نویسی‌شده»:
 *   ۱) اسکریپت async news.google.com/swg/js/v1/publisher.js
 *   ۲) div کنترل با اتریبیوت‌های google-add-preferred-source-btn +
 *      preferred-sources-control="manual" (جلوی رندر خودکار گرفته می‌شود)
 *   ۳) ثبت کال‌بک در صف رسمی self.PREFERRED_SOURCE — دسترسی به API گوگل
 *   ۴) دکمه‌ی سفارشی همیشه دیده می‌شود؛ کلیک → preferredSource.addPreferredSource()
 *      و اگر اسکریپت گوگل هنوز آماده نبود، روش ۳ رسمی (لینک مستقیم
 *      google.com/preferences/source?q=دامنه) به‌صورت fallback اجرا می‌شود —
 *      یعنی دکمه در هیچ شرایطی «مرده» نیست.
 *
 * جایگاه ثابت: انتهای هر مقاله — طبق راهنمای رسمی گوگل بهترین لحظه‌ی دعوت
 * همین‌جاست که خواننده محتوا را مفید یافته است.
 */

interface PreferredSourceApi {
  init: (config: { theme?: "light" | "dark"; lang?: string }) => void;
  addPreferredSource: () => void;
}

declare global {
  interface Window {
    PREFERRED_SOURCE?: Array<(api: PreferredSourceApi) => void>;
  }
}

// ─── ثبت صفِ کال‌بک در سطح ماژول (فقط یک‌بار) ───
// الگوی رسمی analytics-queue: اگر publisher.js دیرتر لود شود، کال‌بک در صف
// می‌ماند و اسکریپت آن را فراخوانی می‌کند؛ اگر زودتر لود شده باشد، push
// بلافاصله اجرا می‌شود. هر دو حالت پوشش داده شده است.
let preferredSourceApi: PreferredSourceApi | null = null;
if (typeof window !== "undefined") {
  const w = window as Window;
  w.PREFERRED_SOURCE = w.PREFERRED_SOURCE || [];
  w.PREFERRED_SOURCE.push((api) => {
    preferredSourceApi = api;
    try {
      const theme =
        document.documentElement.classList.contains("dark") ? "dark" : "light";
      api.init({ theme, lang: "fa" });
    } catch {
      // init اختیاری است — خطای آن جریان اصلی را نمی‌شکند
    }
  });
}

export function PreferredSourceCard() {
  const controlRef = useRef<HTMLDivElement | null>(null);

  // اتریبیوت‌های سفارشی گوگل را دستی روی DOM می‌گذاریم —
  // React اتریبیوت‌های ناشناخته را از JSX عبور نمی‌دهد (اخطار کنسول + حذف attr).
  useEffect(() => {
    const el = controlRef.current;
    if (el) {
      el.setAttribute("google-add-preferred-source-btn", "");
      el.setAttribute("preferred-sources-control", "manual");
    }
  }, []);

  // کلیک: روش ۲ (فرایند درون‌صفحه‌ای گوگل — بدون خروج از سایت)
  // و در نبود آن، روش ۳ رسمی (لینک مستقیم) — دکمه همیشه کار می‌کند.
  const handleAddPreferred = () => {
    if (preferredSourceApi) {
      try {
        preferredSourceApi.addPreferredSource();
        return;
      } catch {
        // خطا در فرایند درون‌صفحه‌ای → fallback به لینک مستقیم
      }
    }
    const domain = window.location.hostname;
    window.open(
      `https://www.google.com/preferences/source?q=${encodeURIComponent(domain)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <>
      <Script
        src="https://news.google.com/swg/js/v1/publisher.js"
        strategy="afterInteractive"
      />
      {/* div کنترل گوگل (روش ۲) — با manual رندر خودکار ندارد و همیشه خالی و امن است (رندر خودکار غیرفعال) */}
      <div ref={controlRef} aria-hidden="true" />
      {/* ─── انیمیشن mount-time (نه whileInView) ───
          whileInView وابسته به IntersectionObserver است؛ اگر به هر دلیل
          observer اجرا نشود (WebView قدیمی، پرینت، اسکرول سریع) کارت با
          opacity:0 نامرئی می‌ماند. animate از لحظه mount اجرا می‌شود. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        dir="rtl"
        className="mt-8 relative rounded-2xl bg-gradient-to-l from-orange-50 via-white to-amber-50 border-2 border-orange-200/70 p-5 sm:p-6 overflow-hidden"
        role="complementary"
        aria-label="ثبت فیتاپ به‌عنوان منبع مورد اعتماد در گوگل"
      >
        {/* هاله تزئینی */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-orange-200/30 blur-2xl" aria-hidden="true" />
        <div className="absolute -bottom-12 -left-8 w-28 h-28 rounded-full bg-amber-200/20 blur-2xl" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
              <BadgeCheck className="w-5 h-5 text-white" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                فیتاپ را منبع مورد اعتماد خودتان در گوگل ثبت کنید
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-relaxed">
                با یک کلیک، مقالات تازه‌ی ما در نتایج هوش مصنوعی و Top Stories گوگل برای شما برجسته می‌شود.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-orange-100 flex flex-col items-center gap-2.5">
            {/* دکمه‌ی سفارشی (روش ۲ رسمی) — همیشه نمایان و فعال */}
            <Button
              type="button"
              onClick={handleAddPreferred}
              className="h-11 px-6 rounded-xl bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 gap-2"
            >
              <ShieldCheck className="w-4.5 h-4.5" />
              افزودن فیتاپ به منابع مورد اعتماد گوگل
            </Button>
            <p className="text-[10.5px] text-slate-400 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              تأیید سریع با حساب گوگل شما — بدون خروج از این صفحه
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
