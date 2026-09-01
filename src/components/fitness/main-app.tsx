"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Apple,
  TrendingUp,
  MessageCircle,
  Crown,
  ClipboardList,
  Dumbbell,
  Gift,
  Headphones,
  Smartphone,
  Loader2,
} from "lucide-react";
import { useAppStore, restoreActiveSession, type MainTab } from "@/lib/fitness/store";
import { isFitUpBazaarApp } from "@/lib/fitness/bazaar-bridge";
import { ProgramsView } from "@/components/fitness/views/programs-view";
import { WorkoutsView } from "@/components/fitness/views/workouts-view";
import { NutritionView } from "@/components/fitness/views/nutrition-view";
import { PlansView } from "@/components/fitness/views/plans-view";
import { ReferralView } from "@/components/fitness/views/referral-view";
import { SupportView } from "@/components/fitness/views/support-view";
import { MobileAppView } from "@/components/fitness/views/mobile-app-view";
import { ViewErrorBoundary } from "@/components/fitness/view-error-boundary";
import { NotificationsOverlay } from "@/components/fitness/views/notifications-overlay";
import { ProfileOverlay } from "@/components/fitness/views/profile-overlay";
import { SubscriptionOverlay } from "@/components/fitness/views/subscription-overlay";
import { TopBar } from "@/components/fitness/top-bar";
import { Sidebar } from "@/components/fitness/sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// ─── Lazy-load کامپوننت‌های سنگین (درخواست مالک: اپ نرم‌تر و سریع‌تر) ───
// این کامپوننت‌ها هزاران خط کد + recharts + markdown دارند ولی فقط در
// لحظه‌ی نیاز باز می‌شوند — با جدا کردنشان از باندل اصلی، اولین بارگذاری
// پنل برای همه کاربران (موبایل/WebView بازار) به‌طور محسوسی سبک‌تر می‌شود.
// Skeleton مشترک برای همه:
const ViewSkeleton = () => (
  <div className="flex flex-col items-center justify-center py-16 gap-2 h-full">
    <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
    <p className="text-xs text-slate-400">در حال بارگذاری…</p>
  </div>
);

// تب‌های سنگین (نمودار/چت) — فقط با باز شدن تب لود می‌شوند
const DashboardView = dynamic(() => import("@/components/fitness/views/dashboard-view").then((m) => m.DashboardView), { ssr: false, loading: ViewSkeleton });
const ProgressView = dynamic(() => import("@/components/fitness/views/progress-view").then((m) => m.ProgressView), { ssr: false, loading: ViewSkeleton });
const ChatView = dynamic(() => import("@/components/fitness/views/chat-view").then((m) => m.ChatView), { ssr: false, loading: ViewSkeleton });

// Overlayهای سنگین — ادمین (۹هزار خط!) فقط برای ادمین‌ها لود می‌شود
const AdminOverlay = dynamic(() => import("@/components/fitness/views/admin-overlay").then((m) => m.AdminOverlay), { ssr: false, loading: ViewSkeleton });
const GymModeView = dynamic(() => import("@/components/fitness/views/gym-mode-view").then((m) => m.GymModeView), { ssr: false, loading: ViewSkeleton });
const VideoAnalysisView = dynamic(() => import("@/components/fitness/views/video-analysis-view").then((m) => m.VideoAnalysisView), { ssr: false, loading: ViewSkeleton });
const BloodTestView = dynamic(() => import("@/components/fitness/views/blood-test-view").then((m) => m.BloodTestView), { ssr: false, loading: ViewSkeleton });
const SurveyOverlay = dynamic(() => import("@/components/fitness/views/survey-overlay").then((m) => m.SurveyOverlay), { ssr: false, loading: ViewSkeleton });
const ExerciseDetailOverlay = dynamic(() => import("@/components/fitness/views/exercise-detail-overlay").then((m) => m.ExerciseDetailOverlay), { ssr: false, loading: ViewSkeleton });
const ActiveWorkoutSession = dynamic(() => import("@/components/fitness/views/active-workout-session").then((m) => m.ActiveWorkoutSession), { ssr: false, loading: ViewSkeleton });
// صفحه تمدید — فقط وقتی کاربر بخواهد تمدید کند
const RenewalOverlay = dynamic(() => import("@/components/fitness/views/renewal-overlay").then((m) => m.RenewalOverlay), { ssr: false, loading: ViewSkeleton });

