"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  X,
  Smartphone,
  Share as ShareIcon,
  Plus,
  CheckCircle2,
  Bell,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { isFitUpBazaarApp } from "@/lib/fitness/bazaar-bridge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA Install Prompt + post-login notification
 *
 * - Listens for `beforeinstallprompt` (Android Chrome) and saves the event.
 * - Shows a one-time bottom banner suggesting installation (after 8s of app use).
 * - On first login (user transitions null → non-null), schedules a DB Notification
 *   suggesting PWA install (5s delay).
 * - Modal shows platform-specific instructions (Android Chrome vs iOS Safari).
 * - Uses localStorage to track `pwa_install_prompted` so we don't nag.
 */
export function PwaInstallPrompt() {
  const { user } = useAppStore();
  const screen = useAppStore((s) => s.screen);
  // ─── در اپ اندروید بازار هیچ پرومپت/مودال نصبی نشان داده نمی‌شود (درخواست مالک) ───
  // کاربر داخل اپ نیتیو است — «نصب اپ فیتاپ روی گوشی خودت» و مودال راهنمای
  // نصب PWA در آنجا بی‌معنا و آزاردهنده است. با فلگ زیر همه مسیرها بی‌اثر می‌شوند.
  const inBazaarApp = isFitUpBazaarApp();
  // === overlay state — برای جلوگیری از تداخل با Radix Dialog (inert) ===
  // وقتی یک Sheet باز است، Radix ویژگی inert را روی sibling portal ها اعمال می‌کند
  // و دکمه ضربدر بنر/مودال نصب کار نمی‌کند. راه‌حل: وقتی overlay باز است، بنر/مودال را مخفی می‌کنیم.
  const overlay = useAppStore((s) => s.overlay);
  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [installChecked, setInstallChecked] = useState(false);

  // visibility نهایی — وقتی overlay باز است، بنر/مودال مخفی می‌شود
  const bannerVisible = showBanner && !overlay;
  const modalVisible = showModal && !overlay;

  // Check if app is installed (standalone mode)
  // ─── چندین روش برای تشخیص نصب ───
  // ۱. display-mode: standalone (استاندارد PWA)
  // ۲. navigator.standalone (iOS Safari)
  // ۳. localStorage flag (بعد از appinstalled event ست می‌شود)
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkInstalled = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      const installedFlag = (() => {
        try { return window.localStorage.getItem("pwa_installed") === "1"; } catch { return false; }
      })();
      const result = standalone || installedFlag;
      setIsInstalled(result);
      return result;
    };

    checkInstalled();

    // ─── گوش دادن به event appinstalled ───
    // این event وقتی fire می‌شود که کاربر واقعاً برنامه را نصب می‌کند (نه shortcut)
    const handleAppInstalled = () => {
      try {
        window.localStorage.setItem("pwa_installed", "1");
        window.localStorage.setItem("pwa_install_prompted", "1");
      } catch {}
      setIsInstalled(true);
      setShowBanner(false);
      setShowModal(false);
      toast.success("فیتاپ روی دستگاه شما نصب شد 🎉");
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    // ─── گوش دادن به تغییر display-mode ───
    // وقتی کاربر از standalone به browser切换 می‌کند یا برعکس
    const mql = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => checkInstalled();
    mql.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("appinstalled", handleAppInstalled);
      mql.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  // isStandalone برای backward compat
  const isStandalone = isInstalled;

  // آیا کاربر ادمین است؟ — ادمین نباید پرومپت نصب ببیند
  const isAdmin = user?.role === "ADMIN";

  // === Only show install prompt in the athlete panel (not landing, not admin, not auth, not onboarding) ===
  // بنر نصب فقط در پنل ورزشکار (main) نمایش داده شود — نه در OTP، لندینگ، آنبوردینگ و غیره
  const shouldShowInstall = !inBazaarApp && user && !isStandalone && !isAdmin && screen === "main";

  // آیا موبایل است؟
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

  // === Capture the beforeinstallprompt event (Android Chrome) ===
  // مهم: preventDefault را صدا نمی‌زنیم تا Chrome خودش آیکون نصب در نوار آدرس نشان دهد.
  // فقط event را در state ذخیره می‌کنیم تا دکمه نصب سفارشی هم بتواند از آن استفاده کند.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // بررسی اینکه آیا قبلاً capture شده (توسط inline script در layout)
    const checkDeferred = () => {
      const dp = (window as any).__deferredPrompt;
      if (dp && !deferredPrompt) {
        setDeferredPrompt(dp);
      }
    };
    checkDeferred();

    const handler = (e: Event) => {
      // preventDefault صدا نمی‌زنیم — Chrome آیکون نصب خود را نشان می‌دهد
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      window.dispatchEvent(new CustomEvent("pwa-install-available"));
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Listen for the custom event from the inline script in layout
    window.addEventListener("pwa-install-available", checkDeferred);

    // === Listen for manual "نصب برنامه" button click from nav menu ===
    const showInstallHandler = () => {
      if (overlayRef.current) return;
      const dp = deferredPrompt || (window as any).__deferredPrompt;
      if (dp) {
        dp.prompt();
      } else {
        setShowModal(true);
      }
    };
    window.addEventListener("show-pwa-install", showInstallHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("pwa-install-available", checkDeferred);
      window.removeEventListener("show-pwa-install", showInstallHandler);
    };
  }, [deferredPrompt]);

  // === Show banner after delay — ONLY in athlete panel ===
  // هوشمند: اگر نصب شده + نوتیف فعال → banner نیاید
  // اگر نصب شده + نوتیف فعال نیست → فقط دکمه فعال‌سازی اعلان
  // اگر نصب نشده → دکمه نصب + (اگر نوتیف فعال نیست) دکمه اعلان
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldShowInstall) return;

    // ─── اگر برنامه نصب شده → فقط در صورت عدم فعال‌سازی نوتیف، banner با دکمه نوتیف ───
    const installed = isInstalled ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      (() => { try { return window.localStorage.getItem("pwa_installed") === "1"; } catch { return false; } })();

    const notifGranted = "Notification" in window && Notification.permission === "granted";

    // اگر نصب شده و نوتیف هم فعال است → banner نیاید
    if (installed && notifGranted) return;

    // ─── باگ قبلی: if (prompted && standalone) return; ───
    // این باعث می‌شد اگر کاربر dismiss کرد (prompted=true) ولی standalone نبود،
    // banner دوباره نشان داده شود. اصلاح: اگر prompted=true، دیگر banner نیاید.
    let prompted = false;
    try {
      prompted = window.localStorage.getItem("pwa_install_prompted") === "1";
    } catch {
      // ignore
    }

    // اگر کاربر قبلاً dismissed کرده یا برنامه نصب شده → فقط اگر نوتیف هم فعال نیست، banner با دکمه نوتیف
    if (prompted) {
      if (installed && !notifGranted) {
        // نصب شده ولی نوتیف فعال نیست → banner با دکمه نوتیف نشان بده
        // (banner نمایش داده می‌شود)
      } else {
        // در هر حالت دیگر، banner نیاید
        return;
      }
    }

    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    const delay = isMobile ? 4000 : 8000;
    const timer = setTimeout(() => setShowBanner(true), delay);
    return () => clearTimeout(timer);
  }, [shouldShowInstall, isInstalled]);

  // === On first login, schedule a DB Notification suggesting PWA install (5s delay) ===
  // فقط برای ورزشکاران (نه ادمین) — و نه داخل اپ بازار (کاربر اپ را دارد)
  useEffect(() => {
    if (!user) return;
    if (user.role === "ADMIN") return; // ادمین نوتیف نصب نگیرد
    if (inBazaarApp) return; // داخل اپ اندروید بازار — نوتیف «اپ نصب کن» بی‌معناست
    let alreadyNotified = false;
    try {
      alreadyNotified = window.localStorage.getItem("pwa_install_notified") === "1";
    } catch {
      // ignore
    }
    if (alreadyNotified) return;
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "system",
            title: "نصب اپلیکیشن فیتاپ 📱",
            body:
              "با نصب برنامه فیتاپ روی گوشی خود، همیشه از برنامه تمرینی، یادآوری‌های تمرین و تغذیه، و اعلان‌های هوشمند باخبر شوید. روی دکمه زیر بزنید تا راهنمای نصب برای دستگاه شما نمایش داده شود.",
            link: null,
            meta: JSON.stringify({ kind: "pwa_install" }),
          }),
        });
        try {
          window.localStorage.setItem("pwa_install_notified", "1");
        } catch {
          // ignore
        }
      } catch {
        // ignore network errors
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [user]);

  function dismissBanner() {
    setShowBanner(false);
    try {
      window.localStorage.setItem("pwa_install_prompted", "1");
    } catch {
      // ignore
    }
  }

  async function handleInstallClick() {
    // Check both state and global
    const dp = deferredPrompt || (window as any).__deferredPrompt;
    if (dp) {
      try {
        await dp.prompt();
        const choice = await dp.userChoice;
        if (choice.outcome === "accepted") {
          // ─── نصب موفق ───
          // appinstalled event ممکن است فوراً fire نشود، پس اینجا هم flag را ست می‌کنیم
          try {
            window.localStorage.setItem("pwa_installed", "1");
            window.localStorage.setItem("pwa_install_prompted", "1");
          } catch {}
          setIsInstalled(true);
          setDeferredPrompt(null);
          (window as any).__deferredPrompt = null;
          setShowBanner(false);
          setShowModal(false);
          toast.success("فیتاپ روی دستگاه شما نصب شد 🎉");
        } else {
          // کاربر dismiss کرد
          try {
            window.localStorage.setItem("pwa_install_prompted", "1");
          } catch {}
          setShowBanner(false);
        }
      } catch (err) {
        console.error("[PWA] install prompt error:", err);
        toast.error("خطا در نصب برنامه. لطفاً از منوی مرورگر «افزودن به صفحه اصلی» را انتخاب کنید.");
        setShowModal(true);
      }
    } else {
      // Otherwise, show the modal with platform-specific instructions
      setShowModal(true);
    }
  }

  function detectPlatform(): "android" | "ios" | "other" {
    if (typeof window === "undefined") return "other";
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
    if (isIOS) return "ios";
    if (/android/.test(ua)) return "android";
    return "other";
  }

  const platform = detectPlatform();

  return (
    <>
      {/* Bottom banner */}
      <AnimatePresence>
        {bannerVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            // On mobile, sit ABOVE the bottom nav (h-16 = 64px + safe-area).
            // On desktop (lg+) where there is no bottom nav, drop to 16px.
            className="fixed inset-x-0 bottom-0 z-[100] max-w-md mx-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
          >
            <div
              className="rounded-2xl shadow-2xl border border-orange-200 overflow-hidden bg-white"
              dir="rtl"
            >
              <div
                className="flex items-center gap-3 p-3"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {isStandalone
                      ? "اعلان‌های هوشمند را فعال کنید"
                      : isMobile
                        ? "فیتاپ را روی گوشی نصب کنید"
                        : "فیتاپ را روی کامپیوتر نصب کنید"}
                  </p>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    {isStandalone
                      ? "یادآوری تمرین و تغذیه را حتی با بسته بودن برنامه دریافت کنید."
                      : isMobile
                        ? "دسترسی سریع، یادآوری تمرین و اعلان‌های هوشمند — همیشه در دسترس."
                        : "دسترسی سریع از دسکتاپ، بدون باز کردن مرورگر — مثل اپلیکیشن."}
                  </p>
                </div>
                <button
                  onClick={dismissBanner}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition shrink-0"
                  aria-label="بستن"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 pb-3 space-y-2">
                {/* دکمه نصب — فقط اگر نصب نشده */}
                {!isStandalone && (
                  <Button
                    onClick={handleInstallClick}
                    className="w-full rounded-xl font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                  >
                    <Download className="w-4 h-4" />
                    {isMobile ? "نصب برنامه" : "نصب روی کامپیوتر"}
                  </Button>
                )}
                {/* دکمه فعال‌سازی اعلان‌ها — فقط اگر نوتیف فعال نیست */}
                {(!("Notification" in window) || Notification.permission !== "granted") && (
                  <Button
                    onClick={async () => {
                      if ("Notification" in window) {
                        const perm = await Notification.requestPermission();
                        if (perm === "granted") {
                          toast.success("اعلان‌ها فعال شد ✅");
                          setShowBanner(false);
                        }
                      }
                    }}
                    variant="outline"
                    className="w-full rounded-xl font-bold border-orange-200 text-orange-600"
                  >
                    <Bell className="w-4 h-4" />
                    فعال‌سازی اعلان‌ها
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal with platform-specific install instructions */}
      <AnimatePresence>
        {modalVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-orange-500" />
                  نصب اپلیکیشن فیتاپ
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                  aria-label="بستن"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                className="rounded-2xl p-4 mb-4 text-white text-sm"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                با نصب فیتاپ روی گوشی خود، همیشه از برنامه تمرینی، یادآوری‌های تمرین و تغذیه، و اعلان‌های هوشمند باخبر شوید.
              </div>

              {platform === "ios" ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-900">راهنمای نصب در iOS (Safari):</p>
                  <ol className="space-y-2.5 text-sm text-slate-700">
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۱</span>
                      <span className="flex-1">روی دکمه <strong>Share</strong> در پایین صفحه بزنید.</span>
                      <ShareIcon className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۲</span>
                      <span className="flex-1">گزینه <strong>Add to Home Screen</strong> را انتخاب کنید.</span>
                      <Plus className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۳</span>
                      <span className="flex-1">روی <strong>Add</strong> بزنید — فیتاپ روی صفحه اصلی شما نصب می‌شود.</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    </li>
                  </ol>
                </div>
              ) : platform === "android" ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-900">راهنمای نصب در اندروید (Chrome):</p>
                  <ol className="space-y-2.5 text-sm text-slate-700">
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۱</span>
                      <span className="flex-1">روی منوی <strong>سه‌نقطه</strong> در گوشه بالا را بزنید.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۲</span>
                      <span className="flex-1">گزینه <strong>افزودن به صفحه اصلی</strong> یا <strong>Install app</strong> را انتخاب کنید.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۳</span>
                      <span className="flex-1">روی <strong>Install</strong> بزنید — فیتاپ روی گوشی شما نصب می‌شود.</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-900">راهنمای نصب روی کامپیوتر:</p>
                  <ol className="space-y-2.5 text-sm text-slate-700">
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۱</span>
                      <span className="flex-1">در نوار آدرس مرورگر (Chrome/Edge)، روی آیکون <strong>نصب</strong> (📍) کلیک کنید.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۲</span>
                      <span className="flex-1">یا از منوی سه‌نقطه، گزینه <strong>Install FitUp</strong> را انتخاب کنید.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0">۳</span>
                      <span className="flex-1">فیتاپ مثل یک اپلیکیشن دسکتاپ نصب می‌شود — بدون نیاز به باز کردن مرورگر.</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    </li>
                  </ol>
                </div>
              )}

              <div className="mt-5 flex gap-2">
                <Button
                  onClick={() => {
                    setShowModal(false);
                    dismissBanner();
                  }}
                  className="flex-1 rounded-xl font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                >
                  متوجه شدم
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
