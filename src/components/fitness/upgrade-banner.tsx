"use client";

import { motion } from "framer-motion";
import { Lock, Sparkles, ChevronLeft, Crown } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { PLAN_LABELS, type Plan } from "@/lib/fitness/types";

interface UpgradeBannerProps {
  /** قابلیتی که قفل است */
  featureLabel: string;
  /** حداقل پلن لازم */
  requiredPlan: Plan;
  /** توضیح اختیاری */
  description?: string;
  /** آیکون اختیاری */
  icon?: React.ReactNode;
}

/**
 * بنر ارتقا پلن — برای نمایش در صفحاتی که کاربر به دلیل پلن پایین‌تر قفل شده.
 * دکمه «ارتقا» overlay اشتراک را باز می‌کند.
 */
export function UpgradeBanner({
  featureLabel,
  requiredPlan,
  description,
  icon,
}: UpgradeBannerProps) {
  const { setOverlay } = useAppStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-emerald-500/10 to-primary/5 border border-primary/30 p-6 text-center"
    >
      {/* پس‌زمینه تزئینی */}
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary/10 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-emerald-500/10 blur-2xl" />

      <div className="relative">
        {/* آیکون قفل */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 shadow-xl mb-4"
        >
          {icon || <Lock className="w-8 h-8 text-white" />}
        </motion.div>

        <h3 className="font-black text-lg mb-1.5">{featureLabel} قفل است</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto leading-relaxed">
          {description ||
            `برای دسترسی به «${featureLabel}» باید پلن خود را به ${PLAN_LABELS[requiredPlan]} ارتقا دهید.`}
        </p>

        {/* مزایای ارتقا */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> پلن {PLAN_LABELS[requiredPlan]}
          </span>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            هر بدنی فیتاپ میخواد
          </span>
        </div>

        <Button
          onClick={() => setOverlay("subscription")}
          className="rounded-2xl h-12 px-6 font-bold shadow-lg"
        >
          <Crown className="w-4 h-4" />
          ارتقا به پلن {PLAN_LABELS[requiredPlan]}
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
