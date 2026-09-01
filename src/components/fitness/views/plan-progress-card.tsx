"use client";

/**
 * ─── کارت یکپارچه «پیشرفت پلن + جملات انگیزشی» ───
 *
 * ادغامِ دو بخش (پیشرفت پلن + جمله‌ی روزانه) در یک کارتِ پرمیومِ واحد:
 *
 *  ┌─────────────────────────────────────────┐
 *  │  بخش بالا: وضعیت پلن                      │
 *  │   • فعال → رینگ SVG پیشرفت + روز X از ۴۵   │
 *  │   • pending → «در انتظار فعال‌سازی»         │
 *  │   • بدون پلن → CTA «دریافت پلن»            │
 *  │ ────────── ◆ خط جداکننده ──────────        │
 *  │  بخش پایین: جملات انگیزشی (بزرگان ورزش)   │
 *  │   «...» — آرنولد شوارتزنگر               │
 *  └─────────────────────────────────────────┘
 *
 * طراحی: کارتِ تیره‌ی پرمیوم با قابِ گرادیانی کهربایی (بدون آبی/بنفش).
 * جمله‌ی روز deterministic بر اساس روزِ سال شمسی است (بدون API).
 */
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Crown,
  Quote as QuoteIcon,
  RefreshCw,
  Target,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { PLAN_LABELS, toPersianDigits } from "@/lib/fitness/types";
import { getDailyQuote } from "@/lib/fitness/daily-quotes";

const PLAN_DURATION_DAYS = 45;
const DAY_MS = 86_400_000;

/** تاریخ کوتاه شمسی مثل «۱۵ مهر» */
function jalaliShort(d: Date): string {
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Tehran",
    }).format(d);
  } catch {
    return "—";
  }
}

/** خط جداکننده‌ی تزئینی با الماس وسط */
function OrnamentDivider() {
  return (
    <div className="flex items-center gap-3 my-4" aria-hidden="true">
      <span
        className="flex-1 h-px"
        style={{ background: "linear-gradient(to left, rgba(251,191,36,0.45), transparent)" }}
      />
      <span
        className="w-1.5 h-1.5 rotate-45"
        style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
      />
      <span
        className="flex-1 h-px"
        style={{ background: "linear-gradient(to right, rgba(251,191,36,0.45), transparent)" }}
      />
    </div>
  );
}

