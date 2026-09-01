"use client";

import { Sparkles, Brain, ShieldCheck, Award, Microscope, Cpu, HeartPulse } from "lucide-react";

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

/**
 * Coaches Trust Section — بخش اعتماد و تخصص
 *
 * پیام اصلی از نگاه دیجیتال مارکتر:
 * فیتاپ توسط بزرگترین مربیان بدنسازی دنیا طراحی شده است.
 * هوش مصنوعی اختصاصی فیتاپ توسط این نخبگان آموزش دیده است.
 * این ترکیب علم، تجربه و تکنولوژی بهترین برنامه را به کاربر می‌دهد.
 */
export function CoachesTrustSection() {
  return (
    <section
      id="coaches"
      className="py-20 sm:py-24 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)" }}
    >
      {/* لکه‌های دکوراتیو */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-orange-200/30 blur-3xl" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
        {/* Heading */}
        <div
          className="animate-fade-in-up text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-orange-200 text-orange-600 text-sm font-medium mb-4 shadow-sm">
            <Award className="w-4 h-4" />
            ساخته‌شده توسط نخبگان بدنسازی ایران
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 text-slate-900 leading-tight">
            هوش مصنوعی فیتاپ،{" "}
            <span
              style={{
                background: goldGradient,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              توسط بزرگترین مربیان بدنسازی دنیا
            </span>{" "}
            آموزش دیده است
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed text-base">
            فیتاپ حاصل همکاری بزرگترین مربیان بدنسازی دنیا است.
            تمام دانش و تجربه‌ی این نخبگان در هوش مصنوعی اختصاصی فیتاپ نهادینه شده تا
            برنامه‌ای علمی، ایمن و کاملاً شخصی‌سازی‌شده دریافت کنید — دقیقاً همان کیفیت
            که از یک مربی حرفه‌ای انتظار دارید، اما سریع‌تر، دقیق‌تر و ۲۴ ساعته در دسترس.
          </p>
        </div>

        {/* Main feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          <CoachesCard
            icon={Cpu}
            title="هوش مصنوعی اختصاصی فیتاپ"
            desc="موتور هوشمند فیتاپ توسط تیمی از بزرگترین مربیان بدنسازی دنیا طراحی و آموزش داده شده است تا دقیق‌ترین برنامه را برای بدن شما بسازد."
            delay={0}
          />
          <CoachesCard
            icon={Award}
            title="دانش برترین مربیان کشور"
            desc="سال‌ها تجربه‌ی مربیان رسمی فدراسیون و قهرمانان بدنسازی ایران در الگوریتم‌های فیتاپ تجسم یافته است. هر برنامه، ترکیبی از علم روز و تجربه‌ی میدانی است."
            delay={0.08}
          />
          <CoachesCard
            icon={HeartPulse}
            title="اصول علمی"
            desc="تمام برنامه‌های تمرینی و غذایی فیتاپ بر اساس اصول علمی و ورزشی طراحی شده‌اند تا ایمن و مؤثر باشند."
            delay={0.16}
          />
        </div>

        {/* Trust badges row */}
        <div
          style={{ animationDelay: "0.2s" }}
          className="animate-fade-in-up flex flex-wrap items-center justify-center gap-3 sm:gap-5"
        >
          <TrustBadge icon={Award} text="مربیان رسمی فدراسیون بدنسازی" />
          <TrustBadge icon={Microscope} text="بر اساس علم روز ورزشی" />
          <TrustBadge icon={HeartPulse} text="اصول علمی" />
          <TrustBadge icon={Sparkles} text="شخصی‌سازی دقیق برای هر بدن" />
        </div>
      </div>
    </section>
  );
}

function CoachesCard({
  icon: Icon,
  title,
  desc,
  delay,
}: {
  icon: any;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <div
      style={{ animationDelay: `${delay}s` }}
      className="animate-fade-in-up p-5 rounded-2xl border transition hover:shadow-lg bg-white border-orange-200 shadow-sm"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-md"
        style={{ background: goldGradient }}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="font-bold text-base text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function TrustBadge({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-orange-100 shadow-sm">
      <Icon className="w-4 h-4 text-orange-500" />
      <span className="text-xs font-medium text-slate-700">{text}</span>
    </div>
  );
}
