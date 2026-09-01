import { db } from "@/lib/db";
import { apiError } from "@/lib/fitness/auth";

// Public endpoint — returns all active HeadCode entries grouped by placement.
// No authentication required (used for SSR injection and external consumers).
export async function GET() {
  try {
    const codes = await db.headCode.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        code: true,
        placement: true,
        isActive: true,
        updatedAt: true,
      },
    });
    return Response.json({
      head: codes.filter((c) => c.placement === "head"),
      bodyStart: codes.filter((c) => c.placement === "body_start"),
      bodyEnd: codes.filter((c) => c.placement === "body_end"),
      total: codes.length,
    });
  } catch (e) {
    return apiError(e);
  }
}
