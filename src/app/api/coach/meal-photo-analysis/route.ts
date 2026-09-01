import { NextRequest } from "next/server";
import { requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { avalaiClient, VISION_MODEL, withSystemDirectives } from "@/lib/fitness/ai";
import { savePrivateMediaFile } from "@/lib/fitness/private-media";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";

/**
 * POST /api/coach/meal-photo-analysis
 * آنالیز هوشمند عکس غذا با VLM (gemini-3.5-flash).
 *
 * - نیازمند پلن پیشرفته یا حرفه‌ای (قابلیت mealPhotoAnalysis)
 * - multipart/form-data با فیلد "image"
 * - حداکثر حجم: ۳۰ مگابایت (خودکار کاهش می‌یابد)
 * - فقط image/*
 *
 * خروجی (هم متن و هم ساختار JSON):
 *   {
 *     analysis: string,          // متن قابل نمایش (برای backward-compat)
 *     imageUrl: string,          // URL عکس بهینه‌شده ذخیره‌شده در سرور
 *     description: string,       // توضیح کوتاه
 *     calories: number,          // کالری تخمینی کل
 *     protein: number,           // گرم پروتئین
 *     carbs: number,             // گرم کربوهیدرات
 *     fat: number,               // گرم چربی
 *     items: Array<{ name, calories, protein, carbs, fat }>,  // مواد تشکیل‌دهنده
 *     isFood: boolean            // آیا عکس غذا بود؟ (false اگر عکس واضح نبود)
 *   }
 *
 * بهینه‌سازی تصویر: عکس قبل از ارسال به AI با sharp فشرده می‌شود
 * (resize حداکثر 1024px + WebP quality 75) → حجم کمتر، آپلود و تحلیل سریع‌تر.
 */

interface MealItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** استخراج JSON از پاسخ هوش مصنوعی (مدل‌ها گاهی ```json ... ``` یا متن اضافه برمی‌گردانند). */
function parseJsonFromContent(content: string): any | null {
  if (!content || typeof content !== "string") return null;
  let cleaned = content.trim();

  // تشخیص صفحه‌ی خطای HTML
  const looksLikeHtml = /^\s*<(?:html|!doctype|head|body|h1|div|p)\b/i.test(cleaned) ||
    (cleaned.startsWith("<") && cleaned.includes("</") && !cleaned.includes("{"));
  if (looksLikeHtml) return null;

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/** تبدیل اعداد انگلیسی به فارسی برای نمایش. */
function toPersian(n: number): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(Math.round(n * 10) / 10).replace(/\d/g, (d) => fa[Number(d)]);
}

export async function POST(req: NextRequest) {
  try {
    // گیت پلن: آنالیز عکس غذا فقط برای Advanced+
    const { userId } = await requirePlanCapability("mealPhotoAnalysis");

    // ─── M6: محدودیت نرخ — ۲۰ آنالیز در ساعت برای هر کاربر (کال VLM + ذخیره فایل)
    const rl = rateLimit(`meal-photo-analysis:${userId}`, 20, 60 * 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }

    const formData = await req.formData();
    const file = formData.get("image");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "تصویری ارسال نشده است." }, { status: 400 });
    }

    // اعتبارسنجی نوع فایل
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "فقط فایل تصویری مجاز است." }, { status: 400 });
    }

    // اعتبارسنجی حجم فایل (حداکثر ۳۰ مگابایت — خودکار کاهش می‌یابد)
    const MAX_SIZE = 30 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return Response.json({ error: "حداکثر حجم فایل ۳۰ مگابایت است." }, { status: 400 });
    }

    // ─── بهینه‌سازی عکس با sharp: resize حداکثر 1024px + WebP q75 ───
    // این کار حجم عکس را به‌شدت کاهش می‌دهد (مخصوصاً عکس‌های موبایل ۴-۱۲MP) و
    // هم آپلود سریع‌تر می‌شود و هم تحلیل AI سریع‌تر (token کمتر).
    const sharp = (await import("sharp")).default;
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const processed = await sharp(rawBuffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    // نام فایل شامل شناسه کاربر است تا سرو فایل (serve-upload) مالکیت را مستقیم تشخیص دهد
    const fileName = `meal-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const { url: imageUrl } = await savePrivateMediaFile("meal-analysis", fileName, processed);

    // base64 بهینه‌شده برای ارسال به VLM
    const mimeType = "image/webp";
    const base64Image = processed.toString("base64");

    // پرامپت فارسی برای VLM — خروجی JSON ساختاریافته
    const prompt = `این عکس غذا را تحلیل کن. مواد تشکیل‌دهنده، کالری تخمینی، پروتئین، کربوهیدرات و چربی را به فارسی تخمین بزن. فقط با ساختار JSON زیر پاسخ بده و هیچ متن اضافه‌ای ننویس:

{
  "isFood": true,
  "description": "توضیح کوتاه فارسی درباره غذا و ارزش غذایی آن",
  "calories": 350,
  "protein": 25,
  "carbs": 40,
  "fat": 12,
  "items": [
    { "name": "نام ماده غذایی", "calories": 120, "protein": 8, "carbs": 15, "fat": 3 }
  ]
}

اگر عکس غذا نیست یا واضح نیست، isFood را false قرار بده و description را توضیح بده. اعداد را به‌صورت عدد (نه رشته) بده.`;

    let parsed: any = null;
    let rawText = "";
    try {
      const response = await avalaiClient.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: "system",
            content: withSystemDirectives("تو متخصص تغذیه فیتاپ هستی. عکس غذا را تحلیل کن و اقلام غذایی، کالری و درشت‌مغذی‌ها را تخمین بزن. فقط JSON معتبر برگردان."),
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
      } as any);
      rawText = response.choices[0]?.message?.content || "";
      parsed = parseJsonFromContent(rawText);
    } catch (err) {
      console.error("[meal-photo-analysis] VLM error:", err);
      throw new Error("خطا در آنالیز عکس غذا. لطفاً دوباره تلاش کنید.");
    }

    // اگر JSON parse نشد، fallback به متن خام
    const isFood = parsed ? parsed.isFood !== false : true;
    const items: MealItem[] = Array.isArray(parsed?.items)
      ? parsed.items
          .map((it: any) => ({
            name: String(it?.name || "").trim(),
            calories: Number(it?.calories) || 0,
            protein: Number(it?.protein) || 0,
            carbs: Number(it?.carbs) || 0,
            fat: Number(it?.fat) || 0,
          }))
          .filter((it: MealItem) => it.name)
      : [];

    const calories = parsed ? Math.max(0, Math.round(Number(parsed.calories) || 0)) : 0;
    const protein = parsed ? Math.max(0, Number(parsed.protein) || 0) : 0;
    const carbs = parsed ? Math.max(0, Number(parsed.carbs) || 0) : 0;
    const fat = parsed ? Math.max(0, Number(parsed.fat) || 0) : 0;
    const description =
      (parsed && typeof parsed.description === "string" && parsed.description) ||
      (rawText ? rawText.slice(0, 400) : "تحلیلی دریافت نشد.");

    // ساخت متن قابل نمایش (برای backward-compat با UI قدیمی)
    const lines: string[] = [];
    if (!isFood) {
      lines.push("🚫 به‌نظر می‌رسد این عکس غذا نیست.");
    }
    lines.push(description);
    if (isFood) {
      lines.push("");
      lines.push(`🔥 کالری تخمینی: ${toPersian(calories)} کالری`);
      lines.push(`💪 پروتئین: ${toPersian(protein)}g`);
      lines.push(`🍞 کربو: ${toPersian(carbs)}g`);
      lines.push(`🥑 چربی: ${toPersian(fat)}g`);
      if (items.length > 0) {
        lines.push("");
        lines.push("🍽 غذاهای شناسایی‌شده:");
        for (const it of items) {
          lines.push(`• ${it.name} — ${toPersian(it.calories)} کالری`);
        }
      }
    }
    const analysis = lines.join("\n");

    return Response.json({
      analysis,
      imageUrl,
      description,
      calories,
      protein,
      carbs,
      fat,
      items,
      isFood,
    });
  } catch (e) {
    return apiError(e);
  }
}
