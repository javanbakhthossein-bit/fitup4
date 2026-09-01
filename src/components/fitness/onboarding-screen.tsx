"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Target,
  Activity,
  Salad,
  ChevronLeft,
  Check,
  Sparkles,
  Loader2,
  Crown,
  Moon,
  Brain,
  Droplet,
  CalendarClock,
  Sunrise,
  Stethoscope,
  Pill,
  UtensilsCrossed,
  X,
  Plus,
  ShieldAlert,
  HeartPulse,
  Thermometer,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { PersianDatePicker } from "@/components/fitness/persian-date-picker";
import { useAppStore } from "@/lib/fitness/store";
import {
  type OnboardingData,
  type Gender,
  type Goal,
  type ActivityLevel,
  type WorkoutPlace,
  type DietType,
  type BodyFrame,
  type WorkoutTime,
  type PreferredCuisine,
  type MedicalConditionKey,
  GOAL_LABELS,
  ACTIVITY_LABELS,
  WORKOUT_PLACE_LABELS,
  DIET_LABELS,
  GENDER_LABELS,
  PERSIAN_WEEKDAYS,
  toPersianDigits,
  BODY_FRAME_LABELS,
  WORKOUT_TIME_LABELS,
  PREFERRED_CUISINE_LABELS,
  MEDICAL_CONDITION_LABELS,
} from "@/lib/fitness/types";
import { toast } from "sonner";

const TOTAL_STEPS = 4;

/* Shared gold gradient style for primary buttons */
const GOLD_GRADIENT: React.CSSProperties = {
  background: "linear-gradient(135deg, #f59e0b, #f97316)",
};

