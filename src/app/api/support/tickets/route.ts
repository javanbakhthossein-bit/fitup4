import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

const VALID_CATEGORIES = ["general", "technical", "payment", "program", "bug"];
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];

interface TicketDto {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
  repliedAt: string | null;
  userId: string;
  user: {
    id: string;
    name: string | null;
    mobile: string;
    planName: string | null;
  };
  replies: Array<{
    id: string;
    role: string;
    message: string;
    createdAt: string;
    user: { id: string; name: string | null; mobile: string };
  }>;
}

function serializeTicket(t: any): TicketDto {
  return {
    id: t.id,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    message: t.message,
    adminReply: t.adminReply,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    repliedAt: t.repliedAt ? t.repliedAt.toISOString() : null,
    userId: t.userId,
    user: {
      id: t.user.id,
      name: t.user.name,
      mobile: t.user.mobile,
      planName: t.user.planName,
    },
    replies: (t.replies || []).map((r: any) => ({
      id: r.id,
      role: r.role,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      user: { id: r.user.id, name: r.user.name, mobile: r.user.mobile },
    })),
  };
}

/**
 * GET /api/support/tickets
 *  - regular user → only their own tickets
 *  - admin → all tickets
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const isAdmin = user.role === "ADMIN";

    const tickets = await db.supportTicket.findMany({
      where: isAdmin ? undefined : { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, mobile: true, planName: true },
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, mobile: true } },
          },
        },
      },
    });

    return Response.json({ tickets: tickets.map(serializeTicket) });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST /api/support/tickets
 *  - body: { subject, category, priority, message }
 *  - creates a new ticket + notifies all admins
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const subject = String(body?.subject || "").trim();
    const category = VALID_CATEGORIES.includes(body?.category)
      ? body.category
      : "general";
    const priority = VALID_PRIORITIES.includes(body?.priority)
      ? body.priority
      : "normal";
    const message = String(body?.message || "").trim();

    if (subject.length < 3) {
      return Response.json({ error: "موضوع باید حداقل ۳ کاراکتر باشد." }, { status: 400 });
    }
    if (message.length < 5) {
      return Response.json({ error: "متن پیام باید حداقل ۵ کاراکتر باشد." }, { status: 400 });
    }

    const ticket = await db.supportTicket.create({
      data: {
        userId: user.id,
        subject,
        category,
        priority,
        status: "open",
        message,
      },
      include: {
        user: { select: { id: true, name: true, mobile: true, planName: true } },
        replies: {
          include: { user: { select: { id: true, name: true, mobile: true } } },
        },
      },
    });

    // Notify all admins (users with role ADMIN) about the new ticket
    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (admins.length > 0) {
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "system",
          title: "تیکت پشتیبانی جدید 🎫",
          body: `${user.name || user.mobile}: ${subject}`,
          read: false,
        })),
      });
    }

    return Response.json({ ticket: serializeTicket(ticket) });
  } catch (e) {
    return apiError(e);
  }
}
