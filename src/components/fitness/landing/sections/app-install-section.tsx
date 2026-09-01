"use client";

import { Smartphone, Apple, Chrome, Download, Share, Plus, Check } from "lucide-react";
import { useState } from "react";

export function AppInstallSection() {
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");

  return (
    <section id="install" className="py-16 bg-gradient-to-b from-orange-50/40 to-white relative overflow-hidden scroll-mt-16">
      {/* Background accents */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-orange-100/40 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-amber-100/40 blur-3xl" />

      <div className="max-w-5xl mx-auto px-4 relative">
        {/* Header */}
        <div
          className="animate-fade-in-up text-center mb-10"
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full bg-orange-100 text-orange-600 font-bold mb-3">
            <Download className="w-3.5 h-3.5" />
            نصب اپلیکیشن
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">
            فیتاپ را روی گوشی خود نصب کنید
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            فیتاپ یک اپلیکیشن تحت وب (PWA) است — بدون نیاز به مراجعه به استور، مستقیماً از مرورگر نصب کنید
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 rounded-2xl bg-orange-50 border border-orange-200">
            <button
              onClick={() => setActiveTab("android")}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                activeTab === "android"
                  ? "text-white shadow-md"
                  : "text-slate-600 hover:text-orange-600"
              }`}
              style={activeTab === "android" ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}
            >
              <Smartphone className="w-4 h-4" />
              اندروید
            </button>
            <button
              onClick={() => setActiveTab("ios")}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
                activeTab === "ios"
                  ? "text-white shadow-md"
                  : "text-slate-600 hover:text-orange-600"
              }`}
              style={activeTab === "ios" ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}
            >
              <Apple className="w-4 h-4" />
              آیفون (iOS)
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Android instructions */}
          {activeTab === "android" && (
            <div
              className="animate-slide-in-right md:col-span-2"
            >
              <div className="grid md:grid-cols-2 gap-4">
                {/* Chrome */}
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Chrome className="w-5 h-5 text-orange-500" />
                    </div>
                    <h3 className="font-bold text-slate-900">کروم (Chrome)</h3>
                  </div>
                  <ol className="space-y-2.5">
                    <Step n={1} text="مرورگر کروم را باز کنید و به سایت فیتاپ بروید" />
                    <Step n={2} text="روی منوی سه نقطه (⋮) در گوشه بالا راست ضربه بزنید" />
                    <Step n={3} text="گزینه «افزودن به صفحه اصلی» یا «Install app» را انتخاب کنید" />
                    <Step n={4} text="روی «افزودن» یا «نصب» ضربه بزنید — اپلیکیشن نصب شد! ✓" />
                  </ol>
                </Card>

                {/* Other browsers */}
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-orange-500" />
                    </div>
                    <h3 className="font-bold text-slate-900">سایر مرورگرها</h3>
                  </div>
                  <ol className="space-y-2.5">
                    <Step n={1} text="در مرورگر خود (Firefox, Edge, Samsung) به فیتاپ بروید" />
                    <Step n={2} text="منوی مرورگر (سه نقطه یا سه خط) را باز کنید" />
                    <Step n={3} text="«Add to Home screen» یا «افزودن به صفحه اصلی» را بزنید" />
                    <Step n={4} text="نام را تأیید کنید — آیکون فیتاپ روی صفحه اصلی! ✓" />
                  </ol>
                </Card>
              </div>
            </div>
          )}

          {/* iOS instructions */}
          {activeTab === "ios" && (
            <div
              className="animate-slide-in-right md:col-span-2"
            >
              <div className="grid md:grid-cols-2 gap-4">
                {/* Safari */}
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Apple className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-slate-900">سافاری (Safari)</h3>
                  </div>
                  <ol className="space-y-2.5">
                    <Step n={1} text="مرورگر Safari را باز کنید و به فیتاپ بروید" />
                    <Step n={2} text="روی دکمه اشتراک‌گذاری (Share) در پایین ضربه بزنید" >
                      <Share className="w-3.5 h-3.5 text-orange-500 inline" />
                    </Step>
                    <Step n={3} text="در منوی باز شده، «Add to Home Screen» را انتخاب کنید" />
                    <Step n={4} text="روی «Add» ضربه بزنید — اپلیکیشن نصب شد! ✓" />
                  </ol>
                </Card>

                {/* Chrome iOS */}
                <Card>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Chrome className="w-5 h-5 text-orange-500" />
                    </div>
                    <h3 className="font-bold text-slate-900">کروم iOS</h3>
                  </div>
                  <ol className="space-y-2.5">
                    <Step n={1} text="کروم را در آیفون باز کنید و به فیتاپ بروید" />
                    <Step n={2} text="روی منوی سه نقطه (⋮) ضربه بزنید" />
                    <Step n={3} text="«Add to Home screen» را انتخاب کنید" />
                    <Step n={4} text="«Add» را بزنید — فیتاپ روی صفحه اصلی! ✓" />
                  </ol>
                </Card>
              </div>
            </div>
          )}
        </div>

        {/* Benefits */}
        <div
          className="animate-fade-in-up mt-8 p-5 rounded-2xl border-2 border-orange-200 bg-orange-50/50"
        >
          <h3 className="font-bold text-slate-900 mb-3 text-center text-sm">مزایای نصب اپلیکیشن فیتاپ</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Benefit icon="🚀" text="دسترسی سریع از صفحه اصلی" />
            <Benefit icon="📱" text="تجربه تمام‌صفحه بدون نوار مرورگر" />
            <Benefit icon="🔔" text="اعلان‌های فوری" />
            <Benefit icon="💾" text="همیشه در دسترس" />
          </div>
        </div>

        {/* Note */}
        <p className="text-center text-[11px] text-slate-500 mt-6 max-w-md mx-auto">
          فیتاپ یک Progressive Web App (PWA) است — پس از نصب، مانند یک اپلیکیشن بومی عمل می‌کند
          و همیشه به‌روز است بدون نیاز به آپدیت دستی.
        </p>
      </div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl bg-white border-2 border-orange-100 shadow-sm">
      {children}
    </div>
  );
}

function Step({ n, text, children }: { n: number; text: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
        style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
      >
        {n}
      </span>
      <span className="text-xs text-slate-600 leading-relaxed flex-1">
        {text} {children}
      </span>
    </li>
  );
}

function Benefit({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-[11px] text-slate-600 leading-tight">{text}</p>
    </div>
  );
}
