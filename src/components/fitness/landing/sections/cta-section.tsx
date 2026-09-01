"use client";

import { Zap, ChevronLeft, Sparkles, Clock, UserCheck, Video } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { pushScreen, smartNavigate } from "@/lib/fitness/navigation";

export function CtaSection() {
  const { user, setScreen } = useAppStore();

  return (
    <section className="py-20 sm:py-28 bg-white relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="animate-scale-in relative overflow-hidden rounded-[2.5rem] p-8 sm:p-14 text-center text-white shadow-2xl"
          style={{ background: "linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ea580c 100%)" }}
        >
          {/* Decorative elements */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/10" />
          <div className="absolute top-1/2 left-1/4 w-24 h-24 rounded-full bg-white/5" />

          {/* shimmer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
              animation: "gold-shimmer 4s infinite linear",
            }}
          />

          <div className="relative">
            <div
              className="animate-scale-in inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-6"
            >
              <Sparkles className="w-8 h-8 text-white" />
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight">
              امروز اولین قدم را بردار
            </h2>
            <p className="text-lg text-white/95 max-w-2xl mx-auto mb-8 leading-relaxed">
              به هزاران ورزشکار ایرانی بپیوند که با فیتاپ به اهداف تناسب اندام خود رسیده‌اند.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <button
                onClick={() => smartNavigate(!!user, setScreen, user?.onboardingDone)}
                className="bg-white text-orange-600 hover:bg-white/90 rounded-2xl h-14 px-8 text-base font-black shadow-xl transition hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                ورود
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-white/95">
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full">
                <Clock className="w-4 h-4" />
                ثبت‌نام در ۳۰ ثانیه
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full">
                <UserCheck className="w-4 h-4" />
                تحت نظارت مربیان حرفه‌ای
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full">
                <Video className="w-4 h-4" />
                تحلیل ویدیویی فرم حرکات با هوش مصنوعی
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
