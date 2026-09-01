import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { persianContainsVariants } from "@/lib/fitness/persian-search";

// Public food list (no auth)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";

  const where: any = {};
  if (search) {
    // جستجوی مقاوم به نیم‌فاصله/فاصله و ی/ک عربی
    // (قبلاً «آب پز» با فاصله، غذای «آب‌پز» با نیم‌فاصله را پیدا نمی‌کرد)
    where.OR = persianContainsVariants(search, "name");
  }
  if (category && category !== "all") where.category = category;

  const foods = await db.foodLibrary.findMany({
    where,
    orderBy: { name: "asc" },
    take: 2000,
  });

  return Response.json({ foods });
}
