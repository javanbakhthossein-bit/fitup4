import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, apiError } from "@/lib/fitness/auth";
import { createNotification } from "@/lib/fitness/notifications";
import { SUBSCRIPTION_PLANS, toPersianDigits } from "@/lib/fitness/types";
import { PENDING_WINDOW_DAYS } from "@/lib/fitness/subscription";

/**
 * POST /api/admin/users/[id]/manage-subscription
 *
 * مدیریت اشتراک کاربر توسط ادمین. ۵ اکشن پشتیبانی می‌شود:
 *
 * ۱. action: "remove"
 *    - اشتراک فعال فعلی را به "expired" تغییر می‌دهد.
 *    - planName/planExpiresAt/planStartedAt روی User را null می‌کند.
 *    - نوتیف به کاربر ارسال می‌شود.
 *
 * ۲. action: "activate"
 *    - پلن جدید را فعال می‌کند (با تمام اتفاقات زمان خرید: اشتراک فعال، ProgramRequest، نوتیف).
 *    - پلن قبلی فعال را expire می‌کند.
 *    - body: { plan: "ultimate", days?: 45 }
 *    - اگر days ارسال نشود، از durationDays پلن استفاده می‌شود.
 *
 * ۳. action: "extend"
 *    - تعداد روز مشخص‌شده (days) را به اشتراک فعال فعلی اضافه می‌کند.
 *    - body: { days: 20 }
 *
 * ۴. action: "reduce"
 *    - تعداد روز مشخص‌شده (days) را از اشتراک فعال فعلی کم می‌کند.
 *    - body: { days: 20 }
 *
 * ۵. action: "activate_days"
 *    - یک پلن جدید را برای مدت مشخص (days) از الان فعال می‌کند.
 *    - body: { plan: "ultimate", days: 20 }
 *    - این اکشن برای آزمایش یا پاداش استفاده می‌شود.
 */
interface ManageBody {
  action: "remove" | "activate" | "extend" | "reduce" | "activate_days";
  plan?: string; // basic | standard | advanced | ultimate
  days?: number;
}

