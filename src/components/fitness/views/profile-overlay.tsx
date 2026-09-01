"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Crown,
  Shield,
  LogOut,
  ChevronLeft,
  CreditCard,
  Settings,
  Activity,
  Wallet,
  Loader2,
  TrendingUp,
  TrendingDown,
  Dumbbell,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  toPersianDigits, formatToman,
  PLAN_LABELS,
} from "@/lib/fitness/types";
import { SportsProfileModal } from "@/components/fitness/views/sports-profile-modal";
import { toast } from "sonner";

// ─── DTO شامل تمام فیلدهای آنبوردینگ ───
interface OnboardingProfileDto {
  // Basic
  gender: string;
  genderLabel: string;
  age: number;
  height: number;
  weight: number;
  targetWeight: number | null;
  goal: string;
  goalLabel: string;
  activityLevel: string;
  activityLabel: string;
  workoutDays: number;
  workoutDaysList: string[];
  workoutPlace: string;
  workoutPlaceLabel: string;
  workoutTime: string | null;
  workoutTimeLabel: string | null;
  // Equipment
  equipment: string[];
  // Diet
  dietType: string;
  dietLabel: string;
  preferredCuisine: string | null;
  preferredCuisineLabel: string | null;
  dislikedFoods: string | null;
  allergies: string;
  // Health
  injuries: string;
  diseases: string;
  drugAllergies: string | null;
  currentMedications: string | null;
  medicalConditions: string[];
  medicalConditionsLabel: string | null;
  // Recovery
  sleepHours: number | null;
  stressLevel: number | null;
  waterHabit: number | null;
  waterGoalMl: number | null;
  bodyFrame: string | null;
  bodyFrameLabel: string | null;
  // Training experience
  trainingExperience: string | null;
  trainingExperienceLabel: string | null;
  previousTrainingType: string | null;
  maxLifts: string | null;
  // Target date
  targetDate: string | null;
  // Supplements
  currentSupplements: string | null;
  // Body composition measurements
  neckMeasurement: number | null;
  shoulderMeasurement: number | null;
  calfMeasurement: number | null;
}

interface BaselineDto {
  weight: number;
  chestMeasurement: number | null;
  armMeasurement: number | null;
  waistMeasurement: number | null;
  hipMeasurement: number | null;
  thighMeasurement: number | null;
  createdAt: string;
}

