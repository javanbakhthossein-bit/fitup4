import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

const SUPER_ADMIN_MOBILE = "09300083803";

// تمام دسترسی‌های ممکن — در صورت نبود رکورد AdminPermission (مثل سوپرادمین) همه true برمی‌گردد
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

const ALL_TRUE: Record<PermissionKey, boolean> = {
  canViewDashboard: true,
  canManageUsers: true,
  canViewFinance: true,
  canManagePrograms: true,
  canManageCheckups: true,
  canManageArticles: true,
  canManageHeadCodes: true,
  canManageTerms: true,
  canUseCopilot: true,
  canManageAdmins: true,
  canManageTickets: true,
};

/**
 * GET /api/admin/permissions — دسترسی‌های ادمین فعلی
 *  - اگر رکورد AdminPermission نبود (سوپرادمین یا ادمین قدیمی)، همه true برمی‌گردد
 *  - این endpoint فقط ادمین‌ها می‌توانند صدا بزنند
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    const isSuper = admin.mobile === SUPER_ADMIN_MOBILE;

    if (isSuper) {
      return Response.json({
        permissions: { ...ALL_TRUE },
        isSuperAdmin: true,
        admin: {
          id: admin.id,
          mobile: admin.mobile,
          name: admin.name,
        },
      });
    }

    const perm = await db.adminPermission.findUnique({ where: { userId: admin.id } });

    // اگر ادمین است ولی رکورد AdminPermission ندارد، یعنی ادمین قدیمی یا بدون محدودیت
    if (!perm) {
      return Response.json({
        permissions: { ...ALL_TRUE },
        isSuperAdmin: false,
        admin: {
          id: admin.id,
          mobile: admin.mobile,
          name: admin.name,
        },
      });
    }

    return Response.json({
      permissions: {
        canViewDashboard: perm.canViewDashboard,
        canManageUsers: perm.canManageUsers,
        canViewFinance: perm.canViewFinance,
        canManagePrograms: perm.canManagePrograms,
        canManageCheckups: perm.canManageCheckups,
        canManageArticles: perm.canManageArticles,
        canManageHeadCodes: perm.canManageHeadCodes,
        canManageTerms: perm.canManageTerms,
        canUseCopilot: perm.canUseCopilot,
        canManageAdmins: perm.canManageAdmins,
        canManageTickets: perm.canManageTickets,
      },
      isSuperAdmin: false,
      admin: {
        id: admin.id,
        mobile: admin.mobile,
        name: admin.name,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
