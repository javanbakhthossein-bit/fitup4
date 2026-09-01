import { NextRequest } from "next/server";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { SUBSCRIPTION_PLANS, type Plan } from "@/lib/fitness/types";
import { getPriceSettings, setPlanPrice } from "@/lib/fitness/pricing";

const VALID_PLAN_IDS = new Set<string>(SUBSCRIPTION_PLANS.map((p) => p.id));

// GET /api/admin/pricing — دریافت قیمت‌های فعلی همه پلن‌ها
export async function GET() {
  try {
    await requireAdmin();
    const prices = await getPriceSettings();
    return Response.json({
      prices: SUBSCRIPTION_PLANS.map((p) => ({
        id: p.id,
        label: p.label,
        tagline: p.tagline,
        icon: p.icon,
        durationDays: p.durationDays,
        currentPrice: prices[p.id as Plan],
        defaultPrice: p.price,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

// PUT /api/admin/pricing — بروزرسانی قیمت یک یا چند پلن
// body: { prices: { basic: number, standard: number, ... } }
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const { prices } = await req.json();
    if (!prices || typeof prices !== "object") {
      return Response.json({ error: "فرمت درخواست نامعتبر است." }, { status: 400 });
    }

    const updates: { planId: Plan; price: number }[] = [];
    for (const [planId, price] of Object.entries(prices)) {
      if (!VALID_PLAN_IDS.has(planId)) {
        return Response.json({ error: `پلن نامعتبر: ${planId}` }, { status: 400 });
      }
      const n = Number(price);
      // سقف/کف قیمت (ممیزی 2-c P2): قبلاً فقط n≥0 چک می‌شد → قیمت 0 (پلن رایگان
      // غیرعمدی) یا ۱e12 (سرریز Int در Payment موقع خرید) قابل ذخیره بود.
      if (!Number.isFinite(n) || n <= 0 || n > 100_000_000) {
        return Response.json(
          { error: `قیمت نامعتبر برای پلن ${planId} — باید بین ۱ تا ۱۰۰,۰۰۰,۰۰۰ تومان باشد.` },
          { status: 400 }
        );
      }
      updates.push({ planId: planId as Plan, price: Math.round(n) });
    }

    for (const { planId, price } of updates) {
      await setPlanPrice(planId, price);
    }

    return Response.json({ ok: true, updated: updates.length });
  } catch (e) {
    return apiError(e);
  }
}
