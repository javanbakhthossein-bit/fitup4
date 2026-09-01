import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getReferralRewardAmount } from "@/lib/fitness/referral";

/**
 * GET /api/referral/info?code=FIT-XXXXXX
 * مسلماً عمومی (بدون نیاز به auth) — برای صفحه‌ی لندینگ رفرال.
 *
 * خروجی در صورت معتبر بودن کد:
 *   { valid: true, referrerName: "م***", rewardAmount: 150000 }
 *
 * خروجی در صورت نامعتبر بودن کد:
 *   { valid: false }
 *
 * referrerName نام معرف را به‌صورت ماسک‌شده (حرف اول + ***) برمی‌گرداند تا
 * حریم خصوصی کاربر حفظ شود و در عین حال اعتماد کاربر جدید جلب گردد.
 */
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
    if (!code) {
      return Response.json({ valid: false });
    }

    // جستجوی کاربر با کد معرفی
    const referrer = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true, name: true, mobile: true },
    });

    if (!referrer) {
      return Response.json({ valid: false });
    }

    // مبلغ پاداش از SiteSetting (قابل تغییر توسط ادمین)
    const rewardAmount = await getReferralRewardAmount();

    // نام ماسک‌شده — اولویت با نام، در غیر این صورت موبایل ماسک‌شده
    const referrerName = maskName(referrer.name, referrer.mobile);

    return Response.json({
      valid: true,
      referrerName,
      rewardAmount,
    });
  } catch {
    return Response.json({ valid: false });
  }
}

// ماسک کردن نام (نمایش حرف اول + ***)
function maskName(name: string | null, mobile: string): string {
  if (name && name.trim()) {
    const trimmed = name.trim();
    return `${trimmed.charAt(0)}***`;
  }
  // fallback به موبایل ماسک‌شده
  if (mobile && mobile.length >= 8) {
    return `${mobile.slice(0, 3)}****${mobile.slice(-2)}`;
  }
  return "کاربر فیتاپ";
}
