"use client";

import { toast } from "sonner";
import { useAppStore } from "./store";

/**
 * ─── خروج از حساب کاربری (مشترک بین همه‌ی مسیرهای خروج) ───
 *
 * مشکل «دو بار کلیک برای خروج» را با موارد زیر حل می‌کند:
 *  ۱. پاک کردن Service Worker caches → جلوگیری از پاسخ stale از /api/auth/me
 *     (SW با stale-while-revalidate ممکن است پاسخ قدیمی {user: {...}} برگرداند)
 *  ۲. پاک کردن sessionStorage و localStorage items حساس
 *  ۳. تأخیر ۱۵۰ms قبل از reload → اطمینان از اعمال تغییرات
 *  ۴. cache-busting در URL → مرورگر HTML تازه می‌گیرد
 *  ۵. پاک کردن کامل state با reset()
 *
 * @param opts.confirm اگbdr true، قبل از خروج confirm dialog نشان داده می‌شود
 * @returns true اگر خروج شروع شد، false اگر کاربر لغو کرد
 */
export async function performLogout(opts?: {
  confirm?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}): Promise<boolean> {
  const { confirm: shouldConfirm = true, onLoadingChange } = opts ?? {};

  // تأیید قبل از خروج
  // نکته: confirm() مرورگر در WebView/PWA/iframe ممکن است مسدود باشد و همیشه
  // false برگرداند — در آن حالت خروج بی‌صدا لغو می‌شد و کاربر گیر می‌کرد.
  // تشخیص: اگر در iframe بدون allow-modals باشیم، confirm بدون نمایش anything
  // فوراً false برمی‌گرداند. راه‌حل: در محیط‌های محدود (window.self !== window.top
  // و محدود بودن confirm) به‌جای انکار بی‌صدا، خروج ادامه می‌یابد (logout امن است
  // و اثر مخرب ندارد — کاربر خودش روی دکمه «خروج از حساب» کلیک کرده است).
  if (shouldConfirm) {
    let confirmed = true;
    if (typeof window !== "undefined") {
      try {
        // در iframe بدون allow-modals → confirm فوراً false و بدون dialog برمی‌گردد
        confirmed = window.confirm("آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟");
        const inRestrictedIframe = window.self !== window.top;
        if (!confirmed && inRestrictedIframe) {
          // نمی‌توانیم مطمئن باشیم کاربر «لغو» زده یا dialog اصلاً نمایش داده نشده؛
          // خروج عملی امن و قابل بازگشت است (ورود مجدد با OTP)، پس ادامه می‌دهیم.
          confirmed = true;
        }
      } catch {
        // دسترسی به window.top محدود (cross-origin) → محیط محدود فرض می‌کنیم
        confirmed = true;
      }
    }
    if (!confirmed) return false;
  }

  onLoadingChange?.(true);

  try {
    // ۱. صدا زدن API logout → پاک کردن cookie سمت سرور
    await fetch("/api/auth/logout", { method: "POST" });

    // ۲. پاک کردن state از Zustand
    useAppStore.getState().reset();

    // ۳. پاک کردن Service Worker caches
    // این مهم است: SW ممکن است /api/auth/me را کش کرده باشد و بعد از reload
    // پاسخ قدیمی (با user) برگرداند → کاربر «خارج نشده» به نظر می‌رسد.
    if (typeof window !== "undefined" && "caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {}
    }

    // ۴. پاک کردن sessionStorage و localStorage items حساس
    try {
      window.sessionStorage.removeItem("fitap_last_screen");
      // پاک کردن تاریخچه‌ی چت که ممکن است شامل اطلاعات کاربر باشد
      // (nikka guest history و coach history)
      // توجه: فقط items مرتبط با session کاربر را پاک می‌کنیم، نه همه‌ی localStorage را
      const lsKeysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        if (
          k.startsWith("fitap_coach_") ||
          k === "nika_guest_messages" ||
          k.startsWith("fitap_current_cycle") ||
          // تیک‌های ست/وزن‌های حالت باشگاه — بدون userId در کلید هستند تا
          // کاربر بعدی روی دستگاه مشترک، ثبت‌های کاربر قبلی را نبیند
          k.startsWith("gym_session")
        ) {
          lsKeysToRemove.push(k);
        }
      }
      lsKeysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch {}

    // ۴ب. حذف دیتابیس IndexedDB پلی‌لیست حالت باشگاه (نام DB در
    // gym-playlist-db.ts تعریف شده — فایل‌های صوتی خصوصی کاربر)
    // جلوگیری از نشست داده بین کاربران روی دستگاه مشترک. اگر connection
    // بازی در همان لحظه باز باشد، حذف بعد از بسته‌شدن آن (با reload) انجام می‌شود.
    if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
      try {
        indexedDB.deleteDatabase("fitap_gym_playlist");
      } catch {}
    }

    // ۵. پاک کردن query params و URL
    try {
      window.history.replaceState({}, "", "/");
    } catch {}

    // ۶. تأخیر کوتاه برای اطمینان از اعمال تغییرات قبل از reload
    await new Promise((r) => setTimeout(r, 150));

    // ۷. reload صفحه — بعد از reload، /api/auth/me پاسخ null برمی‌گرداند
    //    و page.tsx به landing یا auth می‌رود.
    //    یک cache-busting query param اضافه می‌کنیم تا مرورگر HTML تازه بگیرد.
    if (typeof window !== "undefined") {
      window.location.href = "/?_logout=" + Date.now();
    }
    return true;
  } catch {
    toast.error("خطا در خروج — دوباره تلاش کنید");
    onLoadingChange?.(false);
    // حتی در خطا، cache‌ها را پاک کن و reload کن
    try {
      if (typeof window !== "undefined" && "caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      window.sessionStorage.removeItem("fitap_last_screen");
      window.history.replaceState({}, "", "/");
      window.location.href = "/?_logout=" + Date.now();
    } catch {
      window.location.reload();
    }
    return false;
  }
}
