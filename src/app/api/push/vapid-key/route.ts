// GET /api/push/vapid-key — کلید عمومی VAPID برای استفاده در service worker
// این endpoint عمومی است (بدون نیاز به auth) چون فقط کلید عمومی را برمی‌گرداند.
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return Response.json({ error: "VAPID key not configured" }, { status: 500 });
  }
  return Response.json({ publicKey });
}
