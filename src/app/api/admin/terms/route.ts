import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireAdmin } from "@/lib/fitness/auth";

// GET: list all TermsVersions (admin only)
export async function GET() {
  try {
    await requireAdmin();
    const versions = await db.termsVersion.findMany({
      orderBy: { version: "desc" },
    });
    return Response.json({
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        title: v.title,
        content: v.content,
        isActive: v.isActive,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST: create a new TermsVersion (admin only)
// - Auto-increment version number based on max existing version
// - Deactivate previous active version(s) if the new one is active
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const title = String(body.title || "شرایط و قوانین فیت‌آپ").trim();
    const content = String(body.content || "").trim();
    const isActive = body.isActive !== false; // default true

    if (!title || title.length < 3) {
      return Response.json(
        { error: "عنوان باید حداقل ۳ کاراکتر باشد." },
        { status: 400 }
      );
    }
    if (!content || content.length < 10) {
      return Response.json(
        { error: "محتوای قوانین را کامل کنید." },
        { status: 400 }
      );
    }

    // Determine the next version number
    const latest = await db.termsVersion.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const newVersion = (latest?.version ?? 0) + 1;

    // Deactivate previous active versions if this one is active
    if (isActive) {
      await db.termsVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    const created = await db.termsVersion.create({
      data: {
        version: newVersion,
        title,
        content,
        isActive,
      },
    });

    return Response.json({
      terms: {
        id: created.id,
        version: created.version,
        title: created.title,
        content: created.content,
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
