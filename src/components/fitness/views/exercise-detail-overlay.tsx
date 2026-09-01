"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Info, AlertTriangle, Play, X, Lightbulb, Target, Lock, Youtube, Repeat, Layers, Clock } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { canAccess, toPersianDigits, type PlanExercise } from "@/lib/fitness/types";

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
};

const CATEGORY_LABELS: Record<string, string> = {
  push: "فشار",
  pull: "کشش",
  legs: "پا",
  core: "مرکز بدن",
  cardio: "هوازی",
  fullbody: "بدن کامل",
};

/** برچسب فارسی نوع گروه (سوپرست/تری‌ست/جاینت‌ست) */
function groupTypeLabel(t?: string): string | null {
  if (t === "giant") return "جاینت‌ست";
  if (t === "triset") return "تری‌ست";
  if (t === "superset") return "سوپرست";
  return null;
}

export function ExerciseDetailOverlay() {
  const { exerciseDetailId, workoutPlan, setOverlay, setExerciseDetailId, user } = useAppStore();
  const [exerciseData, setExerciseData] = useState<{
    youtubeUrl?: string;
    name?: string;
    muscle?: string;
    description?: string;
    tips?: string;
  } | null>(null);

  // User plan capabilities — fullExerciseLibrary requires Advanced+ plan
  const canViewVideos = canAccess(user?.planName ?? null, "fullExerciseLibrary");

  // Find exercise in plan (و حرکات خواهرخوانده در همان گروه سوپرست/تری‌ست/جاینت‌ست)
  let exercise: PlanExercise | null = null;
  let groupSiblings: { id: string; name: string }[] = [];
  if (workoutPlan && exerciseDetailId) {
    for (const day of workoutPlan.days) {
      const found = day.exercises.find((e) => e.id === exerciseDetailId);
      if (found) {
        exercise = found;
        // اگر عضو گروه سوپرست/تری‌ست/جاینت‌ست است، حرکات هم‌گروه را جمع کن
        if (found.supersetGroup && found.supersetType) {
          groupSiblings = day.exercises
            .filter((e) => e.supersetGroup === found.supersetGroup && e.id !== found.id)
            .map((e) => ({ id: e.id, name: e.name }));
        }
        break;
      }
    }
  }

  // Always fetch the matching library exercise (for description + tips + youtubeUrl)
  // Description/tips are visible to all; youtubeUrl is gated by plan
  useEffect(() => {
    if (!exercise?.name) {
      queueMicrotask(() => setExerciseData(null));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Strategy: try exact search first, then fall back to keyword-based fuzzy search.
        // This handles cases where the AI generates a name like "نشر جانب دمبل" but the
        // library has "نشر از جانب" — we extract the most distinctive keyword and search.
        const trySearch = async (term: string) => {
          const params = new URLSearchParams({ search: term });
          const res = await fetch(`/api/exercises?${params}`);
          const data = await res.json();
          return (data.exercises || []) as Array<{ name: string; youtubeUrl?: string; description?: string; tips?: string; muscle?: string }>;
        };

        let list = await trySearch(exercise.name);

        // If exact search returns nothing, try progressively shorter keywords
        if (list.length === 0) {
          // Extract distinctive words (skip common words like "با", "دمبل", "هالتر", "دستگاه")
          const commonWords = new Set(["با", "دمبل", "هالتر", "دستگاه", "سیم‌کش", "سیم", "کش", "کابل", "وزن", "بدن", "روی", "از", "به", "و", "را"]);
          const words = exercise.name.split(/\s+/).filter((w) => w.length >= 2 && !commonWords.has(w));
          // Try searching with each distinctive word, longest first
          const sortedWords = [...words].sort((a, b) => b.length - a.length);
          for (const word of sortedWords) {
            list = await trySearch(word);
            if (list.length > 0) break;
          }
        }

        // Score each result by similarity to find the best match
        const match = list.length > 0
          ? list.reduce((best, e) => {
              // Exact match is always best
              if (e.name === exercise.name) return e;
              // Score based on shared words
              const planWords = new Set(exercise.name.split(/\s+/));
              const libWords = new Set(e.name.split(/\s+/));
              let shared = 0;
              planWords.forEach((w) => { if (libWords.has(w) && w.length >= 2) shared++; });
              const bestShared = best
                ? (() => {
                    let s = 0;
                    planWords.forEach((w) => { if (new Set(best.name.split(/\s+/)).has(w) && w.length >= 2) s++; });
                    return s;
                  })()
                : -1;
              return shared > bestShared ? e : best;
            }, list[0])
          : null;

        if (!cancelled && match) {
          setExerciseData({
            youtubeUrl: match.youtubeUrl || "",
            name: match.name,
            muscle: match.muscle,
            description: match.description,
            tips: match.tips,
          });
        }
      } catch {
        // ignore — fall back to plan exercise data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exercise?.name]);

  if (!exercise) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">حرکت یافت نشد.</p>
        <Button onClick={() => setOverlay(null)} className="mt-4">بستن</Button>
      </div>
    );
  }

  const youtubeEmbedUrl = exerciseData?.youtubeUrl && exerciseData.youtubeUrl.trim() !== ""
    ? exerciseData.youtubeUrl
    : "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-bold">جزئیات حرکت</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOverlay(null)}
          className="rounded-full"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Video / Animation area */}
        <div className="relative bg-gradient-to-br from-primary/20 via-emerald-600/10 to-background overflow-hidden">
          {canViewVideos && youtubeEmbedUrl ? (
            // Advanced+ plan with available YouTube video — show iframe
            <div className="w-full">
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={youtubeEmbedUrl}
                  title={`ویدیو آموزشی ${exercise.name}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              {/* YouTube disclaimer */}
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-t border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-700 font-medium">
                  این ویدیو متعلق به سایت یوتیوب می‌باشد
                </p>
              </div>
            </div>
          ) : canViewVideos ? (
            // Advanced+ plan but no video available — fallback to animated icon
            <div className="relative h-56 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-primary/40 blur-2xl" />
                <div className="absolute bottom-10 left-10 w-24 h-24 rounded-full bg-emerald-500/40 blur-2xl" />
              </div>
              <motion.div
                animate={{ y: [0, -12, 0], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-2xl">
                  <Dumbbell className="w-12 h-12 text-white" strokeWidth={2} />
                </div>
              </motion.div>
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur text-xs">
                <Play className="w-3.5 h-3.5 text-primary" />
                <span>انیمیشن آموزشی</span>
              </div>
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] text-amber-700 font-medium flex items-center gap-1">
                <Youtube className="w-3 h-3" />
                ویدیو موجود نیست
              </div>
            </div>
          ) : (
            // Basic/Standard plan — locked video
            <div className="relative h-56 flex flex-col items-center justify-center gap-3 px-6 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-primary/40 blur-2xl" />
                <div className="absolute bottom-10 left-10 w-24 h-24 rounded-full bg-emerald-500/40 blur-2xl" />
              </div>
              <div className="relative w-20 h-20 rounded-3xl bg-slate-200 flex items-center justify-center shadow-lg">
                <Lock className="w-10 h-10 text-slate-500" />
              </div>
              <div className="relative">
                <p className="font-bold text-slate-900 text-sm mb-1">ویدیو حرکت قفل است</p>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  برای مشاهده ویدیوهای آموزشی حرکات، پلن پیشرفته یا حرفه‌ای تهیه کنید.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <h3 className="text-xl font-black mb-1">{exercise.name}</h3>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{exercise.muscle}</Badge>
              <Badge variant="outline">{CATEGORY_LABELS[exercise.category] || exercise.category}</Badge>
              <Badge className="bg-primary/10 text-primary border border-primary/20">
                {DIFFICULTY_LABELS[exercise.difficulty] || exercise.difficulty}
              </Badge>
            </div>
          </div>

          {/* عضویت در گروه سوپرست/تری‌ست/جاینت‌ست */}
          {exercise.supersetGroup && exercise.supersetType && (() => {
            const label = groupTypeLabel(exercise.supersetType);
            if (!label) return null;
            const isGiant = exercise.supersetType === "giant";
            const containerCls = isGiant
              ? "bg-gradient-to-l from-rose-500/10 to-orange-500/5 border-rose-300"
              : "bg-gradient-to-l from-purple-500/10 to-fuchsia-500/5 border-purple-300";
            const iconCls = isGiant ? "text-rose-500" : "text-purple-500";
            const titleCls = isGiant ? "text-rose-700" : "text-purple-700";
            return (
              <div className={`p-3.5 rounded-2xl border ${containerCls}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isGiant ? <Layers className={`w-4 h-4 ${iconCls}`} /> : <Repeat className={`w-4 h-4 ${iconCls}`} />}
                  <h4 className={`font-bold text-sm ${titleCls}`}>
                    این حرکت عضو {label} گروه {exercise.supersetGroup} است
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-1">
                  ⚡ بدون استراحت بین حرکات این گروه — حرکات را پشت‌سرهم اجرا کنید، سپس بین گروه‌ها (یا بین دورها در جاینت‌ست) استراحت کنید.
                </p>
                {isGiant && (exercise.circuitRounds || exercise.restBetweenRounds) && (
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px]">
                    {exercise.circuitRounds ? (
                      <span className={`flex items-center gap-1 font-bold ${titleCls}`}>
                        <Repeat className="w-3 h-3" />
                        {toPersianDigits(exercise.circuitRounds)} دور
                      </span>
                    ) : null}
                    {exercise.restBetweenRounds ? (
                      <span className={`flex items-center gap-1 ${titleCls}`}>
                        <Clock className="w-3 h-3" />
                        استراحت بین دورها: {toPersianDigits(exercise.restBetweenRounds)} ثانیه
                      </span>
                    ) : null}
                  </div>
                )}
                {groupSiblings.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-current/10">
                    <p className="text-[11px] font-bold text-muted-foreground mb-1.5">حرکات هم‌گروه:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {groupSiblings.map((sib) => (
                        <button
                          key={sib.id}
                          onClick={() => setExerciseDetailId(sib.id)}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-background/80 border border-current/20 hover:bg-background transition"
                        >
                          {sib.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Description */}
          <div className="p-4 rounded-2xl bg-card border">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-primary" />
              <h4 className="font-bold text-sm">نحوه انجام</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {exerciseData?.description || exercise.description || "توضیحات این حرکت به‌زودی اضافه خواهد شد."}
            </p>
          </div>

          {/* Tips */}
          {(exerciseData?.tips || exercise.tips) && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-sm">نکات ایمنی</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{exerciseData?.tips || exercise.tips}</p>
            </div>
          )}

          {/* Sets overview */}
          <div className="p-4 rounded-2xl bg-card border">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h4 className="font-bold text-sm">برنامه ست‌ها</h4>
            </div>
            <div className="space-y-2">
              {exercise.sets.map((s) => (
                <div
                  key={s.setNumber}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40"
                >
                  <span className="text-sm font-medium">{toPersianDigits(s.setNumber)} ست</span>
                  <div className="flex gap-3 text-xs">
                    <span className="text-muted-foreground">
                      تکرار: <span className="font-bold text-foreground">{toPersianDigits(s.reps)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      استراحت: <span className="font-bold text-foreground">{toPersianDigits(s.restSec)}s</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Tip */}
          <div className="p-4 rounded-2xl bg-gradient-to-l from-primary/10 to-emerald-500/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <h4 className="font-bold text-sm">نکته فیتاپ هوشمند</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              روی فرم صحیح تمرکز کنید، نه روی وزنه سنگین. کیفیت حرکت از کمیت آن مهم‌تر است. اگر احساس درد داشتید، تمرین را متوقف کنید.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
