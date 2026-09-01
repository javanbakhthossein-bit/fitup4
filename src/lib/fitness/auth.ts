import { cookies } from "next/headers";
import path from "path";
import { readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { db } from "@/lib/db";
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "crypto";
import type { Plan } from "@/lib/fitness/types";
import { logError } from "@/lib/error-logger";

/**
 * ساخت DTO امن کاربر برای ارسال به کلاینت.
 * شامل اطلاعات پلن فعلی و موجودی کیف پول.
 */
export async function buildUserDto(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const now = new Date();
  // اشتراک فعال: status === "active" و endDate در آینده است.
  // برای پلن‌های advanced/ultimate، اشتراک ابتدا با status="pending" ساخته می‌شود
  // (تا پیش‌نیازها تکمیل شوند) و ۴۵ روز از زمان تکمیل پیش‌نیازها آغاز می‌شود.
  const activeSub = await db.subscription.findFirst({
    where: {
      userId: user.id,
      status: "active",
      endDate: { gt: now },
    },
    orderBy: { endDate: "desc" },
  });

  // اشتراک pending (خرید شده ولی پیش‌نیازها تکمیل نشده) — فقط برای advanced/ultimate
  // planName برای capability gating از این اشتراک برمی‌گردد تا کاربر بتواند به صفحات
  // ارسال عکس بدن/ویدیو/آزمایش خون دسترسی داشته باشد.
  // پنجره pending محدود است (endDate = خرید + PENDING_WINDOW_DAYS) — اگر کاربر هرگز
  // پیش‌نیازها را تکمیل نکند، دسترسی او بعد از پنجره منقضی می‌شود (نه برای همیشه).
  // رکوردهای legacy با endDate=null همچنان معتبر در نظر گرفته می‌شوند.
  let pendingSub = !activeSub
    ? await db.subscription.findFirst({
        where: {
          userId: user.id,
          status: "pending",
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  // انقضای تنبل (lazy expiry): اشتراک‌های pending که پنجره‌شان گذشته را علامت‌گذاری کن
  if (pendingSub?.endDate && pendingSub.endDate.getTime() <= now.getTime()) {
    try {
      await db.subscription.update({
        where: { id: pendingSub.id },
        data: { status: "expired" },
      });
    } catch {
      /* best-effort */
    }
    pendingSub = null;
  }

  // آخرین اشتراک (حتی منقضی شده) — برای نمایش در UI و renewal banner
  const lastSub = await db.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { endDate: "desc" },
  });

  // اگر اشتراک فعلی هست، فیلدهای پلن را از آن می‌گیریم
  // اگر منقضی شده، lastPlanName و lastPlanExpiresAt برای نمایش در UI استفاده می‌شوند
  // planName: اولویت با active است، در غیر این صورت از pending (برای gating) استفاده می‌کنیم
  const planName = activeSub?.plan ?? pendingSub?.plan ?? null;
  const planExpiresAt = activeSub?.endDate ?? null;
  // hasActiveSubscription فقط وقتی true است که اشتراک واقعاً فعال باشد (نه pending)
  const hasActive = !!activeSub;
  // آیا کاربر در حال تکمیل پیش‌نیازهاست؟ (اشتراک pending دارد)
  const hasPendingSubscription = !!pendingSub;

  // آخرین پلن (حتی منقضی) — برای renewal banner و نمایش وضعیت
  const lastPlanName = lastSub?.plan ?? user.planName ?? null;
  const lastPlanExpiresAt = lastSub?.endDate ?? user.planExpiresAt ?? null;

  return {
    id: user.id,
    mobile: user.mobile,
    name: user.name,
    role: user.role,
    onboardingDone: user.onboardingDone,
    hasActiveSubscription: hasActive,
    hasPendingSubscription,
    subscriptionEnd: planExpiresAt?.toISOString() ?? null,
    planName: (planName as Plan | null) ?? null,
    planExpiresAt: planExpiresAt?.toISOString() ?? null,
    // آخرین پلن (حتی منقضی) — برای UI و renewal banner
    lastPlanName: (lastPlanName as Plan | null) ?? null,
    lastPlanExpiresAt: lastPlanExpiresAt?.toISOString() ?? null,
    walletBalance: user.walletBalance,
    acceptedTermsVersion: user.acceptedTermsVersion ?? null,
    // === AI usage counters (for plan limit display) ===
    videoAnalysisUsed: user.videoAnalysisUsed,
    bloodTestUsed: user.bloodTestUsed,
    // === Prerequisite decision fields ===
    videoStatus: user.videoStatus ?? null,
    bloodTestStatus: user.bloodTestStatus ?? null,
    // === PWA install status ===
    pwaInstalledAt: user.pwaInstalledAt?.toISOString() ?? null,
  };
}

/**
 * اعتبارسنجی دسترسی کاربر به یک قابلیت خاص بر اساس پلن فعال.
 * در سمت سرور استفاده می‌شود. اگر دسترسی نباشد، خطا می‌اندازد.
 */
export async function requirePlanCapability(capability: string): Promise<{ userId: string; planName: Plan | null }> {
  const user = await requireAuth();
  const dto = await buildUserDto(user.id);
  const planName = dto?.planName ?? null;

  // نگاشت قابلیت‌ها به حداقل پلن لازم (سیستم ۴ پلنی: basic=1, standard=2, advanced=3, ultimate=4)
  const minTierMap: Record<string, number> = {
    exerciseLibrary: 1, // Basic
    supplements: 2, // Standard
    periodicCheckups: 2, // Standard
    aiChat: 3, // Advanced
    chatImage: 3,
    chatImageUpload: 3, // Advanced (آلیاس برای ارسال عکس در چت)
    mealPhotoAnalysis: 3,
    bodyPhotoAnalysis: 3,
    progressAnalysis: 2, // Standard (تحلیل پیشرفت بدن — ۳ بار در طول اشتراک)
    gymMode: 3,
    nutritionCompanion: 3,
    fullExerciseLibrary: 3,
    chatVideo: 4, // Ultimate
    chatVideoUpload: 4, // Ultimate (آلیاس برای ارسال ویدیو در چت)
    videoAnalysis: 4,
    techniqueCorrection: 4,
    bloodTest: 4,
    humanCoach: 4,
    hybridProgram: 4,
    // === Aliases — API route names that map to the same tier as the canonical key ===
    // این آلیاس‌ها برای جلوگیری از باگ gating در API route‌ها اضافه شده‌اند.
    // قبلاً requirePlanCapability("bloodTestAnalysis") در route استفاده می‌شد اما
    // کلید در این مپ فقط "bloodTest" بود — که باعث می‌شد minTier برابر 0 شود و
    // capability برای همه پلن‌ها باز باشد. حالا هر دو نام به tier 4 مپ می‌شوند.
    bloodTestAnalysis: 4, // = bloodTest
    videoBodyAnalysis: 4, // = videoAnalysis
  };

  const minTier = minTierMap[capability] ?? 0;
  if (minTier === 0) {
    return { userId: user.id, planName };
  }

  const planTiers: Record<string, number> = {
    basic: 1,
    standard: 2,
    advanced: 3,
    ultimate: 4,
  };
  const currentTier = planName ? planTiers[planName] ?? 0 : 0;

  if (currentTier < minTier) {
    throw new Error("PLAN_UPGRADE_REQUIRED");
  }

  return { userId: user.id, planName };
}

const SESSION_COOKIE = "sc_session";
// Marker cookie set when a user's session was invalidated due to outdated TermsVersion.
// Read by /api/auth/me so the frontend can show the "new terms" modal on the auth screen.
// Cleared on successful OTP verification (verify-otp route).
const TERMS_PENDING_COOKIE = "sc_terms_pending";
const TERMS_PENDING_COOKIE_MAX_AGE = 60 * 60; // 1 hour — long enough for the user to read & accept

// ─── Session Secret — resolve به‌صورت lazy (نه هنگام بارگذاری ماژول) ───
//
// باگ قبلی: این مقدار در سطح ماژول (module scope) ارزیابی می‌شد و اگر
// SESSION_SECRET در .env نبود، `next build` هنگام «Collecting page data»
// (که همه ماژول‌های route را eval می‌کند) با خطای
// "Error: SESSION_SECRET is required in production" می‌شکست.
//
// رفتار جدید (اولویت‌دار):
//   ۱. متغیر محیطی SESSION_SECRET (توصیه‌شده — پایدار بین سرورها)
//   ۲. فایل db/.session-secret — اگر موجود نباشد یک‌بار تولید و ذخیره می‌شود.
//      جستجو/نوشتن با الگوی walk-up (مثل uploads-config.ts) انجام می‌شود تا در
//      حالت standalone (cwd = .next/standalone) فایل در ریشه پروژه (خارج از
//      .next) قرار گیرد و با `rm -rf .next` دیپلوی از بین نرود → کاربران
//      لاگین می‌مانند.
//   ۳. development بدون fs قابل‌نوشتن → کلید تصادفی موقت (رفتار قبلی)
//   ۴. production بدون fs قابل‌نوشتن → خطا فقط هنگام request واقعی (fail-closed)،
//      هرگز هنگام build.
let cachedSessionSecret: string | null = null;

function readSecretFile(filePath: string): string | null {
  try {
    const v = readFileSync(filePath, "utf8").trim();
    return v.length >= 32 ? v : null;
  } catch {
    return null;
  }
}

function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** مسیرهای کاندید برای فایل secret — از cwd به بالا (حالت standalone) */
function secretFileCandidates(): string[] {
  const candidates: string[] = [];
  if (process.env.SESSION_SECRET_FILE) {
    candidates.push(process.env.SESSION_SECRET_FILE);
  }
  try {
    let dir = process.cwd();
    candidates.push(path.join(dir, "db", ".session-secret"));
    // walk-up تا ۴ سطح والد — مثل uploads-config.ts (رفع باگ cwd در standalone)
    for (let i = 0; i < 4; i++) {
      dir = path.dirname(dir);
      candidates.push(path.join(dir, "db", ".session-secret"));
    }
    candidates.push(path.join(process.cwd(), ".session-secret"));
  } catch {
    // ignore
  }
  return candidates;
}

function resolveSessionSecret(): string {
  // ۱) env صریح — همیشه برنده است
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv) {
    if (fromEnv.length < 32 && process.env.NODE_ENV === "production") {
      console.warn(
        `[auth] SESSION_SECRET is shorter than 32 chars (${fromEnv.length}) — consider: openssl rand -hex 32`
      );
    }
    return fromEnv;
  }

  // ۲) فایل ذخیره‌شده قبلی
  for (const candidate of secretFileCandidates()) {
    const saved = readSecretFile(candidate);
    if (saved) return saved;
  }

  // ۳) تولید جدید + ذخیره در بادوام‌ترین محل (بیرونی‌ترین پوشه db موجود —
  //    خارج از .next تا دیپلوی‌ها آن را پاک نکنند)
  const generated = randomBytes(32).toString("hex");
  const writeTargets: string[] = [];
  try {
    let dir = process.cwd();
    const dbDirs = [path.join(dir, "db")];
    for (let i = 0; i < 4; i++) {
      dir = path.dirname(dir);
      dbDirs.push(path.join(dir, "db"));
    }
    // از بیرونی‌ترین به درونی‌ترین — اولین پوشه db موجود برای نوشتن انتخاب می‌شود
    for (const d of dbDirs.reverse()) {
      if (isDirectory(d)) {
        writeTargets.push(path.join(d, ".session-secret"));
      }
    }
    // fallback: cwd/db (در اولین نوشتن ساخته می‌شود)
    writeTargets.push(path.join(process.cwd(), "db", ".session-secret"));
    writeTargets.push(path.join(process.cwd(), ".session-secret"));
  } catch {
    writeTargets.push(path.join(process.cwd(), ".session-secret"));
  }

  for (const target of writeTargets) {
    try {
      mkdirSync(path.dirname(target), { recursive: true });
      // flag "wx" = exclusive create — اگر worker دیگری همین لحظه ساخته بود،
      // EEXIST می‌گیریم و مقدار او را می‌خوانیم (multi-worker/pm2 cluster امن است)
      writeFileSync(target, generated + "\n", { mode: 0o600, flag: "wx" });
      console.warn(
        `[auth] SESSION_SECRET not set — auto-generated & saved to ${target} (stable across restarts/deploys)`
      );
      return generated;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "EEXIST") {
        const saved = readSecretFile(target);
        if (saved) return saved;
      }
      // خطای دیگر (EACCES/EROFS/...) → تلاش برای target بعدی
    }
  }

  // ۴) هیچ محل قابل‌نوشتن‌ای پیدا نشد
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is not set and db/.session-secret could not be created — add SESSION_SECRET to .env"
    );
  }
  return `dev-insecure-${randomBytes(24).toString("hex")}`;
}

