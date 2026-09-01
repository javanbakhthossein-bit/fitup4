"use client";

import { motion } from "framer-motion";
import { Dumbbell, Shield, Sparkles, Crown, Wallet, UserCircle } from "lucide-react";
import { useAppStore, type MainTab } from "@/lib/fitness/store";
import { PLAN_LABELS, toPersianDigits } from "@/lib/fitness/types";
import { LogoutButton } from "./logout-button";

interface NavItem {
  id: MainTab;
  label: string;
  icon: any;
}

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

export function Sidebar({ navItems }: { navItems: NavItem[] }) {
  const { mainTab, setMainTab, user, setOverlay, setScreen } = useAppStore();

  return (
    <aside className="hidden lg:flex fixed top-0 right-0 bottom-0 w-72 flex-col bg-white border-l border-orange-100 z-40 shadow-sm">
      {/* Brand — لینک به صفحه اصلی سایت */}
      <div className="p-5 border-b border-orange-100">
        <button
          onClick={() => setScreen("landing")}
          className="flex items-center gap-3 w-full"
          aria-label="رفتن به صفحه اصلی سایت"
        >
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md overflow-hidden"
            style={{ background: goldGradient }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col leading-none text-right">
            <span
              className="font-black text-lg"
              style={{
                background: goldGradient,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              فیتاپ
            </span>
            <span className="text-[10px] text-slate-500 mt-1">هر بدنی فیتاپ میخواد</span>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const active = mainTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setMainTab(item.id)}
              className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                active
                  ? "text-orange-600 shadow-sm"
                  : "text-slate-600 hover:bg-orange-50 hover:text-orange-600"
              }`}
              style={
                active
                  ? { background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(249,115,22,0.12))" }
                  : undefined
              }
            >
              {active && (
                <motion.div
                  layoutId="sidebarActive"
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-l-full"
                  style={{ background: goldGradient }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`w-5 h-5 ${active ? "text-orange-500" : "text-slate-500"}`}
                strokeWidth={active ? 2.5 : 2}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Plan status card + کیف پول + پروفایل کاربر */}
      <div className="p-3 space-y-2">
        {/* کارت کاربر — اسم + کیف پول */}
        <button
          onClick={() => setOverlay("profile")}
          className="w-full bg-white rounded-2xl p-3 text-right hover:scale-[1.02] transition-transform border-2 border-orange-200 shadow-sm flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)" }}>
            <UserCircle className="w-7 h-7 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{user?.name || "ورزشکار"}</p>
            {/* کیف پول — کنار اسم کاربر */}
            <div className={`flex items-center gap-1 text-[11px] font-bold ${(user?.walletBalance ?? 0) > 0 ? "text-emerald-600" : "text-slate-500"}`}>
              <Wallet className="w-3 h-3" />
              <span className="font-stat">
                {toPersianDigits((user?.walletBalance ?? 0).toLocaleString("en-US"))}
              </span>
              <span className="text-[9px] opacity-70">تومان</span>
            </div>
          </div>
        </button>

        {/* پلن فعلی */}
        {user?.planName ? (
          <button
            onClick={() => setMainTab("plans")}
            className="w-full bg-white rounded-2xl p-3 text-right hover:scale-[1.02] transition-transform border-2 border-orange-200 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-orange-600">پلن {PLAN_LABELS[user.planName]}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {user.planExpiresAt
                ? `${toPersianDigits(Math.max(0, Math.ceil((new Date(user.planExpiresAt).getTime() - Date.now()) / 86400000)))} روز باقیمانده`
                : "اشتراک فعال"}
            </p>
          </button>
        ) : (
          <button
            onClick={() => setMainTab("plans")}
            className="w-full bg-white rounded-2xl p-3 text-right hover:scale-[1.02] transition-transform border-2 border-orange-200 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-orange-600">خرید پلن</span>
            </div>
            <p className="text-[11px] text-slate-500">دسترسی کامل به همه امکانات</p>
          </button>
        )}

        {/* Admin shortcut */}
        {user?.role === "ADMIN" && (
          <button
            onClick={() => setOverlay("admin")}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs text-slate-600 hover:bg-orange-50 transition"
          >
            <Shield className="w-4 h-4 text-orange-500" />
            پنل مدیریت
          </button>
        )}

        {/* دکمه خروج از حساب — گرادیان قرمز/نارنجی + تأیید */}
        <LogoutButton variant="desktop" />
      </div>
    </aside>
  );
}
