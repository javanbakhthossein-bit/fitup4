/**
 * بخش nodejs-only ابزارهای instrumentation — مطابق الگوی مستندات Next.js
 * (این ماژول فقط از src/instrumentation.ts و فقط در runtime nodejs لود می‌شود)
 *
 * کارها:
 *  ۱. خودترمیمی ستون‌های گم‌شده DB — ۸ ثانیه بعد از boot
 *  ۱.۵ seed خودکار پیکربندی سرچ کنسول (GSC) — ۱۲ ثانیه بعد از boot
 *  ۲. شروع خودترمیمی رسانه مقالات (کاور + inline) با تأخیر ۲۰ ثانیه بعد از boot
 *  ۳. جاروی داخلی بازیابی پرداخت‌های معلق — هر ۱۰ دقیقه (بدون نیاز به کرون خارجی!)
 *
 * ─── نکته معماری (مهم) ───
 * این ماژول عمداً «هیچ» import از کد پروژه ندارد (نه prisma، نه sharp).
 * دلیل: کامپایل instrumentation با webpack/turbopack اگر به sharp برسد
 * (از طریق image-processing → detect-libc → child_process) می‌شکند.
 * به‌جای import مستقیم، با درخواست HTTP به خود سرور تریگر می‌زنیم.
 */
import { existsSync } from "fs";
import { join } from "path";

/** آیا خودترمیمی خاموش شده؟ (همان منطق article-media-selfheal — بدون import) */
function isDisabled(): boolean {
  if (process.env.DISABLE_ARTICLE_MEDIA_SELFHEAL === "1") return true;
  try {
    return existsSync(join(process.cwd(), ".selfheal-off"));
  } catch {
    return false;
  }
}

export function startBootMediaSelfHeal() {
  const delayMs = 20_000;
  setTimeout(() => {
    try {
      if (isDisabled()) {
        console.log("[instrumentation] media self-heal خاموش است (marker/env) — رد شد");
        return;
      }
      const port = process.env.PORT || "3000";
      const url = `http://127.0.0.1:${port}/api/articles?pageSize=1`;
      console.log("[instrumentation] تریگر خودترمیمی رسانه مقالات (warmup)...");
      fetch(url, { signal: AbortSignal.timeout(60_000) })
        .then((r) => {
          console.log(`[instrumentation] warmup/self-heal trigger → ${r.status}`);
        })
        .catch(() => {
          // سرور شاید هنوز کاملاً آماده نیست — یک تلاش دیگر بعد از ۱۵ ثانیه
          setTimeout(() => {
            fetch(url, { signal: AbortSignal.timeout(60_000) })
              .then((r) => console.log(`[instrumentation] warmup retry → ${r.status}`))
              .catch(() => console.log("[instrumentation] warmup retry ناموفق — اسکن با اولین بازدید واقعی کاربر انجام می‌شود"));
          }, 15_000);
        });
    } catch (e) {
      console.error("[instrumentation] خطای شروع self-heal:", e);
    }
  }, delayMs);
}

/**
 * ─── خودترمیمی ستون‌های گم‌شده دیتابیس (schema drift guard) ───
 *
 * باگ واقعی v9: کد جدید با فیلد User.lastActiveAt روی سرور دیپلوی شد
 * ولی db:push اجرا نشد → هر findUnique با P2022 شکست خورد → لاگین کل
 * سایت قطع شد. FIX ریشه‌ای: در boot (۸ ثانیه — زودتر از همه‌ی جاروها)
 * route /api/cron/db-selfheal صدا زده می‌شود تا ستون‌های گم‌شده را با
 * ALTER TABLE ADD COLUMN اضافه کند. اگر route هنوز آماده نیست، هر ۳۰
 * ثانیه تا ۵ بار retry می‌شود؛ سپس هر ۶ ساعت چک تکراری (ارزان — یک
 * PRAGMA) برای اطمینان پایدار.
 */
