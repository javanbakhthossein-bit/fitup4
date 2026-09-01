import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, apiError } from "@/lib/fitness/auth";

/**
 * POST /api/pwa/installed
 * ثبت نصب برنامه PWA روی دستگاه کاربر.
 * این endpoint باید از frontend هنگام appinstalled event صدا زده شود.
 *
 * مهم: اگر کاربر لاگین نشده باشد، 200 برمی‌گرداند (نه 401) تا Googlebot
 * خطای 401 در Search Console نداشته باشد. برای کاربران لاگین‌نشده،
 * وضعیت نصب در localStorage ذخیره می‌شود و پس از لاگین همگام‌سازی خواهد شد.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    // اگر کاربر لاگین نشده، موفقیت‌آمیز برگردان (fire-and-forget)
    if (!user) {
      return NextResponse.json({ ok: true, installed: true, anonymous: true });
    }

    // فقط اگر قبلاً ثبت نشده بود، ثبت کن
    if (!user.pwaInstalledAt) {
      await db.user.update({
        where: { id: user.id },
        data: { pwaInstalledAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true, installed: true });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * GET /api/pwa/installed
 * بررسی اینکه آیا کاربر برنامه را نصب کرده یا نه.
 *
 * مهم: برای کاربران لاگین‌نشده (از جمله Googlebot) 200 برمی‌گرداند
 * با installed=false تا خطای 401 در Search Console نداشته باشیم.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ installed: false });
    }

    return NextResponse.json({ installed: !!user.pwaInstalledAt });
  } catch (e) {
    return apiError(e);
  }
}
