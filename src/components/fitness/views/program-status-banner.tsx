"use client";

import { Loader2, AlertTriangle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/fitness/store";

/**
 * ProgramStatusBanner — بنر مشترک وضعیت تولید برنامه (generating / failed).
 *
 * چرا این کامپوننت وجود دارد:
 * تولید برنامه با هوش مصنوعی ۱ تا ۵ دقیقه طول می‌کشد و «در پس‌زمینه» انجام
 * می‌شود (پاسخ API فوری برمی‌گردد). تا لحظه تحویل برنامه، کاربر باید بداند
 * برنامه‌اش در حال ساخت است — وگرنه فکر می‌کند خریدش هدر رفته است.
 *
 * در دو جا استفاده می‌شود:
 *  - DashboardView: برای همه پلن‌ها (basic/standard/...) — از خرید تا تحویل برنامه
 *  - PrerequisitesBanner: وقتی همه پیش‌نیازها تعیین تکلیف شده و تولید در پس‌زمینه اجراست
 *
 * status (از GET /api/coach/program-history):
 *  - "generating" → بنر بنفش با اسپینر «برنامه شما در حال آماده‌سازی است ⏳»
 *  - "failed"     → بنر هشدار کهربایی «خطا در تولید برنامه ⚠️» + دکمه رفتن به تب برنامه‌ها
 *  - سایر وضعیت‌ها → null
 */
export function ProgramStatusBanner({
  status,
  generatingTitle = "برنامه شما در حال آماده‌سازی است ⏳",
}: {
  status: string;
  /** عنوان حالت generating — داشبورد «در حال طراحی»، پیش‌نیازها «در حال آماده‌سازی» */
  generatingTitle?: string;
}) {
  // ─── در حال تولید برنامه در پس‌زمینه ───
  if (status === "generating") {
    return (
      <div
        role="status"
        aria-live="polite"
        dir="rtl"
        className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #a855f7)" }}
          >
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
          <div className="flex-1 min-w-0 self-center">
            <h3 className="font-black text-sm text-violet-900 mb-1">
              {generatingTitle}
            </h3>
            <p className="text-xs text-violet-700 leading-relaxed">
              فیتاپ هوشمند در حال طراحی برنامه تمرینی و غذایی شخصی‌سازی‌شده شماست.
              پس از آماده‌سازی به شما اطلاع می‌دهیم.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── خطا در تولید برنامه — قابل تلاش مجدد از تب برنامه‌ها ───
  if (status === "failed") {
    return (
      <div
        role="alert"
        dir="rtl"
        className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-sm text-amber-900 mb-1">
              خطا در تولید برنامه ⚠️
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed mb-3">
              تولید برنامه با خطا مواجه شد. لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید.
            </p>
            <Button
              size="sm"
              onClick={() => useAppStore.getState().setMainTab("programs")}
              className="h-11 rounded-xl px-4 text-white font-bold"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <ListChecks className="w-4 h-4" />
              رفتن به برنامه‌ها
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
