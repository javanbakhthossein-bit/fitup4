/**
 * ابزار مشترک برای تولید صدا (TTS) از طریق AvalAI.
 *
 * شامل:
 *  - retry logic برای خطاهای گذرا (429, 500, 502, 503, 504)
 *  - fallback به مدل tts-1 اگر gemini-2.5-flash-tts خطا داد
 *  - timeout ۳۰ ثانیه‌ای برای هر درخواست
 *  - logging کامل برای دیباگ
 *
 * استفاده:
 *   import { generateTTS } from "@/lib/fitness/tts";
 *   const mp3Buffer = await generateTTS("سلام", "alloy");
 *   if (!mp3Buffer) { // خطا }
 */

const TTS_MODELS = ["gemini-2.5-flash-tts", "tts-1"];
const MAX_RETRY = 3;
const RETRY_DELAY_MS = 1200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * تولید MP3 از متن فارسی با استفاده از AvalAI TTS.
 *
 * @param text متن فارسی (حداکثر ۹۰۰ کاراکتر توصیه می‌شود — برای متن طولانی‌تر، chunk کنید)
 * @param voice صدا: "alloy" (مرد) یا "shimmer" (زن)
 * @returns ArrayBuffer شامل MP3، یا null اگر همه تلاش‌ها ناموفق بود
 */
export async function generateTTS(text: string, voice: string): Promise<ArrayBuffer | null> {
  const apiKey = process.env.AVALAI_TTS_API_KEY || process.env.AVALAI_API_KEY;
  const baseURL = process.env.AVALAI_BASE_URL || "https://api.avalai.ir/v1";

  if (!apiKey) {
    console.error("[tts] no API key configured (AVALAI_TTS_API_KEY / AVALAI_API_KEY)");
    return null;
  }

  let lastErr: unknown = null;

  for (const model of TTS_MODELS) {
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      try {
        if (attempt > 0) {
          await sleep(RETRY_DELAY_MS * attempt);
        }

        const res = await fetch(`${baseURL}/audio/speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            voice,
            input: text,
            response_format: "mp3",
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 0) {
            return buf;
          }
          console.warn(`[tts] empty response (model=${model}, attempt=${attempt})`);
          continue;
        }

        const errText = await res.text().catch(() => "");
        const retryable = [429, 500, 502, 503, 504].includes(res.status);
        console.error(
          `[tts] AvalAI error: model=${model} status=${res.status} attempt=${attempt} body=${errText.slice(0, 300)}`
        );
        lastErr = new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);

        if (!retryable) {
          // خطای غیرقابل retry → مدل بعدی
          break;
        }
        // در غیر این صورت → retry با همین مدل
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[tts] fetch error: model=${model} attempt=${attempt} err=${msg}`);
      }
    }
  }

  console.error("[tts] all models/retries exhausted. Last error:", lastErr);
  return null;
}

/**
 * تقسیم متن طولانی به chunk‌های ۹۰۰ کاراکتری در مرز جمله‌ها.
 * برای متن‌های طولانی که از حد AvalAI (۹۰۰ کاراکتر) بیشتر هستند.
 */
export function chunkTextForTTS(text: string, maxChunk = 900): string[] {
  if (text.length <= maxChunk) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxChunk) {
      chunks.push(remaining);
      break;
    }
    // پیدا کردن آخرین نقطه/علامت سوال در maxChunk کاراکتر آخر
    let cutIdx = remaining.lastIndexOf("۔", maxChunk);
    if (cutIdx === -1 || cutIdx < maxChunk * 0.5) cutIdx = remaining.lastIndexOf(".", maxChunk);
    if (cutIdx === -1 || cutIdx < maxChunk * 0.5) cutIdx = remaining.lastIndexOf("؟", maxChunk);
    if (cutIdx === -1 || cutIdx < maxChunk * 0.5) cutIdx = remaining.lastIndexOf("\n", maxChunk);
    if (cutIdx === -1 || cutIdx < maxChunk * 0.5) cutIdx = maxChunk;
    else cutIdx += 1;
    chunks.push(remaining.slice(0, cutIdx));
    remaining = remaining.slice(cutIdx).trim();
  }
  return chunks;
}

/**
 * تولید MP3 از متن فارسی (هر طولی) — خودش chunk می‌کند.
 * برمی‌گرداند: ArrayBuffer شامل MP3 ترکیب‌شده، یا null.
 */
export async function generateTTSFullText(text: string, voice: string): Promise<ArrayBuffer | null> {
  const chunks = chunkTextForTTS(text);
  const audioChunks: ArrayBuffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const buf = await generateTTS(chunks[i], voice);
    if (!buf) {
      console.error(`[tts] chunk ${i + 1}/${chunks.length} failed`);
      return null;
    }
    audioChunks.push(buf);
  }

  // ترکیب MP3 chunks (MP3 فریم‌بنیاد است → concatenation باینری کار می‌کند)
  const totalLength = audioChunks.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of audioChunks) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return combined.buffer;
}
