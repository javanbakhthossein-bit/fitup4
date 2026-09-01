import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

// ─── اعتبارسنجی ورودی (ممیزی 2-c P2) ───
// قبلاً فیلدها خام پاس می‌شدند: نبود name → 500؛ PUT با spread ...body هر
// کلیدی (id/createdAt/کلید ناشناخته) را می‌پذیرفت و رکورد را خراب می‌کرد.

/** سقف نام (کاراکتر) */
const MAX_NAME = 100;
const VALID_CATEGORIES = ["push", "pull", "legs", "core", "cardio", "fullbody"];
const VALID_DIFFICULTIES = ["beginner", "intermediate", "advanced"];

/** اعتبارسنجی نام حرکت — الزامی، ≤۱۰۰ کاراکتر */
function validateName(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_NAME) {
    return `نام حرکت الزامی است و حداکثر ${MAX_NAME} کاراکتر باشد.`;
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const exercises = await db.exerciseLibrary.findMany({
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ exercises });
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

    // جلوگیری از نام تکراری (case-insensitive — ممیزی 2-c P2)
    // SQLite فیلتر mode:insensitive ندارد؛ پس نام‌ها را می‌خوانیم و با lower-case مقایسه می‌کنیم
    const lowerName = name.toLowerCase();
    const existingNames = await db.exerciseLibrary.findMany({ select: { name: true } });
    if (existingNames.some((e) => e.name.trim().toLowerCase() === lowerName)) {
      return Response.json({ error: "همین نام قبلاً ثبت شده است" }, { status: 400 });
    }

    const category =
      typeof body.category === "string" && VALID_CATEGORIES.includes(body.category.trim())
        ? body.category.trim()
        : "fullbody";
    const difficulty =
      typeof body.difficulty === "string" && VALID_DIFFICULTIES.includes(body.difficulty.trim())
        ? body.difficulty.trim()
        : "intermediate";

    const ex = await db.exerciseLibrary.create({
      data: {
        name,
        muscle: typeof body.muscle === "string" && body.muscle.trim() ? body.muscle.trim() : "",
        category,
        equipment: typeof body.equipment === "string" ? body.equipment.trim() : "",
        description: typeof body.description === "string" ? body.description.trim() : "",
        tips: typeof body.tips === "string" ? body.tips.trim() : "",
        mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "",
        youtubeUrl: typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim() : "",
        difficulty,
      },
    });
    return Response.json({ exercise: ex });
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

    // فقط فیلدهای مجاز و صریح — قبلاً data خام پاس می‌شد و کلیدهای
    // ناشناخته/سیستمی (id/createdAt/…) قابل تزریق بودند.
    const data: {
      name?: string;
      muscle?: string;
      category?: string;
      equipment?: string;
      description?: string;
      tips?: string;
      mediaUrl?: string;
      youtubeUrl?: string;
      difficulty?: string;
    } = {};

    if (body.name !== undefined) {
      const nameError = validateName(body.name);
      if (nameError) return Response.json({ error: nameError }, { status: 400 });
      data.name = String(body.name).trim();
    }
    if (body.muscle !== undefined) {
      data.muscle = typeof body.muscle === "string" && body.muscle.trim() ? body.muscle.trim() : "";
    }
    if (body.category !== undefined) {
      data.category =
        typeof body.category === "string" && VALID_CATEGORIES.includes(body.category.trim())
          ? body.category.trim()
          : "fullbody";
    }
    if (body.equipment !== undefined) {
      data.equipment = typeof body.equipment === "string" ? body.equipment.trim() : "";
    }
    if (body.description !== undefined) {
      data.description = typeof body.description === "string" ? body.description.trim() : "";
    }
    if (body.tips !== undefined) {
      data.tips = typeof body.tips === "string" ? body.tips.trim() : "";
    }
    if (body.mediaUrl !== undefined) {
      data.mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
    }
    if (body.youtubeUrl !== undefined) {
      data.youtubeUrl = typeof body.youtubeUrl === "string" ? body.youtubeUrl.trim() : "";
    }
    if (body.difficulty !== undefined) {
      data.difficulty =
        typeof body.difficulty === "string" && VALID_DIFFICULTIES.includes(body.difficulty.trim())
          ? body.difficulty.trim()
          : "intermediate";
    }

    const ex = await db.exerciseLibrary.update({ where: { id }, data });
    return Response.json({ exercise: ex });
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
    await db.exerciseLibrary.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
