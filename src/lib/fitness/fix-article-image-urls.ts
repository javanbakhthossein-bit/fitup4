/**
 * اسکریپت اصلاح URL‌های عکس در دیتابیس
 *
 * دو مشکل را رفع می‌کند:
 *
 * ۱. URL‌های گم شده: اگر coverImage یا inline URL به فایلی اشاره کند که موجود نیست،
 *    فایل مشابه را پیدا کرده و URL را اصلاح می‌کند.
 *
 * ۲. inline == cover: اگر یک تصویر inline در content مقاله همان URL کاور باشد
 *    (یعنی یک عکس هم به‌عنوان کاور و هم به‌عنوان inline استفاده شده)، آن inline
 *    را از content حذف می‌کند.
 *
 * مهم: برای inline، هرگز cover یا thumb را جایگزین نمی‌کنیم. اگر فایل inline
 * واقعی پیدا نشد، آن inline را از content حذف می‌کنیم.
 *
 * Run: bun run src/lib/fitness/fix-article-image-urls.ts
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

async function listFilesInDir(dirPath: string): Promise<string[]> {
  try {
    return await readdir(dirPath);
  } catch {
    return [];
  }
}

function findSimilarCoverFile(files: string[], originalName: string): string | null {
  const webpFiles = files.filter((f) => f.toLowerCase().endsWith(".webp"));
  const sizeMatch = originalName.match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const size = `${sizeMatch[1]}x${sizeMatch[2]}`;
    const exact = webpFiles.find((f) => f.toLowerCase().includes(`cover-${size}`));
    if (exact) return exact;
  }
  const coverFile = webpFiles.find((f) => f.toLowerCase().includes("-cover-"));
  if (coverFile) return coverFile;
  const fullFile = webpFiles.find((f) => f.toLowerCase().includes("-full-"));
  if (fullFile) return fullFile;
  return null;
}

function findSimilarInlineFile(files: string[], originalName: string): string | null {
  const webpFiles = files.filter((f) => f.toLowerCase().endsWith(".webp"));
  const sizeMatch = originalName.match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const size = `${sizeMatch[1]}x${sizeMatch[2]}`;
    const exact = webpFiles.find(
      (f) => f.toLowerCase().includes(`full-${size}`) && !f.toLowerCase().includes("-cover-") && !f.toLowerCase().includes("-thumb-")
    );
    if (exact) return exact;
  }
  const fullFile = webpFiles.find(
    (f) => f.toLowerCase().includes("-full-") && !f.toLowerCase().includes("-cover-") && !f.toLowerCase().includes("-thumb-")
  );
  if (fullFile) return fullFile;
  const inlineFile = webpFiles.find(
    (f) => !f.toLowerCase().includes("-cover-") && !f.toLowerCase().includes("-thumb-")
  );
  if (inlineFile) return inlineFile;
  return null;
}

async function fixCoverImage(article: any): Promise<boolean> {
  if (!article.coverImage) return false;
  const relativePath = article.coverImage.replace(/^\/uploads\//, "");
  const filePath = path.join(UPLOADS_ROOT, relativePath);
  if (await fileExists(filePath)) return false;

  const folder = path.join(UPLOADS_ROOT, "articles", article.slug);
  const files = await listFilesInDir(folder);
  if (files.length === 0) {
    console.log(`  ❌ پوشه مقاله خالی است: ${folder}`);
    return false;
  }
  const fileName = path.basename(relativePath);
  const similar = findSimilarCoverFile(files, fileName);
  if (similar) {
    const newUrl = `/uploads/articles/${article.slug}/${similar}`;
    console.log(`  🔧 اصلاح کاور: ${article.coverImage} → ${newUrl}`);
    await db.article.update({
      where: { id: article.id },
      data: { coverImage: newUrl, ogImage: newUrl },
    });
    return true;
  }
  console.log(`  ⚠ فایل مشابه برای کاور پیدا نشد: ${fileName}`);
  return false;
}

/**
 * بررسی می‌کند که آیا فایل inline از همان عکس کاور است.
 *
 * فقط فایل‌های cover/thumb/full از یک عکس اصلی را یکسان می‌داند.
 * inline های با index (image-1, image-2) هرگز با cover یکسان فرض نمی‌شوند
 * چون آن‌ها عکس‌های متفاوتی هستند.
 */
