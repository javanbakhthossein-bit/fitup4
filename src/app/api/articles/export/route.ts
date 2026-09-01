import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireAdmin } from "@/lib/fitness/auth";
import * as XLSX from "xlsx";

const CATEGORY_LABELS: Record<string, string> = {
  general: "عمومی",
  nutrition: "تغذیه",
  training: "تمرین",
  motivation: "انگیزشی",
  news: "اخبار",
};

function stripHtml(html: string): string {
  // حذف تگ‌های HTML برای خوانایی بهتر در Excel
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// GET /api/articles/export — دانلود همه مقالات در یک فایل Excel
// شامل ۲ شیت: خلاصه (لیست) + محتوای کامل
// ⚠️ Admin-only — خروجی ممکن است شامل مقالات draft (استراتژی منتشرنشده) باشد
export async function GET(req: NextRequest) {
  // ─── محافظت ادمین — خروجی شامل مقالات draft است ───
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status === "draft" || status === "published") {
      where.status = status;
    } else {
      where.status = "published";
    }

    const articles = await db.article.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        content: true,
        category: true,
        tags: true,
        status: true,
        coverImage: true,
        readingMinutes: true,
        views: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        author: { select: { name: true } },
      },
    });

    // ─── Sheet 1: لیست خلاصه ───
    const summaryRows = articles.map((a, i) => ({
      "ردیف": i + 1,
      "عنوان": a.title,
      "دسته": CATEGORY_LABELS[a.category] || a.category,
      "برچسب‌ها": a.tags || "",
      "نویسنده": a.author?.name || "—",
      "وضعیت": a.status === "published" ? "منتشر شده" : "پیش‌نویس",
      "زمان مطالعه (دقیقه)": a.readingMinutes || 0,
      "بازدیدها": a.views || 0,
      "تاریخ انتشار": a.publishedAt
        ? new Date(a.publishedAt).toLocaleDateString("fa-IR")
        : a.createdAt
        ? new Date(a.createdAt).toLocaleDateString("fa-IR")
        : "",
      "تاریخ تولید": a.createdAt ? new Date(a.createdAt).toLocaleDateString("fa-IR") : "",
      "آخرین بروزرسانی": a.updatedAt ? new Date(a.updatedAt).toLocaleDateString("fa-IR") : "",
    }));

    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    ws1["!cols"] = [
      { wch: 6 }, { wch: 40 }, { wch: 12 }, { wch: 24 }, { wch: 16 },
      { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    ws1["!views"] = [{ RTL: true }];

    // ─── Sheet 2: محتوای کامل ───
    const contentRows = articles.map((a, i) => ({
      "ردیف": i + 1,
      "عنوان": a.title,
      "دسته": CATEGORY_LABELS[a.category] || a.category,
      "نویسنده": a.author?.name || "—",
      "خلاصه": a.excerpt || "",
      "محتوای کامل": stripHtml(a.content || ""),
      "برچسب‌ها": a.tags || "",
      "لینک کاور": a.coverImage || "",
      "زمان مطالعه": a.readingMinutes || 0,
      "بازدیدها": a.views || 0,
      "تاریخ انتشار": a.createdAt ? new Date(a.createdAt).toLocaleDateString("fa-IR") : "",
    }));

    const ws2 = XLSX.utils.json_to_sheet(contentRows);
    ws2["!cols"] = [
      { wch: 6 }, { wch: 40 }, { wch: 12 }, { wch: 16 }, { wch: 50 },
      { wch: 100 }, { wch: 24 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
    ];
    ws2["!views"] = [{ RTL: true }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "لیست مقالات");
    XLSX.utils.book_append_sheet(wb, ws2, "محتوای کامل");
    if (!wb.Props) wb.Props = {};
    (wb.Props as { Creator?: string }).Creator = "فیتاپ";

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `fitap-articles-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
