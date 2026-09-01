"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/fitness/store";
import { fetchJson, fetchJsonOrThrow } from "@/lib/fitness/fetch-json";
import type { ChatMessageDto, Plan } from "@/lib/fitness/types";

const GUEST_STORAGE_KEY = "fitap_nika_guest_history";

/**
 * هوک مشترک برای چت نیکا — هم در ویجت شناور و هم در نمای چت استفاده می‌شود.
 * اگر کاربر وارد شده باشد: تاریخچه از دیتابیس (store).
 * اگر مهمان باشد: تاریخچه در localStorage + API مهمان.
 */
export function useNikaChat() {
  const { user, nikaMessages, setNikaMessages, addNikaMessage } = useAppStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [guestMessages, setGuestMessages] = useState<ChatMessageDto[]>([]);

  const isGuest = !user;

  useEffect(() => {
    if (isGuest) {
      // حالت مهمان: بارگذاری از localStorage
      try {
        const stored = localStorage.getItem(GUEST_STORAGE_KEY);
        if (stored) setGuestMessages(JSON.parse(stored));
      } catch {}
      setLoading(false);
      return;
    }
    // کاربر وارد شده: بارگذاری از API
    if (nikaMessages.length > 0) {
      setLoading(false);
      return;
    }
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
  }, [isGuest]);

  function persistGuest(msgs: ChatMessageDto[]) {
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(msgs.slice(-50)));
    } catch {}
  }

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);

    const tempUserMsg: ChatMessageDto = {
      id: `temp_${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };

    if (isGuest) {
      // حالت مهمان
      const newMsgs = [...guestMessages, tempUserMsg];
      setGuestMessages(newMsgs);
      persistGuest(newMsgs);

      try {
        // fetchJsonOrThrow: پاسخ HTML (۵۰۲ گیت‌وی) → «ارتباط با سرور برقرار نشد...»
        // به‌جای «Unexpected token '<'» که برای کاربر فارسی‌زبان بی‌معنی است
        const data = await fetchJsonOrThrow<any>(
          "/api/nika/guest-chat",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              history: newMsgs.slice(-10).map((m) => ({ role: m.role, content: m.content })),
              userPlan: null,
            }),
          },
          "خطا در ارتباط با سرور"
        );
        const updated = [...newMsgs.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, data.nikaMessage];
        setGuestMessages(updated);
        persistGuest(updated);
      } catch (e) {
        const updated = newMsgs.filter((m) => m.id !== tempUserMsg.id);
        setGuestMessages(updated);
        persistGuest(updated);
        const errMsg = e instanceof Error ? e.message : "خطا در ارتباط با سرور";
        const errMessages: ChatMessageDto[] = [...updated, {
          id: `err_${Date.now()}`,
          role: "assistant" as const,
          content: `⚠️ ${errMsg}. دوباره تلاش کنید.`,
          createdAt: new Date().toISOString(),
        }];
        setGuestMessages(errMessages);
        persistGuest(errMessages);
      } finally {
        setSending(false);
      }
      return;
    }

    // کاربر وارد شده
    addNikaMessage(tempUserMsg);
    try {
      // fetchJsonOrThrow: پاسخ HTML (۵۰۲ گیت‌وی/سرور در حال ری‌استارت) → پیام
      // فارسی «ارتباط با سرور برقرار نشد...» داخل چت نشان داده می‌شود
      const data = await fetchJsonOrThrow<any>(
        "/api/nika/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
        "خطا در ارتباط با سرور"
      );
      const current = useAppStore.getState().nikaMessages;
      setNikaMessages([
        ...current.filter((m) => m.id !== tempUserMsg.id),
        data.userMessage,
        data.nikaMessage,
      ]);
    } catch (e) {
      const current = useAppStore.getState().nikaMessages;
      setNikaMessages(current.filter((m) => m.id !== tempUserMsg.id));
      const errMsg = e instanceof Error ? e.message : "خطا در ارتباط با سرور";
      addNikaMessage({
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `⚠️ ${errMsg}. دوباره تلاش کنید.`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  }

  const messages = isGuest ? guestMessages : nikaMessages;
  return { messages, loading, sending, send, input, setInput, isGuest };
}
