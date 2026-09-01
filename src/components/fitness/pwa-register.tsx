"use client";
import { useEffect } from "react";
import { useAppStore } from "@/lib/fitness/store";
import { PwaUpdatePrompt } from "@/components/fitness/pwa-update-prompt";

/**
 * PWA Service Worker Registration + Push Subscription
 * - در PRODUCTION: ثبت SW + اشتراک push notifications
 * - در DEVELOPMENT: حذف SW ها + پاک کردن cache
 *
 * نوتیف‌های push حتی وقتی اپ بسته باشد نمایش داده می‌شوند، چون service worker
 * در پس‌زمینه اجرا می‌شود و رویداد push را هندل می‌کند.
 */
export function PwaRegister() {
  const { user } = useAppStore();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // فقط localhost/127.0.0.1 به عنوان dev در نظر گرفته می‌شود.
    const isDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isDev) {
      // DEV: حذف SW ها + پاک کردن cache
      navigator.serviceWorker.getRegistrations().then((regs) => {
        if (regs.length > 0) {
          console.log("[PWA] Dev: unregistering " + regs.length + " stale SW(s)");
          regs.forEach((reg) => reg.unregister());
        }
      });
      if ("caches" in window) {
        caches.keys().then((names) => {
          if (names.length > 0) {
            console.log("[PWA] Dev: clearing " + names.length + " cache(s)");
            names.forEach((name) => caches.delete(name));
          }
        });
      }
      return;
    }

    // PRODUCTION: ثبت SW
    let cancelled = false;
    let keepaliveInterval: ReturnType<typeof setInterval> | null = null;
    const register = async () => {
      if (cancelled) return;
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          // type: "module", // اگر نیاز به ES modules در SW باشد
        });
        console.log("[PWA] SW registered:", reg.scope);

        // ⚠️ اینجا دیگر SKIP_WAITING خودکار پست نمی‌شود: با فلوی به‌روزرسانی امن،
        // SW جدید در حالت waiting می‌ماند و PwaUpdatePrompt با تأیید کاربر
        // پیام SKIP_WAITING را می‌فرستد (قبلاً اینجا خودکار پست می‌شد و تب‌های
        // باز بعد از هر دیپلوی chunkهای 404 می‌گرفتند).
        if (reg.installing) {
          await new Promise((resolve) => {
            const sw = reg.installing;
            if (!sw) return resolve(null);
            const stateChangeListener = () => {
              // منتظر activated نمی‌مانیم: SW جدید ممکن است در حالت
              // installed/waiting بماند تا کاربر به‌روزرسانی را تأیید کند —
              // در آن صورت هم push/periodicSync باید راه بیفتد.
              if (
                sw.state === "activated" ||
                sw.state === "installed" ||
                sw.state === "redundant"
              ) {
                sw.removeEventListener("statechange", stateChangeListener);
                resolve(null);
              }
            };
            sw.addEventListener("statechange", stateChangeListener);
            // اگر state هنگام bind قبلاً terminal شده باشد، event نمی‌گیرد
            stateChangeListener();
          });
        }

        // ─── ثبت Periodic Background Sync (Chrome Android) ───
        // این کار SW را هر چند ساعت یک‌بار زنده می‌کند تا نوتیف‌های جدید را بررسی کند.
        // نیاز به permission 'periodic-background-sync' دارد.
        try {
          if ("periodicSync" in reg) {
            const status = await (navigator as any).permissions?.query({
              name: "periodic-background-sync",
            });
            if (status?.state === "granted") {
              await (reg as any).periodicSync.register("fitup-content-sync", {
                minInterval: 12 * 60 * 60 * 1000, // ۱۲ ساعت
              });
              console.log("[PWA] Periodic Sync registered (every 12h)");
            }
          }
        } catch {
          // periodicSync ممکن است در همه مرورگرها موجود نباشد — ignore
        }

        // اگر کاربر لاگین کرده، push subscription را بررسی/ایجاد کن
        if (user && "PushManager" in window) {
          await ensurePushSubscription(reg);
        }

        // ─── Keepalive: هر ۵ دقیقه یک ping به SW بفرست تا زنده بماند ───
        // این کار برای مرورگرهای دسکتاپ که SW را بعد از ۳۰ ثانیه idle می‌بندنند.
        keepaliveInterval = setInterval(() => {
          if (reg.active) {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => {};
            reg.active.postMessage({ type: "KEEPALIVE" }, [channel.port2]);
          }
        }, 5 * 60 * 1000); // ۵ دقیقه
      } catch (err) {
        console.error("[PWA] SW registration failed:", err);
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    return () => {
      cancelled = true;
      if (keepaliveInterval) clearInterval(keepaliveInterval);
    };
  }, [user]);

  // ─── PWA Update Prompt — toast «نسخه جدید فیتاپ آماده است» ───
  // تشخیص SW در حالت waiting (visibilitychange/updatefound) و به‌روزرسانی
  // فقط با تأیید کاربر (SKIP_WAITING + reload یک‌بار).
  return <PwaUpdatePrompt />;
}

