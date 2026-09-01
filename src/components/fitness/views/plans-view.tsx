"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Wallet, ShieldCheck, Sparkles, RefreshCw, Info, Clock } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { getFeatureDescription } from "@/lib/fitness/feature-descriptions";
import {
  toPersianDigits,
  formatToman,
  PLAN_LABELS,
  type SubscriptionPlan,
} from "@/lib/fitness/types";
import { usePlans } from "@/lib/fitness/use-plans";
import { PurchaseModal } from "@/components/fitness/landing/sections/purchase-modal";

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
}

export function PlansView() {
  const { user, setMainTab, setOverlay } = useAppStore();
  const { plans: SUBSCRIPTION_PLANS } = usePlans();
  const [purchasePlan, setPurchasePlan] = useState<SubscriptionPlan | null>(null);
  const [purchaseUserDiscount, setPurchaseUserDiscount] = useState<string | null>(null);
  const [renewalInfo, setRenewalInfo] = useState<RenewalDiscountInfo | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch("/api/user-discount-code", { cache: "no-store" });
        const data = await res.json();
        setRenewalInfo(data);
      } catch {
      }
    })();
  }, [user]);

  // اگر پلن pending است (advanced/ultimate بدون پیش‌نیاز)، UI متفاوت نشان بده
  const isPending = user?.hasPendingSubscription === true;
  // ─── FIX: پلن منقضی/لغو‌شده دیگر «فعال» دیده نمی‌شود ───
  // قبلاً: currentPlanId = planName || lastPlanName → کاربرِ منقضی همچنان
  // «پلن فعلی شما» + «پلن فعال — ۰ روز» می‌دید و دکمه‌های خرید پایین‌تر قفل بود!
  // حالا: فقط اشتراکِ واقعاً فعال یا pending «فعال» است؛ منقضی → حالت خرید.
  const hasActive = !!user?.planName && user?.hasActiveSubscription === true && !isPending;
  const currentPlanId = (hasActive || isPending) ? user?.planName : null;
  const expiredPlanId = !currentPlanId && !isPending ? (user?.lastPlanName ?? null) : null;
  const subEndDate = hasActive && user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const daysLeft = subEndDate ? Math.ceil((subEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  // برای بنر تمدید (متن) نام آخرین پلن لازم است — حتی وقتی منقضی شده
  const bannerPlanId = user?.planName || user?.lastPlanName;

  function renewWithDiscount() {
    // ─── دعوت به «صفحه تمدید» (تجربه کامل: آمار دوره + کد + مزایا + CTA) ───
    // به‌جای پرش مستقیم به مودال خرید، کاربر تجربه جذاب تمدید را می‌بیند و
    // از همان‌جا با کد تخفیف از-قبل-اعمال‌شده به پرداخت می‌رود.
    setOverlay("renewal");
  }

  const showRenewalBanner =
    !!bannerPlanId &&
    !renewalInfo?.isUsed &&
    !!renewalInfo?.code &&
    (renewalInfo?.expiresSoon || renewalInfo?.isExpired);

  return (
    <div className="px-4 py-4 space-y-4 max-w-6xl mx-auto lg:px-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">مدیریت اشتراک</h2>
        <p className="text-sm text-slate-500">هر بدنی فیتاپ میخواد — پلنت رو انتخاب کن</p>
      </div>

      {/* Renewal banner — shows when plan expires soon OR has already expired (+ user has a personal discount code) */}
      {showRenewalBanner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 text-white shadow-xl relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          <div className="absolute -left-6 -top-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm">
                  {renewalInfo?.isExpired
                    ? "اشتراک شما منقضی شده است"
                    : "اشتراک شما به‌زودی منقضی می‌شود"}
                </p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {renewalInfo?.isExpired
                    ? `${toPersianDigits(renewalInfo.expiredDaysAgo ?? 0)} روز از انقضای اشتراک ${PLAN_LABELS[bannerPlanId as keyof typeof PLAN_LABELS] ?? bannerPlanId} شما می‌گذرد. برای ادامه دسترسی، همین حالا تمدید کنید.`
                    : `فقط ${toPersianDigits(renewalInfo?.daysLeft ?? 0)} روز تا پایان اشتراک ${PLAN_LABELS[bannerPlanId as keyof typeof PLAN_LABELS] ?? bannerPlanId} شما باقی مانده.`}
                </p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] opacity-90">کد تخفیف اختصاصی تمدید شما:</span>
                  <span
                    dir="ltr"
                    className="text-xs font-mono px-2.5 py-1 rounded-md bg-white text-orange-600 font-bold"
                  >
                    {renewalInfo?.code}
                  </span>
                  <span className="text-[11px] opacity-90">({toPersianDigits(renewalInfo?.value ?? 0)}٪ تخفیف)</span>
                </div>
              </div>
            </div>
            <button
              onClick={renewWithDiscount}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-white text-orange-600 font-bold text-sm hover:bg-orange-50 transition shadow-md flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              تمدید اشتراک
            </button>
          </div>
        </motion.div>
      )}

      {/* وضعیت فعلی */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl p-5 text-white" style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5" />
            <h3 className="font-bold">وضعیت فعلی شما</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white/20">
            <Wallet className="w-3.5 h-3.5" />
            {toPersianDigits(formatToman(user?.walletBalance ?? 0))} ت
          </div>
        </div>
        {currentPlanId ? (
          isPending ? (
            // FIX: اشتراک pending هنوز فعال نیست — «پلن فعال / ۰ روز» گمراه‌کننده بود.
            // ۴۵ روز بعد از ارسال عکس بدن شروع می‌شود.
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] opacity-80">پلن خریداری‌شده</p>
                <p className="font-black flex items-center gap-1.5">
                  {PLAN_LABELS[currentPlanId as keyof typeof PLAN_LABELS] ?? currentPlanId}
                </p>
              </div>
              <div>
                <p className="text-[11px] opacity-80">وضعیت</p>
                <p className="font-black">در انتظار تکمیل پیش‌نیازها</p>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] opacity-80">پلن فعال</p>
              <p className="font-black flex items-center gap-1.5">
                {PLAN_LABELS[currentPlanId as keyof typeof PLAN_LABELS] ?? currentPlanId}
              </p>
            </div>
            <div>
              <p className="text-[11px] opacity-80">باقی‌مانده</p>
              <p className="font-black">{toPersianDigits(Math.max(0, daysLeft))} روز</p>
            </div>
            <div>
              <p className="text-[11px] opacity-80">انقضا</p>
              <p className="font-bold text-sm">{subEndDate?.toLocaleDateString("fa-IR")}</p>
            </div>
          </div>
          )
        ) : expiredPlanId ? (
          // ─── FIX: پلن منقضی/لغو‌شده — حالت «بدون پلن» + دعوت به تمدید ───
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold flex items-center gap-1.5">
                اشتراک {PLAN_LABELS[expiredPlanId as keyof typeof PLAN_LABELS] ?? expiredPlanId} به پایان رسیده
              </p>
              <p className="text-xs opacity-90 mt-1">برای ادامه دسترسی به امکانات، پلن خود را تمدید یا انتخاب کنید.</p>
            </div>
            <button
              onClick={renewWithDiscount}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-white text-orange-600 font-bold text-sm hover:bg-orange-50 transition shadow-md flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              تمدید اشتراک
            </button>
          </div>
        ) : (
          <p className="text-sm">پلن فعالی ندارید — یک پلن انتخاب کنید</p>
        )}
      </motion.div>

      {/* ۴ کارت پلن — سفید با حاشیه طلایی/نارنجی */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {SUBSCRIPTION_PLANS.map((plan, i) => {
          const isCurrent = plan.id === currentPlanId;
          const isUltimate = plan.id === "ultimate";
          const isAdvanced = plan.id === "advanced";
          const price = plan.price;
          // ─── منطق ارتقا: فقط پلن‌های بالاتر «ارتقا» ───
          // کاربر با پلن پیشرفته فقط روی حرفه‌ای «ارتقا» می‌بیند
          // کاربر با پلن پیشرفته روی استاندارد و اقتصادی چیزی نمی‌بیند
          const currentPlan = SUBSCRIPTION_PLANS.find((p) => p.id === currentPlanId);
          const currentTier = currentPlan?.tier ?? 0;
          // بدون پلن فعلی (منقضی/هرگز): همه دکمه‌ها «انتخاب پلن» — نه «ارتقا»
          const isHigherTier = currentTier > 0 && plan.tier > currentTier;
          const isLowerTier = currentTier > 0 && plan.tier < currentTier;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`relative rounded-3xl p-[2px] transition-all ${
                isUltimate
                  ? "bg-gradient-to-b from-amber-400 via-orange-500 to-amber-600 shadow-2xl"
                  : isAdvanced
                  ? "bg-gradient-to-b from-amber-300 to-orange-400 shadow-xl"
                  : plan.id === "standard"
                  ? "bg-gradient-to-b from-cyan-300 to-teal-400"
                  : "bg-gradient-to-b from-slate-300 to-slate-400"
              }`}
            >
              <div className="relative h-full rounded-3xl bg-white p-6 flex flex-col text-slate-900">
                {plan.badge && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2 text-[11px] font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1 text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                    {isUltimate ? <Crown className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {plan.badge}
                  </div>
                )}
                <div className="text-center mb-5 mt-2">
                  <h3 className="font-display text-xl text-slate-900">{plan.label}</h3>
                  <p className="text-xs text-slate-500 mt-1">{plan.tagline}</p>
                </div>
                <div className="text-center mb-5 py-3 border-y border-slate-200">
                  <div className="flex items-end justify-center gap-1">
                    <span className="text-3xl font-black font-stat" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      {toPersianDigits(formatToman(price))}
                    </span>
                    <span className="text-sm text-slate-500 mb-1">تومان</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{toPersianDigits(plan.durationDays)} روزه — {toPersianDigits(plan.phases)} فاز</p>
                </div>
                <div className="space-y-1.5 mb-5 flex-1">
                  {plan.features.map((f, j) => (
                    <FeatureItem key={j} text={f} />
                  ))}
                </div>
                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-1.5 text-white" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                    <Check className="w-4 h-4" /> پلن فعلی شما
                  </div>
                ) : isLowerTier ? (
                  // ─── پلن پایین‌تر: کلمه ارتقا نشان داده نمی‌شود ───
                  // فقط یک دکمه خاکستری غیرفعال با متن «پلن پایین‌تر»
                  <div className="w-full py-3 rounded-xl text-sm font-bold text-center flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 border border-slate-200">
                    {plan.label}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setPurchaseUserDiscount(null);
                      setPurchasePlan(plan);
                    }}
                    className="w-full h-11 rounded-xl font-bold text-sm text-white transition hover:scale-[1.02] flex items-center justify-center gap-1.5 shadow-lg"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                  >
                    <Crown className="w-4 h-4" />
                    {isHigherTier ? "ارتقا" : "انتخاب پلن"}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* کد تخفیف بخش حذف شد — فقط FITAP20 در مودال خرید با وارد کردن دستی کاربر نمایش داده می‌شود */}

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-orange-500" /> پرداخت امن</span>
        <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4 text-orange-500" /> پرداخت با کیف پول</span>
      </div>

      {purchasePlan && (
        <PurchaseModal
          plan={purchasePlan}
          prefillUserDiscountCode={purchaseUserDiscount ?? undefined}
          onClose={() => {
            setPurchasePlan(null);
            setPurchaseUserDiscount(null);
          }}
          onNeedLogin={() => {
            setPurchasePlan(null);
            setPurchaseUserDiscount(null);
          }}
        />
      )}
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  const [showTip, setShowTip] = useState(false);
  const desc = getFeatureDescription(text);
  return (
    <div
      className="relative flex items-start gap-2 group p-1.5 rounded-lg hover:bg-orange-50 transition-colors"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(245,158,11,0.15)" }}>
        <Check className="w-2.5 h-2.5" style={{ color: "#f59e0b" }} strokeWidth={3} />
      </div>
      <span className="text-xs text-slate-600 leading-snug flex-1 group-hover:text-slate-900 transition-colors">{text}</span>
      {desc && <Info className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5 group-hover:text-orange-500 transition" />}
      {showTip && desc && (
        <motion.div
          initial={{ opacity: 0, y: 5, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute bottom-full right-0 mb-2 z-30 w-56 p-3 rounded-xl text-[11px] leading-relaxed shadow-2xl bg-white"
          style={{ border: "1px solid #fed7aa" }}
        >
          <p className="font-bold mb-1 flex items-center gap-1 text-orange-600">
            <Info className="w-3.5 h-3.5" /> توضیح قابلیت
          </p>
          <p className="text-slate-600">{desc}</p>
        </motion.div>
      )}
    </div>
  );
}
