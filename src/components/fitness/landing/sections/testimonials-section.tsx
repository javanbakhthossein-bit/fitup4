"use client";

import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "سارا محمدی",
    role: "کاهش ۸ کیلو در ۳ ماه",
    avatar: "س",
    color: "from-rose-500 to-pink-500",
    text: "پس از سال‌ها تلاش ناموفق برای کاهش وزن، بالاخره با برنامه هوشمند این اپلیکیشن به هدلم رسیدم. مربی AI واقعاً برنامه رو دقیق برای من تنظیم کرده بود.",
    rating: 5,
  },
  {
    name: "رضا کریمی",
    role: "افزایش ۵ کیلو عضله",
    avatar: "ر",
    color: "from-cyan-500 to-blue-500",
    text: "بهترین چت ورزشی که دیدم! هر بار سوالی داشتم سریع جواب می‌گرفتم. مخصوصاً قسمت تعویض حرکت برای آسیب‌دیدگی کمرم خیلی کمکم کرد.",
    rating: 5,
  },
  {
    name: "مریم احمدی",
    role: "تناسب اندام پس از زایمان",
    avatar: "م",
    color: "from-violet-500 to-purple-500",
    text: "برنامه غذایی فوق‌العاده‌ست. با غذاهای ایرانی و در دسترس، ولی کاملاً سالم. نمودار پیشرفت وزن هم انگیزه زیادی میده.",
    rating: 5,
  },
  {
    name: "امیر حسینی",
    role: "بدنسازی حرفه‌ای",
    avatar: "ا",
    color: "from-emerald-500 to-teal-500",
    text: "حتی به‌عنوان کسی که سال‌ها بدنسازی کردم، تنوع حرکات و شخصی‌سازی برنامه واقعاً عالیه. تایمر استراحت و ثبت وزنه خیلی کاربردیه.",
    rating: 5,
  },
  {
    name: "نگار علی‌پور",
    role: "ورزش در خانه",
    avatar: "ن",
    color: "from-amber-500 to-orange-500",
    text: "چون وقت رفتن به باشگاه ندارم، برنامه خانه با وزن بدن برام ساخته. واقعاً نتیجه داد. روند پیشرفتم تو نمودار مشخصه.",
    rating: 5,
  },
  {
    name: "حسین رضایی",
    role: "کاهش چربی و افزایش استقامت",
    avatar: "ح",
    color: "from-indigo-500 to-violet-500",
    text: "رابط کاربری خیلی راحته و فارسی روان. یادآوری‌های تمرین و آب باعث میشه منظم بمونم. اشتراک سه ماهه با تخفیف عالی بود.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="animate-fade-in-up text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4" style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#ea580c" }}>
            <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
            رضایت کاربران
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 text-slate-900">
            هزاران ورزشکار{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #f59e0b, #f97316)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              با فیتاپ به هدفشان رسیدند
            </span>
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            ببینید کاربران ما چه تجربه‌ای با فیتاپ داشته‌اند.
          </p>
        </div>

        {/* Desktop: 3-col grid */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              style={{ animationDelay: `${(i % 3) * 0.1}s` }}
              className="animate-fade-in-up bg-white rounded-3xl border-2 border-orange-100 p-5 hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-300 transition-all"
            >
              <Quote className="w-8 h-8 text-orange-200 mb-3" />
              <div className="flex mb-3">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">{t.text}</p>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900">{t.name}</p>
                  <p className="text-[11px] text-orange-600">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: horizontal scroll */}
        <div className="sm:hidden -mx-4 px-4">
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3" style={{ touchAction: "pan-x pan-y" }}>
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="shrink-0 w-[85vw] max-w-[300px] bg-white rounded-3xl border-2 border-orange-100 p-5 hover:border-orange-300 transition-all"
              >
                <Quote className="w-8 h-8 text-orange-200 mb-3" />
                <div className="flex mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 min-h-[5.5rem] overflow-hidden">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{t.name}</p>
                    <p className="text-[11px] text-orange-600">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[10px] text-slate-500 mt-1">← برای مشاهده بیشتر بکشید →</p>
        </div>
      </div>
    </section>
  );
}
