import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    const [weights, photos, profile, checkups] = await Promise.all([
      db.weightLog.findMany({
        where: { userId: user.id },
        orderBy: { loggedAt: "asc" },
      }),
      db.progressPhoto.findMany({
        where: { userId: user.id },
        orderBy: { takenAt: "desc" },
      }),
      db.onboardingProfile.findUnique({ where: { userId: user.id } }),
      db.checkup.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // ─── Body composition history (from checkups with bodyFatPercent) ───
    // شامل چکاپ phase 0 (baseline) + همه چکاپ‌های بعدی که bodyFatPercent دارند.
    const bodyCompHistory = checkups
      .filter((c) => c.bodyFatPercent != null)
      .map((c) => ({
        date: c.createdAt.toISOString().slice(0, 10),
        weight: Math.round(c.weight * 10) / 10,
        bodyFatPercent: c.bodyFatPercent!,
        leanBodyMass: c.leanBodyMass ?? null,
      }));

    return Response.json({
      weights: weights.map((w) => ({
        id: w.id,
        weight: w.weight,
        note: w.note,
        loggedAt: w.loggedAt.toISOString(),
      })),
      photos: photos.map((p) => ({
        id: p.id,
        imageUrl: p.imageUrl,
        type: p.type,
        note: p.note,
        takenAt: p.takenAt.toISOString(),
      })),
      startWeight: profile?.weight ?? null,
      targetWeight: profile?.targetWeight ?? null,
      // ─── NEW (BODY-COMPOSITION-PRO): body composition history from checkups ───
      bodyCompositionHistory: bodyCompHistory,
      // ─── Latest body composition (for quick display) ───
      latestBodyComposition: (() => {
        if (bodyCompHistory.length === 0) return null;
        const last = bodyCompHistory[bodyCompHistory.length - 1];
        return last;
      })(),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { weight, note } = await req.json();
    if (!weight || weight < 30 || weight > 250) {
      return Response.json({ error: "وزن نامعتبر است." }, { status: 400 });
    }
    const log = await db.weightLog.create({
      data: { userId: user.id, weight: Number(weight), note: String(note || "") },
    });

    // Check achievement
    const profile = await db.onboardingProfile.findUnique({
      where: { userId: user.id },
    });
    if (profile?.targetWeight && Number(weight) <= profile.targetWeight) {
      // ─── Dedup: یک نوتیف «رسیدن به وزن هدف» برای هر کاربر کافی است ───
      // قبلاً هر ثبت وزنِ زیرِ هدف یک نوتیف جدید می‌ساخت — کاربری که روزانه وزن
      // ثبت می‌کرد به‌ازای هر ثبت یک اعلان تبریک تکراری می‌گرفت (spam نوتیف).
      const alreadyCelebrated = await db.notification.findFirst({
        where: {
          userId: user.id,
          type: "achievement",
          title: "تبریک! به وزن هدف رسیدید! 🏆",
        },
        select: { id: true },
      });
      if (!alreadyCelebrated) {
        await db.notification.create({
          data: {
            userId: user.id,
            type: "achievement",
            title: "تبریک! به وزن هدف رسیدید! 🏆",
            body: `شما به وزن هدف خود (${profile.targetWeight} کیلوگرم) رسیدید. عالی بود!`,
            link: "?tab=progress",
            read: false,
          },
        });
      }
    }

    return Response.json({
      id: log.id,
      weight: log.weight,
      note: log.note,
      loggedAt: log.loggedAt.toISOString(),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "ID نیاز است." }, { status: 400 });
    await db.weightLog.deleteMany({ where: { id, userId: user.id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