function getSessionSecret(): string {
  if (!cachedSessionSecret) {
    cachedSessionSecret = resolveSessionSecret();
  }
  return cachedSessionSecret;
}

/** حداکثر عمر توکن سشن — 30 روز (هماهنگ با maxAge کوکی) */
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000;

/**
 * Helper — reads the latest active TermsVersion number from DB.
 * Returns 0 if no active version exists (no terms enforcement).
 *
 * Used by getCurrentUser to detect outdated acceptedTermsVersion.
 */
export async function getCurrentTermsVersion(): Promise<number> {
  try {
    const active = await db.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return active?.version ?? 0;
  } catch {
    // DB failure → don't block login; treat as "no terms enforcement"
    return 0;
  }
}

/**
 * Helper — clears the sc_terms_pending marker cookie.
 * Called on successful OTP verification (user re-accepted terms implicitly via OTP).
 */
export async function clearTermsPendingCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(TERMS_PENDING_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    cookieStore.delete(TERMS_PENDING_COOKIE);
  } catch {
    // ignore — cookie clearing is best-effort
  }
}

// Hash a password using scrypt
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Verify a password against stored hash
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

// Validate Iranian mobile number
export function validateMobile(mobile: string): boolean {
  return /^09\d{9}$/.test(mobile.replace(/\s/g, ""));
}