const VALID_PLANS = ["basic", "standard", "advanced", "ultimate"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = (await req.json()) as ManageBody;
    const action = body.action;

    // بررسی وجود کاربر
    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return Response.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }

    const now = new Date();

    // ─── اکشن ۱: حذف پلن فعلی ───
    if (action === "remove") {
      // همه اشتراک‌های active/pending کاربر را expire کن (تاریخچه باقی می‌ماند)
      // مهم: endDate اصلی حفظ می‌شود (دیگر overwrite نمی‌شود) و به‌جای آن cancelledAt = now
      // تنظیم می‌کنیم. اینطبی در پنل کاربر، بازه واقعی برنامه نمایش داده می‌شود:
      // از startDate (شروع برنامه) تا cancelledAt (لحظه لغو توسط ادمین).
      await db.subscription.updateMany({
        where: { userId: id, status: { in: ["active", "pending"] } },
        data: { status: "expired", cancelledAt: now },
      });
      // برنامه‌های تمرینی/غذایی فعال کاربر را به active=false تبدیل کن
      // (در تاریخچه باقی می‌مانند اما دیگر به‌عنوان «جاری» شناخته نمی‌شوند)
      await db.workoutPlan.updateMany({
        where: { userId: id, active: true },
        data: { active: false },
      });
      await db.mealPlan.updateMany({
        where: { userId: id, active: true },
        data: { active: false },
      });
      // درخواست‌های برنامه در حال انتظار/در حال تولید را لغو کن (pending_body_photo | generating | pending)
      // تا برنامه‌ای در پس‌زمینه ساخته نشود.
      await db.programRequest.updateMany({
        where: {
          userId: id,
          status: { in: ["pending", "generating", "pending_body_photo"] },
        },
        data: { status: "failed" },
      });
      // پاک‌سازی فیلدهای پلن روی User (planName/planExpiresAt/planStartedAt = null)
      // مهم: planExpiresAt را null می‌کنیم چون planName=null است و کاربر بدون پلن است.
      // تاریخ لغو در subscription.endDate ذخیره شده و در برنامه‌ها/PDF از آنجا خوانده می‌شود.
      await db.user.update({
        where: { id },
        data: {
          planName: null,
          planExpiresAt: null,
          planStartedAt: null,
        },
      });
      await createNotification(
        id,
        "system",
        "اشتراک شما توسط ادمین لغو شد ⚠️",
        "اشتراک فعلی شما توسط ادمین غیرفعال شد. در صورت سوال، با پشتیبانی در ارتباط باشید.",
        "?tab=plans",
        { from: "admin", action: "remove" }
      );
      return Response.json({ ok: true, action: "remove" });
    }

    // ─── اکشن ۲: فعال‌سازی پلن جدید ───
    // این اکشن دقیقاً همان روال خرید موفق در /api/payment/verify را طی می‌کند:
    //   • اشتراک قبلی expire می‌شود.
    //   • اشتراک جدید ساخته می‌شود:
    //       - basic/standard → status="active" با startDate=now و endDate=now+durationDays.
    //       - advanced/ultimate → status="pending" با startDate/endDate=null (۴۵ روز از
    //         زمان تکمیل پیش‌نیازها شروع می‌شود — یعنی ارسال عکس بدن).
    //   • ProgramRequest ساخته می‌شود:
    //       - basic/standard → status="generating" و برنامه در پس‌زمینه تولید می‌شود.
    //       - advanced/ultimate → status="pending_body_photo" (تا زمان تکمیل پیش‌نیازها).
    //   • فیلدهای planName/planStartedAt/planExpiresAt روی User آپدیت می‌شود
    //     (برای advanced/ultimate مقدار null می‌شود تا در submit-body-analysis ست شود).
    //   • شمارنده‌های AI (videoAnalysisUsed, bloodTestUsed) و وضعیت‌های videoStatus/
    //     bloodTestStatus ریست می‌شوند.
    //   • نوتیف‌های لازم ارسال می‌شود (شامل نوتیف‌های پیش‌نیاز عکس بدن، آزمایش خون
    //     و ویدیو برای پلن ultimate — دقیقاً مثل خرید).
    if (action === "activate") {
      const planId = body.plan;
      if (!planId || !VALID_PLANS.includes(planId)) {
        return Response.json({ error: "پلن نامعتبر است." }, { status: 400 });
      }
      const planMeta = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
      if (!planMeta) {
        return Response.json({ error: "پلن یافت نشد." }, { status: 400 });
      }
      const durationDays =
        body.days && body.days > 0 ? Math.floor(body.days) : planMeta.durationDays;

      // بررسی پلن قبلی فعال (برای حفظ روزهای باقی‌مانده در صورت تمدید همان پلن)
      const oldActiveSub = await db.subscription.findFirst({
        where: { userId: id, status: "active" },
        orderBy: { endDate: "desc" },
      });
      let remainingDaysPreserved = 0;
      if (
        oldActiveSub?.endDate &&
        oldActiveSub.endDate.getTime() > now.getTime() &&
        oldActiveSub.plan === planId
      ) {
        const msLeft = oldActiveSub.endDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) remainingDaysPreserved = Math.min(daysLeft, durationDays);
      }

      // غیرفعال‌سازی اشتراک‌های قبلی (مثل خرید)
      await db.subscription.updateMany({
        where: { userId: id, status: "active" },
        data: { status: "expired" },
      });
      await db.subscription.updateMany({
        where: { userId: id, status: "pending" },
        data: { status: "cancelled" },
      });

      // آیا پلن نیاز به عکس بدن دارد؟
      const needsBodyPhoto = planId === "advanced" || planId === "ultimate";
      const canSubmitVideo = planId === "ultimate";

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays + remainingDaysPreserved);

      // ایجاد اشتراک جدید — منطق دقیقاً مثل /api/payment/verify
      if (needsBodyPhoto) {
        // پلن‌های advanced/ultimate: اشتراک pending — دوره اصلی از زمان تکمیل
        // پیش‌نیازها شروع می‌شود. endDate اینجا «پنجره pending» است (F3):
        // اگر کاربر در این پنجره عکس بدن نفرستد، اشتراک منقضی می‌شود.
        const pendingWindowEnd = new Date(now);
        pendingWindowEnd.setDate(pendingWindowEnd.getDate() + PENDING_WINDOW_DAYS);
        await db.subscription.create({
          data: {
            userId: id,
            plan: planId,
            status: "pending",
            startDate: null,
            endDate: pendingWindowEnd, // پنجره pending — هنگام فعال‌سازی با now+durationDays جایگزین می‌شود
            durationDays,
            pricePaid: 0, // ادمین فعال کرده — پرداخت نداشت
            discountCode: null,
          },
        });
      } else {
        // پلن‌های basic/standard: اشتراک فعال بلافاصله شروع می‌شود (پیش‌نیاز ندارد)
        await db.subscription.create({
          data: {
            userId: id,
            plan: planId,
            status: "active",
            startDate: now,
            endDate,
            durationDays,
            pricePaid: 0, // ادمین فعال کرده — پرداخت نداشت
            discountCode: null,
          },
        });
      }

      // آپدیت فیلدهای پلن روی User (مثل خرید موفق)
      // برای پلن‌های advanced/ultimate: planExpiresAt=null و planStartedAt=null (هنوز شروع نشده).
      // وقتی کاربر پیش‌نیازها را در submit-body-analysis تکمیل کند، این فیلدها ست می‌شوند.
      await db.user.update({
        where: { id },
        data: {
          planName: planId,
          planExpiresAt: needsBodyPhoto ? null : endDate,
          planStartedAt: needsBodyPhoto ? null : now,
          // ریست شمارنده‌های استفاده هوش مصنوعی
          videoAnalysisUsed: 0,
          bloodTestUsed: 0,
          // ریست وضعیت تعیین‌تکلیف ویدیو و آزمایش خون — برای پلن جدید کاربر باید دوباره تصمیم بگیرد
          videoStatus: null,
          bloodTestStatus: null,
        },
      });

      // ایجاد ProgramRequest جدید (مثل خرید موفق)
      const progReq = await db.programRequest.create({
        data: {
          userId: id,
          plan: planId,
          billingPeriod: "monthly",
          status: needsBodyPhoto ? "pending_body_photo" : "generating",
        },
      });

      // --- تولید برنامه بر اساس نوع پلن (دقیقاً مثل /api/payment/verify) ---
      if (needsBodyPhoto) {
        // بدون تولید برنامه — منتظر ارسال عکس‌های بدن توسط کاربر
        const noticeBody = canSubmitVideo
          ? "برای دریافت برنامه اختصاصی، ارسال عکس‌های بدن (۴ زاویه) الزامی است. ارسال ویدیوی فرم حرکات اختیاری است اما به دقت برنامه کمک می‌کند. همچنین می‌توانید بعداً از بخش «آزمایش خون» در پنل، عکس آزمایش خون خود را برای تحلیل ارسال کنید (دلبخواه)."
          : "برای دریافت برنامه اختصاصی، عکس‌های بدن خود (۴ زاویه) را ارسال کنید. سپس فیتاپ هوشمند برنامه شما را طراحی می‌کند.";
        await createNotification(
          id,
          "system",
          "ارسال عکس بدن الزامی است 📸",
          noticeBody,
          "?tab=dashboard",
          { from: "admin", action: "activate_body_photo_required", plan: planId }
        );

        // نوتیف جداگانه برای آزمایش خون — فقط برای پلن Ultimate (اختیاری)
        if (canSubmitVideo) {
          await createNotification(
            id,
            "system",
            "آزمایش خون خود را ارسال کنید (اختیاری) 🩸",
            "برای داشتن یک برنامه ورزشی و تغذیه‌ای کاملاً شخصی‌سازی‌شده، می‌توانید آزمایش خون خود را به فیتاپ بسپارید. از بخش «آزمایش خون» در پنل، ابتدا فرم آزمایش را دانلود کرده و به آزمایشگاه ببرید. سپس یکی از گزینه‌ها را انتخاب کنید: «آزمایش دادم و منتظر جوابم» یا «آپلود نمی‌کنم».",
            "?tab=dashboard",
            { from: "admin", action: "activate_blood_test_optional", plan: planId }
          );

          // نوتیف جداگانه برای ویدیوی فرم حرکات (اختیاری) — فقط Ultimate
          await createNotification(
            id,
            "system",
            "ارسال ویدیوی فرم حرکات (اختیاری) 🎥",
            "برای دقت بالاتر در طراحی برنامه، می‌توانید ویدیویی از فرم اجرای حرکات خود ارسال کنید. این مرحله اختیاری است اما به مربی هوشمند کمک می‌کند نقاط ضعف فرم بدن شما را شناسایی کند. از بخش داشبورد می‌توانید ویدیو را آپلود کنید یا «آپلود نمی‌کنم» را انتخاب کنید. تا زمان تعیین تکلیف این مرحله، ساخت برنامه شما متوقف می‌ماند.",
            "?tab=dashboard",
            { from: "admin", action: "activate_video_optional", plan: planId }
          );
        }

        // نوتیف تشویقی برای اندازه‌های بدنی (اگر کاربر هنوز ندارد)
        try {
          const baselineCheckup = await db.checkup.findFirst({
            where: { userId: id, phaseNumber: 0 },
            orderBy: { createdAt: "desc" },
          });
          const hasMeasurements =
            !!baselineCheckup?.waistMeasurement &&
            !!baselineCheckup?.neckMeasurement;
          if (!hasMeasurements) {
            await createNotification(
              id,
              "system",
              "برای برنامه دقیق‌تر، اندازه‌های بدنی خود را وارد کنید 📏",
              "با وارد کردن دور کمر، گردن و سایر اندازه‌ها، فیتاپ هوشمند درصد چربی بدن شما را با فرمول علمی US Navy محاسبه می‌کند و برنامه دقیق‌تری طراحی می‌کند. می‌توانید این مرحله را رد کنید.",
              "?tab=progress",
              { from: "admin", action: "activate_measurements_tip", plan: planId }
            );
          }
        } catch (checkErr) {
          console.error(
            "[manage-subscription] baseline checkup lookup failed:",
            checkErr
          );
        }
      } else {
        // پلن‌های basic/standard — تولید برنامه در پس‌زمینه (fire-and-forget)
        const userIdBg = id;
        const progReqIdBg = progReq.id;
        const planIdBg = planId;
        const oldSubBg = oldActiveSub;

        void (async () => {
          try {
            const profile = await db.onboardingProfile.findUnique({
              where: { userId: userIdBg },
            });
            if (!profile) {
              // پروفایل آنبوردینگ موجود نیست — نمی‌توان برنامه ساخت (H3: نوتیف به کاربر)
              await db.programRequest.update({
                where: { id: progReqIdBg },
                data: { status: "failed" },
              });
              try {
                await createNotification(
                  userIdBg,
                  "system",
                  "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
                  "اطلاعات آنبوردینگ شما یافت نشد. لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید یا با پشتیبانی در ارتباط باشید.",
                  "?tab=programs",
                  { from: "admin", action: "activate_plan_failed", plan: planIdBg }
                );
              } catch {}
              return;
            }

            const { generateWorkoutPlan, generateMealPlan } = await import(
              "@/lib/fitness/ai"
            );

            const parseEquip = (raw: string | null | undefined): string[] => {
              if (!raw) return [];
              const t = raw.trim();
              if (!t) return [];
              try {
                const p = JSON.parse(t);
                if (Array.isArray(p)) return p.map((x) => String(x));
                if (typeof p === "string")
                  return p
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                return [];
              } catch {
                return t
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
              }
            };
            const parseList = (raw: string | null | undefined): string[] => {
              if (!raw) return [];
              const t = raw.trim();
              if (!t) return [];
              try {
                const p = JSON.parse(t);
                return Array.isArray(p) ? p.map((x) => String(x)) : [];
              } catch {
                return t
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
              }
            };

            // آخرین وزن ثبت‌شده (نه وزن اولیه) — برای تمدید هوشمند
            const latestWeightLog = await db.weightLog.findFirst({
              where: { userId: userIdBg },
              orderBy: { loggedAt: "desc" },
              select: { weight: true },
            });
            const currentWeight = latestWeightLog?.weight ?? profile.weight;

            // آخرین چکاپ برای اندازه‌های بدنی
            const latestCheckup = await db.checkup.findFirst({
              where: { userId: userIdBg, phaseCompleted: true },
              orderBy: { createdAt: "desc" },
              select: {
                bodyFatPercent: true,
                waistMeasurement: true,
                fatigueLevel: true,
                sleepQuality: true,
                weight: true,
                armMeasurement: true,
                chestMeasurement: true,
                hipMeasurement: true,
                thighMeasurement: true,
                neckMeasurement: true,
                dietAdherence: true,
                workoutAdherence: true,
                phaseNumber: true,
                isFinalCheckup: true,
              },
            });

            // تمدید هوشمند: اگر کاربر دوره قبلی را کامل کرده، پیشرفت او را به AI می‌دهیم
            const previousSub =
              oldSubBg ||
              (await db.subscription.findFirst({
                where: { userId: userIdBg, status: "expired" },
                orderBy: { endDate: "desc" },
              }));

            let renewalContext = "";
            if (previousSub && latestCheckup) {
              const oldWeight = profile.weight;
              const newWeight = currentWeight;
              const weightChange = newWeight - oldWeight;
              const oldBodyFat = latestCheckup.bodyFatPercent;
              renewalContext = `\n\n[سیستم - فعال‌سازی توسط ادمین]: این کاربر قبلاً پلن ${previousSub.plan} را برای ${previousSub.durationDays} روز استفاده کرده است.
پیشرفت کاربر:
- وزن اولیه: ${oldWeight} کیلو → وزن فعلی: ${newWeight} کیلو (تغییر: ${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} کیلو)
${oldBodyFat ? `- درصد چربی بدن در آخرین چکاپ: ${oldBodyFat.toFixed(1)}٪` : ""}
- سطح انرژی: ${latestCheckup.fatigueLevel}/5
- کیفیت خواب: ${latestCheckup.sleepQuality}/5
- رعایت رژیم: ${latestCheckup.dietAdherence}/5
- رعایت تمرین: ${latestCheckup.workoutAdherence}/5
- فاز تکمیل‌شده: ${latestCheckup.phaseNumber}${latestCheckup.isFinalCheckup ? " (چکاپ نهایی)" : ""}

برنامه جدید را بر اساس این پیشرفت طراحی کن:
${weightChange < 0 ? "✅ کاربر وزن کم کرده — برنامه را با شدت مناسب ادامه بده" : weightChange > 0 ? "⚠️ کاربر وزن اضافه کرده — برنامه را با تمرکز بر چربی‌سوزی تنظیم کن" : "→ وزن ثابت — برنامه را متنوع‌تر و پیشرفته‌تر کن"}
${latestCheckup.fatigueLevel <= 2 ? "⚠️ خستگی بالا — حجم تمرین را کمی کم کن" : ""}
${latestCheckup.sleepQuality <= 2 ? "⚠️ خواب ضعیف — ریکاوری را در نظر بگیر" : ""}
${latestCheckup.workoutAdherence >= 4 ? "✅ رعایت تمرین عالی — می‌توانی شدت را افزایش دهی" : ""}`;
            }

            const planData = {
              gender: profile.gender as any,
              age: profile.age,
              height: profile.height,
              weight: currentWeight,
              targetWeight: profile.targetWeight ?? undefined,
              goal: profile.goal as any,
              activityLevel: profile.activityLevel as any,
              workoutDays: profile.workoutDays,
              workoutDaysList: parseList(profile.workoutDaysList),
              workoutPlace: profile.workoutPlace as any,
              equipment: parseEquip(profile.equipment),
              diseases: profile.diseases,
              injuries: profile.injuries,
              allergies: profile.allergies,
              dietType: profile.dietType as any,
              trainingExperience: (profile.trainingExperience ?? undefined) as any,
              previousTrainingType: profile.previousTrainingType ?? undefined,
              drugAllergies: profile.drugAllergies ?? undefined,
              currentMedications: profile.currentMedications ?? undefined,
              maxLifts: profile.maxLifts ?? undefined,
              bodyFrame: (profile.bodyFrame ?? undefined) as any,
              sleepHours: profile.sleepHours ?? undefined,
              stressLevel: profile.stressLevel ?? undefined,
              waterHabit: profile.waterHabit ?? undefined,
              targetDate: profile.targetDate ?? undefined,
              workoutTime: (profile.workoutTime ?? undefined) as any,
              medicalConditions: parseList(profile.medicalConditions) as any,
              currentSupplements: profile.currentSupplements ?? undefined,
              dislikedFoods: profile.dislikedFoods ?? undefined,
              preferredCuisine: (profile.preferredCuisine ?? undefined) as any,
              waterGoalMl: (() => {
                const w = currentWeight || 70;
                const baseMl = Math.round(w * 35);
                let adj = 0;
                const al = profile.activityLevel;
                if (al === "active" || al === "very_active") adj = 500;
                else if (al === "moderate") adj = 250;
                return baseMl + adj;
              })(),
            };

            // غیرفعال‌سازی برنامه‌های قبلی
            await db.workoutPlan.updateMany({
              where: { userId: userIdBg },
              data: { active: false },
            });
            await db.mealPlan.updateMany({
              where: { userId: userIdBg },
              data: { active: false },
            });

            const extras: {
              renewalContext?: string;
              bloodTestReport?: string;
              bodyPhotoAnalysis?: string;
            } = {};
            if (renewalContext) extras.renewalContext = renewalContext;

            // آخرین آزمایش خون (در صورت وجود) — تزریق به AI
            try {
              const latestBloodTest = await db.analysisResult.findFirst({
                where: { userId: userIdBg, type: "blood_test" },
                orderBy: { createdAt: "desc" },
                select: { result: true, createdAt: true },
              });
              if (latestBloodTest?.result) {
                try {
                  const parsed = JSON.parse(latestBloodTest.result);
                  const summaryParts: string[] = [];
                  if (parsed.summary) summaryParts.push(String(parsed.summary));
                  if (
                    parsed.abnormalities &&
                    Array.isArray(parsed.abnormalities) &&
                    parsed.abnormalities.length > 0
                  ) {
                    summaryParts.push(
                      `ناهنجاری‌ها: ${parsed.abnormalities
                        .map((a: any) =>
                          typeof a === "string"
                            ? a
                            : a?.name || a?.test || JSON.stringify(a)
                        )
                        .join("، ")}`
                    );
                  }
                  if (
                    parsed.recommendations &&
                    Array.isArray(parsed.recommendations) &&
                    parsed.recommendations.length > 0
                  ) {
                    summaryParts.push(
                      `توصیه‌ها: ${parsed.recommendations.slice(0, 3).join("، ")}`
                    );
                  }
                  if (summaryParts.length > 0) {
                    extras.bloodTestReport = `آخرین آزمایش خون کاربر (تاریخ: ${new Date(
                      latestBloodTest.createdAt
                    ).toLocaleDateString("fa-IR")}):\n${summaryParts.join("\n")}`;
                  }
                } catch {
                  extras.bloodTestReport = `آخرین آزمایش خون کاربر:\n${latestBloodTest.result.slice(
                    0,
                    800
                  )}`;
                }
              }
            } catch (btErr) {
              console.error(
                "[manage-subscription] failed to load blood test:",
                btErr
              );
            }

            // آخرین تحلیل عکس بدن (در صورت وجود)
            try {
              const latestBodyPhoto = await db.analysisResult.findFirst({
                where: { userId: userIdBg, type: "body_photo" },
                orderBy: { createdAt: "desc" },
                select: { result: true, createdAt: true },
              });
              if (latestBodyPhoto?.result) {
                try {
                  const parsed = JSON.parse(latestBodyPhoto.result);
                  const summaryParts: string[] = [];
                  if (parsed.analysis) summaryParts.push(String(parsed.analysis));
                  if (
                    parsed.recommendations &&
                    Array.isArray(parsed.recommendations) &&
                    parsed.recommendations.length > 0
                  ) {
                    summaryParts.push(
                      `توصیه‌ها: ${parsed.recommendations.slice(0, 3).join("، ")}`
                    );
                  }
                  if (parsed.bodyScore != null)
                    summaryParts.push(`امتیاز فرم بدن: ${parsed.bodyScore} از ۱۰۰`);
                  if (summaryParts.length > 0) {
                    extras.bodyPhotoAnalysis = `آخرین تحلیل عکس بدن کاربر (تاریخ: ${new Date(
                      latestBodyPhoto.createdAt
                    ).toLocaleDateString("fa-IR")}):\n${summaryParts.join("\n")}`;
                  }
                } catch {
                  extras.bodyPhotoAnalysis = `آخرین تحلیل عکس بدن کاربر:\n${latestBodyPhoto.result.slice(
                    0,
                    800
                  )}`;
                }
              }
            } catch (bpErr) {
              console.error(
                "[manage-subscription] failed to load body photo analysis:",
                bpErr
              );
            }

            // تولید موازی برنامه در پس‌زمینه
            const [workout, meal] = await Promise.all([
              generateWorkoutPlan(planData, planIdBg as any, extras),
              generateMealPlan(planData, planIdBg as any, extras),
            ]);

            await db.workoutPlan.create({
              data: {
                userId: userIdBg,
                content: JSON.stringify(workout),
                active: true,
              },
            });
            await db.mealPlan.create({
              data: {
                userId: userIdBg,
                content: JSON.stringify(meal),
                totalCal: meal.totalCalories,
                active: true,
              },
            });

            // به‌روزرسانی وضعیت درخواست برنامه به "ready"
            await db.programRequest.update({
              where: { id: progReqIdBg },
              data: { status: "ready" },
            });

            // نوتیفیکیشن آماده شدن برنامه (همراه با push PWA)
            await createNotification(
              userIdBg,
              "achievement",
              "برنامه شما آماده شد! 🎯",
              "برنامه تمرینی و غذایی شخصی‌سازی‌شده شما توسط فیتاپ هوشمند ساخته شد. از بخش «تمرینات» و «تغذیه» مشاهده کنید.",
              "?tab=programs"
            );
            console.log(
              "[manage-subscription] background plan generation completed for user:",
              userIdBg
            );
          } catch (genErr) {
            console.error(
              "[manage-subscription] background plan generation failed:",
              genErr
            );
            try {
              await db.programRequest.update({
                where: { id: progReqIdBg },
                data: { status: "failed" },
              });
            } catch {}
            // H3: نوتیف به کاربر مبنی بر شکست تولید برنامه
            try {
              await createNotification(
                userIdBg,
                "system",
                "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
                "تولید برنامه ورزشی و غذایی شما با خطا مواجه شد. لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید یا با پشتیبانی در ارتباط باشید.",
                "?tab=programs",
                { from: "admin", action: "activate_plan_failed", plan: planIdBg }
              );
            } catch {}
          }
        })();
      }

      // نوتیفیکیشن اصلی فعال‌سازی (دقیقاً مثل خرید موفق)
      const preservedNote =
        remainingDaysPreserved > 0
          ? ` ${toPersianDigits(remainingDaysPreserved)} روز از اشتراک قبلی شما به اشتراک جدید اضافه شد 🎁`
          : "";
      const bodyText = needsBodyPhoto
        ? `پلن ${planMeta.label} توسط ادمین برای شما فعال شد. برای شروع دوره ${toPersianDigits(
            durationDays
          )} روزه، عکس‌های بدن خود را ارسال کنید.${preservedNote}`
        : `پلن ${planMeta.label} توسط ادمین برای شما فعال شد. تا ${endDate.toLocaleDateString(
            "fa-IR"
          )} فعال است.${preservedNote} برنامه شما در حال تولید توسط فیتاپ هوشمند است — به‌زودی آماده می‌شود.`;

      await createNotification(
        id,
        "subscription",
        needsBodyPhoto ? "پلن شما ثبت شد! ✅" : "پلن شما فعال شد! ✅",
        bodyText,
        "?tab=dashboard",
        {
          from: "admin",
          action: "activate",
          plan: planId,
          endDate: needsBodyPhoto ? null : endDate.toISOString(),
          remainingDaysPreserved,
        }
      );

      return Response.json({
        ok: true,
        action: "activate",
        plan: planId,
        endDate: needsBodyPhoto ? null : endDate.toISOString(),
        remainingDaysPreserved,
        needsBodyPhoto,
      });
    }

    // ─── اکشن ۳: تمدید (افزودن روز) ───
    if (action === "extend") {
      const days = Math.floor(Number(body.days));
      if (!Number.isFinite(days) || days <= 0) {
        return Response.json({ error: "تعداد روز باید عددی مثبت باشد." }, { status: 400 });
      }
      const activeSub = await db.subscription.findFirst({
        where: { userId: id, status: "active" },
        orderBy: { endDate: "desc" },
      });
      if (!activeSub || !activeSub.endDate) {
        return Response.json({ error: "اشتراک فعالی برای تمدید وجود ندارد." }, { status: 400 });
      }
      const newEndDate = new Date(activeSub.endDate.getTime() + days * 24 * 60 * 60 * 1000);
      await db.subscription.update({
        where: { id: activeSub.id },
        data: { endDate: newEndDate },
      });
      await db.user.update({
        where: { id },
        data: { planExpiresAt: newEndDate },
      });
      await createNotification(
        id,
        "subscription",
        `اشتراک شما ${days} روز تمدید شد 🎁`,
        `اشتراک ${activeSub.plan} شما ${days} روز توسط ادمین تمدید شد. تاریخ انقضای جدید: ${newEndDate.toLocaleDateString("fa-IR")}.`,
        "?tab=dashboard",
        { from: "admin", action: "extend", days, newEndDate: newEndDate.toISOString() }
      );
      return Response.json({
        ok: true,
        action: "extend",
        days,
        newEndDate: newEndDate.toISOString(),
      });
    }

    // ─── اکشن ۴: کاهش (کم کردن روز) ───
    if (action === "reduce") {
      const days = Math.floor(Number(body.days));
      if (!Number.isFinite(days) || days <= 0) {
        return Response.json({ error: "تعداد روز باید عددی مثبت باشد." }, { status: 400 });
      }
      const activeSub = await db.subscription.findFirst({
        where: { userId: id, status: "active" },
        orderBy: { endDate: "desc" },
      });
      if (!activeSub || !activeSub.endDate) {
        return Response.json({ error: "اشتراک فعالی برای کاهش وجود ندارد." }, { status: 400 });
      }
      const newEndDate = new Date(activeSub.endDate.getTime() - days * 24 * 60 * 60 * 1000);
      // اگر تاریخ جدید به قبل از الان رسید، اشتراک را expire کن
      // cancelledAt را هم set می‌کنیم تا نشان دهد این لغو توسط ادمین بوده.
      if (newEndDate.getTime() <= now.getTime()) {
        await db.subscription.update({
          where: { id: activeSub.id },
          data: { status: "expired", endDate: now, cancelledAt: now },
        });
        await db.user.update({
          where: { id },
          data: { planExpiresAt: now, planName: null },
        });
        await createNotification(
          id,
          "system",
          "اشتراک شما توسط ادمین کوتاه شد ⚠️",
          `اشتراک شما ${days} روز کوتاه شد و چون زمان باقی‌مانده کمتر بود، منقضی شد.`,
          "?tab=plans",
          { from: "admin", action: "reduce", days, expired: true }
        );
        return Response.json({
          ok: true,
          action: "reduce",
          days,
          expired: true,
        });
      }
      await db.subscription.update({
        where: { id: activeSub.id },
        data: { endDate: newEndDate },
      });
      await db.user.update({
        where: { id },
        data: { planExpiresAt: newEndDate },
      });
      await createNotification(
        id,
        "system",
        `اشتراک شما ${days} روز کوتاه شد ⚠️`,
        `اشتراک ${activeSub.plan} شما ${days} روز توسط ادمین کوتاه شد. تاریخ انقضای جدید: ${newEndDate.toLocaleDateString("fa-IR")}.`,
        "?tab=dashboard",
        { from: "admin", action: "reduce", days, newEndDate: newEndDate.toISOString() }
      );
      return Response.json({
        ok: true,
        action: "reduce",
        days,
        newEndDate: newEndDate.toISOString(),
      });
    }

    // ─── اکشن ۵: فعال‌سازی پلن برای مدت مشخص ───
    // این اکشن دقیقاً همان منطق اکشن `activate` را طی می‌کند با این تفاوت که تعداد روزها
    // به‌جای planMeta.durationDays از body.days استفاده می‌کند. برای پلن‌های advanced/ultimate
    // (یعنی needsBodyPhoto=true):
    //   • اشتراک با status="pending" و startDate/endDate=null ساخته می‌شود (۴۵ روز از
    //     زمان تکمیل پیش‌نیازها شروع می‌شود).
    //   • ProgramRequest با status="pending_body_photo" ساخته می‌شود (تا زمان تکمیل پیش‌نیازها).
    //   • نوتیف‌های پیش‌نیاز (عکس بدن، آزمایش خون، ویدیو) ارسال می‌شود.
    //   • videoStatus/bloodTestStatus ریست می‌شود.
    // برای basic/standard:
    //   • اشتراک با status="active" و startDate=now, endDate=now+days ساخته می‌شود.
    //   • ProgramRequest با status="generating" ساخته و برنامه در پس‌زمینه تولید می‌شود.
    if (action === "activate_days") {
      const planId = body.plan;
      if (!planId || !VALID_PLANS.includes(planId)) {
        return Response.json({ error: "پلن نامعتبر است." }, { status: 400 });
      }
      const days = Math.floor(Number(body.days));
      if (!Number.isFinite(days) || days <= 0) {
        return Response.json({ error: "تعداد روز باید عددی مثبت باشد." }, { status: 400 });
      }
      const planMeta = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
      if (!planMeta) {
        return Response.json({ error: "پلن یافت نشد." }, { status: 400 });
      }

      const needsBodyPhoto = planId === "advanced" || planId === "ultimate";
      const canSubmitVideo = planId === "ultimate";

      // غیرفعال‌سازی اشتراک‌های قبلی
      await db.subscription.updateMany({
        where: { userId: id, status: "active" },
        data: { status: "expired" },
      });
      await db.subscription.updateMany({
        where: { userId: id, status: "pending" },
        data: { status: "cancelled" },
      });

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      // ایجاد اشتراک جدید — منطق دقیقاً مثل اکشن activate و /api/payment/verify
      if (needsBodyPhoto) {
        // پلن‌های advanced/ultimate: اشتراک pending — تعداد روزهای تعیین‌شده از زمان
        // تکمیل پیش‌نیازها. endDate اینجا «پنجره pending» است (F3).
        const pendingWindowEnd = new Date(now);
        pendingWindowEnd.setDate(pendingWindowEnd.getDate() + PENDING_WINDOW_DAYS);
        await db.subscription.create({
          data: {
            userId: id,
            plan: planId,
            status: "pending",
            startDate: null,
            endDate: pendingWindowEnd, // پنجره pending — هنگام فعال‌سازی با now+days جایگزین می‌شود
            durationDays: days,
            pricePaid: 0,
            discountCode: null,
          },
        });
      } else {
        // پلن‌های basic/standard: اشتراک فعال بلافاصله شروع می‌شود
        await db.subscription.create({
          data: {
            userId: id,
            plan: planId,
            status: "active",
            startDate: now,
            endDate,
            durationDays: days,
            pricePaid: 0,
            discountCode: null,
          },
        });
      }

      // آپدیت فیلدهای پلن روی User — ریست شمارنده‌ها و وضعیت‌ها (H4)
      await db.user.update({
        where: { id },
        data: {
          planName: planId,
          planExpiresAt: needsBodyPhoto ? null : endDate,
          planStartedAt: needsBodyPhoto ? null : now,
          // ریست شمارنده‌های استفاده هوش مصنوعی
          videoAnalysisUsed: 0,
          bloodTestUsed: 0,
          // ریست وضعیت تعیین‌تکلیف ویدیو و آزمایش خون — برای پلن جدید کاربر باید دوباره تصمیم بگیرد (H4)
          videoStatus: null,
          bloodTestStatus: null,
        },
      });

      // ایجاد ProgramRequest جدید
      const progReq = await db.programRequest.create({
        data: {
          userId: id,
          plan: planId,
          billingPeriod: "monthly",
          status: needsBodyPhoto ? "pending_body_photo" : "generating",
        },
      });

      if (needsBodyPhoto) {
        // بدون تولید برنامه — منتظر ارسال عکس‌های بدن توسط کاربر (H5: نوتیف‌های پیش‌نیاز)
        const noticeBody = canSubmitVideo
          ? "برای دریافت برنامه اختصاصی، ارسال عکس‌های بدن (۴ زاویه) الزامی است. ارسال ویدیوی فرم حرکات اختیاری است اما به دقت برنامه کمک می‌کند. همچنین می‌توانید بعداً از بخش «آزمایش خون» در پنل، عکس آزمایش خون خود را برای تحلیل ارسال کنید (دلبخواه)."
          : "برای دریافت برنامه اختصاصی، عکس‌های بدن خود (۴ زاویه) را ارسال کنید. سپس فیتاپ هوشمند برنامه شما را طراحی می‌کند.";
        await createNotification(
          id,
          "system",
          "ارسال عکس بدن الزامی است 📸",
          noticeBody,
          "?tab=dashboard",
          { from: "admin", action: "activate_days_body_photo_required", plan: planId }
        );

        // نوتیف جداگانه برای آزمایش خون — فقط برای پلن Ultimate (اختیاری)
        if (canSubmitVideo) {
          await createNotification(
            id,
            "system",
            "آزمایش خون خود را ارسال کنید (اختیاری) 🩸",
            "برای داشتن یک برنامه ورزشی و تغذیه‌ای کاملاً شخصی‌سازی‌شده، می‌توانید آزمایش خون خود را به فیتاپ بسپارید. از بخش «آزمایش خون» در پنل، ابتدا فرم آزمایش را دانلود کرده و به آزمایشگاه ببرید. سپس یکی از گزینه‌ها را انتخاب کنید: «آزمایش دادم و منتظر جوابم» یا «آپلود نمی‌کنم».",
            "?tab=dashboard",
            { from: "admin", action: "activate_days_blood_test_optional", plan: planId }
          );

          // نوتیف جداگانه برای ویدیوی فرم حرکات (اختیاری) — فقط Ultimate
          await createNotification(
            id,
            "system",
            "ارسال ویدیوی فرم حرکات (اختیاری) 🎥",
            "برای دقت بالاتر در طراحی برنامه، می‌توانید ویدیویی از فرم اجرای حرکات خود ارسال کنید. این مرحله اختیاری است اما به مربی هوشمند کمک می‌کند نقاط ضعف فرم بدن شما را شناسایی کند. از بخش داشبورد می‌توانید ویدیو را آپلود کنید یا «آپلود نمی‌کنم» را انتخاب کنید. تا زمان تعیین تکلیف این مرحله، ساخت برنامه شما متوقف می‌ماند.",
            "?tab=dashboard",
            { from: "admin", action: "activate_days_video_optional", plan: planId }
          );
        }

        // نوتیف تشویقی برای اندازه‌های بدنی (اگر کاربر هنوز ندارد)
        try {
          const baselineCheckup = await db.checkup.findFirst({
            where: { userId: id, phaseNumber: 0 },
            orderBy: { createdAt: "desc" },
          });
          const hasMeasurements =
            !!baselineCheckup?.waistMeasurement &&
            !!baselineCheckup?.neckMeasurement;
          if (!hasMeasurements) {
            await createNotification(
              id,
              "system",
              "برای برنامه دقیق‌تر، اندازه‌های بدنی خود را وارد کنید 📏",
              "با وارد کردن دور کمر، گردن و سایر اندازه‌ها، فیتاپ هوشمند درصد چربی بدن شما را با فرمول علمی US Navy محاسبه می‌کند و برنامه دقیق‌تری طراحی می‌کند. می‌توانید این مرحله را رد کنید.",
              "?tab=progress",
              { from: "admin", action: "activate_days_measurements_tip", plan: planId }
            );
          }
        } catch (checkErr) {
          console.error(
            "[manage-subscription] activate_days baseline checkup lookup failed:",
            checkErr
          );
        }
      } else {
        // پلن‌های basic/standard — تولید برنامه در پس‌زمینه (fire-and-forget)
        const userIdBg = id;
        const progReqIdBg = progReq.id;
        const planIdBg = planId;

        void (async () => {
          try {
            const profile = await db.onboardingProfile.findUnique({
              where: { userId: userIdBg },
            });
            if (!profile) {
              // پروفایل آنبوردینگ موجود نیست — نمی‌توان برنامه ساخت (H3: نوتیف به کاربر)
              await db.programRequest.update({
                where: { id: progReqIdBg },
                data: { status: "failed" },
              });
              try {
                await createNotification(
                  userIdBg,
                  "system",
                  "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
                  "اطلاعات آنبوردینگ شما یافت نشد. لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید یا با پشتیبانی در ارتباط باشید.",
                  "?tab=programs",
                  { from: "admin", action: "activate_days_plan_failed", plan: planIdBg }
                );
              } catch {}
              return;
            }

            const { generateWorkoutPlan, generateMealPlan } = await import(
              "@/lib/fitness/ai"
            );

            const parseEquip = (raw: string | null | undefined): string[] => {
              if (!raw) return [];
              const t = raw.trim();
              if (!t) return [];
              try {
                const p = JSON.parse(t);
                if (Array.isArray(p)) return p.map((x) => String(x));
                if (typeof p === "string")
                  return p
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                return [];
              } catch {
                return t
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
              }
            };
            const parseList = (raw: string | null | undefined): string[] => {
              if (!raw) return [];
              const t = raw.trim();
              if (!t) return [];
              try {
                const p = JSON.parse(t);
                return Array.isArray(p) ? p.map((x) => String(x)) : [];
              } catch {
                return t
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
              }
            };

            const latestWeightLog = await db.weightLog.findFirst({
              where: { userId: userIdBg },
              orderBy: { loggedAt: "desc" },
              select: { weight: true },
            });
            const currentWeight = latestWeightLog?.weight ?? profile.weight;

            const planData = {
              gender: profile.gender as any,
              age: profile.age,
              height: profile.height,
              weight: currentWeight,
              targetWeight: profile.targetWeight ?? undefined,
              goal: profile.goal as any,
              activityLevel: profile.activityLevel as any,
              workoutDays: profile.workoutDays,
              workoutDaysList: parseList(profile.workoutDaysList),
              workoutPlace: profile.workoutPlace as any,
              equipment: parseEquip(profile.equipment),
              diseases: profile.diseases,
              injuries: profile.injuries,
              allergies: profile.allergies,
              dietType: profile.dietType as any,
              trainingExperience: (profile.trainingExperience ?? undefined) as any,
              previousTrainingType: profile.previousTrainingType ?? undefined,
              drugAllergies: profile.drugAllergies ?? undefined,
              currentMedications: profile.currentMedications ?? undefined,
              maxLifts: profile.maxLifts ?? undefined,
              bodyFrame: (profile.bodyFrame ?? undefined) as any,
              sleepHours: profile.sleepHours ?? undefined,
              stressLevel: profile.stressLevel ?? undefined,
              waterHabit: profile.waterHabit ?? undefined,
              targetDate: profile.targetDate ?? undefined,
              workoutTime: (profile.workoutTime ?? undefined) as any,
              medicalConditions: parseList(profile.medicalConditions) as any,
              currentSupplements: profile.currentSupplements ?? undefined,
              dislikedFoods: profile.dislikedFoods ?? undefined,
              preferredCuisine: (profile.preferredCuisine ?? undefined) as any,
              waterGoalMl: (() => {
                const w = currentWeight || 70;
                const baseMl = Math.round(w * 35);
                let adj = 0;
                const al = profile.activityLevel;
                if (al === "active" || al === "very_active") adj = 500;
                else if (al === "moderate") adj = 250;
                return baseMl + adj;
              })(),
            };

            // غیرفعال‌سازی برنامه‌های قبلی
            await db.workoutPlan.updateMany({
              where: { userId: userIdBg },
              data: { active: false },
            });
            await db.mealPlan.updateMany({
              where: { userId: userIdBg },
              data: { active: false },
            });

            const [workout, meal] = await Promise.all([
              generateWorkoutPlan(planData, planIdBg as any, {}),
              generateMealPlan(planData, planIdBg as any, {}),
            ]);

            await db.workoutPlan.create({
              data: {
                userId: userIdBg,
                content: JSON.stringify(workout),
                active: true,
              },
            });
            await db.mealPlan.create({
              data: {
                userId: userIdBg,
                content: JSON.stringify(meal),
                totalCal: meal.totalCalories,
                active: true,
              },
            });

            // به‌روزرسانی وضعیت درخواست برنامه به "ready"
            await db.programRequest.update({
              where: { id: progReqIdBg },
              data: { status: "ready" },
            });

            // نوتیفیکیشن آماده شدن برنامه (همراه با push PWA)
            await createNotification(
              userIdBg,
              "achievement",
              "برنامه شما آماده شد! 🎯",
              "برنامه تمرینی و غذایی شخصی‌سازی‌شده شما توسط فیتاپ هوشمند ساخته شد. از بخش «تمرینات» و «تغذیه» مشاهده کنید.",
              "?tab=programs"
            );
            console.log(
              "[manage-subscription] activate_days background plan generation completed for user:",
              userIdBg
            );
          } catch (genErr) {
            console.error(
              "[manage-subscription] activate_days background plan generation failed:",
              genErr
            );
            try {
              await db.programRequest.update({
                where: { id: progReqIdBg },
                data: { status: "failed" },
              });
            } catch {}
            // H3: نوتیف به کاربر مبنی بر شکست تولید برنامه
            try {
              await createNotification(
                userIdBg,
                "system",
                "خطا در تولید برنامه — از تب برنامه‌ها دوباره تلاش کنید ⚠️",
                "تولید برنامه ورزشی و غذایی شما با خطا مواجه شد. لطفاً از بخش «برنامه‌ها» دوباره تلاش کنید یا با پشتیبانی در ارتباط باشید.",
                "?tab=programs",
                { from: "admin", action: "activate_days_plan_failed", plan: planIdBg }
              );
            } catch {}
          }
        })();
      }

      // نوتیفیکیشن اصلی فعال‌سازی
      const bodyText = needsBodyPhoto
        ? `پلن ${planMeta.label} توسط ادمین برای ${toPersianDigits(
            days
          )} روز (از زمان تکمیل پیش‌نیازها) فعال شد. برای شروع دوره، عکس‌های بدن خود را ارسال کنید.`
        : `پلن ${planMeta.label} توسط ادمین برای ${toPersianDigits(
            days
          )} روز فعال شد. تا ${endDate.toLocaleDateString(
            "fa-IR"
          )} فعال است. برنامه شما در حال تولید توسط فیتاپ هوشمند است — به‌زودی آماده می‌شود.`;

      await createNotification(
        id,
        "subscription",
        needsBodyPhoto ? "پلن شما ثبت شد! ✅" : "پلن شما فعال شد! ✅",
        bodyText,
        "?tab=dashboard",
        {
          from: "admin",
          action: "activate_days",
          plan: planId,
          days,
          endDate: needsBodyPhoto ? null : endDate.toISOString(),
          needsBodyPhoto,
        }
      );

      return Response.json({
        ok: true,
        action: "activate_days",
        plan: planId,
        days,
        endDate: needsBodyPhoto ? null : endDate.toISOString(),
        needsBodyPhoto,
      });
    }

    return Response.json({ error: "اکشن نامعتبر است." }, { status: 400 });
  } catch (e) {
    return apiError(e);
  }
}
