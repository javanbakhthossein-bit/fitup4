"use client";

import { recoverPendingPayments, shouldRecoverNow } from "@/lib/fitness/recover-payments-client";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/fitness/store";
import { isFitUpBazaarApp } from "@/lib/fitness/bazaar-bridge";
import { installBazaarScrollGuard } from "@/lib/fitness/bazaar-scroll-guard";
import { AuthScreen } from "@/components/fitness/auth-screen";
import { OnboardingScreen } from "@/components/fitness/onboarding-screen";
import { MainApp } from "@/components/fitness/main-app";
import { SplashLoader } from "@/components/fitness/splash-loader";
import { LandingPage } from "@/components/fitness/landing/landing-page";
import { NikaWidget } from "@/components/fitness/nika-widget";
import { getScreenFromUrl } from "@/lib/fitness/navigation";
import { TdeeCalculator } from "@/components/fitness/tools/tdee-calculator";
import { ExercisesDatabase } from "@/components/fitness/tools/exercises-database";
import { FoodCalorieIndex } from "@/components/fitness/tools/food-calorie-index";
import { ToolsNav } from "@/components/fitness/tools/tools-nav";
import { TermsPage } from "@/components/fitness/terms-page";
import { ContactPage } from "@/components/fitness/contact-page";
import { PaymentVerifyHandler } from "@/components/fitness/payment-verify-handler";
import { AnalysisScreen } from "@/components/fitness/analysis-screen";
import { AdminOverlay } from "@/components/fitness/views/admin-overlay";
import { ArticlesPage } from "@/components/fitness/articles/articles-page";
import { ArticlePage } from "@/components/fitness/articles/article-page";
import { ExerciseDetailPage } from "@/components/fitness/tools/exercise-detail-page";
import { FoodDetailPage } from "@/components/fitness/tools/food-detail-page";
import { ReferralLanding } from "@/components/fitness/landing/referral-landing";
import type { InitialScreen } from "@/lib/fitness/ssr-screen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── تایتل‌های پویا برای هر صفحه ───
const PAGE_TITLES: Record<string, string> = {
  landing: "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه",
  auth: "ورود به فیتاپ | ثبت‌نام با شماره موبایل",
  onboarding: "تکمیل اطلاعات | فیتاپ",
  main: "پنل ورزشکار | فیتاپ",
  admin: "پنل مدیریت | فیتاپ",
  loading: "فیتاپ",
  "referral-landing": "دعوت دوستان | فیتاپ",
  articles: "مقالات بدنسازی و تناسب اندام | فیتاپ",
  article: "مقاله | فیتاپ",
  "tool-tdee": "محاسبه‌گر کالری روزانه TDEE | فیتاپ",
  "tool-exercises": "بانک حرکات بدنسازی | فیتاپ",
  "exercise-detail": "آموزش حرکت | فیتاپ",
  "tool-foods": "جدول کالری غذاها | فیتاپ",
  "food-detail": "کالری غذا | فیتاپ",
  terms: "قوانین و مقررات | فیتاپ",
  contact: "تماس با ما | فیتاپ",
};

// ─── تزریق screen اولیهٔ محاسبه‌شده در سرور (SSR) ───
// منطق کامل: src/lib/fitness/ssr-screen.ts
// این تابع فقط یک‌بار در هر بارگذاری صفحه اجرا می‌شود — قبل از اولین useAppStore()
// تا snapshot اولیه همان screen سرور باشد (خروجی سرور = خروجی کلاینت، بدون mismatch).
let ssrBootstrapped = false;
function bootstrapStoreFromServer(initial: InitialScreen) {
  if (ssrBootstrapped) return;
  ssrBootstrapped = true;
  const s = useAppStore.getState();
  if (s.screen !== "loading") return;
  useAppStore.setState({
    screen: initial.screen as typeof s.screen,
    ...(initial.articleSlug ? { articleSlug: initial.articleSlug } : {}),
    ...(initial.exerciseId ? { exerciseId: initial.exerciseId } : {}),
    ...(initial.foodId ? { foodId: initial.foodId } : {}),
    ...(initial.mainTab ? { mainTab: initial.mainTab as typeof s.mainTab } : {}),
  });
}

