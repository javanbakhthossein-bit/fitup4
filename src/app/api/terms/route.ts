import { db } from "@/lib/db";
import { apiError } from "@/lib/fitness/auth";

// Public endpoint — returns the active (latest) TermsVersion
export async function GET() {
  try {
    const terms = await db.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
    });
    if (!terms) {
      return Response.json(
        { error: "نسخه فعلی قوانین یافت نشد.", terms: null },
        { status: 404 }
      );
    }
    return Response.json({
      terms: {
        id: terms.id,
        version: terms.version,
        title: terms.title,
        content: terms.content,
        isActive: terms.isActive,
        createdAt: terms.createdAt,
        updatedAt: terms.updatedAt,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
