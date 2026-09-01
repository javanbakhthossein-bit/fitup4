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

// GET: list all HeadCode entries (admin only)
export async function GET() {
  try {
    await requireAdmin();
    const codes = await db.headCode.findMany({
      orderBy: [{ createdAt: "asc" }],
    });
    return Response.json({ codes: codes.map(toDto) });
  } catch (e) {
    return apiError(e);
  }
}

// POST: create a new HeadCode entry (admin only)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const name = String(body.name || "").trim();
    const type = String(body.type || "custom").trim();
    const code = String(body.code || "").trim();
    const placement = String(body.placement || "head").trim();
    const isActive = body.isActive !== false; // default true

    if (!name || name.length < 2) {
      return Response.json(
        { error: "نام باید حداقل ۲ کاراکتر باشد." },
        { status: 400 }
      );
    }
    if (!VALID_TYPES.includes(type)) {
      return Response.json(
        { error: "نوع کد نامعتبر است." },
        { status: 400 }
      );
    }
    if (!VALID_PLACEMENTS.includes(placement)) {
      return Response.json(
        { error: "محل تزریق کد نامعتبر است." },
        { status: 400 }
      );
    }
    if (!code || code.length < 5) {
      return Response.json(
        { error: "کد را به‌صورت کامل وارد کنید." },
        { status: 400 }
      );
    }
    // سقف طول کد — جلوگیری از ذخیره/سرو کد‌های چند‌مگابایتی (ممیزی 2-c P2)
    if (code.length > MAX_CODE_LENGTH) {
      return Response.json({ error: "کد بیش از حد طولانی است" }, { status: 400 });
    }

    const created = await db.headCode.create({
      data: { name, type, code, placement, isActive },
    });

    return Response.json({ code: toDto(created) });
  } catch (e) {
    return apiError(e);
  }
}
