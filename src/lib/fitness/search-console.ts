/**
 * Google Search Console Integration (T4) — با مدیریت کوتای API رایگان (T6)
 *
 * احراز هویت: Search Console API فقط OAuth2/سرویس‌اکانت می‌پذیرد (کلید API ساده
 * پشتیبانی نمی‌شود — تست شد و ۴۰۱ برگرداند). روش استاندارد برای اپ‌های سرور:
 * سرویس‌اکانت گوگل کلاد + افزودن ایمیل SA به‌عنوان کاربر محدود (restricted/delegated)
 * در پراپرتی Search Console.
 *
 * راهنمای راه‌اندازی (در پنل ادمین هم نمایش داده می‌شود):
 *  ۱. console.cloud.google.com → پروژه جدید (یا موجود)
 *  ۲. APIs & Services → Library → «Google Search Console API» → Enable
 *  ۳. APIs & Services → Credentials → Create Credentials → Service Account
 *  ۴. تب Keys → Add Key → JSON → دانلود فایل JSON
 *  ۵. search.google.com/search-console → Settings → Users & permissions →
 *     Add user → ایمیل سرویس‌اکانت (xxx@yyy.iam.gserviceaccount.com) →
 *     دسترسی «Restricted»
 *  ۶. در پنل ادمین فیتاپ → تب سرچ کنسول: JSON + آدرس سایت را وارد کنید
 *
 * مدیریت کوتا (T6 — همیشه بهینه از API رایگان):
 *  - کش ۲۴ ساعته‌ی داده‌ها در دیتابیس (SiteSetting: gsc_cache)
 *  - سقف ۵ فراخوانی واقعی API در ساعت (rate limit درون‌حافظه‌ای)
 *  - توکن دسترسی SA فقط هر ~۵۰ دقیقه یک‌بار exchange می‌شود (کش درون‌حافظه‌ای)
 *  - دیتای ۲۸ روز، top 50 ردیف — سبک و کافی برای استراتژی
 */

import { createSign, createHash } from "crypto";
import { db } from "@/lib/db";

/* ─────────────────────── پروکسی برای APIهای گوگل (FIX ۴۰۳ ایران) ───────────────────────
 *
 * مشکل واقعی: برخی سرورها (به‌ویژه سرورهای داخل ایران) توسط گوگل روی
 * searchconsole.googleapis.com بلاک می‌شوند — پاسخ، صفحه‌ی HTML
 * «Error 403 (Forbidden)!!1» است بدون کد خطای JSON. کلید سرویس‌اکانت در
 * این حالت سالم است (تبادل توکن oauth2 موفق بوده) و مشکل فقط IP است.
 *
 * راه‌حل: عبور ترافیکِ فراخوانی‌های گوگل از پروکسی:
 *   GSC_PROXY_URL=http://user:pass@host:port   (یا socks)
 * در .env سرور — با ری‌استارت اپ، dispatcher تعویض می‌شود.
 */
let cachedDispatcher: object | null | undefined;

async function googleDispatch(): Promise<object | undefined> {
  if (cachedDispatcher !== undefined) return cachedDispatcher ?? undefined;
  const proxyUrl =
    process.env.GSC_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY;
  if (!proxyUrl) {
    cachedDispatcher = null;
    return undefined;
  }
  try {
    // undici کنار پروژه نصب است؛ ProxyAgent با fetch بومی Node سازگار است.
    const { ProxyAgent } = await import("undici");
    cachedDispatcher = new ProxyAgent(proxyUrl) as object;
    const safeHost = proxyUrl.split("@").pop() ?? proxyUrl;
    console.log(`[gsc] ترافیک API گوگل از پروکسی عبور می‌کند (${safeHost})`);
    return cachedDispatcher;
  } catch (e) {
    console.warn("[gsc] ساخت ProxyAgent ناموفق — اتصال مستقیم:", e);
    cachedDispatcher = null;
    return undefined;
  }
}

/** fetch با پروکسیِ اختیاری برای دامنه‌های گوگل (oauth2 / searchconsole) */
async function googleFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const dispatcher = await googleDispatch();
  if (dispatcher) {
    // Node fetch (undici) گزینه‌ی dispatcher را می‌فهمد — تایپ استاندارد ندارد.
    const initWithDispatcher = { ...init, dispatcher } as RequestInit;
    return fetch(url, initWithDispatcher);
  }
  return fetch(url, init);
}

