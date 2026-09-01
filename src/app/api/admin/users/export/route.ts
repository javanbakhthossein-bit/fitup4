import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import * as XLSX from "xlsx";

const PLAN_LABELS: Record<string, string> = {
  basic: "اقتصادی",
  standard: "استاندارد",
  advanced: "پیشرفته",
  ultimate: "حرفه‌ای",
};

function toJalali(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const plan = searchParams.get("plan") || "";
    const onboarding = searchParams.get("onboarding") || "";
    const now = new Date();

    const where: any = {};
    if (search) {
      where.OR = [{ mobile: { contains: search } }, { name: { contains: search } }];
    }
    if (role && role !== "all") where.role = role;
    if (plan && plan !== "all") {
      where.planName = plan === "none" ? null : plan;
    }
    if (onboarding === "done") where.onboardingDone = true;
    if (onboarding === "pending") where.onboardingDone = false;

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        mobile: true,
        name: true,
        role: true,
        isBlocked: true,
        onboardingDone: true,
        createdAt: true,
        planName: true,
        walletBalance: true,
        planExpiresAt: true,
      },
    });

    const userIds = users.map((u) => u.id);
    const subs = await db.subscription.findMany({
      where: { userId: { in: userIds }, status: "active", endDate: { gt: now } },
    });
    const subMap = new Map(subs.map((s) => [s.userId, s]));

    const rows = users.map((u, i) => ({
      "ردیف": i + 1,
      "نام": u.name || "بدون نام",
      "شماره موبایل": u.mobile,
      "نقش": u.role === "ADMIN" ? "ادمین" : "ورزشکار",
      "پلن": u.planName ? (PLAN_LABELS[u.planName] || u.planName) : "بدون پلن",
      "انقضای پلن": toJalali(u.planExpiresAt?.toISOString() ?? null),
      "اشتراک فعال": subMap.has(u.id) ? "بله" : "خیر",
      "کیف پول (تومان)": u.walletBalance || 0,
      "آنبوردینگ": u.onboardingDone ? "انجام شده" : "انجام نشده",
      "مسدود": u.isBlocked ? "بله" : "خیر",
      "تاریخ ثبت‌نام": toJalali(u.createdAt.toISOString()),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // RTL + column widths
    ws["!cols"] = [
      { wch: 6 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
    ];
    ws["!views"] = [{ RTL: true }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "کاربران");
    if (!wb.Props) wb.Props = {};
    (wb.Props as Record<string, unknown>).Creator = "فیتاپ";

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `fitap-users-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