// Validate password strength (min 6 chars)
export function validatePassword(password: string): boolean {
  return password.length >= 6;
}

// Create a signed session token (base64 of userId + signature)
export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, t: Date.now() })).toString("base64url");
  const sig = scryptSync(payload, getSessionSecret(), 32).toString("hex");
  return `${payload}.${sig}`;
}

// Verify and decode session token
//
// بهینه‌سازی CPU: scryptSync در هر request اجرا نمی‌شود — نتیجهی تأیید موفق
// برای hash توکن (SHA-256، نه خود توکن) تا ۶۰ ثانیه در کش درون‌حافظه‌ای
// نگه داشته می‌شود. جستجوی DB (وجود کاربر/blocked/terms) همچنان در هر
// request انجام می‌شود و معتبر باقی می‌ماند؛ فقط هزینه‌ی سنگین scrypt حذف
// می‌شود (حداکثر پنجره‌ی ۶۰ ثانیه‌ای بعد از logout ممکن است باقی بماند که
// توسط همان بررسی DB و انقضای ۳۰ روزه سمت سرور محدود شده است).
const SESSION_VERIFY_CACHE_TTL_MS = 60 * 1000;
const SESSION_VERIFY_CACHE_MAX = 512; // سقف اندازه کش (تقریباً LRU)
const sessionVerifyCache = new Map<
  string,
  { decoded: { uid: string; t: number }; exp: number }
