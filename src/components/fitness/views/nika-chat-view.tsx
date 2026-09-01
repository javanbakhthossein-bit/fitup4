"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Bot, ShoppingBag, HelpCircle, Tag, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits, type ChatMessageDto } from "@/lib/fitness/types";
import { fetchJson, fetchJsonOrThrow } from "@/lib/fitness/fetch-json";

const NIKA_PROMPTS = [
  { icon: HelpCircle, text: "تفاوت پلن‌ها چیه؟" },
  { icon: ShoppingBag, text: "کد تخفیف داری؟" },
  { icon: Sparkles, text: "چطور شروع کنم؟" },
];

/** id یکتا برای پیام‌های موقت — پسوند تصادفی برای جلوگیری از تصادم id در یک میلی‌ثانیه */
function tempId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function NikaChatView({ showBackToCoach = false }: { showBackToCoach?: boolean }) {
  const { user, nikaMessages, setNikaMessages, addNikaMessage, setOverlay, setChatMode } = useAppStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      try {
        // fetchJson: پاسخ HTML (خطای گیت‌وی/سرور در حال ری‌استارت) → خطای فارسی
        const { res, data } = await fetchJson<{ messages?: ChatMessageDto[] }>(
          "/api/nika/chat",
          { cache: "no-store" }
        );
        if (res.ok) setNikaMessages(data.messages || []);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [nikaMessages, sending]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);

    const tempUserMsg: ChatMessageDto = {
      id: tempId("temp"),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    addNikaMessage(tempUserMsg);

    try {
      // fetchJsonOrThrow: پاسخ HTML (۵۰۲ گیت‌وی) → پیام فارسی «ارتباط با سرور
      // برقرار نشد...» داخل چت — به‌جای «Unexpected token '<'»
      const data = await fetchJsonOrThrow<any>(
        "/api/nika/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
        "خطا در ارتباط با سرور"
      );

      setNikaMessages([
        ...nikaMessages.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage,
        data.nikaMessage,
      ]);
    } catch (e) {
      setNikaMessages(nikaMessages.filter((m) => m.id !== tempUserMsg.id));
      const errMsg = e instanceof Error ? e.message : "خطا در ارتباط با سرور";
      addNikaMessage({
        id: tempId("err"),
        role: "assistant",
        content: `⚠️ ${errMsg}. دوباره تلاش کنید.`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-md mx-auto">
      {/* نیکا هدر — تم گرم کرمی/نارنجی */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-orange-500/15" style={{ background: "linear-gradient(135deg, rgba(251,146,60,0.12), rgba(254,215,170,0.06))" }}>
        {showBackToCoach && (
          <button
            type="button"
            onClick={() => setChatMode("coach")}
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl hover:bg-orange-500/10 text-orange-500 transition"
            aria-label="بازگشت به چت فیتاپ"
          >
            {/* در RTL جهت بازگشت به راست است */}
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div className="relative">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}>
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="absolute bottom-0 left-0 w-3 h-3 rounded-full bg-orange-400 border-2 border-background" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm text-orange-500">نیکا ✨</h3>
          <p className="text-[11px] text-orange-400/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            دستیار فروش و راهنمای پلتفرم
          </p>
        </div>
        {showBackToCoach && (
          <span className="text-[10px] text-orange-400/70 shrink-0">بازگشت: چت فیتاپ</span>
        )}
        <Tag className="w-5 h-5 text-orange-400" />
      </div>

      {/* پیام‌ها */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-4 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <Skeleton className="h-20 w-3/4 rounded-2xl mr-auto" />
          </div>
        ) : nikaMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
              className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl mb-4"
              style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
            >
              <Bot className="w-10 h-10 text-white" />
            </motion.div>
            <h3 className="font-bold text-lg mb-1">سلام! من نیکام 🌟</h3>
            <p className="text-sm text-muted-foreground mb-6">
              دستیار فروش و راهنمای فیتاپ. هر سوال درباره پلن‌ها، امکانات، تخفیف‌ها یا نحوه استفاده از سایت داری بپرس!
              <br />
              <span className="text-[11px] text-orange-500 mt-1 block">💡 یادت باشه: من برنامه ورزشی تجویز نمی‌کنم — اون کار مربی هوشمنده!</span>
            </p>
            <div className="w-full space-y-2">
              {NIKA_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p.text)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-orange-500/20 hover:border-orange-500/50 hover:bg-orange-500/5 transition text-right text-sm"
                >
                  <p.icon className="w-5 h-5 text-orange-400 shrink-0" />
                  {p.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {nikaMessages.map((msg) => (
              <NikaBubble key={msg.id} message={msg} onUpgrade={() => setOverlay("subscription")} />
            ))}
            {sending && <NikaTyping />}
          </>
        )}
      </div>

      {/* ورودی */}
      <div className="border-t bg-card p-3" style={{ borderColor: "rgba(251,146,60,0.15)" }}>
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="سوالت رو از نیکا بپرس..."
              rows={1}
              className="w-full resize-none rounded-2xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 max-h-24"
            />
          </div>
          <Button
            onClick={() => send()}
            disabled={!input.trim() || sending}
            className="rounded-full w-11 h-11 p-0 shrink-0"
            style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
            size="icon"
          >
            <Send className="w-5 h-5 -rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NikaBubble({ message, onUpgrade }: { message: ChatMessageDto; onUpgrade: () => void }) {
  const isUser = message.role === "user";
  const time = new Date(message.createdAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
  const mentionsUpgrade = message.content.includes("پلن") && (message.content.includes("هوشمند") || message.content.includes("VIP") || message.content.includes("پیشرفته") || message.content.includes("حرفه‌ای"));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-start" : "justify-end"}`}
    >
      <div className={`max-w-[85%] ${isUser ? "order-2" : ""}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 justify-end">
            <span className="text-[10px] text-orange-400">نیکا</span>
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}>
              <Bot className="w-3 h-3 text-white" />
            </div>
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-primary text-primary-foreground rounded-bl-md"
              : "rounded-br-md border"
          } ${!isUser ? "border-orange-500/20" : ""}`}
          style={!isUser ? { background: "linear-gradient(135deg, rgba(251,146,60,0.08), rgba(254,215,170,0.04))" } : {}}
        >
          {message.content}
        </div>
        <div className={`text-[10px] text-muted-foreground mt-1 ${isUser ? "text-left" : "text-right"}`}>{time}</div>
        {!isUser && mentionsUpgrade && (
          <button
            onClick={onUpgrade}
            className="mt-2 w-full py-2 rounded-xl text-xs font-bold text-white transition hover:scale-[1.02]"
            style={{ background: "linear-gradient(135deg, #fb923c, #f97316)" }}
          >
            <ShoppingBag className="w-3.5 h-3.5 inline ml-1" />
            مشاهده و خرید پلن‌ها
          </button>
        )}
      </div>
    </motion.div>
  );
}

function NikaTyping() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
      <div className="rounded-2xl rounded-br-md border border-orange-500/20 px-4 py-3 flex items-center gap-1.5" style={{ background: "linear-gradient(135deg, rgba(251,146,60,0.08), rgba(254,215,170,0.04))" }}>
        <span className="typing-dot w-2 h-2 rounded-full bg-orange-400" />
        <span className="typing-dot w-2 h-2 rounded-full bg-orange-400" />
        <span className="typing-dot w-2 h-2 rounded-full bg-orange-400" />
      </div>
    </motion.div>
  );
}