// ─── تأیید خروج از PWA با دکمه back (اندروید) ───
// confirm() مرورگر در WebView/iframe محدود همیشه false برمی‌گرداند و کاربر
// عملاً با دکمه back در PWA گیر می‌کرد — دیالوگ درون‌برنامه‌ای جایگزین شد.
function PwaExitConfirmDialog({ open, onStay, onExit }: { open: boolean; onStay: () => void; onExit: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onStay()}>
      <AlertDialogContent dir="rtl" className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>خروج از فیتاپ</AlertDialogTitle>
          <AlertDialogDescription>آیا از برنامه فیتاپ خارج می‌شوید؟</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row">
          <AlertDialogCancel onClick={onStay}>ماندن</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={onExit}
          >
            خروج
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function HomeClient({ initial }: { initial: InitialScreen }) {
  // ⚠️ باید قبل از فراخوانی useAppStore اجرا شود تا snapshot اولیه درست باشد
  bootstrapStoreFromServer(initial);
  const { screen, setScreen, setUser, setArticleSlug, setExerciseId, setFoodId, setMainTab, setTermsUpdateRequired, setOverlay } = useAppStore();

  // ─── مقادیر اولیه از سرور (SSR) ───
  // این مقادیر حالا از props سرور مقداردهی اولیه می‌شوند (متناسب با SSR)
  // و بعداً applyUrlToScreen در mount دوباره آن‌ها را از URL اعمال می‌کند.
  const [paymentVerify, setPaymentVerify] = useState(initial.paymentVerify === true);
  const [refCode, setRefCode] = useState<string | null>(initial.refCode ?? null);
  // دیالوگ تأیید خروج از PWA (دکمه back در حالت standalone) — جایگزین confirm()
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // ═══════════════════════════════════════════════════════════════
  //  منطق اصلی: URL → screen
  //  اصل: URL همیشه منبع حقیقت است. هیچ state پیچیده‌ای نیست.
  // ═══════════════════════════════════════════════════════════════

  // ─── تابع اعمال screen از URL ───
  // این تابع در mount و popstate صدا زده می‌شود
  const applyUrlToScreen = async () => {
    if (typeof window === "undefined") return;

    // ذخیره کد معرفی
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      try { window.localStorage.setItem("fitap_referral_code", ref.trim().toUpperCase()); } catch {}
    }

    // tab از URL
    const tab = params.get("tab");
    if (tab) {
      const validTabs = ["dashboard", "programs", "workouts", "nutrition", "progress", "chat", "plans", "referral", "support", "mobileapp"];
      if (validTabs.includes(tab)) setMainTab(tab as any);
    }

    // ─── ?renewal=1 → صفحه تمدید بعد از auth ───
    // لینک نوتیف‌های تمدید/انقضا (cron رفتاری) مستقیم به تجربه تمدید می‌رود:
    // رینگ روزها + آمار دوره + کد تخفیف + CTA. اگر کاربر لاگین نباشد، اول
    // auth و بعد صفحه تمدید باز می‌شود.
    const wantsRenewal = params.get("renewal") === "1";
    if (wantsRenewal) {
      // اگر همین الان در پنل است، مستقیم بازش کن
      if (useAppStore.getState().user && useAppStore.getState().screen === "main") {
        setOverlay("renewal");
      }
      // در غیر این صورت doAuthCheck بعد از ورود موفق بازش می‌کند
    }

    const urlScreen = getScreenFromUrl();
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    const forceLanding = params.get("view") === "landing";

    // ─── set payment_verify و refCode از URL (hydration-safe) ───
    // این مقادیر در useState با false/null شروع می‌شوند و اینجا set می‌شوند.
    const pv = params.get("payment_verify") === "1";
    setPaymentVerify(pv);
    const rawRef = params.get("ref");
    setRefCode(rawRef ? rawRef.trim().toUpperCase() : null);

    // ─── ۱. صفحات عمومی (مقالات، ابزارها، جزئیات) ───
    // این صفحات همیشه از URL خوانده می‌شوند — مهم نیست کاربر لاگین است یا نه
    if (urlScreen.screen === "article" && urlScreen.articleSlug) {
      setArticleSlug(urlScreen.articleSlug);
      setScreen("article");
      // auth check در background
      fetchAuthInBackground();
      return;
    }
    if (urlScreen.screen === "articles") {
      setScreen("articles");
      fetchAuthInBackground();
      return;
    }
    if (urlScreen.screen?.startsWith("tool-")) {
      setScreen(urlScreen.screen as any);
      fetchAuthInBackground();
      return;
    }
    if (urlScreen.screen === "exercise-detail" && urlScreen.exerciseId) {
      setExerciseId(urlScreen.exerciseId);
      setScreen("exercise-detail");
      fetchAuthInBackground();
      return;
    }
    if (urlScreen.screen === "food-detail" && urlScreen.foodId) {
      setFoodId(urlScreen.foodId);
      setScreen("food-detail");
      fetchAuthInBackground();
      return;
    }
    if (urlScreen.screen === "terms") {
      setScreen("terms");
      fetchAuthInBackground();
      return;
    }
    if (urlScreen.screen === "contact") {
      setScreen("contact");
      fetchAuthInBackground();
      return;
    }

    // ─── ۲. صفحات احتیاج به auth check ───
    // ?screen=panel → auth check → panel یا auth
    // ?screen=auth → auth check → panel یا auth
    // URL خالی → landing (مرورگر) یا auth check (PWA)
    const wantsPanel = urlScreen.screen === "main"; // ?screen=panel → getScreenFromUrl returns "main"
    const wantsAuth = urlScreen.screen === "auth";

    // در مرورگر معمولی:
    // - URL خالی → همیشه landing (حتی اگر لاگین است)
    // - ?screen=panel یا ?screen=auth → auth check
    // - ?view=landing → همیشه landing
    // - ادمین همیشه → پنل مدیریت
    if (!isStandalone || forceLanding) {
      if (!wantsPanel && !wantsAuth && !wantsRenewal) {
        // URL خالی → landing
        showLanding();
        // auth check در background برای نمایش نام کاربر
        fetchAuthInBackground();
        return;
      }
      // ?screen=panel یا ?screen=auth یا ?renewal=1 → auth check
      await doAuthCheck(wantsAuth);
      return;
    }

    // ─── PWA (standalone) ───
    // URL خالی → auth check → panel یا auth
    // ?screen=terms یا ?screen=contact → همان صفحه
    // ?view=landing → landing
    await doAuthCheck(false);

    // ─── توابع کمکی ───
    function showLanding() {
      if (ref) setScreen("referral-landing");
      else setScreen("landing");
    }

    /**
     * FIX (بازگشت درگاه بدون verify): بازیابی با throttle ۱۰ دقیقه‌ای.
     * قبلاً recover فقط در doAuthCheck (?screen=panel / PWA) صدا زده می‌شد —
     * کاربری که از بانک برنمی‌گشت و بعداً صرفاً صفحه اصلی را باز می‌کرد، هرگز
     * بازیابی نمی‌شد! حالا هر بازدید لاگین‌شده (حتی لندینگ) چک می‌شود.
     * (پیاده‌سازی مشترک: src/lib/fitness/recover-payments-client.ts)
     */

    async function fetchAuthInBackground() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.user) {
          setUser(data.user);
          // ─── FIX: بازیابی پرداخت معلق در هر بازدید (نه فقط مسیر پنل) ───
          if (shouldRecoverNow()) recoverPendingPayments();
        }
        if (data?.termsUpdateRequired) setTermsUpdateRequired(true);
      } catch {}
    }

    async function doAuthCheck(fallbackToAuth: boolean) {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json();
        if (data?.termsUpdateRequired) setTermsUpdateRequired(true);
        if (data?.user) {
          setUser(data.user);
          // ─── بازیابی خودکار پرداخت‌های معلق (باگ «در انتظار») ───
          // کاربری که در درگاه پرداخت کرده ولی به سایت برنگشته/سرور نیمه‌کاره مانده:
          // همینجا استعلام می‌کنیم؛ اگر پرداخت موفق بوده، پلن تحویل و کاربر به‌روز می‌شود.
          recoverPendingPayments();
          if (data.user.role === "ADMIN") {
            setScreen("admin");
          } else {
            setScreen(data.user.onboardingDone ? "main" : "onboarding");
            // کاربر با لینک ?renewal=1 آمده و وارد پنل شد → صفحه تمدید
            if (wantsRenewal && data.user.onboardingDone) {
              setOverlay("renewal");
            }
          }
        } else {
          // کاربر لاگین نیست
          if (wantsRenewal) {
            // با لینک تمدید آمده — اول وارد شو؛ بعد از لاگین صفحه تمدید باز می‌شود
            try { window.sessionStorage.setItem("fitap_open_renewal", "1"); } catch {}
            setScreen("auth");
          } else if (isStandalone && !forceLanding) {
            setScreen("auth");
          } else if (fallbackToAuth) {
            setScreen("auth");
          } else {
            showLanding();
          }
        }
      } catch {
        // timeout یا خطا
        if (isStandalone && !forceLanding) {
          setScreen("auth");
        } else if (fallbackToAuth) {
          setScreen("auth");
        } else {
          showLanding();
        }
      }
    }
  };

  // ─── mount: فقط auth check برای صفحات که نیاز دارند ───
  // صفحات عمومی از store اولیه نمایش داده می‌شوند (بدون صبر برای auth)
  useEffect(() => {
    if (typeof window === "undefined") return;
    // ─── گارد اسکرول اپ بازار (فیکس باگ رفرش با اسکرول به بالا) ───
    // داخل WebView بازار نصب می‌شود؛ در مرورگر/PWA بی‌اثر است.
    try {
      if (isFitUpBazaarApp()) installBazaarScrollGuard();
    } catch {}
    applyUrlToScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── بازیابی خریدهای بازار (فقط داخل اپ اندروید) ───
  // اپ بعد از اتصال پولکی، خریدهای consume-نشده را از طریق
  // window.__fitupBazaarRestore(purchases) به سایت می‌دهد. هر خرید به
  // /api/payment/bazaar/purchase فرستاده می‌شود (idempotent — توکن مصرف‌شده
  // دوباره فعال نمی‌کند) و بعد از فعال‌سازی موفق consume می‌شود تا تمدید
  // بعدی ممکن باشد. سناریو: کرش اپ بین پرداخت و فعال‌سازی سرور.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__fitupBazaarRestore = async (purchases: any[]) => {
      if (!Array.isArray(purchases) || purchases.length === 0) return;
      for (const p of purchases) {
        try {
          const productId = String(p?.productId || "");
          const planId = String(p?.planId || productId.replace(/^fitup_/, ""));
          const purchaseToken = String(p?.purchaseToken || "");
          if (!productId || !purchaseToken || !planId) continue;
          const res = await fetch("/api/payment/bazaar/purchase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planId,
              productId,
              purchaseToken,
              orderId: p?.orderId || null,
            }),
          });
          if (res.ok) {
            try {
              (window as any).FitUpNative?.consumePurchase?.(purchaseToken);
            } catch {}
          }
        } catch {}
      }
    };
    return () => {
      try {
        delete (window as any).__fitupBazaarRestore;
      } catch {}
    };
  }, []);

  // ─── popstate: ساده! فقط URL را دوباره بخوان ───
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = () => {
      const store = useAppStore.getState();
      const currentScreen = store.screen;

      // ─── در پنل ورزشکار: tab غیر dashboard → dashboard ───
      if (currentScreen === "main") {
        const currentTab = store.mainTab;
        if (currentTab && currentTab !== "dashboard") {
          store.setMainTab("dashboard");
          window.history.pushState(null, "", window.location.href);
          return;
        }
        // در dashboard
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
        if (isStandalone) {
          // دیالوگ درون‌برنامه‌ای به‌جای confirm() — در WebView محدود confirm
          // همیشه false برمی‌گرداند و کاربر با دکمه back گیر می‌کرد
          setShowExitConfirm(true);
          // یک entry دوباره push می‌کنیم تا back بعدی (وقتی دیالوگ باز است)
          // مستقیماً از برنامه خارج نکند
          window.history.pushState(null, "", window.location.href);
        } else {
          // مرورگر معمولی: به landing برگرد
          store.setScreen("landing");
        }
        return;
      }

      // ─── ادمین: در PWA اعلان خروج ───
      if (currentScreen === "admin") {
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
        if (isStandalone) {
          // دیالوگ درون‌برنامه‌ای به‌جای confirm() (همان مشکل WebView محدود)
          setShowExitConfirm(true);
          window.history.pushState(null, "", window.location.href);
        }
        return;
      }

      // ─── صفحات عمومی: URL را دوباره بخوان ───
      // مرورگر URL را تغییر داده، ما فقط آن را می‌خوانیم
      applyUrlToScreen();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── خروج از PWA (تأییدشده با دیالوگ) ───
  // بستن پنجره در PWA نصب‌شده معمولاً توسط مرورگر مجاز نیست → تلاش می‌کنیم
  // و همیشه به لندینگ برمی‌گردیم (اگر close موفق باشد صفحه unload می‌شود و
  // setScreen عملاً اجرا نمی‌شود).
  function exitPwaApp() {
    setShowExitConfirm(false);
    try {
      window.close();
    } catch {}
    setScreen("landing");
  }

  // ─── تایتل پویا ───
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.title = PAGE_TITLES[screen] || "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه";
  }, [screen]);

  // ─── اسکرول: هر بار که screen تغییر می‌کند، به بالا برو ───
  // استثنا: landing — اسکرول حفظ می‌شود (مرورگر خودش مدیریت می‌کند)
  // این مشکل «لینک از وسط صفحه → صفحه جدید از وسط باز می‌شود» را حل می‌کند
  const prevScreenRef = useRef(screen);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // همه صفحات به‌جز landing — وقتی screen تغییر می‌کند، اسکرول به بالا
    if (screen !== "loading" && screen !== prevScreenRef.current && screen !== "landing") {
      window.scrollTo(0, 0);
    }
    prevScreenRef.current = screen;
  }, [screen]);

  // ═══════════════════════════════════════════════════════════════
  //  رندر صفحه بر اساس screen
  // ═══════════════════════════════════════════════════════════════

  // FE-C1: onDone فلگ paymentVerify را ریست می‌کند تا کاربر بعد از خروج از
  // صفحهٔ نتیجهٔ پرداخت (موفق/ناموفق) در آن گیر نکند — قبلاً این فلگ فقط در
  // mount ست می‌شد و هیچ مسیری false‌اش نمی‌کرد (نجات فقط با reload).
  if (paymentVerify)
    return <PaymentVerifyHandler onDone={() => setPaymentVerify(false)} />;
  if (screen === "loading") return <SplashLoader />;
  if (screen === "referral-landing" && refCode) return <ReferralLanding refCode={refCode} />;
  if (screen === "landing") return (
    <>
      <LandingPage />
      <NikaWidget />
    </>
  );
  if (screen === "auth") return (
    <>
      <AuthScreen />
      <NikaWidget />
    </>
  );
  if (screen === "onboarding") return (
    <>
      <OnboardingScreen />
      <NikaWidget />
    </>
  );
  if (screen === "analysis") return <AnalysisScreen />;
  if (screen === "admin") {
    return (
      <div className="fixed inset-0 bg-white">
        <AdminOverlay standalone />
        <PwaExitConfirmDialog
          open={showExitConfirm}
          onStay={() => setShowExitConfirm(false)}
          onExit={exitPwaApp}
        />
      </div>
    );
  }
  if (screen === "tool-tdee" || screen === "tool-exercises" || screen === "tool-foods") {
    return (
      <>
        <ToolsNav />
        {screen === "tool-tdee" && <TdeeCalculator />}
        {screen === "tool-exercises" && <ExercisesDatabase />}
        {screen === "tool-foods" && <FoodCalorieIndex />}
        <NikaWidget />
      </>
    );
  }
  if (screen === "terms") return (
    <>
      <TermsPage />
      <NikaWidget />
    </>
  );
  if (screen === "contact") return (
    <>
      <ContactPage />
      <NikaWidget />
    </>
  );
  if (screen === "articles") return <ArticlesPage />;
  if (screen === "article") return <ArticlePage />;
  if (screen === "exercise-detail") return <ExerciseDetailPage />;
  if (screen === "food-detail") return <FoodDetailPage />;
  return (
    <>
      <MainApp />
      <PwaExitConfirmDialog
        open={showExitConfirm}
        onStay={() => setShowExitConfirm(false)}
        onExit={exitPwaApp}
      />
    </>
  );
}
