import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { zarinpalInquiry } from "@/lib/payment/providers/zarinpal";

/**
 * GET /api/payment/inquiry?paymentId=X
 *
 * استعلام وضعیت تراکنش از زرین‌پال (طبق مستندات)
 *
 * این متد فقط وضعیت تراکنش را اعلام می‌کند:
 *   VERIFIED : وریفای شده
 *   PAID : پرداخت شده (وریفای نشده)
 *   IN_BANK : درحال پرداخت
 *   FAILED : ناموفق (تکمیل نشده)
 *   REVERSED : تراکنش ریورس شده
 *
 * فقط ادمین می‌تواند این کار را انجام دهد.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const paymentId = req.nextUrl.searchParams.get("paymentId");
    if (!paymentId) {
      return Response.json({ error: "paymentId الزامی است." }, { status: 400 });
    }

    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      select: { authority: true, paymentMethod: true, status: true },
    });

    if (!payment) {
      return Response.json({ error: "پرداخت یافت نشد." }, { status: 404 });
    }

    if (payment.paymentMethod !== "gateway") {
      return Response.json({
        ok: true,
        status: "N/A",
        message: "این متد فقط برای پرداخت‌های درگاهی کاربرد دارد.",
        dbStatus: payment.status,
      });
    }

    if (!payment.authority) {
      return Response.json({
        ok: true,
        status: "N/A",
        message: "کد مرجع (authority) موجود نیست.",
        dbStatus: payment.status,
      });
    }

    const result = await zarinpalInquiry({ authority: payment.authority });

    return Response.json({
      ok: result.ok,
      status: result.status ?? null,
      message: result.message ?? result.error,
      dbStatus: payment.status,
      code: result.code,
    });
  } catch (e) {
    return apiError(e);
  }
}
