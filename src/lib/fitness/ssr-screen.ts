import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/fitness/auth";

/**
 * محاسبه screen اولیه در سرور (SSR) — آینه‌ی منطق applyUrlToScreen در page-client.
 *
 * چرا: قبلاً store با screen="loading" شروع می‌شد و HTML اولیه فقط
 * SplashLoader بود؛ محتوای واقعی (لندینگ/مقالات/ابزارها) بعد از اجرای
 * JavaScript در مرورگر ظاهر می‌شد. برای سئو (crawler بدون JS)، پیش‌نمایش
 * شبکه‌های اجتماعی و LCP، HTML اولیه باید محتوای واقعی داشته باشد.
 *
 * حالا سرور بر اساس searchParams + سشن، screen اولیه را می‌سازد و
 * HomeClient قبل از اولین رندر آن را داخل store تزریق می‌کند —
 * خروجی سرور و کلاینت یکسان است (بدون hydration mismatch).
 */
export interface InitialScreen {
  screen: string;
  articleSlug?: string;
  exerciseId?: string;
  foodId?: string;
  refCode?: string;
  mainTab?: string;
  paymentVerify?: boolean;
}

/** خواندن امن پارامتر تک‌مقداری از searchParams برجسته (Promise در Next.js 16) */
function pick(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

const VALID_TABS = [
  "dashboard",
  "programs",
  "workouts",
  "nutrition",
  "progress",
  "chat",
  "plans",
  "referral",
  "support",
  "mobileapp",
];

const VALID_TOOLS = ["tdee", "exercises", "foods"];

export async function resolveInitialScreen(
  sp: Record<string, string | string[] | undefined>
): Promise<InitialScreen> {
  const article = pick(sp, "article");
  if (article) return { screen: "article", articleSlug: article };

  const exercise = pick(sp, "exercise");
  if (exercise) return { screen: "exercise-detail", exerciseId: exercise };

  const food = pick(sp, "food");
  if (food) return { screen: "food-detail", foodId: food };

  const tool = pick(sp, "tool");
  if (tool && VALID_TOOLS.includes(tool)) {
    return { screen: `tool-${tool}` };
  }

  const screenParam = pick(sp, "screen");
  const refCode = pick(sp, "ref")?.trim().toUpperCase() || undefined;
  const mainTabRaw = pick(sp, "tab");
  const mainTab =
    mainTabRaw && VALID_TABS.includes(mainTabRaw) ? mainTabRaw : undefined;
  const view = pick(sp, "view");
  const forceLanding = view === "landing";

  // صفحات عمومی استاتیک — بدون نیاز به auth check
  if (screenParam && ["articles", "terms", "contact"].includes(screenParam)) {
    return { screen: screenParam, refCode, mainTab };
  }

  // ?view=landing → همیشه لندینگ
  if (forceLanding) {
    return { screen: refCode ? "referral-landing" : "landing", refCode };
  }

  const wantsAuth = screenParam === "auth";
  const wantsPanel = screenParam === "panel";

  // تشخیص PWA standalone با کوکی (اسکریپت inline در layout ست می‌کند —
  // display-mode فقط سمت کلاینت قابل خواندن است)
  let isStandalone = false;
  try {
    const cookieStore = await cookies();
    isStandalone = cookieStore.get("pwa_standalone")?.value === "1";
  } catch {
    // در شرایط خاص (مثلاً generateMetadata) کوکی در دسترس نیست
  }

  // مرورگر معمولی + URL خالی → لندینگ
  if (!wantsPanel && !wantsAuth && !isStandalone) {
    return {
      screen: refCode ? "referral-landing" : "landing",
      refCode,
      mainTab,
      paymentVerify: pick(sp, "payment_verify") === "1",
    };
  }

  // ─── نیاز به auth check (panel / auth / PWA) — سمت سرور با سشن ───
  // نوع صریح: getCurrentUser یا user برمی‌گرداند یا null — تایپ let user = null
  // را به never تنگ می‌کرد (خطای TS2339 روی role/onboardingDone).
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  if (user) {
    // همان منطق doAuthCheck کلاینت
    if (user.role === "ADMIN") return { screen: "admin", mainTab };
    return { screen: user.onboardingDone ? "main" : "onboarding", mainTab };
  }

  // کاربر لاگین نیست
  if (wantsAuth) return { screen: "auth" };
  if (isStandalone && !forceLanding) return { screen: "auth" };
  // ?screen=panel بدون لاگین در مرورگر → لندینگ (رفتار کلاینت)
  return {
    screen: refCode ? "referral-landing" : "landing",
    refCode,
    mainTab,
    paymentVerify: pick(sp, "payment_verify") === "1",
  };
}
