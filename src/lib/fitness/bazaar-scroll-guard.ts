/**
 * ─── گارد اسکرول اپ بازار (رفع باگ pull-to-refresh) ───
 *
 * باگ گزارش‌شده مالک: «در اپ موبایل در منوی پروفایل اسکرول به بالا کار
 * نمی‌کنه و رفرش می‌کنه چون باید بکشیم به پایین» — و این مشکل در هیچ جای
 * اپ موبایل نباید وجود داشته باشد.
 *
 * ریشه: NativeSwipeRefreshLayout فقط scrollY خودِ WebView را می‌بیند. محتوای
 * اسکرول‌شونده‌ی «داخلی» (Sheet پروفایل، لیست‌های overflow-y و…) برای آن
 * نامرئی است؛ وقتی کاربر داخل این عناصر به بالا اسکرول می‌کند (انگشت به
 * پایین)، رفرش فعال می‌شود و کل صفحه ریلود می‌شود.
 *
 * فیکس: در شروع هر لمس، اگر نقطه‌ی لمس داخل یک عنصر اسکرول‌شونده‌ی داخلی
 * باشد (یا صفحه در حال حاضر scroll دارد)، رفرشِ نیتیو با پل
 * FitUpNative.setSwipeRefreshEnabled(false) قفل می‌شود و بعد از پایان لمس
 * دوباره باز می‌شود. نتیجه: رفرش فقط از «واقعاً بالای صفحه‌ی اصلی» کار
 * می‌کند و هیچ‌وقت با اسکرول داخلی تداخل ندارد.
 */

type BazaarNativeBridge = {
  setSwipeRefreshEnabled?: (enabled: boolean) => void;
};

function native(): BazaarNativeBridge | null {
  try {
    return (window as any).FitUpNative ?? null;
  } catch {
    return null;
  }
}

/** نزدیک‌ترین والدِ اسکرول‌شونده‌ی هدف لمس را پیدا می‌کند */
function findScrollableAncestor(el: Element | null): HTMLElement | null {
  let cur = el;
  while (cur && cur !== document.documentElement) {
    if (cur instanceof HTMLElement) {
      const style = window.getComputedStyle(cur);
      const ov = (style.overflowY || style.overflow || "");
      const scrollable = /auto|scroll/.test(ov) && cur.scrollHeight > cur.clientHeight + 1;
      if (scrollable) return cur;
    }
    cur = cur.parentElement ?? (cur.getRootNode() as any)?.host ?? null;
  }
  return null;
}

let guardInstalled = false;

/** نصب گارد — فقط داخل اپ کافه‌بازار فراخوانی شود */
export function installBazaarScrollGuard() {
  if (typeof window === "undefined" || guardInstalled) return;
  guardInstalled = true;

  const setNative = (enabled: boolean) => {
    try {
      native()?.setSwipeRefreshEnabled?.(enabled);
    } catch {}
  };

  const isTouchLocked = () => {
    // صفحه‌ی اصلی خودش اسکرول دارد → قفل رفرش تا اسکرول صفحه کار کند
    if ((document.scrollingElement?.scrollTop ?? 0) > 0) return true;
    return false;
  };

  // وضعیت پایه: طبق موقعیت اسکرول صفحه
  const syncIdleState = () => setNative(!isTouchLocked());

  window.addEventListener(
    "touchstart",
    (e) => {
      try {
        const target = e.target as Element | null;
        const scrollable = findScrollableAncestor(target);
        if (scrollable || isTouchLocked()) {
          // لمس روی عنصر داخلیِ اسکرول‌شونده شروع شد → رفرش قفل
          setNative(false);
        } else {
          setNative(!isTouchLocked());
        }
      } catch {}
    },
    { capture: true, passive: true }
  );

  window.addEventListener(
    "touchend",
    () => {
      // کمی تأخیر تا رفرش احتمالی در حال انجام جمع شود، بعد بازگردان
      setTimeout(syncIdleState, 150);
    },
    { capture: true, passive: true }
  );

  window.addEventListener(
    "touchcancel",
    () => {
      setTimeout(syncIdleState, 150);
    },
    { capture: true, passive: true }
  );

  // همگام‌سازی دوره‌ای موقع idle (مثلاً بعد از اسکرولِ خود صفحه)
  window.addEventListener(
    "scroll",
    () => {
      // اگر انگشی روی صفحه نیست، وضعیت idle را اعمال کن
      setTimeout(() => {
        if (!document.querySelector(":hover")) syncIdleState();
      }, 100);
    },
    { capture: true, passive: true }
  );
}
