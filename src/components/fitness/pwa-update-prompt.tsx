"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";

/**
 * PWA Update Prompt — فلوی به‌روزرسانی امن Service Worker
 *
 * با تغییر sw.js (بمپ CACHE_VERSION)، SW جدید دیگر خودکار skipWaiting نمی‌زند
 * و در حالت waiting می‌ماند. این کامپوننت:
 *   ۱. SW را register می‌کند (idempotent — همان registration برمی‌گردد)
 *   ۲. روی visibilitychange هر بار reg.update() می‌زند (تشخیص نسخه جدید)
 *   ۳. اگر worker در حالت waiting باشد، toast پایین صفحه نشان می‌دهد:
 *      «نسخه جدید فیتاپ آماده است» + دکمه «به‌روزرسانی»
 *   ۴. با کلیک کاربر، پیام SKIP_WAITING به SW می‌رود؛ پس از controllerchange
 *      صفحه فقط یک‌بار reload می‌شود (گارد ضد حلقه با ref).
 */
export function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // === overlay state — مانند PwaInstallPrompt برای جلوگیری از تداخل با Radix (inert) ===
  const overlay = useAppStore((s) => s.overlay);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // در dev همان منطق PwaRegister اعمال می‌شود (unregister) — اینجا کاری نمی‌کنیم
    const isDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isDev) return;

    let cancelled = false;
    let reg: ServiceWorkerRegistration | null = null;

    // فقط وقتی صفحه از قبل SW کنترل‌کننده دارد، worker در حالت waiting
    // یعنی «به‌روزرسانی واقعی» است (در نصب اول هم صفحه controller ندارد)
    const checkWaiting = (registration: ServiceWorkerRegistration | null) => {
      if (!registration || cancelled) return;
      if (navigator.serviceWorker.controller && registration.waiting) {
        setWaitingWorker(registration.waiting);
      }
    };

    (async () => {
      try {
        // register دوم idempotent است — همان registration را برمی‌گرداند
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // اگر از قبل SW در حالت waiting هست (مثلاً کاربر صفحه را بسته و باز کرده)
        checkWaiting(reg);
        reg.addEventListener("updatefound", () => {
          const installing = reg?.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") checkWaiting(reg ?? null);
          });
        });
      } catch {
        // خطای ثبت SW بی‌صدا نادیده گرفته می‌شود — PwaRegister خطا را لاگ می‌کند
      }
    })();

    // برگشت کاربر به تب → بررسی دستی به‌روزرسانی
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && reg) {
        reg.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  function handleUpdate() {
    if (!waitingWorker) {
      setDismissed(true);
      return;
    }
    // پس از فعال شدن SW جدید (controllerchange) صفحه فقط یک‌بار reload می‌شود.
    // گارد ref از حلقه ری‌لود جلوگیری می‌کند (event فقط یک‌بار bind می‌شود).
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        if (reloadingRef.current) return;
        reloadingRef.current = true;
        window.location.reload();
      },
      { once: true }
    );
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  const visible = !!waitingWorker && !dismissed && !overlay;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          // بالای bottom-nav (z-50) و بالای بنر نصب (z-[100]) — با safe-area پایین
          className="fixed inset-x-0 bottom-0 z-[102] max-w-md mx-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          <div
            className="rounded-2xl shadow-2xl border border-orange-200 bg-white overflow-hidden"
            dir="rtl"
          >
            <div className="flex items-center gap-3 p-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">نسخه جدید فیتاپ آماده است</p>
                <p className="text-[11px] text-slate-500">
                  برای دسترسی به بهبودها و رفع اشکال‌ها، به‌روزرسانی کنید.
                </p>
              </div>
              <button
                onClick={() => setDismissed(true)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition shrink-0"
                aria-label="بستن"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 pb-3 flex gap-2">
              <button
                onClick={handleUpdate}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition hover:scale-[1.01] shadow-md"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                به‌روزرسانی
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="rounded-xl py-2.5 px-5 text-sm font-bold border border-orange-200 text-orange-600 bg-white hover:bg-orange-50 transition"
              >
                بعداً
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
