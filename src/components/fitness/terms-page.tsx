"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Loader2, ShieldCheck, FileText, Calendar } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { ToolsNav } from "@/components/fitness/tools/tools-nav";
import { toPersianDigits } from "@/lib/fitness/types";
import { Button } from "@/components/ui/button";
import { replaceScreen } from "@/lib/fitness/navigation";

interface TermsData {
  id: string;
  version: number;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function TermsPage() {
  const { setScreen } = useAppStore();
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // URL را برای terms تنظیم کن (برای refresh)
  useEffect(() => {
    replaceScreen("terms");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── SEO ───
  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    const pageUrl = `${siteUrl}/?screen=terms`;
    const title = "قوانین و مقررات | فیتاپ";
    const description =
      "قوانین و مقررات استفاده از خدمات اپلیکیشن فیتاپ — شرایط استفاده، حقوق کاربر، سیاست بازگشت وجه و حریم خصوصی.";
    const keywords =
      "قوانین فیتاپ، مقررات فیتاپ، شرایط استفاده، حریم خصوصی، سیاست بازگشت وجه";
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
        { "@type": "ListItem", position: 2, name: "قوانین", item: pageUrl },
      ],
    });

    return () => {
      ["breadcrumb-schema"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      document.title =
        "برنامه بدنسازی آنلاین | فیتاپ — برنامه تمرینی و تغذیه با AI";
    };
  }, []);

  function goHome() {
    setScreen("landing");
    replaceScreen("landing");
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/terms", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTerms(data.terms || null);
        if (!data.terms) setError("نسخه فعلی قوانین یافت نشد.");
      } catch {
        setError("خطا در دریافت قوانین.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <ToolsNav />
      <main className="min-h-screen bg-white pt-20 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Back button */}
          <button
            onClick={goHome}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-4 transition"
          >
            <ArrowRight className="w-4 h-4" />
            بازگشت به صفحه اصلی
          </button>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-amber-500" />
              <p className="text-sm">در حال بارگذاری قوانین...</p>
            </div>
          ) : error || !terms ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <FileText className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm">{error || "قوانین در دسترس نیست."}</p>
              <Button onClick={goHome} variant="outline" className="mt-4 rounded-xl">
                بازگشت
              </Button>
            </div>
          ) : (
            <article
              className="animate-fade-in-up bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <header className="px-6 sm:px-8 py-6 bg-gradient-to-l from-amber-50 via-white to-white border-b border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">نسخه {toPersianDigits(terms.version)}</p>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{terms.title}</h1>
                  </div>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-2">
                  <Calendar className="w-3.5 h-3.5" />
                  آخرین به‌روزرسانی: {new Date(terms.updatedAt).toLocaleDateString("fa-IR")}
                </p>
              </header>

              {/* Markdown body */}
              <div
                dir="rtl"
                className="terms-markdown px-6 sm:px-8 py-6 sm:py-8 text-slate-800 leading-relaxed"
              >
                <ReactMarkdown>{terms.content}</ReactMarkdown>
              </div>
            </article>
          )}
        </div>

        <style jsx global>{`
          .terms-markdown h1 {
            font-size: 1.5rem;
            font-weight: 800;
            color: #0f172a;
            margin-top: 1.5rem;
            margin-bottom: 1rem;
            line-height: 1.4;
          }
          .terms-markdown h1:first-child { margin-top: 0; }
          .terms-markdown h2 {
            font-size: 1.15rem;
            font-weight: 700;
            color: #1e293b;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            padding-bottom: 0.4rem;
            border-bottom: 1px solid #f1f5f9;
          }
          .terms-markdown h3 {
            font-size: 1rem;
            font-weight: 700;
            color: #334155;
            margin-top: 1.2rem;
            margin-bottom: 0.5rem;
          }
          .terms-markdown p {
            font-size: 0.95rem;
            color: #334155;
            margin-bottom: 0.85rem;
            line-height: 2;
          }
          .terms-markdown strong { font-weight: 700; color: #0f172a; }
          .terms-markdown ul, .terms-markdown ol {
            padding-right: 1.5rem;
            margin-bottom: 0.85rem;
            color: #334155;
            font-size: 0.95rem;
            line-height: 2;
          }
          .terms-markdown ul { list-style: disc; }
          .terms-markdown ol { list-style: decimal; }
          .terms-markdown li { margin-bottom: 0.3rem; }
          .terms-markdown a { color: #d97706; text-decoration: underline; }
          .terms-markdown blockquote {
            border-right: 3px solid #f59e0b;
            background: #fffbeb;
            padding: 0.6rem 1rem;
            border-radius: 0.5rem;
            margin: 0.85rem 0;
            color: #78350f;
            font-size: 0.9rem;
          }
          .terms-markdown code {
            background: #f1f5f9;
            color: #b91c1c;
            padding: 0.1rem 0.35rem;
            border-radius: 0.3rem;
            font-size: 0.85em;
            font-family: ui-monospace, monospace;
          }
          .terms-markdown pre {
            background: #0f172a;
            color: #e2e8f0;
            padding: 1rem;
            border-radius: 0.75rem;
            overflow-x: auto;
            margin: 0.85rem 0;
            direction: ltr;
            text-align: left;
          }
          .terms-markdown pre code {
            background: transparent;
            color: inherit;
            padding: 0;
          }
          .terms-markdown hr { border: 0; border-top: 1px solid #e2e8f0; margin: 1.5rem 0; }
          .terms-markdown table {
            width: 100%;
            border-collapse: collapse;
            margin: 0.85rem 0;
            font-size: 0.9rem;
          }
          .terms-markdown th, .terms-markdown td {
            border: 1px solid #e2e8f0;
            padding: 0.5rem 0.75rem;
            text-align: right;
          }
          .terms-markdown th { background: #f8fafc; font-weight: 700; }
        `}</style>
      </main>
    </>
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
