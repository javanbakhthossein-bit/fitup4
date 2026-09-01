/**
 * تعاریف تایپ برای سیستم رجیستری ایجنت‌های هوش مصنوعی فیتاپ
 *
 * این ماژول قرارداد (contract) بین ایجنت‌ها و رجیستری را تعریف می‌کند.
 * هر ایجنت جدید فقط کافی است اینترفیس AIAgent را پیاده‌سازی کند
 * و سپس خودش را از طریق registerAgent ثبت نماید.
 *
 * الگوی استفاده برای افزودن ایجنت جدید:
 *   1. ساخت یک فایل جدید در src/lib/agents/agents/my-agent.ts
 *   2. پیاده‌سازی AIAgent و فراخوانی registerAgent(myAgent)
 *   3. افزودن import "./agents/my-agent"; به src/lib/agents/index.ts
 *      (برای side-effect registration هنگام بارگذاری ماژول)
 */

import type { OnboardingProfile } from "@prisma/client";

/** سطح دسترسی لازم برای ایجنت — null یعنی رایگان برای همه */
export type AgentPlan = "basic" | "standard" | "advanced" | "ultimate" | null;

/**
 * کانتکست اجرای ایجنت — شامل اطلاعات کاربر و لاگر درخواست‌محور.
 * هر بار که یک ایجنت اجرا می‌شود، یک نمونه جدید از این کانتکست ساخته می‌شود.
 */
export interface AgentContext {
  /** شناسه کاربر درخواست‌کننده */
  userId: string;
  /** شماره موبایل کاربر */
  userMobile: string;
  /** نام نمایشی کاربر (اختیاری) */
  userName?: string;
  /** پلن فعلی کاربر (basic | standard | advanced | ultimate | null) */
  planName?: string | null;
  /** پروفایل آنبوردینگ کاربر — به صورت تنبل (lazy) بارگذاری می‌شود */
  profile?: OnboardingProfile;
  /** لاگر درخواست‌محور برای ثبت رویدادهای اجرای ایجنت */
  log: (level: "info" | "warn" | "error" | "success", msg: string) => void;
}

/**
 * نتیجه اجرای یک ایجنت.
 * شامل وضعیت موفقیت/شکست، داده‌های خروجی، خطا و آمار استفاده.
 */
export interface AgentResult<T = unknown> {
  /** آیا اجرا موفق بود؟ */
  ok: boolean;
  /** داده‌های خروجی در صورت موفقیت */
  data?: T;
  /** پیام خطا در صورت شکست */
  error?: string;
  /** تعداد توکن مصرف‌شده (برای بیلینگ و آنالیتیکس) */
  tokensUsed?: number;
  /** برآورد هزینه به تومان (IRT) */
  costEstimate?: number;
  /** مدت زمان اجرا به میلی‌ثانیه */
  durationMs?: number;
}

/**
 * قرارداد هر ایجنت هوش مصنوعی.
 * هر ایجنت باید این اینترفیس را پیاده‌سازی کند.
 */
export interface AIAgent<TInput = unknown, TOutput = unknown> {
  /** شناسه یکتای ایجنت، مثلاً "seo-agent" یا "coach-chat" */
  id: string;
  /** نام نمایشی فارسی */
  name: string;
  /** توضیحات فارسی — در مارکت‌پلیس ایجنت‌ها نمایش داده می‌شود */
  description: string;
  /** نام آیکن از کتابخانه lucide-react */
  icon: string;
  /** مدل AvalAI که این ایجنت استفاده می‌کند */
  model: string;
  /** برآورد هزینه هر فراخوانی به تومان (IRT) */
  estimatedCost: number;
  /** پلن لازم برای دسترسی به این ایجنت — null یعنی رایگان برای همه */
  requiredPlan?: AgentPlan;
  /** اجرای ایجنت با کانتکست و ورودی مشخص */
  run(ctx: AgentContext, input: TInput): Promise<AgentResult<TOutput>>;
}

// ─── Registry API ───
// پیاده‌سازی AGENT_REGISTRY و توابع registerAgent/getAgent/listAgents/listAgentsForPlan
// در فایل registry.ts قرار دارد. این فایل فقط تعاریف تایپ را شامل می‌شود
// تا جدایی تمیز بین contract و implementation حفظ شود.
