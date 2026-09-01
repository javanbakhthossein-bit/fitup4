import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requirePlanCapability, apiError } from "@/lib/fitness/auth";
import { aiChat, extractVideoFramesAsDataUrls } from "@/lib/fitness/ai";
import { generateTTSFullText } from "@/lib/fitness/tts";
import { rateLimit, rateLimitResponse } from "@/lib/fitness/rate-limit";
import { savePrivateMediaFile, absolutePathForUploadUrl } from "@/lib/fitness/private-media";
import type { OnboardingData } from "@/lib/fitness/types";

/** حداکثر طول متن برای TTS درون‌خطی پاسخ صوتی — هم‌سطح سقف /api/coach/tts (L1).
 * متن بلندتر قبل از تولید صوت بریده می‌شود تا پاسخ HTTP چند دقیقه بلاک نشود. */
const MAX_VOICE_TTS_CHARS = 4000;

/**
 * پارس امن JSON محتوای برنامه از DB (L7) — ردیف خراب نباید کل مسیر چت را با 500 بکشد.
 */
function safeParsePlanContent(raw: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    console.error("[chat] invalid plan JSON content in DB, skipping:", (e as Error).message);
    return null;
  }
}

/**
 * پارس data URL به mime و base64.
 * پشتیبانی از هر دو فرمت:
 *  - "data:image/jpeg;base64,...."
 *  - raw base64 با mime جداگانه
 */
function parseDataUrl(value: string, fallbackMime = "image/jpeg"): { mime: string; base64: string } {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mime: match[1], base64: match[2] };
  }
  return { mime: fallbackMime, base64: value };
}

/** ذخیره فایل base64 رسانه چت در uploads/chat/ (خارج از public — سرو با احراز هویت) و بازگرداندن URL نسبی */
async function saveBase64File(
  base64: string,
  mime: string,
  kind: "image" | "video"
): Promise<{ url: string; mime: string; size: number }> {
  const buffer = Buffer.from(base64, "base64");
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
  };
  const ext = extMap[mime] || (kind === "image" ? "jpg" : "mp4");
  const fileName = `chat-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { url } = await savePrivateMediaFile("chat", fileName, buffer);
  return { url, mime, size: buffer.length };
}

/**
 * ذخیره عکس با کاهش حجم خودکار:
 *  - resize به حداکثر 1600px
 *  - تبدیل به WebP (کیفیت ۷۵)
 *  - حذف فایل اصلی (فقط نسخه بهینه‌شده نگه داشته می‌شود)
 *  - بازگرداندن URL و base64 بهینه‌شده برای ارسال به VLM
 */
async function saveOptimizedImage(
  base64: string,
  mime: string
): Promise<{ url: string; mime: string; size: number; optimizedBase64: string }> {
  const sharp = (await import("sharp")).default;
  const buffer = Buffer.from(base64, "base64");

  // کاهش حجم + resize + WebP
  const processed = await sharp(buffer)
    .resize(1600, 1600, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer();

  const fileName = `chat-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { url } = await savePrivateMediaFile("chat", fileName, processed);

  const optimizedBase64 = processed.toString("base64");
  return {
    url,
    mime: "image/webp",
    size: processed.length,
    optimizedBase64,
  };
}

