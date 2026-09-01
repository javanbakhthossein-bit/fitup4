import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

/** سقف طول مقدار هر تنظیم دامنه (کاراکتر) */
const MAX_VALUE_LENGTH = 200;

/**
 * وایت‌لیست کلیدهای مجاز — این route فقط تنظیمات دامنه/DNS/ریدایرکت را مدیریت می‌کند
 * (همان کلیدهایی که GET برمی‌گرداند).
 * امنیت (ممیزی 2-c P1): بدون وایت‌لیست، هر کلید SiteSetting (مثل price_basic…ultimate
 * یا gsc_service_account/gsc_cache) قابل بازنویسی بود و اعتبارسنجی‌های route اصلی دور می‌شد.
 */
function isAllowedDomainKey(key: string): boolean {
  return (
    key.startsWith("domain_") ||
    key.startsWith("dns_") ||
    key.startsWith("redirect_") ||
    key === "site_url"
  );
}

/**
 * GET /api/admin/domain
 * دریافت تنظیمات دامنه و رکوردها
 */
export async function GET() {
  try {
    await requireAdmin();
    const settings = await db.siteSetting.findMany({
      where: {
        OR: [
          { key: { startsWith: "domain_" } },
          { key: { startsWith: "dns_" } },
          { key: { startsWith: "redirect_" } },
          { key: "site_url" },
        ],
      },
    });
    const result: Record<string, string> = {};
    settings.forEach((s) => (result[s.key] = s.value));
    return Response.json({ settings: result });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST /api/admin/domain
 * ذخیره تنظیمات دامنه و رکوردها
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== "object") {
      return Response.json({ error: "داده نامعتبر است." }, { status: 400 });
    }

    for (const [key, value] of Object.entries(settings)) {
      // کلید باید در وایت‌لیست تنظیمات دامنه باشد — کلیدهای دیگر (قیمت/کلید GSC/...) قابل نوشتن نیستند
      if (typeof key !== "string" || !isAllowedDomainKey(key)) {
        return Response.json({ error: "کلید تنظیم مجاز نیست" }, { status: 400 });
      }
      const strValue = String(value);
      // سقف طول مقدار — جلوگیری از ذخیره مقادیر چند‌مگابایتی
      if (strValue.length > MAX_VALUE_LENGTH) {
        return Response.json(
          { error: `مقدار تنظیم بیش از حد طولانی است (حداکثر ${MAX_VALUE_LENGTH} کاراکتر).` },
          { status: 400 }
        );
      }
      const existing = await db.siteSetting.findUnique({ where: { key } });
      if (existing) {
        await db.siteSetting.update({ where: { key }, data: { value: strValue } });
      } else {
        await db.siteSetting.create({ data: { key, value: strValue, label: key } });
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
