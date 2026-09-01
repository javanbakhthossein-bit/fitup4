"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, ChevronLeft, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/fitness/store";
import { SurveyDialog } from "./survey-dialog";
import { toPersianDigits } from "@/lib/fitness/types";

interface SurveyPromptCardProps {
  /** Optional title override */
  title?: string;
  /** Optional subtitle override */
  subtitle?: string;
  /** Visual variant — "banner" (full-width, eye-catching) or "card" (subtle) */
  variant?: "banner" | "card";
  /** If true, the card cannot be dismissed. */
  forced?: boolean;
}

/**
 * Survey prompt card — shows when user has an active or recently expired plan
 * and hasn't submitted a survey in the last 30 days.
 *
 * Behavior:
 * - On mount, fetches /api/feedback/status to check if user has a recent survey
 * - If no recent survey → show the prompt
 * - User can dismiss the prompt for the current session (stored in sessionStorage)
 * - Clicking the CTA opens SurveyDialog
 */
export function SurveyPromptCard({
  title = "نظر شما مهم است!",
  subtitle = "لطفاً نظرسنجی کوتاه فیتاپ را تکمیل کنید",
  variant = "banner",
  forced = false,
}: SurveyPromptCardProps) {
  const { user } = useAppStore();
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    // Check session storage for this session's dismissal
    try {
      if (!forced && sessionStorage.getItem("fitup_survey_dismissed") === "1") {
        setLoading(false);
        return;
      }
    } catch {
      // ignore
    }

    (async () => {
      try {
        const res = await fetch("/api/feedback/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        // Show prompt only if no recent survey (last 30 days)
        if (!data.hasRecent) {
          setShow(true);
        }
      } catch {
        // ignore — don't bother the user on error
      } finally {
        setLoading(false);
      }
    })();
  }, [user, forced]);

  function dismiss() {
    setShow(false);
    setDismissed(true);
    try {
      sessionStorage.setItem("fitup_survey_dismissed", "1");
    } catch {
      // ignore
    }
  }

  if (loading || !show || dismissed) return null;

  // Banner variant — eye-catching, gradient background
  if (variant === "banner") {
    return (
      <>
        <motion.div
          dir="rtl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative overflow-hidden rounded-3xl p-4 text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316, #ea580c)" }}
        >
          <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-base flex items-center gap-1.5">
                <span>📝</span>
                {title}
              </h3>
              <p className="text-xs opacity-90 mt-0.5">{subtitle}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                onClick={() => setOpen(true)}
                size="sm"
                className="rounded-xl bg-white text-orange-600 hover:bg-orange-50 gap-1.5 font-bold shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                شروع نظرسنجی
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {!forced && (
                <button
                  onClick={dismiss}
                  aria-label="بستن"
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
        <SurveyDialog
          planName={user?.planName}
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) dismiss(); // dismiss after closing (submitted or cancelled)
          }}
        />
      </>
    );
  }

  // Card variant — subtle
  return (
    <>
      <motion.div
        dir="rtl"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,158,11,0.15)" }}
          >
            <ClipboardList className="w-5 h-5 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <Button
            onClick={() => setOpen(true)}
            size="sm"
            className="rounded-xl text-white gap-1.5 shrink-0"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            شروع
          </Button>
          {!forced && (
            <button
              onClick={dismiss}
              aria-label="بستن"
              className="w-7 h-7 rounded-full hover:bg-orange-100 flex items-center justify-center transition shrink-0"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </motion.div>
      <SurveyDialog
        planName={user?.planName}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) dismiss();
        }}
      />
    </>
  );
}

/**
 * Floating survey button — appears as a small floating action button
 * on the bottom-left for users with active/expired plans.
 */
export function SurveyFloatingButton() {
  const { user } = useAppStore();
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      if (sessionStorage.getItem("fitup_survey_fab_dismissed") === "1") {
        setLoading(false);
        return;
      }
    } catch {
      // ignore
    }
    (async () => {
      try {
        const res = await fetch("/api/feedback/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.hasRecent) setShow(true);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading || !show || dismissed) return null;

  return (
    <>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        dir="rtl"
        aria-label="نظرسنجی فیتاپ"
        className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-white shadow-2xl"
        style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
      >
        <ClipboardList className="w-5 h-5" />
        <span className="text-xs font-bold">نظرسنجی</span>
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-pulse" />
      </motion.button>
      <SurveyDialog
        planName={user?.planName}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setDismissed(true);
            try {
              sessionStorage.setItem("fitup_survey_fab_dismissed", "1");
            } catch {
              // ignore
            }
          }
        }}
      />
    </>
  );
}

/** Helper: compute days until plan expiry (negative = already expired). */
export function getDaysToExpiry(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Format Persian expiry text from a date string. */
export function formatExpiryText(expiresAt: string | null | undefined): string {
  const days = getDaysToExpiry(expiresAt);
  if (days === null) return "";
  if (days > 0) return `${toPersianDigits(days)} روز تا پایان پلن`;
  if (days === 0) return "امروز پلن شما پایان می‌یابد";
  return `${toPersianDigits(Math.abs(days))} روز از پایان پلن شما می‌گذرد`;
}
