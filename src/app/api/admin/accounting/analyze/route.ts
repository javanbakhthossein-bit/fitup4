import { NextRequest } from "next/server";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { analyzeAccountingData } from "@/lib/fitness/ai";

/**
 * POST /api/admin/accounting/analyze
 *
 * body: { mode: "overview" | "compare" | "details", data: <any> }
 *
 * تحلیل هوشمند داده‌های حسابداری توسط AI. خروجی ساختاریافته:
 *  { summary, strengths, weaknesses, salesRecommendations, forecast, healthScore }
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const mode = body?.mode;
    const data = body?.data;

    if (!["overview", "compare", "details"].includes(mode)) {
      return Response.json({ error: "حالت تحلیل نامعتبر است." }, { status: 400 });
    }
    if (!data || typeof data !== "object") {
      return Response.json({ error: "داده تحلیل ارسال نشده است." }, { status: 400 });
    }

    // محدودسازی حجم payload برای جلوگیری از ارسال بیش از حد
    const payloadStr = JSON.stringify(data);
    if (payloadStr.length > 30000) {
      return Response.json({ error: "حجم داده تحلیل بیش از حد مجاز است." }, { status: 400 });
    }

    const analysis = await analyzeAccountingData(data, mode);
    return Response.json({ analysis });
  } catch (e) {
    return apiError(e);
  }
}
