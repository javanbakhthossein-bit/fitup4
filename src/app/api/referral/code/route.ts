import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import {
  DEFAULT_REFERRAL_REWARD_TOMAN,
  REFERRAL_BASE_URL,
  generateUniqueReferralCode,
  getReferralRewardAmount,
} from "@/lib/fitness/referral";

/**
 * GET /api/referral/code
 * کد معرفی کاربر را برمی‌گرداند (در صورت عدم وجود، تولید می‌کند).
 * همچنین آمار معرفی‌ها و پاداش‌های کسب‌شده را محاسبه می‌کند.
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // اگر کاربر کد معرفی ندارد، یک کد جدید تولید کن
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = await generateUniqueReferralCode();
      await db.user.update({
        where: { id: user.id },
        data: { referralCode },
      });
    }

    const referralLink = `${REFERRAL_BASE_URL}/?ref=${referralCode}`;

    // دریافت مبلغ پاداش از دیتابیس (قابل تغییر توسط ادمین)
    const rewardAmount = await getReferralRewardAmount();

    // --- محاسبه‌ی آمار معرفی‌ها ---
    const referrals = await db.user.findMany({
      where: { referredById: user.id },
      select: {
        id: true,
        name: true,
        mobile: true,
        referralRewardPaid: true,
        onboardingDone: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const totalReferrals = referrals.length;
    const successfulReferrals = referrals.filter((r) => r.referralRewardPaid).length;
    const totalEarned = successfulReferrals * rewardAmount;

    // --- لیست معرفی‌های اخیر ---
    const recentReferrals = referrals.slice(0, 20).map((r) => {
      const maskedName = r.name ? maskName(r.name) : maskMobile(r.mobile);
      return {
        id: r.id,
        displayName: maskedName,
        status: r.referralRewardPaid ? "purchased" : "pending",
        createdAt: r.createdAt.toISOString(),
      };
    });

    return Response.json({
      referralCode,
      referralLink,
      stats: {
        totalReferrals,
        successfulReferrals,
        totalEarned,
      },
      recentReferrals,
      rewardAmount,
    });
  } catch (e) {
    return apiError(e);
  }
}

// ماسک کردن نام (نمایش حرف اول + ***)
function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "کاربر فیتاپ";
  const first = trimmed.charAt(0);
  return `${first}***`;
}

// ماسک کردن موبایل (نمایش ۳ رقم اول + **** + ۲ رقم آخر)
function maskMobile(mobile: string): string {
  if (mobile.length < 8) return "۰۹*******";
  return `${mobile.slice(0, 3)}****${mobile.slice(-2)}`;
}
