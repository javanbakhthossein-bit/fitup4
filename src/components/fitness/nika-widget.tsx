"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  X,
  MessageCircle,
  ShoppingBag,
  HelpCircle,
  Tag,
  ChevronLeft,
} from "lucide-react";
import { useAppStore, type AppScreen } from "@/lib/fitness/store";
import { pushScreen, replaceScreen, type NavScreen } from "@/lib/fitness/navigation";
import { isFitUpBazaarApp } from "@/lib/fitness/bazaar-bridge";
import { useNikaChat } from "@/lib/fitness/use-nika-chat";
import { type ChatMessageDto } from "@/lib/fitness/types";

const NIKA_PROMPTS = [
  { icon: HelpCircle, text: "کدوم پلن برای من مناسبه؟" },
  { icon: Tag, text: "ابزارهای رایگان شما چیه؟" },
  { icon: ShoppingBag, text: "تفاوت پلن‌ها چیه؟" },
];

/**
 * مقادیر screen_name مجاز برای لینک‌های درون‌برنامه‌ای نیکا.
 * اگر مقدار "plans" بود → setOverlay("subscription")
 * در غیر این صورت → setScreen(screen_name)
 */
const NIKA_ACTION_SCREENS = new Set<string>([
  "landing",
  "auth",
  "tool-tdee",
  "tool-exercises",
  "tool-foods",
  "articles",
  "plans",
  "pricing",
  "features",
]);

type ParsedPart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; action: string };

/**
 * تفسیر متن پیام برای استخراج لینک‌های درون‌برنامه‌ای با فرمت:
 *   [متن لینک](action:screen_name)
 */
