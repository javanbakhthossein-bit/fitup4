"use client";

import { useEffect, useState } from "react";
import { X, Star, Send, Loader2, MessageSquare, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toPersianDigits } from "@/lib/fitness/types";
import { toast } from "sonner";

interface Question {
  id: string;
  label: string;
  required: boolean;
}

interface SurveyData {
  hasSubmitted: boolean;
  lastPlanName: string | null;
  lastPlanLabel: string | null;
  questions: {
    general: Question[];
    planSpecific: Question[];
  };
  submittedAt: string | null;
}

export function SurveyOverlay() {
  const { setOverlay } = useAppStore();
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/survey", { cache: "no-store" });
        const d = await res.json();
        setData(d);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function setRating(qid: string, val: number) {
    setRatings((prev) => ({ ...prev, [qid]: val }));
  }

  async function submit() {
    if (!data) return;
    // بررسی سوالات الزامی
    const allQuestions = [...data.questions.general, ...data.questions.planSpecific];
    const missing = allQuestions.filter((q) => q.required && !ratings[q.id]);
    if (missing.length > 0) {
      toast.error(`لطفاً به ${toPersianDigits(missing.length)} سوال الزامی پاسخ دهید`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings, comment }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "خطا در ثبت نظرسنجی");
      setDone(true);
      toast.success("نظرسنجی شما با موفقیت ثبت شد 🙏");
      // بستن overlay بعد از ۲ ثانیه
      setTimeout(() => setOverlay(null), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-bold">نظرسنجی پایان پلن</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOverlay(null)} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : done ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-500" />
            <h3 className="text-lg font-bold mb-2">سپاس از بازخورد شما!</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              نظر شما برای بهبود فیتاپ بسیار ارزشمند است. در تلاشیم تا بهترین تجربه را برای شما فراهم کنیم.
            </p>
          </div>
        ) : !data ? (
          <div className="text-center text-muted-foreground py-10">
            خطا در بارگذاری نظرسنجی.
          </div>
        ) : data.hasSubmitted ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500" />
            <h3 className="font-bold mb-1">شما قبلاً نظرسنجی پر کرده‌اید</h3>
            <p className="text-sm text-muted-foreground">
              {data.submittedAt
                ? `آخرین نظرسنجی: ${new Date(data.submittedAt).toLocaleDateString("fa-IR")}`
                : ""}
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              با این حال، می‌توانید دوباره نظرسنجی را پر کنید (برای پلن‌های مختلف).
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {data.lastPlanLabel && (
              <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 text-center">
                <p className="text-sm text-muted-foreground">پلن شما:</p>
                <p className="text-lg font-bold text-primary">{data.lastPlanLabel}</p>
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed">
              از اینکه فیتاپ را انتخاب کردید، سپاسگزاریم! لطفاً به سوالات زیر پاسخ دهید تا بتوانیم خدمات بهتری به شما و سایر ورزشکاران ارائه دهیم.
            </p>

            {/* سوالات عمومی */}
            {data.questions.general.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm">سوالات عمومی</h3>
                {data.questions.general.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    rating={ratings[q.id] ?? 0}
                    onRate={(val) => setRating(q.id, val)}
                  />
                ))}
              </div>
            )}

            {/* سوالات اختصاصی پلن */}
            {data.questions.planSpecific.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-sm">سوالات اختصاصی پلن شما</h3>
                {data.questions.planSpecific.map((q) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    rating={ratings[q.id] ?? 0}
                    onRate={(val) => setRating(q.id, val)}
                  />
                ))}
              </div>
            )}

            {/* کامنت کلی */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm">کامنت کلی (اختیاری)</h3>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="هر پیشنهاد، انتقاد یا تجربه‌ای که می‌خواهید با ما به اشتراک بگذارید..."
                rows={4}
                className="rounded-xl resize-none"
                maxLength={5000}
              />
            </div>

            <Button
              onClick={submit}
              disabled={submitting}
              className="w-full rounded-xl gap-2"
              size="lg"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              ثبت نظرسنجی
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  rating,
  onRate,
}: {
  question: Question;
  rating: number;
  onRate: (val: number) => void;
}) {
  return (
    <div className="p-3 rounded-2xl border bg-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium leading-relaxed">
          {question.label}
          {question.required && <span className="text-destructive mr-1">*</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 justify-between">
        {[1, 2, 3, 4, 5].map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => onRate(val)}
            className="flex-1 flex flex-col items-center gap-1 py-1.5 rounded-xl hover:bg-muted/60 transition group"
            aria-label={`نمره ${toPersianDigits(val)} از ۵`}
          >
            <Star
              className={`w-6 h-6 transition ${
                val <= rating
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground group-hover:text-amber-300"
              }`}
            />
            <span className="text-[10px] text-muted-foreground font-stat">{toPersianDigits(val)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
