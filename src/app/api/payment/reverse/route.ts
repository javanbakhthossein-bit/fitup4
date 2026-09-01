import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { toPersianDigits } from "@/lib/fitness/types";
import { zarinpalReverse } from "@/lib/payment/providers/zarinpal";
import { zarinpalInquiry } from "@/lib/payment/providers/zarinpal";

/**
 * POST /api/payment/reverse
 * Body: { paymentId: string }
 *
 * استرداد تراکنش (Reverse) — طبق مستندات زرین‌پال
 *
 * تراکنش‌های موفقی که از پرداخت آنها نهایت ۳۰ دقیقه گذشته باشد را
 * بدون کارمزد به حساب خریدار سریعاً استرداد می‌زند.
 *
 * فقط ادمین می‌تواند این کار را انجام دهد.
 *
 * مراحل:
 * 1. claim اتمیک وضعیت success → reversing (دو درخواست همزمان ادمین فقط یکی عبور می‌کند)
 * 2. بررسی اینکه تراکنش موفق است و کمتر از ۳۰ دقیقه از آن گذشته
 * 3. استعلام وضعیت تراکنش (inquiry) برای اطمینان
 * 4. فراخوانی reverse API زرین‌پال (پول به کارت بانکی خریدار برمی‌گردد)
 * 5. به‌روزرسانی وضعیت پرداخت به "refunded" در دیتابیس
 * 6. غیرفعال کردن اشتراک مرتبط (از طریق subscription.paymentId؛ F11)
 *    + انقضای اشتراک‌های pending همان پرداخت
 *    + بازگرداندن اشتراک قبلی هنوز-پرداخت‌شده (اگر خرید، ارتقا/تمدید بود)
 *    + برگشت کد تخفیف (usedCount/isUsed)
 *    + بازپس‌گیری پاداش معرفی (کیف پول خریدار + معرف)
 *
 * ⚠️ نکته مهم (رفع باگ استرداد دوگانه): reverse زرین‌پال پول را به «حساب
 * بانکی خریدار» برمی‌گرداند؛ بنابراین برای خرید پلن، موجودی کیف پول دیگر
 * افزایش نمی‌یابد (قبلاً هم بانک هم کیف پول شارژ می‌شد = پرداخت دوگانه
 * به کاربر). فقط برای استرداد «شارژ کیف پول»، مبلغ از کیف پول کم می‌شود
 * چون پول به بانک برمی‌گردد.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { paymentId } = body as { paymentId: string };

    if (!paymentId) {
      return Response.json({ error: "paymentId الزامی است." }, { status: 400 });
    }

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: { user: { select: { mobile: true, name: true } } },
    });

    if (!payment) {
      return Response.json({ error: "پرداخت یافت نشد." }, { status: 404 });
    }

    if (payment.status !== "success") {
      return Response.json(
        { error: `فقط تراکنش‌های موفق قابل استرداد هستند. وضعیت فعلی: ${payment.status}` },
        { status: 400 }
      );
    }

    if (payment.paymentMethod !== "gateway") {
      return Response.json(
        { error: "استرداد فقط برای پرداخت‌های درگاهی امکان‌پذیر است." },
        { status: 400 }
      );
    }

    if (!payment.authority) {
      return Response.json(
        { error: "کد مرجع (authority) این تراکنش موجود نیست." },
        { status: 400 }
      );
    }

    // بررسی زمان: فقط تراکنش‌های کمتر از ۳۰ دقیقه قابل استرداد هستند
    // (قبل از claim — تا تراکنش منقضی در وضعیت reversing گیر نکند)
    if (payment.verifiedAt) {
      const minutesSinceVerify = (Date.now() - payment.verifiedAt.getTime()) / (1000 * 60);
      if (minutesSinceVerify > 30) {
        return Response.json(
          {
            error: `حداکثر زمان (۳۰ دقیقه) برای استرداد این تراکنش منقضی شده است. ${Math.floor(minutesSinceVerify)} دقیقه گذشته است.`,
            code: "TIME_EXPIRED",
          },
          { status: 400 }
        );
      }
    }

    // ─── claim اتمیک: success → reversing ───
    // جلوگیری از اجرای همزمان دو استرداد روی یک تراکنش (race بین دو ادمین
    // یا دابل‌کلیک). فقط درخواستی که بتواند وضعیت را اتمیک تغییر دهد ادامه می‌دهد.
    const claimed = await db.payment.updateMany({
      where: { id: payment.id, status: "success" },
      data: { status: "reversing" },
    });
    if (claimed.count === 0) {
      return Response.json(
        { error: "این تراکنش در حال استرداد یا قبلاً استرداد شده است." },
        { status: 409 }
      );
    }

    // rollback به success اگر مراحل بعدی خطا داد (تا استرداد قابل تکرار بماند)
    const rollbackToSuccess = async () => {
      await db.payment
        .updateMany({ where: { id: payment.id, status: "reversing" }, data: { status: "success" } })
        .catch(() => {});
    };

    // ۱. ابتدا استعلام وضعیت تراکنش
    const inquiryRes = await zarinpalInquiry({ authority: payment.authority });
    if (inquiryRes.ok && inquiryRes.status === "REVERSED") {
      // تراکنش قبلاً استرداد شده — پول قبلاً به بانک برگشته؛ فقط وضعیت را نهایی کن.
      // (بدون هیچ تغییری در کیف پول — جلوگیری از استرداد دوگانه)
      await db.payment.updateMany({
        where: { id: payment.id },
        data: { status: "refunded" },
      });
      return Response.json({
        success: true,
        message: "این تراکنش قبلاً استرداد شده بود.",
        status: "already_reversed",
      });
    }

    // ۲. فراخوانی reverse API (پول به کارت بانکی خریدار برمی‌گردد)
    const reverseRes = await zarinpalReverse({ authority: payment.authority });

    if (!reverseRes.ok) {
      await rollbackToSuccess();
      return Response.json(
        {
          error: `استرداد ناموفق بود: ${reverseRes.error}`,
          code: reverseRes.code,
          details: reverseRes.error,
        },
        { status: 400 }
      );
    }

    // ۳. نهایی‌سازی وضعیت پرداخت → refunded
    await db.payment.updateMany({
      where: { id: payment.id },
      data: { status: "refunded" },
    });

    // ۴. غیرفعال کردن اشتراک مرتبط با این پرداخت
    // F11: پیوند دقیق از طریق subscription.paymentId (به‌جای heuristic شکننده
    // pricePaid === amount)؛ fallback به heuristic قدیمی برای رکوردهای legacy.
    let sub = await db.subscription.findFirst({
      where: { paymentId: payment.id },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) {
      sub = await db.subscription.findFirst({
        where: { userId: payment.userId, status: "active" },
        orderBy: { createdAt: "desc" },
      });
      if (sub && sub.pricePaid !== payment.amount) sub = null;
    }

    // FIX: اشتراک قبلی که هنوز روزهای پرداخت‌شده‌اش باقی است (خرید ارتقا/تمدید
    // فقط status آن را expired کرده بود — endDate دست‌نخورده مانده) پیدا کن تا
    // بعد از انقضای اشتراک جدید، دوباره active شود؛ بدون این، کاربرِ ارتقایی
    // بعد از استرداد، بدون هیچ پلنی می‌ماند در حالی که پلن قبلی را خریده بود.
    // اشتراک‌های لغوشده توسط ادمین (cancelledAt) و طبیعتاً منقضی‌شده (endDate
    // گذشته) restore نمی‌شوند.
    let prevSub: { id: string; plan: string; startDate: Date | null; endDate: Date | null } | null = null;
    if (sub) {
      prevSub = await db.subscription.findFirst({
        where: {
          userId: payment.userId,
          id: { not: sub.id },
          status: "expired",
          endDate: { gt: new Date() },
          cancelledAt: null,
        },
        orderBy: { endDate: "desc" },
        select: { id: true, plan: true, startDate: true, endDate: true },
      });
    }

    if (sub) {
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: "expired", cancelledAt: new Date() },
      });
    }
    // F11: اشتراک‌های pending مرتبط با همین پرداخت هم منقضی شوند —
    // استرداد خرید advanced/ultimate که هنوز پیش‌نیازها کامل نشده، نباید
    // entitlement زنده نگه دارد.
    await db.subscription.updateMany({
      where: { paymentId: payment.id, status: "pending" },
      data: { status: "expired", cancelledAt: new Date() },
    });
    // fallback برای pending های legacy بدون paymentId (آخرین pending همین کاربر)
    if (payment.plan === "advanced" || payment.plan === "ultimate") {
      await db.subscription.updateMany({
        where: { userId: payment.userId, status: "pending" },
        data: { status: "expired", cancelledAt: new Date() },
      });
    }

    if (sub) {
      if (prevSub) {
        // بازگرداندن اشتراک قبلی — روزهای باقیمانده همان endDate قبلی است چون
        // جریان ارتقا هرگز endDate اشتراک قبلی را تغییر نمی‌داد (فقط status).
        await db.subscription.update({
          where: { id: prevSub.id },
          data: { status: "active" },
        });
        await db.user.update({
          where: { id: payment.userId },
          data: {
            planName: prevSub.plan,
            planExpiresAt: prevSub.endDate,
            planStartedAt: prevSub.startDate,
          },
        });
      } else {
        // ریست فیلدهای پلن روی کاربر
        await db.user.update({
          where: { id: payment.userId },
          data: {
            planName: null,
            planExpiresAt: null,
            planStartedAt: null,
          },
        });
      }
    }

    // ۵. کتاب حساب کیف پول — رفع باگ «استرداد دوگانه»
    // reverse زرین‌پال پول را به کارت بانکی خریدار برمی‌گرداند؛ بنابراین:
    //  - خرید پلن: هیچ تغییری در کیف پول نیست (پول از بانک برگشته، نه به کیف پول)
    //    → رکورد WalletTransaction هم ثبت نمی‌شود چون حرکتی در کیف پول نیست.
    //    سابقه استرداد در خود رکورد Payment (status=refunded) موجود است.
    //  - شارژ کیف پول: مبلغ شارژشده از کیف پول کم می‌شود (پول به بانک برگشته)
    //    و ردیف کیف‌پول با موجودی صحیح ثبت می‌شود.
    if (payment.plan === "wallet_topup") {
      // ─── FIX (ممیزی 2-a): حفره استرداد شارژ کیف پول ───
      // قبلاً: کسر شرطی gte با نتیجه بررسی‌نشده — اگر کاربر موجودی شارژشده را
      // خرج کرده بود، کسر بی‌صدا no-op می‌شد، پول به بانک برمی‌گشت و اشتراکِ
      // خریداری‌شده با همان پول فعال می‌ماند (کاربر هم پول هم پلن!). حالا:
      //  ۱) تا حد موجودی اتمیک کسر می‌شود
      //  ۲) کسری (بخش خرج‌شده) → اشتراک‌های خریداری‌شده با «کیف پول» بعد از این
      //     شارژ منقضی می‌شوند (entitlement همان پولِ برگشتی بوده)
      //  ۳) ردیف دفتر با موجودیت واقعی ثبت می‌شود + کسری لاگ/نوتیف می‌شود
      const balanceBefore = await db.user.findUnique({
        where: { id: payment.userId },
        select: { walletBalance: true },
      });
      const available = balanceBefore?.walletBalance ?? 0;
      const deduct = Math.min(available, payment.amount);
      if (deduct > 0) {
        await db.user.updateMany({
          where: { id: payment.userId, walletBalance: { gte: deduct } },
          data: { walletBalance: { decrement: deduct } },
        });
      }
      const shortfall = payment.amount - deduct;
      if (shortfall > 0) {
        // بخشی از شارژ خرج شده است — اشتراک‌های خریداری‌شده با کیف پول بعد از
        // این شارژ را منقضی کن (فقط تا پوشش کسری، از قدیمی به جدید).
        // (Subscription رابطه مستقیم به Payment ندارد — تطبیق از طریق paymentId)
        const walletPayments = await db.payment.findMany({
          where: {
            userId: payment.userId,
            paymentMethod: "wallet",
            status: "success",
            createdAt: { gte: payment.createdAt },
          },
          select: { id: true, amount: true },
        });
        const walletPaymentIds = walletPayments.map((p) => p.id);
        const walletSubs = walletPaymentIds.length
          ? await db.subscription.findMany({
              where: {
                userId: payment.userId,
                status: { in: ["active", "pending"] },
                createdAt: { gte: payment.createdAt },
                paymentId: { in: walletPaymentIds },
              },
              orderBy: { createdAt: "asc" },
            })
          : [];
        let toRecover = shortfall;
        const expiredIds: string[] = [];
        for (const ws of walletSubs) {
          if (toRecover <= 0) break;
          await db.subscription.update({
            where: { id: ws.id },
            data: { status: "expired", cancelledAt: new Date() },
          });
          expiredIds.push(ws.id);
          toRecover -= ws.pricePaid;
        }
        if (expiredIds.length > 0) {
          // ریست پلن کاربر اگر اشتراک فعالش همان بود که منقضی شد
          const activeLeft = await db.subscription.findFirst({
            where: { userId: payment.userId, status: "active", endDate: { gt: new Date() } },
            orderBy: { endDate: "desc" },
          });
          if (activeLeft) {
            await db.user.update({
              where: { id: payment.userId },
              data: { planName: activeLeft.plan, planExpiresAt: activeLeft.endDate, planStartedAt: activeLeft.startDate },
            });
          } else {
            await db.user.update({
              where: { id: payment.userId },
              data: { planName: null, planExpiresAt: null, planStartedAt: null },
            });
          }
          console.warn(
            `[payment/reverse] topup shortfall ${shortfall} — expired wallet-bought subs: ${expiredIds.join(",")}`,
          );
          await db.notification.create({
            data: {
              userId: payment.userId,
              type: "subscription",
              title: "اشتراک خریداری‌شده با کیف پول غیرفعال شد",
              body: `به‌دلیل استرداد شارژ کیف پول، مبلغ خرج‌شده از آن (${toPersianDigits((shortfall - Math.max(toRecover, 0)).toLocaleString("en-US"))} تومان) به بانک برگشت و اشتراک خریداری‌شده با آن غیرفعال شد.`,
              link: "?tab=plans",
              read: false,
            },
          });
        } else {
          console.warn(
            `[payment/reverse] topup shortfall ${shortfall} with no wallet-bought subscription found — manual review needed (userId=${payment.userId})`,
          );
        }
      }
      const afterTopupReverse = await db.user.findUnique({
        where: { id: payment.userId },
        select: { walletBalance: true },
      });
      await db.walletTransaction.create({
        data: {
          userId: payment.userId,
          type: "refund",
          amount: -deduct,
          balance: afterTopupReverse?.walletBalance ?? 0,
          description:
            shortfall > 0
              ? `استرداد شارژ کیف پول ${payment.description} (کد پیگیری: ${payment.refId}) — ${deduct} تومان از کیف پول کسر شد؛ ${shortfall} تومان خرج‌شده بود و اشتراک مرتبط غیرفعال شد`
              : `استرداد شارژ کیف پول ${payment.description} (کد پیگیری: ${payment.refId}) — پول به حساب بانکی بازگشت`,
          refId: payment.id,
        },
      });
    }

    // ─── ۵٫۴. بازپس‌گیری پاداش معرفی (FIX: پاداش رفرال بعد از استرداد می‌ماند) ───
    // اگر برای این پرداخت پاداش معرفی پرداخت شده باشد (WalletTransaction با
    // type="bonus" و refId=paymentId — یکی برای خریدار و یکی برای معرف)، مبلغ از
    // کیف پول هر دو کسر می‌شود (کف ۰ — اگر خرج شده باشد تا حد موجودی کم می‌شود
    // و باقی لاگ می‌شود) و referralRewardPaid خریدار ریست می‌شود.
    const bonusTxns = await db.walletTransaction.findMany({
      where: { refId: payment.id, type: "bonus" },
    });
    for (const txn of bonusTxns) {
      const target = await db.user.findUnique({
        where: { id: txn.userId },
        select: { walletBalance: true },
      });
      if (!target) continue;
      // کسر اتمیک — فقط تا حد موجودی فعلی (موجودی منفی نمی‌شود)
      const deduct = Math.min(txn.amount, target.walletBalance);
      if (deduct > 0) {
        await db.$transaction(async (tx) => {
          const res = await tx.user.updateMany({
            where: { id: txn.userId, walletBalance: { gte: deduct } },
            data: { walletBalance: { decrement: deduct } },
          });
          if (res.count === 0) return; // رقابت همزمان — این بار رد شد
          const fresh = await tx.user.findUnique({
            where: { id: txn.userId },
            select: { walletBalance: true },
          });
          await tx.walletTransaction.create({
            data: {
              userId: txn.userId,
              type: "refund",
              amount: -deduct,
              balance: fresh?.walletBalance ?? 0,
              description: `بازپس‌گیری پاداش معرفی به دوست‌دار (استرداد پرداخت) — ${toPersianDigits(deduct.toLocaleString("en-US"))} تومان`,
              refId: payment.id,
            },
          });
        });
      }
      if (deduct < txn.amount) {
        console.warn(
          `[payment/reverse] referral clawback partial: userId=${txn.userId} reward=${txn.amount} deducted=${deduct} (باقیمانده قبلاً خرج شده است)`
        );
      }
    }
    // ریست فلگ پاداش خریدار — فقط وقتی پاداشِ همین پرداخت به خودش پرداخت شده بود
    if (bonusTxns.some((t) => t.userId === payment.userId)) {
      await db.user.updateMany({
        where: { id: payment.userId, referralRewardPaid: true },
        data: { referralRewardPaid: false },
      });
    }

    // ۵٫۵. برگشت کد تخفیف (F11): usedCount کد عمومی کم / isUsed کد اختصاصی ریست
    if (payment.discountCode) {
      const udc = await db.userDiscountCode.findUnique({
        where: { code: payment.discountCode },
      });
      if (udc && udc.userId === payment.userId) {
        await db.userDiscountCode.updateMany({
          where: { id: udc.id, isUsed: true },
          data: { isUsed: false },
        });
      } else if (!udc) {
        await db.discountCode.updateMany({
          where: { code: payment.discountCode, usedCount: { gt: 0 } },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }

    // ۶. نوتیفیکیشن به کاربر
    const isTopupReverse = payment.plan === "wallet_topup";
    await db.notification.create({
      data: {
        userId: payment.userId,
        type: "subscription",
        title: "پرداخت شما استرداد شد ⚠️",
        body: isTopupReverse
          ? `تراکنش شارژ کیف پول شما به مبلغ ${payment.amount.toLocaleString("en-US")} تومان استرداد شد. مبلغ به حساب بانکی شما بازگردانده می‌شود و مبلغ مربوطه از کیف پول شما کسر شد.`
          : prevSub
            ? `تراکنش شما به مبلغ ${payment.amount.toLocaleString("en-US")} تومان استرداد شد. مبلغ به حساب بانکی شما بازگردانده می‌شود. اشتراک جدید غیرفعال و اشتراک قبلی شما دوباره فعال شد.`
            : `تراکنش شما به مبلغ ${payment.amount.toLocaleString("en-US")} تومان استرداد شد. مبلغ به حساب بانکی شما بازگردانده می‌شود. اشتراک شما غیرفعال شد.`,
        link: "?tab=plans",
        read: false,
      },
    });

    return Response.json({
      success: true,
      message: "تراکنش با موفقیت استرداد شد.",
      paymentId: payment.id,
      status: "refunded",
    });
  } catch (e) {
    return apiError(e);
  }
}
