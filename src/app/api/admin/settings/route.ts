import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

// Default settings keys (labels + safe defaults)
const SETTING_KEYS: Record<string, string> = {
  brandName: "نام برند",
  slogan: "شعار برند",
  heroTitle: "عنوان صفحه اصلی",
  heroSubtitle: "زیرعنوان صفحه اصلی",
  primaryColor: "رنگ اصلی",
  referral_reward_amount: "مبلغ پاداش معرفی به دوست (تومان)",
  // کدهای نسخه اپ کافه‌بازار — کنترل آپدیت اجباری/اختیاری اپ کاربران (ممیزی 2-c)
  app_latest_version_code: "کد آخرین نسخه اپ بازار",
  app_min_version_code: "کد حداقل نسخه اپ (زیر این = آپدیت اجباری)",
};

// مقادیر پیش‌فرض برای کلیدهایی که هنوز در DB ذخیره نشده‌اند
// v1.4.0 (versionCode 5) — مجوزهای دوربین/میکروفون در زمان خودش + فیکس رفرش:
// نسخه‌های قدیمی آپدیت بگیرند؛ ادمین می‌تواند از تنظیمات تغییر دهد.
const SETTING_DEFAULTS: Record<string, string> = {
  app_latest_version_code: "5",
  app_min_version_code: "3",
};

// کلیدهای کد نسخه اپ — عدد صحیح ۱..۱,۰۰۰,۰۰۰
const APP_VERSION_KEYS = new Set(["app_latest_version_code", "app_min_version_code"]);
/** سقف پاداش معرفی (تومان) — جلوگیری از خطای تایپی ۹ رقمی (ممیزی 2-c P2) */
const MAX_REFERRAL_REWARD = 10_000_000;

/** اعتبارسنجی مقدار کلیدهای عددی (کد نسخه اپ و پاداش معرفی) */
function validateNumericSetting(key: string, value: string): string | null {
  if (APP_VERSION_KEYS.has(key)) {
    const n = Number(value.trim());
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
      return "کد نسخه اپ باید عدد صحیح بین ۱ تا ۱,۰۰۰,۰۰۰ باشد.";
    }
    return null;
  }
  if (key === "referral_reward_amount") {
    const n = Number(value.trim());
    if (!Number.isInteger(n) || n < 0 || n > MAX_REFERRAL_REWARD) {
      return `مبلغ پاداش معرفی باید عدد صحیح بین ۰ تا ${MAX_REFERRAL_REWARD.toLocaleString("en-US")} تومان باشد.`;
    }
    return null;
  }
  return null;
}

// GET /api/admin/settings — admin: list all settings
export async function GET() {
  try {
    await requireAdmin();
    const rows = await db.siteSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r]));
    return Response.json({
      settings: Object.keys(SETTING_KEYS).map((k) => ({
        key: k,
        label: SETTING_KEYS[k],
        value: map.get(k)?.value ?? SETTING_DEFAULTS[k] ?? "",
        id: map.get(k)?.id ?? null,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

// PUT /api/admin/settings — admin: update single setting (body: { key, value })
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const { key, value } = await req.json();
    if (!key || typeof key !== "string" || !SETTING_KEYS[key]) {
      return Response.json({ error: "کلید تنظیمات نامعتبر است." }, { status: 400 });
    }
    if (typeof value !== "string") {
      return Response.json({ error: "مقدار نامعتبر است." }, { status: 400 });
    }

    // Validate primaryColor is hex
    if (key === "primaryColor" && value && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value)) {
      return Response.json({ error: "رنگ باید در قالب هگز (مثل #F4C542) باشد." }, { status: 400 });
    }

    // اعتبارسنجی کلیدهای عددی — کد نسخه اپ (۱..۱۰۰۰۰۰۰) و پاداش معرفی (۰..۱۰میلیون)
    const numericError = validateNumericSetting(key, value);
    if (numericError) {
      return Response.json({ error: numericError }, { status: 400 });
    }

    const updated = await db.siteSetting.upsert({
      where: { key },
      create: { key, value, label: SETTING_KEYS[key] },
      update: { value },
    });

    return Response.json({ setting: updated });
  } catch (e) {
    return apiError(e);
  }
}
