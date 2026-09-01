import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

const SUPER_ADMIN_MOBILE = "09300083803";

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

/**
 * PATCH /api/admin/admins/[id]
 *  - body: { permissions } | { name }
 *  - requires canManageAdmins (or super admin)
 *  - cannot modify super admin (mobile 09300083803)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();
    const isSuper = admin.mobile === SUPER_ADMIN_MOBILE;
    if (!isSuper) {
      const perm = await db.adminPermission.findUnique({ where: { userId: admin.id } });
      if (!perm || !perm.canManageAdmins) {
        return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
      }
    }

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return Response.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }
    if (target.mobile === SUPER_ADMIN_MOBILE) {
      return Response.json(
        { error: "سوپرادمین قابل ویرایش نیست." },
        { status: 400 }
      );
    }
    if (target.role !== "ADMIN") {
      return Response.json({ error: "این کاربر ادمین نیست." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // Update name if provided
    if (typeof body?.name === "string" && body.name.trim()) {
      await db.user.update({ where: { id }, data: { name: body.name.trim() } });
    }

    // Update permissions if provided
    if (body?.permissions && typeof body.permissions === "object") {
      const permissions = coercePermissions(body.permissions);

      // فقط سوپرادمین می‌تواند دسترسی canManageAdmins بدهد
      if (permissions.canManageAdmins && !isSuper) {
        return Response.json(
          { error: "فقط سوپرادمین می‌تواند دسترسی مدیریت ادمین‌ها را بدهد." },
          { status: 403 }
        );
      }

      const existing = await db.adminPermission.findUnique({ where: { userId: id } });
      if (existing) {
        await db.adminPermission.update({ where: { userId: id }, data: permissions });
      } else {
        await db.adminPermission.create({ data: { userId: id, ...permissions } });
      }

      // Notify the target admin about the change
      await db.notification.create({
        data: {
          userId: id,
          type: "system",
          title: "دسترسی‌های شما به‌روزرسانی شد ⚙️",
          body: `دسترسی‌های پنل مدیریت شما توسط ${admin.name || admin.mobile} به‌روزرسانی شد.`,
          read: false,
        },
      });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * DELETE /api/admin/admins/[id]
 *  - remove admin role (set back to USER), delete AdminPermission record
 *  - cannot delete super admin or self
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const admin = await requireAdmin();
    const isSuper = admin.mobile === SUPER_ADMIN_MOBILE;
    if (!isSuper) {
      const perm = await db.adminPermission.findUnique({ where: { userId: admin.id } });
      if (!perm || !perm.canManageAdmins) {
        return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
      }
    }

    if (id === admin.id) {
      return Response.json({ error: "نمی‌توانید دسترسی خودتان را حذف کنید." }, { status: 400 });
    }

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return Response.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }
    if (target.mobile === SUPER_ADMIN_MOBILE) {
      return Response.json({ error: "سوپرادمین قابل حذف نیست." }, { status: 400 });
    }
    if (target.role !== "ADMIN") {
      return Response.json({ error: "این کاربر ادمین نیست." }, { status: 400 });
    }

    // حذف رکورد دسترسی‌ها + بازگرداندن نقش به USER
    await db.adminPermission.deleteMany({ where: { userId: id } });
    await db.user.update({ where: { id }, data: { role: "USER" } });

    // Notify the user about removal
    await db.notification.create({
      data: {
        userId: id,
        type: "system",
        title: "دسترسی ادمین شما لغو شد",
        body: `دسترسی پنل مدیریت شما توسط ${admin.name || admin.mobile} لغو شد. در صورت اشتباه بودن با پشتیبانی تماس بگیرید.`,
        read: false,
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
