"use client";

/**
 * پل اپ کافه‌بازار — توابع سمت سایت برای تعامل با NativeBridge اپ اندروید.
 *
 * همه این توابع خارج از اپ (مرورگر/PWA) no-op یا fallback مرورگر دارند؛
 * اپ فقط وقتی window.FitUpNative را تزریق کرده که داخل WebView فیتاپ هستیم.
 */

/** آیا داخل اپ اندروید کافه‌بازار هستیم؟ */
export function isFitUpBazaarApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!(window as any).FitUpNative?.isBazaarApp?.() === true;
  } catch {
    return false;
  }
}

/**
 * دانلود فایل در اپ (native → Downloads) یا مرورگر (<a download>).
 * dataUrl باید data:...;base64,.... باشد (خروجی html-to-image / jsPDF).
 */
export function downloadDataUrl(filename: string, dataUrl: string): void {
  if (typeof window === "undefined") return;
  if (isFitUpBazaarApp()) {
    try {
      (window as any).FitUpNative?.downloadFile?.(filename, dataUrl);
      return;
    } catch {
      // پل شکست خورد → fallback مرورگر (شاید WebVIew جدیدش را دارد)
    }
  }
  // مرورگر — روش استاندارد
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/** چاپ صفحه فعلی — در اپ از PrintManager اندروید، در مرورگر window.print */
export function printPage(): void {
  if (typeof window === "undefined") return;
  if (isFitUpBazaarApp()) {
    try {
      (window as any).FitUpNative?.printPage?.();
      return;
    } catch {
      // fallback
    }
  }
  window.print();
}

/** consume خرید مصرفی بازار بعد از فعال‌سازی موفق روی سرور */
export function consumeBazaarPurchase(purchaseToken: string): void {
  if (typeof window === "undefined") return;
  try {
    (window as any).FitUpNative?.consumePurchase?.(purchaseToken);
  } catch {
    // no-op
  }
}
