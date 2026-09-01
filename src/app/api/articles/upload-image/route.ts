import { NextRequest } from "next/server";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getArticlesDir, addFitUpWatermark, hasFitUpWatermark } from "@/lib/fitness/image-processing";

/**
 * POST /api/articles/upload-image
 * Admin-only image upload for article content/cover.
 * Accepts multipart/form-data with field "image".
 * Returns { url: "/uploads/articles/xxx.jpg" }
 *
 * عکس‌ها در `uploads/articles/` (در ریشه پروژه) ذخیره می‌شوند — نه در public.
 * این کار از از دست رفتن عکس‌ها در زمان build جلوگیری می‌کند.
 *
 * مهم: واترمارک FitUp به‌صورت خودکار روی همه عکس‌های آپلودی اعمال می‌شود
 * (اگر قبلاً واترمارک نداشته باشند). این شامل کاور و عکس‌های داخل متن مقالات است.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const formData = await req.formData();
    const file = formData.get("image");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "فایلی ارسال نشده است." }, { status: 400 });
    }

    // Validate type
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "فقط فایل تصویری مجاز است." }, { status: 400 });
    }
    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "حداکثر حجم فایل ۵ مگابایت است." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const allowedExts = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
    const finalExt = allowedExts.includes(ext) ? ext : "jpg";
    let fileName = `art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${finalExt}`;

    const uploadDir = getArticlesDir();
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());

    // اعمال واترمارک FitUp روی همه عکس‌های آپلودی (اگر قبلاً واترمارک ندارند).
    // این کار تضمین می‌کند که همه عکس‌های مقالات (کاور + اینلاین) واترمارک داشته باشند.
    // فرمت اصلی عکس حفظ می‌شود (PNG→PNG، JPEG→JPEG، WebP→WebP).
    // (cast Buffer: sharp toBuffer نوع ArrayBufferLike برمی‌گرداند که برای writeFile همساز است)
    let finalBuffer: Buffer<ArrayBufferLike> = buffer;
    try {
      const alreadyWatermarked = await hasFitUpWatermark(buffer);
      if (!alreadyWatermarked) {
        finalBuffer = (await addFitUpWatermark(buffer)) as Buffer;
      }
    } catch (wmErr) {
      // اگر واترمارک شکست خورد، عکس اصلی را ذخیره کن (بدون واترمارک) و هشدار بده.
      console.error("[upload-image] watermark failed:", wmErr);
      finalBuffer = buffer;
    }
    const wasWatermarked = finalBuffer !== buffer;

    // ─── تبدیل PNG/JPG به WebP واقعی ───
    // فرانت‌اند (toWebp در image-utils.ts) پسوند png/jpg کاورها را به .webp
    // بازنویسی می‌کند؛ اگر فایل .webp روی دیسک نباشد، تصویر همه‌جا ۴۰۴ می‌شود.
    // پس تبدیل همین‌جا سمت سرور انجام می‌شود تا URL برگشتی (که ادمین به‌عنوان
    // coverImage در DB ذخیره می‌کند) همیشه به فایل واقعی روی دیسک اشاره کند.
    // fallback: اگر تبدیل sharp شکست بخورد، همان بافر اصلی با پسوند اصلی ذخیره
    // می‌شود و همان مسیر برگردانده می‌شود (هشدار در لاگ).
    if (["jpg", "jpeg", "png"].includes(finalExt)) {
      try {
        const sharp = (await import("sharp")).default;
        finalBuffer = (await sharp(finalBuffer).webp({ quality: 85 }).toBuffer()) as Buffer;
        fileName = fileName.replace(/\.(jpe?g|png)$/i, ".webp");
      } catch (convErr) {
        console.warn("[upload-image] webp conversion failed — saving original format:", convErr);
      }
    }

    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, finalBuffer);

    return Response.json({
      url: `/uploads/articles/${fileName}`,
      size: finalBuffer.length,
      type: file.type,
      watermarked: wasWatermarked,
    });
  } catch (e) {
    return apiError(e);
  }
}
