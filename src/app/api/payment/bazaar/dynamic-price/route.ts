import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";
import { getActivePlan } from "@/lib/fitness/pricing";
import type { Plan } from "@/lib/fitness/types";
import { computePlanFinalAmount, DiscountInvalidError } from "@/lib/fitness/payment-delivery";

/**
 * POST /api/payment/bazaar/dynamic-price — ثبت قیمت پویا در کافه‌بازار.
 *
 * «کلید تخفیف پویا» که از پیشخان بازار می‌گیرید = توکن سرویس قیمت پویا (Dynamic
 * Pricing). چرا لازم است؟ قیمت محصول (SKU) در پنل بازار ثابت است؛ اما فیتاپ
 * تخفیف/اعتبار ارتقا روی قیمت لحظه‌ای دارد (مثلاً کد تخفیف ۲۰٪). با سرویس
 * قیمت پویا مبلغِ دقیقِ نهایی را سمت سرور در بازار ثبت می‌کنیم و شناسه‌اش
 * (dynamic_price_id) به اپ داده می‌شود تا پولکی همان مبلغ را بگیرد.
 *
 * فلوی کامل:
 *  ۱. سایت (purchase-modal) این endpoint را با {planId, discountCode?} صدا می‌زند
 *  ۲. سرور مبلغ نهایی را مثل checkout حساب می‌کند (computePlanFinalAmount)
 *  ۳. اگر مبلغ == قیمت پایه → dynamicPriceId:null (خرید با قیمت عادی SKU)
 *  ۴. وگرنه POST به سرویس قیمت پویا بازار (مبلغ به ریال) → dynamic_price_id
 *  ۵. سایت fitupBazaarPurchase(sku, payload, dynamicPriceId) را صدا می‌زند
 *  ۶. اپ همان شناسه را در PurchaseRequest(dynamicPriceToken=…) می‌گذارد
 *
 * توکن از SiteSetting (bazaar_dynamic_price_token) یا env BAZAAR_DYNAMIC_PRICE_TOKEN.
 */

const BAZAAR_PACKAGE = process.env.BAZAAR_PACKAGE_NAME || "ir.fittup.app";
const DYNAMIC_PRICE_URL = `https://pardakht.cafebazaar.ir/dynamicprice/v1/applications/${encodeURIComponent(
  BAZAAR_PACKAGE
)}/products`;

/** خواندن توکن قیمت پویا از SiteSetting یا env */
async function getDynamicPriceToken(): Promise<string | null> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key: "bazaar_dynamic_price_token" } });
    if (row?.value?.trim()) return row.value.trim();
  } catch {
    // DB error → env fallback
  }
  return process.env.BAZAAR_DYNAMIC_PRICE_TOKEN?.trim() || null;
}

interface DynamicPriceBody {
  planId?: string;
  discountCode?: string;
  userDiscountCode?: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const rl = rateLimit(`bazaar-dynamic-price:${user.id}`, 10, 60_000);
    if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

    const body = (await req.json().catch(() => ({}))) as DynamicPriceBody;
    const planId = String(body.planId || "").trim();
    const VALID_PLANS: Plan[] = ["basic", "standard", "advanced", "ultimate"];
    if (!VALID_PLANS.includes(planId as Plan)) {
      return Response.json({ error: "پلن نامعتبر است." }, { status: 400 });
    }

    const plan = await getActivePlan(planId as Plan);
    if (!plan) {
      return Response.json({ error: "پلن نامعتبر است." }, { status: 400 });
    }

    // مبلغ نهایی — همان منطق checkout (خطای کد تخفیف → 400 مثل checkout)
    let computed;
    try {
      computed = await computePlanFinalAmount(user.id, plan, {
        discountCode: body.discountCode,
        userDiscountCode: body.userDiscountCode,
      });
    } catch (e) {
      if (e instanceof DiscountInvalidError) {
        return Response.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // اگر تخفیف/اعتباری اعمال نشده → قیمت پایه SKU — نیازی به قیمت پویا نیست
    if (computed.finalAmount >= plan.price) {
      return Response.json({
        dynamicPriceId: null,
        finalAmount: plan.price,
        originalAmount: plan.price,
        discountCode: null,
        upgradeCredit: computed.upgradeCredit,
        reason: "base_price",
      });
    }

    // ─── ثبت قیمت پویا در بازار ───
    const token = await getDynamicPriceToken();
    if (!token) {
      // توکن تنظیم نیست → خرید با قیمت پایه SKU ادامه می‌یابد (بدون تخفیف)
      // اپ قیمت ثابت محصول بازار را می‌گیرد. (fail-open عمدی — تخفیف optional است)
      return Response.json(
        {
          dynamicPriceId: null,
          finalAmount: plan.price,
          originalAmount: plan.price,
          discountCode: null,
          upgradeCredit: computed.upgradeCredit,
          reason: "dynamic_price_not_configured",
        },
        { status: 200 }
      );
    }

    // سرویس قیمت پویا بازار مبالغ را به «ریال» می‌گیرد (۱۰ برابر تومان)
    const amountRial = computed.finalAmount * 10;
    const productId = `fitup_${plan.id}`;
    try {
      const res = await fetch(
        `${DYNAMIC_PRICE_URL}/${encodeURIComponent(productId)}/dynamic_prices`,
        {
          method: "POST",
          headers: {
            "CAFEBAZAAR-DYNAMIC-PRICE-TOKEN": token,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ amount: amountRial }),
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        dynamic_price_id?: string;
        error?: string;
        error_description?: string;
      };
      if (!res.ok || !data.dynamic_price_id) {
        console.error("[bazaar/dynamic-price] API error:", res.status, JSON.stringify(data));
        // خطا → خرید با قیمت پایه ادامه می‌یابد (تخفیف اعمال نمی‌شود)
        return Response.json(
          {
            dynamicPriceId: null,
            finalAmount: plan.price,
            originalAmount: plan.price,
            discountCode: null,
            upgradeCredit: computed.upgradeCredit,
            reason: "dynamic_price_api_error",
            error: data.error_description || data.error || String(res.status),
          },
          { status: 200 }
        );
      }

      return Response.json({
        dynamicPriceId: data.dynamic_price_id,
        finalAmount: computed.finalAmount,
        originalAmount: plan.price,
        discountCode: computed.discountCode,
        upgradeCredit: computed.upgradeCredit,
        reason: "dynamic",
      });
    } catch (e) {
      console.error("[bazaar/dynamic-price] network error:", e);
      return Response.json(
        {
          dynamicPriceId: null,
          finalAmount: plan.price,
          originalAmount: plan.price,
          discountCode: null,
          upgradeCredit: computed.upgradeCredit,
          reason: "dynamic_price_network_error",
        },
        { status: 200 }
      );
    }
  } catch (e) {
    return apiError(e);
  }
}
