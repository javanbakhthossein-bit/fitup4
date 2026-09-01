"use client";
import { useEffect } from "react";

/**
 * Captures client-side errors and sends them to the error logging API.
 * - window.onerror for uncaught errors
 * - window.onunhandledrejection for unhandled promise rejections
 */
export function ErrorCapture() {
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      try {
        const { message, filename, lineno, colno, error } = event;
        fetch("/api/error-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "client",
            message: message || "Unknown error",
            stack: error?.stack || `${filename}:${lineno}:${colno}`,
            url: window.location.href,
            userAgent: navigator.userAgent,
          }),
        }).catch(() => {});
      } catch {}
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason;
        const message = reason?.message || String(reason);
        const stack = reason?.stack || "";
        fetch("/api/error-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "client",
            message: `Unhandled rejection: ${message}`,
            stack,
            url: window.location.href,
            userAgent: navigator.userAgent,
          }),
        }).catch(() => {});
      } catch {}
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);
  return null;
}
