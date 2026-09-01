import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { unlink } from "fs/promises";
import { savePrivateMediaFile, absolutePathForUploadUrl } from "@/lib/fitness/private-media";

/**
 * POST /api/progress/photo
 * آپلود عکس پیشرفت بدن (front/side/back)
 * Body: multipart/form-data
 *   - image: File (عکس)
 *   - type: string ("front" | "side" | "back")
 *   - note: string (اختیاری)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const formData = await req.formData();
    const imageField = formData.get("image");
    const image = imageField instanceof File ? imageField : null;
    const type = (formData.get("type") as string) || "front";
    const note = (formData.get("note") as string) || "";

    if (!image) {
      return NextResponse.json({ error: "عکس ارسال نشده." }, { status: 400 });
    }

    if (!["front", "side", "back"].includes(type)) {
      return NextResponse.json({ error: "نوع عکس نامعتبر است." }, { status: 400 });
    }

    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "حجم عکس بیش از ۱۰ مگابایت است." }, { status: 400 });
    }

    // اعتبارسنجی نوع فایل — بدون این بررسی، فایل غیرتصویری به sharp می‌رسد و
    // خطای خام انگلیسی libvips با status 500 به کاربر فارسی‌زبان نمایش داده می‌شد
    if (!image.type.startsWith("image/")) {
      return NextResponse.json({ error: "فقط فایل تصویری مجاز است." }, { status: 400 });
    }

    // فشرده‌سازی عکس با sharp
    const sharp = (await import("sharp")).default;
    const buffer = Buffer.from(await image.arrayBuffer());
    let processed: Buffer;
    try {
      processed = await sharp(buffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();
    } catch (sharpErr) {
      // تصویر خراب (مثلاً header نامعتبر) — پیام عمومی فارسی به‌جای خطای خام sharp
      console.error("[progress/photo] sharp processing failed:", sharpErr);
      return NextResponse.json(
        { error: "پردازش تصویر ناموفق بود. لطفاً یک تصویر معتبر ارسال کنید." },
        { status: 500 }
      );
    }

    // ذخیره فایل — در uploads/progress/ (خارج از public؛ سرو با احراز هویت).
    // نام فایل شامل شناسه کاربر است تا مالکیت مستقیم تشخیص داده شود.
    const fileName = `progress-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const { url: imageUrl } = await savePrivateMediaFile("progress", fileName, processed);

    // ذخیره در دیتابیس
    const photo = await db.progressPhoto.create({
      data: { userId: user.id, imageUrl, type, note },
    });

    return NextResponse.json({
      id: photo.id,
      imageUrl: photo.imageUrl,
      type: photo.type,
      note: photo.note,
      takenAt: photo.takenAt.toISOString(),
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * DELETE /api/progress/photo?id=<id>
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID نیاز است." }, { status: 400 });
    }

    const photo = await db.progressPhoto.findFirst({
      where: { id, userId: user.id },
    });
    if (!photo) {
      return NextResponse.json({ error: "عکس یافت نشد." }, { status: 404 });
    }

    // حذف فایل از دیسک
    try {
      const filePath = absolutePathForUploadUrl(photo.imageUrl);
      await unlink(filePath).catch(() => {});
    } catch {}

    await db.progressPhoto.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError(e);
  }
}
