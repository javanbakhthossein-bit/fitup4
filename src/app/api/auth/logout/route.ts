import { clearSession, apiError } from "@/lib/fitness/auth";

export async function POST() {
  try {
    await clearSession();
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