/** آیا متن خطا صفحه‌ی HTML گوگل است (نه JSON خطای API)? */
function isHtmlErrorPage(msg: string): boolean {
  const head = msg.trim().slice(0, 200).toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

/** پیام قابل‌اقدام برای ۴۰۳ِ صفحه‌ی HTML — بلاکِ IP توسط گوگل (رایج در ایران) */
function googleIpBlockedMessage(): string {
  const hasProxy = Boolean(
    process.env.GSC_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  );
  return (
    "گوگل درخواست را در ورودی خود بلاک کرد (پاسخ HTML 403 — بدون کد خطای API). " +
    "شایع‌ترین علت: IP سرور شما توسط گوگل محدود شده است (برای سرورهای ایرانی بسیار رایج). " +
    "کلید سرویس‌اکانت شما احتمالاً سالم است — چون تبادل توکن موفق بوده و خطا از سمت فراخوانی API است. " +
    (hasProxy
      ? "پروکسی تنظیم شده ولی همچنان پاسخ ۴۰۳ می‌آید — آدرس/اعتبار پروکسی (GSC_PROXY_URL) را بررسی کنید. "
      : "راه‌حل: در فایل .env سرور، GSC_PROXY_URL=http://user:pass@host:port (پروکسی معتبر خارجی) را تنظیم و اپ را ری‌استارت کنید تا ترافیک گوگل از پروکسی عبور کند. ") +
    "اگر به پروکسی دسترسی ندارید، داده‌ی سرچ کنسول را می‌توان از سرور خارجی هم تست کرد (کلید و SA همان‌جا کار می‌کند)."
  );
}

/* ─────────────────────── انواع داده ─────────────────────── */

export interface GscQueryRow {
  keys: string[]; // [query] یا [page]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscDailyRow {
  date: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscOverview {
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number;
  daily: GscDailyRow[];
  queries: GscQueryRow[];
  pages: GscQueryRow[];
}

export interface GscCacheInfo {
  fetchedAt: string | null; // ISO
  stale: boolean;
  ttlHours: number;
}

export interface GscStatus {
  configured: boolean; // SA JSON + siteUrl موجود است
  siteUrl: string | null;
  lastError: string | null;
  cache: GscCacheInfo;
}

export interface GscResult {
  ok: boolean;
  data?: GscOverview;
  error?: string; // پیام فارسی قابل نمایش
  status: GscStatus;
}

/* ─────────────────────── تنظیمات ─────────────────────── */

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
}

const SETTING_SA = "gsc_service_account";
const SETTING_SITE = "gsc_site_url";
const SETTING_APIKEY = "gsc_api_key";
const SETTING_CACHE = "gsc_cache";

/** مدت اعتبار کش: ۲۴ ساعت (کوتا-محور) */
const CACHE_TTL_HOURS = 24;
/** حداکثر فراخوانی واقعی API در ساعت — محافظت از کوتای رایگان */
const MAX_FETCH_PER_HOUR = 5;
/** اندازه پنجره‌ی گزارش: ۲۸ روز آخر */
const REPORT_DAYS = 28;

async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string, label = ""): Promise<void> {
  await db.siteSetting.upsert({
    where: { key },
    create: { key, value, label },
    update: { value },
  });
}

/** پیکربندی سرچ کنسول — JSON سرویس‌اکانت و آدرس سایت */
export async function saveGscConfig(saJson: string, siteUrl: string, apiKey?: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = saJson.trim();
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as ServiceAccountJson;
      if (!parsed.client_email || !parsed.private_key) {
        return { ok: false, error: "JSON سرویس‌اکانت ناقص است — فیلدهای client_email و private_key لازم است." };
      }
    } catch {
      return { ok: false, error: "JSON سرویس‌اکانت نامعتبر است — کل فایل دانلودی از گوگل کلاد را کامل paste کنید." };
    }
  }
  const site = siteUrl.trim();
  // فرمت‌های مجاز: sc-domain:fittup.ir | https://fittup.ir | http://... | fittup.ir (دامنه‌ی خالی — بعداً خودکار با پراپرتی گوگل تطبیق می‌شود)
  if (site && !/^(sc-domain:|https?:\/\/)(\S+\.)\S+$/i.test(site) && !/^(\S+\.)\S{2,}$/i.test(site)) {
    return { ok: false, error: "آدرس سایت نامعتبر است. نمونه‌های درست: sc-domain:fittup.ir یا https://fittup.ir یا فقط fittup.ir" };
  }
  await setSetting(SETTING_SA, trimmed, "Google Search Console — Service Account JSON");
  await setSetting(SETTING_SITE, site, "Google Search Console — Site URL");
  if (apiKey !== undefined) await setSetting(SETTING_APIKEY, apiKey.trim(), "Google API Key");
  // تغییر پیکربندی → کش باطل
  await setSetting(SETTING_CACHE, "", "GSC cache");
  // ریست کش توکن دسترسی درون‌حافظه‌ای (ممیزی 2-c P2): تا ~۵۰ دقیقه توکن SA قدیمی
  // برمی‌گشت و تستِ فوری بعد از save-config با اعتبار قبلی انجام می‌شد (نتیجه گمراه‌کننده).
  tokenCache = null;
  return { ok: true };
}

