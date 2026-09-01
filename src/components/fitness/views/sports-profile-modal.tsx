"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Dumbbell,
  Activity,
  Target,
  Salad,
  HeartPulse,
  Moon,
  Trophy,
  Calendar,
  Pill,
  Ruler,
  Camera,
  TestTube,
  Video,
  Loader2,
  Save,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  toPersianDigits,
  GOAL_LABELS, ACTIVITY_LABELS,
  WORKOUT_PLACE_LABELS, DIET_LABELS, TRAINING_EXPERIENCE_LABELS,
  BODY_FRAME_LABELS, WORKOUT_TIME_LABELS, PREFERRED_CUISINE_LABELS,
  MEDICAL_CONDITION_LABELS,
  PERSIAN_WEEKDAYS,
  type Goal, type ActivityLevel, type WorkoutPlace, type DietType,
  type TrainingExperience, type BodyFrame, type WorkoutTime,
  type PreferredCuisine, type MedicalConditionKey,
} from "@/lib/fitness/types";
import { toast } from "sonner";

/**
 * ─── مودال «پرونده ورزشی» (Sports Profile Modal) ───
 *
 * درخواست مالک: «نیازی نیست تمام اطلاعات پرونده ورزشی کاربر رو در منوی
 * پروفایل نشون بدی — اطلاعات پایه رو در منوی پروفایل بیار و یک دکمه بذار
 * با عنوان "مشاهده پرونده ورزشی" که همه‌چیز به‌صورت یک مدال جذاب با قابلیت
 * ویرایش در اونجا وجود داشته باشه».
 *
 * این مودال از پروفایل (منوی بازشو) جدا است و داده‌ی خودش را مستقل می‌گیرد:
 *   • ۹ سکشن پرونده با ویرایش آیتم‌به‌آیتم (PUT /api/onboarding/profile)
 *   • اندازه‌های اولیه بدن (baseline چکاپ فاز ۰)
 *   • تحلیل فیتاپ هوشمند
 *   • عکس‌های پیشرفت + تحلیل‌های عکس بدن / آزمایش خون / ویدیو
 */

interface OnboardingProfileDto {
  genderLabel?: string;
  age: number;
  height: number;
  weight: number;
  targetWeight?: number | null;
  goalLabel: string;
  activityLabel: string;
  workoutDays: number;
  workoutDaysList?: string[];
  workoutPlaceLabel: string;
  workoutTimeLabel?: string;
  equipment?: string[];
  dietLabel: string;
  allergies?: string;
  dislikedFoods?: string;
  preferredCuisineLabel?: string;
  waterHabit?: number | null;
  injuries?: string;
  diseases?: string;
  drugAllergies?: string;
  currentMedications?: string;
  medicalConditionsLabel?: string;
  sleepHours?: number | null;
  stressLevel?: number | null;
  bodyFrameLabel?: string;
  trainingExperienceLabel?: string;
  previousTrainingType?: string;
  maxLifts?: string;
  targetDate?: string;
  currentSupplements?: string;
  gender?: string;
  goal?: string;
  activityLevel?: string;
  workoutPlace?: string;
  workoutTime?: string;
  dietType?: string;
  preferredCuisine?: string;
  trainingExperience?: string;
  bodyFrame?: string;
  medicalConditions?: string[];
}

interface BaselineDto {
  weight: number;
  chestMeasurement?: number | null;
  armMeasurement?: number | null;
  waistMeasurement?: number | null;
  hipMeasurement?: number | null;
  thighMeasurement?: number | null;
  createdAt?: string;
}

type SectionId =
  | "basic" | "goal" | "equipment" | "nutrition"
  | "health" | "recovery" | "experience" | "target" | "supplements";

