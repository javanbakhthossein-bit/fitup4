import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

const VALID_STATUSES = ["open", "answered", "closed"];

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

async function loadTicket(id: string) {
  return db.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, mobile: true, planName: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, mobile: true } } },
      },
    },
  });
}

/**
 * GET /api/support/tickets/[id]
 *  - regular user → can only read their own ticket
 *  - admin → can read any ticket
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const isAdmin = user.role === "ADMIN";

    const ticket = await loadTicket(id);
    if (!ticket) {
      return Response.json({ error: "تیکت یافت نشد." }, { status: 404 });
    }
    if (!isAdmin && ticket.userId !== user.id) {
      return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
    }

    return Response.json({ ticket: serializeTicket(ticket) });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST /api/support/tickets/[id] — reply to a ticket
 *  - body: { message }
 *  - admin: status -> "answered", notify the ticket owner
 *  - user: status -> "open" (re-open), notify all admins
 *    اگر تیکت بسته باشد، پاسخ مالک تیکت را دوباره باز می‌کند (auto-reopen) —
 *    PATCH فقط برای ادمین است و بدون این، مالک در بن‌بست کامل قرار می‌گرفت.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const isAdmin = user.role === "ADMIN";

    const ticket = await loadTicket(id);
    if (!ticket) {
      return Response.json({ error: "تیکت یافت نشد." }, { status: 404 });
    }
    if (!isAdmin && ticket.userId !== user.id) {
      return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
    }
    // پاسخ مالک تیکتِ بسته = بازگشایی خودکار تیکت (FIX: بن‌بست reopen).
    // PATCH status برای غیرادمین مجاز نیست؛ پس ارسال پیام روی تیکت بسته،
    // تیکت را reopen می‌کند و در ادامه نوتیفیکیشن ادمین‌ها «بازگشایی» را ذکر می‌کند.
    const reopenedByOwner = !isAdmin && ticket.status === "closed";

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").trim();
    if (message.length < 1) {
      return Response.json({ error: "متن پاسخ خالی است." }, { status: 400 });
    }

    const now = new Date();

    // ایجاد پاسخ
    const reply = await db.ticketReply.create({
      data: {
        ticketId: id,
        userId: user.id,
        role: isAdmin ? "admin" : "user",
        message,
      },
    });

    // به‌روزرسانی وضعیت تیکت
    const newStatus = isAdmin ? "answered" : "open";
    await db.supportTicket.update({
      where: { id },
      data: isAdmin
        ? {
            status: newStatus,
            adminReply: message,
            repliedById: user.id,
            repliedAt: now,
          }
        : {
            status: newStatus,
          },
    });

    // نوتیفیکیشن به طرف مقابل
    if (isAdmin) {
      // ادمین پاسخ داده → مالک تیکت را خبردار کن
      await db.notification.create({
        data: {
          userId: ticket.userId,
          type: "system",
          title: "پاسخ جدید به تیکت شما 💬",
          body: `پاسخ پشتیبانی به «${ticket.subject}»: ${message.slice(0, 100)}`,
          read: false,
        },
      });
    } else {
      // کاربر پاسخ داده → همه ادمین‌ها را خبردار کن
      const admins = await db.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      if (admins.length > 0) {
        await db.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: "system",
            title: reopenedByOwner ? "تیکت بسته بازگشایی شد 🎫" : "پاسخ جدید به تیکت 🎫",
            body: reopenedByOwner
              ? `${user.name || user.mobile} به تیکت بسته‌شده «${ticket.subject}» پاسخ داد و آن را دوباره باز کرد`
              : `${user.name || user.mobile} به تیکت «${ticket.subject}» پاسخ داد`,
            read: false,
          })),
        });
      }
    }

    const fresh = await loadTicket(id);
    return Response.json({ ticket: serializeTicket(fresh), replyId: reply.id });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * PATCH /api/support/tickets/[id] — change ticket status (admin only)
 *  - body: { status: "open" | "answered" | "closed" }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body?.status || "").toLowerCase();
    if (!VALID_STATUSES.includes(status)) {
      return Response.json(
        { error: "وضعیت نامعتبر است. باید یکی از باز/پاسخ‌داده‌شده/بسته باشد." },
        { status: 400 }
      );
    }

    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      return Response.json({ error: "تیکت یافت نشد." }, { status: 404 });
    }

    await db.supportTicket.update({
      where: { id },
      data: { status },
    });

    // Notify the ticket owner about the status change
    const statusLabel =
      status === "open" ? "باز شد" : status === "answered" ? "پاسخ داده شد" : "بسته شد";
    await db.notification.create({
      data: {
        userId: ticket.userId,
        type: "system",
        title: `تیکت شما ${statusLabel}`,
        body: `وضعیت تیکت «${ticket.subject}» به ${statusLabel} تغییر یافت.`,
        read: false,
      },
    });

    const fresh = await loadTicket(id);
    return Response.json({ ticket: serializeTicket(fresh) });
  } catch (e) {
    return apiError(e);
  }
}