export function startDbSelfHeal() {
  const secret = process.env.CRON_SECRET;
  const port = process.env.PORT || "3000";
  // بدون CRON_SECRET هم اجرا می‌شود — route برای اتصال مستقیم محلی (بدون
  // هدر پروکسی) مجاز است؛ این درخواست دقیقاً همان حالت است. ریسک صفر چون
  // فقط ستون‌های nullable هاردکد اضافه می‌کند.
  const url = `http://127.0.0.1:${port}/api/cron/db-selfheal${
    secret ? `?secret=${encodeURIComponent(secret)}` : ""
  }`;
  if (!secret) {
    console.warn(
      "[instrumentation] ⚠ CRON_SECRET تنظیم نشده — خودترمیمی DB با حالت محلی ادامه می‌دهد (جاروهای دیگر خاموش‌اند)"
    );
  }

  let attempts = 0;
  let settled = false;

  const runOnce = async (label: string): Promise<boolean> => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) {
        console.error(`[instrumentation] db self-heal (${label}) → HTTP ${r.status}`);
        return false;
      }
      const d = (await r.json()) as { added?: string[]; errors?: string[] };
      if (d.added && d.added.length > 0) {
        console.log(
          `[instrumentation] db self-heal (${label}): ✅ ستون‌های گم‌شده اضافه شد → ${d.added.join(", ")}`
        );
      }
      if (d.errors && d.errors.length > 0) {
        console.error(`[instrumentation] db self-heal (${label}): ⚠ ${d.errors.join(" | ")}`);
      }
      settled = true;
      return true;
    } catch (e) {
      console.error(`[instrumentation] db self-heal (${label}) failed:`, e);
      return false;
    }
  };

  // بوت + ۸ ثانیه؛ اگر سرور/کامپایل هنوز آماده نیست → retry هر ۳۰ ثانیه (حداکثر ۵ بار)
  const first = setTimeout(() => {
    const tick = async () => {
      attempts++;
      const ok = await runOnce(attempts === 1 ? "boot" : `retry-${attempts}`);
      if (!ok && !settled && attempts < 5) {
        setTimeout(() => void tick(), 30_000).unref?.();
      }
    };
    void tick();
  }, 8_000);
  first.unref?.();

  // چک دوره‌ای ارزان (هر ۶ ساعت) — ایمن در برابر جایگزینی دستی فایل DB
  const timer = setInterval(() => void runOnce("interval"), 6 * 60 * 60_000);
  timer.unref?.();

  console.log("[instrumentation] خودترمیمی دیتابیس فعال شد (boot + هر ۶ ساعت)");
}

/**
 * ─── seed خودکار پیکربندی Google Search Console (درخواست مالک 12-e) ───
 *
 * «سرچ کنسول باید از قبل نصب باشه» — بدون paste کردن چیزی در پنل.
 * در boot (۱۲ ثانیه — بعد از db-selfheal) route /api/cron/seed-gsc صدا
 * زده می‌شود؛ SA از فایل `gsc-service-account-recovered.json` ریشه پروژه
 * خوانده و ذخیره می‌شود. اگر پیکربندی از قبل موجود باشد هیچ‌وقت overwrite
 * نمی‌شود (route خودش چک می‌کند). اگر route هنوز آماده نیست، هر ۳۰ ثانیه
 * تا ۳ بار retry می‌شود.
 */
