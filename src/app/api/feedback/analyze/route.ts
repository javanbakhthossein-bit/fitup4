import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { avalaiClient, TEXT_MODEL, withSystemDirectives } from "@/lib/fitness/ai";

/**
 * POST /api/feedback/analyze
 * Admin only — fetch all survey feedback and run AI analysis to produce:
 *  - نقاط قوت (3 مورد)
 *  - ایرادات و ضعف‌ها (3 مورد)
 *  - پیشنهادات بهبود (3 مورد)
 *  - خلاصه کلی (2 جمله)
 */
export async function POST(_req: NextRequest) {
  try {
    await requireAdmin();

    // ─── منبع واقعی داده‌ها: مدل Survey (نظرسنجی پایان پلن) + Feedback ───
    // قبلاً این route روی ستون‌های rating* غیرواقعی جدول Feedback کوئری می‌زد و
    // با PrismaClientValidationError شکست می‌خورد. داده‌های نظرسنجی واقعی در
    // مدل Survey ذخیره می‌شوند (ratings = JSON «questionId: 1..5» + comment).
    const [surveys, feedbacks] = await Promise.all([
      db.survey.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          planName: true,
          ratings: true,
          comment: true,
          createdAt: true,
          user: { select: { name: true, mobile: true } },
        },
      }),
      db.feedback.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          message: true,
          category: true,
          name: true,
          mobile: true,
          createdAt: true,
        },
      }),
    ]);

    if (surveys.length === 0 && feedbacks.length === 0) {
      return Response.json({
        analysis:
          "هنوز هیچ نظری ثبت نشده است. پس از دریافت نظرات کاربران، تحلیل هوش مصنوعی در دسترس خواهد بود.",
        count: 0,
      });
    }

    // برچسب سوالات — هماهنگ با GET /api/survey
    const questionLabels: Record<string, string> = {
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
    const planLabels: Record<string, string> = {
      basic: "اقتصادی",
      standard: "استاندارد",
      advanced: "پیشرفته",
      ultimate: "حرفه‌ای",
    };

    const lines: string[] = [];
    let idx = 1;
    for (const s of surveys) {
      let ratings: Record<string, number> = {};
      try {
        ratings = JSON.parse(s.ratings) as Record<string, number>;
      } catch {
        ratings = {};
      }
      const ratingText = Object.entries(ratings)
        .filter(([, v]) => typeof v === "number" && v >= 1 && v <= 5)
        .map(([qid, v]) => `${questionLabels[qid] ?? qid}: ${v}/5`)
        .join("، ");
      const who = s.user?.name || s.user?.mobile || "ناشناس";
      const plan = planLabels[s.planName] ?? s.planName;
      const comment = s.comment ? ` | نظر: "${s.comment.slice(0, 500)}"` : "";
      lines.push(
        `${idx}. [${who} | پلن ${plan}] ${ratingText || "بدون امتیاز"}${comment}`
      );
      idx++;
    }
    for (const f of feedbacks) {
      const who = f.name || f.mobile || "ناشناس";
      const cat =
        f.category === "complaint"
          ? "شکایت"
          : f.category === "bug"
            ? "گزارش خطا"
            : f.category === "suggestion"
              ? "پیشنهاد"
              : "سایر";
      lines.push(`${idx}. [${who} | ${cat}] "${f.message.slice(0, 500)}"`);
      idx++;
    }

    const surveyData = lines.join("\n");

    // میانگین امتیازهای نظرسنجی (بر اساس questionId های واقعی)
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const s of surveys) {
      let ratings: Record<string, number> = {};
      try {
        ratings = JSON.parse(s.ratings) as Record<string, number>;
      } catch {
        ratings = {};
      }
      for (const [qid, v] of Object.entries(ratings)) {
        if (typeof v === "number" && v >= 1 && v <= 5) {
          sums[qid] = (sums[qid] ?? 0) + v;
          counts[qid] = (counts[qid] ?? 0) + 1;
        }
      }
    }
    const averages = Object.keys(sums)
      .map((qid) =>
        counts[qid] > 0
          ? `${questionLabels[qid] ?? qid}: ${(sums[qid] / counts[qid]).toFixed(1)}/5`
          : `${questionLabels[qid] ?? qid}: —`
      )
      .join("، ");

    const systemPrompt = `تو یک تحلیلگر حرفه‌ای نظرات کاربران هستی. نظرات زیر را تحلیل کن و:
۱. نقاط قوت (۳ مورد)
۲. ایرادات و ضعف‌ها (۳ مورد)
۳. پیشنهادات بهبود (۳ مورد)
۴. خلاصه کلی (۲ جمله)
ارائه بده. فارسی، حرفه‌ای و کاربردی. پاسخ را با مارک‌داون (## و -) فرمت کن. هر بخش را با عنوان مارک‌داون مشخص کن: ## نقاط قوت، ## ایرادات و ضعف‌ها، ## پیشنهادات بهبود، ## خلاصه کلی.`;

    // میانگین‌ها فقط وقتی معنا دارند که نظرسنجی وجود داشته باشد
    const averagesBlock = averages
      ? `میانگین امتیازها:\n${averages}\n`
      : "";

    const userPrompt = `${averagesBlock}
تعداد کل نظرات: ${surveys.length + feedbacks.length} (نظرسنجی: ${surveys.length}، بازخورد: ${feedbacks.length})

لیست نظرات کاربران:
${surveyData}

لطفاً بر اساس این داده‌ها، تحلیل حرفه‌ای خود را ارائه بده.`;

    let analysis = "";
    try {
      const completion = await avalaiClient.chat.completions.create({
        model: TEXT_MODEL,
        messages: [
          { role: "system", content: withSystemDirectives(systemPrompt) },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      });
      analysis = completion.choices[0]?.message?.content || "";
    } catch (err) {
      console.error("[feedback/analyze] AI error:", err);
      return Response.json(
        { error: "خطا در ارتباط با سرویس هوش مصنوعی. لطفاً کمی بعد دوباره تلاش کنید." },
        { status: 502 }
      );
    }

    if (!analysis.trim()) {
      return Response.json(
        { error: "پاسخی از هوش مصنوعی دریافت نشد." },
        { status: 500 }
      );
    }

    return Response.json({ analysis, count: surveys.length + feedbacks.length });
  } catch (e) {
    return apiError(e);
  }
}
