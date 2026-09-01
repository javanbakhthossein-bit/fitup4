/**
 * AvalAI Image Generation Client
 * Model: gemini-3.1-flash-lite-image (Nano Banana 2 Lite)
 *
 * تولید تصویر با مدل Nano Banana 2 Lite از طریق AvalAI
 * - تأخیر زیر ۲ ثانیه، مقرون‌به‌صرفه در مقیاس
 * - پشتیبانی از ۱۴ نسبت ابعاد در وضوح 1K
 * - خروجی: base64 PNG (data URL)
 *
 * مستندات: https://api.avalai.ir/v1/chat/completions
 * با پارامتر modalities: ["image", "text"]
 */

const AVALAI_BASE_URL = process.env.AVALAI_BASE_URL || "https://api.avalai.ir/v1";
// NOTE: Hardcoded fallback API key removed for security.
// Image generation will fail loudly if the env var is missing.
const AVALAI_IMAGE_API_KEY = process.env.AVALAI_IMAGE_API_KEY;
if (!AVALAI_IMAGE_API_KEY) {
  console.warn(
    "[avalai-image] AVALAI_IMAGE_API_KEY not set — image generation will fail"
  );
}
const AVALAI_IMAGE_MODEL =
  process.env.AVALAI_IMAGE_MODEL || "gemini-3.1-flash-lite-image";

export type AspectRatio =
  | "1:1"
  | "3:2"
  | "2:3"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4"
  | "9:16"
  | "16:9"
  | "21:9";

export interface GenerateImageOptions {
  prompt: string;
  aspectRatio?: AspectRatio; // default "16:9"
  imageSize?: "1K"; // فقط 1K پشتیبانی می‌شود
  /** timeout milliseconds — default 60s */
  timeoutMs?: number;
}

export interface GeneratedImage {
  /** raw PNG buffer */
  buffer: Buffer;
  /** mime type (always image/png from AvalAI) */
  mimeType: string;
  /** accompanying text from model */
  caption: string;
  /** base64 data URL */
  dataUrl: string;
}

/**
 * تولید یک تصویر با استفاده از gemini-3.1-flash-lite-image
 * در صورت شکست، retry تا ۲ بار با تأخیر تصاعدی انجام می‌شود.
 */
export async function generateImage(
  opts: GenerateImageOptions
): Promise<GeneratedImage> {
  const {
    prompt,
    aspectRatio = "16:9",
    imageSize = "1K",
    timeoutMs = 90000,
  } = opts;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!AVALAI_IMAGE_API_KEY) {
        throw new Error(
          "AVALAI_IMAGE_API_KEY تنظیم نشده است — لطفاً متغیر محیطی را در .env قرار دهید."
        );
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${AVALAI_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AVALAI_IMAGE_API_KEY}`,
          },
          body: JSON.stringify({
            model: AVALAI_IMAGE_MODEL,
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
            generationConfig: {
              imageConfig: { aspectRatio, imageSize },
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(
            `AvalAI image API ${res.status}: ${errText.slice(0, 300)}`
          );
        }

        const data = await res.json();
        const message = data?.choices?.[0]?.message;
        if (!message) throw new Error("پاسخ نامعتبر از AvalAI (message missing)");

        const images = message.images || [];
        if (images.length === 0) {
          throw new Error("تصویری در پاسخ AvalAI وجود ندارد");
        }

        const imgUrl: string = images[0]?.image_url?.url || "";
        if (!imgUrl.startsWith("data:")) {
          throw new Error("فرمت data URL نامعتبر است");
        }

        // Parse data URL: data:image/png;base64,XXXX
        const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) throw new Error("data URL قابل parse نیست");

        const mimeType = match[1];
        const base64 = match[2];
        const buffer = Buffer.from(base64, "base64");
        const caption: string = message.content || "";

        return {
          buffer,
          mimeType,
          caption,
          dataUrl: imgUrl,
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (e: any) {
      lastErr = e;
      // exponential backoff
      const delayMs = 1500 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(
    `تولید تصویر پس از ۳ تلاش ناموفق بود: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}

/**
 * Generate multiple images in parallel with concurrency limit
 */
export async function generateImagesParallel(
  prompts: string[],
  aspectRatio: AspectRatio = "16:9",
  concurrency = 2
): Promise<(GeneratedImage | null)[]> {
  const results: (GeneratedImage | null)[] = new Array(prompts.length).fill(
    null
  );
  let cursor = 0;

  async function worker() {
    while (cursor < prompts.length) {
      const idx = cursor++;
      try {
        results[idx] = await generateImage({
          prompt: prompts[idx],
          aspectRatio,
        });
      } catch {
        results[idx] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, prompts.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}
