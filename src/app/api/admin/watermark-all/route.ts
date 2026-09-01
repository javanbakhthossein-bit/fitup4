import { NextRequest } from "next/server";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { addFitUpWatermark, hasFitUpWatermark } from "@/lib/fitness/image-processing";
import { UPLOADS_ROOT } from "@/lib/fitness/uploads-config";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import path from "path";

const ARTICLES_DIR = path.join(UPLOADS_ROOT, "articles");

/**
 * تشخیص واترمارک اکنون از تابع مشترک `hasFitUpWatermark` در image-processing.ts
 * استفاده می‌کند (به‌جای کپی محلی). این تابع ناحیه ۱۰۰×۱۰۰ گوشه پایین-راست را
 * بررسی می‌کند و اگر ≥ ۲۰ پیکسل نارنجی باشد، واترمارک دارد.
 *
 * `hasFitUpWatermark` هم Buffer و هم مسیر فایل قبول می‌کند.
 */

async function processDirectory(
  dirPath: string,
  stats: { processed: number; skipped: number; failed: number },
  limit: { value: number }
) {
  if (limit.value <= 0) return;
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (limit.value <= 0) return;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await processDirectory(fullPath, stats, limit);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (![".webp", ".png", ".jpg", ".jpeg"].includes(ext)) continue;

    try {
      if (await hasFitUpWatermark(fullPath)) {
        stats.skipped++;
        continue;
      }
      const buffer = await readFile(fullPath);
      const watermarked = await addFitUpWatermark(buffer);
      await writeFile(fullPath, watermarked);
      stats.processed++;
    } catch {
      stats.failed++;
    }
    limit.value--;
  }
}

/**
 * POST /api/admin/watermark-all
 * افزودن واترمارک FitUp به همه تصاویر موجود در public/uploads/articles/ که هنوز
 * واترمارک ندارند. این یک عملیات زمان‌بر است (ممکن است چند دقیقه طول بکشد).
 *
 * body:
 *  - limit?: number — حداکثر تعداد فایل برای پردازش (پیش‌فرض ۵۰۰، سقف ۱۰۰۰)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({} as any));
    const limitNum = Math.min(Math.max(Number((body as any)?.limit) || 500, 1), 1000);

    try {
      await stat(ARTICLES_DIR);
    } catch {
      return Response.json({ error: "پوشه uploads/articles وجود ندارد." }, { status: 404 });
    }

    const stats = { processed: 0, skipped: 0, failed: 0 };
    const limit = { value: limitNum };
    await processDirectory(ARTICLES_DIR, stats, limit);

    return Response.json({
      ok: true,
      processed: stats.processed,
      skipped: stats.skipped,
      failed: stats.failed,
      limit: limitNum,
      message: `پردازش کامل شد — ${stats.processed} واترمارک اضافه شد، ${stats.skipped} از قبل داشتند، ${stats.failed} ناموفق`,
    });
  } catch (e) {
    return apiError(e);
  }
}
