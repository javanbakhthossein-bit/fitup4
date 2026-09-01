import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError, buildUserDto } from "@/lib/fitness/auth";
import { toPersianDigits } from "@/lib/fitness/types";

/** سقف مطلق مبلغ شارژ/برداشت دستی (تومان) */
const MAX_AMOUNT = 10_000_000;

/** خطای اختصاصی شارژ کیف پول — با status مشخص در catch بیرونی به پاسخ تبدیل می‌شود */
class WalletChargeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// شارژ/برداشت دستی کیف پول کاربر توسط ادمین
//
// ممیزی 2-c P1: قبلاً (۱) موجودی read-then-write مطلق بود → دو شارژ همزمان یکی را گم
// می‌کرد و (۲) update کاربر و create ردیف دفتر در Promise.all بدون $transaction بود →
// بالانس آپدیت‌شده بدون ردیف دفتر ممکن بود. حالا همه‌چیز در یک $transaction با increment
// اتمیک انجام می‌شود و ردیف دفتر با موجودیِ پس از update ثبت می‌شود.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { userId, amount, description } = await req.json();

    // اعتبارسنجی نوع مبلغ (ممیزی 2-c P2: رشته «1000» قبلاً از چک‌ها رد می‌شد و ۵۰۰ می‌داد)
    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount === 0 ||
      Math.abs(amount) > MAX_AMOUNT
    ) {
      return Response.json(
        { error: `مبلغ نامعتبر است — عدد صحیح غیرصفر با قدر مطلق حداکثر ${toPersianDigits(MAX_AMOUNT.toLocaleString("en-US"))} تومان.` },
        { status: 400 }
      );
    }
    if (!userId || typeof userId !== "string") {
      return Response.json({ error: "کاربر نامعتبر است." }, { status: 400 });
    }

    const { updatedUser, txn } = await db.$transaction(async (tx) => {
      // موجودی تازه داخل تراکنش خوانده می‌شود (نه قبل از آن) → race دو شارژ همزمان منتفی است
      const freshUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, walletBalance: true },
      });
      if (!freshUser) {
        throw new WalletChargeError("کاربر یافت نشد.", 404);
      }
      // جلوگیری از موجودی منفی (برداشت بیشتر از موجودی)
      if ((freshUser.walletBalance || 0) + amount < 0) {
        throw new WalletChargeError("موجودی کافی نیست — موجودی کیف پول نمی‌تواند منفی شود.");
      }
      // افزایش/کاهش اتمیک موجودی — increment با مبلغ منفی هم کار می‌کند
      const updated = await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: amount } },
      });
      // ردیف دفتر در همان تراکنش با موجودی جدید (خوانده‌شده بعد از update) ثبت می‌شود
      const txn = await tx.walletTransaction.create({
        data: {
          userId,
          type: "deposit",
          amount,
          balance: updated.walletBalance,
          description:
            description ||
            `شارژ دستی توسط ادمین — ${toPersianDigits(Math.abs(amount).toLocaleString("en-US"))} تومان`,
        },
      });
      return { updatedUser: updated, txn };
    });

    const dto = await buildUserDto(userId);

    return Response.json({
      ok: true,
      newBalance: updatedUser.walletBalance,
      transaction: {
        id: txn.id,
        type: txn.type,
        amount: txn.amount,
        balance: txn.balance,
        description: txn.description,
        createdAt: txn.createdAt.toISOString(),
      },
      user: dto,
    });
  } catch (e) {
    if (e instanceof WalletChargeError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    return apiError(e);
  }
}
