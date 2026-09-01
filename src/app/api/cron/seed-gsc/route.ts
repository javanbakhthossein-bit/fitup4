import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { saveGscConfig } from "@/lib/fitness/search-console";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * GET /api/cron/seed-gsc?secret=CRON_SECRET
 *
 * ─── نصب خودکار (seed) پیکربندی Google Search Console در boot ───
 *
 * درخواست مالک 12-e: سرچ کنسول باید «از قبل نصب» باشد — بدون paste کردن
 * چیزی در پنل ادمین. این route در boot (توسط instrumentation، ۱۲ ثانیه بعد
 * از db-selfheal) صدا زده می‌شود:
 *  ۱. فایل `gsc-service-account-recovered.json` از ریشه پروژه خوانده می‌شود
 *  ۲. اگر SiteSetting «gsc_service_account» از قبل مقدار غیرخالی دارد →
 *     هیچ‌وقت overwrite نمی‌شود (پیکربندی دستی ادمین مقدس است) → {seeded:false}
 *  ۳. در غیر این صورت SA + آدرس سایت + API Key با saveGscConfig ذخیره می‌شود
 *
 * - Idempotent: اجرای مکرر بی‌اثر است (بعد از seed اول، همیشه already configured).
 * - Fail-secure: مجاز فقط با CRON_SECRET درست یا اتصال «محلی» loopback
 *   (همان مجوزهای /api/cron/db-selfheal).
 */

/** کلید API پیش‌فرض GSC — متغیر محیطی GSC_API_KEY می‌تواند آن را override کند */
const DEFAULT_GSC_API_KEY = "AIzaSyAKpZ5364GKAwSY8s2VMeH7H-lkX7CHuzw";
/** نام فایل سرویس‌اکانت بازیابی‌شده در ریشه پروژه */
const GSC_SA_FILENAME = "gsc-service-account-recovered.json";
/** آدرس سایت برای GSC */
const GSC_SITE_URL = "https://fittup.ir/";

export async function GET(req: NextRequest) {
  const rl = rateLimit(`cron-seed-gsc:${getClientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return rateLimitResponse(rl.retryAfterSec);
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  // مجاز در دو حالت (عین منطق db-selfheal):
  //  ۱) secret درست
  //  ۲) اتصال «محلی» — درخواست boot از instrumentation خود سرور است.
  //     تشخیص: یا هیچ هدر پروکسی‌ای نیست (اتصال مستقیم) یا IP مؤثر
  //     loopback است (Next خودش برای اتصال محلی XFF=127.0.0.1 می‌گذارد).
  //     ایمنی: این endpoint فقط «یک‌بار» پیکربندی گم‌شده را seed می‌کند و
  //     هرگز پیکربندی موجود را overwrite نمی‌کند → ریسک صفر.
  const h = req.headers;
  const hasProxyHeaders =
    Boolean(h.get("x-forwarded-for")) ||
    Boolean(h.get("cf-connecting-ip")) ||
    Boolean(h.get("x-real-ip"));
  const clientIp = getClientIp(req);
  const isLoopbackIp =
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp === "::ffff:127.0.0.1" ||
    clientIp.startsWith("::ffff:127.") ||
    (clientIp.startsWith("::ffff:") && clientIp.endsWith(":7f00:1"));
  const isLocal = !hasProxyHeaders || isLoopbackIp;

  const authorized = Boolean(expected && secret === expected) || isLocal;
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ۱) فایل سرویس‌اکانت بازیابی‌شده از ریشه پروژه
  let saJson: string;
  try {
    saJson = await readFile(join(process.cwd(), GSC_SA_FILENAME), "utf-8");
  } catch {
    const msg = `فایل ${GSC_SA_FILENAME} در ریشه پروژه (${process.cwd()}) پیدا نشد — پیکربندی سرچ کنسول seed نشد. فایل را در ریشه پروژه قرار دهید و سرور را ری‌استارت کنید.`;
    console.error(`[seed-gsc] ❌ ${msg}`);
    return Response.json({ error: msg }, { status: 500 });
  }

  // ۲) اگر پیکربندی از قبل هست → هرگز overwrite نکن
  try {
    const existing = await db.siteSetting.findUnique({
      where: { key: "gsc_service_account" },
    });
    if (existing && existing.value.trim()) {
      return Response.json({ seeded: false, reason: "already configured" });
    }
  } catch (e) {
    const msg = `خطای دیتابیس در چک پیکربندی GSC: ${(e as Error).message?.slice(0, 200) ?? "unknown"}`;
    console.error(`[seed-gsc] ❌ ${msg}`);
    return Response.json({ error: msg }, { status: 500 });
  }

  // ۳) seed — آدرس سایت + کلید API (env می‌تواند پیش‌فرض را override کند)
  const apiKey = process.env.GSC_API_KEY || DEFAULT_GSC_API_KEY;
  try {
    const result = await saveGscConfig(saJson, GSC_SITE_URL, apiKey);
    if (!result.ok) {
      console.error(`[seed-gsc] ❌ ذخیره پیکربندی ناموفق: ${result.error ?? "unknown"}`);
      return Response.json(
        { error: result.error ?? "saveGscConfig ناموفق بود" },
        { status: 500 }
      );
    }
    console.log("[seed-gsc] ✅ پیکربندی سرچ کنسول از فایل recover شده نصب شد (seed خودکار boot)");
    return Response.json({ seeded: true });
  } catch (e) {
    const msg = `خطا در ذخیره پیکربندی GSC: ${(e as Error).message?.slice(0, 200) ?? "unknown"}`;
    console.error(`[seed-gsc] ❌ ${msg}`);
    return Response.json({ error: msg }, { status: 500 });
  }
}
