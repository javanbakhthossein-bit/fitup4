"use client";

import {
  Dumbbell,
  Salad,
  MessageCircle,
  TrendingUp,
  Camera,
  Video,
  Activity,
  ClipboardCheck,
} from "lucide-react";

const FEATURES = [
  {
    icon: Dumbbell,
    title: "برنامه تمرینی هوشمند",
    desc: "برنامه بدنسازی و روال تمرینی کاملاً شخصی‌سازی‌شده بر اساس هدف، سن، وزن، تجهیزات و آسیب‌دیدگی‌ها. مناسب برنامه حجمی و برنامه کات با سوپرست، تری‌ست و حرکات مرکب برای عضله‌سازی اصولی در باشگاه یا خانه.",
    points: ["سوپرست و تری‌ست", "تایمر استراحت", "ثبت وزنه", "پیشرفت تدریجی"],
  },
  {
    icon: Salad,
    title: "برنامه غذایی و مکمل",
    desc: "برنامه غذایی بدنسازی با محاسبه دقیق کالری و درشت‌مغذی‌ها (پروتئین، کربوهیدرات، چربی) با غذاهای ایرانی. شامل رژیم غذایی هدفمند، منوی غذایی جایگزین و برنامه مکمل (استک مکمل) با دوز ایمن و علمی برای دوره حجم و کات.",
    points: ["کالری هدف", "غذاهای جایگزین", "مکمل ایمن", "ترکیب وعده‌ها"],
  },
  {
    icon: MessageCircle,
    title: "چت با مربی هوشمند",
    desc: "هر لحظه از مربی هوش مصنوعی سوال ورزشی بپرسید، جایگزین حرکت بخواهید یا مشاوره تغذیه و رژیم غذایی بگیرید. مربی به تمام پرونده ورزشی شما دسترسی دارد، حافظه بلندمدت دارد و برنامه بدنسازی را به‌روز می‌کند.",
    points: ["پاسخ آنی", "حافظه بلندمدت", "دسترسی به پرونده", "مشاوره تخصصی"],
  },
  {
    icon: Camera,
    title: "آنالیز هوشمند با عکس",
    desc: "عکس غذا بفرستید تا کالری و درشت‌مغذی‌های آن برای رژیم غذایی محاسبه شود. عکس بدن بفرستید تا فیتاپ هوشمند فرم بدن را تحلیل کند و برنامه تمرینی و غذایی شخصی‌سازی‌شده برای افزایش حجم یا چربی‌سوزی بسازد.",
    points: ["کالری‌سنج عکس", "تحلیل فرم بدن", "تشخیص غذا", "پیشنهاد اصلاحی"],
  },
  {
    icon: Video,
    title: "آنالیز ویدیویی تکنیک",
    desc: "ویدیو تمرین خود را ارسال کنید تا هوش مصنوعی تکنیک اجرای حرکات بدنسازی را تحلیل کند، نقاط ضعف فرم را شناسایی کند و حرکات اصلاحی برای پیشگیری از آسیب و عضله‌سازی بهتر پیشنهاد دهد.",
    points: ["اصلاح تکنیک", "تحلیل فرم", "حرکات اصلاحی", "پیشگیری آسیب"],
  },
  {
    icon: TrendingUp,
    title: "پیگیری پیشرفت",
    desc: "نمودار تغییرات وزن، اندازه‌های بدن، گالری تصاویر قبل/بعد خصوصی و چکاپ‌های دوره‌ای برای مقایسه دقیق پیشرفت در دوره حجم (Bulking) و دوره کات (Cutting) — راهی علمی برای رسیدن به تناسب اندام پایدار.",
    points: ["نمودار وزن", "چکاپ دوره‌ای", "گالری پیشرفت", "اندازه‌های بدن"],
  },
  {
    icon: Activity,
    title: "تحلیل آزمایش خون",
    desc: "عکس آزمایش خون را ارسال کنید تا ۴۷ شاخص شامل تستوسترون، ویتامین D، آهن و کورتیزول تحلیل شود و برنامه تغذیه و برنامه مکمل بدنسازی برای خشک کردن بدن و افزایش حجم عضلانی بهینه‌سازی گردد.",
    points: ["۴۷ شاخص خونی", "تستوسترون", "کمبود ویتامین", "بهینه‌سازی تغذیه"],
  },
  {
    icon: ClipboardCheck,
    title: "چکاپ‌های دوره‌ای",
    desc: "سیستم چکاپ منظم با ثبت وزن، اندازه‌های بدن، درصد چربی، کیفیت خواب و رعایت رژیم غذایی — برای مقایسه دقیق با نقطه شروع و ارزیابی اثربخشی برنامه بدنسازی و رژیم غذایی.",
    points: ["چکاپ baseline", "مقایسه دوره‌ای", "ثبت اندازه‌ها", "ارزیابی"],
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-transparent relative overflow-hidden">
      {/* subtle background blobs */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-10 right-0 w-80 h-80 rounded-full bg-amber-100/40 blur-3xl" />
        <div className="absolute bottom-10 left-0 w-80 h-80 rounded-full bg-orange-100/40 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="animate-fade-in-up text-center mb-14"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4"
            style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c" }}
          >
            امکانات کامل
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 text-slate-900">
            همه چیز برای{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #f59e0b, #f97316)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              تناسب اندام
            </span>{" "}
            شما
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            از برنامه تمرینی بدنسازی و برنامه غذایی هوشمند تا چت با مربی هوش مصنوعی —
            همه ابزارهایی که برای افزایش حجم، چربی‌سوزی، عضله‌سازی و رسیدن به تناسب اندام نیاز دارید، در یک اپلیکیشن.
          </p>
        </div>

        {/* Mobile: horizontal scrolling cards / Desktop: 4-col grid */}
        <div className="md:hidden -mx-4 px-4 mb-8">
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2" style={{ touchAction: "pan-x pan-y" }}>
            {FEATURES.map((feature, i) => {
              // Alternate: large (280px wide) vs small (200px wide) — peeks next card
              const isLarge = i % 2 === 0;
              return (
                <div
                  key={i}
                  className={`shrink-0 group relative bg-white rounded-3xl p-5 border-2 border-orange-100 hover:border-orange-300 transition-all overflow-hidden ${
                    isLarge ? "w-[85vw] max-w-[300px]" : "w-[70vw] max-w-[220px]"
                  }`}
                  style={
                    isLarge
                      ? {
                          background:
                            "linear-gradient(180deg, #fff7ed 0%, #ffffff 60%)",
                        }
                      : undefined
                  }
                >
                  <div
                    className={`relative ${
                      isLarge ? "w-14 h-14" : "w-11 h-11"
                    } rounded-2xl flex items-center justify-center mb-3 shadow-lg`}
                    style={{
                      background: "linear-gradient(135deg, #f59e0b, #f97316)",
                      boxShadow: "0 8px 22px -6px rgba(249, 115, 22, 0.45)",
                    }}
                  >
                    <feature.icon
                      className={isLarge ? "w-7 h-7 text-white" : "w-5 h-5 text-white"}
                      strokeWidth={2.5}
                    />
                  </div>
                  <h3
                    className={`font-black text-slate-900 mb-1.5 ${
                      isLarge ? "text-base" : "text-sm"
                    }`}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className={`text-slate-500 leading-relaxed mb-3 ${
                      isLarge ? "text-xs" : "text-[11px]"
                    }`}
                  >
                    {feature.desc}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {feature.points.map((p, j) => (
                      <span
                        key={j}
                        className="text-[9px] px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-100"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  {isLarge && (
                    <div
                      className="absolute top-3 left-3 text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                    >
                      ★
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-[10px] text-slate-500 mt-1">← برای مشاهده بیشتر بکشید →</p>
        </div>

        {/* Desktop grid — all cards same size */}
        <div className="hidden md:grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature, i) => {
            return (
              <div
                key={i}
                style={{ animationDelay: `${(i % 4) * 0.1}s` }}
                className="animate-fade-in-up group relative bg-white rounded-3xl p-6 border-2 border-orange-100 hover:border-orange-300 hover:shadow-2xl hover:shadow-orange-500/10 transition-all overflow-hidden h-full flex flex-col hover:-translate-y-1.5"
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

                <div>
                  <div
                    className={`relative ${
                      "w-14 h-14"
                    } rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}
                    style={{
                      background: "linear-gradient(135deg, #f59e0b, #f97316)",
                      boxShadow: "0 8px 22px -6px rgba(249, 115, 22, 0.45)",
                    }}
                  >
                    <feature.icon
                      className={"w-7 h-7 text-white"}
                      strokeWidth={2.5}
                    />
                  </div>
                  <h3 className="font-black text-base mb-2 text-slate-900">
                    {feature.title}
                  </h3>
                  <p
                    className={`text-slate-500 leading-relaxed mb-4 ${
                      "min-h-[3.5rem] text-xs"
                    }`}
                  >
                    {feature.desc}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {feature.points.map((p, j) => (
                    <span
                      key={j}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-100"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