>();

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function verifySessionToken(token: string): { uid: string; t: number } | null {
  try {
    // کش: اگر همین توکن اخیراً با scrypt تأیید شده، بدون scrypt ادامه بده
    const cacheKey = sha256Hex(token);
    const cached = sessionVerifyCache.get(cacheKey);
    if (cached) {
      if (cached.exp > Date.now()) {
        // انقضای سمت سرور همچنان چک می‌شود
        if (Date.now() - cached.decoded.t > SESSION_MAX_AGE_MS) return null;
        return cached.decoded;
      }
      sessionVerifyCache.delete(cacheKey); // ورودی منقضی
    }

    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expectedSig = scryptSync(payload, getSessionSecret(), 32).toString("hex")
    // مقایسه timing-safe برای جلوگیری از حملات timing
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!decoded?.uid || typeof decoded.t !== "number") return null;
    // انقضای سمت سرور — توکن سرقت‌شده بعد از ۳۰ روز بی‌اعتبار می‌شود
    if (Date.now() - decoded.t > SESSION_MAX_AGE_MS) return null;

    // تأیید موفق → در کش ذخیره کن (با سقف اندازه، قدیمی‌ترین ورودی حذف می‌شود)
    if (sessionVerifyCache.size >= SESSION_VERIFY_CACHE_MAX) {
      const oldestKey = sessionVerifyCache.keys().next().value;
      if (oldestKey !== undefined) sessionVerifyCache.delete(oldestKey);
    }
    sessionVerifyCache.set(cacheKey, {
      decoded,
      exp: Date.now() + SESSION_VERIFY_CACHE_TTL_MS,
    });
    return decoded;
  } catch {
    return null;
  }
}

