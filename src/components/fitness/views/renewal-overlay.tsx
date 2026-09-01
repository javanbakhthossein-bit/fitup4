"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  Crown,
  RefreshCw,
  Copy,
  Check,
  Flame,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Clock,
  Loader2,
  Zap,
  Heart,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { usePlans } from "@/lib/fitness/use-plans";
import {
  toPersianDigits,
  formatToman,
  PLAN_LABELS,
  type SubscriptionPlan,
} from "@/lib/fitness/types";
import { PurchaseModal } from "@/components/fitness/landing/sections/purchase-modal";
import { toast } from "sonner";

/**
 * ─── تجربه تمدید اشتراک (Renewal Experience) ───
 *
 * درخواست مالک: «تمدید خیلی مهمه چون جریان موندن کاربر در سایته — تمدید باید
 * خیلی زیبا و جذاب پیاده‌سازی بشه تا کاربر ترغیب به خرید بشه. چه برای پلن‌های
 * خریداری‌شده چه پلن‌هایی که مدیر فعال کرده».
 *
 * این صفحه برای هر دو حالت یکسان کار می‌کند چون فقط از اشتراک فعلی User
 * (فعال‌شده با پرداخت یا ادمین — هر دو endDate/planName یکسان دارند) و کد
 * تخفیف اختصاصی تمدید استفاده می‌کند.
 *
 * بخش‌ها:
 *  ۱) هدر با رینگ شمارش معکوس روزهای باقی‌مانده (یا روزهای گذشته از انقضا)
 *  ۲) آمار دوره فعلی (تغییر وزن + تمرین‌های ثبت‌شده) — دلیلی که «قلم نزنی»
 *  ۳) کد تخفیف اختصاصی ۱۵٪ با دکمه کپی + مهلت اعتبار
 *  ۴) محاسبه قیمت نهایی با تخفیف — شفاف و بی‌ابهام
 *  ۵) مزایای تمدید (حفظ روزهای باقی‌مانده + ادامه چت مربی + ...)
 *  ۶) CTA بزرگ «تمدید با ۱۵٪ تخفیف» → PurchaseModal با کد اعمال‌شده
 *  ۷) مسیر ارتقا برای کاربرانی که پلن پایین دارند
 */

interface RenewalDiscountInfo {
  code: string | null;
  value: number;
  type: string;
  validUntil: string | null;
  isUsed: boolean;
  expiresSoon: boolean;
  isExpired: boolean;
  expiredDaysAgo: number | null;
  daysLeft: number;
  subEndDate: string | null;
  currentPlanId: string | null;
  // ─── آمار دوره (برای بخش «در این دوره چه ساختی؟») ───
  planStartedAt?: string | null;
  planDurationDays?: number;
  workoutsCompleted?: number | null;
  weightStartKg?: number | null;
  weightCurrentKg?: number | null;
}

const goldGradient = "linear-gradient(135deg, #f59e0b, #f97316)";

