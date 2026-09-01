import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import {
  zarinpalRequest,
  buildCallbackUrl,
  isZarinpalConfigured,
} from "@/lib/fitness/zarinpal";

// دریافت موجودی و تاریخچه کیف پول
export async function GET() {
  try {
    const user = await requireAuth();
    // total: تعداد واقعی کل تراکنش‌ها (transactions فقط ۵۰ مورد آخر است)
    // — FIX: قبلاً UI تعداد fetched (حداکثر ۵۰) را به‌عنوان کل نمایش می‌داد.
    const [freshUser, transactions, total] = await Promise.all([
      db.user.findUnique({ where: { id: user.id } }),
      db.walletTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.walletTransaction.count({ where: { userId: user.id } }),
    ]);
    return Response.json({
      balance: freshUser?.walletBalance ?? 0,
      total,
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balance: t.balance,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

/**
 * شارژ کیف پول — از طریق درگاه واقعی زرین‌پال (F1).
 *
 * این endpoint دیگر موجودی را مستقیماً افزایش نمی‌دهد (باگ چاپ پول رایگان).
 * فقط یک Payment از نوع wallet_topup با status="pending" می‌سازد، درخواست
 * پرداخت واقعی به زرین‌پال می‌فرستد و gatewayUrl را برمی‌گرداند تا کاربر به
 * درگاه هدایت شود. تأیید و افزایش موجودی فقط در /api/payment/verify انجام
 * می‌شود (بعد از verify موفق زرین‌پال).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { amount } = (await req.json()) as { amount: number };
    if (!amount || amount < 10000 || amount > 10000000) {
      return Response.json(
        { error: "مبلغ شارژ باید بین ۱۰,۰۰۰ و ۱۰,۰۰۰,۰۰۰ تومان باشد." },
        { status: 400 }
      );
    }

    // بدون درگاه واقعی، شارژ کیف پول ممکن نیست — نه شبیه‌سازی، نه اعتبار رایگان
    if (!isZarinpalConfigured()) {
      return Response.json(
        {
          error:
            "درگاه پرداخت پیکربندی نشده است. لطفاً با پشتیبانی تماس بگیرید.",
          code: "GATEWAY_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    // رکورد پرداخت pending — نوع wallet_topup
    const payment = await db.payment.create({
      data: {
        userId: user.id,
        amount,
        originalAmount: amount,
        plan: "wallet_topup",
        paymentMethod: "gateway",
        status: "pending",
        description: "شارژ کیف پول",
      },
    });

    const origin = req.nextUrl.origin ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const zarinRes = await zarinpalRequest({
      amount, // Tomans
      description: "شارژ کیف پول فیتاپ",
      callbackUrl: buildCallbackUrl(origin),
      mobile: user.mobile,
    });

    if (!(zarinRes.ok && zarinRes.authority && zarinRes.gatewayUrl)) {
      // اتصال به درگاه ناموفق — پرداخت failed می‌شود و هیچ موجودی‌ای تغییر نمی‌کند
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "failed", verifiedAt: new Date() },
      });
      return Response.json(
        {
          error: `اتصال به درگاه زرین‌پال ناموفق بود: ${zarinRes.error || "خطای ناشناخته"}`,
          code: "GATEWAY_ERROR",
          details: zarinRes.error,
        },
        { status: 502 }
      );
    }

    // ذخیره authority — مرجع واقعی این پرداخت در درگاه
    await db.payment.update({
      where: { id: payment.id },
      data: { authority: zarinRes.authority },
    });

    return Response.json({
      ok: true,
      paymentId: payment.id,
      authority: zarinRes.authority,
      gatewayUrl: zarinRes.gatewayUrl,
      amount,
      message: "برای تکمیل شارژ، به درگاه پرداخت منتقل می‌شوید.",
    });
  } catch (e) {
    return apiError(e);
  }
}
