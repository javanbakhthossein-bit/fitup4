import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError, validateMobile } from "@/lib/fitness/auth";

// Super admin mobile — has every permission implicitly
const SUPER_ADMIN_MOBILE = "09300083803";
const ADMIN_PLAN = "ultimate";
const ADMIN_PLAN_DURATION_DAYS = 365; // 1 year
const ADMIN_WALLET_BALANCE = 10_000_000; // 10 million Toman

// All permission fields kept on AdminPermission
const ALL_PERMISSION_KEYS = [
  "canViewDashboard",
  "canManageUsers",
  "canViewFinance",
  "canManagePrograms",
  "canManageCheckups",
  "canManageArticles",
  "canManageHeadCodes",
  "canManageTerms",
  "canUseCopilot",
  "canManageAdmins",
  "canManageTickets",
] as const;

type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

function coercePermissions(input: any) {
  const out: Record<PermissionKey, boolean> = {
    canViewDashboard: true,
    canManageUsers: false,
    canViewFinance: false,
    canManagePrograms: false,
    canManageCheckups: false,
    canManageArticles: false,
    canManageHeadCodes: false,
    canManageTerms: false,
    canUseCopilot: false,
    canManageAdmins: false,
    canManageTickets: false,
  };
  if (input && typeof input === "object") {
    for (const k of ALL_PERMISSION_KEYS) {
      if (typeof input[k] === "boolean") out[k] = input[k];
    }
  }
  return out;
}

