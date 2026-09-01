import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

// ─── اعتبارسنجی ورودی (ممیزی 2-c P2) ───
// قبلاً فیلدها خام پاس می‌شدند: نبود name → 500؛ Number(abc)→NaN → 500؛
// کالری/ماکروی منفی ذخیره می‌شد؛ PUT با spread ...body هر کلیدی را می‌پذیرفت.

/** سقف نام (کاراکتر) */
const MAX_NAME = 100;
/** سقف‌های عددی — نامنفی + محافظت از سرریز Int در دیتابیس */
const MAX_CALORIES = 1_000_000;
const MAX_MACRO = 100_000;

/** پارس امن عدد: typeof/Number.isFinite — رشته «abc» یا NaN هرگز پاس نمی‌شود */
function parseNum(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** اعتبارسنجی نام غذا — الزامی، ≤۱۰۰ کاراکتر */
function validateName(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_NAME) {
    return `نام غذا الزامی است و حداکثر ${MAX_NAME} کاراکتر باشد.`;
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const foods = await db.foodLibrary.findMany({
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ foods });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    const nameError = validateName(body.name);
    if (nameError) return Response.json({ error: nameError }, { status: 400 });
    const name = String(body.name).trim();

    const calories = parseNum(body.calories);
    if (calories === null || calories < 0 || calories > MAX_CALORIES) {
      return Response.json({ error: "کالری باید عددی نامنفی معتبر باشد." }, { status: 400 });
    }
    const protein = parseNum(body.protein ?? 0);
    const carbs = parseNum(body.carbs ?? 0);
    const fat = parseNum(body.fat ?? 0);
    if (
      protein === null || protein < 0 || protein > MAX_MACRO ||
      carbs === null || carbs < 0 || carbs > MAX_MACRO ||
      fat === null || fat < 0 || fat > MAX_MACRO
    ) {
      return Response.json({ error: "مقادیر ماکرو (پروتئین/کربوهیدرات/چربی) باید اعداد نامنفی معتبر باشند." }, { status: 400 });
    }

    // جلوگیری از نام تکراری (case-insensitive — ممیزی 2-c P2)
    // SQLite فیلتر mode:insensitive ندارد؛ پس نام‌ها را می‌خوانیم و با lower-case مقایسه می‌کنیم
    const lowerName = name.toLowerCase();
    const existingNames = await db.foodLibrary.findMany({ select: { name: true } });
    if (existingNames.some((f) => f.name.trim().toLowerCase() === lowerName)) {
      return Response.json({ error: "همین نام قبلاً ثبت شده است" }, { status: 400 });
    }

    const food = await db.foodLibrary.create({
      data: {
        name,
        category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : "snack",
        calories: Math.round(calories),
        protein,
        carbs,
        fat,
        servingSize: typeof body.servingSize === "string" && body.servingSize.trim() ? body.servingSize.trim() : "۱ وعده",
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() : "",
        isVegan: Boolean(body.isVegan),
      },
    });
    return Response.json({ food });
  } catch (e) {
    return apiError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { id } = body;
    if (!id || typeof id !== "string") {
      return Response.json({ error: "ID نامعتبر است." }, { status: 400 });
    }

    // فقط فیلدهای مجاز و صریح — قبلاً ...data پاس می‌شد و کلیدهای ناشناخته/سیستمی
    // (id/createdAt/…) قابل تزریق بودند؛ مقدار 0 هم چون falsy بود سکیتاً ignore می‌شد.
    const data: {
      name?: string;
      category?: string;
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      servingSize?: string;
      imageUrl?: string;
      isVegan?: boolean;
    } = {};

    if (body.name !== undefined) {
      const nameError = validateName(body.name);
      if (nameError) return Response.json({ error: nameError }, { status: 400 });
      data.name = String(body.name).trim();
    }
    if (body.category !== undefined) {
      data.category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : "snack";
    }
    if (body.calories !== undefined) {
      const calories = parseNum(body.calories);
      if (calories === null || calories < 0 || calories > MAX_CALORIES) {
        return Response.json({ error: "کالری باید عددی نامنفی معتبر باشد." }, { status: 400 });
      }
      data.calories = Math.round(calories);
    }
    if (body.protein !== undefined) {
      const protein = parseNum(body.protein);
      if (protein === null || protein < 0 || protein > MAX_MACRO) {
        return Response.json({ error: "پروتئین باید عددی نامنفی معتبر باشد." }, { status: 400 });
      }
      data.protein = protein;
    }
    if (body.carbs !== undefined) {
      const carbs = parseNum(body.carbs);
      if (carbs === null || carbs < 0 || carbs > MAX_MACRO) {
        return Response.json({ error: "کربوهیدرات باید عددی نامنفی معتبر باشد." }, { status: 400 });
      }
      data.carbs = carbs;
    }
    if (body.fat !== undefined) {
      const fat = parseNum(body.fat);
      if (fat === null || fat < 0 || fat > MAX_MACRO) {
        return Response.json({ error: "چربی باید عددی نامنفی معتبر باشد." }, { status: 400 });
      }
      data.fat = fat;
    }
    if (body.servingSize !== undefined) {
      data.servingSize = typeof body.servingSize === "string" && body.servingSize.trim() ? body.servingSize.trim() : "۱ وعده";
    }
    if (body.imageUrl !== undefined) {
      data.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    }
    if (body.isVegan !== undefined) {
      data.isVegan = Boolean(body.isVegan);
    }

    const food = await db.foodLibrary.update({ where: { id }, data });
    return Response.json({ food });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "ID نیاز است." }, { status: 400 });
    await db.foodLibrary.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
