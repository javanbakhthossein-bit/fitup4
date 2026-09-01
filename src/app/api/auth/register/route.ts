import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  validateMobile,
  validatePassword,
  setSession,
  apiError,
} from "@/lib/fitness/auth";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * ثبت‌نام با رمز عبور — مسیر legacy.
 *
 * ⛔ به‌طور پیش‌فرض غیرفعال است (ENABLE_PASSWORD_REGISTER !== "true"):
 * ثبت‌نام بدون اثبات مالکیت شماره موبایل، امکان «squat» کردن حساب قربانی را
 * می‌دهد. مسیر اصلی ثبت‌نام سایت، جریان OTP (send-otp + verify-otp) است.
 * برای فعال‌سازی این مسیر (فقط برای سازگاری legacy)، متغیر محیطی
 * ENABLE_PASSWORD_REGISTER=true را تنظیم کنید.
 */
export async function POST(req: NextRequest) {
  try {
    // ─── Rate limit (per-IP) — ۵ درخواست در ساعت ───
    const ip = getClientIp(req);
    const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    // ─── گیت محیطی: ثبت‌نام با رمز فقط با فعال‌سازی صریح ───
    if (process.env.ENABLE_PASSWORD_REGISTER !== "true") {
      return Response.json(
        { error: "ثبت‌نام فقط از طریق کد پیامکی امکان‌پذیر است." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const mobile = String(body.mobile || "").replace(/\s/g, "");
    const password = String(body.password || "");
    const name = body.name ? String(body.name) : null;
    const acceptedTerms = Boolean(body.acceptedTerms);

    if (!validateMobile(mobile)) {
      return Response.json(
        { error: "شماره موبایل نامعتبر است. مثال: 09123456789" },
        { status: 400 }
      );
    }
    if (!validatePassword(password)) {
      return Response.json(
        { error: "رمز عبور باید حداقل ۶ کاراکتر باشد." },
        { status: 400 }
      );
    }
    if (!acceptedTerms) {
      return Response.json(
        { error: "پذیرش شرایط و قوانین الزامی است" },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { mobile } });
    if (existing) {
      return Response.json(
        { error: "این شماره موبایل قبلاً ثبت شده است. وارد شوید." },
        { status: 409 }
      );
    }

    // Fetch the active TermsVersion to stamp on the new user
    const activeTerms = await db.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
    });
    const acceptedTermsVersion = activeTerms?.version ?? null;

    const user = await db.user.create({
      data: {
        mobile,
        passwordHash: hashPassword(password),
        name,
        acceptedTermsVersion,
      },
    });

    await setSession(user.id);

    // Create welcome notification (in-app only, NO SMS)
    await db.notification.create({
      data: {
        userId: user.id,
        type: "welcome",
        title: "خوش آمدید! 🎉",
        body: `سلام${name ? " " + name : ""}! به فیتاپ خوش آمدی. برای ساخت برنامه تمرینی و غذایی اختصاصی، اطلاعات آنبوردینگ را تکمیل کن.`,
        link: "?screen=onboarding",
        read: false,
      },
    });

    return Response.json({
      id: user.id,
      mobile: user.mobile,
      name: user.name,
      role: user.role,
      onboardingDone: user.onboardingDone,
      hasActiveSubscription: false,
      subscriptionEnd: null,
      planName: null,
      planExpiresAt: null,
      walletBalance: 0,
      acceptedTermsVersion,
    });
  } catch (e) {
    return apiError(e);
  }
}