export function RenewalOverlay() {
  const { user, setOverlay } = useAppStore();
  const { plans: SUBSCRIPTION_PLANS } = usePlans();
  const [renewalInfo, setRenewalInfo] = useState<RenewalDiscountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [purchasePlan, setPurchasePlan] = useState<SubscriptionPlan | null>(null);
  const [purchaseCode, setPurchaseCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user-discount-code", { cache: "no-store" });
        const disc = await res.json().catch(() => null);
        if (!cancelled && disc) setRenewalInfo(disc);
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentPlanId = user?.planName || user?.lastPlanName || renewalInfo?.currentPlanId;
  const currentPlan = SUBSCRIPTION_PLANS.find((p) => p.id === currentPlanId) ?? null;
  const higherPlans = currentPlan
    ? SUBSCRIPTION_PLANS.filter((p) => p.tier > currentPlan.tier)
    : [];

  const isExpired = renewalInfo?.isExpired ?? (user?.planName && !user?.hasActiveSubscription ? true : false);
  const subEnd = renewalInfo?.subEndDate
    ? new Date(renewalInfo.subEndDate)
    : user?.subscriptionEnd
      ? new Date(user.subscriptionEnd)
      : user?.planExpiresAt
        ? new Date(user.planExpiresAt)
        : null;
  const daysLeft = subEnd ? Math.max(0, Math.ceil((subEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 0;
  const daysSinceExpiry = renewalInfo?.expiredDaysAgo ?? 0;

  // پیشرفت دوره — تغییر وزن از شروع تا الان
  const startWeight = renewalInfo?.weightStartKg ?? null;
  const currentWeight = renewalInfo?.weightCurrentKg ?? startWeight;
  const weightDelta = startWeight != null && currentWeight != null
    ? Math.round((currentWeight - startWeight) * 10) / 10
    : null;
  const workoutCount = renewalInfo?.workoutsCompleted ?? null;

  // قیمت با تخفیف تمدید
  const discountPercent = renewalInfo?.code && !renewalInfo?.isUsed ? (renewalInfo.value ?? 15) : 0;
  const planPrice = currentPlan?.price ?? 0;
  const finalPrice = Math.max(0, Math.round(planPrice * (1 - discountPercent / 100)));

  // رینگ پیشرفت دوره (چند درصد از دوره گذشته)
  const planDuration = renewalInfo?.planDurationDays ?? currentPlan?.durationDays ?? 45;
  const daysElapsed = renewalInfo?.planStartedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(renewalInfo.planStartedAt).getTime()) / (24 * 60 * 60 * 1000)))
    : isExpired
      ? planDuration
      : Math.max(0, Math.min(planDuration, planDuration - daysLeft));
  const ringPercent = Math.min(100, Math.round((Math.min(daysElapsed, planDuration) / planDuration) * 100));

  function copyCode() {
    if (!renewalInfo?.code) return;
    try {
      navigator.clipboard.writeText(renewalInfo.code);
      setCopied(true);
      toast.success("کد تخفیف کپی شد ✅");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی نشد — کد را دستی یادداشت کنید");
    }
  }

  function startRenewal() {
    if (!currentPlan) {
      toast.error("پلن فعلی شما قابل شناسایی نیست — از تب پلن‌ها تمدید کنید");
      return;
    }
    setPurchaseCode(renewalInfo?.code && !renewalInfo.isUsed ? renewalInfo.code : null);
    setPurchasePlan(currentPlan);
  }

  function upgradeTo(plan: SubscriptionPlan) {
    setPurchaseCode(null);
    setPurchasePlan(plan);
  }

  const R = 44;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div
        className="relative flex items-center justify-between p-4 border-b text-white overflow-hidden shrink-0"
        style={{ background: goldGradient }}
      >
        <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          <h2 className="font-black">تمدید اشتراک</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOverlay(null)}
          className="relative rounded-full text-white hover:bg-white/20 hover:text-white"
          aria-label="بستن"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm text-slate-500">در حال آماده‌سازی پیشنهاد تمدید شما…</p>
          </div>
        ) : !currentPlanId ? (
          /* ─── بدون پلن قبلی → مسیر خرید ─── */
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
              <Crown className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="font-black text-lg text-slate-900">هنوز پلنی ندارید</h3>
            <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
              صفحه تمدید برای کاربرانی است که پلن فعال یا منقضی دارند. شما می‌توانید همین حالا اولین پلن خود را انتخاب کنید.
            </p>
            <Button
              onClick={() => { setOverlay(null); useAppStore.getState().setMainTab("plans"); }}
              className="rounded-xl font-bold text-white px-8"
              style={{ background: goldGradient }}
            >
              <Crown className="w-4 h-4" />
              انتخاب پلن
            </Button>
          </div>
        ) : (
          <div className="max-w-lg mx-auto p-4 space-y-4 pb-8">
            {/* ─── ۱) هرو: وضعیت دوره با رینگ ─── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-3xl p-5 text-white overflow-hidden shadow-xl"
              style={{ background: isExpired ? "linear-gradient(135deg, #64748b, #334155)" : goldGradient }}
            >
              <div className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-5">
                {/* رینگ پیشرفت دوره */}
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r={44} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
                    <motion.circle
                      cx="50" cy="50" r={44}
                      fill="none"
                      stroke="white"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={C}
                      initial={{ strokeDashoffset: C }}
                      animate={{ strokeDashoffset: C - (C * ringPercent) / 100 }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {isExpired ? (
                      <>
                        <p className="font-black text-2xl leading-none font-stat">{toPersianDigits(Math.max(0, daysSinceExpiry))}</p>
                        <p className="text-[9px] opacity-80 mt-1">روز از انقضا</p>
                      </>
                    ) : daysLeft > 0 ? (
                      <>
                        <p className="font-black text-2xl leading-none font-stat">{toPersianDigits(daysLeft)}</p>
                        <p className="text-[9px] opacity-80 mt-1">روز باقی‌مانده</p>
                      </>
                    ) : (
                      <Clock className="w-8 h-8" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] opacity-80 mb-0.5">پلن فعلی شما</p>
                  <h3 className="font-black text-xl leading-tight">
                    {PLAN_LABELS[currentPlanId as keyof typeof PLAN_LABELS] ?? currentPlanId}
                  </h3>
                  {isExpired ? (
                    <p className="text-xs opacity-90 mt-1.5 leading-relaxed">
                      پلن تمام شده، ولی پیشرفتت سر جاست. با تمدید، از همین‌جا ادامه می‌دهی.
                    </p>
                  ) : daysLeft <= 5 ? (
                    <p className="text-xs opacity-90 mt-1.5 leading-relaxed">
                      رو به پایان است — همین حالا تمدید کن تا یک روز هم از برنامه‌ات جا نمونی.
                    </p>
                  ) : (
                    <p className="text-xs opacity-90 mt-1.5 leading-relaxed">
                      دوره‌ات در حال پیشرفت است — با تمدید زودهنگام، هیچ روزی از دستت نمی‌ره.
                    </p>
                  )}
                  {subEnd && !isExpired && (
                    <p className="text-[10px] opacity-75 mt-2">
                      تاریخ پایان: {subEnd.toLocaleDateString("fa-IR")}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ─── ۲) آمار دوره — «قلم نزن» ─── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-orange-500" />
                <h3 className="font-bold text-sm text-slate-800">در این دوره چه ساختی؟</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {weightDelta != null && Math.abs(weightDelta) > 0.05 ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5">
                    <p className="text-[10px] text-emerald-700 mb-0.5">
                      {weightDelta < 0 ? "کاهش وزن" : "افزایش وزن"}
                    </p>
                    <p className="font-black text-sm text-emerald-600 font-stat">
                      {toPersianDigits(Math.abs(weightDelta).toFixed(1))} <span className="text-[9px] font-normal">kg</span>
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                    <p className="text-[10px] text-slate-500 mb-0.5">ثبت وزن</p>
                    <p className="font-black text-sm text-slate-400 font-stat">—</p>
                  </div>
                )}
                {workoutCount != null ? (
                  <div className="rounded-xl bg-orange-50 border border-orange-100 p-2.5">
                    <p className="text-[10px] text-orange-700 mb-0.5">تمرین ثبت‌شده</p>
                    <p className="font-black text-sm text-orange-600 font-stat">{toPersianDigits(workoutCount)}</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                    <p className="text-[10px] text-slate-500 mb-0.5">تمرین‌ها</p>
                    <p className="font-black text-sm text-slate-400 font-stat">—</p>
                  </div>
                )}
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-2.5">
                  <p className="text-[10px] text-amber-700 mb-0.5">روزهای همراهی</p>
                  <p className="font-black text-sm text-amber-600 font-stat">{toPersianDigits(Math.max(0, daysElapsed))}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2.5 text-center leading-relaxed">
                این‌ها حاصل پشت‌کار خودته — با تمدید، از همین نقطه ادامه می‌دی نه از صفر.
              </p>
            </motion.div>

            {/* ─── ۳) کد تخفیف اختصاصی ─── */}
            {renewalInfo?.code && !renewalInfo.isUsed ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.16 }}
                className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/60 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    <h3 className="font-bold text-sm text-orange-800">هدیه تمدید — اختصاصی خودت</h3>
                  </div>
                  <span className="text-[11px] font-black text-orange-600 bg-white px-2 py-0.5 rounded-full border border-orange-200">
                    {toPersianDigits(discountPercent)}٪ تخفیف
                  </span>
                </div>
                <button
                  onClick={copyCode}
                  dir="ltr"
                  className="w-full flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-3 border border-orange-200 transition active:scale-[0.98] hover:shadow-md"
                  aria-label={`کپی کد تخفیف ${renewalInfo.code}`}
                >
                  <span className="font-mono font-black text-base text-slate-800 tracking-wider">
                    {renewalInfo.code}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-orange-600">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "کپی شد" : "کپی"}
                  </span>
                </button>
                {renewalInfo.validUntil && (
                  <p className="text-[10px] text-orange-700/80 mt-2 text-center">
                    کد تا {new Date(renewalInfo.validUntil).toLocaleDateString("fa-IR")} معتبر است — بعدش هدیه بس است و قیمت عادی می‌شه.
                  </p>
                )}
              </motion.div>
            ) : null}

            {/* ─── ۴+۵) قیمت نهایی + مزایا ─── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-sm text-slate-800">با تمدید چه می‌گیری؟</h3>
              </div>
              <ul className="space-y-2">
                <BenefitRow
                  icon={<Zap className="w-3.5 h-3.5" />}
                  text="روزهای باقی‌مانده‌ت دور ریخته نمی‌شه — به دوره جدید اضافه می‌شه"
                />
                <BenefitRow
                  icon={<TrendingUp className="w-3.5 h-3.5" />}
                  text="برنامه و پیشرفتت بدون وقفه ادامه پیدا می‌کنه"
                />
                <BenefitRow
                  icon={<Heart className="w-3.5 h-3.5" />}
                  text="مربی هوشمند با حافظه‌ی کامل دوره قبلیت همراهت می‌مونه"
                />
                {discountPercent > 0 && (
                  <BenefitRow
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                    text={`${toPersianDigits(discountPercent)}٪ تخفیف وفاداری — فقط برای تمدید، نه خرید اول`}
                  />
                )}
              </ul>

              {currentPlan && planPrice > 0 && (
                <div className="pt-2 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <p className="text-[11px] text-slate-500 mb-0.5">تمدید پلن {currentPlan.label}</p>
                    {discountPercent > 0 ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-slate-400 line-through font-stat">
                          {toPersianDigits(formatToman(planPrice))}
                        </span>
                        <span className="text-xl font-black font-stat text-slate-900">
                          {toPersianDigits(formatToman(finalPrice))}
                        </span>
                        <span className="text-[10px] text-slate-500">تومان</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-stat text-slate-900">
                          {toPersianDigits(formatToman(planPrice))}
                        </span>
                        <span className="text-[10px] text-slate-500">تومان</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 text-left leading-snug">
                    {toPersianDigits(currentPlan.durationDays)} روزه
                    <br />
                    پرداخت امن زرین‌پال / بازار
                  </span>
                </div>
              )}
            </motion.div>

            {/* ─── ۶) CTA بزرگ ─── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="space-y-2"
            >
              <button
                onClick={startRenewal}
                disabled={!currentPlan}
                className="w-full p-5 rounded-2xl text-white shadow-xl shadow-orange-500/30 transition hover:scale-[1.01] active:scale-[0.99] flex items-center gap-4 disabled:opacity-50 disabled:pointer-events-none"
                style={{ background: goldGradient }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 text-right">
                  <p className="font-black text-base">
                    {discountPercent > 0 ? `تمدید با ${toPersianDigits(discountPercent)}٪ تخفیف` : "تمدید اشتراک"}
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    {currentPlan
                      ? discountPercent > 0
                        ? `${toPersianDigits(formatToman(finalPrice))} تومان به‌جای ${toPersianDigits(formatToman(planPrice))}`
                        : `${toPersianDigits(formatToman(planPrice))} تومان — پرداخت امن`
                      : "پلن فعلی شما شناسایی نشد"}
                  </p>
                </div>
                <Crown className="w-5 h-5" />
              </button>
              <p className="text-center text-[10px] text-slate-400">
                کد تخفیف به‌صورت خودکار در صفحه پرداخت اعمال می‌شود
              </p>
            </motion.div>

            {/* ─── ۷) مسیر ارتقا ─── */}
            {higherPlans.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.34 }}
                className="rounded-2xl border border-slate-100 bg-white p-4"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <h3 className="font-bold text-sm text-slate-800">می‌خوای این دوره را قوی‌تر شروع کنی؟</h3>
                </div>
                <div className="space-y-2">
                  {higherPlans.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => upgradeTo(p)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white transition hover:border-orange-300 hover:shadow-sm active:scale-[0.99] text-right"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(245,158,11,0.12)" }}>
                        <Crown className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-800">ارتقا به {p.label}</p>
                        <p className="text-[10px] text-slate-500 truncate">{p.tagline}</p>
                      </div>
                      <div className="text-left shrink-0">
                        <p className="text-sm font-black font-stat text-slate-900">{toPersianDigits(formatToman(p.price))}</p>
                        <p className="text-[9px] text-slate-400">تومان</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2.5 text-center leading-relaxed">
                  موقع ارتقا، ارزش روزهای باقی‌مانده‌ی پلن فعلیت محاسبه و از مبلغ کسر می‌شه.
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* ─── PurchaseModal با کد تمدید از قبل اعمال‌شده ─── */}
      {purchasePlan && (
        <PurchaseModal
          plan={purchasePlan}
          prefillUserDiscountCode={purchaseCode ?? undefined}
          onClose={() => {
            setPurchasePlan(null);
            setPurchaseCode(null);
          }}
          onNeedLogin={() => {
            setPurchasePlan(null);
            setPurchaseCode(null);
          }}
        />
      )}
    </div>
  );
}

function BenefitRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-emerald-600 bg-emerald-50">
        {icon}
      </span>
      <span className="text-xs text-slate-600 leading-relaxed flex-1">{text}</span>
    </li>
  );
}
