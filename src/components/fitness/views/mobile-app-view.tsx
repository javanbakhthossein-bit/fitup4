"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Bell,
  Download,
  CheckCircle2,
  Chrome,
  Apple,
  Shield,
  Zap,
  Info,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { isFitUpBazaarApp } from "@/lib/fitness/bazaar-bridge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

// تایپ قبل از install prompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function MobileAppView() {
  const { user } = useAppStore();
  const [isInstalled, setIsInstalled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  // داخل اپ بازار، کارت دانلود مستقیم APK نمایش داده نمی‌شود (سیاست بازار + سردرگمی کاربر)
  const [isBazaarApp, setIsBazaarApp] = useState(false);
  const [hasPushSub, setHasPushSub] = useState(false);
  // ─── state برای دکمه نصب سفارشی ───
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // داخل اپ بازار؟ (کارت APK مخفی بماند)
    setIsBazaarApp(isFitUpBazaarApp());

    const init = () => {
      // ─── تشخیص نصب برنامه ───
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      const installedFlag = (() => {
        try { return localStorage.getItem("pwa_installed") === "1"; } catch { return false; }
      })();
      setIsInstalled(standalone || installedFlag);

      if ("Notification" in window) {
        setNotifPermission(Notification.permission);
      }

      // Check push subscription
      fetch("/api/push/subscribe", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setHasPushSub(d.subscribed || false))
        .catch(() => {});

      // بررسی اینکه آیا قبل‌تر deferredPrompt ذخیره شده (توسط inline script در layout)
      const dp = (window as any).__deferredPrompt as BeforeInstallPromptEvent | undefined;
      if (dp && !deferredPromptRef.current) {
        deferredPromptRef.current = dp;
        setDeferredPrompt(dp);
      }
    };

    Promise.resolve().then(init);

    // ─── گوش دادن به beforeinstallprompt ───
    // preventDefault صدا نمی‌زنیم — Chrome هم آیکون نصب نشان می‌دهد
    const handleBeforeInstallPrompt = (e: Event) => {
      const bte = e as BeforeInstallPromptEvent;
      deferredPromptRef.current = bte;
      setDeferredPrompt(bte);
      (window as any).__deferredPrompt = bte;
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // ─── گوش دادن به appinstalled event ───
    const handleAppInstalled = () => {
      try { localStorage.setItem("pwa_installed", "1"); } catch {}
      setIsInstalled(true);
      setDeferredPrompt(null);
      deferredPromptRef.current = null;
      toast.success("فیتاپ نصب شد! 🎉");
      fetch("/api/pwa/installed", { method: "POST" }).catch(() => {});
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    // ─── گوش دادن به تغییر display-mode ───
    const mql = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => init();
    mql.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mql.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  /**
   * نصب واقعی وب اپ با استفاده از beforeinstallprompt
   *
   * این تابع prompt اصلی مرورگر را صدا می‌زند — یعنی همان تجربه نصب که Chrome
   * ارائه می‌دهد (با دیالوگ نصب رسمی). برنامه کامل نصب می‌شود (نه میانبر).
   * مجزا از اعلان خودکار Chrome — هر دو وجود دارند.
   */
  async function handleInstallApp() {
    const dp = deferredPrompt || deferredPromptRef.current || (window as any).__deferredPrompt;
    if (!dp) {
      // اگر deferredPrompt موجود نیست (مثلاً در iOS Safari یا مرورگرهای قدیمی)
      // راهنمای نصب دستی نشان بده
      toast.info("برای نصب، از آیکون نصب در نوار آدرس مرورگر استفاده کنید یا منوی ۳ نقطه → Install app");
      return;
    }

    setInstalling(true);
    try {
      // نمایش دیالوگ نصب مرورگر
      await dp.prompt();
      // صبر برای انتخاب کاربر
      const choice = await dp.userChoice;
      if (choice.outcome === "accepted") {
        // کاربر نصب را قبول کرد — appinstalled event خودکار fire می‌شود
        try { localStorage.setItem("pwa_installed", "1"); } catch {}
        setIsInstalled(true);
        toast.success("فیتاپ در حال نصب است... 🎉");
      } else {
        // کاربر رد کرد
        toast.info("نصب لغو شد. هر زمان که بخواهید می‌توانید دوباره تلاش کنید.");
      }
      // پاک کردن deferredPrompt (یک بار استفاده می‌شود)
      setDeferredPrompt(null);
      deferredPromptRef.current = null;
      (window as any).__deferredPrompt = null;
    } catch (e: any) {
      console.error("Install prompt error:", e);
      toast.error("خطا در نصب برنامه. لطفاً از آیکون نصب در نوار آدرس مرورگر استفاده کنید.");
    } finally {
      setInstalling(false);
    }
  }

  async function handleEnableNotifications() {
    // ─── داخل اپ بازار: مجوز نیتیو اندروید با پل JS ───
    // web-push/service worker داخل WebView کار نمی‌کند؛ اعلان‌ها از پل
    // FitUpNative.showNotification می‌آیند که به POST_NOTIFICATIONS نیاز دارد.
    // (درخواست مالک: مجوز فقط با توضیح و رضایت، از داخل سایت گرفته شود.)
    if (isFitUpBazaarApp()) {
      try {
        const native = (window as any).FitUpNative;
        if (native?.requestNotificationPermission) {
          native.requestNotificationPermission();
          // در WebView شیء Notification وجود دارد ولی عملاً کار نمی‌کند؛
          // بعد از دیالوگ سیستمی کاربر را راهنمایی می‌کنیم.
          setTimeout(() => {
            toast.success("اعلان‌های فیتاپ فعال شد! ✅");
          }, 800);
          setNotifPermission("granted");
          return;
        }
      } catch {}
    }

    if (!("Notification" in window)) {
      toast.error("مرورگر شما از اعلان‌ها پشتیبانی نمی‌کند");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotifPermission(permission);

    if (permission === "granted") {
      toast.success("اعلان‌ها فعال شد! ✅");

      // Try to subscribe to push
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (vapidKey) {
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
            });
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(sub),
            });
            setHasPushSub(true);
            toast.success("اعلان‌های پوش فعال شد! اکنون حتی وقتی اپ بسته است، اعلان‌ها را دریافت می‌کنید 🔔");
          }
        } catch (e) {
          console.error("Push subscription failed:", e);
        }
      }
    } else if (permission === "denied") {
      toast.error("اعلان‌ها مسدود شده‌اند. برای فعال‌سازی، به تنظیمات مرورگر → Site Settings → Notifications بروید");
    }
  }

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20"
          style={{ background: goldGradient }}
        >
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-900">اپ موبایل فیتاپ</h1>
          <p className="text-xs text-slate-500">نصب برنامه، اعلان‌ها و دسترسی سریع</p>
        </div>
      </div>

      {/* Install Card — دکمه نصب سفارشی + راهنما */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: isInstalled ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)" }}
          >
            {isInstalled ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            ) : (
              <Download className="w-6 h-6 text-orange-500" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-slate-900 mb-1">
              {isInstalled ? "برنامه نصب شده ✅" : "نصب اپلیکیشن فیتاپ"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              {isInstalled
                ? "فیتاپ روی دستگاه شما نصب است. می‌توانید از منوی برنامه‌ها باز کنید."
                : "با نصب فیتاپ، برنامه کامل (نه میانبر) روی دستگاه شما نصب می‌شود. دسترسی سریع، آفلاین و اعلان‌های هوشمند."}
            </p>

            {/* دکمه نصب سفارشی — فقط اگر نصب نشده باشد */}
            {!isInstalled && (
              <div className="space-y-3">
                {/* دکمه نصب اصلی — از beforeinstallprompt استفاده می‌کند */}
                {deferredPrompt ? (
                  <Button
                    onClick={handleInstallApp}
                    disabled={installing}
                    className="rounded-xl text-white gap-2 h-12 w-full font-bold"
                    style={{ background: goldGradient }}
                  >
                    {installing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        در حال نصب...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        نصب اپلیکیشن
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 text-center">
                    <p className="text-xs text-slate-600 mb-2">
                      مرورگر شما از نصب مستقیم پشتیبانی نمی‌کند. از راهنمای زیر استفاده کنید:
                    </p>
                  </div>
                )}

                {/* راهنمای نصب از طریق مرورگر (برای مواردی که deferredPrompt موجود نیست) */}
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">راهنمای نصب دستی</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        اگر دکمه نصب بالا کار نکرد، از آیکون نصب در نوار آدرس مرورگر استفاده کنید.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                    <Chrome className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">اندروید (Chrome)</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        ۱. آیکون نصب <Download className="w-3 h-3 inline" /> در نوار آدرس را بزنید<br />
                        ۲. یا منوی ۳ نقطه → «Install app» را انتخاب کنید<br />
                        ۳. روی «Install» بزنید — برنامه کامل نصب می‌شود
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                    <Apple className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">آیفون (Safari)</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        ۱. روی دکمه Share در پایین Safari بزنید<br />
                        ۲. گزینه «Add to Home Screen» را انتخاب کنید<br />
                        ۳. روی «Add» بزنید — برنامه روی صفحه خانه نصب می‌شود
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Direct APK download — فقط در مرورگر (داخل اپ بازار مخفی — سیاست بازار) */}
      {!isBazaarApp && (
        <Card className="p-5 border-2 border-orange-100">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(245,158,11,0.1)" }}
            >
              <Download className="w-6 h-6 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-slate-900 mb-1">دانلود مستقیم اپ اندروید (APK)</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                نسخه ۱.۴.۰ — با مجوزهای هوشمند (دوربین/میکروفون فقط هنگام استفاده)، اسکرول روان و نصب سریع.
                اگر کافه‌بازار در دسترس نیست، فایل نصبی را مستقیم دریافت کنید.
              </p>
              <a
                href="/downloads/fitup-bazaar-v1.4.0.apk"
                download
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-md transition hover:scale-[1.02]"
                style={{ background: goldGradient }}
              >
                <Download className="w-4 h-4" />
                دریافت فایل نصبی (۷۸۲KB)
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* Notifications */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background:
                notifPermission === "granted"
                  ? "rgba(16,185,129,0.1)"
                  : notifPermission === "denied"
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(245,158,11,0.1)",
            }}
          >
            <Bell
              className={`w-6 h-6 ${
                notifPermission === "granted"
                  ? "text-emerald-500"
                  : notifPermission === "denied"
                  ? "text-red-500"
                  : "text-orange-500"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-slate-900 mb-1">
              {notifPermission === "granted"
                ? "اعلان‌ها فعال ✅"
                : notifPermission === "denied"
                ? "اعلان‌ها مسدود ❌"
                : "اعلان‌ها فعال نیست"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-3 break-words">
              {notifPermission === "granted"
                ? hasPushSub
                  ? "اعلان‌ها حتی با بسته بودن برنامه دریافت می‌شوند."
                  : "اعلان محلی فعال است. برای دریافت اعلان حتی با بسته بودن برنامه، دکمه زیر را بزنید."
                : notifPermission === "denied"
                ? "برای فعال‌سازی، به تنظیمات مرورگر بروید."
                : "یادآوری تمرین و تغذیه را حتی با بسته بودن برنامه دریافت کنید."}
            </p>

            {notifPermission === "granted" && hasPushSub && (
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold break-words mb-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>پوش فعال — اعلان‌ها با بسته بودن برنامه هم ارسال می‌شوند</span>
              </div>
            )}

            {notifPermission === "granted" && hasPushSub && (
              <Button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/notifications/test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                    });
                    if (res.ok) {
                      toast.success("اعلان آزمایشی ارسال شد! اگر آن را ندیدید، تنظیمات مرورگر را بررسی کنید");
                    } else {
                      toast.error("خطا در ارسال اعلان آزمایشی");
                    }
                  } catch {
                    toast.error("خطا در ارسال اعلان آزمایشی");
                  }
                }}
                variant="outline"
                className="rounded-xl gap-2 h-10 w-full border-orange-200 text-orange-600 text-xs"
              >
                <Bell className="w-4 h-4" />
                ارسال اعلان آزمایشی
              </Button>
            )}

            {notifPermission !== "granted" && (
              <Button
                onClick={handleEnableNotifications}
                className="rounded-xl text-white gap-2 h-11 w-full"
                style={{ background: goldGradient }}
              >
                <Bell className="w-4 h-4" />
                {notifPermission === "denied" ? "راهنمای فعال‌سازی اعلان‌ها" : "فعال‌سازی اعلان‌ها"}
              </Button>
            )}

            {notifPermission === "granted" && !hasPushSub && (
              <Button
                onClick={handleEnableNotifications}
                variant="outline"
                className="rounded-xl gap-2 h-11 w-full border-orange-200 text-orange-600"
              >
                <Bell className="w-4 h-4" />
                فعال‌سازی پوش (حتی با بسته بودن برنامه)
              </Button>
            )}

            {notifPermission === "denied" && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-100 p-3">
                <p className="text-[11px] text-red-700 leading-relaxed">
                  برای فعال‌سازی مجدد اعلان‌ها:
                  <br />
                  <strong>اندروید Chrome:</strong> تنظیمات → Site settings → Notifications → اجازه دهید
                  <br />
                  <strong>آیفون Safari:</strong> تنظیمات → Safari → Notifications → اجازه دهید
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Benefits */}
      <Card className="p-5">
        <h3 className="font-bold text-sm text-slate-900 mb-3">مزایای اپ موبایل فیتاپ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Zap, title: "دسترسی سریع", desc: "با یک ضربه از صفحه خانه باز کنید" },
            { icon: Bell, title: "اعلان‌های هوشمند", desc: "یادآوری تمرین و تغذیه به‌موقع" },
            { icon: Shield, title: "حریم خصوصی", desc: "بدون ردیابی، کاملاً امن" },
            { icon: Zap, title: "همیشه در دسترس", desc: "تجربه‌ای سریع و روان" },
          ].map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-orange-50/50 border border-orange-50"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: goldGradient }}
              >
                <b.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{b.title}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}
