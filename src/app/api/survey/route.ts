import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { PLAN_LABELS, type Plan } from "@/lib/fitness/types";

/**
 * GET /api/survey
 * نظرسنجی پایان پلن را برای کاربر فعلی برمی‌گرداند.
 * - questions: لیست سوالات عمومی + سوالات اختصاصی پلن
 * - hasSubmitted: آیا کاربر قبلاً نظرسنجی پر کرده است؟
 * - lastPlanName: پلن آخرین اشتراک (برای نمایش در UI)
 */
export async function GET() {
  try {
    const user = await requireAuth();

    // آخرین پلن کاربر (حتی منقضی شده)
    const lastSub = await db.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { endDate: "desc" },
    });
    const planName = (lastSub?.plan as Plan) ?? null;

    // آیا کاربر قبلاً نظرسنجی پر کرده؟
    const existingSurvey = await db.survey.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // سوالات عمومی (برای همه پلن‌ها)
    const generalQuestions = [
      { id: "workout_program", label: "چقدر از برنامه تمرینی راضی بودید؟", required: true },
      { id: "meal_program", label: "چقدر از برنامه غذایی راضی بودید؟", required: true },
      { id: "chat_quality", label: "چقدر از چت با فیتاپ راضی بودید؟", required: true },
      { id: "support_quality", label: "چقدر از پشتیبانی راضی بودید؟", required: false },
      { id: "recommend_friends", label: "آیا به دوستان پیشنهاد می‌کنید؟", required: false },
    ];

    // سوالات اختصاصی پلن
    const planSpecific: Record<string, { id: string; label: string; required: boolean }[]> = {
      basic: [],
      standard: [],
      advanced: [
        { id: "gym_mode_quality", label: "چقدر از حالت باشگاه راضی بودید؟", required: false },
        { id: "meal_photo_analysis", label: "چقدر از آنالیز عکس غذا راضی بودید؟", required: false },
      ],
      ultimate: [
        { id: "video_analysis_quality", label: "چقدر از آنالیز ویدیویی راضی بودید؟", required: false },
        { id: "blood_test_analysis", label: "چقدر از تحلیل آزمایش خون راضی بودید؟", required: false },
        { id: "body_photo_analysis", label: "چقدر از آنالیز عکس بدن راضی بودید؟", required: false },
      ],
    };

    const specificQuestions = planName ? (planSpecific[planName] ?? []) : [];

    return Response.json({
      hasSubmitted: !!existingSurvey,
      lastPlanName: planName,
      lastPlanLabel: planName ? (PLAN_LABELS[planName] ?? planName) : null,
      questions: {
        general: generalQuestions,
        planSpecific: specificQuestions,
      },
      submittedAt: existingSurvey?.createdAt?.toISOString() ?? null,
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST /api/survey
 * ثبت نظرسنجی پایان پلن.
 * Body:
 *   ratings: { [questionId: string]: number (1..5) }
 *   comment: string
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const ratings: Record<string, number> = body.ratings ?? {};
    const comment: string = typeof body.comment === "string" ? body.comment.trim() : "";

    // اعتبارسنجی نمرات
    for (const [key, val] of Object.entries(ratings)) {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 1 || n > 5) {
        return Response.json({ error: `نمره برای «${key}» باید بین ۱ تا ۵ باشد.` }, { status: 400 });
      }
      ratings[key] = n;
    }

    if (Object.keys(ratings).length === 0) {
      return Response.json({ error: "حداقل یک نمره ثبت کنید." }, { status: 400 });
    }

    // آخرین پلن کاربر (حتی منقضی شده)
    const lastSub = await db.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { endDate: "desc" },
    });
    const planName = lastSub?.plan ?? "basic";

    // بررسی تکراری نبودن — یک کاربر می‌تواند چند نظرسنجی ثبت کند (برای پلن‌های مختلف)
    // اما برای جلوگیری از اسپم، نظرسنجی جدید فقط در صورتی ثبت می‌شود که آخرین نظرسنجی
    // بیش از ۱ ساعت پیش بوده باشد.
    const recentSurvey = await db.survey.findFirst({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
      select: { id: true },
    });
    if (recentSurvey) {
      return Response.json({ error: "شما در یک ساعت گذشته نظرسنجی ثبت کرده‌اید. بعداً دوباره تلاش کنید." }, { status: 400 });
    }

    const survey = await db.survey.create({
      data: {
        userId: user.id,
        planName,
        ratings: JSON.stringify(ratings),
        comment: comment.slice(0, 5000),
      },
    });

    return Response.json({
      ok: true,
      id: survey.id,
      message: `از بازخورد شما سپاسگزاریم! 🙏`,
    });
  } catch (e) {
    return apiError(e);
  }
}