export async function getGscApiKey(): Promise<string | null> {
  return getSetting(SETTING_APIKEY);
}

/* ─────────────────────── توکن OAuth2 (JWT RS256) ─────────────────────── */

let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccountJson): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // کش توکن — ۵۰ دقیقه (توکن گوگل ۱ ساعت اعتبار دارد؛ margin امن)
  if (tokenCache && tokenCache.exp > now + 300) return tokenCache.token;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const b64url = (o: object | string) =>
    Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64url(header)}.${b64url(claims)}`;
  let signature: Buffer;
  try {
    signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
  } catch {
    tokenCache = null;
    throw new Error(
      "کلید خصوصی سرویس‌اکانت نامعتبر است — کل فایل JSON دانلودی از گوگل کلاد را بدون تغییر paste کنید."
    );
  }
  const jwt = `${unsigned}.${signature.toString("base64url")}`;

  const res = await googleFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  // بدنه را اول به‌صورت متن می‌خوانیم — اگر صفحه‌ی HTML باشد (بلاک IP) JSON.parse می‌شکند
  const rawBody = await res.text().catch(() => "");
  let data: { access_token?: string; expires_in?: number; error_description?: string } = {};
  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    /* بدنه JSON نبود */
  }
  if (!res.ok || !data.access_token) {
    tokenCache = null;
    if (isHtmlErrorPage(rawBody)) {
      throw new Error(googleIpBlockedMessage());
    }
    throw new Error(
      data.error_description === "Invalid JWT Signature"
        ? "کلید خصوصی این سرویس‌اکانت دیگر در گوگل معتبر نیست — در گوگل کلاد (IAM → Service Accounts → fitup-551 → Keys → Add Key → JSON) یک کلید جدید بسازید و در تب پیکربندی جایگذاری کنید."
        : `احراز هویت گوگل ناموفق: ${data.error_description || res.status} — JSON سرویس‌اکانت و دسترسی آن به پراپرتی را بررسی کنید.`
    );
  }
  tokenCache = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return data.access_token;
}

/* ─────────────────────── rate limit درون‌حافظه‌ای ─────────────────────── */

const fetchTimestamps: number[] = [];
function tryAcquireFetchSlot(): boolean {
  const hourAgo = Date.now() - 3600_000;
  while (fetchTimestamps.length && fetchTimestamps[0] < hourAgo) fetchTimestamps.shift();
  if (fetchTimestamps.length >= MAX_FETCH_PER_HOUR) return false;
  fetchTimestamps.push(Date.now());
  return true;
}

/* ─────────────────────── فراخوانی API ─────────────────────── */

const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3/sites";

/** خواندن دقیق بدنه‌ی خطای گوگل — متن خام را هم برمی‌گرداند تا هیچ ۴۰۳ «خاموشی» نداشته باشیم */
async function readGoogleError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (raw) {
    try {
      const j = JSON.parse(raw) as { error?: { message?: string; errors?: { message?: string }[] } };
      const msg = j?.error?.message || j?.error?.errors?.[0]?.message;
      if (msg) return msg;
    } catch {
      // بدنه JSON نیست — خود متن را برسان (بریده‌شده)
      return raw.slice(0, 300);
    }
  }
  return `HTTP ${res.status}`;
}

/** آیا خطا «API غیرفعال در پروژه» است؟ — رایج‌ترین علت ۴۰۳ برای سرویس‌اکانت‌های تازه */
function isApiDisabledError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("has not been used in project") || m.includes("it is disabled") || m.includes("api not enabled");
}

/** استخراج لینک فعال‌سازی مستقیم API از پیام خطای گوگل (یا ساخت لینک با شماره پروژه) */
function extractEnableLink(msg: string): string | null {
  const inMsg = msg.match(/https:\/\/console[^\s"']+/)?.[0];
  if (inMsg) return inMsg;
  const project = /project (\d+)/.exec(msg)?.[1];
  if (project) return `https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=${project}`;
  return null;
}

/** فرسی‌سازی خطای «API غیرفعال» با لینک فعال‌سازی */
function apiDisabledMessage(msg: string): string {
  const link = extractEnableLink(msg);
  return `⚠️ API «Google Search Console» در پروژه گوگل‌کلاد شما فعال نیست — این رایج‌ترین علت خطای ۴۰۳ است.${link ? ` فعال‌سازی: ${link} — روی Enable کلیک کنید، ۱-۲ دقیقه صبر کنید و دوباره «ذخیره و تست اتصال» را بزنید.` : " در console.cloud.google.com → APIs & Services → Library → «Google Search Console API» → Enable"} (جزئیات: ${msg.slice(0, 160)})`;
}

async function querySearchAnalytics(
  token: string,
  siteUrl: string,
  body: Record<string, unknown>
): Promise<{ rows: GscQueryRow[] }> {
  const url = `${GSC_API}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const res = await googleFetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const msg = await readGoogleError(res);
    if (res.status === 403) {
      if (isApiDisabledError(msg)) throw new Error(apiDisabledMessage(msg));
      // صفحه‌ی HTML 403 = بلاکِ IP توسط گوگل (سرورهای ایرانی) — نه مشکل کلید
      if (isHtmlErrorPage(msg)) throw new Error(googleIpBlockedMessage());
      throw new Error(
        `دسترسی به پراپرتی «${siteUrl}» رد شد (403). علت‌ها: ۱) ایمیل سرویس‌اکانت در Search Console (Settings → Users & permissions) با دسترسی Restricted اضافه نشده، ۲) فرمت آدرس با پراپرتی یکسان نیست. جزئیات گوگل: ${msg}`
      );
    }
    throw new Error(`خطای Search Console API (${res.status}): ${msg}`);
  }
  const data = (await res.json().catch(() => ({}))) as { rows?: GscQueryRow[] };
  return { rows: data.rows ?? [] };
}