// Set session cookie
export async function setSession(userId: string) {
  const token = createSessionToken(userId);
  const cookieStore = await cookies();
  // secure: true در production (HTTPS)، false در development (HTTP)
  const isProduction = process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

// Clear session cookie
export async function clearSession() {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";
  // حذف cookie با همان تنظیماتی که set شده (secure, sameSite, path)
  // تا اطمینان حاصل شود cookie واقعاً پاک می‌شود
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // فوراً منقضی می‌شود
  });
  // همچنین delete را هم صدا بزن (برای اطمینان)
  cookieStore.delete(SESSION_COOKIE);
}

// Get current logged-in user (or null)
//
// NEW behavior — TermsVersion enforcement:
//   If the user's `acceptedTermsVersion` is strictly less than the latest active
//   TermsVersion, the user is treated as needing to re-accept the new terms.
//   In that case we:
//     1. Clear the session cookie (logout).
//     2. Set a marker cookie `sc_terms_pending=1` (1h TTL).
//     3. Return null.
//   The /api/auth/me route reads the marker cookie and returns
//   `termsUpdateRequired: true` so the frontend can show the
//   "new terms" modal on the auth screen before re-issuing OTP.
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const decoded = verifySessionToken(token);
    if (!decoded) return null;
    const user = await db.user.findUnique({
      where: { id: decoded.uid },
    });
    if (!user || user.isBlocked) return null;

    // ─── Terms version check ───
    // If the active TermsVersion is newer than what the user has accepted,
    // log them out and set a marker cookie so /api/auth/me can signal
    // the frontend to show the "new terms" modal.
    const currentTermsVersion = await getCurrentTermsVersion();
    if (currentTermsVersion > 0) {
      const userVersion = user.acceptedTermsVersion ?? 0;
      if (userVersion < currentTermsVersion) {
        // Outdated — logout user + set marker cookie
        // (clearSession uses the same cookies() instance; mutations are
        //  reflected in the response Set-Cookie header.)
        await clearSession();
        cookieStore.set(TERMS_PENDING_COOKIE, "1", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: TERMS_PENDING_COOKIE_MAX_AGE,
        });
        return null;
      }
    }

    return user;
  } catch {
    return null;
  }
}

// Require authentication - throws if not logged in
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

// Require admin role
export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

// Standard API error handler — logs 500-level errors to the database for admin review
export function apiError(error: unknown) {
  const msg = error instanceof Error ? error.message : "خطای ناشناخته";
  if (msg === "UNAUTHORIZED") {
    return Response.json({ error: "ابتدا وارد حساب کاربری شوید." }, { status: 401 });
  }
  if (msg === "FORBIDDEN") {
    return Response.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
  }
  if (msg === "PLAN_UPGRADE_REQUIRED") {
    return Response.json(
      {
        error: "این قابلیت در پلن شما فعال نیست. لطفاً پلن خود را ارتقا دهید.",
        code: "PLAN_UPGRADE_REQUIRED",
      },
      { status: 403 }
    );
  }
  console.error("[API Error]", msg);
  // Log 500-level errors to DB for admin review (fire-and-forget, never breaks the response)
  try {
    const stack = error instanceof Error ? error.stack : undefined;
    const userIdPromise = getCurrentUser()
      .then((u) => u?.id)
      .catch(() => undefined);
    userIdPromise
      .then((userId) =>
        logError({
          source: "api",
          message: msg,
          stack,
          statusCode: 500,
          userId,
        })
      )
      .catch(() => {});
  } catch {
    // never let logging break the response
  }
  return Response.json({ error: msg }, { status: 500 });
}
