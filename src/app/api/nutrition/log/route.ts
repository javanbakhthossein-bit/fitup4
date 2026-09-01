import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

/**
 * /api/nutrition/log
 *
 * مدیریت غذاهای ثبت‌شده روزانه کاربر (FoodLog).
 *
 * GET  — لیست غذاهای ثبت‌شده «امروز» (یا تاریخ دلخواه ?date=YYYY-MM-DD) را برمی‌گرداند.
 *        خروجی: { foods: LoggedFood[], totalCalories, totalProtein, totalCarbs, totalFat }
 *
 * POST — ثبت یک غذای جدید.
 *        body: { name, meal, calories, protein, carbs, fat, servingSize?, source?, foodLibraryId?, imageUrl? }
 *        خروجی: { food: LoggedFood }
 *
 * (DELETE روی /api/nutrition/log/[id])
 */

const VALID_MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);

// ─── مرز روز به‌وقت تهران (UTC+03:30 ثابت — ایران از ۲۰۲۲ DST ندارد) ───
// سرور در UTC اجرا می‌شود؛ قبلاً نیمه‌شبِ «سرور» مرز روز بود و «امروز»
// ساعت ۰۳:۳۰ بامداد تهران عوض می‌شد (غذاهای ۰۰:۰۰–۰۳:۳۰ به روز قبل
// می‌رفتند). حالا مرز روز = نیمه‌شب تهران.

/** تاریخ امروز تهران به شکل YYYY-MM-DD (فرمت en-CA خروجی ISO-like می‌دهد) */
function tehranTodayStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date());
}

/** شروع (نیمه‌شب) روز جاری به‌وقت تهران — به‌صورت Date جهانی. */
function startOfToday(): Date {
  return new Date(`${tehranTodayStr()}T00:00:00+03:30`);
}

/** تبدیل رشته‌ی YYYY-MM-DD به نیمه‌شب همان روز به‌وقت تهران. */
function startOfDayFromStr(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const d = new Date(`${dateStr.trim()}T00:00:00+03:30`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date");

    const dayStart = dateStr ? startOfDayFromStr(dateStr) : startOfToday();
    if (!dayStart) {
      return Response.json({ error: "فرمت تاریخ نامعتبر است." }, { status: 400 });
    }
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const rows = await db.foodLog.findMany({
      where: {
        userId: user.id,
        day: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { logDate: "asc" },
    });

    const foods = rows.map((r) => ({
      id: r.id,
      name: r.name,
      meal: r.meal as "breakfast" | "lunch" | "dinner" | "snack",
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      servingSize: r.servingSize,
      source: r.source,
      imageUrl: r.imageUrl,
      loggedAt: r.logDate.toISOString(),
    }));

    const totals = foods.reduce(
      (acc, f) => {
        acc.totalCalories += f.calories;
        acc.totalProtein += f.protein;
        acc.totalCarbs += f.carbs;
        acc.totalFat += f.fat;
        return acc;
      },
      { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
    );

    return Response.json({ foods, ...totals });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
    }

    const name: string = typeof body.name === "string" ? body.name.trim() : "";
    const meal: string = typeof body.meal === "string" ? body.meal : "snack";
    const calories: number = Number(body.calories) || 0;
    const protein: number = Number(body.protein) || 0;
    const carbs: number = Number(body.carbs) || 0;
    const fat: number = Number(body.fat) || 0;
    const servingSize: string =
      typeof body.servingSize === "string" && body.servingSize.trim()
        ? body.servingSize.trim()
        : "۱ وعده";
    const source: string =
      typeof body.source === "string" && ["manual", "library", "ai_photo"].includes(body.source)
        ? body.source
        : "manual";
    const foodLibraryId: string | null =
      typeof body.foodLibraryId === "string" && body.foodLibraryId ? body.foodLibraryId : null;
    const imageUrl: string | null =
      typeof body.imageUrl === "string" && body.imageUrl ? body.imageUrl : null;

    if (!name) {
      return Response.json({ error: "نام غذا الزامی است." }, { status: 400 });
    }
    if (!VALID_MEALS.has(meal)) {
      return Response.json({ error: "وعده‌ی غذایی نامعتبر است." }, { status: 400 });
    }
    if (calories < 0 || protein < 0 || carbs < 0 || fat < 0) {
      return Response.json({ error: "مقدارهای عددی نمی‌توانند منفی باشند." }, { status: 400 });
    }

    // محدودیت ساده‌ی ضد اسپم: نهایتاً ۱۰۰ غذا در روز
    const dayStart = startOfToday();
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const todayCount = await db.foodLog.count({
      where: { userId: user.id, day: { gte: dayStart, lt: dayEnd } },
    });
    if (todayCount >= 100) {
      return Response.json(
        { error: "حداکثر ۱۰۰ غذای ثبت‌شده در روز مجاز است." },
        { status: 400 }
      );
    }

    const created = await db.foodLog.create({
      data: {
        userId: user.id,
        name,
        meal,
        calories: Math.round(calories),
        protein,
        carbs,
        fat,
        servingSize,
        source,
        foodLibraryId,
        imageUrl,
        logDate: new Date(),
        day: dayStart,
      },
    });

    return Response.json({
      food: {
        id: created.id,
        name: created.name,
        meal: created.meal as "breakfast" | "lunch" | "dinner" | "snack",
        calories: created.calories,
        protein: created.protein,
        carbs: created.carbs,
        fat: created.fat,
        servingSize: created.servingSize,
        source: created.source,
        imageUrl: created.imageUrl,
        loggedAt: created.logDate.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