function isSameImageAsCover(inlineUrl: string, coverUrl: string, slug: string): boolean {
  if (!inlineUrl || !coverUrl) return false;
  if (inlineUrl === coverUrl) return true;

  const inlineFile = inlineUrl.split("/").pop() || "";
  const coverFile = coverUrl.split("/").pop() || "";

  // اگر inline شامل -image-N- یا -N- (با index) است، آن inline واقعی است، نه cover
  if (inlineFile.match(/-image-\d+-\d+x\d+/i)) return false;
  if (inlineFile.match(/-\d+-\d+x\d+/i) && !inlineFile.includes("-full-")) return false;

  // اگر inline شامل -full- است و cover شامل -cover- است (از همان عکس)
  // بررسی: حذف -cover-XXX / -full-XXX و مقایسه بقیه
  const inlineBase = inlineFile
    .replace(/\.(webp|png|jpg|jpeg)$/i, "")
    .replace(new RegExp(`^${slug}-?`), "")
    .replace(/-?(cover|thumb|full)-\d+x\d+/gi, "")
    .replace(/-image/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  const coverBase = coverFile
    .replace(/\.(webp|png|jpg|jpeg)$/i, "")
    .replace(new RegExp(`^${slug}-?`), "")
    .replace(/-?(cover|thumb|full)-\d+x\d+/gi, "")
    .replace(/-image/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  // اگر base name ها یکی هستند → همان عکس اصلی (cover/thumb/full variants)
  if (inlineBase && coverBase && inlineBase === coverBase) {
    return true;
  }

  return false;
}

async function fixInlineImages(article: any): Promise<boolean> {
  if (!article.content) return false;
  let content = article.content;
  let fixed = false;

  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches: { alt: string; url: string; fullMatch: string }[] = [];
  let m;
  while ((m = imgRegex.exec(content)) !== null) {
    matches.push({ alt: m[1], url: m[2], fullMatch: m[0] });
  }

  // ─── ردیابی URL های دیده‌شده برای حذف تکراری‌ها ───
  const seenUrls = new Set<string>();

  // NOTE: منطق «فقط یک عکس اصلی» حذف شد چون خطرناک بود.
  // قبلاً بررسی می‌کرد که آیا فقط یک عکس اصلی در پوشه هست و اگر بود، همه inline ها را حذف می‌کرد.
  // ولی این الگوریتم اشتباه بود: فایل‌های inline با index (image-1, image-2) بعد از حذف index
  // و ابعاد، base name خالی می‌شدند و با cover یکسان فرض می‌شدند.
  // این باعث می‌شد inline های معتبر (که واقعاً متفاوت از cover بودند) حذف شوند.

  const folder = path.join(UPLOADS_ROOT, "articles", article.slug);

  for (const img of matches) {
    if (img.url.startsWith("http://") || img.url.startsWith("https://")) continue;
    if (img.url.includes("IMAGE_PLACEHOLDER")) continue;

    // ─── بررسی ۱: آیا inline با cover یکی است (URL یکسان)؟ ───
    if (article.coverImage && img.url === article.coverImage) {
      console.log(`  🗑 حذف inline (با cover یکی است): ${img.url}`);
      content = content.replace(img.fullMatch, "");
      fixed = true;
      continue;
    }

    // ─── بررسی ۲: آیا inline از همان عکس کاور است (حتی با فایل متفاوت)؟ ───
    // فقط اگر URL دقیقاً همان فایل کاور باشد (مثلاً -cover- و -full- از یک عکس)
    if (article.coverImage && isSameImageAsCover(img.url, article.coverImage, article.slug)) {
      console.log(`  🗑 حذف inline (همان عکس کاور با سایز متفاوت): ${img.url}`);
      content = content.replace(img.fullMatch, "");
      fixed = true;
      continue;
    }

    // ─── بررسی ۳: آیا این inline URL قبلاً دیده شده (تکراری)؟ ───
    if (seenUrls.has(img.url)) {
      console.log(`  🗑 حذف inline تکراری: ${img.url}`);
      content = content.replace(img.fullMatch, "");
      fixed = true;
      continue;
    }
    seenUrls.add(img.url);

    const relativePath = img.url.replace(/^\/uploads\//, "");
    const filePath = path.join(UPLOADS_ROOT, relativePath);

    if (await fileExists(filePath)) {
      continue;
    }

    const files = await listFilesInDir(folder);
    if (files.length === 0) continue;

    const fileName = path.basename(relativePath);
    const similar = findSimilarInlineFile(files, fileName);

    if (similar) {
      const newUrl = `/uploads/articles/${article.slug}/${similar}`;
      if (article.coverImage && newUrl === article.coverImage) {
        console.log(`  🗑 حذف inline (فایل مشابه = cover): ${img.url}`);
        content = content.replace(img.fullMatch, "");
        fixed = true;
      } else if (article.coverImage && isSameImageAsCover(newUrl, article.coverImage, article.slug)) {
        console.log(`  🗑 حذف inline (فایل مشابه = همان عکس کاور): ${img.url} → ${newUrl}`);
        content = content.replace(img.fullMatch, "");
        fixed = true;
      } else if (seenUrls.has(newUrl)) {
        console.log(`  🗑 حذف inline (فایل مشابه تکراری): ${img.url} → ${newUrl}`);
        content = content.replace(img.fullMatch, "");
        fixed = true;
      } else {
        seenUrls.add(newUrl);
        const replacement = `![${img.alt}](${newUrl})`;
        content = content.replace(img.fullMatch, replacement);
        fixed = true;
        console.log(`  🔧 اصلاح inline: ${img.url} → ${newUrl}`);
      }
    } else {
      console.log(`  🗑 حذف inline (فایل پیدا نشد): ${img.url}`);
      content = content.replace(img.fullMatch, "");
      fixed = true;
    }
  }

  if (fixed) {
    await db.article.update({
      where: { id: article.id },
      data: { content },
    });
  }
  return fixed;
}

async function main() {
  console.log("🔧 اسکریپت اصلاح URL‌های عکس در دیتابیس\n");
  console.log(`   UPLOADS_ROOT: ${UPLOADS_ROOT}\n`);

  const articles = await db.article.findMany({
    select: { id: true, title: true, slug: true, coverImage: true, content: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📝 ${articles.length} مقاله بررسی شد\n`);

  let coverFixed = 0;
  let inlineFixed = 0;
  let noIssue = 0;

  for (const article of articles) {
    console.log(`━━━ ${article.title.slice(0, 60)} ━━━`);
    const coverWasFixed = await fixCoverImage(article);
    const inlineWasFixed = await fixInlineImages(article);
    if (coverWasFixed) coverFixed++;
    if (inlineWasFixed) inlineFixed++;
    if (!coverWasFixed && !inlineWasFixed) {
      console.log(`  ✅ همه عکس‌ها موجود هستند`);
      noIssue++;
    }
  }

  console.log(`\n🎉 تمام!`);
  console.log(`  🔧 کاور اصلاح شد: ${coverFixed}`);
  console.log(`  🔧 inline اصلاح/حذف شد: ${inlineFixed}`);
  console.log(`  ✅ بدون مشکل: ${noIssue}`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