export function PlanProgressCard() {
  const { user, setMainTab, setOverlay } = useAppStore();
  const quote = getDailyQuote();

  // پایان دوره: planExpiresAt (اولویت) یا subscriptionEnd (fallback)
  const expiryMs =
    user?.planExpiresAt != null
      ? new Date(user.planExpiresAt).getTime()
      : user?.subscriptionEnd != null
        ? new Date(user.subscriptionEnd).getTime()
        : null;
  // شروع دوره = پایان − ۴۵ روز (fallback کلاینت‌ساید)
  const startMs = expiryMs != null ? expiryMs - PLAN_DURATION_DAYS * DAY_MS : null;
  const nowMs = Date.now();

  const hasPlan = !!user?.planName;
  const isActive = hasPlan && !!user?.hasActiveSubscription;
  const planLabel = user?.planName ? PLAN_LABELS[user.planName] : "";

  // ─── محاسبات پلن فعال ───
  const elapsedDays =
    startMs != null
      ? Math.min(PLAN_DURATION_DAYS, Math.max(1, Math.floor((nowMs - startMs) / DAY_MS) + 1))
      : 1;
  const daysRemaining =
    expiryMs != null ? Math.max(0, Math.ceil((expiryMs - nowMs) / DAY_MS)) : 0;
  const progressFrac =
    startMs != null && expiryMs != null
      ? Math.min(1, Math.max(0, (nowMs - startMs) / (expiryMs - startMs)))
      : 0;
  const percent = Math.round(progressFrac * 100);
  const urgent = daysRemaining <= 10;
  const renewalSoon = daysRemaining > 0 && daysRemaining <= 10;

  const RING_RADIUS = 42;
  const RING_CIRC = 2 * Math.PI * RING_RADIUS;

  /* ─── بخشِ بالا: وضعیت پلن ─── */
  let planSection: React.ReactNode;

  if (!hasPlan) {
    // بدون پلن — CTA
    planSection = (
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-11 h-11 rounded-2xl bg-amber-400/15 flex items-center justify-center shrink-0">
          <Crown className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm sm:text-base text-amber-50">پلن فعالی نداری</p>
          <p className="text-[11px] sm:text-xs text-amber-100/60 mt-0.5 leading-relaxed">
            یک پلن انتخاب کن تا برنامه‌ی اختصاصی و مسیرِ پیشرفتت شروع شود.
          </p>
        </div>
        <button
          onClick={() => setMainTab("plans")}
          className="shrink-0 text-slate-900 font-black text-xs sm:text-sm px-4 h-10 rounded-xl shadow hover:scale-[1.04] active:scale-95 transition"
          style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
        >
          دریافت پلن
        </button>
      </div>
    );
  } else if (!isActive) {
    // pending
    planSection = (
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-11 h-11 rounded-2xl bg-amber-400/15 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-sm sm:text-base text-amber-50">
              پلن {planLabel} در انتظار فعال‌سازی
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full text-amber-300 font-bold bg-amber-400/10 border border-amber-400/25">
              به‌زودی
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-amber-100/60 mt-0.5 leading-relaxed">
            به‌محض تکمیلِ پیش‌نیازها، دوره‌ی {toPersianDigits(PLAN_DURATION_DAYS)} روزه‌ات فعال می‌شود.
          </p>
        </div>
      </div>
    );
  } else {
    // فعال — رینگ + آمار
    planSection = (
      <div className="flex items-center gap-4 sm:gap-5">
        {/* رینگ پیشرفت */}
        <div className="relative w-[84px] h-[84px] sm:w-[92px] sm:h-[92px] shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <defs>
              <linearGradient id="planRingGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="55%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            <circle
              cx="50" cy="50" r={RING_RADIUS}
              fill="none" stroke="rgba(251,191,36,0.14)" strokeWidth="9"
            />
            <motion.circle
              cx="50" cy="50" r={RING_RADIUS}
              fill="none" stroke="url(#planRingGradient)" strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              initial={{ strokeDashoffset: RING_CIRC }}
              animate={{ strokeDashoffset: RING_CIRC * (1 - progressFrac) }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ filter: "drop-shadow(0 0 5px rgba(245,158,11,0.5))" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base sm:text-lg font-black leading-none text-amber-50">
              ٪{toPersianDigits(percent)}
            </span>
            <span className="text-[8px] text-amber-100/50 mt-0.5">پیشرفت دوره</span>
          </div>
        </div>

        {/* اطلاعات دوره */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <h3 className="font-bold text-sm text-amber-50">پیشرفت پلن</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full text-amber-300 font-bold flex items-center gap-1 bg-amber-400/10 border border-amber-400/25">
              <Crown className="w-3 h-3" /> {planLabel}
            </span>
          </div>
          <p className="text-base sm:text-lg font-black text-amber-50 leading-tight">
            روز {toPersianDigits(elapsedDays)} از {toPersianDigits(PLAN_DURATION_DAYS)}
          </p>
          <p className="text-xs mt-1 font-bold flex items-center gap-1.5 flex-wrap">
            <span className={urgent ? "text-amber-400" : "text-amber-100/60"}>
              {toPersianDigits(daysRemaining)} روز باقی‌مانده
            </span>
            <span className="text-amber-100/30">·</span>
            <span className="text-amber-100/50">
              پایان: {expiryMs != null ? jalaliShort(new Date(expiryMs)) : "—"}
            </span>
          </p>
        </div>

        {/* دکمه تمدید در ۱۰ روز آخر */}
        {renewalSoon && (
          <button
            onClick={() => setOverlay("renewal")}
            className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-900 px-3.5 h-10 rounded-xl shadow hover:scale-[1.03] active:scale-95 transition"
            style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تمدید
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="animate-fade-in-up anim-delay-100"
    >
      {/* قاب گرادیانی کهربایی */}
      <div
        className="rounded-3xl p-[1.5px] shadow-lg shadow-stone-900/20"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,191,36,0.95), rgba(249,115,22,0.55), rgba(251,191,36,0.85))",
        }}
      >
        <div
          className="relative overflow-hidden rounded-[22px] p-5 sm:p-6"
          style={{ background: "linear-gradient(140deg, #292524 0%, #1c1917 45%, #0c0a09 100%)" }}
        >
          {/* هاله‌های گرم */}
          <div
            className="absolute -top-12 -left-8 w-40 h-40 rounded-full blur-3xl opacity-20"
            style={{ background: "#f59e0b" }}
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-14 -right-10 w-44 h-44 rounded-full blur-3xl opacity-15"
            style={{ background: "#f97316" }}
            aria-hidden="true"
          />
          {/* واترمارک علامت نقل‌قول */}
          <QuoteIcon
            className="absolute -left-3 bottom-3 w-24 h-24 text-amber-500/10 pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative">
            {/* ─── بخش بالا: وضعیت پلن ─── */}
            {planSection}

            {/* ─── خط جداکننده ─── */}
            <OrnamentDivider />

            {/* ─── بخش پایین: جملات انگیزشی ─── */}
            <div>
              {/* هدر: عنوان + چیپ تاریخ شمسی */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <QuoteIcon
                    className="w-4 h-4 text-amber-400 shrink-0"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                  <span className="text-xs font-bold text-amber-400/90 truncate">جملات انگیزشی</span>
                </div>
                <span
                  className="shrink-0 inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full text-amber-300"
                  style={{
                    background: "rgba(251,191,36,0.10)",
                    border: "1px solid rgba(251,191,36,0.25)",
                  }}
                >
                  <Calendar className="w-3 h-3" />
                  {quote.dateKey}
                </span>
              </div>

              {/* جمله — بزرگ و خوانا */}
              <p className="text-base sm:text-lg font-bold leading-relaxed sm:leading-relaxed text-amber-50 border-r-[3px] border-amber-400/60 pr-2.5 sm:pr-3.5">
                {quote.text}
              </p>

              {/* گوینده */}
              <p className="text-xs sm:text-sm font-bold text-amber-400/90 mt-2.5 pr-2.5 sm:pr-3.5 flex items-center gap-1.5">
                <span className="w-4 h-px bg-amber-400/50" aria-hidden="true" />
                {quote.author}
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
