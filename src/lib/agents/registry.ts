/**
 * پیاده‌سازی رجیستری ایجنت‌های هوش مصنوعی فیتاپ
 *
 * رجیستری یک آرایه مرکزی در سطح ماژول است که ایجنت‌ها هنگام بارگذاری
 * ماژول خودشان (از طریق side-effect) در آن ثبت می‌شوند.
 *
 * نحوه کار:
 *   - هر فایل ایجنت در src/lib/agents/agents/ هنگام import شدن،
 *     registerAgent() را صدا می‌زند و خودش را ثبت می‌کند.
 *   - src/lib/agents/index.ts تمام فایل‌های ایجنت را import می‌کند
 *     تا از ثبت شدن آن‌ها اطمینان حاصل شود.
 *   - هر مصرف‌کننده‌ای که import { getAgent, listAgents } from "@/lib/agents"
 *     را بنویسد، به لیست کامل ایجنت‌های ثبت‌شده دسترسی دارد.
 */

import type { AIAgent, AgentPlan } from "./types";

/** آرایه مرکزی ایجنت‌های ثبت‌شده (mutable — ایجنت‌ها با registerAgent اضافه می‌شوند) */
export const AGENT_REGISTRY: AIAgent[] = [];

/**
 * ثبت یک ایجنت در رجیستری.
 * اگر ایجنتی با همین id قبلاً ثبت شده باشد، با نسخه جدید جایگزین می‌شود
 * (برای جلوگیری از ثبت تکراری در حالت HMR/Hot Reload).
 */
export function registerAgent<TInput, TOutput>(
  agent: AIAgent<TInput, TOutput>
): void {
  const existingIdx = AGENT_REGISTRY.findIndex((a) => a.id === agent.id);
  if (existingIdx >= 0) {
    // جایگزینی نسخه قبلی — مهم در زمان HMR یا بارگذاری مجدد ماژول
    AGENT_REGISTRY[existingIdx] = agent as AIAgent;
  } else {
    AGENT_REGISTRY.push(agent as AIAgent);
  }
}

/**
 * گرفتن یک ایجنت با شناسه.
 * @returns ایجنت یا undefined اگر یافت نشد
 */
export function getAgent(id: string): AIAgent | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}

/**
 * لیست تمام ایجنت‌های ثبت‌شده (بدون فیلتر پلن).
 * معمولاً برای پنل ادمین استفاده می‌شود.
 */
export function listAgents(): AIAgent[] {
  return [...AGENT_REGISTRY];
}

/**
 * لیست ایجنت‌هایی که کاربر با پلن مشخص به آن‌ها دسترسی دارد.
 *
 * منطق فیلتر:
 *   - اگر requiredPlan ایجنت null باشد → رایگان برای همه پلن‌ها (حتی بدون پلن)
 *   - در غیر این صورت، پلن کاربر باید بزرگتر یا مساوی پلن لازم باشد
 *   - اگر planName کاربر null/undefined باشد → فقط ایجنت‌های رایگان (requiredPlan === null)
 *
 * @param planName نام پلن فعلی کاربر (می‌تواند null باشد)
 */
export function listAgentsForPlan(planName?: string | null): AIAgent[] {
  const tierRank: Record<string, number> = {
    basic: 1,
    standard: 2,
    advanced: 3,
    ultimate: 4,
  };
  const userTier = planName ? tierRank[planName] ?? 0 : 0;

  return AGENT_REGISTRY.filter((agent) => {
    const required = agent.requiredPlan;
    if (required === null || required === undefined) {
      // ایجنت رایگان برای همه
      return true;
    }
    const requiredTier = tierRank[required] ?? 0;
    return userTier >= requiredTier;
  });
}

/**
 * تبدیل AgentPlan به رشته قابل نمایش.
 * (ابزار کمکی برای UI و لاگ)
 */
export function planLabel(plan: AgentPlan): string {
  if (plan === null || plan === undefined) return "رایگان";
  const labels: Record<string, string> = {
    basic: "اقتصادی",
    standard: "استاندارد",
    advanced: "پیشرفته",
    ultimate: "حرفه‌ای",
  };
  return labels[plan] ?? plan;
}
