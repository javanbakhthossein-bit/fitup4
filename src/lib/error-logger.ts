import { db } from "@/lib/db";

/**
 * Log an error to the database (for admin review).
 * Safe to call from API routes — catches its own errors to avoid recursion.
 */
export async function logError(params: {
  source: "client" | "api" | "server";
  message: string;
  stack?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.errorLog.create({
      data: {
        // سقف طول source (دفاع عمقی — مسیر route از قبل whitelist می‌کند)
        source: (params.source || "client").slice(0, 64),
        message: (params.message || "").slice(0, 2000),
        stack: params.stack?.slice(0, 5000) || null,
        url: (params.url || "").slice(0, 500),
        method: params.method || null,
        statusCode: params.statusCode || 0,
        userId: params.userId || null,
        userAgent: (params.userAgent || "").slice(0, 500),
        context: JSON.stringify(params.context || {}).slice(0, 5000),
      },
    });
  } catch (e) {
    // Don't let logging errors crash the app
    console.error("[error-logger] Failed to log error:", e);
  }
}
