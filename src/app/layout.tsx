import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/fitness/theme-provider";
import { HeadCodeInjector } from "@/components/fitness/head-code-injector";
import { PwaRegister } from "@/components/fitness/pwa-register";
import { PwaInstallPrompt } from "@/components/fitness/pwa-install-prompt";
// PwaInstallPrompt حذف شد — نصب از طریق خود مرورگر
import { ErrorCapture } from "@/components/fitness/error-capture";
// BackButtonHandler حذف شد — popstate در page.tsx مدیریت می‌شود (جلوگیری از تداخل)
import { GlobalNewTermsModal } from "@/components/fitness/global-new-terms-modal";

const vazirmatn = localFont({
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
  preload: true,
});

// دامنه سایت — fittup.ir
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه",
    template: "%s | فیتاپ",
  },
  description:
    "برنامه بدنسازی آنلاین فیتاپ — برنامه تمرینی، غذایی و مکمل شخصی‌سازی‌شده. دنیایی از تجربه بدنسازی با بهترین مربیان ایران. حجمی، کات، رژیم غذایی برای آقایان و بانوان.",
  applicationName: "فیتاپ",
  // Google Search Console verification — کد جدید برای fittup.ir
  verification: {
    google: "FBUeu2ZuRqKrlnu_aweORxGbh3gxSYHOlA1jhX4xiDs",
  },
  keywords: [
    // ─── Primary (اصلی) ───
    "برنامه بدنسازی",
    "برنامه تمرینی بدنسازی",
    "برنامه غذایی بدنسازی",
    "برنامه مکمل بدنسازی",
    "رژیم غذایی بدنسازی",
    "برنامه حجمی بدنسازی",
    "برنامه کات چربی سوزی بدنسازی",
    // ─── Pricing / تعرفه ───
    "تعرفه برنامه بدنسازی",
    "قیمت برنامه بدنسازی",
    "قیمت برنامه ورزشی",
    "تعرفه برنامه تمرینی",
    "قیمت برنامه تمرینی",
    "تعرفه برنامه غذایی",
    "قیمت برنامه غذایی",
    "هزینه برنامه بدنسازی",
    "خرید برنامه بدنسازی",
    "خرید برنامه ورزشی",
    // پایه (شامل واژگان تکی پرتقاضا)
    "برنامه تمرینی",
    "برنامه غذایی",
    "برنامه مکمل",
    // ─── Coach / مربی ───
    "مربی ورزشی",
    "مربی بدنسازی",
    "مربی خانم",
    "مربی آقا",
    "مربی هوشمند",
    "مربی آنلاین",
    "مربی شخصی",
    "مربی هوش مصنوعی ورزشی",
    // ─── Synonyms (مترادف‌ها) ───
    "برنامه ورزشی",
    "برنامه پرورش اندام",
    "روال تمرینی",
    "برنامه باشگاه",
    "رژیم غذایی",
    "برنامه تغذیه",
    "منوی غذایی",
    "پلن تغذیه",
    "برنامه مصرف مکمل",
    "استک مکمل",
    "پرورش اندام",
    "تناسب اندام",
    "فیتنس",
    // ─── Related / LSI ───
    "افزایش حجم عضلانی",
    "چربی سوزی",
    "کاهش وزن",
    "عضله سازی",
    "خشک کردن بدن",
    "سلامتی",
    "برنامه بدنسازی آقایان",
    "برنامه بدنسازی بانوان",
    "برنامه بدنسازی مبتدی",
    "برنامه بدنسازی حرفه‌ای",
    "برنامه بدنسازی در خانه",
    "برنامه بدنسازی در باشگاه",
    "حجم Bulking",
    "کات Cutting",
    "بدنسازی طبیعی",
    "دوره حجم",
    "دوره کات",
    "کالری",
    "درشت‌مغذی‌ها",
    // ─── High-Intent (قصد خرید بالا) ───
    "خرید برنامه بدنسازی",
    "خرید برنامه بدنسازی آنلاین",
    "بهترین برنامه تمرینی بدنسازی",
    "بهترین برنامه غذایی بدنسازی",
    "برنامه بدنسازی شخصی‌سازی شده",
    "برنامه بدنسازی آنلاین",
    "برنامه بدنسازی ارزان",
    "برنامه بدنسازی رایگان",
    // ─── Long-Tail (افعال و اهداف) ───
    "برنامه بدنسازی برای افزایش وزن",
    "برنامه بدنسازی برای کاهش وزن",
    "برنامه بدنسازی برای افزایش وزن در خانه",
    "برنامه بدنسازی برای مبتدیان",
    "برنامه بدنسازی برای حرفه‌ایان",
    "برنامه بدنسازی ۳ روز در هفته",
    "برنامه بدنسازی ۴ روز در هفته",
    "برنامه بدنسازی ۳ جلسه در هفته",
    "برنامه بدنسازی بدون تجهیزات",
    "برنامه بدنسازی با دمبل",
    "برنامه غذایی برای حجم‌گیری",
    "برنامه غذایی برای چربی‌سوزی",
    "برنامه غذایی برای کاهش وزن",
    "برنامه غذایی برای عضله‌سازی",
    "برنامه غذایی حجمی برای آقایان مبتدی",
    "برنامه تمرینی و غذایی شخصی‌سازی شده",
    // ─── Tools / Movements / Metrics (ابزارها، بانک حرکات و سنجش‌ها) ───
    "محاسبه کالری روزانه",
    "جدول کالری غذاها",
    "بانک حرکات بدنسازی",
    "آموزش حرکات بدنسازی",
    "تمرینات بدنسازی",
    "حرکات قدرتی",
    "حرکات هایپرتروفی",
    "پروتئین روزانه",
    "کالری روزانه",
    "درصد چربی بدن",
    "شاخص توده بدنی BMI",
    "TDEE محاسبه",
    // ─── Supplements (مکمل‌ها — پایه) ───
    "مکمل‌های ورزشی",
    "مکمل بدنسازی",
    "کراتین",
    "پروتئین وی",
    "امگا ۳",
    // ─── Regional (منطقه‌ای — ایران) ───
    "برنامه بدنسازی ایرانی",
    "مربی بدنسازی ایرانی",
    "برنامه غذایی ایرانی",
    "غذاهای ایرانی کالری",
    "جدول کالری غذاهای ایرانی",
    // ─── Plans / Subscriptions (پلن و اشتراک) ───
    "خرید پلن بدنسازی",
    "اشتراک بدنسازی",
    "پلن اقتصادی بدنسازی",
    "پلن استاندارد بدنسازی",
    "پلن پیشرفته بدنسازی",
    "پلن حرفه‌ای بدنسازی",
    // ─── Brand + English ───
    "فیتاپ",
    "fittup",
    "AI fitness coach",
    "workout plan",
    // ─── مکمل‌های تخصصی (Supplements — Pro) ───
    "کراتین مونوهیدرات",
    "کازئین پروتئین",
    "پروتئین ایزوله",
    "پروتئین کنسانتره",
    "گینر",
    "آمینو اسید",
    "BCAA",
    "EAA",
    "گلوتامین",
    "آرژنین",
    "سیترین",
    "بتاآلانین",
    "کافئین",
    "نایاسین",
    "ملاتونین",
    "زینک",
    "منیزیم",
    "کلسیم",
    "آهن",
    "ویتامین D",
    "ویتامین B12",
    "ویتامین C",
    "ویتامین E",
    "ویتامین K",
    "روغن ماهی",
    "فیش اویل",
    "مولتی ویتامین",
    "زینک منیزیم",
    "ZMA",
    "تورین",
    "ال-کارنیتین",
    "ال-تیروزین",
    "ال-سیستئین",
    "هورمون رشد",
    "تستوسترون بوستر",
    "تریبولوس",
    "مک جا",
    "اشواگاندا",
    "گینسنگ",
    "کلاژن",
    "اسید هیالورونیک",
    "MSM",
    "کرتین HCL",
    // ─── ویتامین‌ها به‌صورت تفکیک‌شده (Each Vitamin — Deep) ───
    "ویتامین A",
    "ویتامین B1",
    "ویتامین B2",
    "ویتامین B3",
    "ویتامین B5",
    "ویتامین B6",
    "ویتامین B7",
    "ویتامین B9",
    "ویتامین B12",
    "ویتامین C",
    "ویتامین D",
    "ویتامین E",
    "ویتامین K",
    "تیامین",
    "ریبوفلاوین",
    "نیاسین",
    "پانتوتنیک اسید",
    "پیریدوکسین",
    "بیوتین",
    "فولیک اسید",
    "کوبالامین",
    "اسید اسکوربیک",
    "توکوفرول",
    "کینون",
    // ─── مکمل‌های گیاهی و طبیعی (Herbal/Adaptogens — Deep) ───
    "جینسنگ قرمز",
    "جینسنگ کره‌ای",
    "ماکا روت",
    "ماکا پرویی",
    "اشواگاندا",
    "آشواگاندا",
    "تورین",
    "شیلجیت",
    "شیلاجیت",
    "تریبولوس ترستریس",
    "مک جا",
    "فنوگریک",
    "تونکات علی",
    // ─── مکمل‌های پیش‌تمرین (Pre-Workout — Deep) ───
    "پیش تمرین",
    "پری ورک‌اوت",
    "N.O. booster",
    "نیتریک اکساید بوستر",
    "آرژنین AKG",
    "آرژنین آلفا کتوگلوتارات",
    "سیترین مالات",
    "سیترین",
    "آرژنین",
    // ─── مکمل‌های ریکاوری (Recovery — Deep) ───
    "گلوتامین",
    "کلاژن هیدرولیز شده",
    "کلاژن هیدرولیزاته",
    "کراتین HCL",
    "کراتین هیدروکلراید",
    "کراتین مونوهیدرات",
    // ─── استروئیدها و داروها (فقط اطلاعات آموزشی) ───
    "استروئید آنابولیک",
    "تستوسترون",
    "تستوسترون انانتات",
    "تستوسترون سیپیونات",
    "تستوسترون پروپیونات",
    "ناندولون",
    "دکا دورابولین",
    "ترنبالون",
    "وینسترول",
    "آناور",
    "دیانابول",
    "کلن بوترول",
    "هورمون رشد انسانی",
    "HGH",
    "IGF-1",
    "انسولین",
    "PCT",
    "درمان پس از دوره",
    "آنتی استروژن",
    "کلومید",
    "نولوادکس",
    "آرمیدکس",
    "پروویرون",
    "اچ سی جی",
    "HCG",
    // ─── استروئیدهای بیشتر (فقط آموزشی — Steroids Deep) ───
    "اکسی‌مثلون",
    "آنادرول",
    "فلویوکسترون",
    "هالوتستین",
    "مسترولون",
    "پروویرون",
    "دروستانولون",
    "مسترولون",
    "متندیلون",
    "داینبول",
    "تورینابول",
    "پارابولان",
    "آناور",
    "وینسترول",
    "ترنبالون",
    // ─── SARMs (Selective Androgen Receptor Modulators — فقط آموزشی) ───
    "SARM",
    "SARMs",
    "اوستارین",
    "اوستarine",
    "لیناگولوتامید",
    "لیگاندرول",
    "رادارین",
    "رادارین 140",
    "آندارین",
    "آندارین S4",
    "مکمل SARM",
    // ─── پروتکل‌های PCT (PCT Protocols — فقط آموزشی) ───
    "پروتکل PCT",
    "کلومید و نولوادکس",
    "HCG و آرمیدکس",
    "HCG و آریمازول",
    "درمان پس از دوره استروئید",
    // ─── حرکات تخصصی (Exercises) ───
    "پرس سینه",
    "پرس بالاسینه",
    "پرس زیرسینه",
    "اسکوات",
    "اسکوات جلو",
    "ددلیفت",
    "ددلیفت رومانیایی",
    "لات پولدان",
    "بارفیکس",
    "پرس سرشانه",
    "پرس نظامی",
    "شنا",
    "دیپ",
    "لانگز",
    "پرس پا",
    "جلو ران",
    "پشت ران",
    "ساق پا",
    "زیربغل قایقی",
    "زیربغل دمبل",
    "جلو بازو",
    "پشت بازو",
    "ساعد",
    "کرانچ",
    "پلانک",
    "هایپراکستنشن",
    "کشش",
    "فوم رولر",
    // ─── حرکات کلاژن و کور (Rotator Cuff / Prehab — Deep) ───
    "face pull",
    "فیس پول",
    "external rotation",
    "چرخش خارجی شانه",
    "internal rotation",
    "چرخش داخلی شانه",
    "Y-Raise",
    "Y ریز",
    "T-Raise",
    "T ریز",
    "روتاتور کاف",
    "rotator cuff",
    "حرکات کلاژن",
    "حرکات کور",
    "فرم اصلاحی",
    // ─── حرکات کالیشتیک (Calisthenics — Deep) ───
    "muscle up",
    "ماسل آپ",
    "front lever",
    "فرانت لور",
    "back lever",
    "بک لور",
    "human flag",
    "پرچم انسانی",
    "planche",
    "پلانش",
    "کالیشتیک",
    "کرن کالیشتیک",
    "هندستند",
    "handstand",
    "پارالترال",
    "بارفیکس کالیشتیک",
    // ─── حرکات المپیکی (Olympic Lifts — Deep) ───
    "clean and jerk",
    "کلین اند جِرک",
    "snatch",
    "اسنچ",
    "power clean",
    "پاور کلین",
    "وزنه‌برداری المپیکی",
    "حرکات المپیکی",
    "پرتاب وزنه",
    "split jerk",
    "اسکوات اسنچ",
    // ─── روش‌های تمرینی (Training Methods) ───
    "سوپرست",
    "تری‌ست",
    "جاینت‌ست",
    "دراپ‌ست",
    "رست پاز",
    "فش با پول",
    "تدریجی اضافه بار",
    "RPE",
    "RIR",
    "volume training",
    "intensity training",
    "فرکانسی تمرین",
    "دوره‌بندی",
    "خطی دوره‌بندی",
    "موجی دوره‌بندی",
    // ─── روش‌های تمرینی پیشرفته (Training Methods — Deep) ───
    "German Volume Training",
    "GVT تمرین",
    "حجم تمرین آلمانی",
    "5/3/1",
    "5/3/1 وندلر",
    "Starting Strength",
    "استارتینگ استرنگت",
    "PPL",
    "Push Pull Legs",
    "پوش پول پا",
    "Upper/Lower",
    "آپر لوور",
    "Bro Split",
    "برو اسپلیت",
    "BFR",
    "Blood Flow Restriction",
    "محدودیت جریان خون",
    "CAT",
    "Compensatory Acceleration Training",
    "Pre-Exhaust",
    "پیش تخلیه",
    "Post-Exhaust",
    "پس تخلیه",
    "Rest-Pause",
    "رست پاز",
    "Cluster Sets",
    "کلاستر ست",
    // ─── تغذیه تخصصی (Advanced Nutrition) ───
    "کالری مازاد",
    "کالری نقصان",
    "بولکینگ",
    "کاتینگ",
    "بولک تمیز",
    "بولک کثیف",
    "رفلید",
    "روز تقلب",
    "متغیر کالری",
    "سایکل کربوهیدرات",
    "کتوژنیک",
    "اینترمیتنت فاستینگ",
    "فستینگ",
    "پالئو",
    "وگان بدنسازی",
    "رژیم پروتئین بالا",
    "رژیم کم کربوهیدرات",
    "تایمینگ تغذیه",
    "پری ورک‌اوت",
    "پست ورک‌اوت",
    // ─── آنالیز و اندازه‌گیری (Analysis & Metrics) ───
    "درصد چربی بدن",
    "شاخص توده بدنی",
    "BMI",
    "BMR",
    "TDEE",
    "متابولیسم پایه",
    "متریک بدنی",
    "اندازه‌گیری عضلات",
    "پیشرفت ورزشی",
    "رکورد شخصی",
    "PR",
    "1RM",
    "ماکسیمم تکرار",
    "تست استقامت",
    "تست قدرت",
    // ─── مربیان و ورزشکاران (Athletes & Coaches) ───
    "رونال کلمن",
    "جی کاتلر",
    "فیل هیت",
    "دکستر جکسون",
    "مسابقات بدنسازی",
    "المپیا",
    "مستر المپیا",
    // ─── بیماری‌ها و مصدومیت‌ها (Injuries & Conditions) ───
    "کمردرد ورزشی",
    "آسیب شانه",
    "کشیدگی عضله",
    "التهاب تاندون",
    "کف پای صافی",
    "دیسک کمر",
    "آسیب زانو",
    "رباط صلیبی",
    "تنگی نفس ورزشی",
    "خستگی مزمن",
    "overtraining",
    "overreaching",
    "ریکاوری ورزشی",
    "استراحت فعال",
    "روز استراحت",
  ],
  authors: [{ name: "فیتاپ", url: SITE_URL }],
  creator: "فیتاپ",
  publisher: "فیتاپ",
  // NOTE: canonical در اینجا set نمی‌شود چون صفحات مختلف canonical متفاوتی دارند.
  // هر صفحه (مقاله، ابزار، لندینگ) canonical خود را با setLinkTag در client set می‌کند.
  // اگر canonical در اینجا set شود، همه صفحات canonical یکسان می‌شوند و گوگل خطای
  // "Alternative page with proper canonical tag" می‌دهد.
  openGraph: {
    title: "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه",
    description:
      "بهترین برنامه تمرینی و غذایی بدنسازی شخصی‌سازی‌شده با هوش مصنوعی. برنامه حجمی و برنامه کات (چربی‌سوزی)، برنامه مکمل، رژیم غذایی برای آقایان و بانوان، مبتدی و حرفه‌ای. خرید برنامه بدنسازی آنلاین با پشتیبانی ۲۴ ساعته — هر بدنی فیتاپ میخواد.",
    url: SITE_URL,
    siteName: "فیتاپ",
    locale: "fa_IR",
    type: "website",
    images: [
      {
        url: "/hero-fitup.webp",
        width: 886,
        height: 886,
        alt: "فیتاپ — اپلیکیشن تناسب اندام با هوش مصنوعی",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "برنامه بدنسازی آنلاین | فیتاپ",
    description:
      "بهترین برنامه تمرینی و غذایی بدنسازی شخصی‌سازی‌شده با هوش مصنوعی — برنامه حجمی، برنامه کات، رژیم غذایی. خرید برنامه بدنسازی آنلاین.",
    images: ["/hero-fitup.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.png"],
  },
  appleWebApp: {
    capable: true,
    title: "FitUp",
    statusBarStyle: "default",
  },
  category: "health",
};

export const viewport: Viewport = {
  // نارنجی سازمانی فیتاپ (#f97316) — نوار بالای مرورگر کروم/اندروید (قبلاً زرد #f59e0b بود)
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // viewportFit=cover برای فعال شدن env(safe-area-inset-*) در iOS —
  // بدون آن padding ناوبری پایین و TopBar زیر نوار وضعیت/هوم‌اندیکیتور می‌رود.
  viewportFit: "cover",
};

// ---- Structured data (JSON-LD) ----
// سازمان (Organization)
const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "فیتاپ",
  alternateName: "FitUp",
  url: SITE_URL,
  logo: `${SITE_URL}/fitup-logo.png`,
  description: "اپلیکیشن برنامه بدنسازی و تغذیه با تجربه بهترین مربیان ایران",
  slogan: "هر بدنی فیتاپ میخواد — برنامه بدنسازی آنلاین",
  sameAs: [SITE_URL],
};

