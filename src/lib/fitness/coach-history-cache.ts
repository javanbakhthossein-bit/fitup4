"use client";

import type { ChatMessageDto } from "@/lib/fitness/types";

/**
 * کش تاریخچه چت مربی هوشمند در LocalStorage — تفکیک‌شده بر اساس هر دوره برنامه.
 * کلید: fitap_coach_history_<programCycle>
 */

const PREFIX = "fitap_coach_history_";

export function getCurrentProgramCycle(): string {
  // شناسه دوره = تاریخ شروع پلن فعلی یا تاریخ امروز
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem("fitap_current_cycle");
  if (stored) return stored;
  const cycle = `cycle_${new Date().toISOString().slice(0, 10)}`;
  localStorage.setItem("fitap_current_cycle", cycle);
  return cycle;
}

export function setProgramCycle(cycle: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("fitap_current_cycle", cycle);
}

export function cacheCoachHistory(cycle: string, messages: ChatMessageDto[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + cycle, JSON.stringify(messages.slice(-100)));
  } catch {}
}

export function getCachedCoachHistory(cycle: string): ChatMessageDto[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFIX + cycle);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getAllCycles(): string[] {
  if (typeof window === "undefined") return [];
  const cycles: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      cycles.push(key.replace(PREFIX, ""));
    }
  }
  return cycles.sort().reverse();
}

export function clearCycleHistory(cycle: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PREFIX + cycle);
}
