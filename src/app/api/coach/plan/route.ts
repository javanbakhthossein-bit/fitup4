import { db } from "@/lib/db";
import { requireAuth, buildUserDto, apiError } from "@/lib/fitness/auth";
import { recoverStuckGenerations } from "@/lib/fitness/program-generation";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";
import type { OnboardingData } from "@/lib/fitness/types";

/**
 * پارس امن JSON محتوای برنامه از DB (L7) — یک ردیف خراب نباید GET داشبورد/برنامه را با 500 بکشد.
 */
function safeParsePlanContent(raw: string): any | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    console.error("[coach/plan] invalid plan JSON content in DB, returning null:", (e as Error).message);
    return null;
  }
}

/**
 * Robustly parse a JSON-or-CSV string list field (equipment, workoutDaysList, medicalConditions).
 * - JSON array string: '["dumbbell","barbell"]' → ["dumbbell","barbell"]
 * - CSV string: "dumbbell,barbell" → ["dumbbell","barbell"]
 * - Empty string or null → []
 */
function safeParseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    if (typeof parsed === "string") {
      return parsed.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  } catch {
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

// Get active workout + meal plan
export async function GET() {
  try {
    const user = await requireAuth();

    // ─── C3 + watchdog خودترمیم ───
    // بازیابی درخواست‌های گیرکرده «generating» — اگر پروسه سرور restart شده باشد،
    // تولید یتیم شده است: watchdog یک‌بار خودش retry می‌کند (autoRetryCount)،
    // و اگر برنامه موجود ولی status عقب مانده باشد → ready می‌کند.
    await recoverStuckGenerations(user.id);

    const [workout, meal, profile] = await Promise.all([
      db.workoutPlan.findFirst({
        where: { userId: user.id, active: true },
        orderBy: { createdAt: "desc" },
      }),
      db.mealPlan.findFirst({
        where: { userId: user.id, active: true },
        orderBy: { createdAt: "desc" },
      }),
      db.onboardingProfile.findUnique({ where: { userId: user.id } }),
    ]);

    return Response.json({
      workout: workout ? safeParsePlanContent(workout.content) : null,
      meal: meal ? safeParsePlanContent(meal.content) : null,
      hasProfile: !!profile,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * PUT /api/coach/plan — شروع بازتولید برنامه (تمرینی + غذایی) در پس‌زمینه.
 *
 * تولید برنامه با هوش مصنوعی ۱ تا ۵ دقیقه طول می‌کشد. قبلاً این endpoint
 * سینکرون برنامه را تولید و پاسخ {workout, meal} برمی‌گرداند — که از سقف
 * تایم‌اوت گیت‌وی عبور می‌کرد و مرورگر خطای HTML می‌گرفت.
 *
 * حالا: اعتبارسنجی‌ها فوری انجام می‌شوند و تولید به‌صورت پس‌زمینه شروع
 * می‌شود (startProgramGenerationInBackground). پاسخ:
 *   { started: true, programStatus: "generating", message: "..." }
 * وضعیت واقعی از GET /api/coach/program-history (programStatus) قابل پیگیری است
 * و وقتی تولید کامل شد نوتیفیکیشن «برنامه آماده شد» ارسال می‌شود.
 */
export async function PUT() {
  try {
    const user = await requireAuth();

    // ─── M4: محدودیت نرخ بازتولید — ۳ درخواست در ۱۰ دقیقه برای هر کاربر ───
    // هر PUT دو کال کامل AI (تمرین + تغذیه با تفکر high) شروع می‌کند؛ بدون سقف،
    // یک کاربر با حلقه درخواست می‌تواند کریدیت AvalAI را تخلیه کند.
    const rl = rateLimit(`coach-plan-regen:${user.id}`, 3, 10 * 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    // ─── C5: گیت اشتراک — تولید برنامه مخصوص خریداران پلن است ───
    const dto = await buildUserDto(user.id);
    const effectivePlan = dto?.planName ?? null;
    if (!effectivePlan) {
      return Response.json(
        { error: "برای ساخت برنامه نیاز به خرید یکی از پلن‌ها دارید." },
        { status: 403 }
      );
    }

    // ─── بررسی پیش‌نیازها بر اساس پلن مؤثر ───
    // برای پلن پیشرفته (advanced) و حرفه‌ای (ultimate)، ارسال عکس بدن الزامی است.
    // برای پلن ultimate، علاوه بر عکس بدن، ویدیو و آزمایش خون هم باید تعیین تکلیف شده باشند.
    const { checkPrerequisites } = await import("@/lib/fitness/prerequisites");
    const { startProgramGenerationInBackground, PROGRAM_PREPARING_MESSAGE } =
      await import("@/lib/fitness/program-generation");

    const prereqCheck = await checkPrerequisites(user.id, effectivePlan as any);
    if (!prereqCheck.canGenerateProgram) {
      // پیش‌نیازها تکمیل/تعیین تکلیف نشده‌اند — برنامه نباید ساخته شود
      return Response.json({
        error: prereqCheck.blockingReason ?? "ابتدا پیش‌نیازها را تکمیل کنید.",
        needsBodyPhoto: !prereqCheck.allRequiredCompleted,
        prerequisites: prereqCheck.prerequisites,
      }, { status: 400 });
    }

    const profile = await db.onboardingProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) {
      return Response.json({ error: "ابتدا آنبوردینگ را تکمیل کنید." }, { status: 400 });
    }

    // ─── M4: چک «برنامه تازه» — اگر آخرین برنامه تمرینی کمتر از ۲۴ ساعت پیش
    // ساخته شده، بازتولید نکن (دلیل declared اما هرگز return نشده‌ی
    // already_has_fresh_plan). جلوی بازتولیدهای بی‌وقفه روی همان برنامه تازه را می‌گیرد.
    const FRESH_PLAN_WINDOW_MS = 24 * 60 * 60 * 1000;
    const latestPlan = await db.workoutPlan.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (latestPlan && Date.now() - latestPlan.createdAt.getTime() < FRESH_PLAN_WINDOW_MS) {
      return Response.json(
        {
          error: "برنامه فعلی شما به‌تازگی ساخته شده است. برای بازتولید برنامه جدید، ۲۴ ساعت صبر کنید.",
          started: false,
          reason: "already_has_fresh_plan",
        },
        { status: 400 }
      );
    }

    const genResult = await startProgramGenerationInBackground(user.id);

    if (genResult.started || genResult.reason === "already_generating") {
      return Response.json({
        started: true,
        programStatus: "generating",
        message: PROGRAM_PREPARING_MESSAGE,
      });
    }

    // شروع نشد — دلیل را به کاربر بگو
    const reasonMessage: Record<string, string> = {
      no_plan: "برای ساخت برنامه نیاز به خرید یکی از پلن‌ها دارید.",
      no_profile: "ابتدا آنبوردینگ را تکمیل کنید.",
      prerequisites_incomplete: genResult.blockingReason ?? "ابتدا پیش‌نیازها را تکمیل کنید.",
      already_has_fresh_plan: "برنامه فعلی شما به‌تازگی ساخته شده است. برای بازتولید برنامه جدید، ۲۴ ساعت صبر کنید.",
    };
    return Response.json(
      {
        error: reasonMessage[genResult.reason ?? ""] ?? "شروع تولید برنامه ممکن نشد. لطفاً دوباره تلاش کنید.",
        started: false,
        reason: genResult.reason,
      },
      { status: genResult.reason === "prerequisites_incomplete" ? 400 : 403 }
    );
  } catch (e) {
    return apiError(e);
  }
}

// نوع کمکی برای استفاده‌های دیگر (backward-compat import)
export type { OnboardingData };
