"use client";

/**
 * بازیابی پرداخت‌های معلق — سمت کلاینت (مشترک بین همه نقاط ورود).
 *
 * باگ «پرداخت موفق ولی در انتظار»: کاربر در درگاه پرداخت می‌کند ولی به هر دلیل
 * (برنگشتن از بانک / خطای موقت / کرش) پلن تحویل نمی‌شود. نقاط بازیابی:
 *  ۱. لود صفحه با ?screen=panel یا ?screen=auth (doAuthCheck در page-client)
 *  ۲. بازدید هر صفحه عمومی توسط کاربر لاگین‌شده (fetchAuthInBackground)
 *  ۳. «همان لحظه‌ی لاگین موفق» در auth-screen — FIX: قبلاً این نقطه وجود نداشت
 *     و بازیابی تا رفرش کامل بعدی عقب می‌افتاد!
 *
 * Throttle: حداکثر یک استعلام در ۱۰ دقیقه به ازای هر tab (sessionStorage).
 */

import { toast } from "sonner";
import { useAppStore } from "@/lib/fitness/store";

const THROTTLE_KEY = "fitap_last_recover";
const THROTTLE_MS = 10 * 60 * 1000;

/** آیا الان زمان استعلام مجدد است؟ (throttle ۱۰ دقیقه‌ای — fail-open) */
export function shouldRecoverNow(): boolean {
  try {
    const last = Number(sessionStorage.getItem(THROTTLE_KEY) || "0");
    if (Date.now() - last < THROTTLE_MS) return false;
    sessionStorage.setItem(THROTTLE_KEY, String(Date.now()));
    return true;
  } catch {
    // sessionStorage غیرقابل دسترس (private mode) — همیشه اجرا کن
    return true;
  }
}

/**
 * استعلام و تحویل پرداخت‌های معلق کاربر فعلی — fire-and-forget.
 * در صورت بازیابی: user در store به‌روز می‌شود + توست موفقیت.
 */
export async function recoverPendingPayments(): Promise<void> {
  try {
    const res = await fetch("/api/payment/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const d = await res.json();
    if (d?.anyRecovered) {
      if (d?.user) useAppStore.getState().setUser(d.user);
      toast.success("پرداخت معلق شما شناسایی و پلن شما فعال شد ✅");
    }
  } catch {
    // بی‌صدا — صفحه اصلی نباید منتظر بماند
  }
}