/* ─────────────────────── تشخیص خودکار پراپرتی (Diagnose) ─────────────────────── */

/** لیست پراپرتی‌هایی که سرویس‌اکانت به آن‌ها دسترسی دارد (sites.list — ۱ واحد کوتا)
 *
 * FIX: قبلاً دو باگ بود که sites.list را همیشه با خطای 400 «Invalid field selection
 * site» می‌شکست (و تشخیص خودکار پراپرتی‌ها هرگز کار نمی‌کرد):
 *  ۱) پارامتر fields غلط: "site.siteUrl,site.permissionLevel" → مسیر صحیح در
 *     پاسخ sites.list، "siteEntry" است نه "site"
 *  ۲) پارزش پاسخ: کلید واقعی JSON پاسخ "siteEntry" است نه "site"
 */
async function listAccessibleSites(token: string): Promise<{ ok: boolean; sites: string[]; error?: string }> {
  const res = await googleFetch(`${GSC_API}?fields=siteEntry(siteUrl,permissionLevel)`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const msg = await readGoogleError(res);
    if (res.status === 403 && isApiDisabledError(msg)) {
      return { ok: false, sites: [], error: apiDisabledMessage(msg) };
    }
    // صفحه‌ی HTML 403 = بلاکِ IP توسط گوگل (سرورهای ایرانی) — پیام قابل‌اقدام بده
    if (res.status === 403 && isHtmlErrorPage(msg)) {
      return { ok: false, sites: [], error: googleIpBlockedMessage() };
    }
    return { ok: false, sites: [], error: `خطای گوگل (${res.status}): ${msg}` };
  }
  const data = (await res.json().catch(() => ({}))) as { siteEntry?: { siteUrl?: string }[] };
  const sites = (data.siteEntry ?? []).map((s) => (s.siteUrl ?? "").trim()).filter(Boolean);
  return { ok: true, sites };
}

