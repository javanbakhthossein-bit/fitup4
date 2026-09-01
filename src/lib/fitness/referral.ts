import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { toPersianDigits } from "@/lib/fitness/types";

/**
 * مبلغ پاداش معرفی به دوست‌دار (به تومان) — پیش‌فرض
 * این مبلغ از SiteSetting خوانده می‌شود تا ادمین بتواند آن را تغییر دهد.
 * کلید: referral_reward_amount
 */
export const DEFAULT_REFERRAL_REWARD_TOMAN = 150_000;

/**
 * دریافت مبلغ پاداش معرفی از دیتابیس (قابل تغییر توسط ادمین)
 */
export async function getReferralRewardAmount(): Promise<number> {
  try {
    const setting = await db.siteSetting.findUnique({
      where: { key: "referral_reward_amount" },
      select: { value: true },
    });
    if (setting) {
      const val = parseInt(setting.value, 10);
      if (!isNaN(val) && val > 0) {
        // سقف ایمن (ممیزی 2-c P2): مقدار ۹رقمی (خطای تایپی ادمین) پرداخت نمی‌شود
        return Math.min(val, 10_000_000);
      }
    }
  } catch {
    // DB may not be available — use default
  }
  return DEFAULT_REFERRAL_REWARD_TOMAN;
}

// دامنه‌ی اصلی برای لینک معرفی (در صورت تنظیم در env از همان استفاده می‌شود)
export const REFERRAL_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://fittup.ir";

