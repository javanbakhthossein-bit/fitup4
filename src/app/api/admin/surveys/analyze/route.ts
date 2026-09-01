import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { analyzeSurveys } from "@/lib/fitness/ai";
import { PLAN_LABELS, type Plan } from "@/lib/fitness/types";

/**
 * POST /api/admin/surveys/analyze
 *
 * Body:
 *   plan?: "basic" | "standard" | "advanced" | "ultimate"
 *   from?: ISO date string
 *   to?:   ISO date string
 *
 * همه نظرسنجی‌های فیلترشده (یا همه در صورت نبود فیلتر) را به AI می‌دهد تا
 * تحلیل ساختاریافته ارائه دهد: خلاصه، نقاط قوت/ضعف، راهکار بهبود،
 * میانگین رضایت کلی و احساس کلی کاربران.
 */
const VALID_PLANS: Plan[] = ["basic", "standard", "advanced", "ultimate"];

const QUESTION_LABELS: Record<string, string> = {
  workout_program: "برنامه تمرینی",
  meal_program: "برنامه غذایی",
  chat_quality: "چت با فیتاپ",
  support_quality: "پشتیبانی",
  recommend_friends: "پیشنهاد به دوستان",
  gym_mode_quality: "حالت باشگاه",
  meal_photo_analysis: "آنالیز عکس غذا",
  video_analysis_quality: "آنالیز ویدیویی",
  blood_test_analysis: "تحلیل آزمایش خون",
  body_photo_analysis: "آنالیز عکس بدن",
};

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const plan = body?.plan || "";
    const from = body?.from || "";
    const to = body?.to || "";

    // ساخت شرط فیلتر
    const where: any = {};
    if (plan && VALID_PLANS.includes(plan as Plan)) {
      where.planName = plan;
    }
    if (from) {
      const fd = new Date(from);
      if (!isNaN(fd.getTime())) where.createdAt = { ...(where.createdAt || {}), gte: fd };
    }
    if (to) {
      const td = new Date(to);
      if (!isNaN(td.getTime())) where.createdAt = { ...(where.createdAt || {}), lte: td };
    }

    // گرفتن نظرسنجی‌ها (حداکثر ۱۰۰۰ برای ارسال به AI)
    const surveys = await db.survey.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: { user: { select: { name: true, mobile: true } } },
    });

    if (surveys.length === 0) {
      return Response.json(
        { error: "هیچ نظرسنجی برای تحلیل یافت نشد. فیلترها را تغییر دهید." },
        { status: 400 }
      );
    }

    // محاسبه آمار تجمیعی برای AI
    const sumByQuestion: Record<string, { sum: number; count: number }> = {};
    const sumByPlan: Record<string, { sum: number; count: number }> = {};
    let totalSum = 0;
    let totalCount = 0;
    const comments: string[] = [];
    const lowRatings: { question: string; rating: number; plan: string; comment: string }[] = [];

    for (const s of surveys) {
      let ratings: Record<string, number> = {};
      try {
        ratings = JSON.parse(s.ratings || "{}");
      } catch {
        ratings = {};
      }
      let surveySum = 0;
      let surveyCount = 0;
      for (const [qid, val] of Object.entries(ratings)) {
        const n = Number(val);
        if (Number.isFinite(n) && n >= 1 && n <= 5) {
          if (!sumByQuestion[qid]) sumByQuestion[qid] = { sum: 0, count: 0 };
          sumByQuestion[qid].sum += n;
          sumByQuestion[qid].count += 1;
          surveySum += n;
          surveyCount += 1;
          // نمرات پایین را برای AI جمع کن
          if (n <= 2) {
            lowRatings.push({
              question: QUESTION_LABELS[qid] || qid,
              rating: n,
              plan: s.planName,
              comment: s.comment || "",
            });
          }
        }
      }
      if (surveyCount > 0) {
        if (!sumByPlan[s.planName]) sumByPlan[s.planName] = { sum: 0, count: 0 };
        sumByPlan[s.planName].sum += surveySum / surveyCount;
        sumByPlan[s.planName].count += 1;
        totalSum += surveySum / surveyCount;
        totalCount += 1;
      }
      if (s.comment && s.comment.trim()) {
        comments.push(s.comment.trim().slice(0, 500));
      }
    }

    const perQuestionStats = Object.entries(sumByQuestion).map(([id, v]) => ({
      question: QUESTION_LABELS[id] || id,
      questionId: id,
      avg: v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : 0,
      count: v.count,
    }));

    const perPlanStats = Object.entries(sumByPlan).map(([p, v]) => ({
      plan: (PLAN_LABELS as Record<string, string>)[p] || p,
      planId: p,
      avg: v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : 0,
      count: v.count,
    }));

    const overallAvg = totalCount > 0 ? Math.round((totalSum / totalCount) * 100) / 100 : 0;

    // برای AI: تا ۲۰ کامنت آخر + تا ۱۵ نمره پایین
    const payload = {
      meta: {
        totalSurveys: surveys.length,
        overallAverageScore: overallAvg,
        planFilter: plan || "all",
        dateFilter: { from: from || null, to: to || null },
      },
      perQuestionStats,
      perPlanStats,
      // نظرات کاربران (حداکثر ۲۰ مورد) برای استخراج الگوها
      sampleComments: comments.slice(0, 20),
      // نمونه‌هایی با نمره پایین (حداکثر ۱۵) برای شناسایی نقاط ضعف
      lowRatingSamples: lowRatings.slice(0, 15),
    };

    const analysis = await analyzeSurveys(payload);
    return Response.json({ analysis });
  } catch (e) {
    return apiError(e);
  }
}
