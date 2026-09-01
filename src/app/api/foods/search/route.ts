import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { persianContainsVariants, persianFuzzyIncludes } from "@/lib/fitness/persian-search";

/**
 * GET /api/foods/search?q=<query>&limit=<n>&category=<cat>
 *
 * جستجوی سریع در بانک غذاها برای autocomplete.
 * - بدون نیاز به auth (بانک غذاها عمومی است)
 * - حداقل ۲ حرف برای جستجو
 * - حداکثر ۲۰ نتیجه (پیش‌فرض)
 * - جستجوی contains (حساس به حروف فارسی نبودن توسط SQLite COLLATE انجام نمی‌شود؛
 *   برای پشتیبانی بهتر، هر دو شکل contains معمولی و normalize ساده انجام می‌شود)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || searchParams.get("search") || "").trim();
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50
    ? Math.floor(limitRaw)
    : 20;
  const category = searchParams.get("category") || "";

  // اگر کوئری خیلی کوتاه است → هیچ نتیجه برنگردان (UX بهتر)
  if (q.length < 1) {
    return Response.json({ foods: [] });
  }

  const where: any = {
    // جستجوی مقاوم به نیم‌فاصله/فاصله و ی/ک عربی
    OR: persianContainsVariants(q, "name"),
  };
  if (category && category !== "all") where.category = category;

  try {
    let foods = await db.foodLibrary.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      select: {
        id: true,
        name: true,
        category: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        servingSize: true,
        imageUrl: true,
        isVegan: true,
      },
    });

    // ─── Fallback جستجوی فازی ───
    // اگر شکل literal نتیجه‌ای نداد (مثلاً کاربر «آبپز» چسبیده نوشته ولی
    // نام غذا «آب‌پز» با نیم‌فاصله است)، روی کل بانک (~۱۰۰۰ رکورد) با
    // نرمال‌سازی کامل (حذف فاصله/نیم‌فاصله + یکسان‌سازی ی/ک) فیلتر می‌کنیم.
    if (foods.length === 0) {
      const all = await db.foodLibrary.findMany({
        where: category && category !== "all" ? { category } : undefined,
        orderBy: { name: "asc" },
        take: 2000,
        select: {
          id: true,
          name: true,
          category: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          servingSize: true,
          imageUrl: true,
          isVegan: true,
        },
      });
      foods = all.filter((f) => persianFuzzyIncludes(f.name, q)).slice(0, limit);
    }

    return Response.json({ foods });
  } catch (e) {
    console.error("[foods/search] error:", e);
    return Response.json({ foods: [], error: "خطا در جستجو" }, { status: 500 });
  }
}
