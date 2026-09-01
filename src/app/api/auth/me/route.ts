import { cookies } from "next/headers";
import { getCurrentUser, apiError, buildUserDto } from "@/lib/fitness/auth";
import { db } from "@/lib/db";

// Marker cookie name — must match the one set in lib/fitness/auth.ts
const TERMS_PENDING_COOKIE = "sc_terms_pending";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const cookieStore = await cookies();
    // NOTE: next/headers cookies() reflects mutations done within the same
    // request (e.g. by getCurrentUser), so this read picks up the marker
    // cookie even if it was just set in this same request.
    const termsPending = cookieStore.get(TERMS_PENDING_COOKIE)?.value === "1";

    if (!user) {
      // If the marker cookie is set, the user was logged out due to
      // outdated TermsVersion — tell the frontend to show the modal.
      if (termsPending) {
        return Response.json(
          { user: null, termsUpdateRequired: true },
          { status: 200 }
        );
      }
      return Response.json({ user: null }, { status: 200 });
    }
    const dto = await buildUserDto(user.id);

    // ─── لمس آخرین فعالیت کاربر (رفع ریشه‌ای نوتیف «چند روزی نیستی») ───
    // /api/auth/me در هر باز شدن اپ/سایت صدا زده می‌شود — بهترین سیگنال
    // «کاربر آنلاین است». نوشتن با throttle انجام می‌شود (حداکثر هر ۳۰ دقیقه
    // یکبار) تا DB در هر بازدید write نگیرد. سناریو re_engagement در
    // cron رفتاری از همین فیلد می‌فهمد کاربر مداوم از اپ استفاده می‌کند.
    try {
      const stale =
        !user.lastActiveAt ||
        Date.now() - new Date(user.lastActiveAt).getTime() > 30 * 60 * 1000;
      if (stale) {
        await db.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        });
      }
    } catch {
      // نباید جریان auth را بشکند
    }

    return Response.json({ user: dto });
  } catch (e) {
    return apiError(e);
  }
}
