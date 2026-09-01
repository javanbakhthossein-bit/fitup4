"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/lib/fitness/store";
import { NewTermsModal } from "@/components/fitness/new-terms-modal";

/**
 * Global new-terms modal — mounted once in layout.tsx so it's always
 * available regardless of which page/screen the user is on.
 *
 * Renders via React portal to document.body so it appears on top of any
 * screen (article, dashboard, auth, ...).
 *
 * Visibility is controlled by the `termsUpdateRequired` flag in the store.
 * The flag is set by page.tsx when /api/auth/me returns
 * `termsUpdateRequired: true` (user was logged out due to outdated
 * TermsVersion).
 *
 * On accept:
 *   - clears the store flag (closes the modal)
 *   - navigates to the auth screen for OTP
 *   - cleans the URL so a refresh doesn't try to re-render the original page
 */
export function GlobalNewTermsModal() {
  const termsUpdateRequired = useAppStore((s) => s.termsUpdateRequired);
  const setTermsUpdateRequired = useAppStore((s) => s.setTermsUpdateRequired);
  const setScreen = useAppStore((s) => s.setScreen);
  const [mounted, setMounted] = useState(false);

  // SSR-safe: portal can only render on the client (document.body is undefined
  // on the server). We mount the component, then flip `mounted` to true after
  // the first render so createPortal runs only client-side.
  // The eslint-disable is necessary because the lint rule discourages setState
  // in effects — but this is the canonical pattern for SSR-safe portals.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // SSR-safe: don't render the portal on the server
  if (!mounted) return null;

  // When the flag is false, render nothing — the portal will be unmounted.
  if (!termsUpdateRequired) return null;

  return createPortal(
    <NewTermsModal
      open={true}
      onAccept={() => {
        // Clear the flag (closes the modal)
        setTermsUpdateRequired(false);
        // Navigate to the auth screen so user can complete OTP and re-accept terms
        setScreen("auth");
        // Update URL to reflect the auth screen — keeps history in sync so
        // a refresh keeps the user on the auth screen.
        try {
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("screen", "auth");
            // Preserve other params (e.g., article slug) so user can return
            // to the page they were on after re-authenticating.
            window.history.replaceState({}, "", url.toString());
          }
        } catch {
          // ignore URL errors
        }
      }}
    />,
    document.body
  );
}