/**
 * اطمینان از وجود push subscription معتبر.
 * اگر subscription وجود ندارد یا منقضی شده، آن را تجدید می‌کند.
 * این تابع در هر بار ورود کاربر اجرا می‌شود تا subscription همیشه به‌روز باشد.
 */
async function ensurePushSubscription(reg: ServiceWorkerRegistration) {
  try {
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      // subscription موجود — مطمئن شو در سرور ثبت شده
      try {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing),
        });
      } catch {
        // اگر ثبت ناموفق بود، مشکلی نیست — دفعه بعد دوباره تلاش می‌شود
      }
      return;
    }

    // subscription وجود ندارد — اگر permission داریم، جدید بساز
    if (Notification.permission === "granted") {
      await createSubscription(reg);
    }
    // اگر permission هنوز گرفته نشده، صبر می‌کنیم تا کاربر از تنظیمات اپ درخواست کند
    // (درخواست خودکار permission بدون تعامل کاربر، best practice نیست)
  } catch (err) {
    console.error("[PWA] ensurePushSubscription failed:", err);
  }
}

/**
 * ایجاد subscription جدید با کلید VAPID
 */
async function createSubscription(reg: ServiceWorkerRegistration): Promise<boolean> {
  try {
    // دریافت کلید VAPID از سرور
    const res = await fetch("/api/push/vapid-key");
    if (!res.ok) {
      console.log("[PWA] VAPID key endpoint failed");
      return false;
    }
    const { publicKey } = await res.json();
    if (!publicKey) {
      console.log("[PWA] No VAPID public key");
      return false;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    // ثبت subscription در سرور
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    console.log("[PWA] Push subscription created & registered");
    return true;
  } catch (err) {
    console.error("[PWA] createSubscription failed:", err);
    return false;
  }
}

/**
 * تبدیل VAPID base64url به Uint8Array
 */
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

/**
 * تابع عمومی برای درخواست permission و ایجاد subscription
 * از این تابع در تنظیمات اپ (mobile-app-view) استفاده می‌شود
 * تا کاربر با کلیک روی دکمه، نوتیف را فعال کند.
 */
export async function requestNotificationPermission(): Promise<{
  granted: boolean;
  subscribed: boolean;
  error?: string;
}> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { granted: false, subscribed: false, error: "مرورگر از نوتیف پشتیبانی نمی‌کند" };
  }

  try {
    // ۱. درخواست permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { granted: false, subscribed: false, error: "اجازه نوتیف داده نشد" };
    }

    // ۲. انتظار برای آماده شدن SW
    const reg = await navigator.serviceWorker.ready;

    // ۳. ایجاد subscription
    const subscribed = await createSubscription(reg);
    return { granted: true, subscribed };
  } catch (err: any) {
    return { granted: false, subscribed: false, error: err?.message || "خطا" };
  }
}
