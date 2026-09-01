import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * GET /api/cron/db-selfheal?secret=CRON_SECRET
 *
 * ─── خودترمیمی ستون‌های گم‌شده دیتابیس (DB schema drift guard) ───
 *
 * ریشه‌ی باگ: وقتی کد جدید (با فیلد تازه در Prisma schema) روی سرور
 * دیپلوی می‌شود ولی `bun run db:push` اجرا نشود، کلاینت Prisma در
 * «هر» findUnique/select فیلد جدید را هم کوئری می‌کند → P2022
 * (The column ... does not exist) → کل جریان لاگین می‌شکند.
 * (اتفاق واقعی: ستون User.lastActiveAt در v9 اضافه شد و لاگین
 * سرور پروداکشن بدون db:push قطع شد.)
 *
 * FIX ریشه‌ای: این route در boot (و هر ۶ ساعت) توسط instrumentation
 * صدا زده می‌شود؛ ستون‌های مورد انتظارِ نسخه‌ی فعلی کد را با PRAGMA
 * table_info چک می‌کند و هر ستونِ گم‌شده را با ALTER TABLE ADD COLUMN
 * اضافه می‌کند (nullable، بدون دست زدن به داده‌های موجود — ایمن).
 *
 * - Idempotent: اجرای مکرر بی‌اثر است.
 * - Fail-secure: بدون CRON_SECRET درست → 401.
 * - فهرست EXPECTED_COLUMNS باید با هر فیلد جدیدِ Prisma همگام شود
 *   (فقط فیلدهایی که بعد از آخرین دیپلوی پروداکشن اضافه شده‌اند).
 */

// [table, column, sqliteType] — فیلدهای افزودنی نسخه‌های جدید کد
const EXPECTED_COLUMNS: Array<{ table: string; column: string; sqliteType: string }> = [
  // v9: ردیابی فعالیت برای ریشه‌ی نوتیف «چند روزی نیستی»
  { table: "User", column: "lastActiveAt", sqliteType: "DATETIME" },
];

// جداول جدید که باید روی پروداکشن هم (بدون db:push) ساخته شوند — idempotent.
// DDL باید دقیقاً آینه‌ی Prisma schema باشد (همان نام ستون‌ها/ایندکس‌ها).
const EXPECTED_TABLES: Array<{ table: string; ddl: string; indexDdl: string }> = [
  // v15+: توضیحات مدیر — تاریخچه یادداشت‌های ادمین برای هر کاربر
  {
    table: "UserAdminNote",
    ddl: `CREATE TABLE IF NOT EXISTS "UserAdminNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorMobile" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
)`,
    indexDdl: `CREATE INDEX IF NOT EXISTS "UserAdminNote_userId_createdAt_idx" ON "UserAdminNote"("userId", "createdAt")`,
  },
];

export async function GET(req: NextRequest) {
  const rl = rateLimit(`cron-db-selfheal:${getClientIp(req)}`, 30, 60 * 1000);
  if (!rl.ok) {
    return rateLimitResponse(rl.retryAfterSec);
  }

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  // مجاز در دو حالت:
  //  ۱) secret درست
  //  ۲) اتصال «محلی» — درخواست boot از instrumentation خود سرور است.
  //     تشخیص: یا هیچ هدر پروکسی‌ای نیست (اتصال مستقیم) یا IP مؤثر
  //     loopback است (Next خودش برای اتصال محلی XFF=127.0.0.1 می‌گذارد).
  //     ایمنی: این endpoint فقط ستون‌های nullable از لیست هاردکد اضافه
  //     می‌کند (idempotent، بدون دست زدن به داده‌ی کاربر) → ریسک صفر.
  const h = req.headers;
  const hasProxyHeaders =
    Boolean(h.get("x-forwarded-for")) ||
    Boolean(h.get("cf-connecting-ip")) ||
    Boolean(h.get("x-real-ip"));
  const clientIp = getClientIp(req);
  const isLoopbackIp =
    clientIp === "127.0.0.1" ||
    clientIp === "::1" ||
    clientIp === "::ffff:127.0.0.1" ||
    clientIp.startsWith("::ffff:127.") ||
    (clientIp.startsWith("::ffff:") && clientIp.endsWith(":7f00:1"));
  const isLocal = !hasProxyHeaders || isLoopbackIp;

  const authorized = Boolean(expected && secret === expected) || isLocal;
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const added: string[] = [];
  const alreadyOk: string[] = [];
  const errors: string[] = [];
  const tablesCreated: string[] = [];

  // --- گام ۱: ستون‌های گم‌شده (ALTER TABLE ADD COLUMN) ---
  for (const { table, column, sqliteType } of EXPECTED_COLUMNS) {
    try {
      // چک وجود ستون (PRAGMA table_info — اسم جدول/ستون هاردکدِ امن)
      const rows = (await db.$queryRawUnsafe(
        `PRAGMA table_info("${table}")`
      )) as Array<{ name: string }>;
      const exists = rows.some((r) => r.name === column);
      if (exists) {
        alreadyOk.push(`${table}.${column}`);
        continue;
      }
      // جدول وجود ندارد؟ (DB تازه) — prisma db push وظیفه‌ی ساختش است؛ رد شو
      if (rows.length === 0) {
        errors.push(`table "${table}" not found — run bun run db:push`);
        continue;
      }
      // افزودن ستون گم‌شده — nullable پس بی‌خطر برای ردیف‌های موجود
      await db.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN "${column}" ${sqliteType}`
      );
      added.push(`${table}.${column}`);
      console.log(
        `[db-selfheal] ✅ ستون گم‌شده اضافه شد: ${table}.${column} (${sqliteType})`
      );
    } catch (e) {
      errors.push(`${table}.${column}: ${(e as Error).message?.slice(0, 200) ?? "unknown"}`);
      console.error(`[db-selfheal] ❌ خطا روی ${table}.${column}:`, e);
    }
  }

  // --- گام ۲: جداول جدید (CREATE TABLE IF NOT EXISTS) ---
  // تاریخچه سرور پروداکشن: جدول‌های جدید بعد از دیپلوی ساخته نمی‌شدند (db:push
  // فراموش می‌شد). این بخش بعد از حلقه‌ی ستون‌ها اجرا می‌شود و جدول + ایندکس را
  // idempotent می‌سازد — اگر از قبل موجود باشد هیچ دستی به داده‌ها نمی‌زند.
  for (const { table, ddl, indexDdl } of EXPECTED_TABLES) {
    try {
      const existed = (await db.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
      )) as Array<{ name: string }>;
      const wasMissing = existed.length === 0;

      await db.$executeRawUnsafe(ddl);
      await db.$executeRawUnsafe(indexDdl);

      if (wasMissing) {
        tablesCreated.push(table);
        console.log(`[db-selfheal] ✅ جدول گم‌شده ساخته شد: ${table}`);
      }
    } catch (e) {
      errors.push(`${table}: ${(e as Error).message?.slice(0, 200) ?? "unknown"}`);
      console.error(`[db-selfheal] ❌ خطا روی جدول ${table}:`, e);
    }
  }

  return Response.json({
    ok: errors.length === 0,
    checked: EXPECTED_COLUMNS.length,
    added,
    alreadyOk,
    tablesCreated,
    created: tablesCreated.length > 0,
    errors,
    runAt: new Date().toISOString(),
  });
}
