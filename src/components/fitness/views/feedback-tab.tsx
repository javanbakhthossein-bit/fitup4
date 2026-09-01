"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Sparkles,
  Loader2,
  Trash2,
  CheckCircle2,
  Eye,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  CalendarDays,
  MessageSquare,
  Filter,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { toPersianDigits } from "@/lib/fitness/types";

// ─── Types ───
interface FeedbackRow {
  id: string;
  message: string;
  comment: string | null;
  category: string;
  name: string | null;
  mobile: string | null;
  userId: string | null;
  reviewed: boolean;
  ratingOverall: number | null;
  ratingWorkoutPlan: number | null;
  ratingMealPlan: number | null;
  ratingAIChat: number | null;
  ratingUI: number | null;
  ratingSupport: number | null;
  ratingValue: number | null;
  createdAt: string;
}

interface FeedbackStats {
  total: number;
  averages: Record<string, number | null>;
  counts: Record<string, number>;
}

const RATING_FIELDS: { key: string; label: string; icon: string }[] = [
  { key: "ratingOverall", label: "کیفیت کلی فیتاپ", icon: "✨" },
  { key: "ratingWorkoutPlan", label: "برنامه تمرینی", icon: "💪" },
  { key: "ratingMealPlan", label: "برنامه غذایی", icon: "🥗" },
  { key: "ratingAIChat", label: "چت مربی هوشمند", icon: "🤖" },
  { key: "ratingUI", label: "رابط کاربری", icon: "🎨" },
  { key: "ratingSupport", label: "پشتیبانی", icon: "🎧" },
  { key: "ratingValue", label: "ارزش نسبت به قیمت", icon: "💰" },
];

