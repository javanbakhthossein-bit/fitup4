"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Crown,
  Check,
  Wallet,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import {
  toPersianDigits,
  PLAN_LABELS,
  type SubscriptionPlan,
} from "@/lib/fitness/types";
import { usePlans } from "@/lib/fitness/use-plans";
import { PurchaseModal } from "@/components/fitness/landing/sections/purchase-modal";

export function SubscriptionOverlay() {
  const { user, setOverlay } = useAppStore();
  const { plans: SUBSCRIPTION_PLANS } = usePlans();
  const [purchasePlan, setPurchasePlan] = useState<SubscriptionPlan | null>(null);

  const subEndDate = user?.planExpiresAt ? new Date(user.planExpiresAt) : null;
  // FIX: کاربر با اشتراک pending (خرید پیشرفته/حرفه‌ای بدون ارسال عکس بدن)
  // planExpiresAt=null دارد — نباید «فعال / ۰ روز» نمایش داده شود.
  const isPending = user?.hasPendingSubscription === true;
  const daysLeft = !isPending && subEndDate
    ? Math.ceil((subEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const currentPlanId = user?.planName;

  return (
    <div className="flex flex-col h-full">
      {/* هدر */}
      <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <h2 className="font-bold">مدیریت اشتراک</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOverlay(null)} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* وضعیت فعلی */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-emerald-500/5 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm">وضعیت فعلی شما</h3>
            </div>
            {user?.walletBalance !== undefined && (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Wallet className="w-3.5 h-3.5" />
                {toPersianDigits(user.walletBalance.toLocaleString("en-US"))} ت
              </div>
            )}
          </div>
          {currentPlanId ? (
            isPending ? (
              // اشتراک خریداری شده ولی هنوز فعال نشده — ۴۵ روز بعد از ارسال عکس بدن شروع می‌شود
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">پلن خریداری‌شده</span>
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    {PLAN_LABELS[currentPlanId]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">وضعیت</span>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    در انتظار تکمیل پیش‌نیازها (ارسال عکس بدن)
                  </span>
                </div>
              </div>
            ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">پلن فعال</span>
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  {PLAN_LABELS[currentPlanId]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">روزهای باقیمانده</span>
                <span className="font-bold">{toPersianDigits(Math.max(0, daysLeft))} روز</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">تاریخ انقضا</span>
                <span className="text-sm">{subEndDate?.toLocaleDateString("fa-IR")}</span>
              </div>
            </div>
            )
          ) : (
            <div className="text-center py-2">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">پلن فعالی ندارید</p>
              <p className="text-xs text-muted-foreground">برای دسترسی کامل، یک پلن انتخاب کنید</p>
            </div>
          )}
        </div>

        {/* شعار */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-600 p-5 text-white text-center shadow-xl">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
          <Crown className="w-10 h-10 mx-auto mb-2" />
          <h3 className="text-lg font-black mb-1">هر بدنی فیتاپ میخواد</h3>
          <p className="text-xs text-white/80">۴ پلن متناسب با هر هدف و بودجه</p>
        </div>

        {/* لیست پلن‌ها */}
        <div className="space-y-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-4 ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : plan.popular
                    ? "border-amber-500/40"
                    : "border-border"
                }`}
              >
                {plan.badge && !isCurrent && (
                  <div className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-l from-amber-500 to-orange-500 text-white">
                    {plan.badge}
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.accentColor} flex items-center justify-center shrink-0`}>
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{plan.label}</h4>
                      <p className="text-[11px] text-muted-foreground">{plan.tagline}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-black text-primary">
                      {toPersianDigits(plan.price.toLocaleString("en-US"))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">تومان</p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  {plan.features.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" strokeWidth={3} />
                      <span className="text-[11px] text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>

                {isCurrent ? (
                  <div className="w-full py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold text-center flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4" /> پلن فعلی شما
                  </div>
                ) : (
                  <Button
                    onClick={() => setPurchasePlan(plan)}
                    size="sm"
                    className="w-full rounded-xl"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    <Crown className="w-4 h-4" />
                    {currentPlanId ? "ارتقا به این پلن" : "انتخاب این پلن"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* بخش کد تخفیف حذف شد — کدهای تخفیف به‌صورت عمومی نمایش داده نمی‌شوند */}
      </div>

      {/* مودال خرید */}
      {purchasePlan && (
        <PurchaseModal
          plan={purchasePlan}
          onClose={() => setPurchasePlan(null)}
          onNeedLogin={() => setPurchasePlan(null)}
        />
      )}
    </div>
  );
}
