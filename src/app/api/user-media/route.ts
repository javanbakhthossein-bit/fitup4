import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

/**
 * GET /api/user-media
 *
 * دریافت تمام عکس‌ها، ویدیوها و تحلیل‌های کاربر به‌صورت دسته‌بندی شده.
 *
 * دسته‌ها:
 *  - bodyPhotos: عکس‌های پیشرفت بدن (ProgressPhoto)
 *  - bloodTests: نتایج تحلیل آزمایش خون (AnalysisResult type=blood_test)
 *  - videoAnalysis: نتایج تحلیل ویدیو (AnalysisResult type=video_analysis)
 *  - bodyAnalysis: نتایج تحلیل عکس بدن (AnalysisResult type=body_photo)
 */
export async function GET() {
  try {
    const user = await requireAuth();

    const [progressPhotos, analysisResults] = await Promise.all([
      db.progressPhoto.findMany({
        where: { userId: user.id },
        orderBy: { takenAt: "desc" },
      }),
      db.analysisResult.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const bloodTests = analysisResults
      .filter((r) => r.type === "blood_test")
      .map((r) => ({
        id: r.id,
        mediaUrl: r.mediaUrl,
        result: safeParse(r.result),
        createdAt: r.createdAt.toISOString(),
      }));

    const videoAnalysis = analysisResults
      .filter((r) => r.type === "video_analysis")
      .map((r) => ({
        id: r.id,
        mediaUrl: r.mediaUrl,
        result: safeParse(r.result),
        createdAt: r.createdAt.toISOString(),
      }));

    const bodyAnalysis = analysisResults
      .filter((r) => r.type === "body_photo")
      .map((r) => ({
        id: r.id,
        mediaUrl: r.mediaUrl,
        result: safeParse(r.result),
        createdAt: r.createdAt.toISOString(),
      }));

    return Response.json({
      bodyPhotos: progressPhotos.map((p) => ({
        id: p.id,
        imageUrl: p.imageUrl,
        type: p.type,
        note: p.note,
        takenAt: p.takenAt.toISOString(),
      })),
      bloodTests,
      videoAnalysis,
      bodyAnalysis,
    });
  } catch (e) {
    return apiError(e);
  }
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
