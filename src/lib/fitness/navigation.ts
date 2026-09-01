/**
 * Navigation Helper — مدیریت URL و History برای SPA-like navigation
 *
 * مشکلاتی که حل می‌کند:
 * 1. وقتی کاربر در articles/tool/article است و رفرش می‌کند، باید همان صفحه بالا بیاید
 * 2. دکمه back مرورگر باید مرحله به مرحله برگرداند (article → articles → landing)
 * 3. URL باید همیشه با screen فعلی هماهنگ باشد
 *
 * راه‌حل:
 * - هر screen یک URL param دارد: ?screen=articles, ?article=slug, ?tool=tdee
 * - هر navigation یک history entry اضافه می‌کند
 * - popstate handler تصمیم می‌گیرد کجا برگردد
 */

export type NavScreen =
  | "landing"
  | "articles"
  | "article"
  | "tool-tdee"
  | "tool-exercises"
  | "tool-foods"
  | "exercise-detail"
  | "food-detail"
  | "terms"
  | "contact"
  | "auth"
  | "main"
  | "admin"
  | "onboarding";

/**
 * پارامترهای URL را پاک می‌کند (article, tool, screen, exercise, food, tab)
 */
export function cleanNavParams(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const param of ["article", "tool", "screen", "tab", "exercise", "food"]) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, "", url.toString());
  }
}

/**
 * URL را برای یک screen خاص می‌سازد
 */
export function buildScreenUrl(screen: NavScreen, extra?: Record<string, string>): string {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);

  // پاک کردن پارامترهای navigation قبلی
  url.searchParams.delete("article");
  url.searchParams.delete("tool");
  url.searchParams.delete("screen");
  url.searchParams.delete("exercise");
  url.searchParams.delete("food");

  // اضافه کردن پارامتر جدید
  if (screen === "article" && extra?.article) {
    url.searchParams.set("article", extra.article);
  } else if (screen.startsWith("tool-") && extra?.tool) {
    url.searchParams.set("tool", extra.tool);
  } else if (screen === "exercise-detail" && extra?.exercise) {
    url.searchParams.set("exercise", extra.exercise);
  } else if (screen === "food-detail" && extra?.food) {
    url.searchParams.set("food", extra.food);
  } else if (["articles", "terms", "auth", "contact"].includes(screen)) {
    url.searchParams.set("screen", screen);
  } else if (["main", "admin", "onboarding"].includes(screen)) {
    // پنل کاربری → ?screen=panel برای رفرش
    url.searchParams.set("screen", "panel");
  }
  // landing → هیچ پارامتری نیاز نیست

  return url.toString();
}

/**
 * یک history entry جدید اضافه می‌کند (push)
 * برای navigation به جلو (مثلاً از articles به article)
 */
export function pushScreen(screen: NavScreen, extra?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const url = buildScreenUrl(screen, extra);
  window.history.pushState({ screen, ...extra }, "", url);
}

/**
 * ناوبری هوشمند — اگر کاربر لاگین کرده، به پنل می‌رود؛ اگر نه، به صفحه auth.
 *
 * این تابع باید به‌جای `setScreen("auth")` در همه دکمه‌های «شروع کنید»،
 * «ورود/ثبت‌نام» و CTA استفاده شود تا کاربر لاگین‌شده به صفحه OTP هدایت نشود.
 *
 * @param isAuthed — آیا کاربر فعلی لاگین کرده است؟ (useAppStore.user !== null)
 * @param setScreen — تابع setScreen از store
 * @param onboardingDone — آیا آنبوردینگ تکمیل شده؟ (اگر لاگین کرده ولی آنبوردینگ نکرده، به onboarding)
 */
export function smartNavigate(
  isAuthed: boolean,
  setScreen: (s: NavScreen) => void,
  onboardingDone?: boolean
): void {
  if (!isAuthed) {
    // کاربر لاگین نکرده — به صفحه auth برو
    setScreen("auth");
    pushScreen("auth");
    return;
  }
  // کاربر لاگین کرده
  if (onboardingDone === false) {
    // آنبوردینگ تکمیل نشده — به صفحه onboarding برو
    setScreen("onboarding");
    pushScreen("onboarding");
    return;
  }
  // همه چیز کامل — به پنل برو
  setScreen("main");
  pushScreen("main");
}

/**
 * URL فعلی را جایگزین می‌کند (replace)
 * برای navigation که نباید history اضافه کند (مثلاً بازگشت از article به articles)
 */
export function replaceScreen(screen: NavScreen, extra?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const url = buildScreenUrl(screen, extra);
  window.history.replaceState({ screen, ...extra }, "", url);
}

/**
 * screen فعلی را از URL استخراج می‌کند
 * برای استفاده هنگام mount (refresh)
 */
export function getScreenFromUrl(): {
  screen: NavScreen | null;
  articleSlug?: string;
  tool?: string;
  exerciseId?: string;
  foodId?: string;
} {
  if (typeof window === "undefined") return { screen: null };
  const params = new URLSearchParams(window.location.search);

  const article = params.get("article");
  if (article) {
    return { screen: "article", articleSlug: article };
  }

  const exercise = params.get("exercise");
  if (exercise) {
    return { screen: "exercise-detail", exerciseId: exercise };
  }

  const food = params.get("food");
  if (food) {
    return { screen: "food-detail", foodId: food };
  }

  const tool = params.get("tool");
  if (tool) {
    const toolScreen = `tool-${tool}` as NavScreen;
    if (["tool-tdee", "tool-exercises", "tool-foods"].includes(toolScreen)) {
      return { screen: toolScreen, tool };
    }
  }

  const screenParam = params.get("screen");
  if (screenParam) {
    // ?screen=panel → پنل کاربری (main/admin/onboarding)
    if (screenParam === "panel") {
      return { screen: "main" as NavScreen };
    }
    const validScreens: NavScreen[] = ["articles", "auth", "terms", "contact"];
    if (validScreens.includes(screenParam as NavScreen)) {
      return { screen: screenParam as NavScreen };
    }
  }

  return { screen: null };
}
