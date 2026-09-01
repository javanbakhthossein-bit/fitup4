import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { toPersianDigits } from "@/lib/fitness/types";
import { zarinpalVerify, isZarinpalConfigured } from "@/lib/fitness/zarinpal";
import { createNotification } from "@/lib/fitness/notifications";
import { buildUserDto } from "@/lib/fitness/auth";
import {
  WalletInsufficientError,
  claimPayment,
  releaseClaim,
  markPaymentFailed,
  isAuthorityUsedElsewhere,
  deliverPlanPayment,
} from "@/lib/fitness/payment-delivery";

interface VerifyBody {
  paymentId: string;
  status: "OK" | "NOK" | "CANCELLED";
  /** برای callback زرین‌پال: authority واقعی که از URL برمی‌گردد.
   *  این مقدار هرگز مبنای verify نیست — همیشه payment.authority از DB
   *  استفاده می‌شود و این فقط به‌صورت defensive تطبیق داده می‌شود (F2). */
  authority?: string;
}

/**
 * POST /api/payment/verify — تایید و تحویل پرداخت.
 *
 * ─── سیاست کد ۱۰۱ (alreadyVerified) — اصلاح باگ «در انتظار» ───
 * قبلاً هر پاسخ ۱۰۱ از زرین‌پال «replay» فرض و پرداخت failed می‌شد. اما ۱۰۱
 * فقط یعنی «این authority قبلاً verify شده» — دو حالدارد:
 *  ۱. Payment موفق دیگری با همین authority موجود است → replay واقعی → رد
 *  ۲. چنین چیزی نیست → تلاش قبلی ما پیش از commit DB مرده (کرش/timeout) →
 *     پول گرفته شده → همینجا deliver می‌کنیم (سناریوی کاربرانِ گیرکرده!)
 *
 * ─── سیاست خطای شبکه ───
 * خطای transport به زرین‌پال ≠ پرداخت ناموفق → claim آزاد، status:"pending"
 * (کالر/کرون بعداً دوباره) — نه failed.
 */

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = (await req.json()) as VerifyBody;

    const payment = await db.payment.findFirst({
      where: { id: body.paymentId, userId: user.id },
    });
    if (!payment) {
      return Response.json({ error: "پرداخت یافت نشد." }, { status: 404 });
    }

    // ─── claim اتمیک (F12) + تشخیص گیرکردن ───
    const claim = await claimPayment(payment);
    if (claim === "busy") {
      return Response.json(
        {
          success: false,
          status: "verifying",
          message: "این پرداخت در حال پردازش است. لطفاً چند لحظه دیگر دوباره تلاش کنید.",
        },
        { status: 400 }
      );
    }
    if (claim === "stuck") {
      return Response.json(
        {
          success: false,
          status: "failed",
          message:
            "پردازش این پرداخت قبلاً با خطا متوقف شده است. در صورت کسر مبلغ، با پشتیبانی تماس بگیرید.",
        },
        { status: 400 }
      );
    }
    if (claim === "processed") {
      // وضعیت نهایی — اگر موفق بوده، پاسخ موفق idempotent بده (نه خطا!)
      if (payment.status === "success") {
        const sub = await db.subscription.findFirst({
          where: { paymentId: payment.id },
          orderBy: { createdAt: "desc" },
          select: { status: true, plan: true, endDate: true },
        });
        return Response.json({
          success: true,
          status: "success",
          message: "این پرداخت قبلاً با موفقیت ثبت شده است.",
          refId: payment.refId,
          amount: payment.amount,
          originalAmount: payment.originalAmount,
          plan: sub?.plan ?? payment.plan,
          subscriptionStatus: sub?.status ?? null,
          subscriptionEnd: sub?.endDate?.toISOString() ?? null,
          user: await buildUserDto(user.id),
        });
      }
      return Response.json(
        { error: "این پرداخت قبلاً پردازش شده است." },
        { status: 400 }
      );
    }

    // (claim === "claimed") — از اینجا فقط مسیرهای قطعی payment را failed می‌کنند

    // --- انصراف کاربر ---
    if (body.status === "CANCELLED") {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "cancelled", verifiedAt: new Date() },
      });
      return Response.json({
        success: false,
        status: "cancelled",
        message: "پرداخت لغو شد.",
      });
    }

    // --- پرداخت ناموفق (NOK از درگاه) ---
    if (body.status === "NOK") {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "failed", verifiedAt: new Date() },
      });
      return Response.json({
        success: false,
        status: "failed",
        message: "پرداخت ناموفق بود.",
      });
    }

    // ─── شارژ کیف پول (wallet_topup) ───
    if (payment.plan === "wallet_topup") {
      if (payment.paymentMethod !== "gateway") {
        await markPaymentFailed(payment.id);
        return Response.json(
          { success: false, status: "failed", message: "تراکنش شارژ کیف پول نامعتبر است." },
          { status: 400 }
        );
      }
      if (!isZarinpalConfigured()) {
        await markPaymentFailed(payment.id);
        return Response.json({
          success: false,
          status: "failed",
          message: "درگاه پرداخت پیکربندی نشده است.",
        });
      }
      // defensive (F2): authority کلاینت اگر آمده باشد باید با DB مطابقت داشته باشد
      if (
        body.authority &&
        typeof body.authority === "string" &&
        body.authority.trim() &&
        payment.authority &&
        body.authority.trim() !== payment.authority
      ) {
        await markPaymentFailed(payment.id);
        return Response.json(
          { success: false, status: "failed", message: "کد مرجع پرداخت با تراکنش مطابقت ندارد." },
          { status: 400 }
        );
      }
      if (!payment.authority) {
        await markPaymentFailed(payment.id);
        return Response.json({
          success: false,
          status: "failed",
          message: "کد مرجع پرداخت (authority) یافت نشد.",
        });
      }

      const zRes = await zarinpalVerify({
        authority: payment.authority, // همیشه از DB (F2)
        amount: payment.amount, // Tomans
      });

      if (!zRes.ok) {
        if (zRes.transportError) {
          // خطای شبکه — غیرقطعی: claim آزاد و pending بمان (recover/cron دوباره)
          await releaseClaim(payment.id);
          return Response.json(
            {
              success: false,
              status: "pending",
              message: "خطای موقت در ارتباط با زرین‌پال. سیستم به‌زودی دوباره تلاش می‌کند.",
            },
            { status: 200 }
          );
        }
        await markPaymentFailed(payment.id, zRes.refId ?? null);
        return Response.json({
          success: false,
          status: "failed",
          message: `تأیید پرداخت توسط زرین‌پال ناموفق بود: ${zRes.error ?? "Zarinpal verify failed"}`,
          refId: zRes.refId,
        });
      }

      // کد ۱۰۱ → چک replay: اگر Payment موفق دیگری با همین authority هست → رد؛
      // وگرنه پرداخت شده → شارژ را (idempotent داخل tx) انجام بده.
      if (zRes.code === 101 || zRes.alreadyVerified) {
        if (payment.authority && (await isAuthorityUsedElsewhere(payment.authority, payment.id))) {
          await markPaymentFailed(payment.id);
          return Response.json(
            { success: false, status: "failed", error: "این تراکنش قبلاً استفاده شده است." },
            { status: 400 }
          );
        }
        // ۱۰۱ بدون پرداخت موفق دیگر → تلاش قبلی ما پیش از commit مرده → ادامه
      }

      const refId = zRes.refId ?? `${Date.now()}${Math.floor(Math.random() * 10000)}`;

      // افزایش اتمیک موجودی + ثبت تراکنش + success در یک tx (idempotent با شروط status)
      const newBalance = await db.$transaction(async (tx) => {
        // اگر همین پرداخت در همین لحظه توسط فراخوان دیگری success شد → skip
        const fresh = await tx.payment.findUnique({
          where: { id: payment.id },
          select: { status: true },
        });
        if (fresh?.status === "success") {
          const u = await tx.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } });
          return u?.walletBalance ?? 0;
        }
        await tx.user.update({
          where: { id: user.id },
          data: { walletBalance: { increment: payment.amount } },
        });
        const u2 = await tx.user.findUnique({
          where: { id: user.id },
          select: { walletBalance: true },
        });
        const balance = u2?.walletBalance ?? 0;
        await tx.walletTransaction.create({
          data: {
            userId: user.id,
            type: "deposit",
            amount: payment.amount,
            balance,
            description: `شارژ کیف پول — ${toPersianDigits(payment.amount.toLocaleString("en-US"))} تومان`,
            refId: payment.id,
          },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "success",
            refId,
            verifiedAt: new Date(),
            cardPan: zRes.cardPan ?? null,
            cardHash: zRes.cardHash ?? null,
            fee: zRes.fee ?? null,
          },
        });
        return balance;
      });

      await createNotification(
        user.id,
        "system",
        "کیف پول شما شارژ شد ✅",
        `مبلغ ${toPersianDigits(payment.amount.toLocaleString("en-US"))} تومان با موفقیت به کیف پول شما اضافه شد. موجودی فعلی: ${toPersianDigits(newBalance.toLocaleString("en-US"))} تومان.`,
        "?tab=dashboard"
      );

      const topupDto = await buildUserDto(user.id);
      return Response.json({
        success: true,
        status: "success",
        type: "wallet_topup",
        message: "کیف پول شما با موفقیت شارژ شد.",
        refId,
        amount: payment.amount,
        originalAmount: payment.originalAmount,
        walletBalance: newBalance,
        user: topupDto,
      });
    }

    // ─── خرید پلن ───
    if (payment.paymentMethod === "gateway") {
      if (!isZarinpalConfigured()) {
        await markPaymentFailed(payment.id);
        return Response.json({
          success: false,
          status: "failed",
          message: "درگاه پرداخت پیکربندی نشده است.",
        });
      }

      // F2: هرگز به body.authority اعتماد نمی‌شود — فقط تطابق defensive
      if (
        body.authority &&
        typeof body.authority === "string" &&
        body.authority.trim() &&
        payment.authority &&
        body.authority.trim() !== payment.authority
      ) {
        await markPaymentFailed(payment.id);
        return Response.json(
          { success: false, status: "failed", message: "کد مرجع پرداخت با تراکنش مطابقت ندارد." },
          { status: 400 }
        );
      }

      if (!payment.authority) {
        await markPaymentFailed(payment.id);
        return Response.json({
          success: false,
          status: "failed",
          message: "کد مرجع پرداخت (authority) یافت نشد.",
        });
      }

      const zRes = await zarinpalVerify({
        authority: payment.authority, // F2: همیشه از DB
        amount: payment.amount, // Tomans
      });

      if (!zRes.ok) {
        if (zRes.transportError) {
          // خطای شبکه — غیرقطعی: آزادسازی claim؛ recover/کرون/تلاش مجدد کاربر
          await releaseClaim(payment.id);
          return Response.json(
            {
              success: false,
              status: "pending",
              message:
                "خطای موقت در ارتباط با زرین‌پال. مبلغ در صورت پرداخت حفظ می‌شود و سیستم دوباره بررسی می‌کند.",
            },
            { status: 200 }
          );
        }
        // تایید قطعی ناموفق — پرداخت واقعاً ناموفق است
        await markPaymentFailed(payment.id, zRes.refId ?? null);
        return Response.json({
          success: false,
          status: "failed",
          message: `تأیید پرداخت توسط زرین‌پال ناموفق بود: ${zRes.error ?? "Zarinpal verify failed"}`,
          refId: zRes.refId,
        });
      }

      // موفق (100 یا 101)
      if (zRes.code === 101 || zRes.alreadyVerified) {
        // ─── سیاست ۱۰۱: فقط با وجود Payment موفق «دیگر» روی همان authority رد ───
        if (await isAuthorityUsedElsewhere(payment.authority, payment.id)) {
          await markPaymentFailed(payment.id);
          return Response.json(
            { success: false, status: "failed", error: "این تراکنش قبلاً استفاده شده است." },
            { status: 400 }
          );
        }
        // ۱۰۱ بدون رکورد موفق دیگر → تلاش قبلی ما نیمه‌کاره مرده → تحویل
        console.info(
          "[payment/verify] code 101 بدون replay — تحویل پرداخت از قبل-verify شده:",
          payment.id
        );
      }

      const refId = zRes.refId ?? `${Date.now()}${Math.floor(Math.random() * 10000)}`;

      try {
        const result = await deliverPlanPayment({
          userId: user.id,
          payment,
          refId,
          cardPan: zRes.cardPan ?? null,
          cardHash: zRes.cardHash ?? null,
          fee: zRes.fee ?? null,
        });
        return Response.json(result);
      } catch (txErr) {
        if (txErr instanceof WalletInsufficientError) {
          await markPaymentFailed(payment.id);
          return Response.json({
            success: false,
            status: "failed",
            message: "موجودی کیف پول در زمان تایید کافی نبود.",
          });
        }
        // خطای DB غیرمنتظره — claim را آزاد نکن (verify یکتا نیست؛ recover دوباره
        // از ۱۰۱ همین مسیر را تحویل می‌دهد). failed نمی‌کنیم؛ pending می‌ماند.
        console.error("[payment/verify] delivery error:", txErr);
        await releaseClaim(payment.id);
        return Response.json(
          {
            success: false,
            status: "pending",
            message: "خطای موقت در ثبت نهایی خرید. به‌زودی دوباره تلاش می‌شود — پول شما حفظ شده است.",
          },
          { status: 200 }
        );
      }
    }

    // ─── پرداخت از کیف پول (بدون درگاه) — تحویل آنی ───
    {
      const refId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
      try {
        const result = await deliverPlanPayment({
          userId: user.id,
          payment,
          refId,
        });
        return Response.json(result);
      } catch (txErr) {
        if (txErr instanceof WalletInsufficientError) {
          await markPaymentFailed(payment.id);
          return Response.json({
            success: false,
            status: "failed",
            message: "موجودی کیف پول در زمان تایید کافی نبود.",
          });
        }
        console.error("[payment/verify] wallet delivery error:", txErr);
        await releaseClaim(payment.id);
        return Response.json(
          {
            success: false,
            status: "pending",
            message: "خطای موقت در ثبت نهایی خرید. دوباره تلاش کنید.",
          },
          { status: 200 }
        );
      }
    }
  } catch (e) {
    return apiError(e);
  }
}