/**
 * تطبیق آدرس واردشده با پراپرتی‌های واقعی گوگل — کاربر لازم نیست فرمت دقیق بداند.
 * ترتیب: تطابق دقیق → نرمال‌شده (بدون اسلش/پروتکل/ بزرگ‌ و کوچک حروف) → دامنه‌ی خالی → www.
 */
export function resolveSiteUrl(entered: string, sites: string[]): { match: string | null; corrected: boolean } {
  const e = entered.trim();
  if (!e) return { match: null, corrected: false };
  const lower = e.toLowerCase();
  // ۱) تطابق دقیق
  const exact = sites.find((s) => s.toLowerCase() === lower);
  if (exact) return { match: exact, corrected: exact !== e };

  const norm = (u: string) => {
    let x = u.trim().toLowerCase();
    if (/^https?:\/\//.test(x) && x.endsWith("/")) x = x.slice(0, -1);
    return x;
  };
  const nE = norm(e);

  // ۲) پراپرتی دامنه‌ای — فقط با همان sc-domain: خودش معنی‌الیک است
  if (nE.startsWith("sc-domain:")) {
    const dm = sites.find((s) => norm(s) === nE);
    return { match: dm ?? null, corrected: dm !== null && dm !== e };
  }

  // ۳) URL-prefix نرمال‌شده (https://fittup.ir == https://fittup.ir/)
  const urlMatch = sites.find((s) => !s.toLowerCase().startsWith("sc-domain:") && norm(s) === nE);
  if (urlMatch) return { match: urlMatch, corrected: urlMatch !== e };

  // ۴) ورودی دامنه‌ی خالی (fittup.ir بدون پروتکل) — اول پراپرتی دامنه‌ای (پوشش کامل‌تر)، بعد https
  const bare = nE.replace(/^https?:\/\//, "");
  const dm = sites.find((s) => s.toLowerCase() === `sc-domain:${bare}`);
  if (dm) return { match: dm, corrected: true };
  const hm = sites.find((s) => ["https", "http"].some((p) => norm(s) === `${p}://${bare}`));
  if (hm) return { match: hm, corrected: true };

  // ۵) متغیر www — https://fittup.ir ↔ https://www.fittup.ir
  const stripWww = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const wm = sites.find((s) => {
    const ns = norm(s);
    return !ns.startsWith("sc-domain:") && stripWww(ns) === stripWww(nE);
  });
  if (wm) return { match: wm, corrected: true };

  return { match: null, corrected: false };
}

export interface GscTestResult {
  ok: boolean;
  message: string; // پیام فارسی کامل
  resolvedSiteUrl?: string | null;
  availableSites?: string[];
}

/**
 * تست اتصال کامل با تشخیص خودکار مرحله‌به‌مرحله:
 *  ۱. اعتبار JSON و کلید خصوصی  ۲. تبادل توکن  ۳. sites.list (API فعال؟ دسترسی؟)
 *  ۴. تطبیق/اصلاح خودکار آدرس پراپرتی  ۵. یک کوئری آزمایشی سبک
 */
export async function testGscConnection(): Promise<GscTestResult> {
  const [saRaw, siteUrl] = await Promise.all([getSetting(SETTING_SA), getSetting(SETTING_SITE)]);
  if (!saRaw || !siteUrl) {
    return { ok: false, message: "ابتدا JSON سرویس‌اکانت و آدرس سایت را ذخیره کنید." };
  }
  let sa: ServiceAccountJson;
  try {
    sa = JSON.parse(saRaw) as ServiceAccountJson;
  } catch {
    return { ok: false, message: "JSON سرویس‌اکانت ذخیره‌شده نامعتبر است — دوباره کل فایل را paste کنید." };
  }

  // ۲) توکن — خطای کلید/ایمیل اینجا مشخص می‌شود
  let token: string;
  try {
    token = await getAccessToken(sa);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "خطا در احراز هویت گوگل" };
  }

  // ۳) sites.list — تشخیص فعال‌بودن API و دسترسی واقعی
  const list = await listAccessibleSites(token);
  if (!list.ok) {
    return { ok: false, message: list.error ?? "خطای ناشناخته در sites.list", availableSites: [] };
  }
  if (list.sites.length === 0) {
    return {
      ok: false,
      message:
        "سرویس‌اکانت به هیچ پراپرتی‌ای دسترسی ندارد. در search.google.com/search-console → Settings → Users & permissions → Add user، ایمیل زیر را با دسترسی Restricted اضافه کنید و ~۵ دقیقه صبر کنید: " +
        sa.client_email,
      availableSites: [],
    };
  }

  // ۴) تطبیق آدرس — اگر فرمت دقیق نبود، خودمان اصلاحش می‌کنیم
  const r = resolveSiteUrl(siteUrl, list.sites);
  if (!r.match) {
    return {
      ok: false,
      message: `آدرس «${siteUrl}» با هیچ‌کدام از پراپرتی‌های قابل‌دسترس مطابقت ندارد. پراپرتی‌های شما: ${list.sites.join(" | ")} — عیناً یکی از همین‌ها (یا فقط نام دامنه) را وارد کنید.`,
      availableSites: list.sites,
    };
  }
  if (r.corrected) {
    await setSetting(SETTING_SITE, r.match, "Google Search Console — Site URL");
  }

  // ۵) کوئری آزمایشی سبک (تجمیع ۲۸ روز، بدون بُعد)
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - REPORT_DAYS * 86400_000);
    await querySearchAnalytics(token, r.match, {
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      dimensions: [],
      dataState: "final",
    });
    return {
      ok: true,
      message: r.corrected
        ? `فرمت پراپرتی به‌صورت خودکار به «${r.match}» اصلاح شد و اتصال برقرار است ✓`
        : "اتصال به سرچ کنسول برقرار است ✓",
      resolvedSiteUrl: r.match,
      availableSites: list.sites,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا در کوئری آزمایشی";
    return {
      ok: false,
      message: r.corrected ? `${msg} (آدرس به «${r.match}» اصلاح شد)` : msg,
      resolvedSiteUrl: r.match,
      availableSites: list.sites,
    };
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** واکشی کامل داده‌های ۲۸ روز: خلاصه + روند روزانه + کوئری‌ها + صفحه‌ها */
async function fetchFreshData(sa: ServiceAccountJson, siteUrl: string): Promise<GscOverview> {
  const token = await getAccessToken(sa);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - REPORT_DAYS * 86400_000);

  const base = { startDate: isoDate(startDate), endDate: isoDate(endDate), dataState: "final" };
  // سه کوئری در هر refresh — سبک برای کوتا
  const [aggRes, dailyRes, queriesRes, pagesRes] = await Promise.all([
    querySearchAnalytics(token, siteUrl, { ...base, dimensions: [] }),
    querySearchAnalytics(token, siteUrl, { ...base, dimensions: ["date"] }),
    querySearchAnalytics(token, siteUrl, { ...base, dimensions: ["query"], rowLimit: 50 }),
    querySearchAnalytics(token, siteUrl, { ...base, dimensions: ["page"], rowLimit: 50 }),
  ]);

  const agg = aggRes.rows[0];
  const daily: GscDailyRow[] = dailyRes.rows
    .map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    clicks: agg?.clicks ?? 0,
    impressions: agg?.impressions ?? 0,
    ctr: agg?.ctr ?? 0,
    position: agg?.position ?? 0,
    daily,
    queries: queriesRes.rows.sort((a, b) => b.clicks - a.clicks),
    pages: pagesRes.rows.sort((a, b) => b.clicks - a.clicks),
  };
}

