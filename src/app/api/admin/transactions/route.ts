import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    // پارس امن صفحه‌بندی — Number(abc) → NaN → skip/take نامعتبر و ۵۰۰ (ممیزی 2-c)
    const page = Math.max(1, Math.floor(Number(searchParams.get("page") || 1) || 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(searchParams.get("pageSize") || 20) || 20)));
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";

    const where: any = {};
    // FIX: وضعیت‌های verifying (در حال پردازش) / manual_resolved / expired اضافه شدند
    // تا فیلتر منوی «مالی و تراکنش‌ها» بتواند معلق‌ها را جدا نشان دهد
    if (
      status &&
      [
        "pending",
        "success",
        "failed",
        "cancelled",
        "refunded",
        "verifying",
        "manual_resolved",
        "expired",
      ].includes(status)
    ) {
      where.status = status;
    }

    // For search by user mobile/name, we need to join
    let userIds: string[] | undefined;
    if (search) {
      const users = await db.user.findMany({
        where: { OR: [{ mobile: { contains: search } }, { name: { contains: search } }] },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
      where.userId = { in: userIds };
    }

    // تراکنش‌های کیف پول فقط وقتی درخواست شده که فیلتر وضعیت نداریم (وضعیت، مفهوم پرداخت است)
    // ممیزی 2-c P1: قبلاً walletTransaction.findMany هیچ where نداشت → جستجوی موبایل
    // فقط پرداخت‌ها را فیلتر می‌کرد و تراکنش‌های کیف همه‌ی کاربران را نشان می‌داد.
    const includeWallet = !status || status === "all";
    const walletWhere: any = userIds ? { userId: { in: userIds } } : {};

    // ─── صفحه‌بندی درست روی استریم merge شده (ممیزی 2-c P1) ───
    // قبلاً skip/take جداگانه روی هر منبع + merge و slice بود → در ترتیب تاریخ درهم،
    // برخی ردیف‌ها هیچ‌وقت در هیچ صفحه‌ای نمایش داده نمی‌شدند.
    // حالا از هر منبع به اندازه‌ی «تا انتهای صفحه‌ی درخواستی» (page*pageSize) ردیف
    // مرتب‌شده نزولی می‌گیریم، merge و بر اساس تاریخ نزولی مرتب و پنجره‌ی صفحه را برش می‌زنیم.
    const fetchLimit = page * pageSize;

    const [paymentCount, walletCount, payments, walletTxns] = await Promise.all([
      db.payment.count({ where }),
      // total واقعی = تعداد کل هر دو منبع با همان شرط‌های فیلتر (قبلاً طول صفحه‌ی wallet بود)
      includeWallet ? db.walletTransaction.count({ where: walletWhere }) : Promise.resolve(0),
      db.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: fetchLimit,
        include: { user: { select: { name: true, mobile: true } } },
      }),
      includeWallet
        ? db.walletTransaction.findMany({
            where: walletWhere,
            orderBy: { createdAt: "desc" },
            take: fetchLimit,
            include: { user: { select: { name: true, mobile: true } } },
          })
        : Promise.resolve([]),
    ]);

    // Combine and format — merge مرتب بر اساس تاریخ نزولی
    const transactions = [
      ...payments.map((p) => ({
        id: p.id,
        type: "payment" as const,
        userId: p.userId,
        userName: p.user?.name || "",
        userMobile: p.user?.mobile || "",
        amount: p.amount,
        originalAmount: p.originalAmount,
        plan: p.plan,
        paymentMethod: p.paymentMethod,
        status: p.status,
        refId: p.refId,
        authority: p.authority,
        cardPan: p.cardPan || null,
        cardHash: p.cardHash || null,
        fee: p.fee ?? null,
        discountCode: p.discountCode,
        description: p.description,
        createdAt: p.createdAt.toISOString(),
        verifiedAt: p.verifiedAt?.toISOString() || null,
      })),
      ...walletTxns.map((t) => ({
        id: t.id,
        type: "wallet" as const,
        userId: t.userId,
        userName: t.user?.name || "",
        userMobile: t.user?.mobile || "",
        amount: t.amount,
        originalAmount: 0,
        plan: "",
        paymentMethod: "wallet",
        status: "success",
        refId: t.refId || "",
        discountCode: "",
        description: t.description,
        createdAt: t.createdAt.toISOString(),
        verifiedAt: null,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice((page - 1) * pageSize, page * pageSize);

    const total = paymentCount + walletCount;

    return Response.json({
      transactions,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return apiError(e);
  }
}
