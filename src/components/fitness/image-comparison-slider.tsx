"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon } from "lucide-react";

interface ImageComparisonSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function ImageComparisonSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "قبل",
  afterLabel = "بعد",
}: ImageComparisonSliderProps) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleMove(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    setPos(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden glass select-none cursor-ew-resize"
      style={{ touchAction: "none" }}
      onMouseMove={(e) => e.buttons === 1 && handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onClick={(e) => handleMove(e.clientX)}
    >
      {/* After (full) */}
      <img src={afterUrl} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full glass-strong text-[11px] font-bold text-primary">
        {afterLabel}
      </span>

      {/* Before (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={beforeUrl} alt={beforeLabel} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full glass-strong text-[11px] font-bold">
          {beforeLabel}
        </span>
      </div>

      {/* Divider handle */}
      {/* نکته RTL: pos درصد از «چپ» فیزیکی است (clientX - rect.left) و clipPath هم
          مرز را در pos% از چپ می‌گذارد؛ پس خط جداکننده هم باید با left موقعیت بگیرد —
          right: pos% آن را آینه‌ای (۱۰۰-pos)% از چپ می‌گذاشت و دسته برعکس مرز حرکت می‌کرد. */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-primary pointer-events-none"
        style={{ left: `${pos}%`, boxShadow: "0 0 12px #F4C542" }}
      >
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full glass-strong border-2 border-primary flex items-center justify-center"
          style={{ left: "50%" }}
        >
          <div className="flex gap-0.5">
            <div className="w-1 h-3 bg-primary rounded-full" />
            <div className="w-1 h-3 bg-primary rounded-full" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
