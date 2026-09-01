import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  validateMobile,
  setSession,
  apiError,
  buildUserDto,
  getCurrentTermsVersion,
  clearTermsPendingCookie,
} from "@/lib/fitness/auth";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mobile = String(body.mobile || "").replace(/\s/g, "");
    const password = String(body.password || "");

    if (!validateMobile(mobile)) {
      return Response.json(
        { error: "شماره موبایل نامعتبر است." },
        { status: 400 }
      );
    }

    // ─── Rate limit (ضد brute-force) ───
    // ترکیب IP + شماره موبایل — ۵ تلاش در هر ۱۰ دقیقه
    const ip = getClientIp(req);
    const rl = rateLimit(`login:${ip}:${mobile}`, 5, 10 * 60 * 1000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    // پیام خطا برای «کاربر پیدا نشد» و «رمز اشتباه» یکسان است تا
    // Enumeration شماره‌های ثبت‌شده ممکن نباشد.
    const GENERIC_LOGIN_ERROR = "شماره موبایل یا رمز عبور اشتباه است.";

    const user = await db.user.findUnique({ where: { mobile } });
    if (!user) {
      return Response.json(
        { error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }
    if (user.isBlocked) {
      return Response.json(
        { error: "حساب کاربری شما مسدود شده است. با پشتیبانی تماس بگیرید." },
        { status: 403 }
      );
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return Response.json(
        { error: GENERIC_LOGIN_ERROR },
        { status: 401 }
      );
    }

    // Bump acceptedTermsVersion if outdated (login = implicit consent to current terms)
    const currentTermsVersion = await getCurrentTermsVersion();
    if (currentTermsVersion > 0 && (user.acceptedTermsVersion ?? 0) < currentTermsVersion) {
      await db.user.update({
        where: { id: user.id },
        data: { acceptedTermsVersion: currentTermsVersion },
      });
    }
    // Clear the terms-pending marker cookie (if any)
    await clearTermsPendingCookie();

    await setSession(user.id);
    const dto = await buildUserDto(user.id);
    return Response.json(dto);
  } catch (e) {
    return apiError(e);
  }
}
