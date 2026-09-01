"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  Plus,
  Ruler,
  Scale,
  Activity,
  Sparkles,
  Loader2,
  TrendingUp,
  Brain,
  ChevronDown,
  ChevronUp,
  Award,
  Target,
  Moon,
  Utensils,
  Dumbbell,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  canAccess,
  toPersianDigits,
  PLAN_LABELS,
} from "@/lib/fitness/types";
import { toast } from "sonner";

interface AiAnalysis {
  bodyScore: number;
  bodyFatStatus: string;
  analysis: string;
  recommendations: string[];
  nextPhaseFocus: string;
}

interface CheckupDto {
  id: string;
  phaseNumber: number;
  isFinalCheckup: boolean;
  status: string;
  weight: number;
  chestMeasurement: number | null;
  armMeasurement: number | null;
  waistMeasurement: number | null;
  hipMeasurement: number | null;
  thighMeasurement: number | null;
  neckMeasurement: number | null;
  bodyFatPercent: number | null;
  leanBodyMass: number | null;
  fatigueLevel: number;
  sleepQuality: number;
  dietAdherence: number;
  workoutAdherence: number;
  phaseCompleted: boolean;
  notes: string;
  aiAnalysis: AiAnalysis | null;
  coachNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function CheckupSection() {
  const { user } = useAppStore();
  const [checkups, setCheckups] = useState<CheckupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const hasAccess = canAccess(user?.planName, "periodicCheckups");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkup", { cache: "no-store" });
      const data = await res.json();
      setCheckups(data.checkups || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  // Current phase = max phase among completed checkups + 1 (max 3)
  const completedPhases = checkups.filter((c) => c.phaseCompleted).map((c) => c.phaseNumber);
  const currentPhase = Math.min(3, (completedPhases.length > 0 ? Math.max(...completedPhases) : 0) + 1);

  const latestScore = checkups.find((c) => c.aiAnalysis)?.aiAnalysis?.bodyScore ?? null;
  const scoreTrend =
    checkups
      .filter((c) => c.aiAnalysis)
      .slice(0, 2)
      .map((c) => c.aiAnalysis!.bodyScore)
      .reverse() ?? [];

  return (
    <Card className="p-5 bg-white border-2 border-orange-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">چکاپ دوره‌ای</h3>
            <p className="text-[11px] text-slate-500">
              {hasAccess
                ? `فاز فعلی: ${toPersianDigits(currentPhase)} از ${toPersianDigits(3)}`
                : "نیازمند پلن استاندارد یا بالاتر"}
            </p>
          </div>
        </div>
        {hasAccess && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Plus className="w-4 h-4" />
            ثبت چکاپ
          </Button>
        )}
      </div>

      {!hasAccess ? (
        <div className="rounded-2xl p-4 text-center bg-orange-50 border border-orange-200">
          <LockMessage />
        </div>
      ) : loading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : (
        <>
          {/* Body Score gauge */}
          {latestScore != null && (
            <div className="rounded-2xl p-4 mb-3 bg-gradient-to-l from-amber-50 to-orange-50 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-bold text-slate-700">امتیاز بدن</span>
                </div>
                {scoreTrend.length === 2 && (
                  <span className="text-[11px] flex items-center gap-1 text-emerald-600">
                    <TrendingUp className="w-3 h-3" />
                    {toPersianDigits(scoreTrend[1] - scoreTrend[0] >= 0 ? "+" : "")}
                    {toPersianDigits(scoreTrend[1] - scoreTrend[0])}
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2">
                <span
                  className="text-4xl font-black"
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #f97316)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {toPersianDigits(latestScore)}
                </span>
                <span className="text-sm text-slate-500 mb-1">از ۱۰۰</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-orange-100 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(to left, #f59e0b, #f97316)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${latestScore}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {/* History list */}
          {checkups.length === 0 ? (
            <div className="rounded-2xl p-6 text-center bg-slate-50 border border-dashed border-slate-200">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">هنوز چکاپی ثبت نشده</p>
              <p className="text-[11px] text-slate-400 mt-1">
                با ثبت چکاپ دوره‌ای، هوش مصنوعی پیشرفت شما را تحلیل می‌کند.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {checkups.map((c) => (
                <CheckupHistoryItem key={c.id} checkup={c} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Submit form */}
      {showForm && (
        <CheckupFormDialog
          phaseNumber={currentPhase}
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </Card>
  );
}

function LockMessage() {
  const { setMainTab } = useAppStore();
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700 font-medium">
        قابلیت چکاپ دوره‌ای در پلن شما فعال نیست.
      </p>
      <p className="text-[11px] text-slate-500">
        برای رصد پیشرفت با تحلیل هوش مصنوعی، به پلن استاندارد یا بالاتر ارتقا دهید.
      </p>
      <Button
        size="sm"
        onClick={() => setMainTab("plans")}
        className="rounded-xl text-white mt-1"
        style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
      >
        ارتقا به پلن استاندارد
      </Button>
    </div>
  );
}

function CheckupHistoryItem({ checkup }: { checkup: CheckupDto }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(checkup.createdAt).toLocaleDateString("fa-IR", {
    month: "short",
    day: "numeric",
  });
  return (
    <div className="rounded-xl border border-orange-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-3 hover:bg-orange-50 transition"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <span className="text-xs font-bold text-orange-600">{toPersianDigits(checkup.phaseNumber)}</span>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900">
              فاز {toPersianDigits(checkup.phaseNumber)}
              {checkup.isFinalCheckup && " (نهایی)"}
            </p>
            <p className="text-[10px] text-slate-500">
              {date} • {toPersianDigits(checkup.weight)} kg
              {checkup.bodyFatPercent != null && ` • ${toPersianDigits(checkup.bodyFatPercent)}٪ چربی`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {checkup.aiAnalysis && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              {toPersianDigits(checkup.aiAnalysis.bodyScore)}/۱۰۰
            </span>
          )}
          {checkup.status === "completed" ? (
            <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> تأیید مربی
            </span>
          ) : (
            <span className="text-[10px] text-amber-600">در انتظار مربی</span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-orange-100 bg-orange-50/30 p-3 space-y-3"
          >
            {/* Measurements */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="وزن" value={`${toPersianDigits(checkup.weight)} kg`} />
              {checkup.bodyFatPercent != null && (
                <MiniStat label="چربی بدن" value={`${toPersianDigits(checkup.bodyFatPercent)}٪`} />
              )}
              {checkup.leanBodyMass != null && (
                <MiniStat label="جرم خالص" value={`${toPersianDigits(checkup.leanBodyMass)} kg`} />
              )}
              {checkup.waistMeasurement != null && (
                <MiniStat label="کمر" value={`${toPersianDigits(checkup.waistMeasurement)}`} />
              )}
              {checkup.neckMeasurement != null && (
                <MiniStat label="گردن" value={`${toPersianDigits(checkup.neckMeasurement)}`} />
              )}
              {checkup.armMeasurement != null && (
                <MiniStat label="بازو" value={`${toPersianDigits(checkup.armMeasurement)}`} />
              )}
              {checkup.chestMeasurement != null && (
                <MiniStat label="سینه" value={`${toPersianDigits(checkup.chestMeasurement)}`} />
              )}
              {checkup.hipMeasurement != null && (
                <MiniStat label="باسن" value={`${toPersianDigits(checkup.hipMeasurement)}`} />
              )}
              {checkup.thighMeasurement != null && (
                <MiniStat label="ران" value={`${toPersianDigits(checkup.thighMeasurement)}`} />
              )}
            </div>

            {/* Adherence bars */}
            <div className="space-y-1.5">
              <AdherenceBar icon={Dumbbell} label="پیروی از تمرین" value={checkup.workoutAdherence} />
              <AdherenceBar icon={Utensils} label="پیروی از رژیم" value={checkup.dietAdherence} />
              <AdherenceBar icon={Moon} label="کیفیت خواب" value={checkup.sleepQuality} />
              <AdherenceBar icon={Activity} label="سطح خستگی" value={checkup.fatigueLevel} />
            </div>

            {checkup.notes && (
              <div className="rounded-lg bg-white p-2 border border-orange-100">
                <p className="text-[11px] text-slate-600">{checkup.notes}</p>
              </div>
            )}

            {/* AI Analysis */}
            {checkup.aiAnalysis ? (
              <div className="rounded-xl bg-white p-3 border-2 border-orange-200">
                <div className="flex items-center gap-1.5 mb-2">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
                  >
                    <Brain className="w-3.5 h-3.5 text-white" />
                  </div>
                  <p className="text-xs font-bold text-slate-900">تحلیل هوش مصنوعی</p>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed mb-2">{checkup.aiAnalysis.analysis}</p>
                {checkup.aiAnalysis.recommendations.length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {checkup.aiAnalysis.recommendations.map((r, i) => (
                      <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                        <Sparkles className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="text-[10px] text-orange-600 font-medium bg-orange-50 rounded-md p-2">
                  🎯 تمرکز فاز بعد: {checkup.aiAnalysis.nextPhaseFocus}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-700">
                تحلیل هوش مصنوعی هنوز آماده نشده است.
              </div>
            )}

            {/* Coach notes */}
            {checkup.coachNotes && (
              <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-200">
                <p className="text-[10px] text-emerald-700 font-bold mb-1">یادداشت مربی</p>
                <p className="text-[11px] text-slate-700">{checkup.coachNotes}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-1.5 border border-orange-100">
      <p className="text-[9px] text-slate-500">{label}</p>
      <p className="text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}

function AdherenceBar({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3 h-3 text-slate-400 shrink-0" />
      <span className="text-[10px] text-slate-600 w-20 shrink-0">{label}</span>
      <div className="flex-1 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{
              background: i <= value
                ? "linear-gradient(to left, #f59e0b, #f97316)"
                : "rgba(245, 158, 11, 0.15)",
            }}
          />
        ))}
      </div>
      <span className="text-[10px] font-bold text-slate-700 w-4 text-center">{toPersianDigits(value)}</span>
    </div>
  );
}

function CheckupFormDialog({
  phaseNumber,
  onClose,
  onSubmitted,
}: {
  phaseNumber: number;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [weight, setWeight] = useState("");
  const [chest, setChest] = useState("");
  const [arm, setArm] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [thigh, setThigh] = useState("");
  const [neck, setNeck] = useState("");
  const [fatigue, setFatigue] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [diet, setDiet] = useState(3);
  const [workout, setWorkout] = useState(3);
  const [phaseCompleted, setPhaseCompleted] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!weight) {
      toast.error("وزن را وارد کنید");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/checkup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: Number(weight),
          phaseNumber,
          chestMeasurement: chest ? Number(chest) : undefined,
          armMeasurement: arm ? Number(arm) : undefined,
          waistMeasurement: waist ? Number(waist) : undefined,
          hipMeasurement: hip ? Number(hip) : undefined,
          thighMeasurement: thigh ? Number(thigh) : undefined,
          neckMeasurement: neck ? Number(neck) : undefined,
          fatigueLevel: fatigue,
          sleepQuality: sleep,
          dietAdherence: diet,
          workoutAdherence: workout,
          phaseCompleted,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("چکاپ ثبت شد و توسط هوش مصنوعی تحلیل شد! 🎉");
      onSubmitted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت چکاپ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <ClipboardCheck className="w-5 h-5 text-orange-500" />
            ثبت چکاپ فاز {toPersianDigits(phaseNumber)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Weight */}
          <div>
            <Label className="mb-1.5 block text-sm text-slate-700 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-orange-500" /> وزن (کیلوگرم) *
            </Label>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="مثلاً ۷۵"
              dir="ltr"
              className="rounded-xl text-center text-lg h-11"
              inputMode="decimal"
            />
          </div>

          {/* Measurements */}
          <div>
            <Label className="mb-2 block text-sm text-slate-700 flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-orange-500" /> اندازه‌های بدن (cm) — اختیاری
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <MeasureInput label="دور سینه" value={chest} onChange={setChest} />
              <MeasureInput label="دور بازو" value={arm} onChange={setArm} />
              <MeasureInput label="دور کمر *" value={waist} onChange={setWaist} />
              <MeasureInput label="دور گردن *" value={neck} onChange={setNeck} />
              <MeasureInput label="دور باسن" value={hip} onChange={setHip} />
              <MeasureInput label="دور ران" value={thigh} onChange={setThigh} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              برای محاسبه دقیق‌تر درصد چربی بدن با فرمول علمی US Navy، دور کمر و گردن (برای خانم‌ها دور باسن هم) را وارد کنید.
            </p>
          </div>

          {/* Adherence sliders */}
          <div className="space-y-3">
            <Label className="block text-sm text-slate-700 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-orange-500" /> بازخورد وضعیت (۱ تا ۵)
            </Label>
            <FeedbackSlider icon={Dumbbell} label="پیروی از تمرین" value={workout} onChange={setWorkout} />
            <FeedbackSlider icon={Utensils} label="پیروی از رژیم" value={diet} onChange={setDiet} />
            <FeedbackSlider icon={Moon} label="کیفیت خواب" value={sleep} onChange={setSleep} />
            <FeedbackSlider icon={Activity} label="سطح خستگی" value={fatigue} onChange={setFatigue} />
          </div>

          {/* Notes */}
          <div>
            <Label className="mb-1.5 block text-sm text-slate-700">یادداشت (اختیاری)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="هر چیزی که مربی هوشمند باید بداند..."
              className="rounded-xl text-sm"
              rows={2}
            />
          </div>

          {/* Phase completed toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={phaseCompleted}
              onChange={(e) => setPhaseCompleted(e.target.checked)}
              className="w-4 h-4 rounded accent-orange-500"
            />
            <span className="text-sm text-slate-700 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-orange-500" /> این فاز را کامل کرده‌ام
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-xl">
            انصراف
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !weight}
            className="rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> در حال تحلیل...
              </span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> ثبت و تحلیل با AI
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeasureInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1 block text-[11px] text-slate-500">{label}</Label>
      <Input
        dir="ltr"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg text-center text-sm h-9"
        inputMode="decimal"
      />
    </div>
  );
}

function FeedbackSlider({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600 flex items-center gap-1">
          <Icon className="w-3 h-3 text-slate-400" /> {label}
        </span>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-md text-white"
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          {toPersianDigits(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        min={1}
        max={5}
        step={1}
        className="[&_[role=slider]]:bg-orange-500 [&_.bg-primary]:bg-orange-200"
      />
    </div>
  );
}