// وب‌سایت (WebSite) با قابلیت جستجو
const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "فیتاپ",
  url: SITE_URL,
  inLanguage: "fa-IR",
  description: "برنامه بدنسازی و تغذیه شخصی‌سازی‌شده — دنیایی از تجربه بدنسازی در دستان شما. هر بدنی فیتاپ میخواد",
  publisher: { "@type": "Organization", name: "فیتاپ", url: SITE_URL },
};

// سوالات متداول (FAQPage)
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "آیا برنامه‌های فیتاپ علمی و معتبر هستند؟",
      acceptedAnswer: {
        "@type": "Answer",
        text: "بله! فیتاپ توسط بزرگترین مربیان بدنسازی دنیا طراحی شده است. هوش مصنوعی اختصاصی فیتاپ طبق الگوی آن‌ها آموزش دیده تا برنامه‌ای کاملاً علمی، ایمن و شخصی‌سازی‌شده برای شما بسازد — دقیقاً همان کیفیت یک مربی حرفه‌ای، اما سریع‌تر و ۲۴ ساعته در دسترس.",
      },
    },
    {
      "@type": "Question",
      name: "چگونه ثبت‌نام می‌کنم؟",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ثبت‌نام با شماره موبایل و تأیید پیامک یک‌بارمصرف (OTP) انجام می‌شود. کد ۴ رقمی به شماره شما پیامک می‌شود و پس از تأیید، حساب شما ایجاد یا وارد می‌شود. ورود OTP یعنی پذیرش قوانین.",
      },
    },
    {
      "@type": "Question",
      name: "آیا برنامه تمرینی برای شرایط من مناسب است؟",
      acceptedAnswer: {
        "@type": "Answer",
        text: "برنامه کاملاً بر اساس اطلاعات آنبوردینگ شما (جنسیت، سن، قد، وزن، هدف، آسیب‌دیدگی‌ها، تجهیزات و رژیم غذایی) شخصی‌سازی می‌شود. اگر آسیب‌دیدگی دارید، هوش مصنوعی حرکات ایمن و جایگزین پیشنهاد می‌دهد.",
      },
    },
    {
      "@type": "Question",
      name: "پرداخت اشتراک چگونه انجام می‌شود؟",
      acceptedAnswer: {
        "@type": "Answer",
        text: "پرداخت از طریق درگاه امن زرین‌پال انجام می‌شود. پس از انتخاب اشتراک، به درگاه هدایت می‌شوید و پس از پرداخت موفق، اشتراک بلافاصله فعال می‌شود. رسید پرداخت در اپلیکیشن ذخیره می‌شود.",
      },
    },
    {
      "@type": "Question",
      name: "آیا می‌توانم برنامه‌ام را تغییر دهم؟",
      acceptedAnswer: {
        "@type": "Answer",
        text: "بله! هر زمان که بخواهید می‌توانید با چت با مربی AI، جایگزین حرکت بخواهید، غذا را تعویض کنید یا درخواست بازسازی کل برنامه کنید. همچنین می‌توانید وزن جدید ثبت کنید و برنامه به‌روز می‌شود.",
      },
    },
    {
      "@type": "Question",
      name: "آیا اطلاعات و تصاویر من محرمانه می‌مانند؟",
      acceptedAnswer: {
        "@type": "Answer",
        text: "بله، حریم خصوصی شما برای ما مهم‌ترین اولویت است. تصاویر پیشرفت (Before/After) کاملاً خصوصی هستند و فقط برای خود شما نمایش داده می‌شوند. اطلاعات شما با هیچ شخص ثالثی به اشتراک گذاشته نمی‌شود.",
      },
    },
    {
      "@type": "Question",
      name: "آیا اپلیکیشن روی گوشی من کار می‌کند؟",
      acceptedAnswer: {
        "@type": "Answer",
        text: "بله! اپلیکیشن فیتاپ یک وب‌اپلیکیشن واکنش‌گرا (Responsive) است که روی همه گوشی‌های اندروید و iOS از طریق مرورگر کار می‌کند. نیازی به نصب نیست — فقط باز کنید و شروع کنید.",
      },
    },
    {
      "@type": "Question",
      name: "اگر اشتراکم منقضی شود چه می‌شود؟",
      acceptedAnswer: {
        "@type": "Answer",
        text: "پس از انقضای اشتراک، دسترسی به برنامه‌های جدید و چت محدود می‌شود، اما اطلاعات قبلی شما (وزن، پیشرفت، تصاویر) حفظ می‌شود. هر زمان که اشتراک را تمدید کنید، دوباره به همه امکانات دسترسی دارید.",
      },
    },
  ],
};