export function OnboardingScreen() {
  const { setUser, setScreen } = useAppStore();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Partial<OnboardingData>>({
    firstName: "",
    lastName: "",
    gender: undefined,
    age: undefined,
    height: undefined,
    weight: undefined,
    goal: undefined,
    activityLevel: "moderate",
    workoutDays: 3,
    workoutDaysList: ["شنبه", "دوشنبه", "چهارشنبه"],
    workoutPlace: "gym",
    equipment: [],
    diseases: "",
    injuries: "",
    allergies: "",
    dietType: "standard",
    mealCount: 3,
    // NEW: comprehensive professional fields — initialized to undefined
    bodyFrame: undefined,
    sleepHours: 7,
    stressLevel: 3,
    waterHabit: 6,
    targetDate: undefined,
    workoutTime: undefined,
    medicalConditions: [],
    currentSupplements: "",
    dislikedFoods: "",
    preferredCuisine: undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const update = (patch: Partial<OnboardingData>) =>
    setData((d) => ({ ...d, ...patch }));

  const canNext = (): boolean => {
    switch (step) {
      case 0:
        return (
          !!data.firstName && data.firstName.trim().length >= 2 &&
          !!data.lastName && data.lastName.trim().length >= 2 &&
          !!data.gender &&
          !!data.age && data.age >= 12 && data.age <= 100 &&
          !!data.height && data.height >= 100 && data.height <= 250 &&
          !!data.weight && data.weight >= 30 && data.weight <= 250
        );
      case 1:
        return !!data.goal && !!data.activityLevel && (data.workoutDaysList?.length ?? 0) > 0;
      case 2:
        return !!data.workoutPlace;
      case 3:
        return !!data.dietType;
      default:
        return true;
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  async function finish() {
    setSubmitting(true);
    try {
      // Save onboarding data only — NO plan generation (user hasn't purchased a plan yet)
      // NOTE: Photos (body + blood test) are no longer collected during onboarding.
      // They are collected AFTER purchase via /api/coach/submit-body-analysis (body photos)
      // and via the blood-test feature in the panel (blood test photos).
      const payload = { ...data };
      const saveRes = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error);

      toast.success("اطلاعات شما ذخیره شد! 🎉");
      const fullName = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
      setUser({ ...useAppStore.getState().user!, onboardingDone: true, name: fullName || useAppStore.getState().user!.name });
      // Go to analysis screen (NOT main dashboard — no plan purchased yet)
      setScreen("analysis");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "خطا در ذخیره اطلاعات";
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setGenerating(false);
    }
  }

  if (generating) {
    return <GeneratingScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white relative overflow-hidden">
      {/* Subtle gold accents */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-amber-100/50 blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-64 h-64 rounded-full bg-orange-100/40 blur-3xl" />
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prev}
            disabled={step === 0}
            className="p-2 rounded-full hover:bg-orange-50 disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <span className="text-sm font-medium text-slate-500">
            مرحله {toPersianDigits(step + 1)} از {toPersianDigits(TOTAL_STEPS)}
          </span>
          <div className="w-9" />
        </div>
        <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #f59e0b, #f97316)" }}
            initial={false}
            animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-5 py-4 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && <StepBasicInfo data={data} onChange={update} />}
            {step === 1 && <StepActivityGoals data={data} onChange={update} />}
            {step === 2 && <StepTrainingPrefs data={data} onChange={update} />}
            {step === 3 && <StepNutrition data={data} onChange={update} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom action */}
      <div className="px-5 py-4 border-t border-orange-100 bg-white">
        {step < TOTAL_STEPS - 1 ? (
          <button
            onClick={next}
            disabled={!canNext()}
            className="w-full h-12 rounded-2xl text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/40 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg"
            style={GOLD_GRADIENT}
          >
            ادامه
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!canNext() || submitting}
            className="w-full h-12 rounded-2xl text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/40 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg flex items-center justify-center gap-2"
            style={GOLD_GRADIENT}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال ذخیره...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                تکمیل و مشاهده تحلیل
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function StepHeader({ icon: Icon, title, subtitle }: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center mb-4 shadow-sm shadow-orange-500/10">
        <Icon className="w-7 h-7 text-orange-500" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-1">{title}</h2>
      <p className="text-slate-500 text-sm">{subtitle}</p>
    </div>
  );
}

/* Reusable input class string for gold-themed inputs */
const goldInputCls =
  "h-12 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 focus-visible:ring-orange-300/40 text-slate-900 placeholder:text-slate-400 text-center text-lg font-stat";

/* Text input variant (right-aligned, normal size, for names etc.) */
const goldTextCls =
  "h-12 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 focus-visible:ring-orange-300/40 text-slate-900 placeholder:text-slate-400 text-right text-base";

/* ============ STEP 1: Basic Info ============ */
function StepBasicInfo({ data, onChange }: { data: Partial<OnboardingData>; onChange: (p: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <StepHeader icon={Dumbbell} title="اطلاعات پایه" subtitle="برای شروع، نام و اطلاعات فیزیکی خود را وارد کنید" />

      {/* First + Last Name */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <Label className="mb-2 block text-slate-700">نام</Label>
          <Input
            type="text"
            value={data.firstName ?? ""}
            onChange={(e) => onChange({ firstName: e.target.value })}
            placeholder="مثال: علی"
            className={goldTextCls}
            maxLength={30}
          />
        </div>
        <div>
          <Label className="mb-2 block text-slate-700">نام خانوادگی</Label>
          <Input
            type="text"
            value={data.lastName ?? ""}
            onChange={(e) => onChange({ lastName: e.target.value })}
            placeholder="مثال: رضایی"
            className={goldTextCls}
            maxLength={40}
          />
        </div>
      </div>

      {/* Gender */}
      <div className="mb-5">
        <Label className="mb-2 block text-slate-700">جنسیت</Label>
        <div className="grid grid-cols-2 gap-3">
          {(["male", "female"] as const).map((g) => (
            <button
              key={g}
              onClick={() => onChange({ gender: g })}
              className={`relative p-4 rounded-2xl border-2 bg-white transition-all ${
                data.gender === g
                  ? "border-orange-500 bg-orange-50 shadow-md shadow-orange-500/10"
                  : "border-orange-200 hover:border-orange-300"
              }`}
            >
              <div className="text-3xl mb-2">{g === "male" ? "👨" : "👩"}</div>
              <div className="font-bold text-slate-900">{GENDER_LABELS[g]}</div>
              {data.gender === g && (
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center" style={GOLD_GRADIENT}>
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      {/* Age */}
      <div className="mb-4">
        <Label className="mb-2 block text-slate-700">سن (سال)</Label>
        <Input type="number" value={data.age ?? ""} onChange={(e) => { const v = e.target.value; onChange({ age: v ? Number(v) : undefined }); }} placeholder="۲۵" className={goldInputCls} inputMode="numeric" />
      </div>
      {/* Height + Weight */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <Label className="mb-2 block text-slate-700">قد (cm)</Label>
          <Input type="number" value={data.height ?? ""} onChange={(e) => { const v = e.target.value; onChange({ height: v ? Number(v) : undefined }); }} placeholder="۱۷۵" className={goldInputCls} inputMode="numeric" />
        </div>
        <div>
          <Label className="mb-2 block text-slate-700">وزن فعلی (kg)</Label>
          <Input type="number" value={data.weight ?? ""} onChange={(e) => { const v = e.target.value; onChange({ weight: v ? Number(v) : undefined }); }} placeholder="۷۵" className={goldInputCls} inputMode="numeric" />
        </div>
      </div>
      {/* Target weight */}
      <div>
        <Label className="mb-2 block text-slate-700">وزن هدف (kg) — اختیاری</Label>
        <Input type="number" value={data.targetWeight ?? ""} onChange={(e) => { const v = e.target.value; onChange({ targetWeight: v ? Number(v) : undefined }); }} placeholder="۷۰" className={goldInputCls} inputMode="numeric" />
      </div>

      {/* NEW: Recovery & Lifestyle professional fields */}
      <div className="mt-5">
        <RecoveryLifestyleFields data={data} onChange={onChange} />
      </div>
    </div>
  );
}

/* ============ Recovery & Lifestyle professional fields (اختیاری) ============ */
function RecoveryLifestyleFields({
  data,
  onChange,
}: {
  data: Partial<OnboardingData>;
  onChange: (p: Partial<OnboardingData>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const bodyFrames: { id: BodyFrame; label: string; icon: string; hint: string }[] = [
    { id: "small", label: BODY_FRAME_LABELS.small, icon: "🪵", hint: "مچ زیر ۱۶cm" },
    { id: "medium", label: BODY_FRAME_LABELS.medium, icon: "⚖️", hint: "مچ ۱۶-۱۹cm" },
    { id: "large", label: BODY_FRAME_LABELS.large, icon: "🦴", hint: "مچ بالای ۱۹cm" },
  ];

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">ریکاوری و سبک زندگی (اختیاری)</p>
            <p className="text-[11px] text-slate-500">خواب، استرس، آبرسانی و تیپ بدنی — برای ورزشکاران جدی</p>
          </div>
        </div>
        <ChevronLeft
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "-rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5">
          {/* Body frame */}
          <div>
            <Label className="mb-2 block text-slate-700 text-xs flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-orange-500" />
              اندازه استخوان بدن (Body Frame)
            </Label>
            <p className="text-[11px] text-slate-500 mb-2">با اندازه‌گیری دور مچ دست قابل تشخیص است.</p>
            <div className="grid grid-cols-3 gap-2">
              {bodyFrames.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChange({ bodyFrame: data.bodyFrame === f.id ? undefined : f.id })}
                  className={`p-3 rounded-xl border-2 text-center transition ${
                    data.bodyFrame === f.id
                      ? "border-transparent text-white shadow-md"
                      : "border-orange-200 bg-white text-slate-700 hover:border-orange-300"
                  }`}
                  style={data.bodyFrame === f.id ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : undefined}
                >
                  <div className="text-lg">{f.icon}</div>
                  <div className="text-[11px] font-bold mt-0.5 leading-tight">{f.label}</div>
                  <div className="text-[9px] opacity-80 mt-0.5">{f.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sleep hours slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-slate-700 text-xs flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-orange-500" />
                میانگین خواب شبانه
              </Label>
              <span className="text-xs font-bold text-orange-600 font-stat">
                {toPersianDigits(data.sleepHours ?? 7)} ساعت
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">خواب کمتر از ۷ ساعت ریکاوری عضله را مختل می‌کند.</p>
            <Slider
              min={4}
              max={12}
              step={1}
              value={[data.sleepHours ?? 7]}
              onValueChange={(v) => onChange({ sleepHours: v[0] })}
              className="w-full"
            />
            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
              <span>۴ ساعت</span>
              <span>۸ ساعت (ایده‌آل)</span>
              <span>۱۲ ساعت</span>
            </div>
          </div>

          {/* Stress level slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-slate-700 text-xs flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-orange-500" />
                سطح استرس روزانه
              </Label>
              <span className="text-xs font-bold text-orange-600 font-stat">
                {toPersianDigits(data.stressLevel ?? 3)} از ۵
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">استرس بالا باعث افزایش کورتیزول و افت ریکاوری می‌شود.</p>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[data.stressLevel ?? 3]}
              onValueChange={(v) => onChange({ stressLevel: v[0] })}
              className="w-full"
            />
            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
              <span>آرام (۱)</span>
              <span>متوسط (۳)</span>
              <span>بسیار پراسترس (۵)</span>
            </div>
          </div>

          {/* Water habit slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-slate-700 text-xs flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-orange-500" />
                عادت فعلی نوشیدن آب
              </Label>
              <span className="text-xs font-bold text-orange-600 font-stat">
                {toPersianDigits(data.waterHabit ?? 6)} لیوان
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">برای محاسبه دقیق هدف هیدراتاسیون روزانه استفاده می‌شود.</p>
            <Slider
              min={0}
              max={15}
              step={1}
              value={[data.waterHabit ?? 6]}
              onValueChange={(v) => onChange({ waterHabit: v[0] })}
              className="w-full"
            />
            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
              <span>۰</span>
              <span>۸ لیوان (پیشنهادی)</span>
              <span>۱۵</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ STEP 2: Activity & Goals ============ */
function StepActivityGoals({ data, onChange }: { data: Partial<OnboardingData>; onChange: (p: Partial<OnboardingData>) => void }) {
  const goals: { id: Goal; label: string; icon: string; desc: string }[] = [
    { id: "fat_loss", label: "کاهش وزن", icon: "🔥", desc: "کاهش چربی بدن" },
    { id: "muscle_gain", label: "عضله‌سازی", icon: "💪", desc: "افزایش حجم و قدرت" },
    { id: "endurance", label: "افزایش استقامت", icon: "🏃", desc: "بهبود توان هوازی" },
    { id: "fitness", label: "تثبیت وزن", icon: "⚡", desc: "حفظ تناسب و سلامت" },
  ];
  return (
    <div>
      <StepHeader icon={Target} title="سطح فعالیت و اهداف" subtitle="هدف اصلی و سطح فعالیت روزانه خود را انتخاب کنید" />
      <div className="space-y-2.5 mb-6">
        {goals.map((g) => (
          <button
            key={g.id}
            onClick={() => onChange({ goal: g.id })}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 bg-white transition-all text-right ${
              data.goal === g.id
                ? "border-orange-500 bg-orange-50 shadow-md shadow-orange-500/10"
                : "border-orange-200 hover:border-orange-300"
            }`}
          >
            <div className="text-3xl">{g.icon}</div>
            <div className="flex-1">
              <div className="font-bold text-slate-900">{g.label}</div>
              <div className="text-xs text-slate-500">{g.desc}</div>
            </div>
            {data.goal === g.id && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={GOLD_GRADIENT}>
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="mb-4">
        <Label className="mb-2 block text-slate-700">سطح فعالیت روزانه</Label>
        <div className="space-y-2">
          {(["sedentary", "light", "moderate", "active", "very_active"] as const).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ activityLevel: a })}
              className={`w-full p-3 rounded-xl border-2 bg-white text-sm text-right transition ${
                data.activityLevel === a
                  ? "border-orange-500 bg-orange-50 text-slate-900"
                  : "border-orange-200 text-slate-700 hover:border-orange-300"
              }`}
            >
              {ACTIVITY_LABELS[a]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-2 block text-slate-700">
          روزهای تمرین هفته —{" "}
          <span className="font-stat text-orange-600">
            {toPersianDigits((data.workoutDaysList || []).length)} روز انتخاب‌شده
          </span>
        </Label>
        <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
          برای انتخاب/لغو روزها روی آن‌ها بزنید. تعداد روزهای تمرین به‌صورت خودکار از روزهای انتخاب‌شده محاسبه می‌شود.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PERSIAN_WEEKDAYS.map((day) => {
            const list = data.workoutDaysList || [];
            const isSelected = list.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  let newList: string[];
                  if (isSelected) {
                    newList = list.filter((d) => d !== day);
                  } else {
                    newList = [...list, day];
                  }
                  onChange({
                    workoutDaysList: newList,
                    workoutDays: newList.length,
                  });
                }}
                className={`relative p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                  isSelected
                    ? "text-white shadow-md shadow-orange-500/20 border-transparent hover:scale-105"
                    : "border-orange-200 bg-white text-slate-700 hover:border-orange-300"
                }`}
                style={
                  isSelected
                    ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" }
                    : undefined
                }
              >
                {day}
                {isSelected && (
                  <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <Check className="w-2.5 h-2.5 text-orange-500" strokeWidth={4} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {(data.workoutDaysList || []).length === 0 && (
          <p className="text-[11px] text-amber-600 mt-2">
            ⚠️ حداقل یک روز را انتخاب کنید
          </p>
        )}
      </div>

      {/* NEW: Goal timeline & preferred workout time (اختیاری) */}
      <div className="mt-5">
        <GoalTimelineFields data={data} onChange={onChange} />
      </div>
    </div>
  );
}

/* ============ Goal Timeline & Circadian (اختیاری) ============ */
function GoalTimelineFields({
  data,
  onChange,
}: {
  data: Partial<OnboardingData>;
  onChange: (p: Partial<OnboardingData>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const times: { id: WorkoutTime; label: string; icon: string }[] = [
    { id: "morning", label: WORKOUT_TIME_LABELS.morning, icon: "🌅" },
    { id: "afternoon", label: WORKOUT_TIME_LABELS.afternoon, icon: "☀️" },
    { id: "evening", label: WORKOUT_TIME_LABELS.evening, icon: "🌇" },
    { id: "night", label: WORKOUT_TIME_LABELS.night, icon: "🌙" },
  ];

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">زمان‌بندی هدف و ساعات تمرین (اختیاری)</p>
            <p className="text-[11px] text-slate-500">برای برنامه‌ریزی دقیق‌تر تایم لاین و بهینه‌سازی سیرکادین</p>
          </div>
        </div>
        <ChevronLeft
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "-rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5">
          {/* Target date — Persian (Jalali) date picker */}
          <div>
            <Label className="mb-2 block text-slate-700 text-xs flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-orange-500" />
              تاریخ هدف (Target Date)
            </Label>
            <p className="text-[11px] text-slate-500 mb-2">تاریخی که می‌خواهید تا آن زمان به وزن هدف برسید. اختیاری.</p>
            <PersianDatePicker
              value={data.targetDate ?? null}
              onChange={(iso) => onChange({ targetDate: iso || undefined })}
              placeholder="انتخاب تاریخ هدف..."
              clearable={true}
              className="w-full"
            />
          </div>

          {/* Preferred workout time */}
          <div>
            <Label className="mb-2 block text-slate-700 text-xs flex items-center gap-1.5">
              <Sunrise className="w-3.5 h-3.5 text-orange-500" />
              ساعت ترجیحی تمرین
            </Label>
            <p className="text-[11px] text-slate-500 mb-2">برای بهینه‌سازی عملکرد بر اساس ریتم سیرکادین بدن.</p>
            <div className="grid grid-cols-2 gap-2">
              {times.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange({ workoutTime: data.workoutTime === t.id ? undefined : t.id })}
                  className={`p-3 rounded-xl border-2 text-right transition flex items-center gap-2 ${
                    data.workoutTime === t.id
                      ? "border-transparent text-white shadow-md"
                      : "border-orange-200 bg-white text-slate-700 hover:border-orange-300"
                  }`}
                  style={data.workoutTime === t.id ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : undefined}
                >
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-[11px] font-bold leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ STEP 3: Training Preferences ============ */
function StepTrainingPrefs({ data, onChange }: { data: Partial<OnboardingData>; onChange: (p: Partial<OnboardingData>) => void }) {
  const items = [
    { id: "dumbbell", label: "دمبل", icon: "🏋️" },
    { id: "barbell", label: "هالتر", icon: "⚖️" },
    { id: "kettlebell", label: "کتل‌بل", icon: "🔔" },
    { id: "bands", label: "کش مقاومتی", icon: "➰" },
    { id: "pullup_bar", label: "بارفیکس", icon: "🤸" },
    { id: "bench", label: "نیمکت", icon: "🪑" },
    { id: "machine", label: "دستگاه بدنسازی", icon: "⚙️" },
    { id: "bodyweight", label: "فقط وزن بدن", icon: "🧘" },
  ];
  const toggle = (id: string) => onChange({ equipment: data.equipment?.includes(id) ? data.equipment.filter((x) => x !== id) : [...(data.equipment || []), id] });
  return (
    <div>
      <StepHeader icon={Activity} title="ترجیحات تمرینی" subtitle="محیط تمرین، تجهیزات و محدودیت‌های بدنی" />
      <div className="mb-5">
        <Label className="mb-2 block text-slate-700">محیط تمرین</Label>
        <div className="grid grid-cols-3 gap-2">
          {(["gym", "home", "both"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onChange({ workoutPlace: p })}
              className={`p-3 rounded-xl border-2 bg-white text-sm font-medium transition ${
                data.workoutPlace === p
                  ? "border-orange-500 bg-orange-50 text-orange-600"
                  : "border-orange-200 text-slate-700 hover:border-orange-300"
              }`}
            >
              {WORKOUT_PLACE_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-5">
        <Label className="mb-2 block text-slate-700">تجهیزات در دسترس</Label>
        <div className="grid grid-cols-2 gap-2">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 bg-white transition text-right ${
                data.equipment?.includes(it.id)
                  ? "border-orange-500 bg-orange-50"
                  : "border-orange-200 hover:border-orange-300"
              }`}
            >
              <span className="text-xl">{it.icon}</span>
              <span className="text-xs font-medium text-slate-700">{it.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <Label className="mb-2 block text-slate-700">آسیب‌دیدگی یا محدودیت بدنی</Label>
          <Textarea
            value={data.injuries || ""}
            onChange={(e) => onChange({ injuries: e.target.value })}
            placeholder="مثلاً: زانو درد، مشکل کمر، شانه آسیب‌دیده..."
            className="rounded-xl min-h-[72px] bg-white border-2 border-orange-100 focus-visible:border-orange-400 focus-visible:ring-orange-300/40 text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <div>
          <Label className="mb-2 block text-slate-700">سوابق بیماری</Label>
          <Textarea
            value={data.diseases || ""}
            onChange={(e) => onChange({ diseases: e.target.value })}
            placeholder="مثلاً: فشار خون بالا، دیابت..."
            className="rounded-xl min-h-[72px] bg-white border-2 border-orange-100 focus-visible:border-orange-400 focus-visible:ring-orange-300/40 text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* NEW: Medical conditions + Supplements — for safer & more precise programs */}
      <div className="mt-5">
        <MedicalAndSupplementsFields data={data} onChange={onChange} />
      </div>

      {/* Professional advanced fields — for pro athletes */}
      <ProfessionalAdvancedFields data={data} onChange={onChange} />
    </div>
  );
}

/* ============ Medical conditions & supplements (اختیاری) ============ */
function MedicalAndSupplementsFields({
  data,
  onChange,
}: {
  data: Partial<OnboardingData>;
  onChange: (p: Partial<OnboardingData>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const conditions = Object.entries(MEDICAL_CONDITION_LABELS) as [MedicalConditionKey, string][];

  const toggleCondition = (key: MedicalConditionKey) => {
    const list = data.medicalConditions ?? [];
    const next = list.includes(key) ? list.filter((c) => c !== key) : [...list, key];
    onChange({ medicalConditions: next });
  };

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">شرایط پزشکی و مکمل‌ها (اختیاری)</p>
            <p className="text-[11px] text-slate-500">برای طراحی برنامه ایمن‌تر و دقیق‌تر</p>
          </div>
        </div>
        <ChevronLeft
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "-rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5">
          {/* Medical conditions checkboxes */}
          <div>
            <Label className="mb-2 block text-slate-700 text-xs flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-orange-500" />
              شرایط پزشکی خاص
            </Label>
            <p className="text-[11px] text-slate-500 mb-3">
              اگر موردی دارید، تیک بزنید. این موارد روی انتخاب حرکات و شدت تمرین تأثیر می‌گذارد.
            </p>
            <div className="space-y-2">
              {conditions.map(([key, label]) => {
                const checked = data.medicalConditions?.includes(key) ?? false;
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                      checked
                        ? "border-orange-500 bg-orange-50"
                        : "border-orange-200 bg-white hover:border-orange-300"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleCondition(key)}
                    />
                    <span className="text-xs font-medium text-slate-700 flex-1">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Current supplements */}
          <div>
            <Label className="mb-2 block text-slate-700 text-xs flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-orange-500" />
              مکمل‌های فعلی مصرفی
            </Label>
            <p className="text-[11px] text-slate-500 mb-2">
              مکمل‌هایی که الان مصرف می‌کنید تا برنامه آن‌ها را در نظر بگیرد و تداخل ایجاد نشود.
            </p>
            <Input
              value={data.currentSupplements || ""}
              onChange={(e) => onChange({ currentSupplements: e.target.value })}
              placeholder="مثلاً: کراتین ۵ گرم، ویتامین D3 2000، امگا ۳..."
              className="h-11 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 text-slate-900 placeholder:text-slate-400 text-sm"
              dir="rtl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Professional Advanced Fields ============ */
function ProfessionalAdvancedFields({
  data,
  onChange,
}: {
  data: Partial<OnboardingData>;
  onChange: (p: Partial<OnboardingData>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const experienceOptions: { id: NonNullable<OnboardingData["trainingExperience"]>; label: string; icon: string }[] = [
    { id: "beginner", label: "مبتدی", icon: "🌱" },
    { id: "intermediate", label: "متوسط", icon: "⚡" },
    { id: "advanced", label: "پیشرفته", icon: "🔥" },
    { id: "pro", label: "حرفه‌ای", icon: "👑" },
  ];

  return (
    <div className="mt-5 rounded-2xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">فیلدهای حرفه‌ای (اختیاری)</p>
            <p className="text-[11px] text-slate-500">برای ورزشکاران پیشرفته و حرفه‌ای</p>
          </div>
        </div>
        <ChevronLeft
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "-rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Training experience */}
          <div>
            <Label className="mb-2 block text-slate-700">سابقه ورزشی</Label>
            <div className="grid grid-cols-4 gap-2">
              {experienceOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      trainingExperience:
                        data.trainingExperience === opt.id ? undefined : opt.id,
                    })
                  }
                  className={`p-2.5 rounded-xl border-2 text-center transition ${
                    data.trainingExperience === opt.id
                      ? "border-transparent text-white shadow-md"
                      : "border-orange-200 bg-white text-slate-700 hover:border-orange-300"
                  }`}
                  style={
                    data.trainingExperience === opt.id
                      ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" }
                      : undefined
                  }
                >
                  <div className="text-lg">{opt.icon}</div>
                  <div className="text-[11px] font-bold mt-0.5">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Previous training type */}
          <div>
            <Label className="mb-2 block text-slate-700">نوع تمرین قبلی</Label>
            <Input
              value={data.previousTrainingType || ""}
              onChange={(e) => onChange({ previousTrainingType: e.target.value })}
              placeholder="مثلاً: بدنسازی، کراس‌فیت، فوتبال، کاراته..."
              className="h-11 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 text-slate-900 placeholder:text-slate-400 text-sm"
            />
          </div>

          {/* Drug allergies */}
          <div>
            <Label className="mb-2 block text-slate-700">آلرژی‌های دارویی</Label>
            <Input
              value={data.drugAllergies || ""}
              onChange={(e) => onChange({ drugAllergies: e.target.value })}
              placeholder="مثلاً: پنی‌سیلین، آسپرین..."
              className="h-11 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 text-slate-900 placeholder:text-slate-400 text-sm"
            />
          </div>

          {/* Current medications */}
          <div>
            <Label className="mb-2 block text-slate-700">داروهای مصرفی فعلی</Label>
            <Input
              value={data.currentMedications || ""}
              onChange={(e) => onChange({ currentMedications: e.target.value })}
              placeholder="مثلاً: متفورمین، امگا ۳، مولتی‌ویتامین..."
              className="h-11 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 text-slate-900 placeholder:text-slate-400 text-sm"
            />
          </div>

          {/* Max lifts (for pro athletes) */}
          <div>
            <Label className="mb-2 block text-slate-700">
              حداکثر وزنه‌ها (اختیاری) — اسکوات / پرس سینه / ددلیفت
            </Label>
            <Input
              value={data.maxLifts || ""}
              onChange={(e) => onChange({ maxLifts: e.target.value })}
              placeholder="مثلاً: اسکوات ۱۲۰ / پرس ۱۰۰ / ددلیفت ۱۵۰ کیلو"
              className="h-11 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 text-slate-900 placeholder:text-slate-400 text-sm"
              dir="rtl"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              این اطلاعات برای ورزشکاران حرفه‌ای استفاده می‌شود تا برنامه دقیق‌تری طراحی شود.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ STEP 4: Nutrition ============ */
function StepNutrition({ data, onChange }: { data: Partial<OnboardingData>; onChange: (p: Partial<OnboardingData>) => void }) {
  const diets: { id: DietType; label: string; icon: string; desc: string }[] = [
    { id: "standard", label: "عادی", icon: "🍽️", desc: "بدون محدودیت" },
    { id: "vegetarian", label: "گیاه‌خواری", icon: "🥗", desc: "بدون گوشت" },
    { id: "vegan", label: "وگن", icon: "🌱", desc: "بدون محصولات حیوانی" },
    { id: "keto", label: "کتوژنیک", icon: "🥑", desc: "کم‌کربو" },
  ];
  return (
    <div>
      <StepHeader icon={Salad} title="اطلاعات تغذیه‌ای" subtitle="رژیم غذایی، آلرژی‌ها و تعداد وعده‌ها" />
      <div className="mb-5">
        <Label className="mb-2 block text-slate-700">نوع رژیم غذایی</Label>
        <div className="space-y-2">
          {diets.map((d) => (
            <button
              key={d.id}
              onClick={() => onChange({ dietType: d.id })}
              className={`w-full flex items-center gap-4 p-3 rounded-xl border-2 bg-white transition text-right ${
                data.dietType === d.id
                  ? "border-orange-500 bg-orange-50"
                  : "border-orange-200 hover:border-orange-300"
              }`}
            >
              <div className="text-2xl">{d.icon}</div>
              <div className="flex-1">
                <div className="font-bold text-sm text-slate-900">{d.label}</div>
                <div className="text-[11px] text-slate-500">{d.desc}</div>
              </div>
              {data.dietType === d.id && <Check className="w-5 h-5 text-orange-500" />}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-5">
        <Label className="mb-2 block text-slate-700">تعداد وعده‌های غذایی رغبتی</Label>
        <div className="grid grid-cols-4 gap-2">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange({ mealCount: n })}
              className={`p-3 rounded-xl border-2 bg-white text-sm font-stat transition ${
                data.mealCount === n
                  ? "border-orange-500 bg-orange-50 text-orange-600"
                  : "border-orange-200 text-slate-700 hover:border-orange-300"
              }`}
            >
              {toPersianDigits(n)} وعده
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="mb-2 block text-slate-700">آلرژی‌های غذایی</Label>
        <Textarea
          value={data.allergies || ""}
          onChange={(e) => onChange({ allergies: e.target.value })}
          placeholder="مثلاً: لاکتوز، گلوتن، آجیل..."
          className="rounded-xl min-h-[72px] bg-white border-2 border-orange-100 focus-visible:border-orange-400 focus-visible:ring-orange-300/40 text-slate-900 placeholder:text-slate-400"
        />
      </div>

      {/* NEW: Diet preferences — disliked foods, cuisine, water goal */}
      <div className="mt-5">
        <DietPreferencesFields data={data} onChange={onChange} />
      </div>

      {/* Optional body measurements — moved here from the removed upload step */}
      <div className="mt-5">
        <OptionalBodyMeasurements data={data} onChange={onChange} />
      </div>
    </div>
  );
}

/* ============ Diet Preferences (اختیاری) ============ */
function DietPreferencesFields({
  data,
  onChange,
}: {
  data: Partial<OnboardingData>;
  onChange: (p: Partial<OnboardingData>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const cuisines: { id: PreferredCuisine; label: string; icon: string }[] = [
    { id: "persian", label: PREFERRED_CUISINE_LABELS.persian, icon: "🍛" },
    { id: "mediterranean", label: PREFERRED_CUISINE_LABELS.mediterranean, icon: "🫒" },
    { id: "asian", label: PREFERRED_CUISINE_LABELS.asian, icon: "🍜" },
    { id: "mixed", label: PREFERRED_CUISINE_LABELS.mixed, icon: "🌍" },
  ];

  // Auto-calculate daily water goal: weight (kg) × 35 ml, with +/-0.5L based on activity level
  const weight = data.weight ?? 70;
  const baseMl = Math.round(weight * 35);
  let activityAdjustMl = 0;
  if (data.activityLevel === "active" || data.activityLevel === "very_active") activityAdjustMl = 500;
  else if (data.activityLevel === "moderate") activityAdjustMl = 250;
  const waterGoalMl = baseMl + activityAdjustMl;
  const waterGoalLiters = (waterGoalMl / 1000).toFixed(1);
  const waterGoalGlasses = Math.round(waterGoalMl / 250);

  // Sync to data so backend receives it
  // (no setState in render — we sync on every render via onChange is bad. Use memo or pass-through.)
  // Since onChange is a parent setter, we should NOT call it during render. Instead we
  // let parent compute waterGoalMl from weight at submit. But for display purposes here
  // we just compute locally; the actual save happens in route.ts based on weight too.

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    const existing = (data.dislikedFoods || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!existing.includes(v)) {
      onChange({ dislikedFoods: [...existing, v].join(", ") });
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const existing = (data.dislikedFoods || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ dislikedFoods: existing.filter((t) => t !== tag).join(", ") });
  };

  const tags = (data.dislikedFoods || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">ترجیحات غذایی (اختیاری)</p>
            <p className="text-[11px] text-slate-500">غذاهای دوست‌نداشته، سبک آشپزی و هدف هیدراتاسیون</p>
          </div>
        </div>
        <ChevronLeft
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "-rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5">
          {/* Disliked foods tags input */}
          <div>
            <Label className="mb-2 block text-slate-700 text-xs flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" />
              غذاهای دوست‌نداشته یا حذفی
            </Label>
            <p className="text-[11px] text-slate-500 mb-2">
              غذاهایی که دوست ندارید یا حذف کرده‌اید (با Enter یا کاما اضافه کنید).
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="مثلاً: کلم بروکلی، کبد..."
                className="h-11 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 text-slate-900 placeholder:text-slate-400 text-sm"
              />
              <button
                type="button"
                onClick={addTag}
                className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                aria-label="افزودن"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-[11px] font-medium text-slate-700"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-orange-500 hover:text-orange-700"
                      aria-label={`حذف ${tag}`}
                    >
                      <X className="w-3 h-3" strokeWidth={3} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Preferred cuisine */}
          <div>
            <Label className="mb-2 block text-slate-700 text-xs flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" />
              سبک آشپزی ترجیحی
            </Label>
            <p className="text-[11px] text-slate-500 mb-2">برنامه غذایی بر اساس سبک آشپزی مورد علاقه شما طراحی می‌شود.</p>
            <div className="grid grid-cols-2 gap-2">
              {cuisines.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ preferredCuisine: data.preferredCuisine === c.id ? undefined : c.id })}
                  className={`p-3 rounded-xl border-2 text-right transition flex items-center gap-2 ${
                    data.preferredCuisine === c.id
                      ? "border-transparent text-white shadow-md"
                      : "border-orange-200 bg-white text-slate-700 hover:border-orange-300"
                  }`}
                  style={data.preferredCuisine === c.id ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : undefined}
                >
                  <span className="text-lg">{c.icon}</span>
                  <span className="text-[11px] font-bold leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-calculated water goal */}
          <div className="rounded-xl border-2 border-cyan-100 bg-cyan-50/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Droplet className="w-4 h-4 text-cyan-600" />
              <p className="text-xs font-bold text-slate-800">هدف هیدراتاسیون روزانه (محاسبه خودکار)</p>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
              بر اساس وزن فعلی شما ({toPersianDigits(weight)} کیلوگرم) و سطح فعالیت روزانه محاسبه شده است.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-2xl font-black font-stat text-cyan-700">
                  {toPersianDigits(Number(waterGoalLiters))} لیتر
                </div>
                <div className="text-[10px] text-slate-500">
                  معادل {toPersianDigits(waterGoalGlasses)} لیوان (۲۵۰ml)
                </div>
              </div>
              <div className="text-[10px] text-slate-500 leading-snug text-left">
                فرمول: وزن × ۳۵ml<br />+ {toPersianDigits(activityAdjustMl)}ml فعالیت
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ STEP 4 (REMOVED): Photo Uploads ============
 * The photo upload step has been REMOVED from onboarding entirely.
 * Both blood test photos and body photos are now collected AFTER purchase:
 *   - Body photos: via /api/coach/submit-body-analysis (for Advanced/Ultimate users)
 *     — these photos are analyzed by AI and used in program generation.
 *   - Blood test photos: via the separate blood-test feature in the panel
 *     (completely optional, never required for program generation).
 * The optional body measurements (chest/arm/waist/hip/thigh) are now collected
 * at the end of StepNutrition (step 3) — see OptionalBodyMeasurements component below.
 */

/* ============ Optional Body Measurements (اختیاری) ============ */
function OptionalBodyMeasurements({
  data,
  onChange,
}: {
  data: Partial<OnboardingData>;
  onChange: (p: Partial<OnboardingData>) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const fields: { key: keyof Pick<OnboardingData, "chestMeasurement" | "armMeasurement" | "waistMeasurement" | "hipMeasurement" | "thighMeasurement" | "neckMeasurement" | "shoulderMeasurement" | "calfMeasurement">; label: string; icon: string }[] = [
    { key: "waistMeasurement", label: "دور کمر", icon: "🎯" },
    { key: "neckMeasurement", label: "دور گردن", icon: "🦴" },
    { key: "chestMeasurement", label: "دور قفسه سینه", icon: "🫁" },
    { key: "armMeasurement", label: "دور بازو", icon: "💪" },
    { key: "hipMeasurement", label: "دور باسن", icon: "🍑" },
    { key: "thighMeasurement", label: "دور ران", icon: "🦵" },
    { key: "shoulderMeasurement", label: "دور شانه", icon: "🤸" },
    { key: "calfMeasurement", label: "دور ساق پا", icon: "🦶" },
  ];

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">اندازه‌های بدنی (اختیاری)</p>
            <p className="text-[11px] text-slate-500">اختیاری — اما برای تحلیل پیشرفت بهتر توصیه می‌شود</p>
          </div>
        </div>
        <ChevronLeft
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "-rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-slate-600 leading-relaxed bg-white/60 rounded-lg p-2.5 border border-amber-100">
            این اندازه‌ها به عنوان <b>چکاپ اولیه (baseline)</b> ذخیره می‌شوند تا در چکاپ‌های بعدی بتوانیم پیشرفت شما را دقیق‌تر بسنجیم. اگر متر ندارید یا نمی‌خواهید وارد کنید، همین‌طور هم کار می‌کند.
          </p>
          <div className="rounded-lg bg-amber-100/70 border border-amber-300 px-3 py-2 flex items-start gap-2">
            <span className="text-sm">💡</span>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              برای محاسبه دقیق درصد چربی بدن، <b>دور کمر</b> و <b>دور گردن</b> الزامی است (برای خانم‌ها دور باسن هم لازم است). این اندازه‌ها با فرمول علمی US Navy محاسبه می‌شود.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {fields.map((f) => (
              <div key={f.key}>
                <Label className="mb-1 block text-slate-700 text-xs flex items-center gap-1.5">
                  <span className="text-base">{f.icon}</span>
                  {f.label}
                  <span className="text-slate-400 font-normal text-[10px]">(اختیاری)</span>
                  <span className="text-slate-400 font-normal text-[10px]">(cm)</span>
                </Label>
                <Input
                  type="number"
                  dir="ltr"
                  inputMode="numeric"
                  value={data[f.key] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange({ [f.key]: v ? Number(v) : undefined } as Partial<OnboardingData>);
                  }}
                  placeholder="مثلاً ۱۰۰"
                  className="h-11 rounded-xl bg-white border-2 border-orange-100 focus-visible:border-orange-400 text-slate-900 placeholder:text-slate-400 text-center text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GeneratingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 bg-white relative overflow-hidden">
      {/* Subtle gold accents */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/4 -left-24 w-72 h-72 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="absolute bottom-1/4 -right-24 w-72 h-72 rounded-full bg-orange-100/50 blur-3xl" />
      </div>

      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-orange-500/30 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xl font-black text-slate-900 mb-2 text-center"
      >
        فیتاپ هوشمند در حال ساخت برنامه شماست...
      </motion.h2>
      <p className="text-slate-500 text-sm text-center max-w-xs mb-8">
        مربی هوشمند در حال تحلیل اطلاعات شما و طراحی برنامه تمرینی و غذایی اختصاصی است.
      </p>

      <div className="space-y-3 w-full max-w-xs">
        {[
          { label: "تحلیل اطلاعات فیزیکی", delay: 0 },
          { label: "محاسبه کالری و درشت‌مغذی‌ها", delay: 0.3 },
          { label: "طراحی برنامه تمرینی", delay: 0.6 },
          { label: "آماده‌سازی برنامه غذایی", delay: 0.9 },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: s.delay }}
            className="flex items-center gap-3 text-sm bg-white border border-orange-100 rounded-xl px-4 py-3 shadow-sm"
          >
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span className="text-slate-700">{s.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
