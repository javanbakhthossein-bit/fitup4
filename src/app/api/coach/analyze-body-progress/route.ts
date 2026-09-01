import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlanCapability, requireAuth, apiError } from "@/lib/fitness/auth";
import { avalaiClient, VISION_MODEL, withSystemDirectives } from "@/lib/fitness/ai";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * POST /api/coach/analyze-body-progress
 * تحلیل هوشمند پیشرفت بدن از روی عکس‌های پیشرفت کاربر.
 *
 * Gating (v12): قابلیت جدید progressAnalysis — پلن استاندارد و بالاتر (نه فقط advanced).
 * محدودیت اشتراکی: حداکثر ۳ تحلیل در طول هر اشتراک فعال (LIMIT_REACHED = 403).
 * حداکثر ۱۲ عکس به VLM ارسال می‌شود.
 *
 * GET /api/coach/analyze-body-progress
 * وضعیت مصرف برای اشتراک فعال: { used, limit, remaining }
 */

const ANALYSIS_LIMIT = 3;

/**
 * شروع اشتراک فعال — مبنای شمارش محدودیت ۳ بار:
 * اولویت: subscription.startDate (۴۵ روز از تکمیل پیش‌نیازها) → subscription.createdAt
 * (زمان خرید) → user.planStartedAt. اگر هیچ‌کدام نبود null (شمارش کل تاریخ).
 */
async function getActiveSubscriptionStart(userId: string): Promise<Date | null> {
  const activeSub = await db.subscription.findFirst({
    where: { userId, status: "active" },
    orderBy: { endDate: "desc" },
  });
  if (activeSub?.startDate) return activeSub.startDate;
  if (activeSub?.createdAt) return activeSub.createdAt;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { planStartedAt: true },
  });
  return user?.planStartedAt ?? null;
}

/** شمارش تحلیل‌های progressAnalysis در بازه اشتراک فعال */
async function countSubscriptionUsage(userId: string): Promise<number> {
  const start = await getActiveSubscriptionStart(userId);
  return db.analysisResult.count({
    where: {
      userId,
      type: "body_progress",
      ...(start ? { createdAt: { gte: start } } : {}),
    },
  });
}

export async function GET() {
  try {
    // بدون گیت پلن — همه پلن‌ها می‌توانند وضعیت مصرف خود را ببینند
    // (کلاینت برای کاربران قفل‌شده دکمه قفل‌شده نشان می‌دهد).
    const user = await requireAuth();
    const used = await countSubscriptionUsage(user.id);
    return NextResponse.json({
      used,
      limit: ANALYSIS_LIMIT,
      remaining: Math.max(0, ANALYSIS_LIMIT - used),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    // ─── H2: گیت پلن مؤثر (اشتراک-آگاه) مثل analyze-body ───
    // قبلاً روی user.planName خام گیت می‌شد که در انقضای طبیعی هرگز پاک نمی‌شود
    // و کاربر منقضی‌شده برای همیشه دسترسی VLM premium داشت.
    // v12: قابلیت progressAnalysis (standard+، به‌جای bodyPhotoAnalysis tier 3).
    const { userId } = await requirePlanCapability("progressAnalysis");

    // ─── M6: محدودیت نرخ — ۱۰ تحلیل در ساعت برای هر کاربر (تا ۱۲ فریم VLM — گران‌ترین مسیر) ───
    const rl = rateLimit(`analyze-body-progress:${userId}`, 10, 60 * 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    // ─── v12: محدودیت اشتراکی — ۳ بار در طول اشتراک فعال ───
    const used = await countSubscriptionUsage(userId);
    if (used >= ANALYSIS_LIMIT) {
      return NextResponse.json(
        {
          error: "تحلیل پیشرفت برای این اشتراک ۳ بار استفاده شده؛ با تمدید اشتراک دوباره فعال می‌شود.",
          code: "LIMIT_REACHED",
        },
        { status: 403 }
      );
    }

    const { photos } = await req.json();
    if (!Array.isArray(photos) || photos.length < 2) {
      return NextResponse.json(
        { error: "برای تحلیل پیشرفت حداقل ۲ عکس نیاز است." },
        { status: 400 }
      );
    }

    // بررسی اینکه عکس‌ها متعلق به کاربر هستند
    const userPhotos = await db.progressPhoto.findMany({
      where: { userId },
      select: { imageUrl: true, type: true, takenAt: true },
    });
    const userPhotoUrls = new Set(userPhotos.map((p) => p.imageUrl));
    const validPhotos = photos.filter((p: any) => userPhotoUrls.has(p.imageUrl));
    if (validPhotos.length < 2) {
      return NextResponse.json(
        { error: "عکس‌های معتبر کافی نیست." },
        { status: 400 }
      );
    }

    // مرتب‌سازی بر اساس تاریخ (قدیمی به جدید)
    validPhotos.sort((a: any, b: any) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());

    const photoDescriptions = validPhotos.map((p: any, i: number) => {
      const date = new Date(p.takenAt).toLocaleDateString("fa-IR");
      const typeLabel = p.type === "front" ? "جلو" : p.type === "side" ? "بغل" : p.type === "back" ? "پشت" : "بدون زاویه";
      return `عکس ${i + 1} (${typeLabel}) - تاریخ: ${date}`;
    }).join("\n");

    // ارسال عکس‌ها به VLM (حداکثر ۱۲ عکس)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const imagesToSend = validPhotos.slice(0, 12).map((p: any) => ({
      type: "image_url" as const,
      image_url: { url: p.imageUrl.startsWith("http") ? p.imageUrl : `${siteUrl}${p.imageUrl}` },
    }));

    const prompt = `این عکس‌های پیشرفت بدن یک ورزشکار را تحلیل کن. عکس‌ها به ترتیب زمانی از قدیمی به جدید هستند:

${photoDescriptions}

لطفاً یک تحلیل کامل از پیشرفت بدن این ورزشکار ارائه بده:
۱. تغییرات ظاهری بین عکس‌ها (عضلات، چربی بدن، فرم بدن)
۲. نقاط قوت و پیشرفت‌های مشاهده‌شده
۳. نواحی که نیاز به بهبود دارند
۴. توصیه‌های تمرینی برای پیشرفت بیشتر

فقط به زبان فارسی و با لحن حرفه‌ای و انگیزشی پاسخ بده. حداکثر ۳۰۰ کلمه.`;

    const completion = await avalaiClient.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "system",
          content: withSystemDirectives("تو یک مربی حرفه‌ای بدنسازی و متخصص تحلیل پیشرفت بدن هستی. عکس‌های پیشرفت ورزشکار را مقایسه کن و تحلیل دقیق ارائه بده."),
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...imagesToSend,
          ],
        },
      ],
    } as any);

    const analysis = completion.choices[0]?.message?.content || "تحلیلی دریافت نشد.";

    // ذخیره تحلیل
    await db.analysisResult.create({
      data: {
        userId,
        type: "body_progress",
        result: JSON.stringify({ analysis, photoCount: validPhotos.length, analyzedAt: new Date().toISOString() }),
        mediaUrl: null,
      },
    });

    return NextResponse.json({ analysis });
  } catch (e) {
    console.error("[analyze-body-progress] error:", e);
    return apiError(e);
  }
}
