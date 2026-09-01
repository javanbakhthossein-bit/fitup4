"use client";

import { UserPlus, ClipboardList, Dumbbell, TrendingUp } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { pushScreen, smartNavigate } from "@/lib/fitness/navigation";

const STEPS = [
  {
    icon: UserPlus,
    step: "۱",
    title: "ثبت‌نام آنی",
    desc: "فقط با شماره موبایل و رمز عبور ثبت‌نام کنید. بدون ارسال پیامک، بدون منتظر ماندن — کاملاً آنی.",
  },
  {
    icon: ClipboardList,
    step: "۲",
    title: "تکمیل آنبوردینگ",
    desc: "اطلاعات فیزیکی، هدف، تجهیزات، آسیب‌دیدگی‌ها و رژیم غذایی خود را وارد کنید. هوش مصنوعی همه را تحلیل می‌کند.",
  },
  {
    icon: Dumbbell,
    step: "۳",
    title: "دریافت برنامه هوشمند",
    desc: "هوش مصنوعی در چند ثانیه برنامه تمرینی هفتگی و غذایی روزانه کاملاً شخصی‌سازی‌شده برای شما می‌سازد.",
  },
  {
    icon: TrendingUp,
    step: "۴",
    title: "تمرین و پیشرفت",
    desc: "برنامه را دنبال کنید، با مربی AI چت کنید، وزن خود را ثبت کنید و پیشرفتتان را در نمودار ببینید.",
  },
];

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

export function HowItWorksSection() {
  const { user, setScreen } = useAppStore();

  return (
    <section id="how" className="py-20 sm:py-28 bg-white border-y border-orange-100 relative overflow-hidden">
      {/* subtle gold tinted blobs */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-orange-200/20 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="animate-fade-in-up text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-orange-200 text-orange-600 text-sm font-medium mb-4">
            ساده و سریع
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 text-slate-900">
            فقط <span className="text-transparent bg-clip-text" style={{ backgroundImage: goldGradient }}>۴ قدم</span> تا شروع
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            در کمتر از ۵ دقیقه ثبت‌نام کنید و برنامه اختصاصی خود را دریافت کنید.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connecting gold gradient line */}
          <div
            className="hidden lg:block absolute top-12 right-[12.5%] left-[12.5%] h-0.5"
            style={{ background: "linear-gradient(to left, rgba(245,158,11,0.4), rgba(249,115,22,0.2), rgba(245,158,11,0.4))" }}
          />

          {STEPS.map((step, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 0.15}s` }}
              className="animate-fade-in-up relative text-center"
            >
              {/* Card body */}
              <div className="bg-white border-2 border-orange-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-300 transition-all duration-300 relative">
                <div className="relative inline-flex mb-4">
                  {/* Icon with gold gradient */}
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-500/20 relative z-10"
                    style={{ background: goldGradient }}
                  >
                    <step.icon className="w-9 h-9 text-white" />
                  </div>
                  {/* Step number circle */}
                  <span
                    className="absolute -top-2 -left-2 w-8 h-8 rounded-full text-white text-sm font-black flex items-center justify-center z-20 shadow-lg ring-4 ring-white"
                    style={{ background: goldGradient }}
                  >
                    {step.step}
                  </span>
                </div>
                <h3 className="font-bold text-lg mb-2 text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="animate-fade-in-up text-center mt-12"
        >
          <button
            onClick={() => smartNavigate(!!user, setScreen, user?.onboardingDone)}
            className="inline-flex items-center justify-center gap-2 h-14 px-8 text-base font-bold text-white rounded-2xl shadow-xl shadow-orange-500/30 hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/40 transition-all duration-200"
            style={{ background: goldGradient }}
          >
            همین حالا شروع کن
          </button>
          <p className="text-xs text-slate-500 mt-3">
            بدون هزینه اولیه — امروز اولین قدم را بردار
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            برنامه اختصاصی شما با هوش مصنوعی در کمتر از ۲ دقیقه ساخته می‌شود
          </p>
        </div>
      </div>
    </section>
  );
}