/** Color for an average rating: green ≥4, yellow 3-4, red <3. */
function ratingColor(r: number | null): string {
  if (r === null) return "#94a3b8"; // slate-400 — no data
  if (r >= 4) return "#10b981"; // emerald-500
  if (r >= 3) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

function ratingBg(r: number | null): string {
  if (r === null) return "rgba(148,163,184,0.12)";
  if (r >= 4) return "rgba(16,185,129,0.12)";
  if (r >= 3) return "rgba(245,158,11,0.12)";
  return "rgba(239,68,68,0.12)";
}

function formatFaDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/* ============================================================
   FeedbackTab — main tab component
   ============================================================ */
export function FeedbackTab() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewedFilter, setReviewedFilter] = useState("all");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("date");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // AI analysis state
  const [analysis, setAnalysis] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (reviewedFilter !== "all") params.set("reviewed", reviewedFilter);
      if (minRating !== "0") params.set("minRating", minRating);
      if (sortBy) params.set("sort", sortBy);
      if (fromDate) params.set("fromDate", new Date(fromDate).toISOString());
      if (toDate) {
        const d = new Date(toDate);
        d.setHours(23, 59, 59, 999);
        params.set("toDate", d.toISOString());
      }
      const res = await fetch(`/api/feedback?${params}&_t=${Date.now()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFeedback(data.feedback || []);
      setStats(data.stats || null);
    } catch {
      toast.error("خطا در بارگذاری نظرات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [reviewedFilter, minRating, sortBy, fromDate, toDate]);

  async function markReviewed(id: string) {
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reviewed: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("به‌عنوان بررسی‌شده علامت داده شد");
      setFeedback((prev) =>
        prev.map((f) => (f.id === id ? { ...f, reviewed: true } : f))
      );
    } catch {
      toast.error("خطا");
    }
  }

  async function deleteFeedback(id: string) {
    if (!confirm("این نظر حذف شود؟ این عمل قابل بازگشت نیست.")) return;
    try {
      const res = await fetch("/api/feedback", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      toast.success("نظر حذف شد");
      setFeedback((prev) => prev.filter((f) => f.id !== id));
    } catch {
      toast.error("خطا در حذف");
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setShowAnalysis(true);
    try {
      const res = await fetch("/api/feedback/analyze", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "خطا در تحلیل");
      }
      const data = await res.json();
      setAnalysis(data.analysis || "");
      toast.success("تحلیل هوش مصنوعی آماده شد ✨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در تحلیل");
      setShowAnalysis(false);
    } finally {
      setAnalyzing(false);
    }
  }

  // ─── Filtered + sorted view (server already filters, but local sort for min-rating pre-2024) ───
  const filteredFeedback = useMemo(() => feedback, [feedback]);

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* ─── A. Statistics overview ─── */}
      <StatsOverview stats={stats} feedbackCount={feedback.length} />

      {/* ─── B. AI analysis ─── */}
      <Card className="p-5 border-2 border-orange-200 bg-gradient-to-br from-orange-50/60 to-amber-50/40">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-slate-900">
              تحلیل هوش مصنوعی نظرات
            </h3>
            <p className="text-[11px] text-slate-500">
              هوش مصنوعی همه نظرات را بررسی و نقاط قوت، ضعف و پیشنهادات بهبود را استخراج می‌کند
            </p>
          </div>
          <Button
            onClick={runAnalysis}
            disabled={analyzing}
            size="sm"
            className="rounded-xl text-white gap-1.5 shrink-0"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال تحلیل...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {analysis ? "تحلیل دوباره" : "تحلیل هوش مصنوعی نظرات"}
              </>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {showAnalysis && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {analyzing ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
                  <p className="text-sm text-slate-600">
                    هوش مصنوعی در حال تحلیل نظرات است...
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    این عملیات ممکن است چند ثانیه طول بکشد
                  </p>
                </div>
              ) : analysis ? (
                <div className="rounded-2xl bg-white border border-orange-200 p-4">
                  <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-li:text-slate-600 prose-p:text-slate-600 prose-headings:mt-3 prose-headings:mb-2 prose-ul:mt-1 prose-li:mt-0.5">
                    <ReactMarkdown
                      components={{
                        h2: ({ children, ...props }) => {
                          const text = String((children as any) || "");
                          let icon = <MessageSquare className="w-4 h-4 text-orange-500" />;
                          if (text.includes("قوت"))
                            icon = <ThumbsUp className="w-4 h-4 text-emerald-500" />;
                          else if (text.includes("ضعف") || text.includes("ایراد"))
                            icon = <ThumbsDown className="w-4 h-4 text-red-500" />;
                          else if (text.includes("پیشنهاد"))
                            icon = <Lightbulb className="w-4 h-4 text-amber-500" />;
                          else if (text.includes("خلاصه"))
                            icon = <TrendingUp className="w-4 h-4 text-orange-500" />;
                          return (
                            <h2
                              className="flex items-center gap-2 text-sm font-bold text-slate-900 mt-3 mb-2"
                              {...props}
                            >
                              {icon}
                              {children}
                            </h2>
                          );
                        },
                      }}
                    >
                      {analysis}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* ─── C. Filters ─── */}
      <Card className="p-3 glass">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            فیلتر:
          </div>
          <Select value={reviewedFilter} onValueChange={setReviewedFilter}>
            <SelectTrigger className="w-[130px] rounded-xl h-9 text-xs">
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="false">بررسی‌نشده</SelectItem>
              <SelectItem value="true">بررسی‌شده</SelectItem>
            </SelectContent>
          </Select>
          <Select value={minRating} onValueChange={setMinRating}>
            <SelectTrigger className="w-[130px] rounded-xl h-9 text-xs">
              <SelectValue placeholder="حداقل امتیاز" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">همه امتیازها</SelectItem>
              <SelectItem value="1">۱+ ستاره</SelectItem>
              <SelectItem value="2">۲+ ستاره</SelectItem>
              <SelectItem value="3">۳+ ستاره</SelectItem>
              <SelectItem value="4">۴+ ستاره</SelectItem>
              <SelectItem value="5">۵ ستاره</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px] rounded-xl h-9 text-xs">
              <SelectValue placeholder="مرتب‌سازی" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">جدیدترین</SelectItem>
              <SelectItem value="rating">بالاترین امتیاز</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[140px] rounded-xl h-9 text-xs"
              placeholder="از تاریخ"
            />
            <span className="text-slate-400 text-xs">→</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[140px] rounded-xl h-9 text-xs"
              placeholder="تا تاریخ"
            />
          </div>
          {(reviewedFilter !== "all" ||
            minRating !== "0" ||
            fromDate ||
            toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl h-9 text-xs"
              onClick={() => {
                setReviewedFilter("all");
                setMinRating("0");
                setFromDate("");
                setToDate("");
              }}
            >
              پاک کردن فیلترها
            </Button>
          )}
          <div className="flex-1" />
          <Badge className="bg-primary/15 text-primary text-xs shrink-0">
            {toPersianDigits(feedback.length)} نظر
          </Badge>
        </div>
      </Card>

      {/* ─── Feedback list ─── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : filteredFeedback.length === 0 ? (
        <Card className="p-12 glass text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">هیچ نظری یافت نشد</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            با دریافت نظرات کاربران، اینجا نمایش داده می‌شود
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFeedback.map((f, idx) => (
            <FeedbackCard
              key={f.id}
              feedback={f}
              index={idx}
              onMarkReviewed={() => markReviewed(f.id)}
              onDelete={() => deleteFeedback(f.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Statistics Overview
   ============================================================ */
function StatsOverview({
  stats,
  feedbackCount,
}: {
  stats: FeedbackStats | null;
  feedbackCount: number;
}) {
  if (!stats) {
    return (
      <Card className="p-5">
        <Skeleton className="h-32 rounded-xl" />
      </Card>
    );
  }

  const total = stats.total || 0;
  const avgOverall = stats.averages.ratingOverall;

  return (
    <Card className="p-5 border-2 border-orange-100 bg-gradient-to-br from-orange-50/40 to-amber-50/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">آمار نظرات</h3>
            <p className="text-[11px] text-slate-500">
              جمع‌بندی امتیازات کاربران
            </p>
          </div>
        </div>
        <Badge
          className="text-xs"
          style={{
            background: "rgba(245,158,11,0.15)",
            color: "#c2410c",
          }}
        >
          {toPersianDigits(total)} نظر کل
        </Badge>
      </div>

      {/* Overall rating — big circular */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div
          className="col-span-1 rounded-2xl p-4 flex flex-col items-center justify-center text-center"
          style={{ background: ratingBg(avgOverall) }}
        >
          <p className="text-[11px] text-slate-500 mb-1">امتیاز کلی</p>
          <p
            className="text-4xl font-black leading-none mb-1"
            style={{ color: ratingColor(avgOverall) }}
          >
            {avgOverall !== null ? toPersianDigits(avgOverall.toFixed(1)) : "—"}
          </p>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3 h-3 ${
                  avgOverall && s <= Math.round(avgOverall)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-transparent text-slate-300"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">از ۵</p>
        </div>

        {/* Per-category progress bars */}
        <div className="col-span-2 space-y-1.5">
          {RATING_FIELDS.filter((f) => f.key !== "ratingOverall").map((f) => {
            const val = stats.averages[f.key];
            const pct = val !== null ? (val / 5) * 100 : 0;
            return (
              <div key={f.key} className="flex items-center gap-2">
                <span className="text-base shrink-0">{f.icon}</span>
                <span className="text-[11px] text-slate-600 w-28 shrink-0 truncate">
                  {f.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: ratingColor(val) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <span
                  className="text-xs font-bold w-10 text-left shrink-0"
                  style={{ color: ratingColor(val) }}
                >
                  {val !== null ? toPersianDigits(val.toFixed(1)) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-orange-100">
        <QuickStat
          label="کل نظرات"
          value={toPersianDigits(total)}
          color="#f59e0b"
        />
        <QuickStat
          label="میانگین امتیاز"
          value={avgOverall !== null ? toPersianDigits(avgOverall.toFixed(1)) + "/۵" : "—"}
          color={ratingColor(avgOverall)}
        />
        <QuickStat
          label="نظرات نمایش‌داده‌شده"
          value={toPersianDigits(feedbackCount)}
          color="#06b6d4"
        />
      </div>
    </Card>
  );
}

function QuickStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl p-2.5 text-center bg-white/60 border border-slate-100">
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      <p className="text-base font-black" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/* ============================================================
   Feedback Card — single feedback entry
   ============================================================ */
function FeedbackCard({
  feedback,
  index,
  onMarkReviewed,
  onDelete,
}: {
  feedback: FeedbackRow;
  index: number;
  onMarkReviewed: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const who = feedback.name || feedback.mobile || "ناشناس";
  const contact = feedback.mobile || feedback.name || "";
  const hasComment = !!feedback.comment?.trim();
  const hasRatings = RATING_FIELDS.some((f) => (feedback as any)[f.key] !== null);
  const overall = feedback.ratingOverall;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
    >
      <Card
        className={`p-0 overflow-hidden ${
          feedback.reviewed
            ? "border border-slate-200"
            : "border-2 border-orange-200"
        }`}
      >
        {/* Header */}
        <div className="p-3 flex items-center gap-2 border-b border-slate-100 bg-slate-50/50">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
            style={{
              background:
                overall !== null
                  ? ratingColor(overall)
                  : "linear-gradient(135deg, #f59e0b, #f97316)",
            }}
          >
            {overall !== null ? toPersianDigits(overall) : "—"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{who}</p>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {formatFaDate(feedback.createdAt)}
              {contact && ` • ${contact}`}
            </p>
          </div>
          {!feedback.reviewed && (
            <Badge
              className="text-[10px] bg-orange-100 text-orange-700 shrink-0"
              variant="secondary"
            >
              جدید
            </Badge>
          )}
          {feedback.reviewed && (
            <Badge
              className="text-[10px] bg-emerald-100 text-emerald-700 shrink-0"
              variant="secondary"
            >
              <CheckCircle2 className="w-3 h-3 ml-1" />
              بررسی‌شده
            </Badge>
          )}
        </div>

        {/* Body — ratings */}
        {hasRatings && (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 border-b border-slate-100">
            {RATING_FIELDS.map((f) => {
              const val = (feedback as any)[f.key];
              return (
                <div
                  key={f.key}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-50/50 px-2 py-1.5"
                >
                  <span className="text-sm">{f.icon}</span>
                  <span className="text-[10px] text-slate-600 flex-1 truncate">
                    {f.label}
                  </span>
                  {val !== null ? (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-[11px] font-bold text-slate-700">
                        {toPersianDigits(val)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300">—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Comment */}
        {hasComment && (
          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[11px] font-bold text-slate-500">نظر کاربر</p>
            </div>
            <p
              className={`text-xs text-slate-700 leading-relaxed whitespace-pre-wrap ${
                expanded ? "" : "line-clamp-3"
              }`}
            >
              {feedback.comment}
            </p>
            {feedback.comment && feedback.comment.length > 150 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="text-[11px] text-orange-600 hover:underline mt-1"
              >
                {expanded ? "نمایش کمتر" : "ادامه مطلب..."}
              </button>
            )}
          </div>
        )}

        {/* Legacy message (if no comment but message exists) */}
        {!hasComment && feedback.message && (
          <div className="p-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              {feedback.message}
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className="p-2 flex items-center gap-2 border-t border-slate-100 bg-slate-50/50">
          {!feedback.reviewed && (
            <Button
              onClick={onMarkReviewed}
              size="sm"
              variant="outline"
              className="rounded-lg h-8 text-xs gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              بررسی شد
            </Button>
          )}
          <Button
            onClick={() => setExpanded((e) => !e)}
            size="sm"
            variant="ghost"
            className="rounded-lg h-8 text-xs gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            {expanded ? "بستن" : "مشاهده"}
          </Button>
          <div className="flex-1" />
          <Button
            onClick={onDelete}
            size="sm"
            variant="ghost"
            className="rounded-lg h-8 text-xs gap-1.5 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            حذف
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
