import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";

/**
 * یافتن آخرین پرداخت pending کاربر (برای callback زرین‌پال).
 * در صورت ارسال authority، تطبیق دقیق روی authority انجام می‌شود؛
 * در غیر این صورت، آخرین پرداخت pending کاربر برگردده می‌شود.
 *
 * این endpoint صرفاً برای پیدا کردن paymentId مناسب برای verify است و
 * خود verify در /api/payment/verify انجام می‌شود.
 *
 * فیلدهای پاسخ:
 *  - type: نوع پرداخت (payment.plan) — مثلاً "wallet_topup" یا "basic"
 *  - autoVerify: آیا فرانت می‌تواند بی‌درنگ verify با status=OK صدا بزند؟
 *      • true  → پرداخت از کیف پول است (پول internal است و verify آنی درست است)
 *                یا authority ارسال شده و با پرداخت match شده (بازگشت واقعی از درگاه).
 *      • false → پرداخت درگاهی بدون authority است — فرانت نباید آن را با
 *                status=OK وریفای کند (کاربر شاید هنوز در درگاه است؛ F15).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = (await req.json().catch(() => ({}))) as { authority?: string };

    // narrowing امن: authority خام را یک‌بار استخراج کن تا TS بتواند نوع را حفظ کند
    const rawAuthority = typeof body.authority === "string" ? body.authority.trim() : "";
    const hasAuthorityParam = !!rawAuthority;

    const where: { userId: string; status: string; authority?: string } = {
      userId: user.id,
      status: "pending",
    };
    if (hasAuthorityParam) {
      where.authority = rawAuthority;
    }

    const payment = await db.payment.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        authority: true,
        amount: true,
        plan: true,
        paymentMethod: true,
        createdAt: true,
      },
    });

    if (!payment) {
      return Response.json(
        { error: "پرداخت معلقی یافت نشد.", paymentId: null },
        { status: 404 }
      );
    }

    // فقط پرداخت‌های کیف‌پولی (یا درگاهیِ همراه authority) قابل verify خودکار هستند
    const autoVerify =
      payment.paymentMethod === "wallet" ||
      (hasAuthorityParam && !!payment.authority && payment.authority === body.authority!.trim());

    return Response.json({
      paymentId: payment.id,
      authority: payment.authority,
      amount: payment.amount,
      plan: payment.plan,
      type: payment.plan,
      paymentMethod: payment.paymentMethod,
      createdAt: payment.createdAt,
      autoVerify,
    });
  } catch (e) {
    return apiError(e);
  }
}
