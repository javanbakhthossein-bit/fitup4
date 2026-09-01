import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { UPLOADS_ROOT } from "@/lib/fitness/uploads-config";
import fs from "fs";
import path from "path";

/**
 * GET /api/articles/health
 *
 * Admin-only diagnostic endpoint that checks the integrity of all published articles:
 *  - Does each article have a cover image file on disk?
 *  - Do all inline (markdown) images exist on disk?
 *  - Are there any articles with empty content or missing required fields?
 *
 * عکس‌ها در `uploads/` (در ریشه پروژه) ذخیره می‌شوند — نه در public.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const articles = await db.article.findMany({
      where: { status: "published" },
      select: {
        id: true,
        title: true,
        slug: true,
        coverImage: true,
        content: true,
        category: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const missingImages: { slug: string; type: "cover" | "inline"; url: string }[] = [];
    const issues: { slug: string; issue: string }[] = [];
    let totalImages = 0;

    for (const a of articles) {
      // Check cover image
      if (a.coverImage) {
        totalImages++;
        const coverPath = path.join(UPLOADS_ROOT, a.coverImage.replace(/^\/uploads\//, ""));
        if (!fs.existsSync(coverPath)) {
          missingImages.push({ slug: a.slug, type: "cover", url: a.coverImage });
        }
      } else {
        issues.push({ slug: a.slug, issue: "برای این مقاله تصویر کاور تنظیم نشده است" });
      }

      // Check inline images in markdown content
      const inlineRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
      let match;
      while ((match = inlineRegex.exec(a.content)) !== null) {
        const url = match[1];
        // Skip external URLs and placeholders
        if (url.startsWith("http://") || url.startsWith("https://")) continue;
        if (url.includes("IMAGE_PLACEHOLDER")) continue;
        totalImages++;
        const imgPath = path.join(UPLOADS_ROOT, url.replace(/^\/uploads\//, ""));
        if (!fs.existsSync(imgPath)) {
          missingImages.push({ slug: a.slug, type: "inline", url });
        }
      }

      // Check for empty content
      if (!a.content || a.content.trim().length < 50) {
        issues.push({ slug: a.slug, issue: "محتوای مقاله خیلی کوتاه است" });
      }
    }

    // Check if the uploads directory exists at all
    const uploadsDir = path.join(UPLOADS_ROOT, "articles");
    const uploadsExists = fs.existsSync(uploadsDir);

    return Response.json({
      status: missingImages.length === 0 && issues.length === 0 ? "healthy" : "issues",
      totalArticles: articles.length,
      totalImages,
      missingImagesCount: missingImages.length,
      missingImages: missingImages.slice(0, 50), // limit to first 50
      issuesCount: issues.length,
      issues: issues.slice(0, 50),
      checks: {
        uploadsDirExists: uploadsExists,
        uploadsDirPath: uploadsDir,
        uploadsRootPath: UPLOADS_ROOT,
        cwd: process.cwd(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
