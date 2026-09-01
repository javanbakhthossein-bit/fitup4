"use client";
import { useEffect } from "react";
import { useAppStore } from "@/lib/fitness/store";

/**
 * Prevents accidental app exit when running as PWA (installed app).
 * When user presses back button at the root screen, shows a confirmation dialog
 * instead of immediately closing the app.
 *
 * Only active in PWA standalone mode (not in browser).
 */
export function BackButtonHandler() {
  const screen = useAppStore((s) => s.screen);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only active in PWA standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as any).standalone === true; // iOS

    if (!isStandalone) return;

    // Push a dummy state on mount so we can intercept back button
    window.history.pushState({ pwa: true, depth: 0 }, "", window.location.href);

    let confirmedExit = false;

    const handlePopState = () => {
      // If user already confirmed exit, let them leave
      if (confirmedExit) return;

      // Prevent default exit
      // Push state again so we stay in the app
      window.history.pushState({ pwa: true, depth: 0 }, "", window.location.href);

      // Show confirmation dialog
      const confirmed = window.confirm(
        "آیا می‌خواهید از برنامه فیتاپ خارج شوید؟"
      );

      if (confirmed) {
        confirmedExit = true;
        // Go back in history (exit app)
        window.history.back();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [screen]);

  return null;
}
