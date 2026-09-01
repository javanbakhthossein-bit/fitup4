import { NextRequest } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { UPLOADS_ROOT } from "@/lib/fitness/uploads-config";
import { isPrivateMediaPath, canAccessPrivateMedia } from "@/lib/fitness/private-media";
import { getCurrentUser } from "@/lib/fitness/auth";

/**
 * GET /api/serve-upload/[...path]
 *
 * سرو کردن فایل‌های آپلودشده از مسیر `uploads/` (در ریشه پروژه).
 *
 * پشتیبانی از HTTP Range (206 Partial Content):
 *  - پخش‌کننده‌های ویدیو برای seek کردن و پخش روی iOS نیاز به Range دارند.
 *  - فایل با createReadStream خوانده می‌شود (نه readFile کل فایل) — ویدیوهای
 *    ۵۰MB دیگر کلشان در RAM بافر نمی‌شود و تحت فشار همزمانی memory نمی‌ترکد.
 *
 * مهم: این API route از `uploads-config.ts` استفاده می‌کند (نه `image-processing.ts`)
 * تا `sharp` بارگذاری نشود. `sharp` یک native module است که در standalone ممکن است
 * مشکل داشته باشد (libvips موجود نیست).
 *
 * در `next.config.ts` یک rewrite وجود دارد که `/uploads/*` را به این API هدایت می‌کند.
 *
 * امنیت:
 *  - path traversal مسدود است (بررسی دومرحله‌ای + resolve)
 *  - پوشه‌های مخفی (مثل `.cache`) سرو نمی‌شوند
 *  - رسانه‌های خصوصی (عکس بدن، چت، ویدیو، …) فقط با سشن معتبر + مالکیت
 *    (اطلاعات بیشتر: `src/lib/fitness/private-media.ts`)
 */
/**
 * پارس هدر Range («bytes=0-999» / «bytes=500-» / «bytes=-500»).
 * خروجی: null = هدر نیست/نامعتبر‌فرمت → پاسخ کامل ۲۰۰
 *         "invalid" = بازه غیرممکن (مثلاً شروع ≥ حجم) → 416
 *         {start,end} → پاسخ 206
 */
function parseByteRange(
  header: string | null,
  size: number
): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, s, e] = m;
  if (s === "" && e === "") return null;
  let start: number;
  let end: number;
  if (s === "") {
    // بازه پسوندی: N بایت آخر
    const n = Number.parseInt(e, 10);
    if (!Number.isFinite(n) || n <= 0) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number.parseInt(s, 10);
    end = e === "" ? size - 1 : Math.min(Number.parseInt(e, 10), size - 1);
  }
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start > end ||
    start >= size
  ) {
    return "invalid";
  }
  return { start, end };
}

/** تشخیص content-type از پسوند فایل */
function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".pdf": "application/pdf",
  };
  return contentTypes[ext] || "application/octet-stream";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: pathParts } = await params;
    const requestedPath = pathParts.join("/");

    // امنیت: جلوگیری از path traversal (.. یا absolute paths)
    if (requestedPath.includes("..") || path.isAbsolute(requestedPath)) {
      return new Response("Forbidden", { status: 403 });
    }

    // امنیت: پوشه‌های مخفی (مثل .cache — کش آینه‌ای پشتیبان) سرو نمی‌شوند
    if (requestedPath.split("/").some((p) => p.startsWith("."))) {
      return new Response("Not found", { status: 404 });
    }

    // ─── رسانه خصوصی: احراز هویت + مالکیت ───
    // مقالات (`articles/`) محتوای عمومی‌اند؛ بقیه دسته‌ها خصوصی‌اند.
    const isPrivate = isPrivateMediaPath(requestedPath);
    let isPrivateFile = false;
    if (isPrivate) {
      const viewer = await getCurrentUser();
      if (!viewer) {
        return new Response("Unauthorized", {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        });
      }
      const allowed = await canAccessPrivateMedia(viewer, requestedPath);
      if (!allowed) {
        return new Response("Forbidden", {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        });
      }
      isPrivateFile = true;
    }

    const filePath = path.join(UPLOADS_ROOT, requestedPath);

    // بررسی اینکه filePath واقعاً داخل UPLOADS_ROOT است (path traversal نهایی)
    const resolvedPath = path.resolve(filePath);
    const resolvedRoot = path.resolve(UPLOADS_ROOT);
    if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
      return new Response("Forbidden", { status: 403 });
    }

    // بررسی وجود فایل + حجم آن
    let fileSize = 0;
    try {
      const s = await stat(filePath);
      if (!s.isFile()) {
        return new Response("Not found", { status: 404 });
      }
      fileSize = s.size;
    } catch {
      return new Response("Not found", { status: 404 });
    }

    const contentType = contentTypeFor(filePath);

    // Cache headers:
    //  - محتوای عمومی (مقالات): immutable — URL شامل hash/timestamp است
    //  - رسانه خصوصی: فقط کش مرورگر خود کاربر (private) — نه CDN، نه proxy مشترک
    const cacheControl = isPrivateFile
      ? "private, max-age=86400"
      : "public, max-age=31536000, immutable";

    // ─── پشتیبانی از HTTP Range (206) — برای seek ویدیو و پخش iOS ───
    const range = parseByteRange(req.headers.get("range"), fileSize);
    if (range === "invalid") {
      return new Response("Range Not Satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileSize}`,
          "Cache-Control": cacheControl,
        },
      });
    }

    if (range) {
      const { start, end } = range;
      const stream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": cacheControl,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // پاسخ کامل — استریم (نه readFile) تا فایل‌های بزرگ در RAM بافر نشوند
    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[serve-upload] Error:", e);
    return new Response("Internal server error", { status: 500 });
  }
}
