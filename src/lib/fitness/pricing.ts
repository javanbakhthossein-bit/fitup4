import { db } from "@/lib/db";
import { SUBSCRIPTION_PLANS, type Plan, type SubscriptionPlan } from "./types";

// کلیدهای قیمت در SiteSetting — به ازای هر پلن یک کلید
export const PRICE_KEYS: Record<Plan, string> = {
  basic: "price_basic",
  standard: "price_standard",
  advanced: "price_advanced",
  ultimate: "price_ultimate",
};

// کش در حافظه با TTL کوتاه
let cachedPlans: SubscriptionPlan[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 10_000; // 10 seconds

function parsePrice(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

/**
 * دریافت لیست پلن‌ها با قیمت‌های به‌روز از DB.
 * اگر کلیدی در DB نبود، از قیمت پیش‌فرض (کد) استفاده می‌شود.
 */
export async function getActivePlans(): Promise<SubscriptionPlan[]> {
  const now = Date.now();
  if (cachedPlans && now - cachedAt < CACHE_TTL_MS) {
    return cachedPlans;
  }
  try {
    const keys = Object.values(PRICE_KEYS);
    const rows = await db.siteSetting.findMany({ where: { key: { in: keys } } });
    const priceMap = new Map(rows.map((r) => [r.key, r.value]));

    cachedPlans = SUBSCRIPTION_PLANS.map((p) => ({
      ...p,
      price: parsePrice(priceMap.get(PRICE_KEYS[p.id]), p.price),
    }));
    cachedAt = now;
    return cachedPlans;
  } catch {
    // در صورت خطای DB (مثلا در زمان build)، از قیمت‌های پیش‌فرض استفاده کن
    return SUBSCRIPTION_PLANS;
  }
}

/** دریافت یک پلن خاص با قیمت به‌روز */
export async function getActivePlan(id: Plan): Promise<SubscriptionPlan | undefined> {
  const plans = await getActivePlans();
  return plans.find((p) => p.id === id);
}

/** دریافت نقشه قیمت‌ها (مستقیما از DB، بدون کش) — برای پنل ادمین */
export async function getPriceSettings(): Promise<Record<Plan, number>> {
  const keys = Object.values(PRICE_KEYS);
  const rows = await db.siteSetting.findMany({ where: { key: { in: keys } } });
  const priceMap = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as Record<Plan, number>;
  for (const p of SUBSCRIPTION_PLANS) {
    result[p.id] = parsePrice(priceMap.get(PRICE_KEYS[p.id]), p.price);
  }
  return result;
}

/** ذخیره قیمت یک پلن در DB */
export async function setPlanPrice(planId: Plan, price: number): Promise<void> {
  // سقف/کف قیمت (ممیزی 2-c P2): قیمت 0 (پلن رایگان غیرعمدی) یا سرریز Int در
  // Payment موقع خرید قابل ذخیره نشود — محدوده‌ی معقول: ۱ تا ۱۰۰ میلیون تومان
  const rounded = Math.round(price);
  if (!Number.isFinite(rounded) || rounded <= 0 || rounded > 100_000_000) {
    throw new Error(
      "قیمت پلن باید بین ۱ تا ۱۰۰,۰۰۰,۰۰۰ تومان باشد."
    );
  }
  const key = PRICE_KEYS[planId];
  const label = `قیمت پلن ${SUBSCRIPTION_PLANS.find((p) => p.id === planId)?.label || planId}`;
  await db.siteSetting.upsert({
    where: { key },
    create: { key, value: String(rounded), label },
    update: { value: String(rounded) },
  });
  // invalidate cache
  cachedPlans = null;
  cachedAt = 0;
}
