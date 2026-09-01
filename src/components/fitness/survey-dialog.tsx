"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, X, Send, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SurveyQuestion {
  key: string;
  label: string;
  description: string;
  icon: string;
  /** Minimum plan tier required to see this question (1=basic, 2=standard, 3=advanced, 4=ultimate) */
  minTier?: number;
  /** Optional capability key to check */
  capability?: string;
}

// All survey questions — general + plan-specific
// General questions (minTier undefined or 1) show to everyone
// Plan-specific questions only show if user's plan tier >= minTier
const SURVEY_QUESTIONS: SurveyQuestion[] = [
  // ─── سوالات عمومی (همه پلن‌ها) ───
  {
    key: "ratingOverall",
    label: "کیفیت کلی فیتاپ",
    description: "تجربه کلی شما از فیتاپ",
    icon: "✨",
  },
  {
    key: "ratingWorkoutPlan",
    label: "برنامه تمرینی",
    description: "کیفیت و اثربخشی برنامه تمرینی",
    icon: "💪",
  },
  {
    key: "ratingMealPlan",
    label: "برنامه غذایی",
    description: "کیفیت و تنوع برنامه غذایی",
    icon: "🥗",
  },
  {
    key: "ratingUI",
    label: "رابط کاربری و تجربه",
    description: "آسانی استفاده و طراحی رابط",
    icon: "🎨",
  },
  {
    key: "ratingValue",
    label: "ارزش نسبت به قیمت",
    description: "ارزش دریافتی در برابر مبلغ پرداختی",
    icon: "💰",
  },
  // ─── سوالات پلن استاندارد به بالا ───
  {
    key: "ratingSupplements",
    label: "برنامه مکمل‌ها",
    description: "کیفیت برنامه مکمل‌های ورزشی",
    icon: "💊",
    minTier: 2,
  },
  {
    key: "ratingCheckup",
    label: "چکاپ دوره‌ای",
    description: "کیفیت چکاپ‌های دوره‌ای و رصد پیشرفت",
    icon: "📊",
    minTier: 2,
  },
  // ─── سوالات پلن پیشرفته به بالا ───
  {
    key: "ratingAIChat",
    label: "چت مربی هوشمند",
    description: "کیفیت پاسخ‌های مربی هوشمند",
    icon: "🤖",
    minTier: 3,
  },
  {
    key: "ratingMealAnalysis",
    label: "آنالیز عکس غذا",
    description: "دقت و کاربردی بودن آنالیز وعده‌های غذایی",
    icon: "📸",
    minTier: 3,
  },
  {
    key: "ratingGymMode",
    label: "حالت باشگاه",
    description: "کاربردی بودن حالت باشگاه (Gym Mode)",
    icon: "🏋️",
    minTier: 3,
  },
  // ─── سوالات پلن حرفه‌ای ───
  {
    key: "ratingVideoAnalysis",
    label: "آنالیز ویدیویی",
    description: "کیفیت آنالیز ویدیویی بدن و اصلاح تکنیک",
    icon: "🎥",
    minTier: 4,
  },
  {
    key: "ratingBloodTest",
    label: "آنالیز آزمایش خون",
    description: "دقت و کاربردی بودن تحلیل آزمایش خون",
    icon: "🩸",
    minTier: 4,
  },
  {
    key: "ratingSupport",
    label: "پشتیبانی اختصاصی",
    description: "کیفیت و سرعت پاسخگویی پشتیبانی",
    icon: "🎧",
    minTier: 4,
  },
];

/** Get the tier number for a plan name */
function getPlanTier(planName: string | undefined | null): number {
  switch (planName) {
    case "basic": return 1;
    case "standard": return 2;
    case "advanced": return 3;
    case "ultimate": return 4;
    default: return 1;
  }
}

/** Get questions filtered by user's plan tier */
function getQuestionsForPlan(planName: string | undefined | null): SurveyQuestion[] {
  const tier = getPlanTier(planName);
  return SURVEY_QUESTIONS.filter(q => !q.minTier || tier >= q.minTier);
}

interface SurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback when survey is successfully submitted */
  onSubmitted?: () => void;
  /** User's plan name — controls which questions to show */
  planName?: string | null;
}

