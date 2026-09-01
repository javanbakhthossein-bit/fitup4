import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

const KEYS = [
  { key: "coach_system_prompt", label: "پرامپت مربی (ساخت برنامه تمرینی)" },
  { key: "chat_system_prompt", label: "پرامپت چت هوشمند" },
  { key: "nutrition_system_prompt", label: "پرامپت برنامه غذایی" },
];

export async function GET() {
  try {
    await requireAdmin();
    const configs = await db.aiConfig.findMany();
    const map = new Map(configs.map((c) => [c.key, c]));
    return Response.json({
      configs: KEYS.map((k) => ({
        ...k,
        id: map.get(k.key)?.id ?? null,
        value: map.get(k.key)?.value ?? "",
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const { key, value } = await req.json();
    const meta = KEYS.find((k) => k.key === key);
    if (!meta) return Response.json({ error: "کلید نامعتبر." }, { status: 400 });

    const cfg = await db.aiConfig.upsert({
      where: { key },
      create: { key, value, label: meta.label },
      update: { value },
    });
    return Response.json({ config: cfg });
  } catch (e) {
    return apiError(e);
  }
}
