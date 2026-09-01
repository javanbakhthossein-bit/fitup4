"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Loader2, ShieldCheck, FileText, AlertCircle, Calendar } from "lucide-react";
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
 * Modal shown on the auth screen when the user was logged out because the
 * active TermsVersion is newer than what they previously accepted.
 *
 * Title is always «قوانین جدید فیتاپ» regardless of the actual title stored
 * in the DB, and the action button is «تایید و پذیرش» (instead of «بستن»).
 *
 * When the user clicks «تایید و پذیرش», `onAccept` is called — the auth
 * screen then proceeds with the normal OTP flow (user enters mobile → gets
 * OTP → verify-otp updates `acceptedTermsVersion` on the server).
 */
export function NewTermsModal({
  open,
  onAccept,
}: {
  open: boolean;
  onAccept: () => void;
}) {
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

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

  const handleAccept = () => {
    setAccepting(true);
    // Small delay so the user sees the button acknowledge their click
    setTimeout(() => {
      onAccept();
      setAccepting(false);
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* don't close on outside click — user must accept */ }}>
      <DialogContent
        dir="rtl"
        className="max-w-2xl max-h-[88vh] p-0 overflow-hidden gap-0"
        // Prevent closing via Escape / overlay click — user MUST accept
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-l from-amber-50 to-orange-50">
          <DialogTitle className="flex items-center gap-2.5 text-right">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <span className="block text-base font-black text-slate-900 leading-tight">
                قوانین جدید فیتاپ
              </span>
              {terms ? (
                <span className="block text-[11px] text-amber-700 font-bold mt-0.5">
                  نسخه {toPersianDigits(terms.version)} · آخرین به‌روزرسانی {new Date(terms.updatedAt).toLocaleDateString("fa-IR")}
                </span>
              ) : (
                <span className="block text-[11px] text-amber-700 font-bold mt-0.5">
                  برای ادامه، قوانین جدید را مطالعه و تایید کنید.
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Info banner — explains why the modal is showing */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            قوانین فیتاپ به‌روزرسانی شده است. برای ادامه، قوانین جدید را مطالعه کرده و تایید کنید. پس از تایید، می‌توانید با کد یک‌بار مصرف وارد شوید.
          </p>
        </div>

        <div className="overflow-y-auto custom-scrollbar px-6 py-5 max-h-[52vh] bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mb-2 text-amber-500" />
              <p className="text-sm">در حال بارگذاری قوانین...</p>
            </div>
          ) : error || !terms ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-sm">{error || "قوانین در دسترس نیست."}</p>
              <button
                onClick={() => {
                  // Trigger re-fetch by toggling open state via a key remount
                  setError("");
                  setLoading(true);
                  fetch("/api/terms", { cache: "no-store" })
                    .then((r) => r.json())
                    .then((d) => {
                      setTerms(d.terms || null);
                      if (!d.terms) setError("نسخه فعلی قوانین یافت نشد.");
                    })
                    .catch(() => setError("خطا در دریافت قوانین."))
                    .finally(() => setLoading(false));
                }}
                className="mt-3 text-xs text-orange-600 hover:text-orange-700 underline underline-offset-2"
              >
                تلاش مجدد
              </button>
            </div>
          ) : (
            <div dir="rtl" className="new-terms-modal-markdown text-slate-800 leading-relaxed">
              <div className="mb-3 text-sm font-bold text-slate-900">
                {terms.title}
              </div>
              <ReactMarkdown>{terms.content}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-slate-50 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-1">
            <Calendar className="w-3 h-3 shrink-0" />
            با کلیک بر «تایید و پذیرش»، قوانین جدید را می‌پذیرید.
          </p>
          <button
            onClick={handleAccept}
            disabled={accepting || loading || !!error || !terms}
            className="px-5 py-2 rounded-xl text-white text-sm font-bold shadow-md transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            {accepting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                تایید شد
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                تایید و پذیرش
              </>
            )}
          </button>
        </div>
      </DialogContent>

      <style jsx global>{`
        .new-terms-modal-markdown h1 {
          font-size: 1.2rem;
          font-weight: 800;
          color: #0f172a;
          margin-top: 1.1rem;
          margin-bottom: 0.7rem;
          line-height: 1.4;
        }
        .new-terms-modal-markdown h1:first-child { margin-top: 0; }
        .new-terms-modal-markdown h2 {
          font-size: 1.02rem;
          font-weight: 700;
          color: #1e293b;
          margin-top: 1.1rem;
          margin-bottom: 0.5rem;
          padding-bottom: 0.35rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .new-terms-modal-markdown h3 {
          font-size: 0.94rem;
          font-weight: 700;
          color: #334155;
          margin-top: 0.95rem;
          margin-bottom: 0.4rem;
        }
        .new-terms-modal-markdown p {
          font-size: 0.86rem;
          color: #334155;
          margin-bottom: 0.6rem;
          line-height: 1.9;
        }
        .new-terms-modal-markdown strong { font-weight: 700; color: #0f172a; }
        .new-terms-modal-markdown ul, .new-terms-modal-markdown ol {
          padding-right: 1.4rem;
          margin-bottom: 0.6rem;
          color: #334155;
          font-size: 0.86rem;
          line-height: 1.9;
        }
        .new-terms-modal-markdown ul { list-style: disc; }
        .new-terms-modal-markdown ol { list-style: decimal; }
        .new-terms-modal-markdown li { margin-bottom: 0.2rem; }
        .new-terms-modal-markdown a { color: #d97706; text-decoration: underline; }
        .new-terms-modal-markdown blockquote {
          border-right: 3px solid #f59e0b;
          background: #fffbeb;
          padding: 0.5rem 0.9rem;
          border-radius: 0.5rem;
          margin: 0.6rem 0;
          color: #78350f;
          font-size: 0.84rem;
        }
        .new-terms-modal-markdown code {
          background: #f1f5f9;
          color: #b91c1c;
          padding: 0.1rem 0.3rem;
          border-radius: 0.3rem;
          font-size: 0.82em;
          font-family: ui-monospace, monospace;
        }
        .new-terms-modal-markdown pre {
          background: #0f172a;
          color: #e2e8f0;
          padding: 0.8rem;
          border-radius: 0.6rem;
          overflow-x: auto;
          margin: 0.6rem 0;
          direction: ltr;
          text-align: left;
        }
        .new-terms-modal-markdown pre code {
          background: transparent;
          color: inherit;
          padding: 0;
        }
        .new-terms-modal-markdown hr { border: 0; border-top: 1px solid #e2e8f0; margin: 1.1rem 0; }
      `}</style>
    </Dialog>
  );
}
