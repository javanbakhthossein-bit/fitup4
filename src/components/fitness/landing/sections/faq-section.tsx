"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "آیا برنامه‌های فیتاپ علمی و معتبر هستند؟",
    a: "بله! فیتاپ توسط بزرگترین مربیان بدنسازی دنیا طراحی شده است. هوش مصنوعی اختصاصی فیتاپ طبق الگوی آن‌ها آموزش دیده تا برنامه‌ای کاملاً علمی، ایمن و شخصی‌سازی‌شده برای شما بسازد — دقیقاً همان کیفیت یک مربی حرفه‌ای، اما سریع‌تر و ۲۴ ساعته در دسترس.",
  },
  {
    q: "چگونه ثبت‌نام می‌کنم؟ آیا پیامک ارسال می‌شود؟",
    a: "ثبت‌نام با شماره موبایل و تأیید پیامک یک‌بارمصرف (OTP) انجام می‌شود. کد ۴ رقمی به شماره شما پیامک می‌شود و پس از تأیید، حساب شما ایجاد یا وارد می‌شود. نیازی به رمز عبور نیست — ورود OTP یعنی پذیرش قوانین.",
  },
  {
    q: "آیا برنامه تمرینی برای شرایط من مناسب است؟",
    a: "برنامه کاملاً بر اساس اطلاعات آنبوردینگ شما (جنسیت، سن، قد، وزن، هدف، آسیب‌دیدگی‌ها، تجهیزات و رژیم غذایی) شخصی‌سازی می‌شود. اگر آسیب‌دیدگی دارید، هوش مصنوعی حرکات ایمن و جایگزین پیشنهاد می‌دهد.",
  },
  {
    q: "پرداخت اشتراک چگونه انجام می‌شود؟",
    a: "پرداخت از طریق درگاه امن زرین‌پال انجام می‌شود. پس از انتخاب اشتراک، به درگاه هدایت می‌شوید و پس از پرداخت موفق، اشتراک بلافاصله فعال می‌شود. رسید پرداخت در اپلیکیشن ذخیره می‌شود.",
  },
  {
    q: "آیا می‌توانم برنامه‌ام را تغییر دهم؟",
    a: "بله! هر زمان که بخواهید می‌توانید با چت با مربی AI، جایگزین حرکت بخواهید، غذا را تعویض کنید یا درخواست بازسازی کل برنامه کنید. همچنین می‌توانید وزن جدید ثبت کنید و برنامه به‌روز می‌شود.",
  },
  {
    q: "آیا اطلاعات و تصاویر من محرمانه می‌مانند؟",
    a: "بله، حریم خصوصی شما برای ما مهم‌ترین اولویت است. تصاویر پیشرفت (Before/After) کاملاً خصوصی هستند و فقط برای خود شما نمایش داده می‌شوند. اطلاعات شما با هیچ شخص ثالثی به اشتراک گذاشته نمی‌شود.",
  },
  {
    q: "آیا اپلیکیشن روی گوشی من کار می‌کند؟",
    a: "بله! اپلیکیشن فیتاپ یک وب‌اپلیکیشن واکنش‌گرا (Responsive) است که روی همه گوشی‌های اندروید و iOS از طریق مرورگر کار می‌کند. نیازی به نصب نیست — فقط باز کنید و شروع کنید.",
  },
  {
    q: "اگر اشتراکم منقضی شود چه می‌شود؟",
    a: "پس از انقضای اشتراک، دسترسی به برنامه‌های جدید و چت محدود می‌شود، اما اطلاعات قبلی شما (وزن، پیشرفت، تصاویر) حفظ می‌شود. هر زمان که اشتراک را تمدید کنید، دوباره به همه امکانات دسترسی دارید.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="py-20 sm:py-28 bg-white border-y border-orange-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div
          className="animate-fade-in-up text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-sm font-medium mb-4">
            <HelpCircle className="w-4 h-4" />
            سوالات متداول
          </div>
          <h2 className="text-3xl sm:text-4xl font-black mb-4 text-slate-900">
            هر چه <span className="gradient-text">می‌خواهید بدانید</span>
          </h2>
          <p className="text-slate-500">
            پاسخ سوالات پرتکرار درباره فیتاپ
          </p>
        </div>

        <div
          className="animate-fade-in-up"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-white border border-orange-200 rounded-2xl px-5 shadow-sm hover:border-orange-300 transition-colors [&[data-state=open]]:border-orange-400 [&[data-state=open]]:shadow-md"
              >
                <AccordionTrigger className="text-right font-bold text-sm text-slate-900 hover:no-underline py-5 hover:text-orange-600 transition-colors">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-slate-600 leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