export function startGscSeed() {
  const secret = process.env.CRON_SECRET;
  const port = process.env.PORT || "3000";
  // مثل db-selfheal: بدون CRON_SECRET هم اجرا می‌شود — route برای اتصال
  // مستقیم محلی (بدون هدر پروکسی) مجاز است و فقط یک‌بار seed می‌کند.
  const url = `http://127.0.0.1:${port}/api/cron/seed-gsc${
    secret ? `?secret=${encodeURIComponent(secret)}` : ""
  }`;

  let attempts = 0;
  let settled = false;

  const runOnce = async (label: string): Promise<boolean> => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) {
        let detail = "";
        try {
          const d = (await r.json()) as { error?: string };
          detail = d?.error ? ` — ${d.error}` : "";
        } catch {
          /* بدنه JSON نبود */
        }
        console.error(
          `[instrumentation] GSC seed (${label}) → HTTP ${r.status}${detail}`
        );
        return false;
      }
      const d = (await r.json()) as {
        seeded?: boolean;
        reason?: string;
        error?: string;
      };
      if (d.seeded) {
        console.log("[instrumentation] GSC seed: ✅ پیکربندی سرچ کنسول نصب شد");
      } else if (d.reason === "already configured") {
        console.log(
          "[instrumentation] GSC seed: ⏭ سرچ کنسول از قبل پیکربندی شده — رد شد (هیچ overwrite ای نیست)"
        );
      } else if (d.error) {
        console.error(`[instrumentation] GSC seed (${label}): ⚠ ${d.error}`);
      } else {
        console.log(
          `[instrumentation] GSC seed (${label}): ⏭ ${d.reason ?? "no-op"}`
        );
      }
      settled = true;
      return true;
    } catch (e) {
      console.error(`[instrumentation] GSC seed (${label}) failed:`, e);
      return false;
    }
  };

  // بوت + ۱۲ ثانیه (بعد از db-selfheal)؛ اگر سرور/کامپایل هنوز آماده نیست →
  // retry هر ۳۰ ثانیه (حداکثر ۳ بار)
  const first = setTimeout(() => {
    const tick = async () => {
      attempts++;
      const ok = await runOnce(attempts === 1 ? "boot" : `retry-${attempts}`);
      if (!ok && !settled && attempts < 3) {
        setTimeout(() => void tick(), 30_000).unref?.();
      }
    };
    void tick();
  }, 12_000);
  first.unref?.();

  console.log(
    "[instrumentation] seed خودکار سرچ کنسول فعال شد (boot + ۱۲ ثانیه، تا ۳ retry)"
  );
}

/**
 * ─── جاروی داخلی نوتیفیکیشن‌های رفتاری (behavioral) ───
 *
 * سناریوهای حیاتی — چکاپ‌های دوره‌ای (روز ۱۵/۳۰/۴۰)، انقضای پلن، یادآوری
 * تمدید + کد تخفیف اختصاصی تمدید، بازگشت کاربر خاموش — همه در
 * /api/cron/behavioral پیاده شده بودند ولی اجرایشان به کرون خارجی سرور
 * وابسته بود؛ اگر ادمین crontab نصب نکرده باشد این نوتیف‌ها «هرگز» ارسال
 * نمی‌شوند (همان الگوی ریشه‌ای باگ پرداخت‌های معلق).
 *
 * FIX: مثل جاروی پرداخت‌ها، همین‌جا داخل پروسه‌ی خود اپ اجرا می‌شود:
 *  - بعد از boot (تأخیر ۹۰ ثانیه — بعد از جاروی پرداخت) و سپس هر N دقیقه
 *  - بازه: BEHAVIORAL_SWEEP_INTERVAL_MIN (پیش‌فرض ۳۶۰ دقیقه = ۶ ساعت)؛ 0 = خاموش
 *  - خود route دِداپ داخلی دارد → اجرای مکرر بی‌خطر است
 */
