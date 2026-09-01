"use client";

import { Calculator, Dumbbell, Apple, ChevronLeft, Sparkles, Wrench } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { pushScreen } from "@/lib/fitness/navigation";

const TOOLS = [
  {
    id: "tool-tdee" as const,
    icon: Calculator,
    title: "محاسبه‌گر کالری",
    desc: "میزان کالری روزانه (TDEE) و درشت‌مغذی‌های مورد نیازت را بر اساس فرمول هریس-بندیکت دقیق محاسبه کن — کاملاً رایگان و بدون ثبت‌نام.",
    points: ["محاسبه BMR", "کالری هدف", "درشت‌مغذی‌ها"],
    accent: "from-amber-500 to-orange-500",
  },
  {
    id: "tool-exercises" as const,
    icon: Dumbbell,
    title: "بانک حرکات ورزشی",
    desc: "به‌عنوان مرجع کامل، ۲۶۰+ حرکت ورزشی را با فیلتر بر اساس عضله هدف و تجهیزات جستجو کن. شامل آموزش گام‌به‌گام و نکات ایمنی.",
    points: ["۲۶۰+ حرکت", "فیلتر عضله", "آموزش گام‌به‌گام"],
    accent: "from-orange-500 to-red-500",
  },
  {
    id: "tool-foods" as const,
    icon: Apple,
    title: "جدول کالری غذاها",
    desc: "بانک ۱۰۰۰+ غذای ایرانی و بین‌المللی با محاسبه‌گر داینامیک ارزش غذایی — برای هر وزن، کالری و درشت‌مغذی‌ها را آنی ببین.",
    points: ["۱۰۰۰+ غذا", "محاسبه داینامیک", "غذاهای ایرانی"],
    accent: "from-yellow-500 to-amber-500",
  },
];

export function ToolsSection() {
  const { setScreen } = useAppStore();

  return (
    <section id="tools" className="py-20 sm:py-28 bg-white relative overflow-hidden scroll-mt-20">
      {/* subtle background */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 right-0 w-80 h-80 rounded-full bg-amber-100/40 blur-3xl" />
        <div className="absolute bottom-20 left-0 w-80 h-80 rounded-full bg-orange-100/40 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="animate-fade-in-up text-center mb-14"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4"
            style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c" }}
          >
            <Wrench className="w-4 h-4" />
            ابزارهای رایگان فیتاپ
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 text-slate-900">
            بدون ثبت‌نام هم{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #f59e0b, #f97316)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              از ابزارها استفاده کن
            </span>
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            سه ابزار کاربردی کاملاً رایگان برای شروع مسیر تناسب اندام — بدون نیاز به ثبت‌نام. هر زمان خواستی کاملش کنی، ثبت‌نام کن و برنامه اختصاصی بگیر.
          </p>
        </div>

        {/* Desktop grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TOOLS.map((tool, i) => (
            <div
              key={tool.id}
              style={{ animationDelay: `${i * 0.1}s` }}
              className="animate-fade-in-up group relative bg-white rounded-3xl p-6 border-2 border-orange-100 hover:border-orange-300 hover:shadow-2xl hover:shadow-orange-500/10 transition-all overflow-hidden flex flex-col hover:-translate-y-2"
            >
              {/* shimmer on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div
                  className="absolute -inset-x-10 -top-10 h-20 blur-2xl rotate-12"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.18), transparent)",
                  }}
                />
              </div>

              {/* Large gradient icon */}
              <div
                className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${tool.accent} flex items-center justify-center mb-4 shadow-xl group-hover:scale-110 transition-transform`}
                style={{ boxShadow: "0 10px 24px -8px rgba(249, 115, 22, 0.5)" }}
              >
                <tool.icon className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>

              <h3 className="font-black text-lg mb-2 text-slate-900">{tool.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">{tool.desc}</p>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {tool.points.map((p, j) => (
                  <span
                    key={j}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-100"
                  >
                    {p}
                  </span>
                ))}
              </div>

              <button
                onClick={() => { setScreen(tool.id); pushScreen(tool.id, { tool: tool.id.replace("tool-", "") }); }}
                className="w-full rounded-2xl h-12 font-bold text-sm text-white transition hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  boxShadow: "0 10px 22px -8px rgba(249, 115, 22, 0.45)",
                }}
              >
                <Sparkles className="w-4 h-4" />
                استفاده رایگان
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Mobile: horizontal scroll cards */}
        <div className="md:hidden -mx-4 px-4">
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-3" style={{ touchAction: "pan-x pan-y" }}>
            {TOOLS.map((tool, i) => (
              <div
                key={tool.id}
                className="shrink-0 w-[85vw] max-w-[300px] group relative bg-white rounded-3xl p-5 border-2 border-orange-100 hover:border-orange-300 transition-all overflow-hidden flex flex-col"
              >
                <div
                  className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.accent} flex items-center justify-center mb-3 shadow-xl`}
                  style={{ boxShadow: "0 10px 24px -8px rgba(249, 115, 22, 0.5)" }}
                >
                  <tool.icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                </div>

                <h3 className="font-black text-base mb-2 text-slate-900">{tool.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-3 flex-1">{tool.desc}</p>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tool.points.map((p, j) => (
                    <span
                      key={j}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-100"
                    >
                      {p}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => { setScreen(tool.id); pushScreen(tool.id, { tool: tool.id.replace("tool-", "") }); }}
                  className="w-full rounded-2xl h-11 font-bold text-xs text-white transition hover:scale-[1.02] flex items-center justify-center gap-2 shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #f97316)",
                    boxShadow: "0 10px 22px -8px rgba(249, 115, 22, 0.45)",
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  استفاده رایگان
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] text-slate-500 mt-1">← برای مشاهده بیشتر بکشید →</p>
        </div>

        {/* Bottom note */}
        <div
          className="animate-fade-in text-center mt-10"
        >
          <p className="text-sm text-slate-500">
            ✨ این ابزارها برای همیشه رایگان هستند — بدون محدودیت و بدون نیاز به ثبت‌نام
          </p>
        </div>
      </div>
    </section>
  );
}
