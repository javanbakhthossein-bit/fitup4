"use client";

import { motion } from "framer-motion";
import { Sparkles, ChevronLeft, Zap, Target, Brain } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { pushScreen, replaceScreen } from "@/lib/fitness/navigation";

/**
 * CTA Section — دعوت به اقدام برای خرید برنامه
 *
 * یک بنر بسیار جذاب با گرادیان نارنجی، انیمیشن، و دکمه شروع.
 * در صفحات SEO (حرکات و غذاها) نمایش داده می‌شود تا کاربر را
 * به صفحه اصلی یا ثبت‌نام هدایت کند.
 */
export function CtaSection({ context }: { context?: "exercise" | "food" }) {
  const { setScreen } = useAppStore();

  const contextText =
    context === "exercise"
      ? "این حرکت را در برنامه تمرینی اختصاصی خودت داشته باش"
      : context === "food"
      ? "این غذا را در برنامه غذایی شخصی‌سازی‌شده خودت بگنجان"
      : "برنامه تمرینی و غذایی اختصاصی خودت را بساز";

  function handleStart() {
    setScreen("landing");
    replaceScreen("landing");
    // اسکرول به بخش اشتراک‌ها
    setTimeout(() => {
      const pricingSection = document.getElementById("pricing");
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 500);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl my-8 shadow-2xl"
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #f97316 40%, #ea580c 100%)",
        }}
      />

      {/* Decorative blurs */}
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-yellow-300/20 blur-3xl" />
      <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-white/10 blur-2xl" />

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-10 text-center">
        {/* Badge */}
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          whileInView={{ scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: "spring" }}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-bold mb-4"
        >
          <Sparkles className="w-3.5 h-3.5" />
          مربی هوشمند فیتاپ
        </motion.div>

        {/* Title */}
        <h3 className="text-xl sm:text-3xl font-black text-white mb-2 leading-tight">
          {contextText}
        </h3>
        <p className="text-sm sm:text-base text-white/90 mb-6 max-w-lg mx-auto leading-relaxed">
          برنامه تمرینی و غذایی شخصی‌سازی‌شده با هوش مصنوعی — متناسب با هدف،
          تجهیزات و شرایط بدنی شما. خرید برنامه بدنسازی آنلاین با پشتیبانی ۲۴
          ساعته.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {[
            { icon: Target, text: "برنامه تمرینی اختصاصی" },
            { icon: Zap, text: "برنامه غذایی هوشمند" },
            { icon: Brain, text: "چت مربی AI" },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-medium"
            >
              <feature.icon className="w-3.5 h-3.5" />
              {feature.text}
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStart}
          className="inline-flex items-center gap-2 rounded-2xl bg-white text-orange-600 font-black text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4 shadow-xl transition hover:shadow-2xl"
        >
          <Sparkles className="w-5 h-5" />
          شروع کنید — رایگان
          <ChevronLeft className="w-5 h-5" />
        </motion.button>

        {/* Trust signal */}
        <p className="text-xs text-white/70 mt-4">
          ✓ ساخته‌شده توسط برترین مربیان ✓ شخصی‌سازی با AI ✓ پشتیبانی ۲۴ ساعته
        </p>
      </div>
    </motion.div>
  );
}
