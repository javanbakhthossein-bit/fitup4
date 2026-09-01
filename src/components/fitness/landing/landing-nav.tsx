"use client";

import { useState, useRef, useEffect } from "react";
import { Dumbbell, Menu, X, ChevronDown, Calculator, Apple, Sparkles, Download, Instagram } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { pushScreen, smartNavigate, type NavScreen } from "@/lib/fitness/navigation";

const NAV_LINKS = [
  { href: "#features", label: "امکانات" },
  { href: "#ai-coach", label: "مربی هوشمند" },
  { href: "#pricing", label: "پلن‌ها" },
  { href: "#articles", label: "مقالات" },
  { href: "#faq", label: "سوالات" },
];

const TOOL_LINKS = [
  { screen: "tool-tdee" as const, label: "محاسبه‌گر کالری", icon: Calculator },
  { screen: "tool-exercises" as const, label: "بانک حرکات", icon: Dumbbell },
  { screen: "tool-foods" as const, label: "کالری غذاها", icon: Apple },
];

export function LandingNav() {
  const { setScreen, user } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pendingScrollRef = useRef<string | null>(null);

  // Scroll detection — internal to LandingNav to prevent parent re-renders
  // (parent re-renders were causing the "white flash" flicker on landing page)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll(); // init
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // After menu closes, if there's a pending scroll target, scroll to it
  useEffect(() => {
    if (!mobileOpen && pendingScrollRef.current) {
      const href = pendingScrollRef.current;
      pendingScrollRef.current = null;
      // Use requestAnimationFrame to ensure DOM is ready after menu close
      requestAnimationFrame(() => {
        const el = document.querySelector(href) as HTMLElement | null;
        if (el) {
          const top = el.offsetTop - 70; // offset for fixed header
          window.scrollTo({ top, behavior: "smooth" });
        }
      });
    }
  }, [mobileOpen]);

  function scrollTo(href: string) {
    // Store the target for useEffect (handles normal click flow)
    pendingScrollRef.current = href;
    // Close menu
    setMobileOpen(false);
    // Also scroll directly as fallback (handles edge cases where useEffect doesn't fire)
    setTimeout(() => {
      const el = document.querySelector(href) as HTMLElement | null;
      if (el) {
        const top = el.offsetTop - 70;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }, 300);
  }

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl border-b shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* راست: منوی موبایل + لوگو — shrink-0 تا لوگو هرگز له نشود؛ اسم کاربر truncate می‌شود */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition"
              aria-label="منو"
            >
              {mobileOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-900" />}
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="flex items-center gap-2.5"
              aria-label="فیتاپ — بازگشت به ابتدای صفحه"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md overflow-hidden" style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-black text-lg text-slate-900 whitespace-nowrap">
                  فیتاپ
                </span>
                <span className="hidden sm:block text-[9px] text-slate-500 mt-0.5">هر بدنی فیتاپ میخواد</span>
              </div>
            </button>
          </div>

          {/* Desktop nav — وسط */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                {link.label}
              </button>
            ))}
            {/* ابزارهای رایگان در منوی دسکتاپ */}
            <div className="relative group">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1">
                ابزارهای رایگان
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="absolute top-full right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-orange-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-1.5 z-50">
                <button
                  onClick={() => scrollTo("#tools")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-orange-600 hover:bg-orange-50 transition border-b border-orange-100 mb-1"
                >
                  <Sparkles className="w-4 h-4" />
                  مشاهده همه ابزارها
                </button>
                {TOOL_LINKS.map((tool) => (
                  <button
                    key={tool.screen}
                    onClick={() => { setScreen(tool.screen); pushScreen(tool.screen, { tool: tool.screen.replace("tool-", "") }); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition"
                  >
                    {tool.icon && <tool.icon className="w-4 h-4" />}
                    {tool.label}
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* چپ: اکشن‌ها — min-w-0 تا در موبایل فضا تنگ، دکمه‌ی نام کاربر با truncate کوچک شود نه اینکه به آیکون اینستاگرام/لوگو بچسبد */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* اینستاگرام فیتاپ — فقط آیکون، نارنجی سازمانی، کنار دکمه شروع */}
            <a
              href="https://instagram.com/fittup.ir"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="اینستاگرام فیتاپ — fittup.ir"
              title="اینستاگرام فیتاپ — fittup.ir"
              className="flex items-center justify-center w-10 h-10 rounded-xl text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95 shrink-0"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <Instagram className="w-5 h-5" strokeWidth={2.2} />
            </a>
            {user ? (
              <button
                onClick={() => {
                  if (user.role === "ADMIN") {
                    setScreen("admin");
                    pushScreen("admin");
                    return;
                  }
                  // FE-M5: همان ناوبری هوشمند دکمه «شروع» — اگر آنبوردینگ کامل
                  // نشده باشد کاربر به onboarding می‌رود، نه مستقیم به پنل
                  // (cast امن: smartNavigate فقط auth/onboarding/main پاس می‌دهد که همگی AppScreen معتبرند)
                  smartNavigate(true, setScreen as (s: NavScreen) => void, user.onboardingDone);
                }}
                className="group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl text-white font-bold shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-95 overflow-hidden min-w-0"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                {/* shine effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                {/* max-w ریسپانسیو: موبایل ۷۲px / تبلت ۱۰۰px / دسکتاپ ۱۲۰px — با truncate نام بلند هیچ‌وقت به آیکون اینستاگرام نمی‌چسبد */}
                <span className="relative text-sm min-w-0 max-w-[72px] sm:max-w-[100px] md:max-w-[120px] truncate">{user.name || "ورزشکار"}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="relative shrink-0"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </button>
            ) : (
              <Button
                size="sm"
                onClick={() => smartNavigate(!!user, setScreen as (s: NavScreen) => void)}
                className="rounded-xl shadow-md text-white"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                شروع
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
          <nav
            className="md:hidden overflow-hidden bg-white border-b animate-fade-in"
          >
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="block w-full text-right px-4 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-2 mt-2 border-t border-slate-100">
                <button
                  onClick={() => scrollTo("#tools")}
                  className="block w-full text-right px-4 py-3 rounded-lg text-sm font-bold text-orange-600 hover:bg-orange-50 transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  ابزارهای رایگان
                </button>
                {TOOL_LINKS.map((tool) => (
                  <button
                    key={tool.screen}
                    onClick={() => { setMobileOpen(false); setScreen(tool.screen); pushScreen(tool.screen, { tool: tool.screen.replace("tool-", "") }); }}
                    className="block w-full text-right px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-600 transition flex items-center gap-2"
                  >
                    {tool.icon && <tool.icon className="w-4 h-4 text-orange-500" />}
                    {tool.label}
                  </button>
                ))}
              </div>
              {/* نصب برنامه */}
              <div className="pt-2 mt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    // Trigger PWA install prompt if available, otherwise show instructions
                    const event = new CustomEvent("show-pwa-install");
                    window.dispatchEvent(event);
                  }}
                  className="block w-full text-right px-4 py-3 rounded-lg text-sm font-bold text-white hover:opacity-90 transition flex items-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                >
                  <Download className="w-4 h-4" />
                  نصب برنامه
                </button>
              </div>
            </div>
          </nav>
      )}
    </header>
  );
}
