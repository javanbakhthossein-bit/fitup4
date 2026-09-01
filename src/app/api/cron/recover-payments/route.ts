import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";
import { zarinpalVerify } from "@/lib/fitness/zarinpal";
import { createNotification } from "@/lib/fitness/notifications";
import {
  WalletInsufficientError,
  claimPayment,
  releaseClaim,
  markPaymentFailed,
  markPaymentExpired,
  getRecoveryCutoff,
  resolveLegacyPendingPayments,
  deliverWalletTopupPayment,
  isAuthorityUsedElsewhere,
  deliverPlanPayment,
  RECOVER_WINDOW_MS,
  VERIFYING_STUCK_MS,
} from "@/lib/fitness/payment-delivery";

/**
 * GET /api/cron/recover-payments?secret=CRON_SECRET
 *
 * جاروی پرداخت‌های معلق — باگ «پرداخت کرد ولی در پنل در انتظار ماند»:
 * پرداخت‌های gateway معلق (pending >30min یا verifying >15min گیرکرده) که
 * authority دارند را با verify زرین‌پال دوباره چک می‌کند و در صورت موفقیت
 * (100 یا 101 بدون replay) تحویل کامل انجام می‌شود + نوتیف به کاربر و ادمین‌ها.
 *
 * ─── قواعد حیاتی ───
 * ۱) برش Legacy Cutoff: فقط پرداخت‌های ایجادشده «بعد از» activation لحظه‌ی
 *    استقرار (SiteSetting payment_auto_recover_start) جارو می‌شوند. معلق‌های
 *    قدیمی که ادمین دستی تعیین‌تکلیف کرده یک‌بار manual_resolved شده‌اند و
 *    هرگز تحویل خودکار نمی‌گیرند (درخواست صریح مالک).
 * ۲) تحویل فقط وقتی زرین‌پال «واقعاً» پرداخت را تأیید کند (100/101) —
 *    «وارد درگاه شده و خارج شده» هرگز پلن نمی‌گیرد؛ فقط ردیفش بعد از ۷۲ ساعت
 *    استعلام نهاییِ منفی → expired («منقضی — پرداخت‌نشده») بسته می‌شود.
 *
 * پیشنهاد زمان‌بندی (هر ۱۰ دقیقه) — در crontab سرور:
 *   curl -s "https://fittup.ir/api/cron/recover-payments?secret=$CRON_SECRET"
 *
 * محافظت: CRON_SECRET الزامی (fail-secure).
 */

const BATCH_LIMIT = 50;
const PENDING_MIN_AGE_MS = 30 * 60 * 1000; // فقط معلق‌های بالای ۳۰ دقیقه
const AGED_OUT_BATCH = 20; // بستن تدریجی منقضی‌ها در هر اجرا

