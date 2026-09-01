import { NextRequest } from "next/server";
import { requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { analyzeBodyPhoto } from "@/lib/fitness/ai";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requirePlanCapability("bodyPhotoAnalysis");

    // ─── M6: محدودیت نرخ — ۲۰ آنالیز در ساعت برای هر کاربر (کال VLM)
    const rl = rateLimit(`analyze-body:${userId}`, 20, 60 * 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    const { base64Image, mimeType, userContext } = await req.json();
    if (!base64Image) return Response.json({ error: "تصویر ارسال نشده." }, { status: 400 });
    const result = await analyzeBodyPhoto(base64Image, mimeType || "image/jpeg", userContext || "");
    return Response.json(result);
  } catch (e) {
    return apiError(e);
  }
}