export function SportsProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OnboardingProfileDto | null>(null);
  const [baseline, setBaseline] = useState<BaselineDto | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [progressPhotos, setProgressPhotos] = useState<any[]>([]);
  const [userMedia, setUserMedia] = useState<any>({
    bodyPhotos: [], bloodTests: [], videoAnalysis: [], bodyAnalysis: [],
  });
  const [editingSection, setEditingSection] = useState<SectionId | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [onboardingRes, progressRes, mediaRes] = await Promise.all([
        fetch("/api/onboarding/analysis"),
        fetch("/api/progress"),
        fetch("/api/user-media"),
      ]);
      const onboardingData = await onboardingRes.json().catch(() => null);
      const progressData = await progressRes.json().catch(() => null);
      const mediaData = await mediaRes.json().catch(() => null);
      if (onboardingData?.profile) setProfile(onboardingData.profile);
      if (onboardingData?.baseline) setBaseline(onboardingData.baseline);
      if (onboardingData?.analysis) setAnalysis(onboardingData.analysis);
      // C1-fix: کلید درست پاسخ GET /api/progress همان «photos» است (نه progressPhotos) —
      // قبلاً کارت «عکس‌های پیشرفت بدن» همیشه خالی می‌ماند. اگر photos نبود،
      // fallback به bodyPhotos از /api/user-media (همان شکل داده: id/imageUrl/type/takenAt).
      if (Array.isArray(progressData?.photos)) {
        setProgressPhotos(progressData.photos);
      } else if (Array.isArray(mediaData?.bodyPhotos)) {
        setProgressPhotos(mediaData.bodyPhotos);
      }
      if (mediaData) setUserMedia(mediaData);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setEditingSection(null);
      loadData();
    }
  }, [open, loadData]);

  function startEditing(section: SectionId) {
    const p = profile;
    if (!p) return;
    const d: Record<string, string> = {};
    switch (section) {
      case "basic":
        d.age = String(p.age ?? "");
        d.height = String(p.height ?? "");
        d.weight = String(p.weight ?? "");
        d.targetWeight = String(p.targetWeight ?? "");
        d.gender = p.gender || "male";
        break;
      case "goal":
        d.goal = p.goal || "fitness";
        d.activityLevel = p.activityLevel || "moderate";
        d.workoutDays = String(p.workoutDays ?? "");
        d.workoutPlace = p.workoutPlace || "gym";
        d.workoutTime = p.workoutTime || "";
        d.workoutDaysList = (p.workoutDaysList || []).join(",");
        break;
      case "equipment":
        d.equipment = (p.equipment || []).join(", ");
        break;
      case "nutrition":
        d.dietType = p.dietType || "standard";
        d.preferredCuisine = p.preferredCuisine || "";
        d.dislikedFoods = p.dislikedFoods || "";
        d.allergies = p.allergies || "";
        break;
      case "health":
        d.injuries = p.injuries || "";
        d.diseases = p.diseases || "";
        d.drugAllergies = p.drugAllergies || "";
        d.currentMedications = p.currentMedications || "";
        d.medicalConditions = (p.medicalConditions || []).join(",");
        break;
      case "recovery":
        d.sleepHours = String(p.sleepHours ?? "");
        d.stressLevel = String(p.stressLevel ?? "");
        d.waterHabit = String(p.waterHabit ?? "");
        d.bodyFrame = p.bodyFrame || "";
        break;
      case "experience":
        d.trainingExperience = p.trainingExperience || "beginner";
        d.previousTrainingType = p.previousTrainingType || "";
        d.maxLifts = p.maxLifts || "";
        break;
      case "target":
        d.targetDate = p.targetDate || "";
        break;
      case "supplements":
        d.currentSupplements = p.currentSupplements || "";
        break;
    }
    setEditData(d);
    setEditingSection(section);
  }

  function cancelEditing() {
    setEditingSection(null);
    setEditData({});
  }

  async function saveSection() {
    if (!editingSection) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      const numFields: Record<SectionId, string[]> = {
        basic: ["age", "height", "weight", "targetWeight"],
        goal: ["workoutDays"],
        equipment: [],
        nutrition: [],
        health: [],
        recovery: ["sleepHours", "stressLevel", "waterHabit"],
        experience: [],
        target: [],
        supplements: [],
      };
      for (const [k, v] of Object.entries(editData)) {
        if (numFields[editingSection].includes(k)) {
          payload[k] = v === "" ? null : Number(v);
        } else {
          payload[k] = v;
        }
      }
      const res = await fetch("/api/onboarding/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data?.ok) {
        toast.success("پروفایل به‌روزرسانی شد و به مربی هوشمند تزریق شد ✅");
      } else {
        toast.success("پرونده ورزشی به‌روزرسانی شد ✅");
      }
      setEditingSection(null);
      setEditData({});
      await loadData();
    } catch {
      toast.error("خطا در ذخیره پروفایل");
    } finally {
      setSaving(false);
    }
  }

  const p = profile;

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="پرونده ورزشی"
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg h-[94vh] sm:h-[90vh] bg-white sm:rounded-3xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl"
        dir="rtl"
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-between p-4 text-white shrink-0 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-base leading-tight">پرونده ورزشی</h2>
              <p className="text-[10px] opacity-80">همه‌چیز درباره بدن و اهدافت — با ویرایش سریع</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="relative rounded-full text-white hover:bg-white/20 hover:text-white"
            aria-label="بستن پرونده ورزشی"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-slate-50/50">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
            </div>
          ) : !p ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center">
                <Dumbbell className="w-7 h-7 text-orange-500" />
              </div>
              <p className="text-sm text-slate-500">پرونده ورزشی یافت نشد — اول آنبوردینگ را کامل کنید.</p>
            </div>
          ) : (
            <>
              {/* خلاصه بالا */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4 bg-white">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <SummaryChip label="سن" value={p.age ? `${toPersianDigits(p.age)}` : "—"} />
                    <SummaryChip label="قد" value={p.height ? `${toPersianDigits(p.height)}` : "—"} unit="cm" />
                    <SummaryChip label="وزن" value={p.weight ? `${toPersianDigits(p.weight)}` : "—"} unit="kg" />
                    <SummaryChip label="هدف" value={p.goalLabel || "—"} />
                  </div>
                </Card>
              </motion.div>

              {/* ۹ سکشن پرونده */}
              <Card className="p-4 space-y-4 bg-white">
                {/* ۱) اطلاعات پایه */}
                <Section
                  title="اطلاعات پایه"
                  icon={<Activity className="w-4 h-4 text-primary" />}
                  editing={editingSection === "basic"}
                  onEdit={() => startEditing("basic")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "basic" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <EditSelect
                        label="جنسیت"
                        value={editData.gender || "male"}
                        onChange={(v) => setEditData({ ...editData, gender: v })}
                        options={[
                          { value: "male", label: "آقا" },
                          { value: "female", label: "خانم" },
                        ]}
                      />
                      <EditField label="سن (سال)" value={editData.age || ""} onChange={(v) => setEditData({ ...editData, age: v })} type="number" />
                      <EditField label="قد (cm)" value={editData.height || ""} onChange={(v) => setEditData({ ...editData, height: v })} type="number" />
                      <EditField label="وزن (kg)" value={editData.weight || ""} onChange={(v) => setEditData({ ...editData, weight: v })} type="number" />
                      <EditField label="وزن هدف (kg)" value={editData.targetWeight || ""} onChange={(v) => setEditData({ ...editData, targetWeight: v })} type="number" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <InfoRow label="جنسیت" value={p.genderLabel || "—"} />
                      <InfoRow label="سن" value={`${toPersianDigits(p.age)} سال`} />
                      <InfoRow label="قد" value={`${toPersianDigits(p.height)} cm`} />
                      <InfoRow label="وزن فعلی" value={`${toPersianDigits(p.weight)} kg`} />
                      {p.targetWeight != null && <InfoRow label="وزن هدف" value={`${toPersianDigits(p.targetWeight)} kg`} />}
                    </div>
                  )}
                </Section>

                {/* ۲) هدف و فعالیت */}
                <Section
                  title="هدف و فعالیت"
                  icon={<Target className="w-4 h-4 text-amber-500" />}
                  editing={editingSection === "goal"}
                  onEdit={() => startEditing("goal")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "goal" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <EditSelect
                        label="هدف اصلی"
                        value={editData.goal || "fitness"}
                        onChange={(v) => setEditData({ ...editData, goal: v })}
                        options={(Object.keys(GOAL_LABELS) as Goal[]).map((g) => ({ value: g, label: GOAL_LABELS[g] }))}
                      />
                      <EditSelect
                        label="سطح فعالیت"
                        value={editData.activityLevel || "moderate"}
                        onChange={(v) => setEditData({ ...editData, activityLevel: v })}
                        options={(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((g) => ({ value: g, label: ACTIVITY_LABELS[g] }))}
                      />
                      <EditField label="روزهای تمرین در هفته" value={editData.workoutDays || ""} onChange={(v) => setEditData({ ...editData, workoutDays: v })} type="number" />
                      <EditSelect
                        label="محیط تمرین"
                        value={editData.workoutPlace || "gym"}
                        onChange={(v) => setEditData({ ...editData, workoutPlace: v })}
                        options={(Object.keys(WORKOUT_PLACE_LABELS) as WorkoutPlace[]).map((g) => ({ value: g, label: WORKOUT_PLACE_LABELS[g] }))}
                      />
                      <EditSelect
                        label="زمان ترجیحی تمرین"
                        value={editData.workoutTime || ""}
                        onChange={(v) => setEditData({ ...editData, workoutTime: v })}
                        options={[
                          { value: "", label: "—" },
                          ...(Object.keys(WORKOUT_TIME_LABELS) as WorkoutTime[]).map((g) => ({ value: g, label: WORKOUT_TIME_LABELS[g] })),
                        ]}
                      />
                      <div className="col-span-2">
                        <Label className="mb-1 block text-[11px] text-muted-foreground">روزهای انتخابی هفته</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {PERSIAN_WEEKDAYS.map((day) => {
                            const selected = (editData.workoutDaysList || "").split(",").map((s) => s.trim()).includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  const current = (editData.workoutDaysList || "").split(",").map((s) => s.trim()).filter(Boolean);
                                  const next = selected ? current.filter((d) => d !== day) : [...current, day];
                                  setEditData({ ...editData, workoutDaysList: next.join(",") });
                                }}
                                className={`text-[11px] px-2.5 py-1 rounded-lg transition ${
                                  selected ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground hover:bg-muted"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      <InfoRow label="هدف اصلی" value={p.goalLabel} />
                      <InfoRow label="سطح فعالیت" value={p.activityLabel} />
                      <InfoRow label="روزهای تمرین" value={`${toPersianDigits(p.workoutDays)} روز در هفته`} />
                      {p.workoutDaysList && p.workoutDaysList.length > 0 && (
                        <InfoRow label="روزهای انتخابی" value={p.workoutDaysList.join("، ")} />
                      )}
                      <InfoRow label="محیط تمرین" value={p.workoutPlaceLabel} />
                      {p.workoutTimeLabel && <InfoRow label="زمان ترجیحی تمرین" value={p.workoutTimeLabel} />}
                    </div>
                  )}
                </Section>

                {/* ۳) تجهیزات */}
                <Section
                  title="تجهیزات"
                  icon={<Dumbbell className="w-4 h-4 text-violet-500" />}
                  editing={editingSection === "equipment"}
                  onEdit={() => startEditing("equipment")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "equipment" ? (
                    <EditTextArea
                      label="تجهیزات در دسترس (با کاما جدا کنید)"
                      value={editData.equipment || ""}
                      onChange={(v) => setEditData({ ...editData, equipment: v })}
                      placeholder="مثلاً: دمبل، هالتر، دستگاه پرس سینه، کش"
                    />
                  ) : (
                    p.equipment && p.equipment.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {p.equipment.map((eq) => (
                          <span key={eq} className="text-[11px] px-2 py-1 rounded-lg bg-muted/60 text-foreground">
                            {eq}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">بدون تجهیزات خاص</p>
                    )
                  )}
                </Section>

                {/* ۴) تغذیه */}
                <Section
                  title="تغذیه"
                  icon={<Salad className="w-4 h-4 text-emerald-500" />}
                  editing={editingSection === "nutrition"}
                  onEdit={() => startEditing("nutrition")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "nutrition" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <EditSelect
                        label="نوع رژیم"
                        value={editData.dietType || "standard"}
                        onChange={(v) => setEditData({ ...editData, dietType: v })}
                        options={(Object.keys(DIET_LABELS) as DietType[]).map((g) => ({ value: g, label: DIET_LABELS[g] }))}
                      />
                      <EditSelect
                        label="سبک آشپزی"
                        value={editData.preferredCuisine || ""}
                        onChange={(v) => setEditData({ ...editData, preferredCuisine: v })}
                        options={[
                          { value: "", label: "—" },
                          ...(Object.keys(PREFERRED_CUISINE_LABELS) as PreferredCuisine[]).map((g) => ({ value: g, label: PREFERRED_CUISINE_LABELS[g] })),
                        ]}
                      />
                      <EditField label="حساسیت غذایی" value={editData.allergies || ""} onChange={(v) => setEditData({ ...editData, allergies: v })} />
                      <div className="col-span-2">
                        <EditTextArea
                          label="غذاهای دوست‌نداشته/حذفی"
                          value={editData.dislikedFoods || ""}
                          onChange={(v) => setEditData({ ...editData, dislikedFoods: v })}
                          placeholder="مثلاً: بادمجان، کرفس، فست‌فود"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      <InfoRow label="نوع رژیم" value={p.dietLabel} />
                      <InfoRow label="حساسیت غذایی" value={p.allergies?.trim() ? p.allergies : "ندارد"} />
                      {p.dislikedFoods?.trim() && <InfoRow label="غذاهای دوست‌نداشته" value={p.dislikedFoods} />}
                      {p.preferredCuisineLabel && <InfoRow label="سبک آشپزی" value={p.preferredCuisineLabel} />}
                      {p.waterHabit != null && <InfoRow label="مصرف آب فعلی" value={`${toPersianDigits(p.waterHabit)} لیوان در روز`} />}
                    </div>
                  )}
                </Section>

                {/* ۵) سلامت */}
                <Section
                  title="سلامت و پزشکی"
                  icon={<HeartPulse className="w-4 h-4 text-rose-500" />}
                  editing={editingSection === "health"}
                  onEdit={() => startEditing("health")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "health" ? (
                    <div className="grid grid-cols-1 gap-2">
                      <EditTextArea label="آسیب‌دیدگی‌ها" value={editData.injuries || ""} onChange={(v) => setEditData({ ...editData, injuries: v })} placeholder="مثلاً: آسیب زانوی راست، دیسک کمر" />
                      <EditTextArea label="بیماری‌ها" value={editData.diseases || ""} onChange={(v) => setEditData({ ...editData, diseases: v })} placeholder="مثلاً: دیابت نوع ۲، فشار خون" />
                      <EditField label="آلرژی دارویی" value={editData.drugAllergies || ""} onChange={(v) => setEditData({ ...editData, drugAllergies: v })} />
                      <EditField label="داروهای مصرفی" value={editData.currentMedications || ""} onChange={(v) => setEditData({ ...editData, currentMedications: v })} />
                      <div>
                        <Label className="mb-1.5 block text-[11px] text-muted-foreground">شرایط پزشکی خاص</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {(Object.keys(MEDICAL_CONDITION_LABELS) as MedicalConditionKey[]).map((c) => {
                            const selected = (editData.medicalConditions || "").split(",").map((s) => s.trim()).includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  const current = (editData.medicalConditions || "").split(",").map((s) => s.trim()).filter(Boolean);
                                  const next = selected ? current.filter((x) => x !== c) : [...current, c];
                                  setEditData({ ...editData, medicalConditions: next.join(",") });
                                }}
                                className={`text-[11px] px-2.5 py-1 rounded-lg transition ${
                                  selected ? "bg-rose-500 text-white" : "bg-muted/60 text-foreground hover:bg-muted"
                                }`}
                              >
                                {MEDICAL_CONDITION_LABELS[c]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      <InfoRow label="آسیب‌دیدگی" value={p.injuries?.trim() ? p.injuries : "ندارد"} />
                      <InfoRow label="بیماری‌ها" value={p.diseases?.trim() ? p.diseases : "ندارد"} />
                      <InfoRow label="آلرژی دارویی" value={p.drugAllergies?.trim() ? p.drugAllergies : "ندارد"} />
                      <InfoRow label="داروهای مصرفی" value={p.currentMedications?.trim() ? p.currentMedications : "ندارد"} />
                      <InfoRow label="شرایط پزشکی" value={p.medicalConditionsLabel || "ندارد"} />
                    </div>
                  )}
                </Section>

                {/* ۶) ریکاوری */}
                <Section
                  title="ریکاوری"
                  icon={<Moon className="w-4 h-4 text-teal-500" />}
                  editing={editingSection === "recovery"}
                  onEdit={() => startEditing("recovery")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "recovery" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <EditField label="ساعت خواب شبانه" value={editData.sleepHours || ""} onChange={(v) => setEditData({ ...editData, sleepHours: v })} type="number" />
                      <EditField label="سطح استرس (۱-۵)" value={editData.stressLevel || ""} onChange={(v) => setEditData({ ...editData, stressLevel: v })} type="number" />
                      <EditField label="مصرف آب (لیوان/روز)" value={editData.waterHabit || ""} onChange={(v) => setEditData({ ...editData, waterHabit: v })} type="number" />
                      <EditSelect
                        label="فرم بدن"
                        value={editData.bodyFrame || ""}
                        onChange={(v) => setEditData({ ...editData, bodyFrame: v })}
                        options={[
                          { value: "", label: "—" },
                          ...(Object.keys(BODY_FRAME_LABELS) as BodyFrame[]).map((g) => ({ value: g, label: BODY_FRAME_LABELS[g] })),
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {p.sleepHours != null && <InfoRow label="ساعت خواب" value={`${toPersianDigits(p.sleepHours)} ساعت`} />}
                      {p.stressLevel != null && (
                        <InfoRow label="سطح استرس" value={p.stressLevel <= 2 ? "کم" : p.stressLevel <= 3 ? "متوسط" : "زیاد"} />
                      )}
                      {p.waterHabit != null && <InfoRow label="مصرف آب" value={`${toPersianDigits(p.waterHabit)} لیوان/روز`} />}
                      {p.bodyFrameLabel && <InfoRow label="فرم بدن" value={p.bodyFrameLabel} />}
                    </div>
                  )}
                </Section>

                {/* ۷) تجربه ورزشی */}
                <Section
                  title="تجربه ورزشی"
                  icon={<Trophy className="w-4 h-4 text-amber-500" />}
                  editing={editingSection === "experience"}
                  onEdit={() => startEditing("experience")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "experience" ? (
                    <div className="grid grid-cols-1 gap-2">
                      <EditSelect
                        label="سابقه ورزشی"
                        value={editData.trainingExperience || "beginner"}
                        onChange={(v) => setEditData({ ...editData, trainingExperience: v })}
                        options={(Object.keys(TRAINING_EXPERIENCE_LABELS) as TrainingExperience[]).map((g) => ({ value: g, label: TRAINING_EXPERIENCE_LABELS[g] }))}
                      />
                      <EditField label="نوع تمرین قبلی" value={editData.previousTrainingType || ""} onChange={(v) => setEditData({ ...editData, previousTrainingType: v })} />
                      <EditTextArea label="حداکثر وزنه‌ها (اسکوات/پرس/ددلیفت)" value={editData.maxLifts || ""} onChange={(v) => setEditData({ ...editData, maxLifts: v })} placeholder="مثلاً: اسکوات ۱۰۰، پرس ۸۰، ددلیفت ۱۲۰" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      <InfoRow label="سابقه ورزشی" value={p.trainingExperienceLabel || "مشخص نشده"} />
                      {p.previousTrainingType?.trim() && <InfoRow label="نوع تمرین قبلی" value={p.previousTrainingType} />}
                      {p.maxLifts?.trim() && <InfoRow label="حداکثر وزنه‌ها" value={p.maxLifts} />}
                    </div>
                  )}
                </Section>

                {/* ۸) تاریخ هدف */}
                <Section
                  title="تاریخ هدف"
                  icon={<Calendar className="w-4 h-4 text-cyan-500" />}
                  editing={editingSection === "target"}
                  onEdit={() => startEditing("target")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "target" ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground">تاریخ هدف (میلادی)</span>
                      <Input
                        type="date"
                        value={editData.targetDate || ""}
                        onChange={(e) => setEditData({ ...editData, targetDate: e.target.value })}
                        className="h-9 rounded-lg text-sm"
                        dir="ltr"
                      />
                    </div>
                  ) : (
                    <InfoRow
                      label="تاریخ هدف"
                      value={p.targetDate ? new Date(p.targetDate).toLocaleDateString("fa-IR") : "مشخص نشده"}
                    />
                  )}
                </Section>

                {/* ۹) مکمل‌ها */}
                <Section
                  title="مکمل‌ها"
                  icon={<Pill className="w-4 h-4 text-violet-500" />}
                  editing={editingSection === "supplements"}
                  onEdit={() => startEditing("supplements")}
                  onCancel={cancelEditing}
                  onSave={saveSection}
                  saving={saving}
                >
                  {editingSection === "supplements" ? (
                    <EditTextArea
                      label="مکمل‌های فعلی مصرفی"
                      value={editData.currentSupplements || ""}
                      onChange={(v) => setEditData({ ...editData, currentSupplements: v })}
                      placeholder="مثلاً: کراتین ۵ گرم، پروتئین وی، امگا ۳"
                    />
                  ) : (
                    <InfoRow label="مکمل‌های فعلی" value={p.currentSupplements?.trim() ? p.currentSupplements : "ندارد"} />
                  )}
                </Section>

                {/* Baseline */}
                {baseline && (
                  <Section title="اندازه‌های اولیه بدن (Baseline)" icon={<Ruler className="w-4 h-4 text-violet-500" />}>
                    <div className="grid grid-cols-2 gap-2">
                      <InfoRow label="وزن اولیه" value={`${toPersianDigits(baseline.weight)} kg`} />
                      {baseline.chestMeasurement != null && <InfoRow label="دور سینه" value={`${toPersianDigits(baseline.chestMeasurement)} cm`} />}
                      {baseline.armMeasurement != null && <InfoRow label="دور بازو" value={`${toPersianDigits(baseline.armMeasurement)} cm`} />}
                      {baseline.waistMeasurement != null && <InfoRow label="دور کمر" value={`${toPersianDigits(baseline.waistMeasurement)} cm`} />}
                      {baseline.hipMeasurement != null && <InfoRow label="دور باسن" value={`${toPersianDigits(baseline.hipMeasurement)} cm`} />}
                      {baseline.thighMeasurement != null && <InfoRow label="دور ران" value={`${toPersianDigits(baseline.thighMeasurement)} cm`} />}
                    </div>
                    {baseline.createdAt && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        ثبت شده در: {new Date(baseline.createdAt).toLocaleDateString("fa-IR")}
                      </p>
                    )}
                  </Section>
                )}
              </Card>

              {/* تحلیل هوشمند */}
              {analysis && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-4 bg-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h3 className="font-bold text-sm">تحلیل فیتاپ هوشمند</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {analysis}
                    </p>
                  </Card>
                </motion.div>
              )}

              {/* عکس‌های پیشرفت */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="w-4 h-4 text-violet-500" />
                    <h3 className="font-bold text-sm">عکس‌های پیشرفت بدن</h3>
                  </div>
                  {progressPhotos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {progressPhotos.slice(0, 9).map((photo: any) => (
                        <div key={photo.id} className="relative group rounded-xl overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.imageUrl} alt={photo.type || "عکس پیشرفت"} className="w-full h-24 object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-1.5">
                            <p className="text-[9px] text-white font-medium">{photo.takenAt ? new Date(photo.takenAt).toLocaleDateString("fa-IR") : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">هنوز عکس پیشرفتی ثبت نشده است</p>
                  )}
                </Card>
              </motion.div>

              {/* تحلیل عکس بدن */}
              {userMedia?.bodyAnalysis?.length > 0 && (
                <Card className="p-4 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-orange-500" />
                    <h3 className="font-bold text-sm">تحلیل عکس بدن ({toPersianDigits(userMedia.bodyAnalysis.length)})</h3>
                  </div>
                  <div className="space-y-3">
                    {userMedia.bodyAnalysis.map((item: any) => (
                      <div key={item.id} className="p-3 rounded-xl bg-orange-50/50 border border-orange-100">
                        <span className="text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</span>
                        {item.mediaUrl && (
                          <div className="my-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.mediaUrl} alt="عکس بدن" className="w-full h-32 object-cover rounded-lg" loading="lazy" />
                          </div>
                        )}
                        {item.result?.analysis && (
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">{item.result.analysis}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* تحلیل آزمایش خون */}
              {userMedia?.bloodTests?.length > 0 && (
                <Card className="p-4 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <TestTube className="w-4 h-4 text-rose-500" />
                    <h3 className="font-bold text-sm">تحلیل آزمایش خون ({toPersianDigits(userMedia.bloodTests.length)})</h3>
                  </div>
                  <div className="space-y-3">
                    {userMedia.bloodTests.map((item: any) => (
                      <div key={item.id} className="p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                        <span className="text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</span>
                        {item.result?.summary && (
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">{item.result.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* تحلیل ویدیویی */}
              {userMedia?.videoAnalysis?.length > 0 && (
                <Card className="p-4 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Video className="w-4 h-4 text-cyan-500" />
                    <h3 className="font-bold text-sm">تحلیل ویدیویی بدن ({toPersianDigits(userMedia.videoAnalysis.length)})</h3>
                  </div>
                  <div className="space-y-3">
                    {userMedia.videoAnalysis.map((item: any) => (
                      <div key={item.id} className="p-3 rounded-xl bg-cyan-50/50 border border-cyan-100">
                        <span className="text-[11px] text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("fa-IR")}</span>
                        {item.mediaUrl && (
                          <div className="my-2">
                            <video src={item.mediaUrl} controls className="w-full h-32 object-cover rounded-lg" preload="none" />
                          </div>
                        )}
                        {item.result?.analysis && (
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap mt-1">{item.result.analysis}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <p className="text-center text-[10px] text-muted-foreground pb-2">
                پرونده ورزشی {user?.name || "شما"} — هر تغییری بدهی، مربی هوشمند بلافاصله آن را می‌بیند.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SummaryChip({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-2">
      <p className="text-[9px] text-slate-400 mb-0.5">{label}</p>
      <p className="text-xs font-black text-slate-800 truncate" title={value}>
        {value}{unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  editing,
  onEdit,
  onCancel,
  onSave,
  saving,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <div className="border-t border-border/50 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <h4 className="text-xs font-bold text-muted-foreground">{title}</h4>
        </div>
        {editing ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2 rounded-lg text-[11px]" onClick={onCancel} disabled={saving}>
              انصراف
            </Button>
            <Button size="sm" className="h-7 px-2 rounded-lg text-[11px] gap-1" onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              ذخیره
            </Button>
          </div>
        ) : onEdit ? (
          <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg text-[11px] gap-1 text-muted-foreground" onClick={onEdit}>
            <Pencil className="w-3 h-3" />
            ویرایش
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-left" dir="auto">{value}</span>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg text-sm"
        dir="ltr"
      />
    </div>
  );
}

function EditTextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg text-sm min-h-[60px] resize-y"
        dir="rtl"
      />
    </div>
  );
}

function EditSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-lg text-sm">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent dir="rtl">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
