"use client";

import { Dumbbell, Salad, Star, Bot } from "lucide-react";

const STATS = [
  {
    icon: Bot,
    value: "۲۴/۷",
    label: "مربی هوشمند",
    subtitle: "تحلیل ویدیو، عکس غذا و آزمایش خون",
    grad: "from-amber-500 to-orange-500",
  },
  {
    icon: Dumbbell,
    value: "۲۶۰+",
    label: "حرکت ورزشی",
    subtitle: "با آموزش گام‌به‌گام",
    grad: "from-orange-500 to-red-500",
  },
  {
    icon: Salad,
    value: "۱۰۰۰+",
    label: "غذای سالم",
    subtitle: "بانک مواد غذایی",
    grad: "from-yellow-500 to-amber-500",
  },
  {
    icon: Star,
    value: "۴.۹",
    label: "امتیاز کاربران",
    subtitle: "رضایت ورزشکاران",
    grad: "from-amber-400 to-orange-400",
  },
];

export function TrustBar() {
  return (
    <section className="py-10 sm:py-12 bg-white border-y border-orange-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Desktop: 4-column grid */}
        <div className="hidden md:grid grid-cols-4 gap-4 sm:gap-6">
          {STATS.map((stat, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 0.1}s` }}
              className="animate-fade-in-up relative bg-white rounded-3xl border border-orange-100 shadow-sm hover:shadow-xl transition-all p-5 text-center overflow-hidden hover:-translate-y-1"
            >
              {/* Decorative gradient blob */}
              <div
                className={`absolute -top-8 -left-8 w-24 h-24 rounded-full opacity-10 blur-2xl bg-gradient-to-br ${stat.grad}`}
              />
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.grad} flex items-center justify-center mx-auto mb-3 shadow-lg`}
              >
                <stat.icon className="w-7 h-7 text-white" strokeWidth={2.5} />
              </div>
              <p
                className="text-2xl sm:text-3xl font-black mb-0.5"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {stat.value}
              </p>
              <p className="text-sm font-bold text-slate-900">{stat.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{stat.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Mobile: 2x2 grid — تمیز و مینیمال */}
        <div className="md:hidden grid grid-cols-2 gap-2.5">
          {STATS.map((stat, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 0.05}s` }}
              className="animate-fade-in-up bg-white rounded-2xl border border-orange-100 shadow-sm p-3 text-center"
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.grad} flex items-center justify-center mx-auto mb-1.5 shadow-md`}
              >
                <stat.icon className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <p
                className="text-xl font-black mb-0"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {stat.value}
              </p>
              <p className="text-[11px] font-bold text-slate-900 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
