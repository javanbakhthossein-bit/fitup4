/**
 * تحویل خرید پلن — هسته مشترک بین verify و recover و (بازگشت از درگاه).
 *
 * چرا این فایل وجود دارد؟
 *  ─── باگ «پرداخت موفق ولی در پنل در انتظار می‌ماند» ───
 *  سناریوی واقعی که کاربران داشتند: کاربر در درگاه زرین‌پال پرداخت می‌کند؛
 *  سرور verify زرین‌پال را صدا می‌زند (پول تایید می‌شود) اما پیش از commit
 *  نهایی DB (کرش/ری‌استارت/timeout گیت‌وی) پروسه می‌میرد. رکورد Payment
 *  pending می‌ماند. بازگشت دوم کاربر → زرین‌پال کد ۱۰۱ («قبلاً verify شده»)
 *  می‌دهد → منطق قبلی این را «replay» تلقی و پرداخت را failed می‌کرد:
 *  پول گرفته شد، پلن تحویل نشد، برنامه ساخته نشد، ادمین دستی فعال می‌کرد.
 *
 *  این کتابخانه + سیاست کد ۱۰۱ (پایین) + endpoint بازیابی (recover) + جاروی
 *  cron این کلاس باگ را در همه مسیرها ریشه‌کن می‌کند.
 *
 * سیاست کد ۱۰۱ (alreadyVerified) — جدید:
 *   • اگر Payment موفق «دیگری» با همان authority وجود دارد → replay واقعی → رد
 *   • در غیر این صورت → این authority پرداخت شده است (معمولاً یعنی تلاش قبلی
 *     ما پیش از commit مرده) → تحویل قطعی پلن
 *
 * سیافت خطای شبکه (transport):
 *   • خطای شبکه زرین‌پال ≠ پرداخت ناموفق → claim آزاد می‌شود (pending می‌ماند)
 *     و بعداً recover/کرون دوباره تلاش می‌کند. هرگز failed نمی‌شود.
 */

import { db } from "@/lib/db";
import { buildUserDto } from "@/lib/fitness/auth";
import { toPersianDigits, type Plan } from "@/lib/fitness/types";
import { getActivePlan } from "@/lib/fitness/pricing";
import { processReferralReward } from "@/lib/fitness/referral";
import { createNotification } from "@/lib/fitness/notifications";
import { PENDING_WINDOW_DAYS } from "@/lib/fitness/subscription";
import { startProgramGenerationInBackground } from "@/lib/fitness/program-generation";

/** خطای کد تخفیف نامعتبر — message همان متن فارسی پاسخ 400 */
export class DiscountInvalidError extends Error {}

export interface ComputedAmount {
  finalAmount: number;
  originalAmount: number;
  discountValue: number;
  discountCode: string | null;
  userDiscountCodeUsed: boolean;
  upgradeCredit: number;
  isUpgrade: boolean;
}

/**
 * محاسبه مبلغ نهایی خرید پلن — همان منطق checkout (قیمت - تخفیف - اعتبار ارتقا).
 * استفاده مشترک: checkout / bazaar dynamic-price / bazaar purchase (ثبت مبلغ واقعی).
 * خطا: DiscountInvalidError با پیام فارسی (کالر → 400).
 */