export function startBehavioralSweep() {
  const intervalMin = Number(process.env.BEHAVIORAL_SWEEP_INTERVAL_MIN ?? "360");
  if (!Number.isFinite(intervalMin) || intervalMin <= 0) {
    console.log(
      "[instrumentation] جاروی نوتیف‌های رفتاری خاموش (BEHAVIORAL_SWEEP_INTERVAL_MIN<=0)"
    );
    return;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn(
      "[instrumentation] ⚠ CRON_SECRET تنظیم نشده — جاروی نوتیف‌های رفتاری (چکاپ/تمدید/انقضا) غیرفعال است!"
    );
    return;
  }

  const port = process.env.PORT || "3000";
  const url = `http://127.0.0.1:${port}/api/cron/behavioral?secret=${encodeURIComponent(secret)}`;

  let running = false;
  const run = async (label: string) => {
    if (running) return; // محافظ هم‌پوشانی
    running = true;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (r.ok) {
        try {
          const d = await r.json();
          const created: number = d?.total ?? 0;
          if (created > 0) {
            console.log(
              `[instrumentation] behavioral sweep (${label}): ✅ ${created} اعلان جدید (upgrade=${d?.upgrade ?? 0} renewal=${d?.renewal ?? 0} checkup=${d?.checkup ?? 0} expired=${d?.expired ?? 0} renewalLate=${d?.renewalLate ?? 0} reEngage=${d?.reengagement ?? 0})`
            );
          }
        } catch {
          console.log(`[instrumentation] behavioral sweep (${label}) → ${r.status}`);
        }
      } else {
        console.error(`[instrumentation] behavioral sweep (${label}) → HTTP ${r.status}`);
      }
    } catch (e) {
      console.error(`[instrumentation] behavioral sweep (${label}) failed:`, e);
    } finally {
      running = false;
    }
  };

  // اولین اجرا ۹۰ ثانیه بعد از boot (بعد از جاروی پرداخت‌ها تا بار boot پخش شود)
  const first = setTimeout(() => void run("boot"), 90_000);
  first.unref?.();
  // سپس هر N دقیقه
  const timer = setInterval(() => void run("interval"), intervalMin * 60_000);
  timer.unref?.();

  console.log(
    `[instrumentation] جاروی نوتیف‌های رفتاری فعال شد (هر ${intervalMin} دقیقه) — چکاپ/انقضا/تمدید/کد تخفیف`
  );
}

/**
 * ─── ناشرِ خودکارِ مقالات زمان‌بندی‌شده (FIX ۱۴۰۵/۰۶) ───
 *
 * باگ واقعی: انتشار مقالاتِ scheduledAt دار به کرونِ خارجیِ سرور
 * (crontab) وابسته بود؛ با تغییرِ کرون‌ها مقاله‌ی زمان‌بندی‌شده‌ی ۱ شهریور
 * منتشر نشد. FIX: مثل جاروی پرداخت‌ها، داخل خود پروسه‌ی اپ اجرا می‌شود:
 *  - بعد از boot (تأخیر ۶۰ ثانیه) و سپس هر ۱۵ دقیقه
 *  - بدون CRON_SECRET هم کار می‌کند (route برای اتصال محلی مجاز است)
 *  - PUBLISH_SWEEP_INTERVAL_MIN: 0 = خاموش
 */
export function startScheduledPublisher() {
  const intervalMin = Number(process.env.PUBLISH_SWEEP_INTERVAL_MIN ?? "15");
  if (!Number.isFinite(intervalMin) || intervalMin <= 0) {
    console.log(
      "[instrumentation] ناشر مقالات زمان‌بندی‌شده خاموش (PUBLISH_SWEEP_INTERVAL_MIN<=0)"
    );
    return;
  }

  const secret = process.env.CRON_SECRET;
  const port = process.env.PORT || "3000";
  // بدون CRON_SECRET هم اجرا می‌شود — route برای اتصال مستقیم محلی مجاز است.
  const url = `http://127.0.0.1:${port}/api/cron/publish-scheduled${
    secret ? `?secret=${encodeURIComponent(secret)}` : ""
  }`;

  let running = false;
  const run = async (label: string) => {
    if (running) return; // محافظ هم‌پوشانی
    running = true;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (r.ok) {
        try {
          const d = (await r.json()) as { published?: number; articles?: { title?: string }[] };
          if (d.published && d.published > 0) {
            const titles = (d.articles ?? [])
              .map((a) => a.title ?? "")
              .filter(Boolean)
              .slice(0, 3)
              .join(" | ");
            console.log(
              `[instrumentation] publish sweep (${label}): ✅ ${d.published} مقاله منتشر شد${titles ? ` — ${titles}` : ""}`
            );
          }
        } catch {
          console.log(`[instrumentation] publish sweep (${label}) → ${r.status}`);
        }
      } else {
        console.error(`[instrumentation] publish sweep (${label}) → HTTP ${r.status}`);
      }
    } catch (e) {
      console.error(`[instrumentation] publish sweep (${label}) failed:`, e);
    } finally {
      running = false;
    }
  };

  // اولین اجرا ۶۰ ثانیه بعد از boot (بعد از db-selfheal/GSC seed)
  const first = setTimeout(() => void run("boot"), 60_000);
  first.unref?.();
  // سپس هر N دقیقه
  const timer = setInterval(() => void run("interval"), intervalMin * 60_000);
  timer.unref?.();

  console.log(
    `[instrumentation] ناشر مقالات زمان‌بندی‌شده فعال شد (هر ${intervalMin} دقیقه)`
  );
}

