import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireAdmin } from "@/lib/fitness/auth";

const VALID_TYPES = ["analytics", "search_console", "pixel", "custom"];
const VALID_PLACEMENTS = ["head", "body_start", "body_end"];
/** سقف طول کد تزریق (کاراکتر) — ممیزی 2-c P2: بدون سقف، اسکریپت چند‌مگابایتی قابل ذخیره بود */
const MAX_CODE_LENGTH = 20_000;

function toDto(c: {
  id: string;
  name: string;
  type: string;
  code: string;
  placement: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    code: c.code,
    placement: c.placement,
    isActive: c.isActive,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// PUT: update a HeadCode entry (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const existing = await db.headCode.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "کد یافت نشد." }, { status: 404 });
    }

    const body = await req.json();
    const data: {
      name?: string;
      type?: string;
      code?: string;
      placement?: string;
      isActive?: boolean;
    } = {};

    if (typeof body.name === "string") {
      const n = body.name.trim();
      if (n.length < 2) {
        return Response.json(
          { error: "نام باید حداقل ۲ کاراکتر باشد." },
          { status: 400 }
        );
      }
      data.name = n;
    }
    if (typeof body.type === "string") {
      if (!VALID_TYPES.includes(body.type)) {
        return Response.json(
          { error: "نوع کد نامعتبر است." },
          { status: 400 }
        );
      }
      data.type = body.type;
    }
    if (typeof body.code === "string") {
      const c = body.code.trim();
      if (c.length < 5) {
        return Response.json(
          { error: "کد را به‌صورت کامل وارد کنید." },
          { status: 400 }
        );
      }
      // سقف طول کد — جلوگیری از ذخیره/سرو کد‌های چند‌مگابایتی (ممیزی 2-c P2)
      if (c.length > MAX_CODE_LENGTH) {
        return Response.json({ error: "کد بیش از حد طولانی است" }, { status: 400 });
      }
      data.code = c;
    }
    if (typeof body.placement === "string") {
      if (!VALID_PLACEMENTS.includes(body.placement)) {
        return Response.json(
          { error: "محل تزریق کد نامعتبر است." },
          { status: 400 }
        );
      }
      data.placement = body.placement;
    }
    if (typeof body.isActive === "boolean") {
      data.isActive = body.isActive;
    }

    const updated = await db.headCode.update({
      where: { id },
      data,
    });

    return Response.json({ code: toDto(updated) });
  } catch (e) {
    return apiError(e);
  }
}

// DELETE: delete a HeadCode entry (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const existing = await db.headCode.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "کد یافت نشد." }, { status: 404 });
    }
    await db.headCode.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
