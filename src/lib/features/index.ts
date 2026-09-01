/**
 * پیاده‌سازی سیستم Feature Flag / قابلیت‌های فیتاپ
 *
 * این ماژول توابع canAccess، listFeaturesForPlan و listAllFeatures را
 * پیاده‌سازی می‌کند. منبع داده FEATURES (در types.ts) است.
 *
 * منطق canAccess:
 *   1. feature باید enabled=true باشد (در آینده از DB SiteSetting خوانده می‌شود)
 *   2. اگر plans=[] باشد → admin-only → برای کاربران عادی false برمی‌گرداند
 *   3. اگر plans شامل planName کاربر باشد → true
 *   4. در غیر این صورت → false
 *
 * سازگاری با canAccess قدیمی در src/lib/fitness/types.ts:
 *   - canAccess قدیمی امضا متفاوتی دارد: (planId: Plan, capability: keyof PlanCapabilities)
 *   - canAccess جدید امضای: (planName: string, featureId: string)
 *   - هر دو سیستم همزیستی می‌کنند — قدیمی برای fine-grained capability checks،
 *     جدید برای coarse-grained feature gating و مارکت‌پلیس.
 */

import { FEATURES, type Feature, type FeaturePlan } from "./types";

/**
 * گرفتن یک feature با شناسه.
 * @returns feature یا undefined اگر یافت نشد
 */
export function getFeature(featureId: string): Feature | undefined {
  return FEATURES.find((f) => f.id === featureId);
}

/**
 * آیا کاربر با پلن مشخص به feature خاصی دسترسی دارد؟
 *
 * منطق:
 *   - اگر feature یافت نشد → false
 *   - اگر feature.enabled=false → false
 *   - اگر feature.plans=[] (admin-only) → false (کاربر عادی دسترسی ندارد)
 *   - اگر planName کاربر در feature.plans باشد → true
 *   - در غیر این صورت → false
 *
 * @param planName پلن فعلی کاربر (می‌تواند null/undefined باشد)
 * @param featureId شناسه feature
 */
export function canAccess(
  planName: string | null | undefined,
  featureId: string
): boolean {
  const feature = getFeature(featureId);
  if (!feature) return false;
  if (!feature.enabled) return false;
  // آرایه خالی = admin-only → کاربر عادی (حتی با پلن) دسترسی ندارد
  if (feature.plans.length === 0) return false;
  if (!planName) return false;
  return feature.plans.includes(planName as FeaturePlan);
}

/**
 * آیا کاربر ادمین به feature خاصی دسترسی دارد؟
 *
 * ادمین به همه features (که enabled=true باشند) دسترسی دارد،
 * حتی features با plans=[] (admin-only).
 *
 * @param featureId شناسه feature
 */
export function canAdminAccess(featureId: string): boolean {
  const feature = getFeature(featureId);
  if (!feature) return false;
  return feature.enabled;
}

/**
 * لیست تمام feature‌های فعال (enabled=true).
 * شامل admin-only features هم می‌شود — برای نمایش در پنل ادمین.
 */
export function listAllFeatures(): Feature[] {
  return FEATURES.filter((f) => f.enabled);
}

/**
 * لیست feature‌هایی که کاربر با پلن مشخص به آن‌ها دسترسی دارد.
 * admin-only features (plans=[]) در این لیست نیستند.
 *
 * @param planName پلن فعلی کاربر (می‌تواند null/undefined باشد)
 */
export function listFeaturesForPlan(
  planName: string | null | undefined
): Feature[] {
  if (!planName) {
    // کاربر بدون پلن → فقط feature‌هایی که plans=[] نیستند و شامل هیچ پلنی نیستند؟
    // نه — features با plans شامل پلن‌های خاص هستند. کاربر بدون پلن به هیچ‌کدام دسترسی ندارد.
    // مگر اینکه feature‌ای با plans=["basic","standard","advanced","ultimate"] باشد؟
    // خیر — حتی آن features هم نیاز به پلن دارند. پس لیست خالی.
    return [];
  }
  return FEATURES.filter(
    (f) =>
      f.enabled &&
      f.plans.length > 0 &&
      f.plans.includes(planName as FeaturePlan)
  );
}

/**
 * لیست feature‌های قابل مشاهده برای ادمین (تمام features فعال).
 * در پنل ادمین برای مدیریت feature flags استفاده می‌شود.
 */
export function listFeaturesForAdmin(): Feature[] {
  return listAllFeatures();
}

// ─── Re-export تایپ‌ها برای دسترسی راحت ───
export type { Feature, FeaturePlan } from "./types";
export { FEATURES } from "./types";
