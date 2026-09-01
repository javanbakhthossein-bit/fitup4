import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { adminCopilotChat } from "@/lib/fitness/ai";

// POST /api/admin/copilot — admin AI copilot chat (stateless, history sent in body)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { message, history } = await req.json();
    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json({ error: "پیام خالی است." }, { status: 400 });
    }

    // Live site stats context
    const now = new Date();
    const [totalUsers, revenueAgg, activeSubs, pendingPrograms] = await Promise.all([
      db.user.count(),
      db.payment.aggregate({ where: { status: "success" }, _sum: { amount: true } }),
      db.subscription.count({ where: { status: "active", endDate: { gt: now } } }),
      db.programRequest.count({ where: { status: "pending" } }),
    ]);
    const totalRevenue = revenueAgg._sum.amount || 0;

    // Sanitize history
    const safeHistory: { role: string; content: string }[] = Array.isArray(history)
      ? history
          .filter(
            (m: any) =>
              m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
          )
          .slice(-20)
          .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
      : [];

    const reply = await adminCopilotChat(safeHistory, message.trim(), {
      totalUsers,
      totalRevenue,
      activeSubs,
      pendingPrograms,
    });

    return Response.json({
      reply,
      context: { totalUsers, totalRevenue, activeSubs, pendingPrograms },
    });
  } catch (e) {
    return apiError(e);
  }
}
