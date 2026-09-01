import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError, buildUserDto } from "@/lib/fitness/auth";
import { nikaChat } from "@/lib/fitness/ai";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";
import type { Plan } from "@/lib/fitness/types";

export async function GET() {
  try {
    const user = await requireAuth();
    // ─── H1: قبلاً asc + take 100 «قدیمی‌ترین» ۱۰۰ پیام را برمی‌گرداند — بعد از
    // ۱۰۰ پیام، پیام‌های جدید در تاریخچه هرگز نمایش داده نمی‌شدند. الگوی درست
    // (مثل POST): desc + take → آخرین پیام‌ها، سپس reverse برای ترتیب زمانی.
    const recentMessages = await db.nikaMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const messages = recentMessages.reverse();
    return Response.json({
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // ─── M6: محدودیت نرخ — ۵ پیام در دقیقه برای هر کاربر (مسیر guest همین‌طور
    // محدود است؛ مسیر auth شده هم کال LLM + ۳ کوئری DB است و نباید بی‌سقف باشد).
    const rl = rateLimit(`nika-chat:${user.id}`, 5, 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return Response.json({ error: "پیام خالی است." }, { status: 400 });
    }

    // ذخیره پیام کاربر
    const userMsg = await db.nikaMessage.create({
      data: { userId: user.id, role: "user", content: message },
    });

    // دریافت پلن کاربر
    const dto = await buildUserDto(user.id);
    const userPlan = (dto?.planName as Plan | null) ?? null;

    // دریافت اطلاعات کامل کاربر (برای شناخت کاربر توسط نیکا)
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: { name: true, mobile: true, planName: true, planExpiresAt: true, walletBalance: true },
    });
    const userInfo = {
      name: fullUser?.name || null,
      mobile: fullUser?.mobile || null,
      planName: fullUser?.planName || null,
      planExpiresAt: fullUser?.planExpiresAt?.toISOString() || null,
      walletBalance: fullUser?.walletBalance ?? 0,
    };

    // دریافت تاریخچه اخیر
    // ─── H3: قبلاً orderBy asc + take 20 «قدیمی‌ترین» ۲۰ پیام را می‌آورد (حافظه چت خراب بود).
    // الگوی درست: desc + take → آخرین پیام‌ها، سپس reverse برای ترتیب زمانی.
    // پیام جاری (userMsg) حذف می‌شود چون جداگانه به‌عنوان پیام آخر به nikaChat پاس داده می‌شود.
    const recentHistory = await db.nikaMessage.findMany({
      where: { userId: user.id, id: { not: userMsg.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const history = recentHistory.reverse();

    // دریافت پاسخ از نیکا
    const nikaResponse = await nikaChat(
      history.map((h) => ({ role: h.role, content: h.content })),
      message,
      userPlan,
      userInfo
    );

    // ذخیره پاسخ نیکا
    const nikaMsg = await db.nikaMessage.create({
      data: { userId: user.id, role: "assistant", content: nikaResponse },
    });

    return Response.json({
      userMessage: {
        id: userMsg.id,
        role: "user",
        content: userMsg.content,
        createdAt: userMsg.createdAt.toISOString(),
      },
      nikaMessage: {
        id: nikaMsg.id,
        role: "assistant",
        content: nikaMsg.content,
        createdAt: nikaMsg.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
