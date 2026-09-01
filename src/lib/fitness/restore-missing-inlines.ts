/**
 * اسکریپت بازگرداندن inline images گم شده
 *
 * مشکل: اسکریپت fix-article-image-urls.ts قبلاً inline های معتبر را حذف کرده بود.
 * این اسکریپت:
 *  ۱. همه مقالات را بررسی می‌کند
 *  ۲. فایل‌های inline موجود در پوشه را پیدا می‌کند (فایل‌های با pattern image-N-1200x655)
 *  ۳. اگر مقاله inline ندارد ولی فایل inline در پوشه هست، آن را به content اضافه می‌کند
 *
 * Run: bun run src/lib/fitness/restore-missing-inlines.ts
 */
import { db } from "../db";
import { UPLOADS_ROOT } from "./uploads-config";
import { readdir, stat } from "fs/promises";
import path from "path";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * پیدا کردن فایل‌های inline واقعی در پوشه مقاله.
 * inline files have pattern: slug-image-N-WxH.webp (نه cover/thumb/full)
 */
async function findInlineFiles(slug: string): Promise<string[]> {
  const folder = path.join(UPLOADS_ROOT, "articles", slug);
  try {
    const files = await readdir(folder);
    // فقط فایل‌های webp که الگوی inline دارند (image-N یا just N، نه cover/thumb/full)
    return files.filter(f => {
      const lower = f.toLowerCase();
      if (!lower.endsWith(".webp")) return false;
      // Skip cover/thumb/full
      if (lower.includes("-cover-")) return false;
      if (lower.includes("-thumb-")) return false;
      // Inline files: image-1-1200x655, image-2-1200x655, etc.
      if (lower.match(/-image-\d+-\d+x\d+/)) return true;
      // Also check for just -N-WxH pattern (without -image-)
      if (lower.match(/-\d+-\d+x\d+/) && !lower.includes("-full-")) return true;
      return false;
    }).sort(); // مرتب‌سازی برای ترتیب یکسان
  } catch {
    return [];
  }
}

async function main() {
  console.log("🔄 اسکریپت بازگرداندن inline images گم شده\n");
  console.log(`   UPLOADS_ROOT: ${UPLOADS_ROOT}\n`);

  const articles = await db.article.findMany({
    select: { id: true, title: true, slug: true, coverImage: true, content: true, status: true, tags: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📝 ${articles.length} مقاله بررسی شد\n`);

  let restored = 0;
  let noIssue = 0;

  for (const article of articles) {
    // Find inline images in content
    const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    let m;
    const contentInlines: string[] = [];
    while ((m = imgRegex.exec(article.content || "")) !== null) {
      if (m[1].startsWith("http") || m[1].includes("IMAGE_PLACEHOLDER")) continue;
      contentInlines.push(m[1]);
    }

    // Find inline files in folder
    const inlineFiles = await findInlineFiles(article.slug);

    if (inlineFiles.length === 0) {
      noIssue++;
      continue;
    }

    // If content already has inlines, check if all files are used
    if (contentInlines.length > 0) {
      // Check if all inline files are referenced in content
      const allUsed = inlineFiles.every(f =>
        contentInlines.some(url => url.includes(f))
      );
      if (allUsed) {
        noIssue++;
        continue;
      }
    }

    // Missing inlines! Add them to content
    console.log(`━━━ ${article.title.slice(0, 60)} ━━━`);
    console.log(`  slug: ${article.slug} | status: ${article.status}`);
    console.log(`  inline files in folder: ${inlineFiles.length}`);
    console.log(`  inline in content: ${contentInlines.length}`);

    // Find which files are NOT in content
    const missingFiles = inlineFiles.filter(f =>
      !contentInlines.some(url => url.includes(f))
    );

    if (missingFiles.length === 0) {
      noIssue++;
      continue;
    }

    console.log(`  missing files: ${missingFiles.length}`);

    // Add missing inlines to content — after first H2 or H1
    let content = article.content || "";
    const lines = content.split("\n");

    // Find position to insert (after first heading)
    let insertPos = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^#{1,3}\s+/.test(lines[i])) {
        // Find end of this section (next heading or end)
        insertPos = i + 1;
        // Skip a few lines to find a good spot (after first paragraph)
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].trim() === "") {
            insertPos = j + 1;
            break;
          }
        }
        break;
      }
    }

    // Build inline markdown for each missing file
    const keyword = article.tags?.split(",")[0]?.trim() || article.title;
    const newInlines: string[] = [];
    for (let i = 0; i < missingFiles.length; i++) {
      const f = missingFiles[i];
      const url = `/uploads/articles/${article.slug}/${f}`;
      // Verify file exists
      const filePath = path.join(UPLOADS_ROOT, "articles", article.slug, f);
      if (!(await fileExists(filePath))) {
        console.log(`  ⚠ فایل وجود ندارد: ${f}`);
        continue;
      }
      const alt = `${keyword} — تصویر ${i + 1}`;
      const markdown = `\n\n![${alt}](${url})\n\n`;
      newInlines.push(markdown);
      console.log(`  ✅ اضافه شد: ${url}`);
    }

    if (newInlines.length > 0) {
      // Insert inlines at calculated position
      // Distribute them: first after first heading, rest after other headings
      const headingPositions: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^#{2,3}\s+/.test(lines[i])) {
          headingPositions.push(i + 1);
        }
      }

      // Insert each inline at a different heading position
      for (let i = 0; i < newInlines.length; i++) {
        let pos = insertPos;
        if (headingPositions.length > i) {
          pos = headingPositions[Math.min(i + 1, headingPositions.length - 1)];
        }
        // Find next empty line
        for (let j = pos; j < Math.min(pos + 5, lines.length); j++) {
          if (lines[j].trim() === "") {
            pos = j + 1;
            break;
          }
        }
        lines.splice(pos + i, 0, newInlines[i]);
      }

      content = lines.join("\n");

      await db.article.update({
        where: { id: article.id },
        data: { content },
      });
      restored++;
      console.log(`  ✓ دیتابیس به‌روزرسانی شد`);
    } else {
      noIssue++;
    }
  }

  console.log(`\n🎉 تمام!`);
  console.log(`  ✅ بازگردانده شد: ${restored}`);
  console.log(`  ✓ بدون مشکل: ${noIssue}`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
