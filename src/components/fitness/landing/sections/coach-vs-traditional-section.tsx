"use client";

import { Check, X, Bot, User, Clock, Wallet, Zap, Heart, Brain } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { smartNavigate } from "@/lib/fitness/navigation";

const COMPARISONS = [
  {
    icon: Clock,
    traditional: "فقط در ساعات مشخصی در دسترس",
    fitup: "۲۴ ساعت شبانه‌روز، ۷ روز هفته",
    color: "text-orange-500",
  },
  {
    icon: Wallet,
    traditional: "هزینه ماهانه ۲-۵ میلیون تومان",
    fitup: "از ۳۵۰ هزار تومان برای ۴۵ روز",
    color: "text-emerald-500",
  },
  {
    icon: Brain,
    traditional: "تجربه محدود به یک نفر",
    fitup: "هوش مصنوعی با دانش هزاران مربی",
    color: "text-violet-500",
  },
  {
    icon: Zap,
    traditional: "پاسخ در جلسه بعدی",
    fitup: "پاسخ فوری و آنی",
    color: "text-amber-500",
  },
  {
    icon: Heart,
    traditional: "نظرات ذهنی و متغیر",
    fitup: "بررسی علمی و داده‌محور",
    color: "text-rose-500",
  },
  {
    icon: User,
    traditional: "بدون آنالیز بدن و آزمایش",
    fitup: "آنالیز ویدیویی + آزمایش خون + عکس",
    color: "text-cyan-500",
  },
];

export function CoachVsTraditionalSection() {
  const { user, setScreen } = useAppStore();

  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-orange-50/30 to-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-orange-100/30 blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-amber-100/30 blur-3xl" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
        {/* Header */}
        <div
          className="animate-fade-in-up text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4 bg-orange-100 text-orange-600">
            <Zap className="w-4 h-4" />
            چرا فیتاپ؟
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
            مربی سنتی یا{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #f59e0b, #f97316)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              فیتاپ هوشمند؟
            </span>
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
            تفاوت را خودت ببین — هوش مصنوعی فیتاپ طبق الگوی بزرگترین مربیان بدنسازی دنیا آموزش دیده و ۲۴ ساعت کنارت است، با کسری از هزینه
          </p>
        </div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {/* مربی سنتی */}
          <div
            className="animate-slide-in-right rounded-3xl bg-white border-2 border-slate-200 p-6 relative overflow-hidden"
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-slate-100/50 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-slate-500" />
                </div>
                <div>
                  <h3 className="font-black text-slate-700 text-lg">مربی سنتی</h3>
                  <p className="text-[11px] text-slate-500">روش قدیمی</p>
                </div>
              </div>
              <div className="space-y-3">
                {COMPARISONS.map((c, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-3 h-3 text-red-400" strokeWidth={3} />
                    </div>
                    <span className="text-xs text-slate-500 leading-relaxed">{c.traditional}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* فیتاپ هوشمند */}
          <div
            className="animate-slide-in-right anim-delay-100 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-orange-200 p-6 relative overflow-hidden shadow-lg"
          >
            <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-orange-200/40 blur-2xl" />
            <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-amber-200/40 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                >
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">فیتاپ هوشمند</h3>
                  <p className="text-[11px] text-orange-500">آینده تناسب اندام</p>
                </div>
              </div>
              <div className="space-y-3">
                {COMPARISONS.map((c, i) => (
                  <div
                    key={i}
                    style={{ animationDelay: `${0.2 + i * 0.05}s` }}
                    className="animate-slide-in-right flex items-start gap-2.5"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <c.icon className={`w-3.5 h-3.5 ${c.color} shrink-0`} />
                      <span className="text-xs text-slate-700 font-medium leading-relaxed">{c.fitup}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div
          className="animate-fade-in-up anim-delay-300 text-center"
        >
          <button
            onClick={() => smartNavigate(!!user, setScreen, user?.onboardingDone)}
            className="inline-block rounded-2xl px-8 py-4 text-white font-bold text-sm shadow-xl transition hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            هر بدنی فیتاپ میخواد — از امروز شروع کن
          </button>
        </div>
      </div>
    </section>
  );
}
