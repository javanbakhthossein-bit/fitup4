/**
 * ایجنت سئو — پیچیدن (wrap) منطق موجود در src/lib/fitness/seo-agent.ts
 * به عنوان یک AIAgent ثبت‌شده در رجیستری.
 *
 * این فایل منطق ایجنت سئو را دوباره پیاده‌سازی نمی‌کند؛ فقط آن را به عنوان
 * یک AIAgent ثبت می‌کند تا از طریق رجیستری مرکزی قابل کشف و اجرا باشد.
 *
 * ورودی: { mode: "full" | "continue" | "strategy_only"; count: number }
 * خروجی: RunContext (شامل logs، successCount، failCount، articles، errors)
 *
 * نکته مهم: ایجنت سئو در پس‌زمینه اجرا می‌شود و از طریق SeoAgentRun ردیابی می‌شود.
 * بنابراین run() در اینجا یک SeoAgentRun جدید می‌سازد و runSeoAgent را فراخوانی می‌کند.
 * نتیجه RunContext حاوی logs و آمار اجرا است.
 */

import { db } from "@/lib/db";
import {
  runSeoAgent,
  isAgentRunning,
  type RunContext,
} from "@/lib/fitness/seo-agent";
import { TEXT_MODEL } from "@/lib/fitness/ai";
import type { AIAgent, AgentContext, AgentResult } from "../types";
import { registerAgent } from "../registry";

/** ورودی ایجنت سئو */
export interface SeoAgentInput {
  /** حالت اجرا: full (تحلیل+استراتژی+تولید) | continue (ادامه از صف) | strategy_only (فقط استراتژی) | content_refresh (آپدیت مقالات منتشرشده بر اساس سرچ کنسول) */
  mode: "full" | "continue" | "strategy_only" | "content_refresh";
  /** تعداد مقالات برای تولید (۱ تا ۲۰) */
  count: number;
}

/** خروجی ایجنت سئو — همان RunContext هسته‌ای */
export type SeoAgentOutput = RunContext;

/** ایجنت سئو — یک ایجنت ادمین برای تولید خودکار مقالات سئوشده */
const seoAgent: AIAgent<SeoAgentInput, SeoAgentOutput> = {
  id: "seo-agent",
  name: "ایجنت سئو",
  description:
    "ایجنت خودکار سئو که سایت را تحلیل می‌کند، استراتژی محتوای جامع تولید می‌کند، مقالات را برنامه‌ریزی و با تصاویر تولید و منتشر می‌کند. مخصوص ادمین.",
  icon: "Rocket",
  model: TEXT_MODEL,
  // هزینه تقریبی: ~۵۰۰۰ توکن × N مقاله + تصاویر. برآورد محافظه‌کارانه برای N=5.
  estimatedCost: 50000,
  // فقط ادمین دسترسی دارد → empty/null plan به معنای admin-only در رجیستری نیست،
  // اما این ایجنت در عمل فقط از طریق requireAdmin در API اجرا می‌شود.
  // در اینجا null می‌گذاریم تا در مارکت‌پلیس برای همه قابل مشاهده باشد
  // و کنترل دسترسی در لایه API انجام شود.
  requiredPlan: null,

  async run(
    ctx: AgentContext,
    input: SeoAgentInput
  ): Promise<AgentResult<SeoAgentOutput>> {
    const startedAt = Date.now();

    // کنترل همزمانی — فقط یک اجرای همزمان مجاز است
    if (isAgentRunning()) {
      return {
        ok: false,
        error:
          "ایجنت سئو در حال اجراست. لطفاً تا پایان آن صبر کنید یا بعد دوباره تلاش کنید.",
        durationMs: Date.now() - startedAt,
      };
    }

    // اعتبارسنجی ورودی
    const mode = input?.mode ?? "full";
    const count = Math.min(Math.max(Number(input?.count) || 5, 1), 20);

    if (!["full", "continue", "strategy_only", "content_refresh"].includes(mode)) {
      return {
        ok: false,
        error: `مد نامعتبر: ${mode}. مقادیر مجاز: full | continue | strategy_only | content_refresh`,
        durationMs: Date.now() - startedAt,
      };
    }

    ctx.log("info", `🚀 شروع اجرای ایجنت سئو — mode=${mode}, count=${count}`);

    try {
      // ساخت رکورد SeoAgentRun در دیتابیس
      const run = await db.seoAgentRun.create({
        data: {
          mode,
          requestedCount: count,
          status: "running",
          startedAt: new Date(),
        },
      });

      // اجرای ایجنت (به صورت sync — صبر می‌کنیم تا تمام شود)
      // نکته: runSeoAgent در حالت عادی در پس‌زمینه اجرا می‌شود (startBackgroundRun)،
      // اما در اینجا مستقیماً فراخوانی می‌کنیم تا نتیجه را برگردانیم.
      const runCtx = await runSeoAgent({
        runId: run.id,
        adminId: ctx.userId,
        mode,
        count,
      });

      ctx.log(
        "success",
        `🏁 پایان اجرا — ${runCtx.successCount} موفق، ${runCtx.failCount} ناموفق`
      );

      return {
        ok: true,
        data: runCtx,
        durationMs: Date.now() - startedAt,
      };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "خطای ناشناخته در ایجنت سئو";
      ctx.log("error", `خطای بحرانی: ${errMsg}`);
      return {
        ok: false,
        error: errMsg,
        durationMs: Date.now() - startedAt,
      };
    }
  },
};

// ثبت ایجنت هنگام بارگذاری ماژول (side-effect registration)
registerAgent(seoAgent);

export default seoAgent;
