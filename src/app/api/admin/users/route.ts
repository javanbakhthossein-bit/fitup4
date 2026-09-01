import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    // پارس امن صفحه‌بندی — Number(abc) → NaN → skip/take نامعتبر و ۵۰۰ پراسیما (ممیزی 2-c)
    const page = Math.max(1, Math.floor(Number(searchParams.get("page") || 1) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(searchParams.get("pageSize") || 15) || 15)));
    const role = searchParams.get("role") || "";
    const plan = searchParams.get("plan") || "";
    const onboarding = searchParams.get("onboarding") || ""; // "done" | "pending" | ""
    const now = new Date();

    const where: any = {};
    if (search) {
      where.OR = [{ mobile: { contains: search } }, { name: { contains: search } }];
    }
    if (role && role !== "all") {
      where.role = role;
    }
    if (plan && plan !== "all") {
      if (plan === "none") {
        where.planName = null;
      } else {
        where.planName = plan;
      }
    }
    if (onboarding === "done") where.onboardingDone = true;
    if (onboarding === "pending") where.onboardingDone = false;

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          mobile: true,
          name: true,
          role: true,
          isBlocked: true,
          onboardingDone: true,
          createdAt: true,
          planName: true,
          walletBalance: true,
          planExpiresAt: true,
        },
      }),
    ]);

    // Attach active subscription info
    const userIds = users.map((u) => u.id);
    const subs = await db.subscription.findMany({
      where: { userId: { in: userIds }, status: "active", endDate: { gt: now } },
    });
    const subMap = new Map(subs.map((s) => [s.userId, s]));

    return Response.json({
      total,
      page,
      pageSize,
      users: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        planExpiresAt: u.planExpiresAt?.toISOString() ?? null,
        hasActiveSubscription: subMap.has(u.id),
        subscriptionEnd: subMap.get(u.id)?.endDate?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

// Block / unblock / delete user
// شماره موبایل سوپرادمین — همان ثابت permissions/route.ts
const SUPER_ADMIN_MOBILE = "09300083803";

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { userId, action } = await req.json();
    if (userId === admin.id) {
      return Response.json({ error: "نمی‌توانید حساب خود را تغییر دهید." }, { status: 400 });
    }
    if (action === "block") {
      await db.user.update({ where: { id: userId }, data: { isBlocked: true } });
    } else if (action === "unblock") {
      await db.user.update({ where: { id: userId }, data: { isBlocked: false } });
    } else if (action === "makeAdmin") {
      // امنیت (ممیزی 2-c P1): ارتقای کاربر به ادمین فقط توسط سوپرادمین.
      // نکته‌ی طراحی: طبق permissions/route.ts:61-72 اگر رکورد AdminPermission برای
      // ادمین جدید وجود نداشته باشد، همه‌ی دسترسی‌ها ALL_TRUE فرض می‌شود (سبک مالک).
      // یعنی makeAdmin توسط هر ادمینی = ساخت ادمینِ دسترسی‌کامل (stealth escalation).
      // رکورد AdminPermission خالی هم ساخته نمی‌شود چون آن‌جا قفل کامل می‌شود؛
      // پس محدودسازی درستِ حداقلی این است که فقط سوپرادمین بتواند ادمین کند.
      if (admin.mobile !== SUPER_ADMIN_MOBILE) {
        return Response.json(
          { error: "ارتقای کاربر به ادمین فقط توسط سوپرادمین مجاز است." },
          { status: 403 }
        );
      }
      await db.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
    } else if (action === "makeUser") {
      await db.user.update({ where: { id: userId }, data: { role: "USER" } });
    }
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");
    if (!userId) return Response.json({ error: "ID نیاز است." }, { status: 400 });
    if (userId === admin.id) {
      return Response.json({ error: "نمی‌توانید خود را حذف کنید." }, { status: 400 });
    }
    // گارد مالی (ممیزی 2-c P2): رکوردهای Payment/Subscription/WalletTransaction با
    // onDelete: Cascade هستند — حذف کاربر تاریخچه‌ی مالی قانونی را برای همیشه پاک می‌کند.
    const [paymentCount, subCount, walletCount] = await Promise.all([
      db.payment.count({ where: { userId } }),
      db.subscription.count({ where: { userId } }),
      db.walletTransaction.count({ where: { userId } }),
    ]);
    if (paymentCount + subCount + walletCount > 0) {
      return Response.json(
        {
          error:
            "این کاربر سابقه مالی دارد — به‌جای حذف، مسدودش کنید (رکوردهای مالی قانونی باید بمانند)",
        },
        { status: 400 }
      );
    }
    await db.user.delete({ where: { id: userId } });
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
