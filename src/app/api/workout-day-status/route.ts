import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { PERSIAN_WEEKDAYS } from "@/lib/fitness/types";

// ─── مرز روز/هفته به‌وقت تهران (UTC+03:30 ثابت — ایران از ۲۰۲۲ DST ندارد) ───
// سرور در UTC اجرا می‌شود؛ قبلاً هفته با نیمه‌شبِ «سرور» عوض می‌شد یعنی
// ساعت ۰۳:۳۰ بامداد تهران — رکوردهای شب‌های دیروقت در هفته اشتباه ثبت می‌شدند.
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

/** نیمه‌شب «امروز» به وقت تهران (به‌صورت Date جهانی) */
function tehranMidnight(date: Date = new Date()): Date {
  // تاریخ تهران (YYYY-MM-DD) — فرمت en-CA خروجی ISO-like می‌دهد
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(date);
  return new Date(`${ymd}T00:00:00+03:30`);
}

/**
 * محاسبه تاریخ شروع هفته (شنبه) بر اساس تاریخ فعلی
 * در تقویم ایرانی، هفته از شنبه شروع می‌شود — نیمه‌شب شنبه به وقت تهران
 */
function getWeekStart(date: Date = new Date()): Date {
  // روز هفته به وقت تهران — چون آفست ثابت است، شیفت زمانی + خواندن UTC-Day
  // دقیقاً روز هفته تهران را می‌دهد (شنبه=6 در getUTCDay)
  const tehranDayOfWeek = new Date(date.getTime() + TEHRAN_OFFSET_MS).getUTCDay();
  // تبدیل به سیستم ایرانی: شنبه=0, یکشنبه=1, ..., جمعه=6
  const daysSinceSaturday = (tehranDayOfWeek + 1) % 7;
  // نیمه‌شب شنبه همین هفته تهران = نیمه‌شب امروز منهای روزهای گذشته از شنبه
  return new Date(tehranMidnight(date).getTime() - daysSinceSaturday * 86400000);
}

// GET — وضعیت روزهای هفته جاری
export async function GET() {
  try {
    const user = await requireAuth();
    const weekStart = getWeekStart();

    const statuses = await db.workoutDayStatus.findMany({
      where: {
        userId: user.id,
        weekStart,
      },
    });

    return Response.json({
      weekStart: weekStart.toISOString(),
      statuses: statuses.map((s) => ({
        id: s.id,
        dayName: s.dayName,
        status: s.status,
        movedTo: s.movedTo,
        swappedFrom: s.swappedFrom,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST — ثبت یا به‌روزرسانی وضعیت یک روز
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { dayName, status, movedTo, swappedFrom } = body || {};

    if (!dayName || !PERSIAN_WEEKDAYS.includes(dayName)) {
      return Response.json({ error: "نام روز نامعتبر است." }, { status: 400 });
    }

    if (!["completed", "skipped", "rest_as_planned"].includes(status)) {
      return Response.json({ error: "وضعیت نامعتبر است." }, { status: 400 });
    }

    const weekStart = getWeekStart();

    const result = await db.workoutDayStatus.upsert({
      where: {
        userId_dayName_weekStart: {
          userId: user.id,
          dayName,
          weekStart,
        },
      },
      create: {
        userId: user.id,
        dayName,
        weekStart,
        status,
        movedTo: movedTo || null,
        swappedFrom: swappedFrom || null,
      },
      update: {
        status,
        movedTo: movedTo || null,
        swappedFrom: swappedFrom || null,
      },
    });

    return Response.json({
      ok: true,
      status: {
        id: result.id,
        dayName: result.dayName,
        status: result.status,
        movedTo: result.movedTo,
        swappedFrom: result.swappedFrom,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
