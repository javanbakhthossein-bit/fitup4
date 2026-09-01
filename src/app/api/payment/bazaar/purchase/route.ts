/**
 * POST /api/payment/bazaar/purchase — فعال‌سازی اشتراک خریداری‌شده از پرداخت درون‌برنامه‌ای کافه‌بازار
 *
 * فلوی کامل (طبق مستندات رسمی بازار):
 *  ۱. اپ اندروید با پولکی خرید را انجام می‌دهد → purchaseToken می‌گیرد
 *  ۲. سایت داخل WebView از طریق پل JS (window.fitupBazaarPurchase) همان خرید را
 *     با productId + purchaseToken به همین endpoint می‌فرستد
 *  ۳. سرور خرید را با Developer API بازار راستی‌آزمایی می‌کند:
 *     - کالا (محصول مصرفی — روش پیشنهادی راهنما):
 *       GET {devapi}/applications/{package}/purchases/{productId}/tokens/{token}
 *     - اشتراک (اگر در پیشخان به‌جای کالا، اشتراک ساخته شد):
 *       GET {devapi}/applications/{package}/subscriptions/{sku}/purchases/{token}
 *     (هدر CAFEBAZAAR-PISHKHAN-API-SECRET — توکن از پیشخان توسعه‌دهندگان بازار)
 *  ۴. در صورت معتبر بودن: Payment + Subscription ساخته و پلن کاربر فعال می‌شود
 *     (منطبق با همان منطق زرین‌پال: تمدید همان پلن روزهای باقیمانده را حفظ
 *     می‌کند، اشتراک‌های قبلی منقضی می‌شوند، advanced/ultimate → pending تا
 *     تکمیل پیش‌نیازها، تولید برنامه پس‌زمینه شروع می‌شود، پاداش معرفی پرداخت
 *     می‌شود، idempotency داخل تراکنش)
 *
 * ⚠️ طبق قانون بازار: فروش اشتراک دیجیتال فقط از طریق پرداخت درون‌برنامه‌ای بازار.
 * این مسیر جایگزین زرین‌پال در اپ بازار است (زرین‌پال برای وب می‌ماند).
 *
 * تنظیمات لازم (پیشخان بازار → برنامه → API پیشخان بازار → دریافت توکن):
 *  - SiteSetting: bazaar_api_secret (یا env BAZAAR_API_SECRET)
 *  - env: BAZAAR_PACKAGE_NAME (پیش‌فرض ir.fittup.app)
 */
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";
import { getActivePlan } from "@/lib/fitness/pricing";
import { createNotification } from "@/lib/fitness/notifications";
import { processReferralReward } from "@/lib/fitness/referral";
import { startProgramGenerationInBackground } from "@/lib/fitness/program-generation";
import { PENDING_WINDOW_DAYS } from "@/lib/fitness/subscription";
import { toPersianDigits, type Plan } from "@/lib/fitness/types";
import { computePlanFinalAmount } from "@/lib/fitness/payment-delivery";

const BAZAAR_PACKAGE = process.env.BAZAAR_PACKAGE_NAME || "ir.fittup.app";
const BAZAAR_DEV_API = "https://pardakht.cafebazaar.ir/devapi/v2/api";

interface BazaarPurchaseData {
  kind?: string;
  // کالا (inapp): 0 = خرید موفق | 1 = لغوشده | 2 = بازگشت‌داده‌شده
  purchaseState?: number;
  // اشتراک (subscription): 0 = پرداخت موفق | 1 = بازگشت وجه
  paymentState?: number;
  consumptionState?: number;
  purchaseTimeMillis?: number | string;
  developerPayload?: string;
  error?: string;
  error_description?: string;
}

/** خواندن توکن API بازار از SiteSetting یا env */
async function getBazaarApiSecret(): Promise<string | null> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key: "bazaar_api_secret" } });
    if (row?.value?.trim()) return row.value.trim();
  } catch {
    // DB error → env fallback
  }
  return process.env.BAZAAR_API_SECRET?.trim() || null;
}

/**
 * راستی‌آزمایی خرید با Developer API بازار.
 * ابتدا endpoint «کالا» (روش پیشنهادی) امتحان می‌شود؛ اگر not_found بود،
 * endpoint «اشتراک» (برای SKUهای ساخته‌شده به‌صورت اشتراک) امتحان می‌شود.
 * در هر دو، خرید بازگشت‌داده‌شده (refund) رد می‌شود.
 */
