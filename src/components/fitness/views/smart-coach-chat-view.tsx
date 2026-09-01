"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Sparkles,
  Dumbbell,
  Salad,
  RotateCcw,
  Bot,
  ImageIcon,
  Video,
  Lock,
  X,
  Loader2,
  Mic,
  Square,
  Volume2,
  Plus,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradeBanner } from "@/components/fitness/upgrade-banner";
import { canAccess, type ChatMessageDto } from "@/lib/fitness/types";
import { useVoiceRecorder } from "@/lib/fitness/use-voice-recorder";
import { fetchJson, fetchJsonOrThrow, SERVER_UNREACHABLE_MESSAGE } from "@/lib/fitness/fetch-json";
import { toast } from "sonner";

const QUICK_PROMPTS = [
  { icon: Dumbbell, text: "یکی از حرکات امروز را سخت‌تر کن" },
  { icon: Salad, text: "یک میان‌وعده کم‌کالری پیشنهاد بده" },
  { icon: RotateCcw, text: "جایگزینی برای اسکوات بده" },
];

/** id یکتا برای پیام‌های موقت — پسوند تصادفی برای جلوگیری از تصادم id (FE-L6) */
function tempId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** تبدیل File به Data URL برای ارسال به سرور */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** قالب‌بندی زمان پیام به فارسی */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * پاکسازی متن markdown قبل از ارسال به TTS.
 * تیکرها (#، *، |، -، >) و علامت‌ها را حذف می‌کند تا TTS آن‌ها را به انگلیسی نخواند.
 * - هدرها، bold/italic، code blocks، inline code، لینک‌ها، تصاویر، جدول‌ها،
 *   blockquote و list markers حذف یا ساده می‌شوند.
 * - emoji‌ها حذف می‌شوند (ممکن است TTS آن‌ها را به‌صورت نامفهوم بخواند).
 */
function cleanTextForTTS(text: string): string {
  if (!text) return "";
  return text
    // حذف markdown headers (#، ##، ###)
    .replace(/^#{1,6}\s+/gm, "")
    // حذف bold/italic (**text**، *text*، __text__، _text_)
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // حذف code blocks (```...```)
    .replace(/```[\s\S]*?```/g, "")
    // حذف inline code (`code`)
    .replace(/`(.+?)`/g, "$1")
    // حذف تصاویر ![alt](url) — قبل از لینک‌ها
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // حذف لینک‌ها [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // حذف جدول‌ها — فقط محتوای سلول‌ها را نگه دار
    .replace(/^[\s\-:]+\|/gm, "")
    .replace(/^\||\|$/gm, "")
    .replace(/\|/g, " ")
    // حذف blockquote (> text)
    .replace(/^>\s+/gm, "")
    // حذف list markers (-، *، +، 1.)
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // حذف emoji‌ها
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    )
    // حذف گیومه‌های کد باقی‌مانده
    .replace(/``/g, "")
    // فاصله‌های اضافی
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function SmartCoachChatView({ variant = "page" }: { variant?: "page" | "panel" }) {
  const { user, chatMessages, setChatMessages, addChatMessage, setOverlay } =
    useAppStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // قابلیت صوتی — ضبط ویس و تبدیل به متن
  const { isRecording, isProcessing, error: voiceError, startRecording, stopRecording } = useVoiceRecorder((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
    lastWasVoiceRef.current = true; // علامت‌گذاری: این پیام از ویس بود
    toast.success("پیام صوتی تبدیل به متن شد 🎤 — دکمه ارسال را بزنید");
  });

  // نمایش خطای میکروفون
  useEffect(() => {
    if (voiceError) toast.error(voiceError);
  }, [voiceError]);

  // اگر پاسخ آی‌آی صوتی دارد (وقتی کاربر ویس فرستاده)، خودکار پخش کن
  const lastAiMsgRef = useRef<string | null>(null);
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg.role === "assistant" && lastMsg.id !== lastAiMsgRef.current) {
      lastAiMsgRef.current = lastMsg.id;
      // اگر پاسخ صوتی دارد (mediaUrl با نوع audio)، خودکار پخش کن
      // (cast: سرور در پاسخ‌های TTS نوع audio برمی‌گرداند که در تایپ ClientDto نیست)
      if (lastMsg.mediaUrl && (lastMsg.mediaType as string | null | undefined) === "audio") {
        const audio = new Audio(lastMsg.mediaUrl);
        audio.play().catch(() => {});
      }
    }
  }, [chatMessages]);

  // tracking: آیا آخرین پیام ارسالی از طریق ویس بود؟
  const lastWasVoiceRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // پیش‌نمایش مدیای انتخاب‌شده قبل از ارسال
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // data URL
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null); // data URL

  // ─── منوی بازشدنی دکمه + (انتخاب عکس/ویدیو) ───
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  const planName = user?.planName ?? null;
  const canChat = canAccess(planName, "aiChatQuestions");
  const canSendImage = canAccess(planName, "chatImageUpload");
  const canSendVideo = canAccess(planName, "chatVideoUpload");

  // بارگذاری تاریخچه چت از سرور — تابع جدا تا دکمه «تلاش مجدد» در بنر خطا
  // هم بتواند همان منطق را اجرا کند (قبلاً فقط داخل useEffect یک‌باره بود)
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      // fetchJson: پاسخ HTML (خطای گیت‌وی/سرور در حال ری‌استارت) → خطای فارسی
      const { res, data } = await fetchJson<{ messages?: ChatMessageDto[] }>(
        "/api/coach/chat",
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error();
      setChatMessages(data.messages || []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [setChatMessages]);

  // بارگذاری اولیه تاریخچه چت از سرور (یک‌بار در mount)
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // اسکرول خودکار به آخرین پیام
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages, sending]);

  // Auto-resize textarea تا حداکثر ۱۲۰px
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری مجاز است.");
      return;
    }
    // محدودیت حجم حذف شد — خودکار در سرور کاهش می‌یابد
    if (file.size > 30 * 1024 * 1024) {
      toast.error("حداکثر حجم عکس ۳۰ مگابایت است.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSelectedImage(dataUrl);
      setSelectedVideo(null); // فقط یک مدیا همزمان
    } catch {
      toast.error("خطا در پردازش عکس. دوباره تلاش کنید.");
    }
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("فقط فایل ویدیویی مجاز است.");
      return;
    }
    // محدودیت حجم: ۳۰ مگابایت (با سرور هم‌خوانی دارد — ۴۰ مگابایت base64)
    if (file.size > 30 * 1024 * 1024) {
      toast.error("حداکثر حجم ویدیو ۳۰ مگابایت است.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSelectedVideo(dataUrl);
      setSelectedImage(null); // فقط یک مدیا همزمان
    } catch {
      toast.error("خطا در پردازش ویدیو. دوباره تلاش کنید.");
    }
  }

  function handleImageBtn() {
    if (canSendImage) {
      imageInputRef.current?.click();
    } else {
      toast.info("برای ارسال عکس باید پلن خود را به پیشرفته ارتقا دهید");
      setOverlay("subscription");
    }
  }

  function handleVideoBtn() {
    if (canSendVideo) {
      videoInputRef.current?.click();
    } else {
      toast.info("برای ارسال ویدیو باید پلن خود را به حرفه‌ای ارتقا دهید");
      setOverlay("subscription");
    }
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if ((!message && !selectedImage && !selectedVideo) || sending) return;
    if (!canChat) {
      toast.info("برای چت با فیتاپ باید پلن خود را ارتقا دهید");
      setOverlay("subscription");
      return;
    }
    setInput("");
    setSending(true);

    // ساخت پیام موقت با مدیا برای نمایش فوری
    const tempUserMsg: ChatMessageDto = {
      id: tempId("temp"),
      role: "user",
      content:
        message ||
        (selectedImage ? "📷 عکس" : selectedVideo ? "🎬 ویدیو" : ""),
      mediaUrl: selectedImage ?? selectedVideo,
      mediaType: selectedImage ? "image" : selectedVideo ? "video" : null,
      createdAt: new Date().toISOString(),
    };
    addChatMessage(tempUserMsg);

    // ذخیره مدیا قبل از ارسال به سرور (تا بعد از ارسال هم نمایش داده شود)
    const imageData = selectedImage;
    const videoData = selectedVideo;
    setSelectedImage(null);
    setSelectedVideo(null);

    try {
      // fetchJsonOrThrow: پاسخ HTML (۵۰۲ گیت‌وی / تایم‌اوت درخواست‌های بلند ویدیو)
      // → پیام فارسی «ارتباط با سرور برقرار نشد...» به‌جای «Unexpected token '<'»
      const data = await fetchJsonOrThrow<any>(
        "/api/coach/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            imageBase64: imageData || undefined,
            videoBase64: videoData || undefined,
            isVoice: lastWasVoiceRef.current, // آیا پیام از طریق ویس بود؟
          }),
        },
        "خطا در ارتباط با سرور"
      );

      setChatMessages([
        ...chatMessages.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage,
        data.aiMessage,
      ]);
    } catch (e) {
      setChatMessages(chatMessages.filter((m) => m.id !== tempUserMsg.id));
      // ─── بازیابی متن تایپ‌شده و پیوست‌ها ───
      // قبلاً پیام کاربر (متن + عکس/ویدیو) با خطای شبکه «برای همیشه» از دست
      // می‌رفت و کاربر مجبور بود از اول تایپ/انتخاب کند — حالا مقادیر pre-send
      // به input و پیش‌نمایش مدیا برمی‌گردند (فقط اگر کاربر در این بین چیزی
      // جدید تایپ/انتخاب نکرده باشد تا کار تازه‌اش دوباره‌کاری نشود).
      if (message) setInput((prev) => prev || message);
      if (imageData) setSelectedImage((prev) => prev ?? imageData);
      if (videoData) setSelectedVideo((prev) => prev ?? videoData);
      const errMsg =
        e instanceof Error ? e.message : "خطا در ارتباط با سرور";
      addChatMessage({
        id: tempId("err"),
        role: "assistant",
        content: `⚠️ ${errMsg}. اتصال اینترنت خود را بررسی کنید.`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
      lastWasVoiceRef.current = false; // reset برای پیام بعدی
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // اگر کاربر به چت دسترسی ندارد (Basic/Standard) → بنر ارتقا
  if (!loading && !canChat) {
    return (
      <div className={variant === "panel" ? "px-4 py-4 h-full overflow-y-auto custom-scrollbar" : "px-4 py-4 max-w-md mx-auto"}>
        <UpgradeBanner
          featureLabel="فیتاپ"
          requiredPlan="advanced"
          description="با ارتقا به پلن پیشرفته، به فیتاپ با دسترسی کامل به داده‌های آنبوردینگ، آزمایش خون و اهداف شما دسترسی پیدا کن. برنامه تمرینی هفتگی، کالری دقیق، مکمل‌ها و پاسخ فنی — همه در ۲۴ ساعت شبانه‌روز."
          icon={<img src="/fitup-logo.png" alt="فیتاپ" className="w-8 h-8 rounded-lg object-cover" />}
        />
        <div className="mt-4 p-3 rounded-2xl bg-orange-50 border border-orange-100 text-center">
          <p className="text-xs text-slate-600 mb-2">
            💡 در عوض می‌تونی با «نیکا» چت کنی — راهنمای فروش و پشتیبانی
          </p>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => useAppStore.getState().setChatMode("nika")}
          >
            <Bot className="w-4 h-4 text-orange-500" /> رفتن به چت نیکا
          </Button>
        </div>
      </div>
    );
  }

  const containerClass =
    variant === "panel"
      ? "flex flex-col h-full w-full bg-white"
      : "flex flex-col h-[calc(100dvh-4rem)] max-w-2xl mx-auto bg-white";

  return (
    <div
      className={containerClass}
      dir="rtl"
    >
      {/* فایل‌های مخفی برای انتخاب عکس/ویدیو */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoSelect}
      />

      {/* هدر فیتاپ — تم سفید حرفه‌ای */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-orange-100 bg-white/95 backdrop-blur-md sticky top-0 z-10">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-amber-500 to-orange-600 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <span className="absolute bottom-0 left-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-slate-900 truncate">
            فیتاپ
          </h3>
          <p className="text-[11px] text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            آنلاین — دسترسی کامل به پرونده شما
          </p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-orange-500" />
        </div>
      </header>

      {/* پیام‌ها */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-4 space-y-3 bg-orange-50/40"
      >
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="h-20 w-3/4 rounded-2xl mr-auto" />
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
              className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg mb-4 bg-gradient-to-br from-amber-500 to-orange-600 overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
            </motion.div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">
              فیتاپ آماده‌ست 💪
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs leading-relaxed">
              من به تمام اطلاعات آنبوردینگ، آزمایش خون و اهداف تو دسترسی دارم.
              هر سوال فنی ورزشی یا تغذیه‌ای بپرس، برنامه تمرینی، مکمل یا کالری
              دقیق بخواه.
            </p>
            <div className="w-full max-w-sm space-y-2">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p.text)}
                  className="w-full bg-white border border-orange-100 rounded-2xl p-3 hover:border-orange-300 transition text-right text-sm flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-orange-50">
                    <p.icon className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-slate-700 flex-1">{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((msg) => (
              <CoachBubble key={msg.id} message={msg} />
            ))}
            {sending && <CoachTyping />}
          </>
        )}
      </div>

      {/* ورودی */}
      <div className="border-t border-orange-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2 text-center border border-red-200 flex items-center justify-between gap-2">
            <span className="flex-1">خطا در بارگذاری تاریخچه چت</span>
            {/* تلاش مجدد — همان منطق بارگذاری اولیه تاریخچه را اجرا می‌کند */}
            <button
              onClick={loadHistory}
              disabled={loading}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-600 font-bold hover:bg-red-50 transition disabled:opacity-50"
              aria-label="تلاش مجدد"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              تلاش مجدد
            </button>
          </div>
        )}

        {/* پیش‌نمایش مدیای انتخاب‌شده */}
        {(selectedImage || selectedVideo) && (
          <div className="mb-2 flex items-center gap-2">
            <div className="relative inline-block">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt="پیش‌نمایش عکس"
                  className="w-16 h-16 object-cover rounded-xl border border-orange-200"
                />
              ) : selectedVideo ? (
                <video
                  src={selectedVideo}
                  className="w-16 h-16 object-cover rounded-xl border border-orange-200"
                  muted
                />
              ) : null}
              {selectedVideo && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-slate-900/85 text-white text-[8px] font-bold whitespace-nowrap" dir="rtl">
                  حداکثر ۳۰MB
                </span>
              )}
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setSelectedVideo(null);
                }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                aria-label="حذف مدیا"
                title="حذف"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-xs text-slate-500">آماده ارسال</span>
          </div>
        )}

        {/* ─── ردیزاین input چت — دکمه + (آپلود) + میکروفون + textarea + ارسال ─── */}
        <div className="flex items-end gap-2 relative">
          {/* دکمه + (باز کردن منوی آپلود) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowUploadMenu(!showUploadMenu)}
              disabled={sending}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition shrink-0 ${
                showUploadMenu
                  ? "bg-orange-500 text-white"
                  : "bg-orange-50 hover:bg-orange-100 text-orange-500"
              }`}
              title="آپلود فایل"
              aria-label="آپلود فایل"
              aria-expanded={showUploadMenu}
            >
              <Plus className={`w-5 h-5 transition-transform ${showUploadMenu ? "rotate-45" : ""}`} />
            </button>

            {/* منوی بازشدنی — انتخاب عکس/ویدیو */}
            {showUploadMenu && (
              <>
                {/* بستن منو با کلیک خارج */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUploadMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="absolute bottom-14 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-orange-100 p-1.5 min-w-[160px]"
                >
                  {/* گزینه عکس */}
                  <button
                    onClick={() => {
                      setShowUploadMenu(false);
                      handleImageBtn();
                    }}
                    disabled={!canSendImage || sending}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition text-sm ${
                      canSendImage
                        ? "hover:bg-orange-50 text-slate-700"
                        : "text-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${canSendImage ? "bg-orange-100 text-orange-500" : "bg-slate-100 text-slate-300"}`}>
                      {canSendImage ? <ImageIcon className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xs">عکس</p>
                      {!canSendImage && <p className="text-[9px] text-slate-400">نیازمند پلن پیشرفته</p>}
                    </div>
                  </button>
                  {/* گزینه ویدیو */}
                  <button
                    onClick={() => {
                      setShowUploadMenu(false);
                      handleVideoBtn();
                    }}
                    disabled={!canSendVideo || sending}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition text-sm ${
                      canSendVideo
                        ? "hover:bg-orange-50 text-slate-700"
                        : "text-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${canSendVideo ? "bg-orange-100 text-orange-500" : "bg-slate-100 text-slate-300"}`}>
                      {canSendVideo ? <Video className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-xs">ویدیو</p>
                      {canSendVideo ? (
                        <p className="text-[9px] text-slate-400">حداکثر ۳۰ مگابایت — MP4/MOV/WebM</p>
                      ) : (
                        <p className="text-[9px] text-slate-400">نیازمند پلن حرفه‌ای</p>
                      )}
                    </div>
                  </button>
                </motion.div>
              </>
            )}
          </div>

          {/* دکمه میکروفون — ضبط ویس */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={sending || isProcessing}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition shrink-0 ${
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : isProcessing
                ? "bg-orange-100 text-orange-500"
                : "bg-orange-50 hover:bg-orange-100 text-orange-500"
            }`}
            title={isRecording ? "توقف ضبط" : "ارسال پیام صوتی"}
            aria-label={isRecording ? "توقف ضبط" : "ارسال پیام صوتی"}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRecording ? (
              <Square className="w-5 h-5 fill-white" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* textarea auto-resize */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="سوال تخصصی از فیتاپ..."
              rows={1}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 max-h-[120px] transition"
              disabled={sending || loading}
            />
          </div>

          {/* دکمه ارسال */}
          <button
            onClick={() => send()}
            disabled={
              (!input.trim() && !selectedImage && !selectedVideo) || sending
            }
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 bg-gradient-to-br from-amber-500 to-orange-600"
            aria-label="ارسال پیام"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5 -rotate-180" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CoachBubble({ message }: { message: ChatMessageDto }) {
  const isUser = message.role === "user";
  const time = formatTime(message.createdAt);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsAudio, setTtsAudio] = useState<HTMLAudioElement | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  async function playTTS() {
    // اگر قبلاً صدا ساخته شده → فقط پخش/توقف کن
    if (ttsAudio) {
      if (ttsPlaying) {
        ttsAudio.pause();
        setTtsPlaying(false);
      } else {
        // resume playback — حتماً منتظر promise بمان تا خطا را بگیریم
        try {
          await ttsAudio.play();
          setTtsPlaying(true);
        } catch (err) {
          console.error("[playTTS] resume failed:", err);
          toast.error("گوش دادن ناموفق بود. دوباره تلاش کنید.");
          setTtsPlaying(false);
        }
      }
      return;
    }

    // ─── اگر پیام صوتی است (mediaUrl با type=audio)، مستقیماً از URL پخش کن ───
    // نیازی به تولید TTS نیست — صوت از قبل وجود دارد
    // (cast: سرور در پاسخ‌های TTS نوع audio برمی‌گرداند که در تایپ ClientDto نیست)
    if (message.mediaUrl && (message.mediaType as string | null | undefined) === "audio") {
      try {
        const audio = new Audio(message.mediaUrl);
        audio.onended = () => setTtsPlaying(false);
        audio.onplay = () => setTtsPlaying(true);
        audio.onpause = () => setTtsPlaying(false);
        audio.onerror = () => {
          setTtsPlaying(false);
          toast.error("خطا در پخش صوت");
        };
        setTtsAudio(audio);
        await audio.play();
        setTtsPlaying(true);
      } catch (err) {
        console.error("[playTTS] audio URL play failed:", err);
        toast.error("گوش دادن ناموفق بود");
      }
      return;
    }

    // ─── در غیر این صورت، صدا را از سرور بساز (TTS) ───
    setTtsLoading(true);
    try {
      // پاکسازی متن از markdown تیکرها و علامت‌ها قبل از ارسال به TTS
      // تا تیکرها (#، *، |، -) به انگلیسی خوانده نشوند
      const cleanText = cleanTextForTTS(message.content);
      if (!cleanText) {
        toast.error("متن برای خواندن پیدا نشد");
        return;
      }
      const res = await fetch("/api/coach/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });
      if (!res.ok) {
        // تلاش برای خواندن پیام خطای واقعی از سرور — پاسخ‌های TTS blob صوتی
        // است، پس فقط در مسیر خطا JSON می‌خوانیم؛ پاسخ HTML (خطای گیت‌وی/سرور)
        // به پیام فارسی «ارتباط با سرور برقرار نشد» تبدیل می‌شود.
        let errDetail = "";
        const errCt = res.headers.get("content-type") || "";
        if (errCt.includes("application/json")) {
          try {
            const errJson = await res.json();
            errDetail = errJson?.error || errJson?.detail || "";
          } catch {}
        } else {
          errDetail = SERVER_UNREACHABLE_MESSAGE;
        }
        console.error("[playTTS] server error:", res.status, errDetail);
        toast.error(errDetail || "خطا در تولید صدا. لطفاً دوباره تلاش کنید.");
        return;
      }
      const blob = await res.blob();
      if (blob.size === 0) {
        console.error("[playTTS] empty audio response");
        toast.error("پاسخ صوتی خالی است. دوباره تلاش کنید.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => setTtsPlaying(false);
      audio.onplay = () => setTtsPlaying(true);
      audio.onpause = () => setTtsPlaying(false);
      audio.onerror = () => {
        setTtsPlaying(false);
        toast.error("خطا در پخش صوت");
      };
      setTtsAudio(audio);
      // حتماً منتظر play() بمان — autoplay policy ممکن است رد کند
      await audio.play();
      setTtsPlaying(true);
    } catch (err) {
      console.error("[playTTS] error:", err);
      toast.error("خطا در تولید صدا. لطفاً دوباره تلاش کنید.");
      setTtsAudio(null);
    } finally {
      setTtsLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] flex flex-col ${
          isUser ? "items-start" : "items-end"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
            </div>
            <span className="text-[10px] text-orange-600 font-medium">
              فیتاپ
            </span>
          </div>
        )}

        {/* نمایش مدیا در بالای متن پیام کاربر */}
        {isUser && message.mediaUrl && (
          <div className="mb-1.5">
            {message.mediaType === "image" ? (
              <img
                src={message.mediaUrl}
                alt="عکس ارسالی"
                className="max-w-[220px] max-h-[220px] w-auto h-auto object-cover rounded-2xl border-2 border-orange-200 shadow-sm"
              />
            ) : message.mediaType === "video" ? (
              <video
                src={message.mediaUrl}
                controls
                className="max-w-[240px] max-h-[260px] w-auto h-auto object-cover rounded-2xl border-2 border-orange-200 shadow-sm"
              />
            ) : null}
          </div>
        )}

        {(message.content || !isUser) && (
          <div
            className={
              isUser
                ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-md"
                : "bg-white border border-orange-100 rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed text-slate-700 shadow-sm"
            }
          >
            {isUser ? (
              message.content
            ) : (
              // ─── رندر markdown برای پیام‌های فیتاپ ───
              // جدول‌ها، هدرها، لیست‌ها و... به‌صورت مرتب نمایش داده می‌شوند.
              // نکته: در react-markdown v10، override کردن h1/img/a می‌تواند
              // parsing جدول‌ها را خراب کند — این‌ها را override نمی‌کنیم.
              <div className="prose-chat-fa">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // جدول‌ها در یک wrapper اسکرول‌پذیر قرار می‌گیرند
                    // استایل واقعی روی CSS .prose-chat-fa table است
                    table: ({ node, ...p }) => (
                      <div className="fitup-table-wrapper" style={{ margin: "0.5rem 0", overflowX: "auto" }}>
                        <table {...p} />
                      </div>
                    ),
                    // بقیه المان‌ها توسط CSS .prose-chat-fa استایل می‌گیرند
                    // نیازی به inline style نیست — CSS کامل است
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {/* ─── دکمه «گوش دادن» — برای همه پیام‌های فیتاپ ─── */}
            {/* چه پیام متنی، چه پیام صوتی — فقط یک دکمه «گوش دادن»/«توقف» */}
            {!isUser && message.content && message.content.length > 10 && (
              <button
                onClick={playTTS}
                disabled={ttsLoading}
                className="mt-2 pt-2 border-t border-orange-50 flex items-center gap-1.5 text-[10px] text-orange-500 hover:text-orange-600 transition font-medium"
                title={ttsPlaying ? "توقف" : "گوش دادن"}
              >
                {ttsLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> در حال آماده‌سازی صدا...</>
                ) : ttsPlaying ? (
                  <><Square className="w-3.5 h-3.5 fill-orange-500" /> توقف</>
                ) : (
                  <><Volume2 className="w-3.5 h-3.5" /> گوش دادن</>
                )}
              </button>
            )}
          </div>
        )}

        {time && (
          <div
            className={`text-[10px] text-slate-400 mt-1 ${
              isUser ? "text-left" : "text-right"
            }`}
          >
            {time}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CoachTyping() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex justify-end"
    >
      <div className="flex flex-col items-end">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm bg-gradient-to-br from-amber-500 to-orange-600 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <span className="text-[10px] text-orange-600 font-medium">
            فیتاپ
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-4 py-3 bg-white border border-orange-100 rounded-2xl rounded-br-md shadow-sm">
          <span
            className="w-2 h-2 rounded-full bg-orange-400 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-orange-400 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-orange-400 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * پخش‌کننده صوتی جذاب — با موج صوتی متحرک و دکمه قطع
 * هنگام پخش صوت، موزیک جیم مود را موقتاً قطع می‌کند.
 */
function VoicePlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    // ─── قطع موقت موزیک جیم مود هنگام پخش صوت ───
    let gymAudio: HTMLAudioElement | null = null;
    try {
      gymAudio = document.querySelector("audio[data-gym-music]") as HTMLAudioElement;
      if (gymAudio && !gymAudio.paused) {
        gymAudio.pause();
        gymAudio.dataset.wasPlaying = "true";
      }
    } catch {}

    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
      try {
        if (gymAudio && gymAudio.dataset.wasPlaying === "true") {
          gymAudio.play().catch(() => {});
          delete gymAudio.dataset.wasPlaying;
        }
      } catch {}
    };
    audio.ontimeupdate = () => {
      if (audio.duration > 0) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.play().then(() => {
      setPlaying(true);
    }).catch((err) => {
      console.error("[VoicePlayer] autoplay failed:", err);
      setPlaying(false);
    });

    return () => {
      audio.pause();
      try {
        if (gymAudio && gymAudio.dataset.wasPlaying === "true") {
          gymAudio.play().catch(() => {});
          delete gymAudio.dataset.wasPlaying;
        }
      } catch {}
    };
  }, [src]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-orange-50">
      <div
        className="flex items-center gap-2.5 p-2.5 rounded-2xl"
        style={{
          background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
          border: "1px solid #fed7aa",
        }}
      >
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white shadow-md transition hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          aria-label={playing ? "توقف صوت" : "پخش صوت"}
        >
          {playing ? (
            <Square className="w-3.5 h-3.5 fill-white" />
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>

        <div className="flex-1 flex items-center gap-0.5 h-6">
          {Array.from({ length: 20 }).map((_, i) => {
            const isActive = (i / 20) * 100 < progress;
            return (
              <motion.span
                key={i}
                className="flex-1 rounded-full"
                style={{
                  background: isActive ? "#f97316" : "#fdba74",
                  height: playing ? "100%" : "30%",
                  opacity: isActive ? 1 : 0.5,
                }}
                animate={
                  playing
                    ? {
                        height: [
                          `${20 + Math.random() * 60}%`,
                          `${40 + Math.random() * 50}%`,
                          `${20 + Math.random() * 60}%`,
                        ],
                      }
                    : { height: "30%" }
                }
                transition={{
                  duration: 0.4,
                  repeat: playing ? Infinity : 0,
                  delay: i * 0.02,
                }}
              />
            );
          })}
        </div>

        <span className="text-[9px] text-orange-600 font-bold shrink-0 flex items-center gap-1">
          <Volume2 className="w-3 h-3" />
          {playing ? "در حال پخش" : "متوقف"}
        </span>
      </div>
    </div>
  );
}
