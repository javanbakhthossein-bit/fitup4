"use client";

import { useState } from "react";
import { Dumbbell, ShieldCheck, ExternalLink, MessageSquare, Phone, Smartphone, MapPin } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { FeedbackModal } from "@/components/fitness/feedback-modal";
import { pushScreen, smartNavigate } from "@/lib/fitness/navigation";

export function LandingFooter() {
  const { user, setScreen } = useAppStore();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // اسکرول با آفست هدر ثابت (h-16) — همان الگوی landing-nav؛ لینک‌های
  // #hash خام زیر هدر ثابت فرود می‌آمدند (getBoundingClientRect همیشه
  // نسبت به سند درست است، حتی اگر offsetParent تغییر کند)
  function scrollToSection(href: string) {
    const el = document.querySelector(href) as HTMLElement | null;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: "smooth" });
  }

  const anchorProps = (href: string) => ({
    href,
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      scrollToSection(href);
    },
  });

  return (
    <footer className="border-t border-orange-100 bg-white mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-3 justify-center md:justify-start">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md overflow-hidden"
                style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
              </div>
              <span className="font-black text-lg text-slate-900">فیتاپ</span>
            </div>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed text-center md:text-right mx-auto md:mx-0">
              اپلیکیشن جامع تناسب اندام با هوش مصنوعی. هر بدنی فیتاپ میخواد — برنامه تمرینی و غذایی کاملاً شخصی‌سازی‌شده، با تجربه بهترین مربیان ایران.
            </p>
            {/* آدرس */}
            <div className="mt-3 flex items-start gap-2 justify-center md:justify-start max-w-xs mx-auto md:mx-0">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                تهران، شریعتی، خیابان صمدی، خیابان یعقوبی، کوچه شفا، پلاک ۱۰، واحد ۴
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-sm mb-3 text-slate-900">دسترسی سریع</h3>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button onClick={() => smartNavigate(!!user, setScreen, user ? user.onboardingDone : undefined)} className="hover:text-orange-600 transition">ورود / ثبت‌نام</button></li>
              <li><a {...anchorProps("#features")} className="hover:text-orange-600 transition">امکانات</a></li>
              <li><a {...anchorProps("#tools")} className="hover:text-orange-600 transition">ابزارهای رایگان</a></li>
              <li><a {...anchorProps("#pricing")} className="hover:text-orange-600 transition">اشتراک‌ها</a></li>
              <li><a {...anchorProps("#faq")} className="hover:text-orange-600 transition">سوالات متداول</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-sm mb-3 text-slate-900">قوانین و پشتیبانی</h3>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <button
                  onClick={() => { setScreen("terms"); pushScreen("terms"); }}
                  className="flex items-center gap-1.5 hover:text-orange-600 transition font-medium"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
                  شرایط و قوانین
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </button>
              </li>
              <li>
                <button onClick={() => { setScreen("terms"); pushScreen("terms"); }} className="hover:text-orange-600 transition">
                  حریم خصوصی
                </button>
              </li>
              <li><button onClick={() => setFeedbackOpen(true)} className="hover:text-orange-600 transition">پیشنهادات</button></li>
              <li><button onClick={() => { setScreen("contact"); pushScreen("contact"); }} className="hover:text-orange-600 transition">تماس با ما</button></li>
            </ul>
            {/* شماره‌های تماس — موبایل اول */}
            <div className="mt-4 pt-3 border-t border-orange-100 space-y-1.5">
              <a href="tel:09300083803" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-600 transition">
                <Smartphone className="w-3 h-3 text-orange-500" />
                <span dir="ltr">۰۹۳۰-۰۰۸۳۸۰۳</span>
              </a>
              <a href="tel:02155871576" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-600 transition">
                <Phone className="w-3 h-3 text-orange-500" />
                <span dir="ltr">۰۲۱-۵۵۸۷۱۵۷۶</span>
              </a>
            </div>
          </div>
        </div>

        {/* Prominent T&C banner */}
        <div
          className="rounded-2xl px-5 py-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)", border: "1px solid #fed7aa" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">شرایط و قوانین فیتاپ را مطالعه کنید</p>
              <p className="text-xs text-slate-600">قبل از ثبت‌نام، حتماً قوانین و حریم خصوصی را بررسی کنید</p>
            </div>
          </div>
          <button
            onClick={() => { setScreen("terms"); pushScreen("terms"); }}
            className="shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02] shadow-md"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            مشاهده قوانین
          </button>
        </div>

        <div className="pt-8 border-t border-orange-100 flex flex-col items-center gap-4">
          {/* پشتیبانی از طریق بله */}
          <a
            href="https://ble.ir/hossein_javanbakht"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02] shadow-md"
            style={{ background: "linear-gradient(135deg, #2196F3, #1976D2)" }}
          >
            {/* آیکون بله */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM16.5 9.5C16.5 12.5 13.5 14.5 10.5 14.5C9.5 14.5 8.5 14.3 7.8 13.9C7.5 14.2 7 14.5 6.5 14.7C6.3 14.8 6 14.7 5.9 14.4C5.8 14.1 5.9 13.9 6.2 13.8C6.5 13.7 6.9 13.5 7.2 13.2C6.9 12.9 6.7 12.5 6.6 12C6.5 11.5 6.5 11 6.5 10.5C6.5 8 9 6 12 6C15 6 16.5 7.5 16.5 9.5Z" fill="white"/>
            </svg>
            پشتیبانی از طریق تیم فنی (بله)
          </a>

          {/* نماد اعتماد الکترونیک (اینماد) */}
          <a
            referrerPolicy="origin"
            target="_blank"
            href="https://trustseal.enamad.ir/?id=755385&Code=PDbEnyZC9a4cNeLkP8AFk05oTEq9LCL0"
            className="inline-flex items-center justify-center rounded-xl bg-white p-2 shadow-sm hover:shadow-md transition border border-orange-100"
            title="نماد اعتماد الکترونیک"
            style={{ width: "120px", height: "120px" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              referrerPolicy="origin"
              src="https://trustseal.enamad.ir/logo.aspx?id=755385&Code=PDbEnyZC9a4cNeLkP8AFk05oTEq9LCL0"
              alt="نماد اعتماد الکترونیق فیتاپ"
              style={{ cursor: "pointer", maxWidth: "100px", maxHeight: "100px" }}
              className="w-full h-full object-contain"
            />
          </a>

          <p className="text-xs text-slate-500 text-center">
            © ۱۴۰۵ فیتاپ
          </p>
          <p className="text-xs font-bold text-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            هر بدنی فیتاپ میخواد
          </p>
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}