/* ─────────────────────── کش و API عمومی ─────────────────────── */

interface CachePayload {
  data: GscOverview;
  fetchedAt: string;
}

/**
 * دریافت داده‌های سرچ کنسول — همیشه از کش (T6)؛ فقط در صورت کهنه‌شدن و
 * در محدوده‌ی rate limit از API واقعی واکشی می‌شود.
 */
export async function getSearchConsoleData(force = false): Promise<GscResult> {
  const [saRaw, siteUrl, cacheRaw] = await Promise.all([
    getSetting(SETTING_SA),
    getSetting(SETTING_SITE),
    getSetting(SETTING_CACHE),
  ]);

  const configured = !!saRaw && !!siteUrl;

  const readCache = (): CachePayload | null => {
    if (!cacheRaw) return null;
    try {
      const p = JSON.parse(cacheRaw) as CachePayload;
      return p?.data ? p : null;
    } catch {
      return null;
    }
  };
  const cached = readCache();
  const stale =
    !cached || Date.now() - new Date(cached.fetchedAt).getTime() > CACHE_TTL_HOURS * 3600_000;

  const statusBase: GscStatus = {
    configured,
    siteUrl: siteUrl || null,
    lastError: null,
    cache: { fetchedAt: cached?.fetchedAt ?? null, stale, ttlHours: CACHE_TTL_HOURS },
  };

  if (!configured) {
    return {
      ok: false,
      error: "سرچ کنسول پیکربندی نشده — JSON سرویس‌اکانت و آدرس سایت را در همین صفحه وارد کنید.",
      status: statusBase,
    };
  }

  // کش تازه (و بدون force) → سرو از کش
  if (!force && cached && !stale) {
    return { ok: true, data: cached.data, status: statusBase };
  }

  // کوتا: سقف فراخوانی ساعتی
  if (!tryAcquireFetchSlot()) {
    return {
      ok: false,
      error: "سقف فراخوانی ساعتی Search Console API پر است (۵ بار — محافظت از کوتای رایگان). بعداً یا از کش استفاده کنید.",
      status: {
        ...statusBase,
        lastError: "rate-limited",
        // اگر کشِ کهنه موجود است، همان را برگردان (بهتر از هیچ)
      },
      data: cached?.data,
    };
  }

  try {
    const sa = JSON.parse(saRaw!) as ServiceAccountJson;
    const data = await fetchFreshData(sa, siteUrl!);
    const payload: CachePayload = { data, fetchedAt: new Date().toISOString() };
    await setSetting(SETTING_CACHE, JSON.stringify(payload), "GSC cache");
    return {
      ok: true,
      data,
      status: { ...statusBase, cache: { fetchedAt: payload.fetchedAt, stale: false, ttlHours: CACHE_TTL_HOURS } },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطای ناشناخته در Search Console";
    // خطا → اگر کشِ کهنه داریم همان را برگردان
    return {
      ok: false,
      error: msg,
      status: { ...statusBase, lastError: msg },
      data: cached?.data,
    };
  }
}

/* ─────────────────────── خلاصه برای سئوی هوشمند ─────────────────────── */

/**
 * خلاصه‌ی متنی داده‌های GSC برای تزریق به پرامپت استراتژی/آپدیت محتوا (T4).
 * همیشه از کش می‌خواند — هیچ فراخوانی AI-ای هزینه‌ی API گوگل اضافه نمی‌کند (T6).
 */
export async function getGscSummaryForSeo(): Promise<string> {
  try {
    const res = await getSearchConsoleData(false);
    if (!res.ok || !res.data) return "";
    const d = res.data;
    const topQueries = d.queries
      .slice(0, 30)
      .map((q) => `- «${q.keys[0]}» — ${q.clicks} کلیک، ${q.impressions} نمایش، جایگاه ${q.position.toFixed(1)}`)
      .join("\n");
    const opportunities = d.queries
      .filter((q) => q.position >= 4 && q.position <= 20 && q.impressions >= 50)
      .slice(0, 15)
      .map((q) => `- «${q.keys[0]}» — جایگاه ${q.position.toFixed(1)} (فرصت رشد تا صفحه اول)`)
      .join("\n");
    const topPages = d.pages
      .slice(0, 15)
      .map((p) => `- ${p.keys[0]} — ${p.clicks} کلیک، جایگاه ${p.position.toFixed(1)}`)
      .join("\n");
    return `\n\n═══ داده‌های واقعی گوگل سرچ کنسول (۲۸ روز اخیر) — هنگام انتخاب کلمات و اولویت‌ها از این داده‌های واقعی استفاده کن ═══
جمع‌ کلیک‌ها: ${d.clicks} | نمایش‌ها: ${d.impressions} | CTR: ${(d.ctr * 100).toFixed(1)}٪ | میانگین جایگاه: ${d.position.toFixed(1)}

پرکلیک‌ترین کوئری‌های واقعی کاربران:
${topQueries || "(داده‌ای نیست)"}

فرصت‌های رشد (جایگاه ۴ تا ۲۰ = فاصله‌ی ضربه‌ای تا صفحه اول — اولویت آپدیت محتوا):
${opportunities || "(یافت نشد)"}

پرتکرارترین صفحه‌ها:
${topPages || "(داده‌ای نیست)"}
`;
  } catch {
    return "";
  }
}

/** آدرس صفحه‌ی مقاله‌ی سایت از slug — برای تطبیق کوئری/صفحه */
export function articlePageUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
  return `${base}/?article=${slug}`;
}

/** هش ساده برای idempotency رفرش محتوا */
export function hashString(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}