/**
 * ─── جاروی داخلی بازیابی پرداخت‌های معلق ───
 *
 * باگ «پرداخت موفق ولی در انتظار»: رکورد Payment برای هر دلیل (برنگشتن از
 * بانک / خطای موقت شبکه در verify / کرش) تا ابد pending می‌ماند. FIX: داخل
 * خود اپ بعد از boot (۴۵ث) و هر ۱۰ دقیقه route /api/cron/recover-payments
 * با CRON_SECRET اجرا می‌شود — بدون کرون خارجی. 0 = خاموش.
 */
export function startPaymentRecoverySweep() {
  const intervalMin = Number(process.env.PAYMENT_SWEEP_INTERVAL_MIN ?? "10");
  if (!Number.isFinite(intervalMin) || intervalMin <= 0) {
    console.log(
      "[instrumentation] جاروی پرداخت‌ها خاموش (PAYMENT_SWEEP_INTERVAL_MIN<=0)"
    );
    return;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn(
      "[instrumentation] ⚠ CRON_SECRET تنظیم نشده — جاروی خودکار بازیابی پرداخت‌ها غیرفعال است!"
    );
    return;
  }

  const port = process.env.PORT || "3000";
  const url = `http://127.0.0.1:${port}/api/cron/recover-payments?secret=${encodeURIComponent(secret)}`;

  let running = false;
  const run = async (label: string) => {
    if (running) return; // محافظ هم‌پوشانی
    running = true;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (r.ok) {
        // خلاصه پاسخ (recovered/expired/legacySweep) برای لاگ
        try {
          const d = await r.json();
          const recovered = (d?.recovered ?? 0) + (d?.legacySweep?.delivered ?? 0);
          const expired = (d?.expired ?? 0) + (d?.legacySweep?.closed ?? 0);
          if (recovered > 0 || expired > 0) {
            console.log(
              `[instrumentation] payment sweep (${label}): ✅ recovered=${recovered} closed=${expired}`
            );
          }
        } catch {
          console.log(`[instrumentation] payment sweep (${label}) → ${r.status}`);
        }
      } else {
        console.error(`[instrumentation] payment sweep (${label}) → HTTP ${r.status}`);
      }
    } catch (e) {
      console.error(`[instrumentation] payment sweep (${label}) failed:`, e);
    } finally {
      running = false;
    }
  };

  // اولین اجرا ۴۵ ثانیه بعد از boot
  const first = setTimeout(() => void run("boot"), 45_000);
  first.unref?.();
  // سپس هر N دقیقه
  const timer = setInterval(() => void run("interval"), intervalMin * 60_000);
  timer.unref?.();

  console.log(
    `[instrumentation] جاروی بازیابی پرداخت‌ها فعال شد (هر ${intervalMin} دقیقه)`
  );
}