interface WalletTxnDto {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

// شناسه‌های سکشن‌های قابل ویرایش
export function ProfileOverlay() {
  const { user, setOverlay, reset } = useAppStore();
  const [profile, setProfile] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<{
    analysis?: string;
    bmi?: number;
    bmr?: number;
    tdee?: number;
    profile?: OnboardingProfileDto;
    baseline?: BaselineDto | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletOpen, setWalletOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [charging, setCharging] = useState(false);
  const [walletTxns, setWalletTxns] = useState<WalletTxnDto[]>([]);
  // FIX: کل واقعی تراکنش‌ها از API (txns فقط ۵۰ مورد آخر است)
  const [walletTxnsTotal, setWalletTxnsTotal] = useState(0);
  const [walletTxnsLoading, setWalletTxnsLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  // ─── مودال «پرونده ورزشی» — کل پرونده در یک تجربه مجزا (درخواست مالک) ───
  const [sportsProfileOpen, setSportsProfileOpen] = useState(false);

  const loadData = useCallback(async () => {
    const [progressRes, onboardingRes, walletRes] = await Promise.all([
      fetch("/api/progress"),
      fetch("/api/onboarding/analysis"),
      fetch("/api/wallet"),
    ]);
    const progressData = await progressRes.json();
    let onboardingData: any = null;
    try { onboardingData = await onboardingRes.json(); } catch {}
    let walletData: any = null;
    try { walletData = await walletRes.json(); } catch {}
    setProfile({
      startWeight: progressData.startWeight,
      targetWeight: progressData.targetWeight,
      bmi: onboardingData?.bmi,
      bmr: onboardingData?.bmr,
      tdee: onboardingData?.tdee,
      gender: (onboardingData?.profile?.genderLabel || "").includes("آقا") ? "male" : (onboardingData?.profile?.genderLabel || "").includes("خانم") ? "female" : null,
    });
    if (onboardingData) setOnboarding(onboardingData);
    if (Array.isArray(walletData?.transactions)) {
      setWalletTxns(walletData.transactions as WalletTxnDto[]);
      // total واقعی از API — fallback به تعداد fetched برای سازگاری
      setWalletTxnsTotal(
        typeof walletData?.total === "number" ? walletData.total : walletData.transactions.length
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch {
      } finally {
        setLoading(false);
        setWalletTxnsLoading(false);
      }
    })();
  }, [loadData]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // پاک کردن sessionStorage
      try {
        window.sessionStorage.removeItem("fitap_last_screen");
      } catch {}
      // پاک کردن URL
      window.history.replaceState({}, "", "/");
      // reset مستقیماً screen را به landing می‌برد (نه loading)
      reset();
      setOverlay(null);
    } catch {
      // حتی اگر خطا شد، باز هم logout کن
      try {
        window.sessionStorage.removeItem("fitap_last_screen");
      } catch {}
      window.history.replaceState({}, "", "/");
      reset();
      setOverlay(null);
    }
  }

  const subEndDate = user?.subscriptionEnd ? new Date(user.subscriptionEnd) : null;
  const daysLeft = subEndDate ? Math.ceil((subEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-bold">پروفایل</h2>
        <Button variant="ghost" size="icon" onClick={() => setOverlay(null)} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* User card */}
        <Card className="p-5 relative overflow-hidden">
          <div className="absolute -left-8 -top-8 w-32 h-32 rounded-full bg-primary/10" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
              {user?.name?.[0] || "ک"}
            </div>
            <div className="flex-1">
              <h3 className="font-black text-lg">{user?.name || "ورزشکار"}</h3>
              <p className="text-sm text-muted-foreground" dir="ltr">{user?.mobile}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {user?.role === "ADMIN" && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    <Shield className="w-3 h-3" /> مدیر سیستم
                  </span>
                )}
                {user?.planName && (
                  <span className="inline-flex items-center gap-1 text-[11px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                    <Crown className="w-3 h-3" /> پلن {PLAN_LABELS[user.planName as keyof typeof PLAN_LABELS] ?? user.planName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Subscription status */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm">وضعیت اشتراک</h3>
            </div>
          </div>
          {user?.hasActiveSubscription ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">اشتراک فعال ✓</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {toPersianDigits(daysLeft)} روز باقی‌مانده
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-[11px] text-muted-foreground">تاریخ پایان</p>
                  <p className="text-xs font-medium">{subEndDate?.toLocaleDateString("fa-IR")}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">اشتراک فعال نیست</p>
              <Button
                size="sm"
                className="w-full rounded-xl"
                onClick={() => setOverlay("subscription")}
              >
                <Crown className="w-4 h-4" />
                خرید پلن
              </Button>
            </div>
          )}
        </Card>

        {/* Wallet */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-cyan-500" />
              <h3 className="font-bold text-sm">کیف پول</h3>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[11px] text-muted-foreground">موجودی فعلی</p>
                <p className="font-black text-lg text-cyan-600 dark:text-cyan-400">
                  {toPersianDigits((user?.walletBalance ?? 0).toLocaleString("en-US"))} <span className="text-xs font-normal">تومان</span>
                </p>
              </div>
              <Wallet className="w-8 h-8 text-cyan-500/40" />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setWalletOpen(true)}
            >
              شارژ کیف پول
            </Button>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-muted-foreground">تراکنش‌های اخیر</h4>
              {walletTxnsTotal > 5 && (
                <span className="text-[10px] text-muted-foreground/70">
                  {toPersianDigits(walletTxnsTotal)} تراکنش
                </span>
              )}
            </div>
            {walletTxnsLoading ? (
              <Skeleton className="h-20 rounded-xl" />
            ) : walletTxns.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground rounded-xl bg-muted/30 border border-dashed">
                هنوز تراکنشی ثبت نشده است
              </div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pl-1">
                {walletTxns.slice(0, 20).map((t) => {
                  const isIncome = t.amount >= 0;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isIncome
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-rose-100 text-rose-600"
                        }`}
                      >
                        {isIncome ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {t.description || txnTypeLabel(t.type)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatJalaliDateTime(t.createdAt)}
                        </p>
                      </div>
                      <div
                        className={`text-xs font-bold font-stat shrink-0 ${
                          isIncome ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isIncome ? "+" : ""}
                        {toPersianDigits(Math.abs(t.amount).toLocaleString("en-US"))}
                        <span className="text-[9px] font-normal mr-0.5 opacity-70">ت</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Physical info / metrics */}
        {loading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : (
          profile && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm">اطلاعات فیزیکی</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoRow label="وزن شروع" value={profile.startWeight ? `${toPersianDigits(profile.startWeight)} kg` : "—"} />
                <InfoRow label="وزن هدف" value={profile.targetWeight ? `${toPersianDigits(profile.targetWeight)} kg` : "—"} />
                {profile.bmi && <InfoRow label="شاخص BMI" value={toPersianDigits(profile.bmi)} />}
                {profile.bmr && <InfoRow label="متابولیسم (BMR)" value={`${toPersianDigits(profile.bmr)} کالری`} />}
                {profile.tdee && <InfoRow label="کالری روزانه (TDEE)" value={`${toPersianDigits(profile.tdee)} کالری`} />}
              </div>
            </Card>
          )
        )}

        {/* ─── دکمه «مشاهده پرونده ورزشی» (درخواست مالک) ───
            پروفایل فقط اطلاعات پایه را نشان می‌دهد؛ کل پرونده ورزشی/پزشکی
            (۹ سکشن + baseline + تحلیل AI + عکس‌ها و آنالیزها) در مودال
            اختصاصی SportsProfileModal با قابلیت ویرایش نمایش داده می‌شود. */}
        {loading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setSportsProfileOpen(true)}
            className="w-full p-5 rounded-2xl border-2 border-orange-200 bg-gradient-to-l from-orange-50 to-amber-50/60 text-right shadow-sm transition hover:shadow-md hover:border-orange-300 active:scale-[0.99] flex items-center gap-4"
            aria-label="مشاهده پرونده ورزشی"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <Dumbbell className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-base text-slate-800">مشاهده پرونده ورزشی</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                هدف، برنامه تمرین، تغذیه، سلامت، ریکاوری و همه‌ی جزئیات — قابل ویرایش
              </p>
            </div>
            <ChevronLeft className="w-5 h-5 text-orange-400 shrink-0" />
          </motion.button>
        )}

        {/* Settings list */}
        <div className="space-y-1">
          <SettingsRow
            icon={CreditCard}
            label="مدیریت اشتراک"
            onClick={() => setOverlay("subscription")}
            chevron
          />
          {user?.role === "ADMIN" && (
            <SettingsRow
              icon={Settings}
              label="پنل مدیریت"
              onClick={() => setOverlay("admin")}
              chevron
              highlight
            />
          )}
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5"
        >
          {loggingOut ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              در حال خروج...
            </>
          ) : (
            <>
              <LogOut className="w-4 h-4" />
              خروج از حساب
            </>
          )}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground pt-2">
          فیتاپ — نسخه ۱.۰.۰
        </p>
      </div>

      {/* ─── مودال «پرونده ورزشی» — تمام جزئیات + ویرایش (درخواست مالک) ─── */}
      <SportsProfileModal
        open={sportsProfileOpen}
        onClose={() => setSportsProfileOpen(false)}
      />

      {/* Wallet Charge Modal — FE-C4: شارژ واقعی از طریق درگاه زرین‌پال.
          قرارداد جدید POST /api/wallet: {ok, paymentId, authority, gatewayUrl}
          کاربر به gatewayUrl هدایت می‌شود و پس از پرداخت به ?payment_verify=1
          برمی‌گردد تا PaymentVerifyHandler نتیجه را تأیید کند. */}
      <Dialog open={walletOpen} onOpenChange={(open) => { if (!charging) setWalletOpen(open); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>شارژ کیف پول</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="p-2 rounded-lg bg-orange-50 text-xs text-center">موجودی فعلی: <b className="font-stat">{toPersianDigits(formatToman(user?.walletBalance || 0))} ت</b></div>
            <div>
              <Label className="mb-1 block">مبلغ (تومان)</Label>
              <Input type="number" dir="ltr" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} placeholder="مثلاً ۵۰۰۰۰۰" className="rounded-xl text-center font-stat" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[100000, 500000, 1000000].map(v => (
                <button key={v} onClick={() => setChargeAmount(String(v))} className="text-xs px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 font-stat transition">
                  {toPersianDigits(formatToman(v))}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              پس از تأیید، به درگاه پرداخت زرین‌پال منتقل می‌شوید و پس از پرداخت به‌صورت خودکار به فیتاپ بازمی‌گردید.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletOpen(false)} disabled={charging} className="rounded-xl">انصراف</Button>
            <Button
              onClick={async () => {
                if (!chargeAmount || Number(chargeAmount) <= 0) return;
                setCharging(true);
                try {
                  const res = await fetch("/api/wallet", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount: Number(chargeAmount) }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok || !data.ok || !data.gatewayUrl) {
                    throw new Error(data.error || "خطا در ایجاد پرداخت");
                  }
                  // هدایت به درگاه زرین‌پال — نتیجه پس از بازگشت در
                  // PaymentVerifyHandler تأیید می‌شود (?payment_verify=1)
                  toast.info("در حال انتقال به درگاه پرداخت...");
                  window.location.href = data.gatewayUrl;
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "خطا در شارژ کیف پول");
                  setCharging(false);
                }
              }}
              disabled={charging}
              className="rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              {charging ? <Loader2 className="w-4 h-4 animate-spin" /> : "شارژ کیف پول"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** برچسب فارسی نوع تراکنش کیف پول */
function txnTypeLabel(type: string): string {
  switch (type) {
    case "deposit":
      return "شارژ کیف پول";
    case "purchase":
      return "خرید";
    case "refund":
      return "بازگشت وجه";
    case "bonus":
      return "پاداش";
    default:
      return "تراکنش";
  }
}

/** فرمت تاریخ شمسی + ساعت — برای نمایش در لیست تراکنش‌ها */
function formatJalaliDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      day: "numeric",
      month: "long",
    }).format(d);
    const time = new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `${date} · ${time}`;
  } catch {
    return "";
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-left" dir="auto">{value}</span>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  action,
  onClick,
  chevron,
  highlight,
}: {
  icon: any;
  label: string;
  action?: React.ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition text-right ${
        highlight ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted"
      }`}
    >
      <Icon className={`w-5 h-5 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {action}
      {chevron && <ChevronLeft className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
}

