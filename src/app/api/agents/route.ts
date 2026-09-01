/**
 * GET /api/agents
 *
 * لیست تمام ایجنت‌های هوش مصنوعی ثبت‌شده در رجیستری را برمی‌گرداند.
 * فقط متادیتا (بدون منطق اجرا) — برای استفاده در مارکت‌پلیس ایجنت‌ها.
 *
 * منطق فیلتر:
 *   - ادمین: تمام ایجنت‌ها را می‌بیند (حتی admin-only)
 *   - کاربر عادی: فقط ایجنت‌هایی که پلن فعلی‌اش به آن‌ها دسترسی دارد
 *   - کاربر لاگین‌نشده: فقط ایجنت‌های رایگان (requiredPlan === null)
 *
 * پاسخ:
 *   200 OK → { agents: AgentMeta[], total: number }
 *   401 Unauthorized → اگر requireAuth خطا بیندازد
 */

import { requireAuth, apiError, buildUserDto } from "@/lib/fitness/auth";
import { listAgents, listAgentsForPlan } from "@/lib/agents";

/** متادیتای ایجنت برای مارکت‌پلیس — بدون منطق اجرا */
interface AgentMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  model: string;
  estimatedCost: number;
  requiredPlan: "basic" | "standard" | "advanced" | "ultimate" | null;
}

export async function GET() {
  try {
    // تلاش برای احراز هویت — اختیاری. اگر کاربر لاگین نکرده باشد،
    // فقط ایجنت‌های رایگان را برمی‌گردانیم.
    let userPlan: string | null = null;
    let isAdmin = false;
    try {
      const user = await requireAuth();
      isAdmin = user.role === "ADMIN";
      if (!isAdmin) {
        const dto = await buildUserDto(user.id);
        userPlan = dto?.planName ?? null;
      }
    } catch {
      // کاربر لاگین نکرده — فقط ایجنت‌های رایگان
      userPlan = null;
    }

    // انتخاب ایجنت‌ها بر اساس نقش
    const agents = isAdmin ? listAgents() : listAgentsForPlan(userPlan);

    // نگاشت به متادیتا (حذف متد run)
    const meta: AgentMeta[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      model: a.model,
      estimatedCost: a.estimatedCost,
      requiredPlan: (a.requiredPlan ?? null) as AgentMeta["requiredPlan"],
    }));

    return Response.json({
      agents: meta,
      total: meta.length,
      // اطلاعات کاربر برای UI (برای نمایش قفل/باز بودن ایجنت‌ها)
      viewer: {
        isAdmin,
        planName: userPlan,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