async function ensureAdminPerks(userId: string, now: Date) {
  const endDate = new Date(now.getTime() + ADMIN_PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await db.user.update({
    where: { id: userId },
    data: {
      role: "ADMIN",
      onboardingDone: true,
      walletBalance: ADMIN_WALLET_BALANCE,
      planName: ADMIN_PLAN,
      planStartedAt: now,
      planExpiresAt: endDate,
    },
  });
  const existingSub = await db.subscription.findFirst({
    where: { userId, status: "active", plan: ADMIN_PLAN, endDate: { gt: now } },
    orderBy: { endDate: "desc" },
  });
  if (!existingSub) {
    await db.subscription.create({
      data: {
        userId,
        plan: ADMIN_PLAN,
        status: "active",
        startDate: now,
        endDate,
        durationDays: ADMIN_PLAN_DURATION_DAYS,
        pricePaid: 0,
      },
    });
  }
}

/**
 * GET /api/admin/admins — لیست همه ادمین‌ها با دسترسی‌هایشان
 * فقط ادمین‌هایی که دسترسی canManageAdmins دارند (یا سوپرادمین) می‌توانند این لیست را ببینند.
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    const isSuper = admin.mobile === SUPER_ADMIN_MOBILE;
    if (!isSuper) {
      const perm = await db.adminPermission.findUnique({ where: { userId: admin.id } });
      if (!perm || !perm.canManageAdmins) {
        return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
      }
    }

    const admins = await db.user.findMany({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        mobile: true,
        name: true,
        role: true,
        createdAt: true,
        adminPermissions: true,
      },
    });

    return Response.json({
      admins: admins.map((a) => ({
        id: a.id,
        mobile: a.mobile,
        name: a.name,
        role: a.role,
        createdAt: a.createdAt.toISOString(),
        isSuperAdmin: a.mobile === SUPER_ADMIN_MOBILE,
        permissions: a.adminPermissions
          ? {
              canViewDashboard: a.adminPermissions.canViewDashboard,
              canManageUsers: a.adminPermissions.canManageUsers,
              canViewFinance: a.adminPermissions.canViewFinance,
              canManagePrograms: a.adminPermissions.canManagePrograms,
              canManageCheckups: a.adminPermissions.canManageCheckups,
              canManageArticles: a.adminPermissions.canManageArticles,
              canManageHeadCodes: a.adminPermissions.canManageHeadCodes,
              canManageTerms: a.adminPermissions.canManageTerms,
              canUseCopilot: a.adminPermissions.canUseCopilot,
              canManageAdmins: a.adminPermissions.canManageAdmins,
              canManageTickets: a.adminPermissions.canManageTickets,
            }
          : null,
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * POST /api/admin/admins — ایجاد ادمین جدید (یا ارتقای کاربر موجود به ادمین)
 * Body: { mobile, name?, permissions }
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const isSuper = admin.mobile === SUPER_ADMIN_MOBILE;
    if (!isSuper) {
      const perm = await db.adminPermission.findUnique({ where: { userId: admin.id } });
      if (!perm || !perm.canManageAdmins) {
        return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const mobile = String(body?.mobile || "").replace(/\s/g, "");
    const name = body?.name ? String(body.name).trim() : null;

    if (!validateMobile(mobile)) {
      return Response.json({ error: "شماره موبایل نامعتبر است." }, { status: 400 });
    }
    if (mobile === SUPER_ADMIN_MOBILE) {
      return Response.json({ error: "این شماره سوپرادمین است و قابل تغییر نیست." }, { status: 400 });
    }

    const permissions = coercePermissions(body?.permissions);

    // اگر کاربر می‌خواهد دسترسی canManageAdmins=true بدهد، فقط سوپرادمین می‌تواند
    if (permissions.canManageAdmins && !isSuper) {
      return Response.json(
        { error: "فقط سوپرادمین می‌تواند دسترسی مدیریت ادمین‌ها را بدهد." },
        { status: 403 }
      );
    }

    const now = new Date();
    let user = await db.user.findUnique({ where: { mobile } });
    const isNew = !user;

    if (isNew) {
      const activeTerms = await db.termsVersion.findFirst({
        where: { isActive: true },
        orderBy: { version: "desc" },
      });
      user = await db.user.create({
        data: {
          mobile,
          passwordHash: "",
          name: name || null,
          role: "ADMIN",
          onboardingDone: true,
          acceptedTermsVersion: activeTerms?.version ?? null,
        },
      });
    } else if (user) {
      await db.user.update({
        where: { id: user.id },
        data: { role: "ADMIN", name: name || user.name },
      });
    }
    // پس از create، user قطعاً non-null است — برای TS متغیر مجدد مقداردهی می‌کنیم
    const adminUser = user!;

    // Admin perks: ultimate plan + wallet 10,000,000
    await ensureAdminPerks(adminUser.id, now);

    // Upsert AdminPermission
    const existing = await db.adminPermission.findUnique({ where: { userId: adminUser.id } });
    let permRecord;
    if (existing) {
      permRecord = await db.adminPermission.update({
        where: { userId: adminUser.id },
        data: permissions,
      });
    } else {
      permRecord = await db.adminPermission.create({
        data: { userId: adminUser.id, ...permissions },
      });
    }

    // Notification to the new admin
    await db.notification.create({
      data: {
        userId: adminUser.id,
        type: "system",
        title: "دسترسی ادمین فعال شد 🛡️",
        body: `شما به‌عنوان ادمین به پنل مدیریت فیتاپ دسترسی یافتید. توسط ${admin.name || admin.mobile} اضافه شدید.`,
        read: false,
      },
    });

    return Response.json({
      ok: true,
      admin: {
        id: adminUser.id,
        mobile: adminUser.mobile,
        name: adminUser.name,
        role: "ADMIN",
        createdAt: adminUser.createdAt.toISOString(),
        isSuperAdmin: false,
        permissions: {
          canViewDashboard: permRecord.canViewDashboard,
          canManageUsers: permRecord.canManageUsers,
          canViewFinance: permRecord.canViewFinance,
          canManagePrograms: permRecord.canManagePrograms,
          canManageCheckups: permRecord.canManageCheckups,
          canManageArticles: permRecord.canManageArticles,
          canManageHeadCodes: permRecord.canManageHeadCodes,
          canManageTerms: permRecord.canManageTerms,
          canUseCopilot: permRecord.canUseCopilot,
          canManageAdmins: permRecord.canManageAdmins,
          canManageTickets: permRecord.canManageTickets,
        },
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
