import type { Metadata } from "next";
import { db } from "@/lib/db";
import HomeClient from "./page-client";
import { resolveInitialScreen } from "@/lib/fitness/ssr-screen";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";

// در Next.js 16, searchParams یک Promise است
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * تولید metadata پویا بر اساس searchParams.
 *
 * canonical برای هر صفحه در server-side تولید می‌شود تا گوگل HTML اولیه را
 * با canonical درست ببیند (بدون نیاز به اجرای JavaScript).
 *
 * - ?article=slug → canonicalUrl از دیتابیس (یا fallback به ?article=slug)
 * - ?tool=tdee → https://fittup.ir/?tool=tdee
 * - ?screen=articles → https://fittup.ir/?screen=articles
 * - ?exercise=id → https://fittup.ir/?exercise=id
 * - ?food=id → https://fittup.ir/?food=id
 * - URL خالی → https://fittup.ir/
 */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";

  // ─── مقاله: title, description, canonical, OG از دیتابیس ───
  const articleSlug = typeof sp.article === "string" ? sp.article : undefined;
  if (articleSlug) {
    try {
      const article = await db.article.findUnique({
        where: { slug: articleSlug },
        select: {
          title: true,
          seoTitle: true,
          seoDescription: true,
          excerpt: true,
          coverImage: true,
          ogImage: true,
          canonicalUrl: true,
          status: true,
          category: true,
          tags: true,
          publishedAt: true,
          robots: true,
        },
      });

      if (article) {
        const canonical = article.canonicalUrl || `${SITE_URL}/?article=${encodeURIComponent(articleSlug)}`;
        const title = (article.seoTitle || article.title) + " | فیتاپ";
        const description = article.seoDescription || article.excerpt || "";
        const ogImage = article.ogImage || article.coverImage || `${SITE_URL}/fitup-logo.png`;

        return {
          title,
          description,
          keywords: article.tags || undefined,
          robots: article.robots || "index,follow",
          alternates: { canonical },
          openGraph: {
            title,
            description,
            type: "article",
            locale: "fa_IR",
            url: canonical,
            siteName: "فیتاپ",
            images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: article.title }] : undefined,
            publishedTime: article.publishedAt?.toISOString() || undefined,
          },
          twitter: {
            card: "summary_large_image",
            title,
            description,
            images: ogImage ? [ogImage] : undefined,
          },
        };
      }
    } catch {
      // خطای دیتابیس — fallback به URL پیش‌فرض
    }
  }

  // ─── غذا: title, description, canonical از دیتابیس ───
  const foodId = typeof sp.food === "string" ? sp.food : undefined;
  if (foodId) {
    try {
      const food = await db.foodLibrary.findUnique({
        where: { id: foodId },
        select: { name: true, calories: true, protein: true, carbs: true, fat: true, servingSize: true },
      });
      if (food) {
        const canonical = `${SITE_URL}/?food=${encodeURIComponent(foodId)}`;
        const title = `کالری ${food.name} — ${food.calories} کالری در ${food.servingSize} | فیتاپ`;
        const description = `${food.name} دارای ${food.calories} کالری در هر ${food.servingSize}. پروتئین: ${food.protein}g، کربوهیدرات: ${food.carbs}g، چربی: ${food.fat}g. جدول کامل کالری و درشت‌مغذی‌های ${food.name} در فیتاپ.`;
        return {
          title,
          description,
          keywords: `کالری ${food.name}, ${food.name}, مقدار کالری ${food.name}, درشت‌مغذی ${food.name}, جدول کالری غذاها`,
          robots: "index,follow",
          alternates: { canonical },
          openGraph: {
            title,
            description,
            type: "website",
            locale: "fa_IR",
            url: canonical,
            siteName: "فیتاپ",
          },
        };
      }
    } catch {}
  }

  // ─── حرکت ورزشی: title, description, canonical از دیتابیس ───
  const exerciseId = typeof sp.exercise === "string" ? sp.exercise : undefined;
  if (exerciseId) {
    try {
      const exercise = await db.exerciseLibrary.findUnique({
        where: { id: exerciseId },
        select: { name: true, category: true, description: true, muscle: true },
      });
      if (exercise) {
        const canonical = `${SITE_URL}/?exercise=${encodeURIComponent(exerciseId)}`;
        const title = `${exercise.name} — آموزش و نحوه اجرا | فیتاپ`;
        const descSnippet = exercise.description
          ? exercise.description.slice(0, 150).replace(/[#*]/g, "")
          : `آموزش کامل ${exercise.name}${exercise.muscle ? ` برای ${exercise.muscle}` : ""}. نحوه اجرا، عضلات درگیر، نکات تکنیکی و جایگزین‌ها.`;
        const description = `${descSnippet}${descSnippet.length < 150 ? "" : "…"} — فیتاپ`;
        return {
          title,
          description,
          keywords: `${exercise.name}, آموزش ${exercise.name}, نحوه اجرای ${exercise.name}, ${exercise.muscle || "بدنسازی"}, بانک حرکات فیتاپ`,
          robots: "index,follow",
          alternates: { canonical },
          openGraph: {
            title,
            description,
            type: "website",
            locale: "fa_IR",
            url: canonical,
            siteName: "فیتاپ",
          },
        };
      }
    } catch {}
  }

  // ─── صفحات استاتیک (tools, screens) ───
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else {
        params.set(key, value);
      }
    }
  }

  const queryString = params.toString();
  const canonical = queryString ? `${SITE_URL}/?${queryString}` : `${SITE_URL}/`;

  // متادیتای اختصاصی برای صفحات استاتیک
  const screen = typeof sp.screen === "string" ? sp.screen : "";
  const tool = typeof sp.tool === "string" ? sp.tool : "";

  // ─── صفحات خصوصی/غیرعمومی → noindex (ممیزی SEO) ───
  // صفحاتی مثل ?screen=auth / panel / onboarding / analysis یا پارامترهای
  // کاربردی (?tab=… / ?renewal=1 / ?survey=… / ?payment_verify=1) محتوای
  // یکسانِ صفحه اصلی را با URLهای متفاوت تولید می‌کردند — همان metadata
  // پیش‌فرض + canonical جدا. نتیجه: صفحات تکراری/باریک (thin & duplicate)
  // که رتبه را پخش می‌کردند. حالا: noindex + canonical به صفحه اصلی تا
  // تمام اعتبار سئو روی URLهای عمومی (مقاله/ابزار/لندینگ) متمرکز بماند.
  const PRIVATE_SCREENS = new Set(["auth", "panel", "main", "admin", "onboarding", "analysis"]);
  const isPrivatePage =
    PRIVATE_SCREENS.has(screen) ||
    (screen === "" && tool === "" && typeof sp.article !== "string" && typeof sp.food !== "string" && typeof sp.exercise !== "string"
      ? typeof sp.tab === "string" ||
        typeof sp.renewal === "string" ||
        sp.survey !== undefined ||
        sp.payment_verify !== undefined ||
        sp.open !== undefined ||
        sp.force !== undefined
      : false);
  if (isPrivatePage) {
    return {
      title: "فیتاپ — برنامه تمرینی و تغذیه هوشمند",
      description: "برنامه تمرینی و غذایی شخصی‌سازی‌شده با تجربه بهترین مربیان ایران — هر بدنی فیتاپ میخواد!",
      robots: { index: false, follow: true },
      alternates: { canonical: `${SITE_URL}/` },
    };
  }

  let title = "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه";
  let description = "برنامه تمرینی و غذایی شخصی‌سازی‌شده با تجربه بهترین مربیان ایران. دنیایی از بدنسازی در دستان شما — هر بدنی فیتاپ میخواد!";

  if (screen === "articles") {
    title = "مقالات بدنسازی و تناسب اندام | فیتاپ";
    description = "مقالات تخصصی بدنسازی، تغذیه، چربی‌سوزی، عضله‌سازی و مکمل‌های ورزشی به زبان فارسی. جامع‌ترین مرجع تناسب اندام — فیتاپ.";
  } else if (screen === "contact") {
    title = "تماس با ما | فیتاپ";
    description = "تماس با تیم پشتیبانی فیتاپ: تلفن، موبایل، آدرس، پیام‌رسان بله و تیکت پشتیبانی.";
  } else if (screen === "terms") {
    title = "شرایط و قوانین | فیتاپ";
    description = "شرایط و قوانین استفاده از پلتفرم فیتاپ و خدمات مربیگری هوشمند.";
  } else if (tool === "tdee") {
    title = "ماشین حساب TDEE — محاسبه کالری روزانه | فیتاپ";
    description = "محاسبه آنلاین TDEE (میزان کالری روزانه بدن) بر اساس سن، جنسیت، قد، وزن و سطح فعالیت. رایگان و دقیق — فیتاپ.";
  } else if (tool === "exercises") {
    title = "بانک حرکات ورزشی — آموزش +۲۶۰ حرکت بدنسازی | فیتاپ";
    description = "جامع‌ترین بانک حرکات بدنسازی فارسی: آموزش، ویدیو، عضلات درگیر و نکات تکنیکی بیش از ۲۶۰ حرکت. رایگان — فیتاپ.";
  } else if (tool === "foods") {
    title = "بانک کالری غذاها — کالری +۱۰۰۰ غذا | فیتاپ";
    description = "جدول کامل کالری و درشت‌مغذی‌های بیش از ۱۰۰۰ غذا. جستجوی سریع و رایگان — فیتاپ.";
  }

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fa_IR",
      url: canonical,
      siteName: "فیتاپ",
      images: [{ url: `${SITE_URL}/fitup-logo.png`, width: 512, height: 512, alt: "فیتاپ" }],
    },
  };
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  // ─── SSR: محتوای واقعی در HTML اولیه (سئو + LCP + پیش‌نمایش شبکه‌های اجتماعی) ───
  // screen اولیه در سرور از searchParams + سشن محاسبه می‌شود و قبل از
  // اولین رندر داخل store تزریق می‌شود — قبلاً HTML اولیه فقط SplashLoader بود.
  const sp = await searchParams;
  const initial = await resolveInitialScreen(sp);
  return <HomeClient initial={initial} />;
}
