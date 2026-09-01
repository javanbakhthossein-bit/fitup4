"use client";

/**
 * CTA اینستاگرام فیتاپ (@fittup.ir) — بالای فوتر لندینگ.
 *
 * طراحی: کارت تیره با هاله گرادیان برند اینستاگرام + شیمر + دکمه فالو.
 * چون برند اینستاگرام خودش گرادیان بنفش/صورتی/نارنجی دارد، همان گرادیان رسمی
 * روی آیکون و هاله استفاده شده تا برای کاربر فارسی فوراً قابل‌تشخیص باشد.
 */

const INSTAGRAM_URL = "https://instagram.com/fittup.ir";
const INSTAGRAM_HANDLE = "@fittup.ir";

/** آیکون اینستاگرام (SVG رسمی‌مانند — gradient داخل SVG) */
function InstagramGlyph({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#FEDA75" />
          <stop offset="25%" stopColor="#FA7E1E" />
          <stop offset="50%" stopColor="#D62976" />
          <stop offset="75%" stopColor="#962FBF" />
          <stop offset="100%" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5.5"
        stroke="url(#ig-grad)"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2" />
      <circle cx="17.4" cy="6.6" r="1.4" fill="url(#ig-grad)" />
    </svg>
  );
}

export function InstagramCtaSection() {
  return (
    <section className="py-14 sm:py-16 bg-white" aria-label="اینستاگرام فیتاپ">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className="animate-scale-in relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl"
          style={{
            // هاله گرادیان اینستاگرام روی لبه کارت تیره
            background:
              "linear-gradient(135deg, rgba(250,126,30,0.9) 0%, rgba(214,41,118,0.9) 45%, rgba(150,47,191,0.9) 75%, rgba(79,91,213,0.9) 100%)",
            padding: "2px", // قاب گرادیانی
          }}
        >
          <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.45rem] bg-slate-950">
            {/* دکور: هاله‌های رنگی محو */}
            <div
              className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-30 pointer-events-none"
              style={{ background: "radial-gradient(circle, #D62976, transparent 70%)" }}
            />
            <div
              className="absolute -bottom-28 -right-20 w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none"
              style={{ background: "radial-gradient(circle, #FA7E1E, transparent 70%)" }}
            />
            <div
              className="absolute top-10 right-1/3 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ background: "radial-gradient(circle, #962FBF, transparent 70%)" }}
            />

            {/* شیمر نوری ملایم */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
                animation: "gold-shimmer 5s infinite linear",
              }}
            />

            <div className="relative px-6 py-10 sm:px-12 sm:py-14 flex flex-col lg:flex-row items-center justify-between gap-8 text-center lg:text-right">
              {/* متن */}
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 mb-4 border border-white/10">
                  <InstagramGlyph className="w-4 h-4" />
                  <span className="text-xs font-bold text-white/90">اینستاگرام فیتاپ</span>
                  <span dir="ltr" className="text-xs font-black text-white">{INSTAGRAM_HANDLE}</span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-snug mb-3">
                  هر روز کنار شما —{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, #FEDA75, #FA7E1E, #D62976, #962FBF)",
                    }}
                  >
                    تیپ‌های تناسب اندام
                  </span>{" "}
                  بدون فیلتر و تعارف
                </h2>

                <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed mb-6">
                  پشت‌صحنه تحولات واقعی کاربران، تمرین‌های خانگی، نکات تغذیه‌ی کاربردی و
                  کدهای تخفیف ویژه‌ی فقط برای فالوورها — همه در پیج فیتاپ. همین حالا فالو کن!
                </p>

                {/* چیپ‌های ویژگی */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-2.5">
                  {[
                    "💪 نکات تمرین روزانه",
                    "🥗 تغذیه‌ی ساده و عملی",
                    "🔥 تحولات واقعی کاربران",
                    "🎁 کد تخفیف ویژه فالوورها",
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="text-[11px] sm:text-xs font-bold text-white/85 bg-white/10 backdrop-blur border border-white/10 rounded-full px-3 py-1.5"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              {/* دکمه فالو */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`فالو کردن فیتاپ در اینستاگرام (${INSTAGRAM_HANDLE})`}
                  className="group inline-flex items-center gap-2.5 rounded-2xl px-8 py-4 text-white font-black text-base shadow-xl transition-all duration-300 hover:scale-[1.04] hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={{
                    background:
                      "linear-gradient(135deg, #FA7E1E 0%, #D62976 50%, #962FBF 100%)",
                  }}
                >
                  <InstagramGlyph className="w-5 h-5 transition-transform duration-300 group-hover:rotate-6" />
                  فالو کن
                </a>
                <span dir="ltr" className="text-[11px] text-slate-400 font-mono tracking-wide">
                  instagram.com/fittup.ir
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