// محصول و پلن‌ها — SoftwareApplication (بهترین نوع برای اپلیکیشن)
// شامل aggregateRating (نظرات کاربران)، offers (پلن‌ها) و featureList
const softwareAppLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "فیتاپ",
  alternateName: "FitUp",
  applicationCategory: "HealthAndFitnessApplication",
  operatingSystem: "Web, Android, iOS",
  description:
    "اپلیکیشن جامع تناسب اندام با هوش مصنوعی: برنامه تمرینی و غذایی شخصی‌سازی‌شده، چت هوشمند ورزشی، آنالیز ویدیویی و آزمایش خون. هر بدنی فیتاپ میخواد.",
  url: SITE_URL,
  downloadUrl: SITE_URL,
  screenshot: `${SITE_URL}/hero-fitup.webp`,
  softwareVersion: "3.0",
  datePublished: "2024-01-01",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "IRR",
    lowPrice: "350000",
    highPrice: "1800000",
    offerCount: 4,
    offers: [
      {
        "@type": "Offer",
        name: "پلن اقتصادی",
        price: "350000",
        priceCurrency: "IRR",
        description: "شروع مسیر تناسب اندام — برنامه تمرین و تغذیه ۴۵ روزه",
        url: `${SITE_URL}/#pricing`,
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "پلن استاندارد",
        price: "800000",
        priceCurrency: "IRR",
        description: "برنامه کامل‌تر با مکمل و چکاپ دوره‌ای — ۴۵ روزه",
        url: `${SITE_URL}/#pricing`,
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "پلن پیشرفته",
        price: "1200000",
        priceCurrency: "IRR",
        description: "چت هوشمند + حالت باشگاه + آنالیز عکس — ۴۵ روزه",
        url: `${SITE_URL}/#pricing`,
        availability: "https://schema.org/InStock",
      },
      {
        "@type": "Offer",
        name: "پلن حرفه‌ای",
        price: "1800000",
        priceCurrency: "IRR",
        description: "آنالیز ویدیویی + آزمایش خون + پشتیبانی اختصاصی — ۴۵ روزه",
        url: `${SITE_URL}/#pricing`,
        availability: "https://schema.org/InStock",
      },
    ],
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "10000",
    bestRating: "5",
    worstRating: "1",
  },
  featureList: [
    "برنامه تمرینی هوشمند شخصی‌سازی‌شده با هوش مصنوعی",
    "برنامه غذایی و مکمل اختصاصی",
    "چت ۲۴ ساعته با مربی هوشمند (متن، عکس، ویدیو)",
    "آنالیز هوشمند وعده‌های غذایی با عکس",
    "آنالیز ویدیویی بدن و اصلاح تکنیک حرکات",
    "تحلیل آزمایش خون (۴۷ ماده)",
    "پیگیری پیشرفت وزن و اندام‌ها با نمودار",
    "حالت باشگاه (Gym Mode) با تایمر استراحت",
    "دستیار تغذیه (Nutrition Companion)",
    "۲۶۰+ حرکت ورزشی با آموزش گام‌به‌گام",
    "۱۰۰۰+ غذای سالم در بانک مواد غذایی",
  ],
  brand: { "@type": "Brand", name: "فیتاپ" },
  publisher: { "@type": "Organization", name: "فیتاپ", url: SITE_URL },
  inLanguage: "fa-IR",
};

