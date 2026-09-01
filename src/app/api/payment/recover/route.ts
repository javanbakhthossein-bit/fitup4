import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";
import { zarinpalVerify } from "@/lib/fitness/zarinpal";
import {
  WalletInsufficientError,
  claimPayment,
  releaseClaim,
  markPaymentFailed,
  getRecoveryCutoff,
  deliverWalletTopupPayment,
  isAuthorityUsedElsewhere,
  deliverPlanPayment,
  RECOVER_WINDOW_MS,
  VERIFYING_STUCK_MS,
} from "@/lib/fitness/payment-delivery";

/**
 * POST /api/payment/recover — بازیابی پرداخت‌های معلق (باگ «در انتظار»).
 *
 * کی صدا زده می‌شود:
 *  ۱. خودکار: پس از لاگین کاربر (page-client) — پرداخت‌های pending خودش
 *  ۲. بازگشت از درگاه: PaymentVerifyHandler وقتی verify همچنان pending بود
 *  ۳. ادمین: دکمه «بازیابی» روی ردیف‌های pending در حسابداری → {paymentId}
 *
 * منطق برای هر پرداخت gateway:
 *  - claim اتمیک → zarinpalVerify(authority, amount):
 *      • ok(100) → تحویل کامل
 *      • ok(101) → چک replay (Payment موفق دیگر با همان authority) → وگرنه تحویل
 *      • خطای شبکه → آزادسازی claim؛ همان pending بمان (بعداً دوباره)
 *      • خطای قطعی → «همان pending بمان» (شاید کاربر هنوز در درگاه است/پرداخت
 *        نکرده) — این endpoint هیچ‌وقت فقط به دلیل «verify error» failed نمی‌کند؛
 *        failed شدن فقط از خود callback (NOK) یا خطای تحویل می‌آید.
 *  - wallet: تحویل مستقیم (کسر اتمیک؛ اگر موجودی ناکافی → failed)
 *
 * ─── برش Legacy Cutoff ───
 * مسیر «خودکار» (بدون paymentId) فقط پرداخت‌های بعد از برش را می‌بیند؛
 * معلق‌های قدیمی که ادمین دستی تعیین‌تکلیف کرده (manual_resolved) هرگز
 * خودکار تحویل نمی‌شوند. ادمین با paymentId صریح می‌تواند هر ردیفی را
 * (حتی manual_resolved/expired) مجدد بازیابی کند — با تأییدیه UI.
 *
 * ادمین می‌تواند paymentId هر کاربری را بفرستد؛ کاربر عادی فقط پرداخت خودش.
 */

interface RecoverBody {
  paymentId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth();
    const body = (await req.json().catch(() => ({}))) as RecoverBody;

    const rl = rateLimit(`payment-recover:${actor.id}`, 10, 60_000);
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const isAdmin = actor.role === "ADMIN";
    const targetPaymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";

