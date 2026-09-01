import { db } from "@/lib/db";
import { apiError } from "@/lib/fitness/auth";

// GET /api/settings — public site settings (no auth required)
// Returns brandName, slogan, heroTitle, heroSubtitle (NOT primaryColor — that's admin-only)
const PUBLIC_KEYS = ["brandName", "slogan", "heroTitle", "heroSubtitle"];

export async function GET() {
  try {
    const rows = await db.siteSetting.findMany({
      where: { key: { in: PUBLIC_KEYS } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    return Response.json({
      settings: {
        brandName: map.get("brandName") || "فیتاپ",
        slogan: map.get("slogan") || "هر بدنی فیتاپ میخواد",
        heroTitle: map.get("heroTitle") || "بدن ایده‌آلت را با فیتاپ بساز",
        heroSubtitle:
          map.get("heroSubtitle") ||
          "مربی هوشمند، برنامه تمرین و تغذیه اختصاصی، و نظارت حرفه‌ای — همه در یک پلتفرم.",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
