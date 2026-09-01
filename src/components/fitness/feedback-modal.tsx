"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/fitness/store";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "suggestion", label: "پیشنهاد" },
  { value: "complaint", label: "انتقاد" },
  { value: "bug", label: "گزارش باگ" },
  { value: "other", label: "سایر" },
];

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAppStore();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("suggestion");
  const [name, setName] = useState(user?.name || "");
  const [mobile, setMobile] = useState(user?.mobile || "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (message.trim().length < 5) {
      toast.error("پیام شما خیلی کوتاه است");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), category, name: name.trim() || undefined, mobile: mobile.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      toast.success("پیشنهاد شما ثبت شد! ممنون 🙏");
      setTimeout(() => {
        setDone(false);
        setMessage("");
        onClose();
      }, 2000);
    } catch {
      toast.error("خطا در ثبت پیشنهاد");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">پیشنهادات و انتقادات</h3>
                  <p className="text-[11px] text-slate-500">نظر شما برای بهبود فیتاپ مهم است</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition" aria-label="بستن">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {done ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
                <p className="font-bold text-slate-900">پیشنهاد شما ثبت شد!</p>
                <p className="text-xs text-slate-500 mt-1">از اینکه به فیتاپ کمک می‌کنید سپاسگزاریم 🙏</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Category */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">نوع پیام</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setCategory(c.value)}
                        className={`text-[11px] font-bold py-2 rounded-xl transition ${
                          category === c.value
                            ? "text-white shadow-md"
                            : "bg-slate-50 text-slate-600 hover:bg-orange-50"
                        }`}
                        style={category === c.value ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name (if not logged in) */}
                {!user && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="نام (اختیاری)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                    />
                    <input
                      type="tel"
                      placeholder="موبایل (اختیاری)"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                    />
                  </div>
                )}

                {/* Message */}
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">پیام شما</label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="پیشنهاد یا انتقاد خود را بنویسید..."
                    className="rounded-xl resize-none text-sm"
                  />
                </div>

                {/* Submit */}
                <Button
                  onClick={submit}
                  disabled={submitting || message.trim().length < 5}
                  className="w-full rounded-xl text-white gap-2 h-12"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      در حال ارسال...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      ارسال پیشنهاد
                    </>
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