export async function GET(req: NextRequest) {
  const rl = rateLimit(`cron-recover-payments:${getClientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results: Array<{ paymentId: string; status: string }> = [];
  let recovered = 0;
  let stillPending = 0;
  let expired = 0;

  try {
    // ─── برش Legacy Cutoff + تعیین‌تکلیف آگاهانه (هر اجرا — idempotent) ───
    // FIX: قبلاً معلق‌های قدیمی کورکورانه manual_resolved می‌شدند؛ حالا هر کدام
    // با استعلام واقعی زرین‌پال تعیین‌تکلیف می‌شود — پرداخت‌شده → تحویل،
    // پرداخت‌نشده → منقضی. این sweep «هر بار» اجرا می‌شود (نه فقط اولین اجرا)
    // تا مواردی که در اجرای قبلی به خطای شبکه خوردند یا busy بودند یتیم نمانند.
    const { cutoff: cutoffDate } = await getRecoveryCutoff();
    const cutoff = cutoffDate;
    let legacySummary: { scanned: number; delivered: number; closed: number } | null = null;
    try {
      const legacy = await resolveLegacyPendingPayments(cutoff);
      legacySummary = {
        scanned: legacy.scanned,
        delivered: legacy.delivered,
        closed: legacy.closed,
      };
      if (legacy.scanned > 0) {
        console.log(
          `[cron/recover-payments] legacy informed sweep: scanned=${legacy.scanned} delivered=${legacy.delivered} closed=${legacy.closed}`
        );
      }
    } catch (e) {
      console.error("[cron/recover-payments] legacy sweep error:", e);
    }
    const windowStart = new Date(now.getTime() - RECOVER_WINDOW_MS);
    // فقط پرداخت‌های «بعد از» برش و داخل پنجره ۷۲ ساعت
    const sweepStart = cutoff > windowStart ? cutoff : windowStart;

    // verifying گیرکرده (>۱۵ دقیقه) یا pending قدیمی (>۳۰ دقیقه)
    // FIX: wallet_topup دیگر مستثنی نیست — شارژ کیف پول معلقِ پرداخت‌شده هم
    // همین‌جا بازیابی می‌شود (قبلاً فقط پلن‌ها؛ شارژ تا ۷۲ ساعت معلق می‌ماند)
    const stuck = await db.payment.findMany({
      where: {
        status: { in: ["pending", "verifying"] },
        paymentMethod: "gateway",
        authority: { not: null },
        createdAt: { gte: sweepStart },
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_LIMIT,
    });

    for (const payment of stuck) {
      let claimable = payment;
      if (payment.status === "verifying") {
        const age = payment.verifiedAt ? now.getTime() - payment.verifiedAt.getTime() : 0;
        if (age < VERIFYING_STUCK_MS) continue; // کس دیگری در حال پردازش
        // verifying گیرکرده → ریست اتمیک به pending (پیش از استعلام، نه fail)
        const reset = await db.payment.updateMany({
          where: { id: payment.id, status: "verifying" },
          data: { status: "pending" },
        });
        if (reset.count === 1) {
          claimable = { ...payment, status: "pending" };
        }
      } else {
        const age = now.getTime() - payment.createdAt.getTime();
        if (age < PENDING_MIN_AGE_MS) continue; // هنوز تازه — کاربر شاید در درگاه است
      }

      const claim = await claimPayment(claimable);
      if (claim !== "claimed") continue;

      try {
        const zRes = await zarinpalVerify({
          authority: payment.authority!,
          amount: payment.amount,
        });

        if (!zRes.ok) {
          // خطای شبکه یا «هنوز پرداخت نشده» → آزاد؛ دور بعدی دوباره چک می‌شود
          await releaseClaim(payment.id);
          stillPending++;
          continue;
        }

        if (zRes.code === 101 || zRes.alreadyVerified) {
          if (await isAuthorityUsedElsewhere(payment.authority!, payment.id)) {
            await markPaymentFailed(payment.id, zRes.refId ?? null);
            results.push({ paymentId: payment.id, status: "failed-replay" });
            continue;
          }
        }

        const refId = zRes.refId ?? payment.refId ?? `${Date.now()}${Math.floor(Math.random() * 10000)}`;

        if (payment.plan === "wallet_topup") {
          // FIX: شارژ کیف پول معلق — helper اتمیک مشترک (قبلاً پوشش نداشت)
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

        // نوتیف به کاربر (پرداخت گم‌شده بازگشت)
        try {
          await createNotification(
            payment.userId,
            "subscription",
            "پلن شما فعال شد! ✅",
            "پرداخت معلق شما به‌صورت خودکار شناسایی و پلن شما فعال شد. برنامه ورزشی شما در حال تولید است.",
            "?tab=dashboard"
          );
        } catch {}

        results.push({ paymentId: payment.id, status: "recovered" });
        recovered++;
      } catch (err) {
        if (err instanceof WalletInsufficientError) {
          await markPaymentFailed(payment.id);
          results.push({ paymentId: payment.id, status: "failed-wallet" });
          continue;
        }
        console.error("[cron/recover-payments] error:", payment.id, err);
        await releaseClaim(payment.id);
        stillPending++;
      }
    }

    // ─── جاروی منقضی‌ها: معلق‌های «بعد از برش» که از پنجره ۷۲ ساعته خارج شده‌اند ───
    // این‌ها بارها استعلام شده‌اند و زرین‌پال هرگز پرداختی برایشان ثبت نکرده
    // (= کاربر وارد درگاه شده و خارج شده است). یک استعلام نهایی: اگر باز هم
    // پرداختی نبود → expired (دیگر در پنل «در انتظار» مانده نمی‌ماند)؛ اگر
    // پرداختی بود (کم‌امکان) → تحویل همان‌جا.
    try {
      const agedOut = await db.payment.findMany({
        where: {
          status: { in: ["pending", "verifying"] },
          createdAt: {
            gte: cutoff,
            lt: new Date(now.getTime() - RECOVER_WINDOW_MS),
          },
        },
        orderBy: { createdAt: "asc" },
        take: AGED_OUT_BATCH,
      });

      for (const payment of agedOut) {
        const claim = await claimPayment(payment);
        if (claim !== "claimed") {
          // busy → در حال پردازش؛ stuck → بسته شد؛ processed → تعیین‌تکلیف شده
          continue;
        }
        try {
          if (payment.paymentMethod === "gateway" && payment.authority) {
            const zRes = await zarinpalVerify({
              authority: payment.authority,
              amount: payment.amount,
            });
            if (zRes.ok) {
              const isReplay =
                (zRes.code === 101 || zRes.alreadyVerified) &&
                (await isAuthorityUsedElsewhere(payment.authority, payment.id));
              if (!isReplay) {
                const refId =
                  zRes.refId ??
                  payment.refId ??
                  `${Date.now()}${Math.floor(Math.random() * 10000)}`;
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
                results.push({ paymentId: payment.id, status: "recovered-aged-out" });
                recovered++;
                continue;
              }
              await markPaymentFailed(payment.id, zRes.refId ?? null);
              results.push({ paymentId: payment.id, status: "failed-replay" });
              continue;
            }
            if (zRes.transportError) {
              // خطای شبکه — نتیجه قطعی نیست؛ دور بعدی دوباره
              await releaseClaim(payment.id);
              stillPending++;
              continue;
            }
          }
          // درگاه پرداختی ثبت نکرده / روش کیف‌پول رهاشده → منقضی
          await markPaymentExpired(payment.id);
          results.push({ paymentId: payment.id, status: "expired-unpaid" });
          expired++;
        } catch (err) {
          console.error("[cron/recover-payments] aged-out error:", payment.id, err);
          await releaseClaim(payment.id);
        }
      }
    } catch (e) {
      console.error("[cron/recover-payments] aged-out sweep fatal:", e);
    }

    return Response.json({
      ok: true,
      scanned: stuck.length,
      recovered,
      stillPending,
      expired,
      cutoff: cutoff.toISOString(),
      legacySweep: legacySummary,
      results,
      ranAt: now.toISOString(),
    });
  } catch (e) {
    console.error("[cron/recover-payments] fatal:", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
