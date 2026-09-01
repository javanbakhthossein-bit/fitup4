import { db } from "@/lib/db";

/**
 * GET /api/app/version — اطلاعات نسخه اپ اندروید کافه‌بازار (عمومی)
 *
 * اپ در هر اجرا این endpoint را صدا می‌زند:
 *  - اگر versionCode اپ < app_min_version_code → دیالوگ «به‌روزرسانی اجباری»
 *    (غیرقابل رد) با دکمه باز کردن صفحه برنامه در بازار
 *  - اگر versionCode اپ < app_latest_version_code → یادآور ملایم اختیاری
 *
 * ادمین این دو عدد را از پنل مدیریت (تنظیمات) تغییر می‌دهد:
 *  - SiteSetting: app_latest_version_code (کد آخرین نسخه منتشرشده)
 *  - SiteSetting: app_min_version_code (حداقل نسخه قابل قبول)
 *
 * نکته: هر تغییر native در اپ (کلید RSA، دامنه، SDK) یعنی باید versionCode
 * بالا برود و app_latest_version_code اپدیت شود؛ تغییرات وب (سایت) خودکار
 * به اپ می‌رسند چون WebView همیشه HTML تازه می‌گیرد (_next assetها hash دارند).
 */
const BAZAAR_APP_PAGE = "https://cafebazaar.ir/app/ir.fittup.app";

function parseVersionCode(v: string | undefined | null, fallback: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 1_000_000) return fallback;
  return n;
}

function versionPayload(latest: number, min: number) {
  return {
    latestVersionCode: latest,
    minVersionCode: Math.min(min, latest),
    updateUrl: BAZAAR_APP_PAGE,
    // متن فارسی برای دیالوگ native — بدون نیاز به hardcoded string در اپ
    forceUpdateTitle: "به‌روزرسانی لازم است",
    forceUpdateBody:
      "برای ادامه استفاده از فیتاپ، لطفاً نسخه جدید برنامه را از کافه‌بازار نصب کنید.",
  };
}

export async function GET() {
  try {
    const rows = await db.siteSetting.findMany({
      where: { key: { in: ["app_latest_version_code", "app_min_version_code"] } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const latest = parseVersionCode(map.get("app_latest_version_code"), 1);
    const min = parseVersionCode(map.get("app_min_version_code"), 1);

    return Response.json(versionPayload(latest, min), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // DB در دسترس نیست — پاسخ امن پیش‌فرض (هیچ آپدیت اجباری‌ای اعمال نشود)
    return Response.json(versionPayload(1, 1), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