// نظرات کاربران (Review) — برای نمایش ستاره‌ها در گوگل
const reviewsLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "فیتاپ — برنامه بدنسازی آنلاین",
  description: "اپلیکیشن تناسب اندام با هوش مصنوعی",
  brand: { "@type": "Brand", name: "فیتاپ" },
  image: `${SITE_URL}/hero-fitup.webp`,
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "10000",
    bestRating: "5",
  },
  review: [
    {
      "@type": "Review",
      author: { "@type": "Person", name: "رضا کریمی" },
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      reviewBody: "بهترین چت ورزشی که دیدم! هر بار سوالی داشتم سریع جواب میگرفتم. مخصوصاً قسمت تعویض حرکت برای آسیبدیدگی کمرم خیلی کمکم کرد.",
      name: "افزایش ۵ کیلو عضله",
    },
    {
      "@type": "Review",
      author: { "@type": "Person", name: "مریم احمدی" },
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      reviewBody: "برنامه غذایی فوق‌العادهست. با غذاهای ایرانی و در دسترس، ولی کاملاً سالم. نمودار پیشرفت وزن هم انگیزه زیادی میده.",
      name: "تناسب اندام پس از زایمان",
    },
    {
      "@type": "Review",
      author: { "@type": "Person", name: "امیر حسینی" },
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      reviewBody: "حتی به‌عنوان کسی که سالها بدنسازی کردم، تنوع حرکات و شخصی‌سازی برنامه واقعاً عالیه. تایمر استراحت و ثبت وزنه خیلی کاربردیه.",
      name: "بدنسازی حرفه‌ای",
    },
  ],
};

