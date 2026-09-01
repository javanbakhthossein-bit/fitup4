"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music,
  Plus,
  Check,
  Dumbbell,
  Clock,
  Zap,
  ChevronLeft,
  Volume2,
  ListMusic,
  Trash2,
  Bot,
  Info,
  Repeat,
} from "lucide-react";
import { useAppStore, type GymTrack } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { toPersianDigits, PERSIAN_WEEKDAYS, type PlanExercise } from "@/lib/fitness/types";
import { toast } from "sonner";
import {
  saveTrackToDB,
  loadTracksFromDB,
  deleteTrackFromDB,
} from "@/lib/fitness/gym-playlist-db";
import { SmartCoachChatView } from "./smart-coach-chat-view";
import { groupExercises, groupTypeLabel } from "./workouts-view";
import { ExerciseDetailModal } from "./programs-view";

export function GymModeView() {
  const {
    setOverlay,
    workoutPlan,
    gymPlaylist,
    setGymPlaylist,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const currentTrack = gymPlaylist[currentTrackIdx];
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [setWeights, setSetWeights] = useState<Record<string, string>>({});
  const [setReps, setSetReps] = useState<Record<string, string>>({});
  const [doneSets, setDoneSets] = useState<Record<string, boolean>>({});
  const [chatOpen, setChatOpen] = useState(false);
  // حرکتی که جزئیات آن در modal نمایش داده می‌شود (Info icon)
  const [detailExercise, setDetailExercise] = useState<PlanExercise | null>(null);
  // برای جلوگیری از تکرار toast انگیزشی وقتی همه ست‌ها انجام شده‌اند
  const celebratedRef = useRef(false);

  // --- Ref برای ردیابی «قصد پخش» هنگام تغییر ترک ---
  // وقتی کاربر روی ترک جدید کلیک می‌کند یا next/prev را می‌زند، این ref روی true
  // قرار می‌گیرد تا رویداد onPause (که هنگام تعویض src صادر می‌شود) باعث توقف
  // نمایش حالت «در حال پخش» نشود. سپس هنگام بارگذاری metadata ترک جدید،
  // play() صدا زده می‌شود.
  const pendingPlayRef = useRef(false);

  // Default to today's day
  useEffect(() => {
    if (workoutPlan) {
      const dayIdx = new Date().getDay();
      const persianIdx = (dayIdx + 1) % 7;
      const todayName = PERSIAN_WEEKDAYS[persianIdx];
      const idx = workoutPlan.days.findIndex((d) => d.day === todayName);
      if (idx >= 0) setSelectedDayIdx(idx);
    }
  }, [workoutPlan]);

  // ─── پاک‌سازی تیک‌ها و وزنه‌ها — هر روز در ۱۲ شب ───
  // تیک‌ها با کلید {date}_{dayIdx} در localStorage ذخیره می‌شوند.
  // وقتی تاریخ تغییر کند (۱۲ شب)، داده‌های روز قبل خودکار پاک می‌شوند.
  // کاربر می‌تواند بین روزهای مختلف جابجا شود بدون اینکه تیک‌ها پاک شوند.

  // کلید ذخیره‌سازی بر اساس تاریخ امروز + ایندکس روز
  // ⚠️ تاریخ «محلی دستگاه» نه UTC — قبلاً toISOString().slice(0,10) تاریخ UTC
  // می‌داد و تا ساعت ۰۳:۳۰ بامداد تهران (UTC+3:30) کلیدِ روز قبل لود می‌شد.
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })(); // YYYY-MM-DD محلی
  const storageKey = `gym_session_${todayKey}_day${selectedDayIdx}`;

  // بارگذاری state از localStorage هنگام تغییر روز
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSetWeights(parsed.weights || {});
        setSetReps(parsed.reps || {});
        setDoneSets(parsed.done || {});
      } else {
        setSetWeights({});
        setSetReps({});
        setDoneSets({});
      }
      celebratedRef.current = false;
    } catch {
      setSetWeights({});
      setSetReps({});
      setDoneSets({});
      celebratedRef.current = false;
    }
  }, [selectedDayIdx, storageKey]);

  // ذخیره state در localStorage هنگام تغییر
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        weights: setWeights,
        reps: setReps,
        done: doneSets,
      }));
    } catch {}
  }, [setWeights, setReps, doneSets, storageKey]);

  // ─── پاک‌سازی داده‌های قدیمی (بیش از ۲ روز) ───
  // هر بار که صفحه باز می‌شود، داده‌های قدیمی‌تر از ۲ روز پاک می‌شوند
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      for (const key of keys) {
        if (key.startsWith("gym_session_")) {
          // تاریخ را از کلید استخراج کن
          const match = key.match(/gym_session_(\d{4}-\d{2}-\d{2})_day/);
          if (match && match[1] < twoDaysAgo) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch {}
  }, []);

  // ─── Hydrate playlist from IndexedDB on every mount ───
  // Object URLs are session-specific, so we always rebuild them from the
  // persisted Blobs stored in IndexedDB. Any stale URLs in the store are
  // revoked first to avoid memory leaks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadTracksFromDB();
      if (cancelled) return;
      // Revoke any stale URLs from a previous mount
      const stale = useAppStore.getState().gymPlaylist;
      stale.forEach((t) => {
        try { URL.revokeObjectURL(t.url); } catch {}
      });
      const tracks: GymTrack[] = stored.map((s) => ({
        id: s.id,
        name: s.name,
        url: URL.createObjectURL(s.blob),
        blob: s.blob,
      }));
      setGymPlaylist(tracks);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Revoke object URLs on unmount to avoid memory leaks ───
  // (the playlist itself persists in IndexedDB; URLs are re-created next mount)
  useEffect(() => {
    return () => {
      const tracks = useAppStore.getState().gymPlaylist;
      tracks.forEach((t) => {
        try {
          URL.revokeObjectURL(t.url);
        } catch {}
      });
    };
  }, []);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => {
      setDuration(audio.duration || 0);
      // When a new track's metadata is loaded and we intend to play, start playback.
      // This is the reliable path: play() after metadata is loaded won't be blocked
      // by the browser's autoplay policy because it's triggered by user interaction.
      if (pendingPlayRef.current) {
        audio.play().catch(() => {});
      }
    };
    const onEnd = () => next();
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIdx, gymPlaylist]);

  // ─── Explicitly start playback whenever the active track URL changes ───
  // changing `src` doesn't always honor the `autoPlay` attribute, especially
  // when the audio element was previously paused. So when isPlaying is true
  // and the current track URL changes (e.g. user clicked a different track),
  // we explicitly call play(). This effect also serves as a fallback for the
  // onLoadedMetadata handler below.
  useEffect(() => {
    if (!currentTrack?.url) return;
    // If we're switching tracks with intent to play, mark the ref so the
    // pause event fired during src reload doesn't reset isPlaying.
    // The actual play() call happens in onLoadedMetadata (when the new src
    // is ready) — but we also try play() here as a fallback.
    const audio = audioRef.current;
    if (!audio) return;
    if (pendingPlayRef.current) {
      // Try to play immediately; if it fails (src still loading), the
      // onLoadedMetadata handler will retry.
      audio.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("audio/"));
    if (fileArr.length === 0) {
      toast.error("فقط فایل‌های صوتی پخش می‌شوند");
      return;
    }
    const tracks: GymTrack[] = fileArr.map((f) => ({
      id: `track_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: f.name.replace(/\.[^/.]+$/, ""),
      url: URL.createObjectURL(f),
      blob: f,
    }));
    setGymPlaylist([...gymPlaylist, ...tracks]);
    toast.success(`${toPersianDigits(tracks.length)} آهنگ به لیست اضافه شد 🎵`);
    e.target.value = "";
    // Persist to IndexedDB (fire-and-forget)
    await Promise.all(
      tracks.map((t) =>
        t.blob
          ? saveTrackToDB({ id: t.id, name: t.name, blob: t.blob })
          : Promise.resolve()
      )
    );
  }

  function togglePlay() {
    if (gymPlaylist.length === 0) {
      fileInputRef.current?.click();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      pendingPlayRef.current = false;
      audio.pause();
      setIsPlaying(false);
    } else {
      pendingPlayRef.current = true;
      audio.play().catch(() => {
        // If play() fails (e.g., src not loaded yet), onLoadedMetadata will retry.
      });
      setIsPlaying(true);
    }
  }

  function next() {
    if (gymPlaylist.length === 0) return;
    const idx = (currentTrackIdx + 1) % gymPlaylist.length;
    pendingPlayRef.current = true;
    setCurrentTrackIdx(idx);
    setProgress(0);
    setIsPlaying(true);
  }

  function prev() {
    if (gymPlaylist.length === 0) return;
    const idx = (currentTrackIdx - 1 + gymPlaylist.length) % gymPlaylist.length;
    pendingPlayRef.current = true;
    setCurrentTrackIdx(idx);
    setProgress(0);
    setIsPlaying(true);
  }

  function playTrack(idx: number) {
    if (idx === currentTrackIdx) {
      // کلیک روی ترک در حال پخش → toggle
      togglePlay();
      return;
    }
    // کلیک روی ترک متفاوت → آن را پخش کن
    pendingPlayRef.current = true;
    setCurrentTrackIdx(idx);
    setProgress(0);
    setIsPlaying(true);
  }

  function removeTrack(id: string) {
    const track = gymPlaylist.find((t) => t.id === id);
    if (track) URL.revokeObjectURL(track.url);
    const filtered = gymPlaylist.filter((t) => t.id !== id);
    setGymPlaylist(filtered);
    if (currentTrackIdx >= filtered.length) setCurrentTrackIdx(0);
    // Also delete from IndexedDB
    void deleteTrackFromDB(id);
  }

  // ─── Seek bar (mouse + touch) ───
  function seekFromClientX(clientX: number) {
    const el = progressBarRef.current;
    if (!el || !duration || !audioRef.current) return;
    const rect = el.getBoundingClientRect();
    // RTL-aware: in RTL the bar fills from right to left visually,
    // but the audio currentTime is always 0→duration left-to-right logically.
    // We compute the fraction from the left edge for both LTR and RTL.
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
    setProgress(pct * duration);
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    seekFromClientX(e.clientX);
  }

  function handleTouchSeek(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    if (!touch) return;
    seekFromClientX(touch.clientX);
    // Prevent the browser from scrolling while dragging the seek bar
    e.preventDefault();
  }

  /**
   * تکمیل یک ست در جیم‌مود — فقط ردیابی محلی (localStorage روزانه).
   *
   * نکته مهم: اینجا عمداً startSession/logSet (جلسه سراسری) صدا زده نمی‌شود.
   * قبلاً تیک زدن ست، صفحه «جلسه تمرین» (ActiveWorkoutSession) تمام‌صفحه را
   * روی جیم‌مود باز می‌کرد — صفحه‌ای با طراحی ناهماهنگ با جیم‌مود و دکمه خروج
   * مبتنی بر confirm() مرورگر که در WebView/PWA مسدود است و کاربر گیر می‌کرد.
   * جیم‌مود خودش ردیابی کامل دارد: ورودی وزنه/تکرار، تیک هر ست، ذخیره روزانه
   * در localStorage و پیام انگیزشی پایان روز.
   * جلسه هدایت‌شده (با تایمر استراحت و تخمین کالری) از تب «تمرین‌ها» با دکمه
   * «شروع تمرین» به‌صورت آگاهانه شروع می‌شود — نه از داخل جیم‌مود.
   */
  function completeSet(exerciseId: string, setNumber: number) {
    const key = `${exerciseId}_${setNumber}`;
    setDoneSets((s) => ({ ...s, [key]: true }));
    toast.success(`ست ${toPersianDigits(setNumber)} انجام شد! 💪`);
  }

  const activeDay = workoutPlan?.days[selectedDayIdx];

  // ─── پیام انگیزشی بعد از تکمیل همه ست‌های روز تمرین ───
  // محاسبه تعداد کل ست‌ها و ست‌های انجام‌شده در روز فعال.
  // وقتی progress به ۱۰۰٪ می‌رسد (همه ست‌ها انجام شد)، یک پیام انگیزشی
  // تصادفی نمایش داده می‌شود. celebratedRef جلوی تکرار پیام را می‌گیرد.
  const totalSetsActiveDay =
    activeDay?.exercises?.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0) ?? 0;
  const doneSetsActiveDay =
    activeDay?.exercises?.reduce((sum, ex) => {
      return (
        sum +
        (ex.sets?.filter((s) => doneSets[`${ex.id}_${s.setNumber}`]).length || 0)
      );
    }, 0) ?? 0;

  useEffect(() => {
    if (
      totalSetsActiveDay > 0 &&
      doneSetsActiveDay >= totalSetsActiveDay &&
      !celebratedRef.current
    ) {
      celebratedRef.current = true;
      const MOTIVATIONAL_MESSAGES = [
        "آفرین! امروز عالی تمرین کردی! 💪🔥",
        "تو قهرمانی! هر ست رو با قدرت تمام کردی! 🏆",
        "بی‌نظیر بود! فردا هم همین‌طور ادامه بده! ⚡",
        "خوب بود! بدنت در حال تغییره — به خودت افتخار کن! 💯",
      ];
      const msg =
        MOTIVATIONAL_MESSAGES[
          Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)
        ];
      toast.success(msg, { duration: 6000 });
    }
  }, [totalSetsActiveDay, doneSetsActiveDay]);

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${toPersianDigits(m.toString().padStart(2, "0"))}:${toPersianDigits(sec.toString().padStart(2, "0"))}`;
  }

  return (
    <div
      className="flex flex-col h-full relative bg-gradient-to-b from-orange-50/40 via-white to-white"
      dir="rtl"
    >
      <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleFileSelect} />
      <audio
        ref={audioRef}
        data-gym-music="true"
        src={currentTrack?.url}
        onPlay={() => {
          pendingPlayRef.current = false;
          setIsPlaying(true);
        }}
        onPause={() => {
          // هنگام تعویض src، رویداد pause به‌طور خودکار صادر می‌شود.
          // در این حالت نباید isPlaying را false کنیم چون قصد پخش داریم.
          if (!pendingPlayRef.current) {
            setIsPlaying(false);
          }
        }}
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          setDuration(audio.duration || 0);
          // وقتی ترک جدید بارگذاری شد و قصد پخش داریم، پخش را شروع کن.
          // این زمانی critical است که play() در useEffect قبلی به‌دلیل
          // آماده‌نبودن src ناموفق بوده است.
          if (pendingPlayRef.current) {
            audio.play().catch(() => {
              pendingPlayRef.current = false;
            });
          }
        }}
      />

      {/* Header — clean white with orange accent */}
      <div className="flex items-center justify-between p-4 border-b border-orange-100 bg-white/95 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shrink-0 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900">حالت باشگاه</h2>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              موزیک + برنامه تمرین روز
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOverlay(null)}
          className="rounded-full hover:bg-orange-50 text-slate-500 hover:text-orange-600"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Body: two columns on desktop (workout + chat), single column on mobile */}
      <div className="flex-1 flex min-h-0">
        {/* Main content: music player + workout program */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 max-w-5xl mx-auto w-full">
        {/* MUSIC PLAYER */}
        <div className="bg-white rounded-3xl overflow-hidden border border-orange-100 shadow-sm">
          {/* Now playing visualizer */}
          <div className="relative h-32 bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50 flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-2 right-4 w-24 h-24 rounded-full bg-orange-300/50 blur-3xl" />
              <div className="absolute bottom-2 left-4 w-20 h-20 rounded-full bg-amber-300/50 blur-3xl" />
            </div>
            <motion.div
              animate={isPlaying ? { scale: [1, 1.08, 1], rotate: [0, 4, -4, 0] } : {}}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="relative z-10"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  boxShadow: "0 10px 25px -5px rgba(249, 115, 22, 0.5)",
                }}
              >
                <Music className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
            </motion.div>
            {/* Equalizer bars */}
            {isPlaying && (
              <div className="absolute bottom-3 left-4 flex items-end gap-0.5 h-6">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full"
                    style={{ background: "linear-gradient(180deg, #f59e0b, #f97316)" }}
                    animate={{ height: [6, 18, 10, 22, 8] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Track info + controls */}
          <div className="p-4">
            <div className="text-center mb-3">
              <p className="font-bold text-sm truncate text-slate-900">{currentTrack?.name || "هیچ آهنگی انتخاب نشده"}</p>
              <p className="text-[11px] text-slate-500">
                {gymPlaylist.length > 0
                  ? `آهنگ ${toPersianDigits(currentTrackIdx + 1)} از ${toPersianDigits(gymPlaylist.length)}`
                  : "از موسیقی‌های گوشیت اضافه کن"}
              </p>
            </div>

            {/* Progress bar (larger, touch-friendly, LTR-explicit for predictable seeking) */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-slate-500 font-mono shrink-0 w-10 text-center">{fmt(progress)}</span>
              <div
                ref={progressBarRef}
                dir="ltr"
                role="slider"
                aria-label="پیشرفت پخش"
                aria-valuemin={0}
                aria-valuemax={Math.floor(duration) || 0}
                aria-valuenow={Math.floor(progress) || 0}
                tabIndex={0}
                className="flex-1 h-3 bg-slate-100 rounded-full cursor-pointer relative touch-none select-none group"
                onClick={seek}
                onTouchStart={handleTouchSeek}
                onTouchMove={handleTouchSeek}
                onKeyDown={(e) => {
                  if (!duration || !audioRef.current) return;
                  if (e.key === "ArrowLeft") {
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
                  } else if (e.key === "ArrowRight") {
                    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
                  }
                }}
              >
                {/* Filled portion (LTR: grows from left to right) */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
                  style={{
                    width: `${duration ? (progress / duration) * 100 : 0}%`,
                    background: "linear-gradient(90deg, #f59e0b, #f97316)",
                  }}
                />
                {/* Draggable thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 rounded-full bg-white shadow-md border-2 border-orange-500 pointer-events-none opacity-90 group-hover:scale-110 transition"
                  style={{ left: `${duration ? (progress / duration) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500 font-mono shrink-0 w-10 text-center">{fmt(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 mb-3">
              <button onClick={prev} disabled={gymPlaylist.length === 0} className="p-2 rounded-full hover:bg-orange-50 text-slate-700 transition disabled:opacity-30">
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition"
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #f97316)",
                  boxShadow: "0 10px 25px -5px rgba(249, 115, 22, 0.5)",
                }}
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current mr-0.5" />}
              </button>
              <button onClick={next} disabled={gymPlaylist.length === 0} className="p-2 rounded-full hover:bg-orange-50 text-slate-700 transition disabled:opacity-30">
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Volume + add music */}
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-slate-500" />
              <input
                type="range"
                dir="ltr"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="صدا"
                className="flex-1 accent-orange-500 h-1"
              />
              <Button size="sm" variant="outline" className="rounded-xl text-xs shrink-0 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700" onClick={() => fileInputRef.current?.click()}>
                <Plus className="w-4 h-4" />
                افزودن موزیک
              </Button>
            </div>
          </div>

          {/* Playlist */}
          {gymPlaylist.length > 0 && (
            <div className="border-t border-orange-100 max-h-44 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-slate-500 sticky top-0 bg-white/85 backdrop-blur">
                <ListMusic className="w-3.5 h-3.5" />
                لیست پخش ({toPersianDigits(gymPlaylist.length)})
              </div>
              {gymPlaylist.map((track, i) => (
                <div
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => playTrack(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      playTrack(i);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50/60 transition text-right group cursor-pointer ${
                    i === currentTrackIdx ? "bg-orange-50" : ""
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${i === currentTrackIdx ? "text-white" : "bg-slate-100 text-slate-600"}`} style={i === currentTrackIdx ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : undefined}>
                    {i === currentTrackIdx && isPlaying ? (
                      <div className="flex items-end gap-0.5 h-3">
                        {[0, 1, 2].map((j) => (
                          <motion.div key={j} className="w-0.5 bg-current rounded-full" animate={{ height: [3, 8, 3] }} transition={{ duration: 0.5, repeat: Infinity, delay: j * 0.1 }} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold">{toPersianDigits(i + 1)}</span>
                    )}
                  </div>
                  <span className={`flex-1 text-xs truncate ${i === currentTrackIdx ? "text-orange-600 font-bold" : "text-slate-700"}`}>{track.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition shrink-0"
                    aria-label="حذف آهنگ"
                    title="حذف از پلی‌لیست"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DAY SELECTOR + WORKOUT PROGRAM */}
        <div className="bg-white rounded-3xl p-4 border border-orange-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2 text-slate-900">
              <Dumbbell className="w-4 h-4 text-orange-500" />
              برنامه تمرین
            </h3>
            <span className="text-[11px] text-slate-500">روز را انتخاب کن</span>
          </div>

          {/* Day selector */}
          {workoutPlan && (
            <div
              className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3"
              style={{
                touchAction: "pan-x pan-y",
                willChange: "scroll-position",
                overscrollBehaviorX: "contain",
                WebkitOverflowScrolling: "touch",
                scrollSnapType: "x proximity",
              } as CSSProperties}
            >
              {workoutPlan.days.map((day, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedDayIdx(i)}
                  style={{ scrollSnapAlign: "start" }}
                  className={`shrink-0 px-3 py-2 rounded-2xl border-2 transition text-center min-w-[80px] ${
                    selectedDayIdx === i
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 bg-white hover:border-orange-200"
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">{day.day}</div>
                  <div className="text-[9px] text-slate-500 truncate">{day.focus}</div>
                </button>
              ))}
            </div>
          )}

          {/* Active day info */}
          {activeDay ? (
            <>
              <div className="flex items-center justify-between mb-3 p-3 rounded-xl bg-orange-50/60 border border-orange-100">
                <div>
                  <p className="font-bold text-sm text-slate-900">{activeDay.title}</p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{toPersianDigits(activeDay.estimatedMinutes)} دقیقه</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{toPersianDigits(activeDay.exercises.length)} حرکت</span>
                  </div>
                </div>
              </div>

              {/* Exercises with quick log — گروه‌بندی‌شده (سوپرست/تری‌ست/جاینت‌ست) */}
              <div className="space-y-2.5">
                {(() => {
                  // استفاده از groupExercises برای نمایش صحیح سوپرست/تری‌ست/جاینت‌ست
                  // (مشابه programs-view و workouts-view)
                  const grouped = groupExercises(activeDay.exercises);
                  let absIdx = 0;
                  let groupColorIdx = 0;
                  // پالت رنگ متمایز برای هر گروه (A=بنفش، B=آبی، ...)
                  const groupColors = [
                    { bg: "#f3e8ff", border: "#d8b4fe", tint: "rgba(168,85,247,0.08)", header: "linear-gradient(135deg,#a855f7,#d946ef)", text: "#7e22ce" },
                    { bg: "#dbeafe", border: "#93c5fd", tint: "rgba(59,130,246,0.08)", header: "linear-gradient(135deg,#3b82f6,#6366f1)", text: "#1d4ed8" },
                    { bg: "#dcfce7", border: "#86efac", tint: "rgba(34,197,94,0.08)", header: "linear-gradient(135deg,#22c55e,#10b981)", text: "#15803d" },
                    { bg: "#fef3c7", border: "#fcd34d", tint: "rgba(245,158,11,0.10)", header: "linear-gradient(135deg,#f59e0b,#f97316)", text: "#b45309" },
                    { bg: "#ffe4e6", border: "#fb7185", tint: "rgba(244,63,94,0.08)", header: "linear-gradient(135deg,#f43f5e,#fb7185)", text: "#9f1239" },
                    { bg: "#ccfbf1", border: "#5eead4", tint: "rgba(20,184,166,0.08)", header: "linear-gradient(135deg,#14b8a6,#2dd4bf)", text: "#0f766e" },
                  ];

                  return grouped.map((item, itemIdx) => {
                    if (item.type === "single") {
                      const ex = item.exercise;
                      const idx = absIdx++;
                      return (
                        <GymExerciseCard
                          key={ex.id}
                          ex={ex}
                          idx={idx}
                          setWeights={setWeights}
                          setReps={setReps}
                          doneSets={doneSets}
                          onSetWeight={(k, v) => setSetWeights((w) => ({ ...w, [k]: v }))}
                          onSetReps={(k, v) => setSetReps((r) => ({ ...r, [k]: v }))}
                          onComplete={(exId, sn) => completeSet(exId, sn)}
                          onShowDetail={() => setDetailExercise(ex)}
                        />
                      );
                    }

                    // گروه: سوپرست / تری‌ست / جاینت‌ست
                    const colors = groupColors[groupColorIdx++ % groupColors.length];
                    const label = groupTypeLabel(item.groupType);
                    const isGiant = item.groupType === "giant";
                    const typeHint = isGiant
                      ? "۴ حرکت یا بیشتر — سیرکویت"
                      : item.groupType === "triset"
                        ? "۳ حرکت پشت سر هم"
                        : "۲ حرکت پشت سر هم";

                    return (
                      <div
                        key={`group-${item.group}-${itemIdx}`}
                        className="rounded-2xl border-2 p-2 space-y-1.5 shadow-sm"
                        style={{ borderColor: colors.border, background: colors.tint }}
                      >
                        {/* هدر گروه */}
                        <div
                          className="rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm"
                          style={{ background: colors.header, color: "#fff" }}
                        >
                          <span className="text-[12px] leading-none">🔗</span>
                          <span className="text-[11px] font-black">
                            {label} {item.group}
                          </span>
                          <span className="text-[9px] opacity-95 px-1.5 py-0.5 rounded-full bg-white/20 font-bold">
                            {toPersianDigits(item.exercises.length)} حرکت
                          </span>
                          <span className="text-[9px] opacity-95 mr-auto flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {typeHint}
                          </span>
                        </div>

                        {/* اطلاعات ویژه جاینت‌ست: تعداد دورها + استراحت بین دورها */}
                        {isGiant && (item.circuitRounds || item.restBetweenRounds) && (
                          <div
                            className="flex items-center flex-wrap gap-x-3 gap-y-1 px-2.5 py-1 rounded-lg text-[9px] font-bold"
                            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                          >
                            {item.circuitRounds ? (
                              <span className="flex items-center gap-1">
                                <Repeat className="w-3 h-3" />
                                {toPersianDigits(item.circuitRounds)} دور
                              </span>
                            ) : null}
                            {item.restBetweenRounds ? (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                استراحت بین دورها: {toPersianDigits(item.restBetweenRounds)} ثانیه
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* حرکات داخل گروه — با شماره A1, A2, ... و رابط خط‌چین */}
                        <div className="relative pr-2">
                          <div
                            className="absolute right-2 top-1 bottom-1 border-r-2 border-dashed opacity-60 pointer-events-none"
                            style={{ borderColor: colors.border }}
                          />
                          <div className="space-y-1.5 relative">
                            {item.exercises.map((ex, gi) => {
                              const idx = absIdx++;
                              return (
                                <GymExerciseCard
                                  key={ex.id}
                                  ex={ex}
                                  idx={idx}
                                  groupLabel={`${item.group}${toPersianDigits(gi + 1)}`}
                                  groupColor={colors.text}
                                  hideSupersetBadge
                                  setWeights={setWeights}
                                  setReps={setReps}
                                  doneSets={doneSets}
                                  onSetWeight={(k, v) => setSetWeights((w) => ({ ...w, [k]: v }))}
                                  onSetReps={(k, v) => setSetReps((r) => ({ ...r, [k]: v }))}
                                  onComplete={(exId, sn) => completeSet(exId, sn)}
                                  onShowDetail={() => setDetailExercise(ex)}
                                />
                              );
                            })}
                          </div>
                        </div>

                        {/* فوتر: استراحت بعد از گروه */}
                        {(() => {
                          const lastEx = item.exercises[item.exercises.length - 1];
                          const restAfter = lastEx?.sets?.slice(-1)[0]?.restSec ?? 0;
                          return (
                            <div
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold"
                              style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                            >
                              <Clock className="w-3 h-3" />
                              {restAfter > 0 ? (
                                <>
                                  استراحت بعد از گروه: {toPersianDigits(restAfter)} ثانیه
                                  <span className="font-normal opacity-80 mr-auto">سپس گروه بعدی</span>
                                </>
                              ) : (
                                <span className="font-normal opacity-80 mr-auto">بدون استراحت — مستقیم گروه بعدی</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-slate-500 text-sm">
              برنامه تمرینی موجود نیست
            </div>
          )}
        </div>
        </div>

        {/* Desktop chat side panel حذف شد — چت به‌صورت modal باز می‌شود */}
      </div>

      {/* Chat modal — روی همه دستگاه‌ها (موبایل + دسکتاپ) به‌صورت modal باز می‌شود */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
            dir="rtl"
            onClick={() => setChatOpen(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            {/* Modal container — روی موبایل full-screen، روی دسکتاپ centered modal */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "tween", duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="relative bg-white w-full h-full sm:w-[440px] sm:h-[85vh] sm:max-h-[85vh] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top bar with close button */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-orange-100 bg-white shrink-0">
                <button
                  onClick={() => setChatOpen(false)}
                  className="flex items-center gap-1 text-orange-600 active:scale-95 transition font-medium"
                  aria-label="بستن چت"
                >
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                  <span className="text-sm">بازگشت به تمرین</span>
                </button>
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  فیتاپ
                </span>
              </div>
              {/* Chat fills remaining space */}
              <div className="flex-1 min-h-0">
                <SmartCoachChatView variant="panel" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB to open chat — روی همه دستگاه‌ها (موبایل + دسکتاپ) */}
      {!chatOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setChatOpen(true)}
          className="absolute bottom-5 left-5 z-30 flex items-center gap-2 pr-4 pl-2 py-2 rounded-full shadow-2xl text-white"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #f97316)",
            boxShadow: "0 12px 30px -8px rgba(249, 115, 22, 0.5)",
          }}
          aria-label="باز کردن چت با فیتاپ"
        >
          {/* Pulse ring animation */}
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              background: "rgba(249, 115, 22, 0.4)",
              animationDuration: "2s",
              animationIterationCount: "infinite",
            }}
          />
          <span className="relative flex items-center gap-2">
            <span className="text-xs font-bold whitespace-nowrap">چت با فیتاپ</span>
            <span className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
            </span>
          </span>
        </motion.button>
      )}

      {/* Modal جزئیات حرکت — دقیقاً همان ExerciseDetailModal از programs-view */}
      {detailExercise && (
        <ExerciseDetailModal
          exercise={detailExercise}
          onClose={() => setDetailExercise(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   GymExerciseCard — کارت تک‌حرکت در جیم‌مود
   - شماره حرکت (یا برچسب گروه مثل A1، B2)
   - نام، عضله، تعداد ست
   - آیکون «جزئیات» (Info) برای باز کردن ExerciseDetailModal
   - ورودی‌های وزنه/تکرار برای هر ست + دکمه انجام
   - در صورت داخل گروه بودن، بج سوپرست مخفی می‌شود (hideSupersetBadge)
   ============================================================ */
function GymExerciseCard({
  ex,
  idx,
  groupLabel,
  groupColor,
  hideSupersetBadge,
  setWeights,
  setReps,
  doneSets,
  onSetWeight,
  onSetReps,
  onComplete,
  onShowDetail,
}: {
  ex: PlanExercise;
  idx: number;
  groupLabel?: string;
  groupColor?: string;
  hideSupersetBadge?: boolean;
  setWeights: Record<string, string>;
  setReps: Record<string, string>;
  doneSets: Record<string, boolean>;
  onSetWeight: (key: string, value: string) => void;
  onSetReps: (key: string, value: string) => void;
  onComplete: (exerciseId: string, setNumber: number) => void;
  onShowDetail: () => void;
}) {
  // شماره نمایشی: اگر داخل گروه است، groupLabel (مثل A1) نشان داده می‌شود
  // در غیر این صورت، شماره مطلق حرکت
  const displayNumber = groupLabel ?? toPersianDigits(idx + 1);

  return (
    <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="min-w-6 h-6 px-1 rounded-lg bg-orange-100 text-orange-600 text-[10px] font-bold flex items-center justify-center shrink-0"
          style={groupColor ? { color: groupColor, background: `${groupColor}15` } : undefined}
        >
          {displayNumber}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-900 truncate">{ex.name}</p>
          <p className="text-[10px] text-slate-500">{ex.muscle} • {toPersianDigits(ex.sets.length)} ست</p>
        </div>
        {/* بج سوپرست فقط اگر داخل گروه نیست و حرکت متعلق به یک گروه است */}
        {!hideSupersetBadge && ex.supersetGroup && ex.supersetType && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0"
            title={`${groupTypeLabel(ex.supersetType)} — گروه ${ex.supersetGroup}`}
          >
            {groupTypeLabel(ex.supersetType)} {ex.supersetGroup}
          </span>
        )}
        {/* آیکون «جزئیات حرکت» — باز کردن ExerciseDetailModal */}
        <button
          type="button"
          onClick={onShowDetail}
          className="p-1.5 rounded-lg hover:bg-orange-100 text-orange-500 hover:text-orange-600 transition shrink-0"
          aria-label="جزئیات حرکت"
          title="نمایش توضیحات، نکات تکنیکی و ویدیوی حرکت"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
      {/* توصیه کوتاه مربی — فقط در صورت وجود */}
      {ex.coachTip && (
        <div className="flex items-start gap-1 mb-2 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
          <span className="text-[11px] leading-none shrink-0">💡</span>
          <p className="text-[10px] text-amber-800 leading-snug">{ex.coachTip}</p>
        </div>
      )}
      <div className="space-y-1.5">
        {ex.sets.map((set) => {
          const key = `${ex.id}_${set.setNumber}`;
          const done = doneSets[key];
          return (
            <div key={set.setNumber} className={`flex items-center gap-2 p-2 rounded-lg transition ${done ? "bg-orange-50" : "bg-slate-50"}`}>
              <span className="text-[10px] text-slate-500 w-8">{toPersianDigits(set.setNumber)} ست</span>
              <span className="text-[10px] text-slate-500 flex-1">هدف: {toPersianDigits(set.reps)}</span>
              <input
                type="number"
                dir="ltr"
                placeholder="kg"
                value={setWeights[key] ?? ""}
                onChange={(e) => onSetWeight(key, e.target.value)}
                disabled={done}
                className="w-12 h-7 text-center text-[11px] rounded-md border border-slate-200 bg-white text-slate-700"
              />
              <input
                type="number"
                dir="ltr"
                placeholder="rep"
                value={setReps[key] ?? ""}
                onChange={(e) => onSetReps(key, e.target.value)}
                disabled={done}
                className="w-12 h-7 text-center text-[11px] rounded-md border border-slate-200 bg-white text-slate-700"
              />
              <button
                onClick={() => onComplete(ex.id, set.setNumber)}
                disabled={done}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition shrink-0 ${
                  done ? "text-white" : "bg-slate-200 text-slate-600 hover:text-white"
                }`}
                style={done ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : undefined}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