const NAV_ITEMS_ALL: { id: MainTab; label: string; icon: any }[] = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { id: "programs", label: "برنامه‌ها", icon: ClipboardList },
  { id: "workouts", label: "تمرین‌ها", icon: Dumbbell },
  { id: "nutrition", label: "دستیار تغذیه", icon: Apple },
  { id: "progress", label: "پیشرفت", icon: TrendingUp },
  { id: "chat", label: "چت با فیتاپ", icon: MessageCircle },
  { id: "referral", label: "معرفی به دوست", icon: Gift },
  { id: "support", label: "پشتیبانی", icon: Headphones },
  { id: "mobileapp", label: "اپ موبایل", icon: Smartphone },
  { id: "plans", label: "پلن‌ها", icon: Crown },
];

// ═══ FE-M8: دکمه back اندروید/مرورگر اول overlay (Sheet) را می‌بندد ═══
// وقتی overlay (پروفایل/اعلان/اشتراک/...) باز است، popstate (back) فقط overlay
// را می‌بندد، نه خروج از پنل/landing.
// مهم: این listener در سطح module ثبت می‌شود تا قبل از popstate handler اصلی
// (page-client — که در useEffect بعد از mount ثبت می‌شود) اجرا شود؛ به این
// ترتیب stopImmediatePropagation مانع reset شدن تب/رفتن به landing/confirm
// خروج در PWA می‌شود. فلگ روی window از ثبت تکراری در HMR جلوگیری می‌کند.
if (typeof window !== "undefined" && !(window as any).__fitupOverlayBackGuard) {
  (window as any).__fitupOverlayBackGuard = true;
  window.addEventListener("popstate", (e: PopStateEvent) => {
    const st = useAppStore.getState();
    if (st.screen === "main" && st.overlay) {
      st.setOverlay(null);
      // یک entry دوباره push می‌کنیم تا back بعدی مستقیماً از پنل خارج نکند
      try {
        window.history.pushState({ fitupOverlay: true }, "", window.location.href);
      } catch {}
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

export function MainApp() {
  const {
    mainTab,
    overlay,
    setOverlay,
    activeSession,
  } = useAppStore();

  // ─── در اپ اندروید بازار، تب «اپ موبایل» پنهان است (درخواست مالک) ───
  // کاربر داخل اپ بازار است — نصب اپ/پرومپت‌های PWA برایش بی‌معناست و فقط
  // جا را اشغال می‌کند. تب برای PWA/مرورگر دست‌نخورده می‌ماند.
  // reactive چک می‌شود چون bridge بازار بعد از آماده شدن صفحه قابل اطمینان است.
  const [navItems, setNavItems] = useState(NAV_ITEMS_ALL);
  useEffect(() => {
    try {
      if (isFitUpBazaarApp()) {
        setNavItems(NAV_ITEMS_ALL.filter((n) => n.id !== "mobileapp"));
      }
    } catch {}
  }, []);

  // ─── Polling نوتیف‌ها ───
  // وقتی overlay اعلانات باز است، polling سریع‌تر (هر ۱۰ ثانیه) می‌شود تا
  // حس real-time به کاربر بدهد. در حالت عادی هر ۳۰ ثانیه poll می‌کنیم تا
  // بار روی سرور کم باشد. وقتی نوتیف جدید می‌آید، setNotifications صدا
  // زده می‌شود که unreadCount را هم در-store به‌روز می‌کند و badge بلافاصله
  // آپدیت می‌شود.
  useEffect(() => {
    let cancelled = false;
    // ─── نوتیف native در اپ کافه‌بازار ───
    // web-push داخل WebView کار نمی‌کند؛ به‌جای آن پل JS اپ اندروید
    // (window.FitUpNative.showNotification) نوتیف سیستم اندروید را نشان می‌دهد.
    // فقط وقتی تعداد ناخوانده «افزایش» یافته و baseline قبلی موجود است
    // (اولین poll بعد از باز شدن اپ اسپم نمی‌کند).
    //
    // ─── چت/نیکا در اپ بازار اعلان سیستم ندارد ───
    // درخواست صریح مالک: نوتیف‌های «چت» (نوع coach = پیام‌های چت ربات/مربی و
    // نیکا) در اپ بازار نباید به‌صورت اعلان اندروید نمایش داده شوند — تجربه
    // چت داخل خود اپ کافی است. فقط در اپ بازار فیلتر می‌شوند (PWA/مرورگر دست‌نخورده).
    const CHAT_NOTIFICATION_TYPES = new Set(["coach"]);
    const nativeNotify = (items: any[]) => {
      try {
        const native = (window as any).FitUpNative;
        if (!native?.showNotification) return;
        if (isFitUpBazaarApp()) {
          const newestNonChat = items.find(
            (n: any) => !n?.read && !CHAT_NOTIFICATION_TYPES.has(n?.type)
          );
          if (newestNonChat?.title) {
            native.showNotification(
              String(newestNonChat.title),
              String(newestNonChat.body || "")
            );
          }
          return;
        }
        const newest = items.find((n: any) => !n?.read);
        if (newest?.title) native.showNotification(String(newest.title), String(newest.body || ""));
      } catch {}
    };

    const loadNotifications = async () => {
      // همیشه poll می‌کنیم — حتی وقتی overlay باز است.
      // store یکپارچه است و overlay از همان state می‌خواند، بنابراین
      // به‌روزرسانی‌های real-time مستقیماً در overlay و badge نمایش داده می‌شود.
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          // فقط اگر داده واقعاً تغییر کرده باشد، state را آپدیت کن (جلوگیری از flicker)
          // مهم: مقایسه با آخرین state از store (getState) انجام می‌شود نه closure
          // effect — قبلاً آرایه notifications از closure کهنه خوانده می‌شد و
          // مقایسه همیشه با snapshot قدیمی بود (stale closure / flicker).
          const newJson = JSON.stringify(data.notifications || []);
          const oldJson = JSON.stringify(useAppStore.getState().notifications);
          if (newJson !== oldJson) {
            const prevItems = useAppStore.getState().notifications;
            const prevUnread = prevItems.filter((n: any) => !n?.read).length;
            const nextItems: any[] = data.notifications || [];
            const nextUnread = nextItems.filter((n: any) => !n?.read).length;
            useAppStore.getState().setNotifications(nextItems);
            // ─── نوتیف سیستم اندروید (فقط اپ کافه‌بازار) ───
            // فقط وقتی ناخوانده‌ها «افزایش» یافته‌اند و baseline قبلی موجود است
            // (آرایه قبلی غیرخالی) — تا اولین poll بعد از باز شدن اپ اسپم نکند.
            if (nextUnread > prevUnread && prevItems.length > 0) {
              nativeNotify(nextItems);
            }
          }
        }
      } catch {}
    };
    loadNotifications();
    // Polling تطبیقی: وقتی overlay اعلانات باز است، هر ۱۰ ثانیه؛ در غیر این
    // صورت هر ۳۰ ثانیه. فقط یک interval فعال است (نه دو interval همزمان).
    const pollInterval = overlay === "notifications" ? 10000 : 30000;
    const interval = setInterval(loadNotifications, pollInterval);
    // وقتی کاربر به تب برمی‌گردد (بعد از tab switch یا minimize)، فوراً یک
    // poll اجرا می‌کنیم تا badge همیشه به‌روز باشد.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        loadNotifications();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    // ─── Real-time push listener ───
    // وقتی service worker یک push notification دریافت می‌کند (حتی اگر اپ باز
    // باشد)، یک پیام 'PUSH_RECEIVED' به صفحه ارسال می‌کند. این listener آن
    // پیام را می‌گیرد و فوراً نوتیف‌ها را از سرور refresh می‌کند — بدون
    // منتظر ماندن برای polling بعدی.
    const onControllerMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED" && !cancelled) {
        loadNotifications();
      }
    };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", onControllerMessage);
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener("message", onControllerMessage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay]);

  // با باز شدن هر overlay یک history entry push می‌کنیم تا back آن را ببندد
  // (listener سطح module بالا در popstate آن را می‌بندد)
  useEffect(() => {
    if (overlay) {
      try {
        window.history.pushState({ fitupOverlay: true }, "", window.location.href);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay]);

  // ─── FE-M9: sync تب فعلی در URL ───
  // با تغییر تب، URL با replaceState به‌روز می‌شود تا refresh/share تب را
  // نگه دارد. پارامترها با page-client هماهنگ‌اند: ?screen=panel&tab=X
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (useAppStore.getState().screen !== "main") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("screen", "panel");
      url.searchParams.set("tab", mainTab);
      window.history.replaceState(null, "", url.toString());
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab]);

  // ─── FE-H7: بازیابی جلسه تمرین فعال بعد از refresh (<۲۴ ساعت) ───
  useEffect(() => {
    restoreActiveSession();
  }, []);

  return (
    <div className="min-h-screen bg-white flex">
      {/* Desktop Sidebar */}
      <Sidebar navItems={navItems} />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 lg:mr-72 bg-white">
        <TopBar />

        <main className="flex-1 overflow-hidden pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={mainTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              // ─── انیمیشن سریع‌تر تب‌ها (درخواست مالک: اپ نرم‌تر) ───
              // قبلاً ۰.۳ثانیه×۲ (خروج+ورود با mode=wait) = ۶۰۰ms تأخیر در
              // هر تعویض تب — عامل اصلی حس «لگ» در ناوبری موبایل.
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="h-full"
            >
              {mainTab === "dashboard" && (
                <ViewErrorBoundary viewName="داشبورد" resetKey={mainTab}>
                  <DashboardView />
                </ViewErrorBoundary>
              )}
              {mainTab === "programs" && (
                <ViewErrorBoundary viewName="برنامه‌ها" resetKey={mainTab}>
                  <ProgramsView />
                </ViewErrorBoundary>
              )}
              {mainTab === "workouts" && (
                <ViewErrorBoundary viewName="تمرین‌ها" resetKey={mainTab}>
                  <WorkoutsView />
                </ViewErrorBoundary>
              )}
              {mainTab === "nutrition" && (
                <ViewErrorBoundary viewName="تغذیه" resetKey={mainTab}>
                  <NutritionView />
                </ViewErrorBoundary>
              )}
              {mainTab === "progress" && (
                <ViewErrorBoundary viewName="پیشرفت" resetKey={mainTab}>
                  <ProgressView />
                </ViewErrorBoundary>
              )}
              {mainTab === "chat" && (
                <ViewErrorBoundary viewName="چت با مربی" resetKey={mainTab}>
                  <ChatView />
                </ViewErrorBoundary>
              )}
              {mainTab === "referral" && (
                <ViewErrorBoundary viewName="معرفی دوستان" resetKey={mainTab}>
                  <ReferralView />
                </ViewErrorBoundary>
              )}
              {mainTab === "support" && (
                <ViewErrorBoundary viewName="پشتیبانی" resetKey={mainTab}>
                  <SupportView />
                </ViewErrorBoundary>
              )}
              {mainTab === "mobileapp" && (
                <ViewErrorBoundary viewName="اپلیکیشن" resetKey={mainTab}>
                  <MobileAppView />
                </ViewErrorBoundary>
              )}
              {mainTab === "plans" && (
                <ViewErrorBoundary viewName="اشتراک و پلن‌ها" resetKey={mainTab}>
                  <PlansView />
                </ViewErrorBoundary>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Active workout session overlay (full-screen) — با Error Boundary تا کرش رندر، کل اپ را سفید نکند */}
      <AnimatePresence>
        {activeSession && (
          <ViewErrorBoundary viewName="جلسه تمرین">
            <ActiveWorkoutSession />
          </ViewErrorBoundary>
        )}
      </AnimatePresence>

      {/* Sheet overlays */}
      <Sheet open={overlay === "notifications"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[85vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">اعلان‌ها</SheetTitle>
          <NotificationsOverlay />
        </SheetContent>
      </Sheet>
      <Sheet open={overlay === "profile"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[90vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">پروفایل</SheetTitle>
          <ProfileOverlay />
        </SheetContent>
      </Sheet>
      <Sheet open={overlay === "subscription"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[90vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">ارتقای اشتراک</SheetTitle>
          <SubscriptionOverlay />
        </SheetContent>
      </Sheet>
      <Sheet open={overlay === "admin"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[95vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">پنل مدیریت</SheetTitle>
          <AdminOverlay />
        </SheetContent>
      </Sheet>
      <Sheet open={overlay === "exerciseDetail"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[85vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">جزئیات حرکت</SheetTitle>
          <ExerciseDetailOverlay />
        </SheetContent>
      </Sheet>
      <Sheet open={overlay === "gymMode"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[95vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">حالت باشگاه</SheetTitle>
          <GymModeView />
        </SheetContent>
      </Sheet>
      <Sheet open={overlay === "videoAnalysis"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[90vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">تحلیل ویدیو</SheetTitle>
          <VideoAnalysisView />
        </SheetContent>
      </Sheet>
      <Sheet open={overlay === "bloodTest"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[90vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">تست خون</SheetTitle>
          <BloodTestView />
        </SheetContent>
      </Sheet>
      <Sheet open={overlay === "survey"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[90vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">نظرسنجی پایان پلن</SheetTitle>
          <SurveyOverlay />
        </SheetContent>
      </Sheet>
      {/* ─── تجربه تمدید اشتراک — صفحه اختصاصی زیبا برای نگه‌داشتن کاربر ─── */}
      <Sheet open={overlay === "renewal"} onOpenChange={(o) => !o && setOverlay(null)}>
        <SheetContent side="bottom" showCloseButton={false} className="h-[92vh] p-0" dir="rtl">
          <SheetTitle className="sr-only">تمدید اشتراک</SheetTitle>
          <RenewalOverlay />
        </SheetContent>
      </Sheet>
    </div>
  );
}
