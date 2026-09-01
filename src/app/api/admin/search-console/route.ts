/**
 * GET  /api/admin/search-console — داده‌های سرچ کنسول (کش ۲۴ ساعته — T6)
 * POST /api/admin/search-console — { action: "save-config" | "refresh" }
 *
 * action=save-config: { saJson, siteUrl, apiKey? } — ذخیره سرویس‌اکانت + آدرس سایت
 * action=refresh:      داده‌ها را با force از API گوگل واکشی می‌کند (سقف ساعتی دارد)
 */
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import {
  getSearchConsoleData,
  saveGscConfig,
  testGscConnection,
} from "@/lib/fitness/search-console";

export async function GET() {
  try {
    await requireAdmin();
    const res = await getSearchConsoleData(false); // همیشه از کش تازه
    return Response.json(
      {
        ok: res.ok,
        error: res.error,
        status: res.status,
        data: res.data ?? null,
      },
      { status: res.ok ? 200 : res.status.configured ? 502 : 200 }
    );
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      action?: string;
      saJson?: string;
      siteUrl?: string;
      apiKey?: string;
    };

    if (body.action === "save-config") {
      const result = await saveGscConfig(body.saJson ?? "", body.siteUrl ?? "", body.apiKey);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 400 });
      }
      // تشخیص خودکار مرحله‌به‌مرحله: کلید؟ توکن؟ API فعال؟ دسترسی؟ فرمت پراپرتی؟
      // خطاها را دقیق و فارسی برمی‌گرداند + فرمت پراپرتی را اگر لازم بود خودش اصلاح می‌کند.
      const test = await testGscConnection();
      return Response.json({
        ok: true,
        message: test.ok
          ? `پیکربندی ذخیره شد و ${test.message}`
          : `پیکربندی ذخیره شد اما اتصال آزمایشی ناموفق بود: ${test.message}`,
        testOk: test.ok,
        resolvedSiteUrl: test.resolvedSiteUrl ?? null,
        availableSites: test.availableSites ?? [],
        data: null,
        status: test.ok ? { configured: true, siteUrl: test.resolvedSiteUrl ?? null } : undefined,
      });
    }

    if (body.action === "test") {
      const test = await testGscConnection();
      return Response.json({
        ok: test.ok,
        testOk: test.ok,
        message: test.message,
        resolvedSiteUrl: test.resolvedSiteUrl ?? null,
        availableSites: test.availableSites ?? [],
      });
    }

    if (body.action === "refresh") {
      const res = await getSearchConsoleData(true);
      return Response.json(
        {
          ok: res.ok,
          error: res.error,
          data: res.data ?? null,
          status: res.status,
        },
        { status: res.ok ? 200 : 502 }
      );
    }

    return Response.json({ error: "action نامعتبر است (save-config | test | refresh)" }, { status: 400 });
  } catch (e) {
    return apiError(e);
  }
}
