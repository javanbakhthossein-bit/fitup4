import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public single-food endpoint (no auth)
// GET /api/foods/[id] → returns full food record + related (same category, max 4)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const food = await db.foodLibrary.findUnique({
    where: { id },
  });

  if (!food) {
    return NextResponse.json(
      { error: "غذای موردنظر یافت نشد" },
      { status: 404 }
    );
  }

  // Related foods — same category, excluding current, max 4
  let related: any[] = [];
  try {
    related = await db.foodLibrary.findMany({
      where: {
        category: food.category,
        id: { not: food.id },
      },
      orderBy: { name: "asc" },
      take: 4,
      select: {
        id: true,
        name: true,
        category: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        servingSize: true,
        isVegan: true,
      },
    });
  } catch {
    // ignore related fetch errors
  }

  return NextResponse.json({ food, related });
}
