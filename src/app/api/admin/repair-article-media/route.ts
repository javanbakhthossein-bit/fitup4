import { NextRequest } from "next/server";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import {
  scanArticleMediaIssues,
  healArticleMedia,
  scheduleBackgroundHeal,
  getSelfHealStatus,
  sweepWatermarks,
} from "@/lib/fitness/article-media-selfheal";

/**
 * POST /api/admin/repair-article-media
 *
 * تعمیر رسانه مقالات (کاور + تصاویر inline):
 *   - مقالاتی که کاور ندارند یا فایل کاورشان مفقود است → کاور تولید می‌شود
 *   - رفرنس‌های ![alt](url) داخل متن که فایلشان مفقود است → تصویر تولید و رفرنس اصلاح می‌شود
 *   - مقالات بدون هیچ تصویر inline → یک تصویر مرتبط درج می‌شود
 *   - alt text های خالی → alt فارسی حاوی کلمه کلیدی
 *
 * حالت‌ها:
 *   { scanOnly: true }                    → فقط اسکن (سریع، بدون تغییر) — برای نمایش گزارش قبل از تأیید
 *   { slug: "..." }                       → ترمیم sync یک مقاله (برای دکمه per-article) — پاسخ: گزارش کامل
 *   { wait: true, maxGenerations?: n }    → ترمیم sync همه (تا سقف n تصویر، پیش‌فرض ۲۰) — پاسخ: گزارش
 *   { } (پیش‌فرض)                          → ترمیم async همه در پس‌زمینه — پاسخ فوری: { started: true }
 *
 * GET /api/admin/repair-article-media → وضعیت سرویس self-heal + آمار مسائل
 */

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => ({}))) as {
      scanOnly?: boolean;
      slug?: string;
      wait?: boolean;
      force?: boolean;
      addMissingInlines?: boolean;
      maxGenerations?: number;
      watermarkSweep?: boolean;
    };

    // ─── حالت ۵: فقط جاروی واترمارک + کش آینه‌ای ───
    if (body.watermarkSweep) {
      const sweep = await sweepWatermarks(Math.min(1000, body.maxGenerations || 500));
      return Response.json({ ok: true, mode: "watermark-sweep", sweep });
    }

    // ─── حالت ۱: فقط اسکن (بدون تغییر) ───
    if (body.scanOnly) {
      const { stats, issues } = await scanArticleMediaIssues();
      return Response.json({
        ok: true,
        stats,
        // فقط خلاصه — برای تأیید ادمین قبل از شروع
        sampleSlugs: issues.slice(0, 10).map((i) => i.slug),
      });
    }

    // ─── حالت ۲: ترمیم sync یک مقاله ───
    if (body.slug && typeof body.slug === "string") {
      const report = await healArticleMedia({
        slugs: [body.slug],
        force: Boolean(body.force),
        addMissingInlines: body.addMissingInlines !== false,
        maxGenerations: Math.min(10, body.maxGenerations || 6),
      });
      return Response.json({ ok: true, mode: "single", slug: body.slug, report });
    }

    // ─── حالت ۳: ترمیم sync همه (منتظر می‌ماند) ───
    if (body.wait) {
      const report = await healArticleMedia({
        addMissingInlines: body.addMissingInlines !== false,
        maxGenerations: Math.min(60, body.maxGenerations || 20),
      });
      // جاروی واترمارک هم همراه ترمیم کامل اجرا شود
      const sweep = await sweepWatermarks(500);
      return Response.json({ ok: true, mode: "sync", report, sweep });
    }

    // ─── حالت ۴ (پیش‌فرض): ترمیم async همه در پس‌زمینه ───
    // اگر pass در حال اجرا نیست، همین الان شروع می‌شود؛ وگرنه همین اجرای
    // جاری ادامه می‌دهد. اسکن اول برای گزارش تعداد مسائل انجام می‌شود.
    const { stats } = await scanArticleMediaIssues();
    scheduleBackgroundHeal({ force: true });
    return Response.json({
      ok: true,
      mode: "background",
      started: true,
      stats,
      status: getSelfHealStatus(),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const { stats } = await scanArticleMediaIssues();
    return Response.json({
      ok: true,
      stats,
      status: getSelfHealStatus(),
    });
  } catch (e) {
    return apiError(e);
  }
}
