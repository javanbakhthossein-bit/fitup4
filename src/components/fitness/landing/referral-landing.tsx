"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  ChevronLeft,
  Zap,
  Gift,
  Dumbbell,
  Apple,
  MessageCircle,
  Wallet,
  ShieldCheck,
  Bot,
  Clock,
  Check,
  Star,
  TrendingUp,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { pushScreen } from "@/lib/fitness/navigation";
import { toPersianDigits } from "@/lib/fitness/types";
import { Button } from "@/components/ui/button";

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

interface ReferralInfo {
  valid: boolean;
  referrerName?: string;
  rewardAmount?: number;
}

export function ReferralLanding({ refCode }: { refCode: string }) {
  const { setScreen } = useAppStore();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // --- بارگذاری اطلاعات رفرال از API عمومی ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/referral/info?code=${encodeURIComponent(refCode)}`);
        const data = (await res.json()) as ReferralInfo;
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled) setInfo({ valid: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refCode]);

  // در حال بارگذاری — skeleton ساده
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg animate-pulse"
            style={{ background: goldGradient }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover rounded-2xl" />
          </div>
          <p className="text-sm text-orange-700 font-medium">در حال آماده‌سازی...</p>
        </div>
      </div>
    );
  }

  // اگر کد معتبر نبود — به کاربر اطلاع بده ولی همچنان امکان ثبت‌نام بده
  const isValid = info?.valid === true;
  const referrerName = info?.referrerName || "کاربر فیتاپ";
  const rewardAmount = info?.rewardAmount ?? 150000;

  function goToAuth() {
    setScreen("auth");
    pushScreen("auth");
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden" dir="rtl">
      {/* ============== HERO ============== */}
      <section className="relative overflow-hidden">
        {/* پس‌زمینه گرادیان نارنجی */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 40%, #fed7aa 100%)" }}
        />
        {/* لکه‌های دکوراتیو */}
        <div className="absolute top-10 right-1/4 w-96 h-96 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-orange-400/20 blur-3xl" />

        {/* Nav خلاصه */}
        <header className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2.5"
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden"
                style={{ background: goldGradient }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col leading-none">
                <span
                  className="font-black text-xl"
                  style={{
                    background: goldGradient,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  فیتاپ
                </span>
                <span className="text-[10px] text-orange-700/80 mt-0.5">هر بدنی فیتاپ میخواد</span>
              </div>
            </button>

            <Button
              size="sm"
              onClick={goToAuth}
              className="rounded-xl shadow-md text-white"
              style={{ background: goldGradient }}
            >
              ورود
            </Button>
          </div>
        </header>

        {/* محتوای hero */}
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-20 sm:pt-16 sm:pb-28 text-center">
          {/* بج دعوت */}
          <div
            className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-6 bg-white shadow-sm border border-orange-200"
            style={{ color: "#c2410c" }}
          >
            <Gift className="w-4 h-4" />
            {isValid ? "دعوت‌نامه‌ی ویژه فیتاپ" : "به فیتاپ خوش آمدید"}
          </div>

          {/* عنوان بزرگ */}
          <h1
            className="animate-fade-in-up anim-delay-100 text-3xl sm:text-5xl font-black leading-tight mb-4 text-slate-900"
          >
            دوستت تو{" "}
            <span
              style={{
                background: goldGradient,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              فیتاپ
            </span>{" "}
            منتظرته! 🎁
          </h1>

          {/* زیرعنوان */}
          <p
            className="animate-fade-in-up anim-delay-200 text-base sm:text-xl text-slate-700 leading-relaxed mb-2 max-w-2xl mx-auto"
          >
            {isValid ? (
              <>
                <span className="font-bold text-orange-700">{referrerName}</span> شما را به فیتاپ دعوت کرده است.
              </>
            ) : (
              <>اولین پلتفرم تخصصی طراحی برنامه بدنسازی با هوش مصنوعی در ایران.</>
            )}
          </p>

          <p
            className="animate-fade-in-up anim-delay-300 text-sm sm:text-lg text-slate-600 leading-relaxed mb-8 max-w-2xl mx-auto"
          >
            با کد معرفی{" "}
            <span className="font-black font-stat px-2.5 py-1 rounded-lg bg-white border-2 border-orange-300 text-orange-700 shadow-sm">
              {refCode}
            </span>{" "}
            ثبت‌نام کن و{" "}
            <span className="font-black text-orange-700 whitespace-nowrap">
              {toPersianDigits(rewardAmount.toLocaleString("en-US"))} تومان
            </span>{" "}
            پاداش بگیر!
          </p>

          {/* CTA اصلی */}
          <div
            className="animate-fade-in-up anim-delay-300 flex flex-col sm:flex-row gap-3 justify-center mb-8"
          >
            <button
              onClick={goToAuth}
              className="rounded-2xl h-14 px-8 text-base font-bold flex items-center justify-center gap-2 text-white shadow-xl transition hover:scale-[1.02]"
              style={{
                background: goldGradient,
                boxShadow: "0 12px 30px -8px rgba(249, 115, 22, 0.55)",
              }}
            >
              <Zap className="w-5 h-5" />
              شروع کنید — رایگان
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* نشانه‌های اعتماد زیر CTA */}
          <div
            className="animate-fade-in anim-delay-400 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-600"
          >
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              با تجربه بهترین مربیان
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              شخصی‌سازی با AI
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              پشتیبانی ۲۴ ساعته
            </span>
          </div>
        </div>

        {/* انحنا برای اتصال نرم به بخش بعدی */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          style={{ height: "60px" }}
        >
          <path
            fill="#ffffff"
            d="M0,40 C360,80 1080,80 1440,40 L1440,80 L0,80 Z"
          />
        </svg>
      </section>

      {/* ============== BENEFITS ============== */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <div
              className="animate-fade-in-up inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3 bg-orange-50 text-orange-700 border border-orange-100"
            >
              <Sparkles className="w-3.5 h-3.5" />
              چرا فیتاپ؟
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
              همه چی برای رسیدن به هدف تو
            </h2>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">
              فیتاپ با ترکیب هوش مصنوعی و دانش تخصصی بدنسازی، تجربه‌ای کاملاً شخصی برای تو می‌سازد.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BenefitCard
              icon={Dumbbell}
              title="برنامه تمرینی شخصی‌سازی‌شده با AI"
              desc="بر اساس سن، وزن، هدف و تجهیزات در دسترس، یک برنامه تمرینی منحصربه‌فرد برای تو طراحی می‌کنیم."
              delay={0}
            />
            <BenefitCard
              icon={Apple}
              title="برنامه غذایی هوشمند"
              desc="رژیم غذایی متناسب با هدف و سلیقه‌ی تو — با امکان جایگزینی غذا و محاسبه‌ی دقیق ماکروها."
              delay={0.05}
            />
            <BenefitCard
              icon={MessageCircle}
              title="چت ۲۴ ساعته با مربی هوشمند"
              desc="هر زمان سوال داشتی، نیکا، مربی هوشمند فیتاپ، ۲۴ ساعته پاسخگوی توست — بدون انتظار و بدون محدودیت."
              delay={0.1}
            />
            <BenefitCard
              icon={Gift}
              title={`پاداش ${toPersianDigits(rewardAmount.toLocaleString("en-US"))} تومان`}
              desc="با ثبت‌نام از طریق این لینک و خرید اولین پلن، هم تو و هم دوستت پاداش می‌گیرید!"
              delay={0.15}
              highlight
            />
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section
        className="py-16 sm:py-20"
        style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)" }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div
              className="animate-fade-in-up inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3 bg-white text-orange-700 border border-orange-200"
            >
              <Zap className="w-3.5 h-3.5" />
              شروع آسان
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              فقط ۳ قدم تا پاداش
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 relative">
            {/* خط اتصال بین مراحل (روی دسکتاپ) */}
            <div className="hidden sm:block absolute top-8 right-[16%] left-[16%] h-0.5 border-t-2 border-dashed border-orange-300" />

            <StepCard
              num={1}
              icon={Wallet}
              title="ثبت‌نام با شماره موبایل"
              desc="با شماره موبایلت وارد شو — کد معرفت به‌صورت خودکار ثبت می‌شود."
            />
            <StepCard
              num={2}
              icon={Dumbbell}
              title="خرید اولین پلن"
              desc="پلن متناسب با هدفت رو انتخاب کن و فعال کن."
            />
            <StepCard
              num={3}
              icon={Gift}
              title="دریافت پاداش در کیف پول"
              desc={
                <>
                  <span className="font-bold text-orange-700">
                    {toPersianDigits(rewardAmount.toLocaleString("en-US"))} تومان
                  </span>{" "}
                  به کیف پولت اضافه می‌شه — برای هم تو، هم دوستت!
                </>
              }
            />
          </div>
        </div>
      </section>

      {/* ============== TRUST SIGNALS ============== */}
      <section className="py-12 bg-white border-y border-orange-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <TrustItem icon={Bot} title="ساخته‌شده توسط برترین مربیان" desc="هوش مصنوعی آموزش‌دیده طبق الگوی بزرگترین مربیان بدنسازی دنیا" />
          <TrustItem icon={TrendingUp} title="شخصی‌سازی با AI" desc="هوش مصنوعی برنامه‌ای منحصربه‌فرد برای تو می‌سازد" />
          <TrustItem icon={Clock} title="پشتیبانی ۲۴ ساعته" desc="مربی هوشمند همیشه و همه‌جا در دسترس توست" />
        </div>
      </section>

      {/* ============== TESTIMONIAL / SOCIAL PROOF ============== */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-1 mb-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            هزاران ورزشکار به ما اعتماد کرده‌اند
          </p>
          <p className="text-sm text-slate-600">
            با میانگین رضایت ۴.۹ از ۵، فیتاپ مورد اعتماد جامعه‌ی بدنسازی ایران است.
          </p>
        </div>
      </section>

      {/* ============== CTA ============== */}
      <section
        className="py-20 sm:py-24 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)" }}
      >
        {/* لکه‌های دکوراتیو */}
        <div className="absolute top-0 left-1/4 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div
            className="animate-scale-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-5 bg-white/20 text-white backdrop-blur"
          >
            <Gift className="w-4 h-4" />
            همین حالا ثبت‌نام کن و پاداشت رو بگیر
          </div>

          <h2
            className="animate-fade-in-up text-3xl sm:text-5xl font-black text-white mb-4 leading-tight"
          >
            هم‌اکنون سفر تناسب‌اندامت رو شروع کن!
          </h2>

          <p
            className="animate-fade-in-up anim-delay-100 text-base sm:text-lg text-white/90 mb-8 max-w-xl mx-auto"
          >
            {isValid ? (
              <>
                کد معرفت ثبت شده — فقط کافیه ثبت‌نام کنی، پلنت رو بخری و{" "}
                <span className="font-black">
                  {toPersianDigits(rewardAmount.toLocaleString("en-US"))} تومان
                </span>{" "}
                پاداش بگیری.
              </>
            ) : (
              // کد معتبر نیست — ادعای ثبت کد معرف نکن (پیام خنثی)
              <>
                فقط کافیه ثبت‌نام کنی و سفر تناسب‌اندامت رو با برنامه اختصاصی{" "}
                <span className="font-black">فیتاپ</span> شروع کنی.
              </>
            )}
          </p>

          <button
            className="animate-fade-in-up anim-delay-200 rounded-2xl h-16 px-10 text-lg font-bold flex items-center justify-center gap-2 text-orange-700 bg-white shadow-2xl transition hover:scale-[1.02] mx-auto"
            onClick={goToAuth}
          >
            <Zap className="w-5 h-5" />
            همین حالا شروع کنید
            <ChevronLeft className="w-5 h-5" />
          </button>

          <p className="text-xs text-white/80 mt-5">
            ثبت‌نام رایگان است · بدون نیاز به کارت بانکی برای شروع
          </p>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="bg-white py-8 border-t border-orange-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md overflow-hidden"
              style={{ background: goldGradient }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-base text-slate-900">فیتاپ</span>
              <span className="text-[10px] text-slate-500 mt-0.5">هر بدنی فیتاپ میخواد</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              پرداخت امن
            </span>
            <span className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-orange-500" />
              مربی هوشمند
            </span>
          </div>

          <p className="text-xs text-slate-400">© ۱۴۰۵ فیتاپ</p>
        </div>
      </footer>
    </div>
  );
}

// --- Sub-components ---

function BenefitCard({
  icon: Icon,
  title,
  desc,
  delay,
  highlight,
}: {
  icon: any;
  title: string;
  desc: string;
  delay: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{ animationDelay: `${delay}s` }}
      className={`animate-fade-in-up p-5 rounded-2xl border transition hover:shadow-lg ${
        highlight
          ? "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200"
          : "bg-white border-slate-100"
      }`}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-md"
        style={{ background: highlight ? goldGradient : "linear-gradient(135deg, #fff7ed, #ffedd5)" }}
      >
        <Icon className={`w-6 h-6 ${highlight ? "text-white" : "text-orange-600"}`} />
      </div>
      <h3 className="font-bold text-base text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({
  num,
  icon: Icon,
  title,
  desc,
}: {
  num: number;
  icon: any;
  title: string;
  desc: React.ReactNode;
}) {
  return (
    <div
      style={{ animationDelay: `${num * 0.1}s` }}
      className="animate-fade-in-up relative bg-white rounded-2xl p-5 shadow-md border border-orange-100 text-center"
    >
      {/* شماره مرحله */}
      <div className="absolute -top-4 right-1/2 translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg" style={{ background: goldGradient }}>
        {toPersianDigits(num)}
      </div>

      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 mt-3 shadow-sm mx-auto"
        style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)" }}
      >
        <Icon className="w-7 h-7 text-orange-600" />
      </div>
      <h3 className="font-bold text-base text-slate-900 mb-1.5">{title}</h3>
      <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function TrustItem({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 p-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
        style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)" }}
      >
        <Icon className="w-6 h-6 text-orange-600" />
      </div>
      <h4 className="font-bold text-sm text-slate-900">{title}</h4>
      <p className="text-xs text-slate-600">{desc}</p>
    </div>
  );
}
