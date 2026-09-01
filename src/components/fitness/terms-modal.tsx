"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, ShieldCheck, FileText, Calendar } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toPersianDigits } from "@/lib/fitness/types";

interface TermsData {
  id: string;
  version: number;
  title: string;
  content: string;
  isActive: boolean;
  updatedAt: string;
}

/**
 * Modal dialog showing the active Terms & Conditions as styled markdown.
 * Used by the auth (register) screen so users can read the T&C inline
 * before accepting. Public — no auth required.
 */
export function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/terms", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) {
          setTerms(data.terms || null);
          if (!data.terms) setError("نسخه فعلی قوانین یافت نشد.");
        }
      } catch {
        if (!cancelled) setError("خطا در دریافت قوانین.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[88vh] p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-l from-amber-50 to-white">
          <DialogTitle className="flex items-center gap-2.5 text-right">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              {terms ? (
                <>
                  <span className="block text-base font-black text-slate-900 leading-tight">{terms.title}</span>
                  <span className="block text-[11px] text-amber-600 font-bold mt-0.5">
                    نسخه {toPersianDigits(terms.version)} · آخرین به‌روزرسانی {new Date(terms.updatedAt).toLocaleDateString("fa-IR")}
                  </span>
                </>
              ) : (
                <span className="block text-base font-black text-slate-900">شرایط و قوانین</span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto custom-scrollbar px-6 py-5 max-h-[64vh] bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mb-2 text-amber-500" />
              <p className="text-sm">در حال بارگذاری...</p>
            </div>
          ) : error || !terms ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm">{error || "قوانین در دسترس نیست."}</p>
            </div>
          ) : (
            <div dir="rtl" className="terms-modal-markdown text-slate-800 leading-relaxed">
              <ReactMarkdown>{terms.content}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            با کلیک بر «پذیرش»، تمامی شرایط را می‌پذیرید.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-white text-sm font-bold shadow-md transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            بستن
          </button>
        </div>
      </DialogContent>

      <style jsx global>{`
        .terms-modal-markdown h1 {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0f172a;
          margin-top: 1.2rem;
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }
        .terms-modal-markdown h1:first-child { margin-top: 0; }
        .terms-modal-markdown h2 {
          font-size: 1.05rem;
          font-weight: 700;
          color: #1e293b;
          margin-top: 1.2rem;
          margin-bottom: 0.5rem;
          padding-bottom: 0.35rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .terms-modal-markdown h3 {
          font-size: 0.95rem;
          font-weight: 700;
          color: #334155;
          margin-top: 1rem;
          margin-bottom: 0.4rem;
        }
        .terms-modal-markdown p {
          font-size: 0.88rem;
          color: #334155;
          margin-bottom: 0.65rem;
          line-height: 1.95;
        }
        .terms-modal-markdown strong { font-weight: 700; color: #0f172a; }
        .terms-modal-markdown ul, .terms-modal-markdown ol {
          padding-right: 1.4rem;
          margin-bottom: 0.65rem;
          color: #334155;
          font-size: 0.88rem;
          line-height: 1.95;
        }
        .terms-modal-markdown ul { list-style: disc; }
        .terms-modal-markdown ol { list-style: decimal; }
        .terms-modal-markdown li { margin-bottom: 0.2rem; }
        .terms-modal-markdown a { color: #d97706; text-decoration: underline; }
        .terms-modal-markdown blockquote {
          border-right: 3px solid #f59e0b;
          background: #fffbeb;
          padding: 0.5rem 0.9rem;
          border-radius: 0.5rem;
          margin: 0.65rem 0;
          color: #78350f;
          font-size: 0.85rem;
        }
        .terms-modal-markdown code {
          background: #f1f5f9;
          color: #b91c1c;
          padding: 0.1rem 0.3rem;
          border-radius: 0.3rem;
          font-size: 0.82em;
          font-family: ui-monospace, monospace;
        }
        .terms-modal-markdown pre {
          background: #0f172a;
          color: #e2e8f0;
          padding: 0.85rem;
          border-radius: 0.6rem;
          overflow-x: auto;
          margin: 0.65rem 0;
          direction: ltr;
          text-align: left;
        }
        .terms-modal-markdown pre code {
          background: transparent;
          color: inherit;
          padding: 0;
        }
        .terms-modal-markdown hr { border: 0; border-top: 1px solid #e2e8f0; margin: 1.2rem 0; }
      `}</style>
    </Dialog>
  );
}