export function SurveyDialog({ open, onOpenChange, onSubmitted, planName }: SurveyDialogProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [hoverRating, setHoverRating] = useState<{ key: string; value: number } | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Get questions filtered by user's plan
  const questions = getQuestionsForPlan(planName);
  const answeredCount = Object.keys(ratings).length;
  const allAnswered = answeredCount === questions.length;
  const progressPct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  function setRating(key: string, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setRatings({});
    setComment("");
    setSubmitted(false);
    setHoverRating(null);
  }

  async function handleSubmit() {
    if (!allAnswered) {
      toast.error("لطفاً به همه سوالات امتیاز بدهید");
      return;
    }
    setSubmitting(true);
    try {
      // FIX: endpoint درست /api/survey است (ratings + comment → جدول Survey).
      // قبلاً به /api/feedback پست می‌شد که message>=5 الزامی دارد و ستون
      // rating ندارد → همیشه 400 «پیام خیلی کوتاه است».
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratings,
          comment: comment.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "خطا در ثبت نظرسنجی");
      }
      setSubmitted(true);
      toast.success("نظرسنجی شما با موفقیت ثبت شد. سپاس از شما! 🌟");
      onSubmitted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت نظرسنجی");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open && submitted) {
      // reset after close animation
      setTimeout(reset, 250);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        dir="rtl"
        className="max-w-2xl max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl p-0 gap-0"
      >
        {/* Header — orange gradient */}
        <div
          className="relative overflow-hidden p-5 text-white"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316, #ea580c)" }}
        >
          <div className="absolute -left-8 -top-8 w-40 h-40 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -right-4 -bottom-4 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black">نظرسنجی فیتاپ</h2>
                <p className="text-xs opacity-90 mt-0.5">
                  نظر شما کمک می‌کند فیتاپ را بهتر کنیم
                </p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {!submitted && (
            <div className="relative mt-4">
              <div className="flex justify-between text-[10px] mb-1.5 opacity-95">
                <span>پیشرفت نظرسنجی</span>
                <span className="font-bold">{toFa(progressPct)}٪</span>
              </div>
              <div className="h-1.5 bg-white/25 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.12)" }}
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </motion.div>
              <h3 className="text-xl font-black text-slate-900 mb-2">
                از مشارکت شما سپاسگزاریم! 🌟
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 max-w-md mx-auto">
                نظرسنجی شما با موفقیت ثبت شد. بازخورد شما به ما کمک می‌کند فیتاپ را برای
                شما و سایر ورزشکاران بهتر کنیم.
              </p>
              <Button
                onClick={() => handleClose(false)}
                className="rounded-xl text-white gap-2 px-8"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                بستن
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-5 space-y-3"
            >
              {/* Rating questions — filtered by user's plan */}
              {questions.map((q, idx) => {
                const currentRating = ratings[q.key] || 0;
                const hoverValue =
                  hoverRating && hoverRating.key === q.key ? hoverRating.value : 0;
                const displayValue = Math.max(currentRating, hoverValue);

                return (
                  <motion.div
                    key={q.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`rounded-2xl border-2 p-3.5 transition-colors ${
                      currentRating > 0
                        ? "border-orange-200 bg-orange-50/40"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg shrink-0">{q.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {q.label}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {q.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0" dir="ltr">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const filled = star <= displayValue;
                          return (
                            <motion.button
                              key={star}
                              type="button"
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              onMouseEnter={() =>
                                setHoverRating({ key: q.key, value: star })
                              }
                              onMouseLeave={() => setHoverRating(null)}
                              onClick={() => setRating(q.key, star)}
                              className="p-0.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                              aria-label={`امتیاز ${star} از ۵ به ${q.label}`}
                            >
                              <Star
                                className={`w-6 h-6 transition-colors ${
                                  filled
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-transparent text-slate-300"
                                }`}
                                strokeWidth={2}
                              />
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Comment textarea */}
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-3.5">
                <label className="text-sm font-bold text-slate-900 mb-1.5 block">
                  نظر شما (اختیاری)
                </label>
                <p className="text-[10px] text-slate-500 mb-2">
                  هرچه می‌خواهید درباره فیتاپ بگویید — نقاط قوت، نقاط ضعف یا پیشنهادات
                </p>
                <Textarea
                  dir="rtl"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="مثلاً: برنامه تمرینی عالی بود، اما می‌خواستم..."
                  maxLength={2000}
                  className="min-h-[90px] resize-none rounded-xl text-sm bg-slate-50/50 border-slate-200 focus-visible:ring-orange-300"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-slate-400">
                    {toFa(comment.length)} / {toFa(2000)}
                  </span>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-1 flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => handleClose(false)}
                  className="rounded-xl gap-1.5 text-slate-500"
                >
                  <X className="w-4 h-4" />
                  انصراف
                </Button>
                <div className="flex-1" />
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !allAnswered}
                  className="rounded-xl text-white gap-2 px-6 min-w-[180px]"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      در حال ثبت...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      ثبت نظرسنجی
                    </>
                  )}
                </Button>
              </div>
              {!allAnswered && (
                <p className="text-[10px] text-amber-600 text-center">
                  {/* FIX: تعداد سوالات داینامیک است (۵ تا ۱۳ سوال بسته به پلن) — قبلاً ۷ hardcoded بود */}
                  برای ثبت، به همه {toFa(questions.length)} سوال امتیاز بدهید
                  {answeredCount > 0 && ` (${toFa(answeredCount)} از ${toFa(questions.length)})`}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

/** Convert numbers/digits in a string to Persian digits. */
function toFa(input: string | number): string {
  const persian = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/[0-9]/g, (d) => persian[Number(d)]);
}
