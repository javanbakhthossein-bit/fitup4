"use client";

import { useEffect } from "react";
import { Headphones, MessageCircle, Clock, Mail, Phone, Heart, Target, Sparkles, ChevronLeft, Send, Ticket, MapPin, Smartphone } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { replaceScreen } from "@/lib/fitness/navigation";

export function ContactPage() {
  const { user, setScreen, setMainTab } = useAppStore();

  function goHome() {
    setScreen("landing");
    replaceScreen("landing");
  }

  // ─── SEO ───
  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    const pageUrl = `${siteUrl}/?screen=contact`;
    const title = "تماس با ما | فیتاپ";
    const description =
      "تماس با تیم پشتیبانی فیتاپ از طریق پیام‌رسان بله، تیکت پشتیبانی و چت با نیکا. پاسخگویی به سوالات برنامه تمرینی، تغذیه و مشکلات فنی ۲۴ ساعته.";
    const keywords =
      "تماس با فیتاپ، پشتیبانی فیتاپ، ارتباط با فیتاپ، تیکت پشتیبانی، راه‌های ارتباطی فیتاپ";
    const ogImage = `${siteUrl}/fitup-logo.png`;

    document.title = title;
    setMetaTag("description", description);
    setMetaTag("keywords", keywords);
    setMetaTag("robots", "index,follow");
    setLinkTag("canonical", pageUrl);

    setMetaProp("og:title", title);
    setMetaProp("og:description", description);
    setMetaProp("og:type", "website");
    setMetaProp("og:locale", "fa_IR");
    setMetaProp("og:url", pageUrl);
    setMetaProp("og:image", ogImage);
    setMetaProp("og:site_name", "فیتاپ");

    setMetaProp("twitter:card", "summary_large_image");
    setMetaProp("twitter:title", title);
    setMetaProp("twitter:description", description);
    setMetaProp("twitter:image", ogImage);

    // BreadcrumbList schema
    setJsonLd("breadcrumb-schema", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "فیتاپ", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "تماس با ما", item: pageUrl },
      ],
    });

    // ContactPage + Organization with contactPoint schema
    setJsonLd("contact-schema", {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "تماس با فیتاپ",
      url: pageUrl,
      description,
      mainEntity: {
        "@type": "Organization",
        name: "فیتاپ",
        alternateName: "FitUp",
        url: siteUrl,
        logo: `${siteUrl}/fitup-logo.png`,
        telephone: "+982155871576",
        email: undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: "شریعتی، خیابان صمدی، خیابان یعقوبی، کوچه شفا، پلاک ۱۰، واحد ۴",
          addressLocality: "تهران",
          addressRegion: "تهران",
          addressCountry: "IR",
        },
        contactPoint: [
          {
            "@type": "ContactPoint",
            contactType: "customer support",
            name: "پشتیبانی فیتاپ",
            description: "تیکت پشتیبانی برای تمام ورزشکاران در پنل کاربری",
            telephone: "+982155871576",
            url: pageUrl,
            availableLanguage: ["Persian"],
            areaServed: "IR",
          },
          {
            "@type": "ContactPoint",
            contactType: "technical support",
            name: "تیم فنی فیتاپ",
            description: "ارتباط مستقیم با تیم فنی از طریق پیام‌رسان بله",
            telephone: "+989300083803",
            url: "https://ble.ir/hossein_javanbakht",
            availableLanguage: ["Persian"],
            areaServed: "IR",
          },
        ],
      },
    });

    return () => {
      ["breadcrumb-schema", "contact-schema"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      document.title =
        "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه با AI";
    };
  }, []);

  // ورود به پنل پشتیبانی (بخش تیکت)
  // • اگر کاربر وارد شده → مستقیم به main + تب support
  // • اگر وارد نشده → به صفحه auth هدایت می‌شود
  function goToTickets() {
    if (user) {
      setMainTab("support");
      setScreen("main");
      replaceScreen("main");
    } else {
      setScreen("auth");
      replaceScreen("auth");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={goHome} className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 transition">
            <ChevronLeft className="w-4 h-4" />
            صفحه اصلی
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-sm text-slate-900">تماس با ما</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div
          className="animate-fade-in-up text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-100 text-orange-600 text-sm font-bold mb-4">
            <Headphones className="w-4 h-4" />
            همیشه در کنار شما
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">
            تماس با{" "}
            <span style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              فیتاپ
            </span>
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto leading-relaxed">
            تیم فیتاپ همیشه آماده پاسخگویی به سوالات شماست. چه در زمینه برنامه تمرینی، چه تغذیه و چه مشکلات فنی — ما اینجاییم تا کمک کنیم.
          </p>
        </div>

        {/* Contact methods */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {/* بله */}
          <a
            href="https://ble.ir/hossein_javanbakht"
            target="_blank"
            rel="noopener noreferrer"
            className="animate-fade-in-up rounded-2xl p-6 text-white shadow-lg transition hover:-translate-y-1"
            style={{ background: "linear-gradient(135deg, #2196F3, #1976D2)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black text-lg">پشتیبانی از طریق بله</h3>
                <p className="text-xs opacity-90">سریع‌ترین راه ارتباطی</p>
              </div>
            </div>
            <p className="text-sm opacity-90 leading-relaxed mb-3">
              از طریق پیام‌رسان بله مستقیماً با تیم فنی فیتاپ در ارتباط باشید. سوالات خود را بپرسید و پاسخ سریع دریافت کنید.
            </p>
            <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-xl px-4 py-2 text-sm font-bold">
              <Send className="w-4 h-4" />
              شروع گفتگو
            </div>
          </a>

          {/* تیکت پشتیبانی */}
          <button
            type="button"
            onClick={goToTickets}
            className="animate-fade-in-up rounded-2xl p-6 text-white shadow-lg transition text-right hover:-translate-y-1"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black text-lg">تیکت پشتیبانی</h3>
                <p className="text-xs opacity-90">برای تمام ورزشکاران</p>
              </div>
            </div>
            <p className="text-sm opacity-90 leading-relaxed mb-3">
              تمام ورزشکاران می‌توانند از طریق تیکت با واحد پشتیبانی فیتاپ در ارتباط باشند. تیکت‌ها در پنل کاربری شما ثبت و پیگیری می‌شوند و تیم پشتیبانی به آن‌ها پاسخ می‌دهد.
            </p>
            <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-xl px-4 py-2 text-sm font-bold">
              <Ticket className="w-4 h-4" />
              {user ? "ورود به پنل پشتیبانی" : "ورود / ثبت‌نام"}
            </div>
          </button>

          {/* نیکا */}
          <div
            className="animate-fade-in-up rounded-2xl p-6 bg-white border-2 border-orange-100 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900">چت با نیکا</h3>
                <p className="text-xs text-slate-500">۲۴ ساعته، آنی و هوشمند</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              نیکا، دستیار هوشمند فیتاپ، ۲۴ ساعت شبانه‌روز آماده پاسخگویی به سوالات شما درباره پلن‌ها، امکانات و قیمت‌هاست. نیکا به تمام مقالات و محتوای سایت اشراف کامل دارد.
            </p>
            <p className="text-xs text-orange-600 font-bold">
              ⚡ بدون انتظار، بدون محدودیت زمانی
            </p>
          </div>
        </div>

        {/* اطلاعات تماس مستقیم — تلفن، موبایل، آدرس */}
        <div
          className="animate-fade-in-up rounded-2xl p-6 bg-white border border-orange-100 shadow-sm mb-10"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)" }}>
              <Phone className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-lg font-black text-slate-900">اطلاعات تماس مستقیم</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* موبایل — اول نمایش داده می‌شود */}
            <a
              href="tel:09300083803"
              className="group rounded-xl p-4 border border-slate-200 hover:border-orange-300 hover:shadow-md transition text-right"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-50 group-hover:bg-orange-100 transition">
                  <Smartphone className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">موبایل</p>
                  <p className="text-sm font-bold text-slate-900" dir="ltr">۰۹۳۰-۰۰۸۳۸۰۳</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">پاسخگویی در ساعات اداری</p>
            </a>

            {/* تلفن ثابت */}
            <a
              href="tel:02155871576"
              className="group rounded-xl p-4 border border-slate-200 hover:border-orange-300 hover:shadow-md transition text-right"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-50 group-hover:bg-orange-100 transition">
                  <Phone className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">تلفن ثابت</p>
                  <p className="text-sm font-bold text-slate-900" dir="ltr">۰۲۱-۵۵۸۷۱۵۷۶</p>
                </div>
              </div>
              <p className="text-xs text-slate-500">شنبه تا چهارشنبه، ۹ تا ۱۸</p>
            </a>

            {/* آدرس */}
            <div className="group rounded-xl p-4 border border-slate-200 hover:border-orange-300 hover:shadow-md transition text-right">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-50 group-hover:bg-orange-100 transition shrink-0">
                  <MapPin className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">آدرس</p>
                  <p className="text-sm font-bold text-slate-900 leading-relaxed">تهران</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                شریعتی، خیابان صمدی، خیابان یعقوبی، کوچه شفا، پلاک ۱۰، واحد ۴
              </p>
            </div>
          </div>
        </div>

        {/* About FitUp */}
        <div
          className="animate-fade-in-up rounded-2xl p-6 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 mb-10"
        >
          <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-500" />
            مأموریت فیتاپ
          </h2>
          <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
            <p>
              فیتاپ با هدف <strong>دموکراتیزه کردن تناسب اندام</strong> ساخته شد. ما باور داریم هر فردی — فارغ از موقعیت مکانی، زمان و بودجه — شایسته دریافت بهترین برنامه تمرینی و غذایی است.
            </p>
            <p>
              فیتاپ توسط <strong>برترین مربیان بدنسازی کشور و پزشکان متخصص ورزشی</strong> طراحی شده است. هوش مصنوعی اختصاصی فیتاپ توسط این نخبگان آموزش دیده تا برنامه‌ای کاملاً علمی، ایمن و شخصی‌سازی‌شده برای هر بدن بسازد.
            </p>
            <p>
              هدف ما این است که <strong>تجربه داشتن یک مربی حرفه‌ای</strong> را برای همه قابل‌دسترس کنیم — سریع‌تر، دقیق‌تر و ۲۴ ساعته در دسترس. هر بدنی فیتاپ میخواد! 🌟
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Clock, title: "پاسخگویی ۲۴ ساعته", desc: "نیکا همیشه آماده پاسخگویی است" },
            { icon: Heart, title: "پشتیبانی صمیمی", desc: "تیم ما مثل دوست کنارتان است" },
            { icon: Sparkles, title: "راهنمایی تخصصی", desc: "بر اساس دانش برترین مربیان" },
          ].map((item, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 0.1}s` }}
              className="animate-fade-in-up rounded-2xl p-5 bg-white border border-orange-100 text-center"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)" }}>
                <item.icon className="w-6 h-6 text-orange-500" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="animate-fade-in-up rounded-3xl p-8 text-center text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <h2 className="text-xl font-black mb-2">سوالی دارید؟</h2>
            <p className="text-sm opacity-90 mb-4">نیکا ۲۴ ساعته آماده پاسخگویی است — همین حالا بپرسید!</p>
            <Button
              onClick={goHome}
              className="bg-white text-orange-600 hover:bg-white/90 rounded-xl font-bold"
            >
              <Sparkles className="w-4 h-4" />
              بازگشت به سایت
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── SEO helper functions ───
function setMetaTag(name: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaProp(prop: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${prop}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", prop);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLinkTag(rel: string, href: string) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id: string, data: any) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}
