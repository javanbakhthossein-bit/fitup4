import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // ─── Type-check در build ───
  // قبلاً ignoreBuildErrors: true بود و خطاهای تایپ بی‌صدا به production
  // می‌رفتند. همه خطاهای تایپ اپ رفع شدند (examples/ و mini-services/ از
  // tsconfig خارج شدند) — از این به بعد build با خطای تایپ fail می‌شود
  // که همین رفتار درست است: باگ قبل از رسیدن به کاربر گرفته می‌شود.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  // ─── Native binaries for standalone output ───
  // sharp و باینری‌های libvips آن (@img/*) باید به‌طور کامل در خروجی
  // standalone حضور داشته باشند. tracer پیش‌فرض فقط wrapper جاوااسکریپتی
  // را کپی می‌کند و فایل‌های .so (libvips) را جا می‌اندازد → در production
  // همه routeهای تصویر (تولید کاور/inline مقالات، آپلود، واترمارک) با خطای
  // ERR_DLOPEN_FAILED می‌افتادند. این خط آن باگ production بود.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
  // Allow cross-origin dev requests (for preview panel)
  allowedDevOrigins: ["*.space-z.ai"],
  // ─── Redirects ───
  // مهم: /auth به /?screen=auth هدایت می‌شود با ۳۰۱ (Permanent Redirect).
  // قبلاً از redirect() در page.tsx استفاده می‌کردیم که ۳۰۷ (Temporary) می‌داد
  // و HTML شامل <meta name="next-error" content="not-found"/> بود — گوگل آن را ۴۰۴ تفسیر می‌کرد.
  // با redirects() در next.config.ts، redirect در سطح سرور انجام می‌شود بدون رندر HTML.
  async redirects() {
    return [
      {
        source: "/auth",
        destination: "/?screen=auth",
        permanent: true, // ۳۰۱ — دائمی
      },
    ];
  },
  // ─── Rewrites ───
  // مهم: تمام درخواست‌های `/uploads/*` به API route `/api/serve-upload/*` هدایت می‌شوند.
  // این کار از از دست رفتن عکس‌ها در زمان build جلوگیری می‌کند، چون عکس‌ها در
  // `uploads/` (در ریشه پروژه) ذخیره می‌شوند — نه در `public/` که در build overwrite می‌شود.
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/serve-upload/:path*",
      },
    ];
  },
  // ─── Browser caching for faster load ───
  // (FULL-PROFILE-AI-CONTEXT-WORKOUT) Static assets are cached aggressively;
  // HTML pages are NEVER cached (always fresh).
  // ⚠️ ترتیب مهم است: در Next.js برای هدرهای هم‌نام، «آخرین» قانونِ منطبق
  // برنده می‌شود — پس قانون عمومی no-cache باید «اول» بیاید و قوانین خاص
  // (uploads/fonts/manifest/...) بعد از آن تا بازنویسی کنند.
  async headers() {
    return [
      {
        // HTML pages — no-cache allows bfcache (back/forward cache) while still revalidating.
        // no-store prevents bfcache which hurts performance. Using no-cache instead.
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
      {
        // Next.js static build assets — hashed filenames, safe to cache forever
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // User-uploaded media (chat images, body photos, blood tests)
        // ⚠️ این فایل‌ها خصوصی‌اند و از طریق /api/serve-upload با auth سرو
        // می‌شوند — Cache-Control باید private باشد تا proxy/CDN عمومی
        // عکس‌های بدن/آزمایش خون کاربران را کش نکند.
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "private, max-age=86400" },
        ],
      },
      {
        // Local fonts (Vazirmatn) — never change, cache forever
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Manifest — 1 day cache
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        // Sitemap & robots.txt — cache 1 hour (Google needs fast response, not fresh)
        source: "/sitemap.xml",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