async function verifyBazaarPurchase(
  productId: string,
  purchaseToken: string,
  secret: string
): Promise<{ ok: boolean; data?: BazaarPurchaseData; error?: string }> {
  const attempts: string[] = [
    // ۱) کالا (consumable product) — روش پیشنهادی راهنمای انتشار
    `${BAZAAR_DEV_API}/applications/${encodeURIComponent(BAZAAR_PACKAGE)}/purchases/${encodeURIComponent(
      productId
    )}/tokens/${encodeURIComponent(purchaseToken)}`,
    // ۲) اشتراک — سازگاری با SKUهایی که در پیشخان به‌صورت subscription ساخته شده‌اند
    `${BAZAAR_DEV_API}/applications/${encodeURIComponent(BAZAAR_PACKAGE)}/subscriptions/${encodeURIComponent(
      productId
    )}/purchases/${encodeURIComponent(purchaseToken)}`,
  ];
  let lastErr = "خرید یافت نشد.";
  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: { "CAFEBAZAAR-PISHKHAN-API-SECRET": secret, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      const data = (await res.json().catch(() => ({}))) as BazaarPurchaseData;
      if (!res.ok) {
        const err = data.error || String(res.status);
        if (err === "not_found") {
          // شاید SKU از نوع دیگر است — endpoint بعدی را امتحان کن
          lastErr = "خرید یافت نشد — توکن خرید نامعتبر است.";
          continue;
        }
        return { ok: false, error: `راستی‌آزمایی بازار ناموفق (${res.status}): ${data.error_description || err}` };
      }
      // کالا: purchaseState 1=لغو, 2=بازگشت | اشتراک: paymentState 1=بازگشت وجه
      const refunded =
        data.paymentState === 1 || data.purchaseState === 1 || data.purchaseState === 2;
      if (refunded) {
        return { ok: false, error: "این خرید بازگشت‌داده‌شده (refund) یا لغو شده است." };
      }
      return { ok: true, data };
    } catch (e) {
      lastErr = `خطا در ارتباط با API بازار: ${e instanceof Error ? e.message : "نامشخص"}`;
    }
  }
  return { ok: false, error: lastErr };
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();

    // T12: خرید فقط با آنبوردینگ تکمیل‌شده
    if (!user.onboardingDone) {
      return Response.json(
        { code: "ONBOARDING_REQUIRED", error: "برای خرید پلن، ابتدا اطلاعات آنبوردینگ خود را تکمیل کنید." },
        { status: 403 }
      );
    }

    const rl = rateLimit(`bazaar-purchase:${user.id}`, 10, 60_000);
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const body = (await req.json()) as {
      planId?: string;
      productId?: string;
      purchaseToken?: string;
      orderId?: string;
      /** کد تخفیف اعمال‌شده روی قیمت پویا (سرور دوباره مستقل محاسبه/ثبت می‌کند) */
      discountCode?: string;
      userDiscountCode?: string;
    };
    const planId = String(body.planId || "").trim();
    const productId = String(body.productId || "").trim();
    const purchaseToken = String(body.purchaseToken || "").trim();

    if (!planId || !productId || !purchaseToken) {
      return Response.json({ error: "planId و productId و purchaseToken الزامی است." }, { status: 400 });
    }
    // اعتبارسنجی planId — فقط مقادیر مجاز
    const VALID_PLANS: Plan[] = ["basic", "standard", "advanced", "ultimate"];
    if (!VALID_PLANS.includes(planId as Plan)) {
      return Response.json({ error: "پلن نامعتبر است." }, { status: 400 });
    }
    if (purchaseToken.length > 512 || productId.length > 128) {
      return Response.json({ error: "ورودی نامعتبر." }, { status: 400 });
    }

    const plan = await getActivePlan(planId as Plan);
    if (!plan) {
      return Response.json({ error: "پلن نامعتبر است." }, { status: 400 });
    }

    // ─── محاسبه مبلغ واقعی (قیمت پویا/تخفیف — همان منطق checkout) ───
    // سرور دوباره مستقل محاسبه می‌کند؛ ورودی کلاینت فقط برای همخوانی است.
    // اگر کد نامعتبر باشد → قیمت پایه (پرداخت بازار با قیمت SKU انجام شده و معتبر است).
    let computed: Awaited<ReturnType<typeof computePlanFinalAmount>> | null = null;
    try {
      computed = await computePlanFinalAmount(user.id, plan, {
        discountCode: body.discountCode,
        userDiscountCode: body.userDiscountCode,
      });
    } catch {
      computed = null; // کد تخفیف نامعتبر → ثبت با قیمت پایه
    }
    const paidAmount = computed?.finalAmount ?? plan.price;

    // راستی‌آزمایی با بازار
    const secret = await getBazaarApiSecret();
    if (secret) {
      const v = await verifyBazaarPurchase(productId, purchaseToken, secret);
      if (!v.ok) {
        return Response.json({ error: v.error || "راستی‌آزمایی خرید بازار ناموفق بود." }, { status: 400 });
      }
    } else if (process.env.NODE_ENV === "production" && process.env.BAZAAR_SKIP_VERIFY !== "true") {
      return Response.json(
        {
          error:
            "توکن API بازار تنظیم نشده — ادمین باید از پیشخان توسعه‌دهندگان بازار (برنامه → API پیشخان بازار → دریافت توکن) توکن بگیرد و در تنظیمات سایت قرار دهد.",
        },
        { status: 500 }
      );
    } else {
      console.warn("[bazaar/purchase] ⚠️ BAZAAR_API_SECRET تنظیم نشده — راستی‌آزمایی skip شد (غیر-production).");
    }

    // ─── فعال‌سازی اشتراک (منطبق با فلوی زرین‌پال) ───
    const now = new Date();
    const needsBodyPhoto = plan.id === "advanced" || plan.id === "ultimate";

    const result = await db.$transaction(async (tx) => {
      // ─── Idempotency داخل تراکنش (ممیزی 2-a باگ #5) ───
      // دو فراخوانی همزمان با یک توکن نمی‌توانند هر دو Payment بسازند.
      // (Payment.authority در schema یکتا نیست — چک شرطی داخل tx این را جبران می‌کند.)
      const existing = await tx.payment.findFirst({
        where: { authority: purchaseToken, status: "success" },
      });
      if (existing) {
        const sub = await tx.subscription.findFirst({
          where: { paymentId: existing.id },
          select: { status: true },
        });
        return {
          alreadyProcessed: true as const,
          paymentId: existing.id,
          subscriptionStatus: sub?.status ?? null,
        };
      }

      // ثبت پرداخت بازار — authority = purchaseToken (idempotency)
      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          amount: paidAmount, // مبلغ واقعی پرداختی (قیمت پویا/تخفیف‌دار)
          originalAmount: plan.price,
          plan: plan.id,
          paymentMethod: "gateway",
          authority: purchaseToken,
          refId: body.orderId || purchaseToken.slice(0, 40),
          status: "success",
          discountCode: computed?.discountCode ?? null,
          description: `خرید درون‌برنامه‌ای کافه‌بازار — محصول ${productId}`,
          verifiedAt: now,
        },
      });

      // ─── تمدید همان پلن: روزهای باقیمانده حفظ می‌شود (مثل زرین‌پال) ───
      let remainingDaysPreserved = 0;
      const oldActiveSub = await tx.subscription.findFirst({
        where: { userId: user.id, status: "active" },
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

      // اشتراک‌های قبلی: فعال → منقضی | pending → لغو (مثل زرین‌پال)
      await tx.subscription.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "expired" },
      });
      await tx.subscription.updateMany({
        where: { userId: user.id, status: "pending" },
        data: { status: "cancelled" },
      });

      if (needsBodyPhoto) {
        // پنجره pending — همان ثابت مشترک ۷ روزه زرین‌پال (ممیزی 2-a باگ #10)
        const pendingWindowEnd = new Date(now);
        pendingWindowEnd.setDate(pendingWindowEnd.getDate() + PENDING_WINDOW_DAYS);
        await tx.subscription.create({
          data: {
            userId: user.id,
            plan: plan.id,
            status: "pending",
            startDate: null,
            endDate: pendingWindowEnd,
            durationDays: plan.durationDays,
            pricePaid: plan.price,
            paymentId: payment.id,
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            userId: user.id,
            plan: plan.id,
            status: "active",
            startDate: now,
            endDate,
            durationDays: plan.durationDays,
            pricePaid: plan.price,
            paymentId: payment.id,
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
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

      const progReq = await tx.programRequest.create({
        data: {
          userId: user.id,
          plan: plan.id,
          billingPeriod: "monthly",
          status: needsBodyPhoto ? "pending_body_photo" : "pending_generation",
          paymentId: payment.id,
        },
      });

      // ─── F9: مصرف اتمیک کد تخفیف (همان منطق verify) ───
      if (computed?.discountCode) {
        const udc = await tx.userDiscountCode.findUnique({
          where: { code: computed.discountCode },
        });
        if (udc) {
          if (udc.userId === user.id) {
            await tx.userDiscountCode.updateMany({
              where: {
                id: udc.id,
                userId: user.id,
                isUsed: false,
                validUntil: { gt: now },
              },
              data: { isUsed: true },
            });
          }
        } else {
          const dc = await tx.discountCode.findUnique({
            where: { code: computed.discountCode },
          });
          if (dc) {
            await tx.discountCode.updateMany({
              where: {
                code: dc.code,
                active: true,
                OR: [{ validUntil: null }, { validUntil: { gt: now } }],
                ...(dc.maxUses !== -1 ? { usedCount: { lt: dc.maxUses } } : {}),
              },
              data: { usedCount: { increment: 1 } },
            });
          }
        }
      }

      return {
        alreadyProcessed: false as const,
        paymentId: payment.id,
        progReqId: progReq.id,
        remainingDaysPreserved,
        endDate,
      };
    });

    // ─── مسیر تکراری: پاسخ idempotent ───
    if (result.alreadyProcessed) {
      return Response.json({
        ok: true,
        alreadyProcessed: true,
        message: "این خرید قبلاً فعال شده است.",
        planId: plan.id,
        subscriptionStatus: result.subscriptionStatus,
        paymentId: result.paymentId,
      });
    }

    const preservedNote =
      result.remainingDaysPreserved > 0
        ? ` ${toPersianDigits(result.remainingDaysPreserved)} روز از اشتراک قبلی شما به اشتراک جدید اضافه شد 🎁`
        : "";

    if (needsBodyPhoto) {
      // بدون تولید برنامه — منتظر ارسال عکس‌های بدن (مثل زرین‌پال)
      await createNotification(
        user.id,
        "system",
        "ارسال عکس بدن الزامی است 📸",
        plan.id === "ultimate"
          ? "برای دریافت برنامه اختصاصی، ارسال عکس‌های بدن (۴ زاویه) الزامی است. ارسال ویدیوی فرم حرکات و آزمایش خون اختیاری است."
          : "برای دریافت برنامه اختصاصی، عکس‌های بدن خود (۴ زاویه) را ارسال کنید. سپس فیتاپ هوشمند برنامه شما را طراحی می‌کند.",
        "?tab=dashboard&open=bodyAnalysis"
      );
    } else {
      // ─── تولید برنامه در پس‌زمینه (ممیزی 2-a باگ #4 — قبلاً اینجا جا افتاده بود) ───
      try {
        const gen = await startProgramGenerationInBackground(user.id);
        if (!gen.started && gen.reason !== "already_generating") {
          await db.programRequest.update({
            where: { id: result.progReqId },
            data: { status: "failed" },
          });
          await createNotification(
            user.id,
            "system",
            "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
            `تولید برنامه شما شروع نشد (${gen.reason ?? "دلیل نامشخص"}). لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید.`,
            "?tab=programs"
          );
        } else {
          await createNotification(
            user.id,
            "system",
            "برنامه شما در حال طراحی است ⏳",
            "فیتاپ هوشمند طراحی برنامه تمرینی و غذایی شخصی‌سازی‌شده شما را شروع کرد. پس از آماده‌سازی به شما اطلاع می‌دهیم.",
            "?tab=programs"
          );
        }
      } catch (genErr) {
        console.error("[bazaar/purchase] program generation start failed:", genErr);
        await db.programRequest.update({
          where: { id: result.progReqId },
          data: { status: "failed" },
        });
        await createNotification(
          user.id,
          "system",
          "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
          "تولید برنامه شما با خطا مواجه شد. لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید.",
          "?tab=programs"
        );
      }
    }

    // نوتیف خرید موفق (مثل زرین‌پال)
    await createNotification(
      user.id,
      "subscription",
      needsBodyPhoto ? "پلن شما ثبت شد! ✅" : "پلن شما فعال شد! ✅",
      needsBodyPhoto
        ? `پلن ${plan.label} با موفقیت خریداری شد. برای شروع دوره ${toPersianDigits(plan.durationDays)} روزه، عکس‌های بدن خود را ارسال کنید.${preservedNote}`
        : `پلن ${plan.label} با موفقیت خریداری شد. تا ${result.endDate.toLocaleDateString("fa-IR")} فعال است.${preservedNote}`,
      "?tab=dashboard",
      { planId: plan.id, gateway: "bazaar", refId: body.orderId || purchaseToken.slice(0, 40) }
    );

    // ─── پاداش معرفی (ممیزی 2-a باگ #4 — قبلاً در مسیر بازار جا افتاده بود) ───
    if (!needsBodyPhoto) {
      try {
        await processReferralReward({
          buyerUserId: user.id,
          paymentId: result.paymentId,
        });
      } catch (refErr) {
        console.error("[bazaar/purchase] referral reward failed:", refErr);
      }
    }

    return Response.json({
      ok: true,
      message: needsBodyPhoto
        ? "اشتراک شما ثبت شد! برای شروع دوره، عکس‌های بدن را ارسال کنید."
        : `اشتراک ${plan.label} فعال شد 🎉`,
      planId: plan.id,
      pendingPrerequisites: needsBodyPhoto,
      paymentId: result.paymentId,
    });
  } catch (e) {
    return apiError(e);
  }
}
