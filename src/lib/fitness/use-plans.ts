"use client";

import { useEffect, useState } from "react";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "./types";

interface UsePlansResult {
  plans: SubscriptionPlan[];
  loading: boolean;
  refresh: () => Promise<void>;
}

// کش سراسری — همه‌ی نمونه‌های hook از همین داده استفاده می‌کنند
let globalPlans: SubscriptionPlan[] = SUBSCRIPTION_PLANS;
let globalFetchPromise: Promise<void> | null = null;
let globalFetched = false;

async function fetchPlansOnce() {
  if (globalFetchPromise) return globalFetchPromise;
  globalFetchPromise = (async () => {
    try {
      const res = await fetch("/api/payment/checkout");
      const data = await res.json();
      if (data.plans) {
        globalPlans = data.plans;
        globalFetched = true;
      }
    } catch {
      // در صورت خطا از پیش‌فرض‌ها استفاده می‌شود
    } finally {
      globalFetchPromise = null;
    }
  })();
  return globalFetchPromise;
}

/**
 * Hook مشترک برای دریافت پلن‌ها با قیمت‌های به‌روز از سرور.
 * یک fetch سراسری انجام می‌شود و همه‌ی نمونه‌ها از همان نتیجه استفاده می‌کنند.
 */
export function usePlans(): UsePlansResult {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(globalPlans);
  const [loading, setLoading] = useState(!globalFetched);

  useEffect(() => {
    let mounted = true;

    if (globalFetched) {
      // قبلاً fetch شده — فقط مقدار کش را ست کن
      if (plans !== globalPlans) setPlans(globalPlans);
      setLoading(false);
      return;
    }

    // fetch را شروع کن (اگر قبلاً شروع نشده)
    setLoading(true);
    fetchPlansOnce().then(() => {
      if (mounted) {
        setPlans(globalPlans);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    globalFetched = false;
    await fetchPlansOnce();
    setPlans(globalPlans);
  };

  return { plans, loading, refresh };
}
