"use client";

import { useAppStore } from "@/lib/fitness/store";
import { SmartCoachChatView } from "@/components/fitness/views/smart-coach-chat-view";
import { NikaChatView } from "@/components/fitness/views/nika-chat-view";

/**
 * تب «چت با فیتاپ» — بر اساس chatMode از store یکی از دو چت را رندر می‌کند:
 * - "coach" (پیش‌فرض): مربی هوشمند فیتاپ (SmartCoachChatView)
 * - "nika": دستیار فروش/پشتیبانی (NikaChatView) — دکمه «رفتن به چت نیکا»
 *   در SmartCoachChatView (برای کاربران بدون دسترسی مربی) این حالت را فعال می‌کند.
 * قبلاً chatMode فقط نوشته می‌شد و هیچ‌کس نمی‌خواندش (دکمه مرده).
 */
export function ChatView() {
  const chatMode = useAppStore((s) => s.chatMode);

  if (chatMode === "nika") {
    return <NikaChatView showBackToCoach />;
  }

  return <SmartCoachChatView />;
}