// BreadcrumbList برای صفحه اصلی
const breadcrumbLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "خانه",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "امکانات",
      item: `${SITE_URL}/#features`,
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "پلن‌ها و قیمت‌ها",
      item: `${SITE_URL}/#pricing`,
    },
    {
      "@type": "ListItem",
      position: 4,
      name: "سوالات متداول",
      item: `${SITE_URL}/#faq`,
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* ── تأییدیه‌ها ── */}
        {/* Google Search Console Verification — کد جدید برای fittup.ir */}
        <meta name="google-site-verification" content="FBUeu2ZuRqKrlnu_aweORxGbh3gxSYHOlA1jhX4xiDs" />
        {/* اینماد — کد جدید 24472446 */}
        <meta name="enamad" content="24472446" />
        {/* Microsoft Clarity */}
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "xi8940h5ty");`,
          }}
        />
        {/* Preconnect to third-party origins for faster resource loading */}
        <link rel="preconnect" href="https://www.clarity.ms" />
        <link rel="preconnect" href="https://www.clarity.ms" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.clarity.ms" />
        {/* Preload hero image (LCP element) — responsive srcset for mobile/desktop */}
        <link rel="preload" as="image" fetchPriority="high" href="/hero-fitup-desktop.webp" imageSrcSet="/hero-fitup-mobile.webp 500w, /hero-fitup-desktop.webp 800w, /hero-fitup.webp 886w" imageSizes="(max-width: 768px) 90vw, (max-width: 1024px) 50vw, 600px" />
        {/* Favicon */}
        {/* Favicon — FitUp logo with padding (full logo visible) */}
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png?v=7" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png?v=7" />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png?v=7" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=7" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png?v=7" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=7" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=7" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        {/* iOS PWA — full standalone mode (no Safari chrome) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FitUp" />
        {/* PWA manifest link (explicit, for older browsers) */}
        <link rel="manifest" href="/manifest.json" />
        {/* Theme-color فقط از viewport export بالا ست می‌شود (#f97316) —
            متای دستی تکراری حذف شد تا دو theme-color متناقض رندر نشود. */}
        {/* NOTE: canonical در page.tsx با generateMetadata set می‌شود (داینامیک بر اساس searchParams).
            در اینجا canonical set نمی‌کنیم تا با canonical صفحه تداخل نداشته باشد. */}

        {/* ─── PWA: نصب وب اپ ───
            beforeinstallprompt را capture می‌کنیم ولی preventDefault صدا نمی‌زنیم.
            این کار باعث می‌شود Chrome آیکون نصب خود را در نوار آدرس نشان دهد.
            همزمان event را ذخیره می‌کنیم تا دکمه نصب در تب اپ موبایل هم بتواند
            از آن استفاده کند. هر دو روش نصب واقعی وب اپ را انجام می‌دهند. */}
        <script dangerouslySetInnerHTML={{ __html: `
          // Capture beforeinstallprompt (بدون preventDefault)
          window.addEventListener('beforeinstallprompt', function(e) {
            window.__deferredPrompt = e;
            window.dispatchEvent(new CustomEvent('pwa-install-available'));
          });

          // Track نصب موفق
          window.addEventListener('appinstalled', function(e) {
            try { localStorage.setItem('pwa_installed', '1'); } catch {}
            window.dispatchEvent(new CustomEvent('pwa-install-status'));
            try { fetch('/api/pwa/installed', { method: 'POST' }).catch(function(){}); } catch {}
          });

          // ─── SSR: تشخیص PWA standalone برای سرور ───
          // display-mode فقط سمت کلاینت قابل خواندن است؛ این کوکی به سرور
          // اعلام می‌کند که کاربر داخل اپ نصب‌شده است تا screen اولیه درست
          // حساب شود (بدون فلش لندینگ قبل از auth).
          try {
            if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
              document.cookie = 'pwa_standalone=1; path=/; max-age=31536000; samesite=lax';
            } else if (document.cookie.indexOf('pwa_standalone=1') !== -1) {
              // دیگر standalone نیست (مثلاً حذف نصب) → کوکی را پاک کن
              document.cookie = 'pwa_standalone=; path=/; max-age=0; samesite=lax';
            }
          } catch (e) {}
        `}} />

        {/* Structured Data: Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        />
        {/* Structured Data: WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
        />
        {/* Structured Data: FAQPage */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
        {/* Structured Data: SoftwareApplication با offers و aggregateRating (بهترین نوع برای اپ) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppLd) }}
        />
        {/* Structured Data: Product با Reviews (نظرات کاربران برای ستاره‌های گوگل) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsLd) }}
        />
        {/* Structured Data: BreadcrumbList */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        />

        {/* Server-side injection of analytics/search-console/pixel codes (head placement) */}
        <HeadCodeInjector placement="head" />
      </head>
      <body
        className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground`}
      >
        {/* Server-side injection (body_start placement) */}
        <HeadCodeInjector placement="body_start" />
        {/* PWA: register service worker + install prompt banner */}
        <PwaRegister />
        {/* PWA: prevent accidental exit with back button */}
        {/* BackButtonHandler حذف شد — popstate در page.tsx مدیریت می‌شود */}
        {/* Capture client-side errors and log them for admin review */}
        <ErrorCapture />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          {children}
          {/* PWA: بنر/مودال نصب — دکمه «نصب برنامه» در ناوبری لندینگ و تب اپ موبایل
              از طریق event «show-pwa-install» به همین کامپوننت وصل می‌شود.
              (قبلاً حذف شده بود و دکمه‌ها بدون پاسخ مانده بودند — باگ دکمه مرده)
              کامپوننت خودش ضد-آزار است: بنر فقط برای ورزشکاران لاگین‌شده، یک‌بار،
              و هنگام باز بودن overlay مخفی می‌شود.) */}
          <PwaInstallPrompt />
          <Toaster />
          <SonnerToaster position="top-center" dir="rtl" />
          {/* Global "new terms" modal — shown when user was logged out due to
              outdated TermsVersion. Rendered via portal so it overlays any page. */}
          <GlobalNewTermsModal />
        </ThemeProvider>
        {/* Server-side injection (body_end placement) */}
        <HeadCodeInjector placement="body_end" />
      </body>
    </html>
  );
}
