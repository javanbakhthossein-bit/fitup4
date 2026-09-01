import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public single-exercise endpoint (no auth)
// GET /api/exercises/[id] → returns full exercise record + related (same muscle, max 4)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const exercise = await db.exerciseLibrary.findUnique({
    where: { id },
  });

  if (!exercise) {
    return NextResponse.json(
      { error: "حرکت موردنظر یافت نشد" },
      { status: 404 }
    );
  }

  // Related exercises — same muscle group, excluding current, max 4
  let related: any[] = [];
  try {
    related = await db.exerciseLibrary.findMany({
      where: {
        muscle: exercise.muscle,
        id: { not: exercise.id },
      },
      orderBy: { name: "asc" },
      take: 4,
      select: {
        id: true,
        name: true,
        muscle: true,
        category: true,
        equipment: true,
        difficulty: true,
        youtubeUrl: true,
      },
    });
  } catch {
    // ignore related fetch errors
  }

  return NextResponse.json({ exercise, related });
}
