"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ErrorBoundary برای ویوهای اصلی اپلیکیشن.
 *
 * چرا لازم است؟ بدون Error Boundary، یک Exception در رندرِ هر کامپوننت
 * (مثلاً داده‌ی خراب از API) کل درخت React را unmount می‌کند → صفحه سفید.
 * با این مرز، فقط همان ویو fallback می‌گیرد و بقیه اپ زنده می‌ماند.
 *
 * ویژگی‌ها:
 *  - fallback فارسی RTL هم‌سبک با طراحی فیتاپ (گرادیان نارنجی)
 *  - دکمه «تلاش مجدد» (remount کامل ویو)
 *  - لاگ خطا در کنسول برای دیباگ (production هم)
 *  - resetKey: با تغییر تب، boundary خودش ریست می‌شود
 */
interface ViewErrorBoundaryProps {
  children: ReactNode;
  /** نام ویو برای نمایش در پیام خطا و لاگ */
  viewName?: string;
  /** با تغییر این مقدار، boundary ریست می‌شود (مثلاً کلید تب فعال) */
  resetKey?: string | number;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  state: ViewErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // لاگ کامل برای دیباگ سمت سرور/کنسول
    console.error(
      `[ViewErrorBoundary:${this.props.viewName ?? "view"}] render error:`,
      error,
      info.componentStack
    );
  }

  componentDidUpdate(prev: ViewErrorBoundaryProps) {
    // تغییر تب/کلید ریست → تلاش دوباره برای رندر
    if (
      this.state.hasError &&
      prev.resetKey !== undefined &&
      prev.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        className="flex min-h-[60vh] w-full items-center justify-center p-6"
        role="alert"
        aria-live="assertive"
      >
        <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-200">
            <AlertTriangle className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-900">
            این بخش موقتاً به مشکل خورده است
          </h2>
          <p className="mb-6 text-sm leading-6 text-slate-500">
            نمایش {this.props.viewName ? `«${this.props.viewName}»` : "این صفحه"} با خطا مواجه
            شد، اما بقیه برنامه سالم است. معمولاً با تلاش مجدد برطرف می‌شود.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              onClick={this.handleRetry}
              className="bg-gradient-to-l from-amber-500 to-orange-600 text-white shadow-md shadow-orange-200 hover:opacity-90"
            >
              <RefreshCw className="ml-2 h-4 w-4" aria-hidden="true" />
              تلاش مجدد
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof window !== "undefined") window.location.assign("/");
              }}
            >
              <Home className="ml-2 h-4 w-4" aria-hidden="true" />
              بازگشت به خانه
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