export async function computePlanFinalAmount(
  userId: string,
  plan: { id: string; price: number },
  opts: { discountCode?: string; userDiscountCode?: string } = {}
): Promise<ComputedAmount> {
  let finalAmount = plan.price;
  const originalAmount = plan.price;
  let discountValue = 0;
  let appliedCode: string | null = null;
  let userDiscountCodeUsed = false;
  let upgradeCredit = 0;
  let isUpgrade = false;

  // ─── تخفیف عمومی ───
  if (opts.discountCode) {
    const code = opts.discountCode.trim().toUpperCase();
    const dc = await db.discountCode.findUnique({ where: { code } });
    if (!dc || !dc.active) throw new DiscountInvalidError("کد تخفیف نامعتبر است.");
    if (dc.validUntil && dc.validUntil < new Date())
      throw new DiscountInvalidError("کد تخفیف منقضی شده است.");
    if (dc.maxUses !== -1 && dc.usedCount >= dc.maxUses)
      throw new DiscountInvalidError("سقف استفاده از این کد تخفیف تکمیل شده است.");
    if (dc.applicablePlans !== "all") {
      const allowed = dc.applicablePlans.split(",");
      if (!allowed.includes(plan.id))
        throw new DiscountInvalidError("این کد تخفیف برای پلن انتخاب‌شده قابل استفاده نیست.");
    }
    appliedCode = dc.code;
    discountValue =
      dc.type === "percent"
        ? Math.round((originalAmount * dc.value) / 100)
        : Math.min(dc.value, originalAmount);
  }

  // ─── کد اختصاصی کاربر (اولویت روی کد عمومی) ───
  if (opts.userDiscountCode) {
    const code = opts.userDiscountCode.trim().toUpperCase();
    const udc = await db.userDiscountCode.findUnique({ where: { code } });
    if (!udc) throw new DiscountInvalidError("کد تخفیف اختصاصی یافت نشد.");
    if (udc.userId !== userId)
      throw new DiscountInvalidError("این کد تخفیف متعلق به حساب شما نیست.");
    if (udc.isUsed) throw new DiscountInvalidError("این کد تخفیف قبلاً استفاده شده است.");
    if (udc.validUntil && udc.validUntil < new Date())
      throw new DiscountInvalidError("کد تخفیف اختصاصی منقضی شده است.");
    // کد اختصاصی بر کد عمومی ارجحیت دارد
    if (appliedCode) {
      discountValue = 0;
      appliedCode = null;
    }
    appliedCode = udc.code;
    userDiscountCodeUsed = true;
    discountValue =
      udc.type === "percent"
        ? Math.round((originalAmount * udc.value) / 100)
        : Math.min(udc.value, originalAmount);
  }

  // ─── اعتبار ارتقا ───
  const now = new Date();
  const [activeSub, pendingSubs] = await Promise.all([
    db.subscription.findFirst({
      where: { userId, status: "active", endDate: { gt: now } },
      orderBy: { endDate: "desc" },
    }),
    db.subscription.findMany({
      where: {
        userId,
        status: "pending",
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (activeSub && activeSub.endDate && activeSub.plan !== plan.id) {
    const oldPlan = await getActivePlan(activeSub.plan as Plan);
    if (oldPlan) {
      const daysLeft = activeSub.endDate
        ? Math.ceil((activeSub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      if (daysLeft > 0) {
        upgradeCredit = Math.round((activeSub.pricePaid / activeSub.durationDays) * daysLeft);
        isUpgrade = true;
      }
    }
  }
  for (const pSub of pendingSubs) {
    upgradeCredit += pSub.pricePaid;
    isUpgrade = true;
  }

  finalAmount = Math.max(0, originalAmount - discountValue - upgradeCredit);

  return {
    finalAmount,
    originalAmount,
    discountValue,
    discountCode: appliedCode,
    userDiscountCodeUsed,
    upgradeCredit,
    isUpgrade,
  };
}

/** خطای داخلی برای کسر ناموفق کیف پول (تراکنش اتمیک rollback می‌شود) */
export class WalletInsufficientError extends Error {
  constructor() {
    super("INSUFFICIENT_WALLET");
  }
}

/** حداکثر عمر وضعیت "verifying" قبل از اینکه پرداخت «گیرکرده» تلقی شود */
export const VERIFYING_STUCK_MS = 15 * 60 * 1000; // ۱۵ دقیقه

/** بازه پرداخت‌هایی که recover باید پوشش دهد (از تاریخ ایجاد) */
export const RECOVER_WINDOW_MS = 72 * 60 * 60 * 1000; // ۷۲ ساعت

/**
 * ─── برش بازیابی خودکار (Legacy Cutoff) ───
 *
 * درخواست صریح مالک: پرداخت‌های معلقِ «قبل از» این نسخه نباید هرگز به‌صورت
 * خودکار تحویل شوند — بعضی از آن‌ها را ادمین «دستی» فعال کرده (اگر تحویل
 * خودکار می‌شد، اشتراک دوم روی قبلی سوار می‌شد) و بقیه اصلاً پرداخت نکرده‌اند
 * (فقط وارد درگاه شده و خارج شده‌اند). این‌ها در لحظه استقرار نسخه جدید یک‌بار
 * برای همیشه به وضعیت manual_resolved («رسیدگی دستی») بسته می‌شوند تا:
 *   ۱) کرون/بازیابی خودکار هرگز سراغشان نرود
 *   ۲) در پنل ادمین به‌عنوان «در انتظار» دروغین باقی نمانند
 * فقط پرداخت‌های ایجادشده «بعد از» این لحظه مشمول بازیابی خودکار هستند.
 */
const RECOVERY_CUTOFF_SETTING = "payment_auto_recover_start";

/**
 * مهلت ۴۵ دقیقه‌ای برای کاربرانی که «همین حالا» داخل درگاه زرین‌پال هستند:
 * پرداخت‌های ایجادشده در ۴۵ دقیقه آخر قبل از استقرار، pending می‌مانند و جاروی
 * جدید همچنان پوششان می‌دهد (کاربر که برمی‌گردد تحویل می‌گیرد) — چون سشن درگاه
 * حداکثر ~۱۵ دقیقه است، ۴۵ دقیقه خیلی امن است. قدیمی‌ترها = قطعاً legacy.
 */
const RECOVERY_CUTOFF_GRACE_MS = 45 * 60 * 1000;

/** نتیجه getRecoveryCutoff — firstRun یعنی تنظیم همین حالا ایجاد شد */
export interface RecoveryCutoffInfo {
  cutoff: Date;
  /** true = این فراخوان مقدار را ایجاد کرد (legacy sweep باید اجرا شود) */
  firstRun: boolean;
}

export async function getRecoveryCutoff(): Promise<RecoveryCutoffInfo> {
  const existing = await db.siteSetting.findUnique({
    where: { key: RECOVERY_CUTOFF_SETTING },
  });
  if (existing) {
    const d = new Date(existing.value);
    if (!isNaN(d.getTime())) return { cutoff: d, firstRun: false };
  }

  // اولین اجرا (بعد از deploy) — مقدار را «۴۵ دقیقه قبل از الان» قفل کن تا
  // خریدارهای در-حال-پرداخت هم پوشش داده شوند (race-safe با کلید یکتا)
  const effectiveCutoff = new Date(Date.now() - RECOVERY_CUTOFF_GRACE_MS);
  try {
    await db.siteSetting.create({
      data: {
        key: RECOVERY_CUTOFF_SETTING,
        value: effectiveCutoff.toISOString(),
        label: "شروع بازیابی خودکار پرداخت‌ها (پیش از این: رسیدگی دستی)",
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      // فراخوان موازی برنده شد — مقدارش معتبر است
      const winner = await db.siteSetting.findUnique({
        where: { key: RECOVERY_CUTOFF_SETTING },
      });
      if (winner) {
        const d = new Date(winner.value);
        if (!isNaN(d.getTime())) return { cutoff: d, firstRun: false };
      }
      return { cutoff: effectiveCutoff, firstRun: false };
    }
    throw e;
  }

  // ─── FIX (درخواست مالک ۱۴۰۵-۰۶: «همه پرداخت‌های موفق وریفای شوند») ───
  // قبلاً: همه معلق‌های قدیمی‌تر از برش «کورکورانه» manual_resolved می‌شدند —
  // حتی پرداخت‌هایی که کاربر واقعاً پول داده بود! حالا معلق‌های legacy با
  // استعلام واقعی زرین‌پال تعیین‌تکلیف می‌شوند (resolveLegacyPendingPayments
  // توسط کرون/جاروی داخلی صدا زده می‌شود):
  //   • زرین‌پال پرداخت را تأیید کند (100/101) → تحویل کامل پلن/کیف پول
  //   • پاسخ قطعی منفی → manual_resolved (رسیدگی دستی — پولی نداده)
  //   • خطای شبکه → pending می‌ماند (جاروی بعدی دوباره)
  return { cutoff: effectiveCutoff, firstRun: true };
}

/**
 * تعیین‌تکلیف آگاهانه معلق‌های legacy (قدیمی‌تر از برش) — به‌جای بستن کورکورانه.
 *
 * فقط همان‌جا اجرا می‌شود که cutoff «برای اولین بار» ایجاد شده (firstRun).
 * برای هر پرداخت معلق قدیمی:
 *  - درگاهی + authority → zarinpalVerify (استعلام واقعی پول):
 *      • ok (100/101 بدون replay) → تحویل پلن یا شارژ کیف پول → success
 *      • خطای قطعی (پرداخت‌نشده) → manual_resolved («رسیدگی دستی (قدیمی)»)
 *      • خطای شبکه → pending می‌ماند؛ جاروی بعدی دوباره می‌کوشد
 *  - کیف‌پولی (بدون درگاه) → expired (پولی کسر نشده؛ ناگهان کسر نکن)
 *
 * امنیت: claim اتمیک مثل بقیه مسیرها — دو اجرای موازی یکی را انجام می‌دهند.
 */
export async function resolveLegacyPendingPayments(
  cutoff: Date
): Promise<{
  scanned: number;
  delivered: number;
  closed: number;
  results: Array<{ paymentId: string; status: string; message?: string }>;
}> {
  const legacy = await db.payment.findMany({
    where: {
      status: { in: ["pending", "verifying"] },
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const results: Array<{ paymentId: string; status: string; message?: string }> = [];
  let delivered = 0;
  let closed = 0;

  // ایمپورت تنبل برای جلوگیری از circular dependency (zarinpal → provider)
  const { zarinpalVerify } = await import("@/lib/fitness/zarinpal");

  for (let payment of legacy) {
    // verifying گیرکرده → ریست اتمیک به pending قبل از claim
    if (payment.status === "verifying") {
      const reset = await db.payment.updateMany({
        where: { id: payment.id, status: "verifying" },
        data: { status: "pending" },
      });
      if (reset.count === 1) {
        payment = { ...payment, status: "pending" };
      }
    }

    const claim = await claimPayment(payment);
    if (claim !== "claimed") {
      // busy (فراخوان دیگری) / processed (تعیین‌تکلیف شده) / stuck (ریست شد)
      results.push({ paymentId: payment.id, status: claim });
      continue;
    }

    try {
      // کیف‌پولی قدیمی → بسته (پولی کسر نشده — کسر ناگهانی نکن)
      if (payment.paymentMethod !== "gateway" || !payment.authority) {
        await markPaymentExpired(payment.id);
        closed++;
        results.push({ paymentId: payment.id, status: "closed-wallet-legacy" });
        continue;
      }

      const zRes = await zarinpalVerify({
        authority: payment.authority,
        amount: payment.amount,
      });

      if (!zRes.ok) {
        if (zRes.transportError) {
          // شبکه — نتیجه قطعی نیست؛ pending بماند برای جاروی بعدی
          await releaseClaim(payment.id);
          results.push({ paymentId: payment.id, status: "network-error-pending" });
          continue;
        }
        // زرین‌پال قطعیاً پرداختی ندارد → منقضی (پولی نداده — قابل بازیابی دستی)
        await markPaymentExpired(payment.id);
        closed++;
        results.push({ paymentId: payment.id, status: "closed-unpaid" });
        continue;
      }

      // ok (100/101) — چک replay
      if (zRes.code === 101 || zRes.alreadyVerified) {
        if (await isAuthorityUsedElsewhere(payment.authority, payment.id)) {
          await markPaymentFailed(payment.id, zRes.refId ?? null);
          results.push({ paymentId: payment.id, status: "failed-replay" });
          continue;
        }
      }

      const refId =
        zRes.refId ?? payment.refId ?? `${Date.now()}${Math.floor(Math.random() * 10000)}`;

      // شارژ کیف پول legacy → helper مشترک
      if (payment.plan === "wallet_topup") {
        await deliverWalletTopupPayment({
          payment,
          refId,
          cardPan: zRes.cardPan ?? null,
          cardHash: zRes.cardHash ?? null,
          fee: zRes.fee ?? null,
        });
      } else {
        await deliverPlanPayment({
          userId: payment.userId,
          payment,
          refId,
          cardPan: zRes.cardPan ?? null,
          cardHash: zRes.cardHash ?? null,
          fee: zRes.fee ?? null,
        });
      }

      delivered++;
      results.push({ paymentId: payment.id, status: "delivered-legacy" });
      console.log(
        `[payment-delivery] legacy pending ${payment.id} → تحویل شد (refId=${refId})`
      );
    } catch (err) {
      console.error("[payment-delivery] legacy resolve error:", payment.id, err);
      await releaseClaim(payment.id);
      results.push({ paymentId: payment.id, status: "error-pending" });
    }
  }

  return { scanned: legacy.length, delivered, closed, results };
}

/**
 * تحویل شارژ کیف پول (wallet_topup) — تراکنش اتمیک idempotent.
 * مشترک بین: verify route / recover route / cron sweep / legacy sweep.
 * (قبلاً این منطق فقط داخل recover route بود — cron به آن دسترسی نداشت.)
 */
export async function deliverWalletTopupPayment(params: {
  payment: PaymentRecord;
  refId: string;
  cardPan?: string | null;
  cardHash?: string | null;
  fee?: number | null;
}): Promise<{ newBalance: number }> {
  const { payment, refId } = params;

  // ذخیره اطلاعات کارت/کارمزد
  if (params.cardPan || params.cardHash || params.fee != null) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        cardPan: params.cardPan ?? null,
        cardHash: params.cardHash ?? null,
        fee: params.fee ?? null,
      },
    });
  }

  const newBalance = await db.$transaction(async (tx) => {
    // اگر همین پرداخت هم‌زمان توسط فراخوان دیگری success شد → skip (idempotent)
    const fresh = await tx.payment.findUnique({
      where: { id: payment.id },
      select: { status: true },
    });
    if (fresh?.status === "success") {
      const u = await tx.user.findUnique({
        where: { id: payment.userId },
        select: { walletBalance: true },
      });
      return u?.walletBalance ?? 0;
    }

    await tx.user.update({
      where: { id: payment.userId },
      data: { walletBalance: { increment: payment.amount } },
    });
    const u2 = await tx.user.findUnique({
      where: { id: payment.userId },
      select: { walletBalance: true },
    });
    const balance = u2?.walletBalance ?? 0;
    await tx.walletTransaction.create({
      data: {
        userId: payment.userId,
        type: "deposit",
        amount: payment.amount,
        balance,
        description: `شارژ کیف پول — ${payment.amount.toLocaleString("en-US")} تومان`,
        refId: payment.id,
      },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "success",
        refId,
        verifiedAt: new Date(),
        cardPan: params.cardPan ?? null,
        cardHash: params.cardHash ?? null,
        fee: params.fee ?? null,
      },
    });
    return balance;
  });

  try {
    const { createNotification } = await import("@/lib/fitness/notifications");
    await createNotification(
      payment.userId,
      "system",
      "کیف پول شما شارژ شد ✅",
      `مبلغ ${payment.amount.toLocaleString("en-US")} تومان به کیف پول شما اضافه شد. موجودی فعلی: ${newBalance.toLocaleString("en-US")} تومان.`,
      "?tab=dashboard"
    );
  } catch {}

  return { newBalance };
}

/** بستن پرداخت بی‌پرداختِ ازپنجره‌خارج‌شده — فقط با تأیید منفی زرین‌پال */
export async function markPaymentExpired(paymentId: string): Promise<void> {
  await db.payment.update({
    where: { id: paymentId },
    data: { status: "expired", verifiedAt: new Date() },
  });
}

export interface PaymentRecord {
  id: string;
  userId: string;
  amount: number;
  originalAmount: number;
  plan: string;
  paymentMethod: string;
  authority: string | null;
  status: string;
  discountCode: string | null;
  verifiedAt: Date | null;
}

/** نتیجه عملیات claim */
export type ClaimResult = "claimed" | "busy" | "stuck" | "processed";

/**
 * F12: claim اتمیک وضعیت pending → verifying.
 * دو فراخوانی همزمان روی همان paymentId فقط یکی را عبور می‌دهد.
 * - "claimed": ما claim کردیم (ادامه بده)
 * - "busy": فراخوان دیگری در حال پردازش است (بعداً دوباره)
 * - "stuck": claim قبلی >۱۵ دقیقه معلق مانده (پروسه قبلی مرده) → failed
 *            شده تا قابل تکرار باشد (کالر باید پیام مناسب بدهد)
 * - "processed": وضعیت نهایی است (success/failed/cancelled/...)
 */
export async function claimPayment(payment: PaymentRecord): Promise<ClaimResult> {
  if (payment.status !== "pending") {
    if (payment.status !== "verifying") return "processed";
    const stuckFor = payment.verifiedAt ? Date.now() - payment.verifiedAt.getTime() : 0;
    if (payment.verifiedAt && stuckFor > VERIFYING_STUCK_MS) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "failed" },
      });
      return "stuck";
    }
    return "busy";
  }
  const claimed = await db.payment.updateMany({
    where: { id: payment.id, status: "pending" },
    data: { status: "verifying", verifiedAt: new Date() },
  });
  return claimed.count === 0 ? "busy" : "claimed";
}

/** آزادسازی claim در خطاهای غیرقطعی (شبکه) — پرداخت دوباره pending می‌شود */
export async function releaseClaim(paymentId: string): Promise<void> {
  await db.payment.updateMany({
    where: { id: paymentId, status: "verifying" },
    data: { status: "pending" },
  });
}

/** mark failed — فقط برای خطاهای قطعی درگاه */
export async function markPaymentFailed(paymentId: string, refId?: string | null): Promise<void> {
  await db.payment.update({
    where: { id: paymentId },
    data: { status: "failed", verifiedAt: new Date(), ...(refId != null ? { refId } : {}) },
  });
}

/**
 * آیا این authority قبلاً روی «پرداخت دیگری» success شده؟ (replay واقعی)
 * excludeId = پرداخت فعلی که همین حالا در حال deliver شدن است.
 */
export async function isAuthorityUsedElsewhere(authority: string, excludeId: string): Promise<boolean> {
  const other = await db.payment.findFirst({
    where: { authority, status: "success", id: { not: excludeId } },
    select: { id: true },
  });
  return !!other;
}

export interface DeliverPlanParams {
  userId: string;
  payment: PaymentRecord;
  refId: string;
  cardPan?: string | null;
  cardHash?: string | null;
  fee?: number | null;
}

/**
 * تحویل کامل خرید پلن — کسر کیف پول (در صورت روش wallet) + اشتراک +
 * ProgramRequest + آپدیت User + مصرف کد تخفیف + نوتیف‌ها + تولید برنامه
 * پس‌زمینه + پاداش معرفی — در یک $transaction اتمیک، سپس مراحل پس از tx.
 *
 * خروجی: همان shape پاسخ موفق verify (برای Response.json مستقیم).
 * خطا: WalletInsufficientError → کالر باید پرداخت را failed کند.
 */
export async function deliverPlanPayment(params: DeliverPlanParams) {
  const { userId, payment, refId } = params;
  const now = new Date();
  const plan = await getActivePlan(payment.plan as Plan);
  if (!plan) {
    throw new Error("پلن نامعتبر است.");
  }

  // ذخیره اطلاعات کارت/کارمزد (اگر verify زرین‌پال داده)
  if (params.cardPan || params.cardHash || params.fee != null) {
    await db.payment.update({
      where: { id: payment.id },
      data: {
        cardPan: params.cardPan ?? null,
        cardHash: params.cardHash ?? null,
        fee: params.fee ?? null,
      },
    });
  }

  const txResult = await db.$transaction(async (tx) => {
    let newBalance = 0;
    if (payment.paymentMethod === "wallet") {
      // کسر شرطی اتمیک — دو فراخوانی همزمان نمی‌توانند یک موجودی را دو بار خرج کنند
      const res = await tx.user.updateMany({
        where: { id: userId, walletBalance: { gte: payment.amount } },
        data: { walletBalance: { decrement: payment.amount } },
      });
      if (res.count === 0) {
        throw new WalletInsufficientError();
      }
      const fresh = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true },
      });
      newBalance = fresh?.walletBalance ?? 0;
      await tx.walletTransaction.create({
        data: {
          userId,
          type: "purchase",
          amount: -payment.amount,
          balance: newBalance,
          description: `خرید پلن ${plan.label}`,
          refId: payment.id,
        },
      });
    }

    // محاسبه تاریخ انقضا — تمدید همان پلن روزهای باقی‌مانده را حفظ می‌کند
    let remainingDaysPreserved = 0;
    const oldActiveSub = await tx.subscription.findFirst({
      where: { userId, status: "active" },
      orderBy: { endDate: "desc" },
    });
    if (
      oldActiveSub &&
      oldActiveSub.endDate &&
      oldActiveSub.endDate.getTime() > now.getTime() &&
      oldActiveSub.plan === plan.id
    ) {
      const msLeft = oldActiveSub.endDate.getTime() - now.getTime();
      const daysLeftOld = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      if (daysLeftOld > 0) {
        remainingDaysPreserved = Math.min(daysLeftOld, plan.durationDays);
      }
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays + remainingDaysPreserved);

    // غیرفعال کردن اشتراک‌های قبلی
    await tx.subscription.updateMany({
      where: { userId, status: "active" },
      data: { status: "expired" },
    });
    await tx.subscription.updateMany({
      where: { userId, status: "pending" },
      data: { status: "cancelled" },
    });

    // پلن‌های advanced/ultimate → pending تا تکمیل پیش‌نیازها (۴۵ روزه از آن لحظه شروع)
    const needsBodyPhoto = plan.id === "advanced" || plan.id === "ultimate";

    if (needsBodyPhoto) {
      const pendingWindowEnd = new Date(now);
      pendingWindowEnd.setDate(pendingWindowEnd.getDate() + PENDING_WINDOW_DAYS);
      await tx.subscription.create({
        data: {
          userId,
          plan: plan.id,
          status: "pending",
          startDate: null,
          endDate: pendingWindowEnd,
          durationDays: plan.durationDays,
          pricePaid: payment.amount,
          discountCode: payment.discountCode,
          paymentId: payment.id, // F11: پیوند دقیق پرداخت ↔ اشتراک
        },
      });
    } else {
      await tx.subscription.create({
        data: {
          userId,
          plan: plan.id,
          status: "active",
          startDate: now,
          endDate,
          durationDays: plan.durationDays,
          pricePaid: payment.amount,
          discountCode: payment.discountCode,
          paymentId: payment.id,
        },
      });
    }

    // آپدیت وضعیت payment → success (داخل tx — با تحویل اتمیک)
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "success",
        refId,
        verifiedAt: now,
      },
    });

    // فیلدهای پلن روی User
    await tx.user.update({
      where: { id: userId },
      data: {
        planName: plan.id,
        planExpiresAt: needsBodyPhoto ? null : endDate,
        planStartedAt: needsBodyPhoto ? null : now,
        videoAnalysisUsed: 0,
        bloodTestUsed: 0,
        videoStatus: null,
        bloodTestStatus: null,
      },
    });

    // درخواست تولید برنامه
    const progReq = await tx.programRequest.create({
      data: {
        userId,
        plan: plan.id,
        billingPeriod: "monthly",
        status: needsBodyPhoto ? "pending_body_photo" : "pending_generation",
        paymentId: payment.id,
      },
    });

    // F9: اعتبارسنجی مجدد و اتمیک کد تخفیف قبل از مصرف
    if (payment.discountCode) {
      const udc = await tx.userDiscountCode.findUnique({
        where: { code: payment.discountCode },
      });
      if (udc) {
        if (udc.userId === userId) {
          const upd = await tx.userDiscountCode.updateMany({
            where: {
              id: udc.id,
              userId,
              isUsed: false,
              validUntil: { gt: now },
            },
            data: { isUsed: true },
          });
          if (upd.count === 0) {
            console.error(
              "[payment-delivery] discount re-validation failed (user code already used/expired):",
              payment.discountCode
            );
          }
        } else {
          console.error(
            "[payment-delivery] discount code belongs to another user — not consumed:",
            payment.discountCode
          );
        }
      } else {
        const dc = await tx.discountCode.findUnique({
          where: { code: payment.discountCode },
        });
        if (dc) {
          const upd = await tx.discountCode.updateMany({
            where: {
              code: dc.code,
              active: true,
              OR: [{ validUntil: null }, { validUntil: { gt: now } }],
              ...(dc.maxUses !== -1 ? { usedCount: { lt: dc.maxUses } } : {}),
            },
            data: { usedCount: { increment: 1 } },
          });
          if (upd.count === 0) {
            console.error(
              "[payment-delivery] discount re-validation failed (expired/inactive/exhausted):",
              payment.discountCode
            );
            // گزارش عبور از سقف به ادمین‌ها
            try {
              const adminIds = await tx.user.findMany({
                where: { role: "ADMIN", isBlocked: false },
                select: { id: true },
              });
              if (adminIds.length > 0) {
                await tx.notification.createMany({
                  data: adminIds.map((a) => ({
                    userId: a.id,
                    type: "system",
                    title: "سقف کد تخفیف رد شد ⚠️",
                    body: `پرداخت ${payment.id} با کد «${payment.discountCode}» تأیید شد در حالی که سقف/اعتبار کد تکمیل شده بود. (مبلغ: ${payment.amount} تومان)`,
                    link: "?screen=admin",
                    read: false,
                    meta: JSON.stringify({
                      scenario: "discount_overuse",
                      paymentId: payment.id,
                      code: payment.discountCode,
                      maxUses: dc.maxUses,
                      usedCount: dc.usedCount,
                    }),
                  })),
                });
              }
            } catch {
              // نوتیف نباید جریان پول را متوقف کند
            }
          }
        }
      }
    }

    return {
      newBalance,
      remainingDaysPreserved,
      progReqId: progReq.id,
      needsBodyPhoto,
      subscriptionEnd: endDate,
    };
  });

  const { newBalance, remainingDaysPreserved, progReqId, needsBodyPhoto, subscriptionEnd: endDate } =
    txResult;

  // --- تولید برنامه در پس‌زمینه / اطلاع پیش‌نیازها ---
  const canSubmitVideo = plan.id === "ultimate";

  if (needsBodyPhoto) {
    await db.programRequest.update({
      where: { id: progReqId },
      data: { status: "pending_body_photo" },
    });

    const noticeBody = canSubmitVideo
      ? "برای دریافت برنامه اختصاصی، ارسال عکس‌های بدن (۴ زاویه) الزامی است. ارسال ویدیوی فرم حرکات اختیاری است اما به دقت برنامه کمک می‌کند. همچنین می‌توانید بعداً از بخش «آزمایش خون» در پنل، عکس آزمایش خون خود را برای تحلیل ارسال کنید (دلبخواه)."
      : "برای دریافت برنامه اختصاصی، عکس‌های بدن خود (۴ زاویه) را ارسال کنید. سپس فیتاپ هوشمند برنامه شما را طراحی می‌کند.";

    await createNotification(
      userId,
      "system",
      "ارسال عکس بدن الزامی است 📸",
      noticeBody,
      "?tab=dashboard&open=bodyAnalysis"
    );

    if (canSubmitVideo) {
      await createNotification(
        userId,
        "system",
        "آزمایش خون خود را ارسال کنید (اختیاری) 🩸",
        "برای داشتن یک برنامه ورزشی و تغذیه‌ای کاملاً شخصی‌سازی‌شده، می‌توانید آزمایش خون خود را به فیتاپ بسپارید. " +
          "از بخش «آزمایش خون» در پنل، ابتدا فرم آزمایش را دانلود کرده و به آزمایشگاه ببرید. " +
          "سپس یکی از گزینه‌ها را انتخاب کنید: «آزمایش دادم و منتظر جوابم» (تا آپلود نتایج، تولید برنامه متوقف می‌ماند) یا «آپلود نمی‌کنم» (برنامه بدون آزمایش خون طراحی می‌شود).",
        "?tab=dashboard&open=bloodTest"
      );

      await createNotification(
        userId,
        "system",
        "ارسال ویدیوی فرم حرکات (اختیاری) 🎥",
        "برای دقت بالاتر در طراحی برنامه، می‌توانید ویدیویی از فرم اجرای حرکات خود ارسال کنید. این مرحله اختیاری است اما به مربی هوشمند کمک می‌کند نقاط ضعف فرم بدن شما را شناسایی کند. " +
          "از بخش داشبورد می‌توانید ویدیو را آپلود کنید یا «آپلود نمی‌کنم» را انتخاب کنید. " +
          "تا زمان تعیین تکلیف این مرحله، ساخت برنامه شما متوقف می‌ماند.",
        "?tab=dashboard&open=bodyAnalysis"
      );
    }

    const baselineCheckup = await db.checkup.findFirst({
      where: { userId, phaseNumber: 0 },
      orderBy: { createdAt: "desc" },
    });
    const hasMeasurements =
      !!baselineCheckup?.waistMeasurement && !!baselineCheckup?.neckMeasurement;
    if (!hasMeasurements) {
      await createNotification(
        userId,
        "system",
        "برای برنامه دقیق‌تر، اندازه‌های بدنی خود را وارد کنید 📏",
        "با وارد کردن دور کمر، گردن و سایر اندازه‌ها، فیتاپ هوشمند درصد چربی بدن شما را با فرمول علمی US Navy محاسبه می‌کند و برنامه دقیق‌تری طراحی می‌کند. می‌توانید این مرحله را رد کنید.",
        "?tab=progress"
      );
    }
  } else {
    // تولید برنامه در پس‌زمینه
    try {
      const gen = await startProgramGenerationInBackground(userId);
      if (!gen.started && gen.reason !== "already_generating") {
        await db.programRequest.update({
          where: { id: progReqId },
          data: { status: "failed" },
        });
        await createNotification(
          userId,
          "system",
          "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
          `تولید برنامه ورزشی و غذایی شما شروع نشد (${gen.reason ?? "دلیل نامشخص"}). لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید یا با پشتیبانی در ارتباط باشید.`,
          "?tab=programs",
          { from: "payment", action: "plan_generation_failed_prep", plan: plan.id }
        );
      } else {
        await createNotification(
          userId,
          "system",
          "برنامه شما در حال طراحی است ⏳",
          "فیتاپ هوشمند طراحی برنامه تمرینی و غذایی شخصی‌سازی‌شده شما را شروع کرد. پس از آماده‌سازی به شما اطلاع می‌دهیم.",
          "?tab=programs"
        );
      }
    } catch (prepErr) {
      console.error("[payment-delivery] plan generation prep failed:", prepErr);
      await db.programRequest.update({
        where: { id: progReqId },
        data: { status: "failed" },
      });
      try {
        await createNotification(
          userId,
          "system",
          "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
          "تولید برنامه ورزشی و غذایی شما با خطا مواجه شد. لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید یا با پشتیبانی در ارتباط باشید.",
          "?tab=programs",
          { from: "payment", action: "plan_generation_failed_prep", plan: plan.id }
        );
      } catch {}
    }
  }

  // نوتیفیکیشن خرید موفق
  const preservedNote =
    remainingDaysPreserved > 0
      ? ` ${toPersianDigits(remainingDaysPreserved)} روز از اشتراک قبلی شما به اشتراک جدید اضافه شد 🎁`
      : "";
  const bodyText = needsBodyPhoto
    ? `پلن ${plan.label} با موفقیت خریداری شد. برای شروع دوره ۴۵ روزه، عکس‌های بدن خود را ارسال کنید.${preservedNote}`
    : `پلن ${plan.label} با موفقیت خریداری شد. تا ${endDate.toLocaleDateString("fa-IR")} فعال است.${preservedNote} برنامه شما در حال تولید توسط فیتاپ هوشمند است — به‌زودی آماده می‌شود.`;
  await createNotification(
    userId,
    "subscription",
    needsBodyPhoto ? "پلن شما ثبت شد! ✅" : "پلن شما فعال شد! ✅",
    bodyText,
    "?tab=dashboard",
    { planId: plan.id, refId, remainingDaysPreserved }
  );

  // پاداش معرفی — فقط برای اشتراک بلافاصله فعال
  if (!needsBodyPhoto) {
    try {
      await processReferralReward({
        buyerUserId: userId,
        paymentId: payment.id,
      });
    } catch (refErr) {
      console.error("[payment-delivery] referral reward failed:", refErr);
    }
  }

  const updatedDto = await buildUserDto(userId);

  return {
    success: true,
    status: "success" as const,
    message: "پرداخت با موفقیت انجام شد.",
    refId,
    amount: payment.amount,
    originalAmount: payment.originalAmount,
    plan: plan.label,
    planId: plan.id,
    subscriptionEnd: needsBodyPhoto ? null : endDate.toISOString(),
    subscriptionStatus: needsBodyPhoto ? ("pending" as const) : ("active" as const),
    remainingDaysPreserved,
    walletBalance: newBalance,
    user: updatedDto,
  };
}