// الفبای کد معرفی — بدون کاراکترهای مبهم (0/O, 1/I/L)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * تولید کد معرفی منحصربه‌فرد در قالب FIT-XXXXXX (۶ کاراکتر تصادفی + پیشوند FIT-).
 * در صورت تکرار (احتمال بسیار کم) تا ۵ بار تلاش می‌شود.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = randomBytes(6);
    let code = "FIT-";
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    const exists = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  // fallback با timestamp برای اطمینان از یکتایی
  return `FIT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * پردازش پاداش معرفی پس از خرید موفق اولین پلن.
 *
 * شرایط:
 *  - کاربر جدید (خریدار) باید referredById داشته باشد.
 *  - پاداش هنوز پرداخت نشده باشد (referralRewardPaid === false).
 *  - این اولین خرید پلن کاربر باشد (تعداد subscription‌های قبلی = 0).
 *
 * در صورت موفقیت:
 *  - ۱۵۰,۰۰۰ تومان به کیف پول خریدار اضافه می‌شود.
 *  - ۱۵۰,۰۰۰ تومان به کیف پول معرف اضافه می‌شود.
 *  - referralRewardPaid برای خریدار روی true قرار می‌گیرد.
 *  - تراکنش کیف پول و نوتیفیکیشن برای هر دو طرف ثبت می‌شود.
 *
 * @returns وضعیت پرداخت پاداش (true = پرداخت شد، false = شرایط برقرار نبود)
 */
export async function processReferralReward(opts: {
  buyerUserId: string;
  paymentId: string;
}): Promise<boolean> {
  const { buyerUserId, paymentId } = opts;

  // کاربر خریدار را به‌همراه معرفش بارگذاری کن
  const buyer = await db.user.findUnique({
    where: { id: buyerUserId },
    select: {
      id: true,
      referredById: true,
      referralRewardPaid: true,
      mobile: true,
      name: true,
    },
  });

  if (!buyer) return false;
  if (!buyer.referredById) return false;
  if (buyer.referralRewardPaid) return false;

  // بررسی اینکه این اولین خرید پلن کاربر است یا خیر
  // (تعداد subscription‌های قبلی با وضعیت active/expired — به‌جز همین خرید جدید)
  const priorSubsCount = await db.subscription.count({
    where: { userId: buyerUserId },
  });
  // اگر بیشتر از ۱ subscription دارد، یعنی قبلاً پلن خریده بوده
  // (۱ subscription همان است که همین الان در verify ایجاد شده)
  if (priorSubsCount > 1) return false;

  // معرف را بارگذاری کن
  const referrer = await db.user.findUnique({
    where: { id: buyer.referredById },
    select: { id: true, walletBalance: true, mobile: true, name: true },
  });
  if (!referrer) return false;

  // دریافت مبلغ پاداش از دیتابیس (قابل تغییر توسط ادمین)
  const REFERRAL_REWARD_TOMAN = await getReferralRewardAmount();

  // متن نوتیفیکیشن با مبلغ واقعی (قابل تنظیم توسط ادمین) ساخته می‌شود —
  // قبلاً «۱۵۰,۰۰۰ تومان» hardcode بود و با تغییر تنظیمات غلط می‌شد.
  const rewardTomanFa = toPersianDigits(REFERRAL_REWARD_TOMAN.toLocaleString("en-US"));

  // --- اعتبار پاداش به خریدار و معرف — اتمیک در یک $transaction ---
  // FIX lost-update: قبلاً موجودی معرف زودتر خوانده می‌شد و به‌صورت مطلق
  // نوشته می‌شد؛ دو خرید همزمان با یک معرف، پاداش یکدیگر را overwrite می‌کرد.
  // حالا increment اتمیک استفاده می‌شود و snapshot موجودی (balance) هم بعد
  // از increment از DB خوانده می‌شود تا دفتر WalletTransaction دقیق بماند.
  await db.$transaction(async (tx) => {
    // --- اعتبار پاداش به خریدار ---
    await tx.user.update({
      where: { id: buyerUserId },
      data: {
        walletBalance: { increment: REFERRAL_REWARD_TOMAN },
        referralRewardPaid: true,
      },
    });
    const buyerFresh = await tx.user.findUnique({
      where: { id: buyerUserId },
      select: { walletBalance: true },
    });
    const buyerNewBalance = buyerFresh?.walletBalance ?? 0;
    await tx.walletTransaction.create({
      data: {
        userId: buyerUserId,
        type: "bonus",
        amount: REFERRAL_REWARD_TOMAN,
        balance: buyerNewBalance,
        description: `پاداش معرفی به دوست‌دار — ${rewardTomanFa} تومان`,
        refId: paymentId,
      },
    });

    // --- اعتبار پاداش به معرف ---
    await tx.user.update({
      where: { id: referrer.id },
      data: { walletBalance: { increment: REFERRAL_REWARD_TOMAN } },
    });
    const referrerFresh = await tx.user.findUnique({
      where: { id: referrer.id },
      select: { walletBalance: true },
    });
    const referrerNewBalance = referrerFresh?.walletBalance ?? 0;
    await tx.walletTransaction.create({
      data: {
        userId: referrer.id,
        type: "bonus",
        amount: REFERRAL_REWARD_TOMAN,
        balance: referrerNewBalance,
        description: `پاداش معرفی دوست به فیتاپ — ${rewardTomanFa} تومان`,
        refId: paymentId,
      },
    });
  });

  // نوتیفیکیشن‌ها بیرون از تراکنش — خطای نوتیف نباید پاداش را rollback کند
  await db.notification.create({
    data: {
      userId: buyerUserId,
      type: "achievement",
      title: "پاداش معرفی به دوست‌دار! 🎁",
      body: `پاداش معرفی به دوست‌دار: ${rewardTomanFa} تومان به کیف پول شما اضافه شد! 🎁`,
      link: "?tab=referral",
      meta: JSON.stringify({ type: "referral_reward", amount: REFERRAL_REWARD_TOMAN }),
      read: false,
    },
  });

  await db.notification.create({
    data: {
      userId: referrer.id,
      type: "achievement",
      title: "پاداش معرفی به دوست‌دار! 🎁",
      body: `پاداش معرفی به دوست‌دار: ${rewardTomanFa} تومان به کیف پول شما اضافه شد! 🎁`,
      link: "?tab=referral",
      meta: JSON.stringify({ type: "referral_reward", amount: REFERRAL_REWARD_TOMAN }),
      read: false,
    },
  });

  return true;
}