function parseNikaContent(content: string): ParsedPart[] {
  const regex = /\[([^\]]+)\]\(action:([^)]+)\)/g;
  const parts: ParsedPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: content.slice(lastIndex, match.index) });
    }
    const action = match[2].trim();
    if (NIKA_ACTION_SCREENS.has(action)) {
      parts.push({ type: "link", text: match[1], action });
    } else {
      // اکشن ناشناخته → به‌صورت متن ساده نمایش بده
      parts.push({ type: "text", text: match[1] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", text: content.slice(lastIndex) });
  }
  return parts;
}

export function NikaWidget() {
  const { screen } = useAppStore();
  const [open, setOpen] = useState(false);
  const { messages, loading, sending, send, input, setInput, isGuest } = useNikaChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMsgCountRef = useRef(0);

  // ردیابی پیام‌های خوانده‌نشده
  // وقتی پیام جدید از نیکا می‌آید و چت بسته است → unreadCount افزایش می‌یابد
  // وقتی چت باز می‌شود → unreadCount = 0
  useEffect(() => {
    const currentCount = messages.length;
    if (currentCount > prevMsgCountRef.current && !open) {
      // پیام جدید آمده و چت بسته است → خوانده‌نشده
      setUnreadCount((prev) => prev + (currentCount - prevMsgCountRef.current));
    }
    prevMsgCountRef.current = currentCount;
  }, [messages, open]);

  // وقتی چت باز می‌شود → همه پیام‌ها خوانده شده
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
    }
  }, [open]);

  // نمایش پیام ترغیب‌کننده بعد از ۵ ثانیه برای اولین ورود
  useEffect(() => {
    if (hintDismissed || open) return;
    try {
      const seen = localStorage.getItem("nika_hint_seen");
      if (seen) return;
    } catch {}
    const timer = setTimeout(() => {
      setShowHint(true);
      // پخش صدای کوتاه و مدرن
      // ─── اپ کافه‌بازار: بی‌صدا ───
      // درخواست مالک: چت نیکا در اپ بازار هیچ اعلان/صدای اعلان‌مانندی نداشته
      // باشد. در WebView اندروید AudioContext بدون user gesture هم می‌تواند
      // پخش شود (برخلاف مرورگرها) و کاربر آن را «اعلان» تلقی می‌کند → در اپ
      // بازار حذف؛ در مرورگر/PWA دست‌نخورده.
      if (isFitUpBazaarApp()) return;
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08); // E6
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch {}
    }, 5000);
    return () => clearTimeout(timer);
  }, [hintDismissed, open]);

  function dismissHint() {
    setShowHint(false);
    setHintDismissed(true);
    try {
      localStorage.setItem("nika_hint_seen", "1");
    } catch {}
  }

  function openChat() {
    setOpen(true);
    dismissHint();
  }

  useEffect(() => {
    if (open && scrollRef.current) {
      // Instant scroll (no smooth animation) so user immediately sees the latest message
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending, open]);

  // When opening the widget, jump to latest message instantly (no animation)
  useEffect(() => {
    if (open && scrollRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // پنهان کردن ویجت در پنل ورزشکار (main screen) — بعد از hookها
  if (screen === "main") return null;

  function handleSend(text?: string) {
    send(text);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /**
   * هدایت کاربر بر اساس اکشن لینک درون‌برنامه‌ای.
   * "plans" → Overlay اشتراک (اگر در main نیست، اول به main برو)
   * "pricing" → اسکرول به بخش قیمت‌ها در landing
   * سایر → setScreen + pushScreen
   * همیشه ویجت را می‌بندد تا کاربر صفحه مقصد را ببیند.
   */
  function handleNavigate(target: string) {
    setOpen(false);
    const store = useAppStore.getState();

    if (target === "plans") {
      // همیشه به بخش pricing در landing برو (مستقل از لاگین بودن)
      if (store.screen !== "landing") {
        store.setScreen("landing");
        replaceScreen("landing");
        setTimeout(() => {
          const el = document.querySelector("#pricing");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 500);
      } else {
        const el = document.querySelector("#pricing");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    } else if (target === "pricing") {
      // اسکرول به بخش قیمت‌ها در landing
      if (store.screen !== "landing") {
        store.setScreen("landing");
        replaceScreen("landing");
        setTimeout(() => {
          const el = document.querySelector("#pricing");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 500);
      } else {
        const el = document.querySelector("#pricing");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    } else if (target === "features") {
      if (store.screen !== "landing") {
        store.setScreen("landing");
        replaceScreen("landing");
        setTimeout(() => {
          const el = document.querySelector("#features");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }, 500);
      } else {
        const el = document.querySelector("#features");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    } else if (target === "auth") {
      store.setScreen("auth");
      pushScreen("auth");
    } else if (target === "articles") {
      store.setScreen("articles");
      pushScreen("articles");
    } else if (target === "landing") {
      store.setScreen("landing");
      replaceScreen("landing");
    } else if (target.startsWith("tool-")) {
      const tool = target.replace("tool-", "");
      store.setScreen(target as AppScreen);
      pushScreen(target as NavScreen, { tool });
    } else {
      store.setScreen(target as AppScreen);
    }
  }

  return (
    <>
      {/* پیام ترغیب‌کننده قابل بستن — بالای دکمه نیکا */}
      <AnimatePresence>
        {showHint && !open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="fixed bottom-24 right-5 z-50 max-w-[240px]"
          >
            <div className="relative rounded-2xl bg-white shadow-2xl border-2 border-orange-200 p-3" style={{ background: "linear-gradient(135deg, #fff7ed, #ffffff)" }}>
              <button
                onClick={dismissHint}
                className="absolute top-1.5 left-1.5 p-1 rounded-full hover:bg-orange-100 transition"
                aria-label="بستن"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
              <p className="text-[11px] text-slate-700 leading-relaxed pl-4">
                سوال داری؟ با نیکا مشاوره کن! 🌟
                <br />
                <span className="text-orange-600 font-bold">کدوم پلن برات مناسبه؟</span>
              </p>
              <button
                onClick={openChat}
                className="mt-2 w-full py-1.5 rounded-xl text-[11px] font-bold text-white transition hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
              >
                شروع مشاوره
              </button>
              {/* فلش پایین */}
              <div className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45 bg-white border-l-2 border-b-2 border-orange-200" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* دکمه شناور نیکا — پایین راست */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={openChat}
            className="fixed bottom-5 right-5 z-50 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, #fb923c, #f97316)", boxShadow: "0 8px 24px rgba(249,115,22,0.4)" }}
            aria-label="چت با نیکا"
          >
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <MessageCircle className="w-7 h-7" />
            </motion.div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center" style={{ boxShadow: "0 0 8px rgba(245,158,11,0.6)" }}>
                {unreadCount > 99 ? "۹۹+" : unreadCount.toLocaleString("fa-IR")}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* پنل چت نیکا — پس‌زمینه سفید */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 max-w-md h-[560px] max-h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-white"
            style={{ border: "2px solid", borderColor: "#fb923c" }}
          >
            {/* هدر سفید با لهجه نارنجی */}
            <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)", borderColor: "#fed7aa" }}>
              <div className="relative">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-orange-400 border-2 border-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm text-orange-600">نیکا ✨</h3>
                <p className="text-[10px] text-orange-500">
                  {isGuest ? "کارشناس فروش — حالت مهمان" : "کارشناس فروش فیتاپ — همیشه آماده"}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-orange-100 transition">
                <X className="w-4 h-4 text-orange-600" />
              </button>
            </div>

            {/* پیام‌ها — پس‌زمینه سفید */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll p-3 space-y-2.5 bg-white">
              {loading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center text-center px-4 py-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-3"
                    style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
                  >
                    <Bot className="w-8 h-8 text-white" />
                  </motion.div>
                  <h4 className="font-bold text-sm mb-1 text-slate-900">سلام! من نیکام 🌟</h4>
                  <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                    کارشناس فروش فیتاپ. هر سوالی درباره پلن‌ها، امکانات یا ابزارهای رایگان داری بپرس!
                    <span className="block text-orange-600 mt-1">💡 من برنامه ورزشی تجویز نمی‌کنم — اون کار مربی هوشمنده!</span>
                  </p>
                  <div className="w-full space-y-1.5">
                    {NIKA_PROMPTS.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(p.text)}
                        className="w-full flex items-center gap-2 p-2 rounded-xl border text-right text-[11px] hover:scale-[1.02] transition text-slate-700"
                        style={{ borderColor: "#fed7aa", background: "#fff7ed" }}
                      >
                        <p.icon className="w-4 h-4 text-orange-500 shrink-0" />
                        {p.text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <NikaWidgetBubble key={msg.id} message={msg} onNavigate={handleNavigate} />
                  ))}
                  {sending && (
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-br-md px-3 py-2 flex items-center gap-1" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-orange-400" />
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-orange-400" />
                        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-orange-400" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ورودی — سفید */}
            <div className="p-2.5 border-t bg-white" style={{ borderColor: "#fed7aa" }}>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="سوالت رو از نیکا بپرس..."
                  rows={1}
                  className="flex-1 resize-none rounded-2xl bg-orange-50 border px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-300 max-h-20"
                  style={{ borderColor: "#fed7aa" }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || sending}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
                >
                  <Send className="w-4 h-4 -rotate-180" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NikaWidgetBubble({
  message,
  onNavigate,
}: {
  message: ChatMessageDto;
  onNavigate: (target: string) => void;
}) {
  const isUser = message.role === "user";
  const mentionsUpgrade =
    message.content.includes("پلن") &&
    (message.content.includes("هوشمند") ||
      message.content.includes("VIP") ||
      message.content.includes("ویژه") ||
      message.content.includes("استاندارد") ||
      message.content.includes("خرید"));

  // پیام کاربر → ساده نمایش بده
  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start"
      >
        <div className="max-w-[88%]">
          <div
            className="rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-white rounded-bl-md"
            style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
          >
            {message.content}
          </div>
        </div>
      </motion.div>
    );
  }

  // پیام نیکا → لینک‌های درون‌برنامه‌ای را تفسیر کن
  const parts = parseNikaContent(message.content);
  const hasLinks = parts.some((p) => p.type === "link");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="max-w-[90%]">
        <div
          className="rounded-2xl rounded-br-md px-3 py-2 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap"
          style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}
        >
          {parts.map((part, idx) => {
            if (part.type === "text") {
              return <span key={idx}>{part.text}</span>;
            }
            // لینک درون‌برنامه‌ای → دکمه قابل کلیک با استایل متمایز (نارنجی پررنگ)
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigate(part.action)}
                className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded-md text-orange-700 font-bold text-[11px] border-b-2 border-orange-500 hover:bg-orange-100 hover:text-orange-800 transition align-baseline"
              >
                {part.text}
                <ChevronLeft className="w-3 h-3" />
              </button>
            );
          })}
        </div>
        {/* دکمه اصلی CTA برای پیام‌هایی که به پلن اشاره می‌کنند — در صورت عدم وجود لینک plans داخل متن */}
        {mentionsUpgrade && !hasLinks && (
          <button
            onClick={() => onNavigate("plans")}
            className="mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-bold text-white transition hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
          >
            <ShoppingBag className="w-3 h-3 inline ml-1" />
            مشاهده و خرید پلن‌ها
          </button>
        )}
      </div>
    </motion.div>
  );
}
