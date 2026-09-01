import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, apiError } from "@/lib/fitness/auth";
import { getActivePlan } from "@/lib/fitness/pricing";
import { toPersianDigits, type Plan } from "@/lib/fitness/types";

// اعتبارسنجی کد تخفیف و محاسبه قیمت نهایی
// FIX 1: قیمت پلن از getActivePlan() (SiteSetting — قابل ویرایش توسط ادمین) خوانده
// می‌شود، نه از SUBSCRIPTION_PLANS ثابت کد — تا preview با مبلغ واقعی شارژشده
// در checkout یکی باشد (checkout هم از همان منبع استفاده می‌کند).
// FIX 2: کد تخفیف اختصاصی (UserDiscountCode — کدهای تمدید FITAP15-...) هم
// پشتیبانی می‌شود؛ قبلاً فقط جدول عمومی DiscountCode چک می‌شد و تایپ دستی کد
// اختصاصی «کد تخفیف نامعتبر» می‌گرفت (فقط از طریق prefill plans-view کار می‌کرد).
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { code, planId } = (await req.json()) as { code: string; planId: Plan };
    const plan = await getActivePlan(planId);
    if (!plan) {
      return Response.json({ error: "پلن نامعتبر است." }, { status: 400 });
    }

    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      return Response.json({ error: "کد تخفیف را وارد کنید." }, { status: 400 });
    }

    let discountType: "percent" | "fixed" = "percent";
    let discountValueRaw = 0;
    let discountLabel = "";
    let matchedCode = normalized;

    // ─── ۱. کد تخفیف عمومی (DiscountCode) ───
    const dc = await db.discountCode.findUnique({ where: { code: normalized } });
    if (dc) {
      if (!dc.active) {
        return Response.json({ valid: false, error: "کد تخفیف نامعتبر است." });
      }
      if (dc.validUntil && dc.validUntil < new Date()) {
        return Response.json({ valid: false, error: "کد تخفیف منقضی شده است." });
      }
      if (dc.maxUses !== -1 && dc.usedCount >= dc.maxUses) {
        return Response.json({ valid: false, error: "سقف استفاده از این کد تکمیل شده است." });
      }
      if (dc.applicablePlans !== "all") {
        const allowed = dc.applicablePlans.split(",");
        if (!allowed.includes(plan.id)) {
          return Response.json({
            valid: false,
            error: "این کد تخفیف برای پلن انتخاب‌شده قابل استفاده نیست.",
          });
        }
      }
      discountType = dc.type as "percent" | "fixed";
      discountValueRaw = dc.value;
      matchedCode = dc.code;
      discountLabel =
        discountType === "percent"
          ? `${toPersianDigits(dc.value)}٪ تخفیف`
          : `${toPersianDigits(dc.value.toLocaleString("en-US"))} تومان تخفیف`;
    } else {
      // ─── ۲. کد تخفیف اختصاصی کاربر (UserDiscountCode — کد تمدید) ───
      // همان اعتبارسنجی checkout برای کدهای شخصی: مالکیت + used + انقضا
      const udc = await db.userDiscountCode.findUnique({ where: { code: normalized } });
      if (!udc) {
        return Response.json({ valid: false, error: "کد تخفیف نامعتبر است." });
      }
      if (udc.userId !== user.id) {
        return Response.json({ valid: false, error: "این کد تخفیف متعلق به حساب شما نیست." });
      }
      if (udc.isUsed) {
        return Response.json({ valid: false, error: "این کد تخفیف قبلاً استفاده شده است." });
      }
      if (udc.validUntil && udc.validUntil < new Date()) {
        return Response.json({ valid: false, error: "کد تخفیف اختصاصی منقضی شده است." });
      }
      discountType = udc.type as "percent" | "fixed";
      discountValueRaw = udc.value;
      matchedCode = udc.code;
      discountLabel =
        discountType === "percent"
          ? `${toPersianDigits(udc.value)}٪ تخفیف تمدید`
          : `${toPersianDigits(udc.value.toLocaleString("en-US"))} تومان تخفیف تمدید`;
    }

    const originalAmount = plan.price;
    let discountValue = 0;
    if (discountType === "percent") {
      discountValue = Math.round((originalAmount * discountValueRaw) / 100);
    } else {
      discountValue = Math.min(discountValueRaw, originalAmount);
    }
    const finalAmount = Math.max(0, originalAmount - discountValue);

    return Response.json({
      valid: true,
      code: matchedCode,
      type: discountType,
      value: discountValueRaw,
      discountValue,
      originalAmount,
      finalAmount,
      discountLabel,
      // برای کد اختصاصی — کلاینت با این فلگ کد را در checkout به‌عنوان
      // userDiscountCode (نه discountCode عمومی) می‌فرستد.
      isUserCode: !dc,
    });
  } catch (e) {
    return apiError(e);
  }
}
