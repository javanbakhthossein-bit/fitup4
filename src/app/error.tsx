"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * App Router error.tsx — مرز خطای سطح روت.
 * اگر خطایی از ViewErrorBoundaryها رد شود، این fallback آخرین لایه است
 * (به‌جای صفحه سفید کامل).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[app-error]", error);

  return (
    <div
      dir="rtl"
      className="flex min-h-screen w-full items-center justify-center bg-background p-6"
      role="alert"
    >
      <div className="w-full max-w-md rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-200">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-slate-900">
          Oops! Something went wrong
        </h2>
        <p className="mb-6 text-sm leading-6 text-slate-500">
          An error occurred while loading the page. Usually the problem is solved by trying again.
          {error.digest ? (
            <span className="mt-2 block font-mono text-xs text-slate-400" dir="ltr">
              #{error.digest}
            </span>
          ) : null}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={reset}
            className="bg-gradient-to-l from-amber-500 to-orange-600 text-white shadow-md shadow-orange-200 hover:opacity-90"
          >
            <RefreshCw className="ml-2 h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") window.location.assign("/");
            }}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
