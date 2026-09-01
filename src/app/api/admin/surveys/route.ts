import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { PLAN_LABELS, type Plan } from "@/lib/fitness/types";

/**
 * GET /api/admin/surveys?plan=&from=&to=&search=&page=&pageSize=
 *
 * مدیریت نظرسنجی‌های پایان پلن:
 *  - آمار کلی (تعداد کل، میانگین هر سوال، میانگین کلی)
 *  - نمودار Bar (میانگین هر سوال)
 *  - فیلتر بر اساس پلن / بازه زمانی / جستجوی نام کاربر
 *  - جدول نظرسنجی‌ها با جزئیات (نام کاربر، پلن، نمرات، کامنت، تاریخ)
 *
 * خروجی:
 *  - stats: { total, overallAvg, perQuestion: [{id, label, avg, count}], perPlan: [{plan, count, avg}] }
 *  - questionLabels: { [id]: label }
 *  - surveys: [{ id, userId, userName, userMobile, plan, planLabel, ratings, comment, createdAt }]
 *  - pagination
 */
const VALID_PLANS: Plan[] = ["basic", "standard", "advanced", "ultimate"];

// برچسب سوالات برای نمایش در نمودار/جدول
const QUESTION_LABELS: Record<string, string> = {
  // عمومی
  workout_program: "برنامه تمرینی",
  meal_program: "برنامه غذایی",
  chat_quality: "چت با فیتاپ",
  support_quality: "پشتیبانی",
  recommend_friends: "پیشنهاد به دوستان",
  // پلن پیشرفته
  gym_mode_quality: "حالت باشگاه",
  meal_photo_analysis: "آنالیز عکس غذا",
  // پلن حرفه‌ای
  video_analysis_quality: "آنالیز ویدیویی",
  blood_test_analysis: "تحلیل آزمایش خون",
  body_photo_analysis: "آنالیز عکس بدن",
};

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const plan = searchParams.get("plan") || "";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") || 20)));

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

    // جستجو بر اساس نام/موبایل کاربر
    let userFilterIds: string[] | null = null;
    if (search) {
      const users = await db.user.findMany({
        where: { OR: [{ mobile: { contains: search } }, { name: { contains: search } }] },
        select: { id: true },
      });
      userFilterIds = users.map((u) => u.id);
      where.userId = { in: userFilterIds };
    }

    // گرفتن کل نظرسنجی‌های فیلترشده (برای محاسبه آمار)
    const [total, allSurveys, pagedSurveys] = await Promise.all([
      db.survey.count({ where }),
      // برای محاسبه آمار، تمام نظرسنجی‌ها را می‌گیریم (حداکثر ۱۰۰۰۰ رکورد)
      db.survey.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10000,
        select: { id: true, planName: true, ratings: true, createdAt: true },
      }),
      db.survey.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, mobile: true } } },
      }),
    ]);

    // محاسبه میانگین هر سوال + میانگین کلی
    const sumByQuestion: Record<string, { sum: number; count: number }> = {};
    const sumByPlan: Record<string, { sum: number; count: number }> = {};
    let totalSum = 0;
    let totalCount = 0;

    for (const s of allSurveys) {
      let ratings: Record<string, number> = {};
      try {
        ratings = JSON.parse(s.ratings || "{}");
      } catch {
        ratings = {};
      }
      // میانگین این نظرسنجی برای محاسبه perPlan
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
        }
      }
      if (surveyCount > 0) {
        if (!sumByPlan[s.planName]) sumByPlan[s.planName] = { sum: 0, count: 0 };
        sumByPlan[s.planName].sum += surveySum / surveyCount;
        sumByPlan[s.planName].count += 1;
        totalSum += surveySum / surveyCount;
        totalCount += 1;
      }
    }

    const perQuestion = Object.entries(sumByQuestion)
      .map(([id, v]) => ({
        id,
        label: QUESTION_LABELS[id] || id,
        avg: v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : 0,
        count: v.count,
      }))
      .sort((a, b) => b.avg - a.avg);

    const perPlan = Object.entries(sumByPlan)
      .map(([p, v]) => ({
        plan: p,
        planLabel: (PLAN_LABELS as Record<string, string>)[p] || p,
        avg: v.count > 0 ? Math.round((v.sum / v.count) * 100) / 100 : 0,
        count: v.count,
      }))
      .sort((a, b) => b.count - a.count);

    const overallAvg = totalCount > 0 ? Math.round((totalSum / totalCount) * 100) / 100 : 0;

    const surveys = pagedSurveys.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user?.name || "",
      userMobile: s.user?.mobile || "",
      plan: s.planName,
      planLabel: (PLAN_LABELS as Record<string, string>)[s.planName] || s.planName,
      ratings: s.ratings,
      comment: s.comment,
      createdAt: s.createdAt.toISOString(),
    }));

    return Response.json({
      stats: {
        total,
        overallAvg,
        perQuestion,
        perPlan,
      },
      questionLabels: QUESTION_LABELS,
      surveys,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return apiError(e);
  }
}
