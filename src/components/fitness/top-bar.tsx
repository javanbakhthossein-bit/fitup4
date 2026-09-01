"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bell, Dumbbell, Shield, Menu, X } from "lucide-react";
import { UserCircle, Wallet } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { toPersianDigits, PLAN_LABELS } from "@/lib/fitness/types";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  MessageCircle,
  Crown,
  Apple,
  Gift,
  Headphones,
  Smartphone,
} from "lucide-react";
import type { MainTab } from "@/lib/fitness/store";
import { LogoutButton } from "./logout-button";

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

const NAV_ITEMS: { id: MainTab; label: string; icon: any; badge?: string }[] = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { id: "programs", label: "برنامه‌ها", icon: ClipboardList },
  { id: "workouts", label: "تمرین‌ها", icon: Dumbbell },
  { id: "nutrition", label: "دستیار تغذیه", icon: Apple },
  { id: "progress", label: "پیشرفت", icon: TrendingUp },
  { id: "chat", label: "چت با فیتاپ", icon: MessageCircle },
  { id: "referral", label: "معرفی به دوست", icon: Gift },
  { id: "support", label: "پشتیبانی", icon: Headphones },
  { id: "mobileapp", label: "اپ موبایل", icon: Smartphone },
  { id: "plans", label: "پلن‌ها", icon: Crown },
];

export function TopBar() {
  const { overlay, setOverlay, setScreen, unreadCount, user, mainTab, setMainTab } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // تابع رفتن به صفحه اصلی (لندینگ) بدون خروج از حساب
  function goLanding() {
    setScreen("landing");
    // اسکرول به بالا
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Lock body scroll when drawer is open so the background doesn't move
  // and the user can't accidentally scroll the page underneath.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [menuOpen]);

  // Close drawer on Escape for accessibility
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function handleNav(tab: MainTab) {
    setMainTab(tab);
    setMenuOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-orange-100">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          {/* Mobile: hamburger menu (right) + brand (left) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2.5 rounded-xl hover:bg-orange-50 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="باز کردن منو"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
            >
              <Menu className="w-6 h-6 text-slate-700" />
            </button>
            {/* لوگو حذف شد — فقط در sidebar دسکتاپ و منوی موبایل موجود است */}
          </div>

          {/* Desktop: greeting (لوگو حذف شد — فقط در sidebar) */}
          <div className="hidden lg:flex items-center gap-3">
            <p className="text-sm text-slate-600">
              {user?.name ? `سلام ${user.name} 👋` : "به فیتاپ خوش آمدی"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* کیف پول — حذف از top-bar، به منوی موبایل و پروفایل منتقل شد */}
            {user?.role === "ADMIN" && (
              <button
                onClick={() => setOverlay("admin")}
                className="p-2.5 rounded-xl hover:bg-orange-50 transition relative min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="پنل مدیریت"
                aria-label="پنل مدیریت"
              >
                <Shield className="w-5 h-5 text-orange-500" />
              </button>
            )}
            <button
              onClick={() => setOverlay(overlay === "notifications" ? null : "notifications")}
              className="p-2.5 rounded-xl hover:bg-orange-50 transition relative text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="اعلان‌ها"
              aria-label="اعلان‌ها"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                  style={{ background: goldGradient }}
                >
                  {toPersianDigits(unreadCount)}
                </motion.span>
              )}
            </button>
            <button
              onClick={() => setOverlay("profile")}
              className="w-11 h-11 rounded-full flex items-center justify-center text-orange-500 hover:text-orange-600 transition"
              title="پروفایل"
              aria-label="پروفایل"
            >
              <UserCircle className="w-7 h-7" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu (from right) — wrapped in AnimatePresence so
          exit animation runs when menuOpen flips to false. z-[70] keeps it
          above the sticky header (z-30) and any sheets. */}
      <AnimatePresence>
        {menuOpen && (
          <div
            id="mobile-nav-drawer"
            className="fixed inset-0 z-[70] lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="منوی اصلی"
          >
            {/* Backdrop — fades in/out */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMenuOpen(false)}
            />

            {/* Drawer — slides in from the right (RTL) */}
            <motion.div
              key="mobile-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col"
              dir="rtl"
            >
              {/* Header — لوگو لینک به صفحه اصلی سایت */}
              <div
                className="flex items-center justify-between p-4 border-b border-orange-100"
                style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)" }}
              >
                {/* FE-C3: قبلاً دکمهٔ کیف پول داخل دکمهٔ لوگو/نام‌کاربر بود
                    (button تو در تو = HTML نامعتبر). کلیک روی کیف پول هر دو
                    handler را fire می‌کرد (setOverlay("profile") +
                    setScreen("landing")) و کاربر از پنل بیرون پرتاب می‌شد.
                    حالا دو دکمهٔ مستقل داخل یک wrapper مشترک هستند. */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => { setMenuOpen(false); setScreen("landing"); }}
                    className="flex items-center gap-2.5 min-w-0"
                    aria-label="رفتن به صفحه اصلی سایت"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0 overflow-hidden"
                      style={{ background: goldGradient }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-black text-base text-slate-900 truncate">{user?.name || "ورزشکار"}</h2>
                      <p className="text-[10px] text-slate-500">ورزشکار فیتاپ</p>
                    </div>
                  </button>
                  {/* کیف پول — کنار اسم کاربر در منو (دکمهٔ مستقل، خواهر/برادر لوگو) */}
                  {user && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setOverlay("profile"); }}
                      className={`flex items-center gap-1.5 px-2.5 h-9 rounded-xl border text-xs font-bold transition shrink-0 ${
                        (user.walletBalance ?? 0) > 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-200 bg-white/70 text-slate-600 hover:bg-white"
                      }`}
                      title="کیف پول"
                      aria-label={`کیف پول: ${toPersianDigits((user.walletBalance ?? 0).toLocaleString("en-US"))} تومان`}
                    >
                      <Wallet className="w-4 h-4 shrink-0" />
                      <span className="font-stat whitespace-nowrap">
                        {toPersianDigits((user.walletBalance ?? 0).toLocaleString("en-US"))}
                      </span>
                      <span className="text-[10px] opacity-70">ت</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2.5 rounded-xl hover:bg-white/60 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="بستن منو"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Plan badge */}
              {user?.planName && (
                <div className="px-4 py-2.5 border-b border-orange-50 bg-orange-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">پلن فعلی</span>
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ background: goldGradient }}
                    >
                      {PLAN_LABELS[user.planName as keyof typeof PLAN_LABELS] || user.planName}
                    </span>
                  </div>
                </div>
              )}

              {/* Navigation items — clicking navigates AND closes drawer */}
              <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1" aria-label="منوی اصلی">
                {NAV_ITEMS.map((item) => {
                  const isActive = mainTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-right min-h-[48px] ${
                        isActive
                          ? "text-white shadow-md"
                          : "text-slate-700 hover:bg-orange-50 active:bg-orange-100"
                      }`}
                      style={isActive ? { background: goldGradient } : {}}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </button>
                  );
                })}
              </nav>

              {/* Footer — logout (دکمه جذاب با گرادیان قرمز/نارنجی + تأیید) */}
              <div className="p-3 border-t border-orange-100">
                <LogoutButton variant="mobile" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