    // انتخاب پرداخت‌های کاندید
    // برش Legacy Cutoff — اولین فراخوانی بعد از deploy مقدار را قفل می‌کند.
    // (تعیین‌تکلیف آگاهانه معلق‌های قدیمی کارِ جاروی cron/داخلی است — اینجا فقط
    // برای محدود کردن پنجره‌ی مسیر «بدون paymentId» استفاده می‌شود.)
    const { cutoff: cutoffDate } = await getRecoveryCutoff();
    const cutoff = cutoffDate;
    let candidates;
    if (targetPaymentId) {
      let p = await db.payment.findUnique({ where: { id: targetPaymentId } });
      if (!p) {
        return Response.json({ error: "پرداخت یافت نشد." }, { status: 404 });
      }
      if (p.userId !== actor.id && !isAdmin) {
        return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
      }
      // ─── بازیابی صریح ادمین روی ردیف بسته‌شده قدیمی/منقضی ───
      // manual_resolved = ادمین قبلاً دستی تعیین‌تکلیف کرده؛ expired = بی‌پرداخت
      // بسته شده. اگر ادمین (با تأییدیه UI) بخواهد، اتمیک به pending برمی‌گردد
      // تا استعلام/تحویل واقعی انجام شود. برای کاربر عادی مسدود است.
      if ((p.status === "manual_resolved" || p.status === "expired") && isAdmin) {
        const reset = await db.payment.updateMany({
          where: { id: p.id, status: p.status },
          data: { status: "pending" },
        });
        if (reset.count === 1) {
          p = { ...p, status: "pending" };
        }
      }
      candidates = [p];
    } else {
      // بدون paymentId → فقط معلق‌های خود کاربر «بعد از برش» (جاروی عمومی کارِ کرون است)
      const windowStart = new Date(Date.now() - RECOVER_WINDOW_MS);
      const sweepStart = cutoff > windowStart ? cutoff : windowStart;
      candidates = await db.payment.findMany({
        where: {
          userId: actor.id,
          status: { in: ["pending", "verifying"] },
          createdAt: { gte: sweepStart },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    }

    const results: Array<{
      paymentId: string;
      status: string;
      recovered: boolean;
      message?: string;
    }> = [];
    let anyRecovered = false;
    let freshUserDto: unknown = null;

    for (let payment of candidates) {
      // فقط پرداخت‌های معلق واقعی؛ verifying تازه را کسی دیگر در حال پردازش است
      if (payment.status === "verifying") {
        const stuckFor = payment.verifiedAt ? Date.now() - payment.verifiedAt.getTime() : 0;
        if (stuckFor < VERIFYING_STUCK_MS) {
          results.push({
            paymentId: payment.id,
            status: "verifying",
            recovered: false,
            message: "در حال پردازش توسط فراخوان دیگری است.",
          });
          continue;
        }
        // verifying «گیرکرده» (>۱۵ دقیقه) → ریست به pending تا همین‌جا دوباره claim
        // و verify کنیم — پرداخت ممکن است انجام شده باشد؛ قبل از استعلام ریست
        // می‌کنیم (نمی‌گذاریم claimPayment آن را fail کند). اتمیک با شرط status.
        const reset = await db.payment.updateMany({
          where: { id: payment.id, status: "verifying" },
          data: { status: "pending" },
        });
        if (reset.count === 1) {
          payment = { ...payment, status: "pending" };
        }
      }

      const claim = await claimPayment(payment);
      if (claim === "busy" || claim === "stuck") {
        results.push({
          paymentId: payment.id,
          status: claim === "stuck" ? "failed" : "verifying",
          recovered: false,
          message:
            claim === "stuck"
              ? "پردازش قبلی نیمه‌کاره بود و ریست شد؛ دوباره بازیابی کنید."
              : "در حال پردازش است.",
        });
        continue;
      }
      if (claim === "processed") {
        results.push({
          paymentId: payment.id,
          status: payment.status,
          recovered: payment.status === "success",
          message:
            payment.status === "success"
              ? "قبلاً با موفقیت پردازش شده است."
              : "این پرداخت قبلاً تعیین تکلیف شده است.",
        });
        if (payment.status === "success") anyRecovered = true;
        continue;
      }

      // claimed → مسیر بازیابی
      try {
        // ۱) پرداخت کیف‌پولی پلن: تحویل مستقیم
        if (payment.paymentMethod === "wallet" && payment.plan !== "wallet_topup") {
          const refId = payment.refId ?? `${Date.now()}${Math.floor(Math.random() * 10000)}`;
          const result = await deliverPlanPayment({ userId: payment.userId, payment, refId });
          results.push({
            paymentId: payment.id,
            status: "success",
            recovered: true,
            message: "پرداخت کیف‌پولی با موفقیت تحویل شد.",
          });
          anyRecovered = true;
          if (payment.userId === actor.id) freshUserDto = (result as { user?: unknown }).user ?? null;
          continue;
        }

        // ۲) پرداخت درگاهی (gateway) — verify مجدد با زرین‌پال
        if (payment.paymentMethod === "gateway" && payment.authority) {
          const zRes = await zarinpalVerify({
            authority: payment.authority,
            amount: payment.amount,
          });

          if (!zRes.ok) {
            if (zRes.transportError) {
              await releaseClaim(payment.id);
              results.push({
                paymentId: payment.id,
                status: "pending",
                recovered: false,
                message: "خطای موقت شبکه در استعلام زرین‌پال — بعداً دوباره.",
              });
              continue;
            }
            // خطای قطعی درگاه (مثلاً authority پرداخت‌نشده/نامعتبر) → pending بمان.
            // کاربر شاید هنوز پرداخت نکرده؛ failed فقط از callback NOK می‌آید.
            await releaseClaim(payment.id);
            results.push({
              paymentId: payment.id,
              status: "pending",
              recovered: false,
              message:
                "زرین‌پال هنوز پرداخت موفقی برای این تراکنش ثبت نکرده است. اگر مبلغ کسر شده و فعال نشدید، پس از چند دقیقه دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.",
            });
            continue;
          }

          // ok (100 یا 101) — چک replay برای 101
          if (zRes.code === 101 || zRes.alreadyVerified) {
            if (await isAuthorityUsedElsewhere(payment.authority, payment.id)) {
              await markPaymentFailed(payment.id, zRes.refId ?? null);
              results.push({
                paymentId: payment.id,
                status: "failed",
                recovered: false,
                message: "این تراکنش قبلاً در پرداخت دیگری استفاده شده است.",
              });
              continue;
            }
          }

          const refId = zRes.refId ?? payment.refId ?? `${Date.now()}${Math.floor(Math.random() * 10000)}`;
          const wasRecovered = !zRes.alreadyVerified; // 100 = همین حالا تایید شد؛ 101 = از تلاش قبلی
          const result = await deliverPlanPayment({
            userId: payment.userId,
            payment,
            refId,
            cardPan: zRes.cardPan ?? null,
            cardHash: zRes.cardHash ?? null,
            fee: zRes.fee ?? null,
          });
          results.push({
            paymentId: payment.id,
            status: "success",
            recovered: true,
            message: wasRecovered
              ? "پرداخت شما تأیید و پلن فعال شد."
              : "پرداخت (از تلاش قبلی نیمه‌کاره) تأیید و پلن فعال شد.",
          });
          anyRecovered = true;
          if (payment.userId === actor.id) freshUserDto = (result as { user?: unknown }).user ?? null;
          continue;
        }

        // ۳) wallet_topup معلق درگاهی — helper اتمیک مشترک (payment-delivery)
        if (payment.plan === "wallet_topup" && payment.paymentMethod === "gateway" && payment.authority) {
          const zRes = await zarinpalVerify({
            authority: payment.authority,
            amount: payment.amount,
          });
          if (
            !zRes.ok ||
            ((zRes.code === 101 || zRes.alreadyVerified) &&
              (await isAuthorityUsedElsewhere(payment.authority, payment.id)))
          ) {
            await releaseClaim(payment.id);
            results.push({
              paymentId: payment.id,
              status: "pending",
              recovered: false,
              message: "شارژ کیف پول هنوز توسط زرین‌پال تایید نشده است.",
            });
            continue;
          }
          const refId = zRes.refId ?? `${Date.now()}${Math.floor(Math.random() * 10000)}`;
          await deliverWalletTopupPayment({
            payment,
            refId,
            cardPan: zRes.cardPan ?? null,
            cardHash: zRes.cardHash ?? null,
            fee: zRes.fee ?? null,
          });
          results.push({
            paymentId: payment.id,
            status: "success",
            recovered: true,
            message: "شارژ کیف پول معلق، با موفقیت ثبت شد.",
          });
          anyRecovered = true;
          continue;
        }

        // بقیه (بدون authority) → آزاد کن
        await releaseClaim(payment.id);
        results.push({
          paymentId: payment.id,
          status: "pending",
          recovered: false,
          message: "این پرداخت درگاه ندارد و قابل بازیابی نیست.",
        });
      } catch (err) {
        if (err instanceof WalletInsufficientError) {
          await markPaymentFailed(payment.id);
          results.push({
            paymentId: payment.id,
            status: "failed",
            recovered: false,
            message: "موجودی کیف پول در زمان تحویل کافی نبود.",
          });
          continue;
        }
        console.error("[payment/recover] delivery error:", payment.id, err);
        await releaseClaim(payment.id);
        results.push({
          paymentId: payment.id,
          status: "pending",
          recovered: false,
          message: "خطای موقت در تحویل — دوباره تلاش کنید.",
        });
      }
    }

    return Response.json({
      checked: results.length,
      recoveredCount: results.filter((r) => r.recovered).length,
      results,
      anyRecovered,
      ...(freshUserDto ? { user: freshUserDto } : {}),
    });
  } catch (e) {
    return apiError(e);
  }
}
