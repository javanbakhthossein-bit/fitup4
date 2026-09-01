"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const TIPS = [
  "مربی هوشمند همیشه کنارته",
  "برنامه تمرینی شخصی‌سازی شده",
  "تغذیه هوشمند با AI",
  "پیگیری پیشرفت لحظه‌ای",
];

export function SplashLoader() {
  // مقدار اولیه ۰ — اولین نکته همزمان با لوگو نمایش داده می‌شود
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    // چرخش سریع — هر ۸۰۰ms
    const tipTimer = setInterval(() => {
      setTipIdx((i) => (i + 1) % TIPS.length);
    }, 800);
    return () => clearInterval(tipTimer);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center bg-white">
      {/* ─── Main content ─── */}
      <div className="relative z-10 flex flex-col items-center">
        {/* ─── FitUp logo ─── */}
        <div className="mb-5">
          <motion.div
            className="rounded-3xl overflow-hidden"
            style={{ boxShadow: "0 12px 36px -8px rgba(249,115,22,0.35)" }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src="/fitup-logo.png"
              alt="فیتاپ"
              width={112}
              height={112}
              className="block"
              style={{ width: 112, height: 112, objectFit: "cover" }}
            />
          </motion.div>
        </div>

        {/* ─── Rotating tip text — همزمان با لوگو، فوری ─── */}
        <div className="h-6 flex items-center justify-center overflow-hidden">
          <motion.p
            key={tipIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="text-sm text-orange-600/80 font-medium whitespace-nowrap"
          >
            {TIPS[tipIdx]}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
