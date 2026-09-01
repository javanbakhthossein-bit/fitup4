"use client";

/**
 * global-error.tsx — آخرین لایه دفاعی.
 * فقط وقتی فعال می‌شود که خود layout ریشه هم crash کند؛ چون در این حالت
 * هیچ تم/فونتی در دسترس نیست، استایل‌ها inline هستند.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[global-error]", error);

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
            border: "1px solid #fed7aa",
            borderRadius: "24px",
            padding: "32px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 20px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #f59e0b, #ea580c)",
              color: "#fff",
              fontSize: "32px",
              lineHeight: "64px",
            }}
          >
            ⚠️
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "18px", color: "#0f172a" }}>
            خطای غیرمنتظره
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#64748b", lineHeight: "1.8" }}>
            مشکلی در بارگذاری برنامه رخ داد. معمولاً با تلاش مجدد برطرف می‌شود.
          </p>
          <button
            onClick={reset}
            style={{
              background: "linear-gradient(90deg, #f59e0b, #ea580c)",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              padding: "12px 28px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}