export async function GET() {
  try {
    const user = await requireAuth();
    // ─── H1: قبلاً asc + take 100 «قدیمی‌ترین» ۱۰۰ پیام را برمی‌گرداند — بعد از
    // ۱۰۰ پیام، پیام‌های جدید در تاریخچه هرگز نمایش داده نمی‌شدند. الگوی درست
    // (مثل POST): desc + take → آخرین پیام‌ها، سپس reverse برای ترتیب زمانی.
    const recentMessages = await db.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const messages = recentMessages.reverse();

    // اگر هیچ پیامی وجود ندارد → پیام خوش‌آمدگویی شخصی‌سازی شده بساز
    // (type annotation برای strict mode — قبلاً `= null` به‌تنهایی خطای TS می‌داد)
    let welcomeMessage: {
      id: string;
      role: string;
      content: string;
      mediaUrl: string | null;
      mediaType: string | null;
      createdAt: string;
    } | null = null;
    if (messages.length === 0) {
      // دریافت اطلاعات کاربر برای شخصی‌سازی
      const profile = await db.onboardingProfile.findUnique({ where: { userId: user.id } });
      const latestWeight = await db.weightLog.findFirst({
        where: { userId: user.id },
        orderBy: { loggedAt: "desc" },
        select: { weight: true },
      });
      const sub = await db.subscription.findFirst({
        where: { userId: user.id, status: "active" },
        orderBy: { endDate: "desc" },
      });

      const userName = user.name || "ورزشکار";
      const goal = profile?.goal === "fat_loss" ? "کاهش چربی" :
                   profile?.goal === "muscle_gain" ? "عضله‌سازی" :
                   profile?.goal === "endurance" ? "استقامت" :
                   profile?.goal === "strength" ? "قدرت" : "تناسب اندام";
      const currentWeight = latestWeight?.weight || profile?.weight || null;
      const planName = sub?.plan || user.planName || null;

      welcomeMessage = {
        id: "welcome_coach",
        role: "assistant",
        content: `سلام ${userName} عزیز! 👋💪\n\nمن فیتاپ هوشمندتم — مربی شخصی تو که ۲۴ ساعته اینجام.\n\n` +
          `✅ هدف تو: ${goal}\n` +
          (currentWeight ? `✅ وزن فعلی: ${currentWeight} کیلو\n` : "") +
          (planName ? `✅ پلن: ${planName}\n` : "") +
          `\nهر سوالی درباره تمرین، تغذیه، مکمل، فرم حرکات یا هر چیز دیگه داری بپرس. حتی می‌تونی عکس از غذات بفرستی تا کالری‌ش رو بگم! 📸\n\n` +
          `🤖 من به تمام اطلاعات پروفایل تو دسترسی دارم — وزن، قد، هدف، آسیب‌دیدگی‌ها، تجهیزات و برنامه‌هات. پس کاملاً شخصی‌سازی شده جواب می‌دم.\n\n` +
          `شروع کنیم؟ 🚀`,
        mediaUrl: null,
        mediaType: null,
        createdAt: new Date().toISOString(),
      };
    }

    return Response.json({
      messages: messages.length > 0 ? messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        mediaUrl: m.mediaUrl ?? null,
        mediaType: m.mediaType ?? null,
        createdAt: m.createdAt.toISOString(),
      })) : (welcomeMessage ? [welcomeMessage] : []),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    // گیت پلن: چت با مربی هوشمند فقط برای پلن پیشرفته و حرفه‌ای
    const { userId } = await requirePlanCapability("aiChat");
    // ─── H2/H6: محدودیت نرخ — ۳۰ پیام در دقیقه برای هر کاربر ───
    const rl = rateLimit(`coach-chat:${userId}`, 30, 60_000);
    if (!rl.ok) {
      return rateLimitResponse(rl.retryAfterSec);
    }
    const user = await requireAuth();
    const body = await req.json();
    const message: string = typeof body.message === "string" ? body.message : "";
    const imageBase64: string | undefined = typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
    const videoBase64: string | undefined = typeof body.videoBase64 === "string" ? body.videoBase64 : undefined;
    const isVoiceMessage: boolean = !!body.isVoice; // آیا پیام از طریق ویس ارسال شده؟

    if (!message && !imageBase64 && !videoBase64) {
      return Response.json({ error: "پیام خالی است." }, { status: 400 });
    }

    // متغیرهای مدیا
    let imageUrl: string | null = null;
    let videoUrl: string | null = null;
    // ─── پیوست چندوجهی مستقیم: عکس/چند فریم ویدیو به‌جای توصیف جداگانه توسط VLM ───
    // قبلاً دو رفت‌وبرگشت جداگانه (VLM توصیف + پاسخ متنی مربی) انجام می‌شد که
    // زمان پاسخ را دو برابر می‌کرد و از سقف تایم‌اوت گیت‌وی عبور می‌کرد
    // («Unexpected token '<'» یا «نمی‌توانم تحلیل کنم»). حالا عکس/فریم‌ها مستقیماً
    // به aiChat پیوست می‌شوند — مدل چندوجهی خودش تصاویر را می‌بیند و تحلیل می‌کند.
    // برای ویدیو چند فریم (به ترتیب زمانی) ارسال می‌شود تا مدل توالی حرکت را ببیند.
    let attachment: { dataUrls: string[]; kind: "image" | "video-frames" } | undefined;
    let imageAnalysisNote = ""; // فقط در صورت شکست مسیر چندوجهی به‌عنوان fallback
    let videoAnalysisNote = "";

    // پردازش عکس (نیازمند قابلیت chatImageUpload)
    if (imageBase64) {
      // گیت پلن برای ارسال عکس در چت
      await requirePlanCapability("chatImageUpload");
      // اعتبارسنجی حجم (حداکثر ۳۰ مگابایت — خودکار کاهش می‌یابد)
      const MAX_IMG = 40 * 1024 * 1024; // base64 ~۱.۳۳x
      if (imageBase64.length > MAX_IMG) {
        return Response.json({ error: "حجم عکس بیش از حد مجاز (۳۰ مگابایت) است." }, { status: 400 });
      }
      const parsed = parseDataUrl(imageBase64, "image/jpeg");
      if (!parsed.mime.startsWith("image/")) {
        return Response.json({ error: "فقط فایل تصویری مجاز است." }, { status: 400 });
      }
      // ─── بهینه‌سازی عکس با sharp: resize + WebP ───
      const saved = await saveOptimizedImage(parsed.base64, parsed.mime);
      imageUrl = saved.url;

      // پیوست مستقیم عکس بهینه‌شده به کال مربی (بدون VLM جدا)
      attachment = {
        dataUrls: [`data:${saved.mime};base64,${saved.optimizedBase64}`],
        kind: "image",
      };
    }

    // پردازش ویدیو (نیازمند قابلیت chatVideoUpload)
    if (videoBase64) {
      // گیت پلن برای ارسال ویدیو در چت
      await requirePlanCapability("chatVideoUpload");
      // اعتبارسنجی حجم (حداکثر ۳۰ مگابایت قبل از base64 ≈ ۴۰ مگابایت base64)
      const MAX_VID = 40 * 1024 * 1024;
      if (videoBase64.length > MAX_VID) {
        return Response.json({ error: "حجم ویدیو بیش از حد مجاز (۳۰ مگابایت) است." }, { status: 400 });
      }
      const parsed = parseDataUrl(videoBase64, "video/mp4");
      if (!parsed.mime.startsWith("video/")) {
        return Response.json({ error: "فقط فایل ویدیویی مجاز است." }, { status: 400 });
      }
      const saved = await saveBase64File(parsed.base64, parsed.mime, "video");
      videoUrl = saved.url;

      // ─── استخراج چند فریم کلیدی ویدیو با ffmpeg و پیوست مستقیم به کال مربی ───
      // مدل چندوجهی ویدیو نمی‌بیند؛ چند فریم از تایم‌لاین (به ترتیب زمانی) به
      // پیوست اضافه می‌شود تا مربی توالی حرکت را ببیند و فرم/تکنیک را تحلیل کند.
      try {
        const videoFilePath = absolutePathForUploadUrl(videoUrl);
        const frameDataUrls = await extractVideoFramesAsDataUrls(videoFilePath, 6);
        if (frameDataUrls.length > 0) {
          attachment = { dataUrls: frameDataUrls, kind: "video-frames" };
        } else {
          videoAnalysisNote = `\n\n[کاربر ویدیو ارسال کرده است اما استخراج فریم از آن ناموفق بود. لطفاً از کاربر بخواه توضیح بدهد یا عکس بفرستد.]`;
        }
      } catch (err) {
        console.error("[chat] video frame extraction failed:", err);
        videoAnalysisNote = `\n\n[کاربر ویدیو ارسال کرده است اما استخراج فریم از آن ناموفق بود. لطفاً از کاربر بخواه توضیح بدهد یا عکس بفرستد.]`;
      }
    }

    // ساخت محتوای نهایی پیام کاربر (شامل یادآوری مدیا برای مربی)
    let finalMessage = message;
    if (imageAnalysisNote) {
      finalMessage = `${message || "(بدون متن)"}${imageAnalysisNote}`;
    }
    if (videoAnalysisNote) {
      finalMessage = `${finalMessage}${message || imageAnalysisNote ? "\n\n" : ""}${videoAnalysisNote}`;
    }

    // ذخیره پیام کاربر (با URL مدیا)
    const userMsg = await db.chatMessage.create({
      data: {
        userId: user.id,
        role: "user",
        content: message || (imageUrl ? "📷 عکس" : videoUrl ? "🎬 ویدیو" : ""),
        mediaUrl: imageUrl ?? videoUrl,
        mediaType: imageUrl ? "image" : videoUrl ? "video" : null,
      },
    });

    // Load onboarding profile for context
    const profile = await db.onboardingProfile.findUnique({
      where: { userId: user.id },
    });

    // Helper برای پارس کردن فیلدهای لیستی ذخیره‌شده به‌صورت JSON
    const safeParseList = (raw: string | null | undefined): string[] => {
      if (!raw) return [];
      const t = raw.trim();
      if (!t) return [];
      try {
        const p = JSON.parse(t);
        if (Array.isArray(p)) return p.map((x) => String(x));
        if (typeof p === "string") return p.split(",").map((s) => s.trim()).filter(Boolean);
        return [];
      } catch {
        return t.split(",").map((s) => s.trim()).filter(Boolean);
      }
    };

    let onboarding: OnboardingData | null = null;
    if (profile) {
      // ─── buildUserContext() تمام فیلدها را می‌خواند. برای اینکه مربی هوشمند
      // همیشه به آخرین اطلاعات کاربر (شامل فیلدهای اختیاری حرفه‌ای) دسترسی داشته
      // باشد، تمام فیلدهای ذخیره‌شده در OnboardingProfile را اینجا می‌گذاریم. ───
      onboarding = {
        gender: profile.gender as OnboardingData["gender"],
        age: profile.age,
        height: profile.height,
        weight: profile.weight,
        targetWeight: profile.targetWeight ?? undefined,
        goal: profile.goal as OnboardingData["goal"],
        activityLevel: profile.activityLevel as OnboardingData["activityLevel"],
        workoutDays: profile.workoutDays,
        workoutDaysList: safeParseList(profile.workoutDaysList),
        workoutPlace: profile.workoutPlace as OnboardingData["workoutPlace"],
        equipment: safeParseList(profile.equipment),
        diseases: profile.diseases,
        injuries: profile.injuries,
        allergies: profile.allergies,
        dietType: profile.dietType as OnboardingData["dietType"],
        // Professional advanced fields
        trainingExperience: (profile.trainingExperience ?? undefined) as OnboardingData["trainingExperience"],
        previousTrainingType: profile.previousTrainingType ?? undefined,
        drugAllergies: profile.drugAllergies ?? undefined,
        currentMedications: profile.currentMedications ?? undefined,
        maxLifts: profile.maxLifts ?? undefined,
        // Comprehensive professional fields
        bodyFrame: (profile.bodyFrame ?? undefined) as OnboardingData["bodyFrame"],
        sleepHours: profile.sleepHours ?? undefined,
        stressLevel: profile.stressLevel ?? undefined,
        waterHabit: profile.waterHabit ?? undefined,
        targetDate: profile.targetDate ?? undefined,
        workoutTime: (profile.workoutTime ?? undefined) as OnboardingData["workoutTime"],
        medicalConditions: safeParseList(profile.medicalConditions) as OnboardingData["medicalConditions"],
        currentSupplements: profile.currentSupplements ?? undefined,
        dislikedFoods: profile.dislikedFoods ?? undefined,
        preferredCuisine: (profile.preferredCuisine ?? undefined) as OnboardingData["preferredCuisine"],
      };
    }

    // ─── Build comprehensive athletic profile for long-term memory ───
    // فیتاپ هوشمند به تمام پرونده ورزشی کاربر دسترسی دارد:
    const [workoutPlan, mealPlan, recentWeights, latestCheckup, programRequests] = await Promise.all([
      db.workoutPlan.findFirst({ where: { userId: user.id, active: true }, orderBy: { createdAt: "desc" } }),
      db.mealPlan.findFirst({ where: { userId: user.id, active: true }, orderBy: { createdAt: "desc" } }),
      db.weightLog.findMany({ where: { userId: user.id }, orderBy: { loggedAt: "desc" }, take: 5 }),
      db.checkup.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      db.programRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    ]);

    // Build athletic profile context string
    const athleticProfile: string[] = [];
    if (workoutPlan) {
      // L7: پارس امن — ردیف خراب فقط این بخش کانتکست را حذف می‌کند نه کل چت را
      const wc = safeParsePlanContent(workoutPlan.content);
      if (wc) {
        athleticProfile.push(`\n📋 برنامه تمرینی فعلی:\n- هدف هفته: ${wc.weeklyGoal || "نامشخص"}\n- تعداد روزهای تمرین: ${wc.days?.length || 0}\n- نکات هفته: ${wc.notes?.slice(0, 100) || "ندارد"}`);
      }
    }
    if (mealPlan) {
      const mc = safeParsePlanContent(mealPlan.content);
      if (mc) {
        athleticProfile.push(`\n🍽 برنامه غذایی فعلی:\n- کالری هدف: ${mc.totalCalories || "نامشخص"} کالری\n- تعداد وعده‌ها: ${mc.meals?.length || 0}\n- پروتئین: ${mc.totalProtein || 0}g، کربو: ${mc.totalCarbs || 0}g، چربی: ${mc.totalFat || 0}g\n- آب روزانه: ${mc.waterLiters || 2.5} لیتر`);
        if (mc.supplements?.length) {
          athleticProfile.push(`\n💊 مکمل‌های فعلی: ${mc.supplements.map((s: any) => `${s.name} (${s.dose})`).join("، ")}`);
        }
      }
    }
    if (recentWeights.length > 0) {
      const latest = recentWeights[0];
      const first = recentWeights[recentWeights.length - 1];
      const change = (latest.weight - first.weight).toFixed(1);
      athleticProfile.push(`\n⚖️ پیشرفت وزن:\n- وزن فعلی: ${latest.weight} کیلوگرم\n- تغییر اخیر: ${Number(change) > 0 ? "+" : ""}${change} کیلوگرم\n- تاریخ آخرین ثبت: ${latest.loggedAt.toLocaleDateString("fa-IR")}`);
    }
    if (latestCheckup) {
      athleticProfile.push(`\n📊 آخرین چکاپ:\n- وزن: ${latestCheckup.weight} کیلوگرم${latestCheckup.bodyFatPercent ? `\n- چربی بدن: ${latestCheckup.bodyFatPercent}٪` : ""}${latestCheckup.waistMeasurement ? `\n- دور کمر: ${latestCheckup.waistMeasurement} سانتی‌متر` : ""}${latestCheckup.armMeasurement ? `\n- دور بازو: ${latestCheckup.armMeasurement} سانتی‌متر` : ""}\n- خستگی: ${latestCheckup.fatigueLevel}/5\n- کیفیت خواب: ${latestCheckup.sleepQuality}/5\n- رعایت رژیم: ${latestCheckup.dietAdherence}/5\n- رعایت تمرین: ${latestCheckup.workoutAdherence}/5`);
    }
    if (programRequests.length > 0) {
      athleticProfile.push(`\n📝 تاریخچه برنامه‌ها: ${programRequests.length} دوره تمرینی (${programRequests[0].status === "ready" ? "آماده" : programRequests[0].status === "pending" ? "در انتظار" : "نامشخص"})`);
    }

    // Load recent history (last 15 messages for faster AI response)
    // ─── H3: قبلاً orderBy asc + take 15 «قدیمی‌ترین» ۱۵ پیام را می‌آورد (حافظه چت خراب بود).
    // الگوی درست: desc + take → آخرین پیام‌ها، سپس reverse برای ترتیب زمانی.
    // پیام جاری (userMsg) حذف می‌شود چون جداگانه به‌عنوان پیام آخر به AI پاس داده می‌شود.
    const recentHistory = await db.chatMessage.findMany({
      where: { userId: user.id, id: { not: userMsg.id } },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
    const history = recentHistory.reverse();

    // Get AI response — pass user's plan tier + full athletic profile for comprehensive guidance
    // عکس/فریم ویدیو مستقیماً به پیام اضافه می‌شود (attachment) — یک رفت‌وبرگشت AI
    const userPlan = (user.planName as any) ?? null;
    const fullContext = athleticProfile.join("\n");
    let aiResponse: string;
    try {
      aiResponse = await aiChat(
        onboarding,
        history.map((h) => ({ role: h.role, content: h.content })),
        finalMessage + (fullContext ? `\n\n[سیستم - پرونده ورزشی کاربر]:${fullContext}` : ""),
        userPlan,
        attachment
      );
    } catch (err) {
      // ─── حذف ردیف پیام کاربر تا یتیم نماند (باگ ممیزی 2-b) ───
      // پیام کاربر قبل از کال AI ذخیره شده؛ اگر AI شکست بخورد و ردیف بماند،
      // بعد از رفرش پیام بی‌جواب ظاهر می‌شود و ارسال مجدد ردیف تکراری می‌سازد.
      // حذف best-effort — خطای حذف نباید خطای اصلی را بپوشاند.
      try {
        await db.chatMessage.delete({ where: { id: userMsg.id } });
      } catch (delErr) {
        console.error("[chat] failed to delete orphaned user message:", delErr);
      }
      throw err;
    }

    // Save AI response
    const aiMsg = await db.chatMessage.create({
      data: { userId: user.id, role: "assistant", content: aiResponse },
    });

    // ─── تولید پاسخ صوتی (TTS) فقط اگر کاربر ویس فرستاده باشد ───
    // وقتی کاربر ویس می‌فرستد → پاسخ هم متن + هم صوت
    // وقتی کاربر متن می‌فرستد → فقط متن (کاربر می‌تواند با دکمه «گوش دادن» صوت تولید کند)
    // صدا بر اساس جنسیت کاربر انتخاب می‌شود: مرد→alloy، زن→shimmer
    let audioUrl: string | null = null;
    if (isVoiceMessage && aiResponse.length > 10) {
      try {
        // تعیین صدای TTS بر اساس جنسیت کاربر
        let ttsVoice: string = "alloy"; // پیش‌فرض: صدای مرد
        if (profile?.gender === "female") {
          ttsVoice = "shimmer"; // صدای زن
        }

        // استفاده از shared TTS utility با retry + fallback + chunking
        // L1: سقف طول متن مثل /api/coach/tts — پاسخ ۱۰هزار کاراکری نباید چند دقیقه پاسخ را بلاک کند
        const audioBuffer = await generateTTSFullText(
          aiResponse.slice(0, MAX_VOICE_TTS_CHARS),
          ttsVoice
        );

        if (audioBuffer) {
          const fileName = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
          const { url } = await savePrivateMediaFile("chat/tts", fileName, Buffer.from(audioBuffer));
          audioUrl = url;
          // ─── AI-MEDIA#9: ذخیره URL صوت در ردیف پیام AI — پخش مجدد از تاریخچه
          // باید همین فایل را استفاده کند، نه اینکه TTS از نو تولید شود (فایل‌های یتیم).
          await db.chatMessage
            .update({
              where: { id: aiMsg.id },
              data: { mediaUrl: audioUrl, mediaType: "audio" },
            })
            .catch((err: unknown) =>
              console.error("[chat] failed to persist TTS audioUrl on message:", err)
            );
        }
      } catch (err) {
        console.error("[chat] TTS generation failed:", err);
      }
    }

    return Response.json({
      userMessage: {
        id: userMsg.id,
        role: userMsg.role,
        content: userMsg.content,
        mediaUrl: userMsg.mediaUrl ?? null,
        mediaType: userMsg.mediaType ?? null,
        createdAt: userMsg.createdAt.toISOString(),
      },
      aiMessage: {
        id: aiMsg.id,
        role: aiMsg.role,
        content: aiMsg.content,
        mediaUrl: audioUrl, // اگر پاسخ صوتی دارد، URL آن اینجا است
        mediaType: audioUrl ? "audio" : null,
        createdAt: aiMsg.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
