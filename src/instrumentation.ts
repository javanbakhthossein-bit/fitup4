/**
 * Next.js Instrumentation — کد اجراشونده هنگام boot شدن سرور
 *
 * استفاده‌ها:
 *  ۰. خودترمیمی ستون‌های گم‌شده DB — ۸ ثانیه بعد از boot + هر ۶ ساعت
 *     (اگر db:push فراموش شود، لاگین نمی‌شکند — درس آموخته از باگ v9)
 *  ۰.۵ seed خودکار پیکربندی سرچ کنسول — ۱۲ ثانیه بعد از boot
 *     (درخواست مالک 12-e: GSC از قبل نصب باشد — از فایل
 *     gsc-service-account-recovered.json در ریشه پروژه؛ بدون paste در پنل)
 *  ۱. خودترمیمی رسانه مقالات (article-media-selfheal) — ۲۰ ثانیه بعد از boot
 *  ۲. جاروی داخلی بازیابی پرداخت‌های معلق — ۴۵ ثانیه بعد از boot + هر ۱۰ دقیقه
 *     (باگ «پرداخت موفق ولی در انتظار» — بدون نیاز به کرون خارجی)
 *  ۳. جاروی داخلی نوتیف‌های رفتاری — ۹۰ ثانیه بعد از boot + هر ۶ ساعت
 *     (چکاپ‌های ۱۵/۳۰/۴۰ + انقضای پلن + یادآوری تمدید + کد تخفیف اختصاصی —
 *     بدون نیاز به کرون خارجی)
 *  ۴. ناشر مقالات زمان‌بندی‌شده — ۶۰ ثانیه بعد از boot + هر ۱۵ دقیقه
 *     (مقالاتِ scheduledAt دار بدون کرون خارجی منتشر می‌شوند)
 *
 * خاموش‌کردن جاروی پرداخت‌ها: PAYMENT_SWEEP_INTERVAL_MIN=0 در .env
 * خاموش‌کردن جاروی نوتیف‌های رفتاری: BEHAVIORAL_SWEEP_INTERVAL_MIN=0 در .env
 * خاموش‌کردن ناشر مقالات: PUBLISH_SWEEP_INTERVAL_MIN=0 در .env
 * خاموش‌کردن خودترمیمی: فایل `.selfheal-off` در ریشه پروژه یا
 * متغیر محیطی DISABLE_ARTICLE_MEDIA_SELFHEAL=1
 */
export async function register() {
  // فقط در runtime nodejs اجرا شود (نه edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const {
      startBootMediaSelfHeal,
      startPaymentRecoverySweep,
      startBehavioralSweep,
      startDbSelfHeal,
      startGscSeed,
      startScheduledPublisher,
    } = await import("./instrumentation-node");
    startDbSelfHeal();
    // بعد از db-selfheal (۱۲ ثانیه) — سرچ کنسول خودکار seed شود
    startGscSeed();
    startBootMediaSelfHeal();
    startPaymentRecoverySweep();
    // بعد از جاروی پرداخت‌ها (۶۰ ثانیه) — مقالات زمان‌بندی‌شده منتشر شوند
    startScheduledPublisher();
    startBehavioralSweep();
  }
}
