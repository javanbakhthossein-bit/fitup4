import { NextRequest } from "next/server";
import { nikaChat } from "@/lib/fitness/ai";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";
import type { Plan } from "@/lib/fitness/types";

/**
 * چت نیکا بدون نیاز به ثبت‌نام (حالت مهمان).
 * تاریخچه در body ارسال می‌شود (stateless) — کلاینت در localStorage نگه می‌دارد.
 *
 * ─── H2: محافظت‌های ضد سوءاستفاده (مسیر بدون auth → مبتنی بر IP) ───
 *  - rate-limit مبتنی بر IP: حداکثر ۸ درخواست در دقیقه (جلوگیری از تخلیه کریدیت AvalAI توسط بات‌ها)
 *  - سقف طول پیام: ۲۰۰۰ کاراکتر
 *  - فقط آخرین ۶ پیام تاریخچه به AI ارسال می‌شود (سقف کانتکست/هزینه)
 */

const GUEST_RATE_LIMIT = 8; // حداکثر درخواست در دقیقه برای هر IP
const MAX_MESSAGE_CHARS = 2000; // سقف طول پیام کاربر
const MAX_HISTORY_MESSAGES = 6; // فقط آخرین ۶ پیام تاریخچه به AI

export async function POST(req: NextRequest) {
  try {
    // ─── rate-limit مبتنی بر IP (مسیر بدون auth — هدف اصلی بات‌ها) ───
    const ip = getClientIp(req);
    const rl = rateLimit(`nika-guest:${ip}`, GUEST_RATE_LIMIT, 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    const { message, history, userPlan } = (await req.json()) as {
      message: string;
      history: { role: string; content: string }[];
      userPlan?: Plan | null;
    };

    if (!message || typeof message !== "string") {
      return Response.json({ error: "پیام خالی است." }, { status: 400 });
    }

    // ─── سقف طول پیام — جلوگیری از هزینه سنگین LLM ───
    if (message.length > MAX_MESSAGE_CHARS) {
      return Response.json(
        { error: "پیام بیش از حد طولانی است (حداکثر ۲۰۰۰ کاراکتر)." },
        { status: 400 }
      );
    }

    // ─── فقط آخرین ۶ پیام تاریخچه (سقف کانتکست/هزینه) ───
    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              typeof m.content === "string" &&
              (m.role === "user" || m.role === "assistant")
          )
          .slice(-MAX_HISTORY_MESSAGES)
          .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
      : [];

    const nikaResponse = await nikaChat(
      safeHistory,
      message,
      userPlan ?? null
    );

    return Response.json({
      nikaMessage: {
        id: `guest_${Date.now()}`,
        role: "assistant",
        content: nikaResponse,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطای ناشناخته";
    console.error("[Nika Guest Chat Error]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
