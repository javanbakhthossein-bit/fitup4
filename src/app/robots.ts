import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // مسیرهای API نباید توسط روبات‌های موتور جستجو کرال شوند.
        // این کار از خطای 401 روی /api/pwa/installed و سایر endpointهای محافظت‌شده
        // در Google Search Console جلوگیری می‌کند.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
