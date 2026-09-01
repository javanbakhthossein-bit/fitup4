"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  LayoutDashboard,
  Users,
  Wallet,
  ListChecks,
  Search,
  Ban,
  Check,
  Shield,
  Plus,
  Crown,
  TrendingUp,
  DollarSign,
  UserCheck,
  Target,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Eye,
  Newspaper,
  Sparkles,
  Send,
  Settings as SettingsIcon,
  Trash2,
  Pencil,
  Code2,
  Save,
  Bot,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  Brain,
  LogOut,
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Link2,
  Upload,
  Image as ImageIcon,
  MessageSquare,
  Phone,
  Globe,
  Search as SearchIcon,
  Rocket,
  Bug,
  ChevronDown,
  ChevronUp,
  Ticket,
  Bell,
  Download,
  Tags,
  Activity,
  Calculator,
  CalendarRange,
  GitCompare,
  LineChart as LineChartIcon,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  ThumbsUp,
  Wand2,
  Table2,
  Star,
  ClipboardList,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Wrench,
  NotebookPen,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from "recharts";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from "react-markdown";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  SUBSCRIPTION_PLANS, toPersianDigits, formatToman, PLAN_LABELS, type Plan,
} from "@/lib/fitness/types";
import { toWebp } from "@/lib/fitness/image-utils";
import { toast } from "sonner";
import { PersianDatePicker } from "@/components/fitness/persian-date-picker";

type AdminTab = "dashboard" | "users" | "finance" | "discounts" | "programs" | "checkups" | "articles" | "head_codes" | "terms" | "copilot" | "admins" | "tickets" | "domain" | "seo" | "search_console" | "logs" | "settings" | "accounting" | "surveys";

// All admin permission keys (matches AdminPermission Prisma model)
const PERMISSION_KEYS = [
  "canViewDashboard",
  "canManageUsers",
  "canViewFinance",
  "canManagePrograms",
  "canManageCheckups",
  "canManageArticles",
  "canManageHeadCodes",
  "canManageTerms",
  "canUseCopilot",
  "canManageAdmins",
  "canManageTickets",
] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number];

interface AdminPermissions {
  canViewDashboard: boolean;
  canManageUsers: boolean;
  canViewFinance: boolean;
  canManagePrograms: boolean;
  canManageCheckups: boolean;
  canManageArticles: boolean;
  canManageHeadCodes: boolean;
  canManageTerms: boolean;
  canUseCopilot: boolean;
  canManageAdmins: boolean;
  canManageTickets: boolean;
}

const ALL_TRUE_PERMISSIONS: AdminPermissions = {
  canViewDashboard: true,
  canManageUsers: true,
  canViewFinance: true,
  canManagePrograms: true,
  canManageCheckups: true,
  canManageArticles: true,
  canManageHeadCodes: true,
  canManageTerms: true,
  canUseCopilot: true,
  canManageAdmins: true,
  canManageTickets: true,
};

// Human-readable Persian labels for each permission
const PERMISSION_LABELS: Record<PermissionKey, string> = {
  canViewDashboard: "مشاهده داشبورد",
  canManageUsers: "مدیریت کاربران",
  canViewFinance: "مشاهده مالی و تراکنش‌ها",
  canManagePrograms: "مدیریت صف برنامه‌ها",
  canManageCheckups: "مدیریت چکاپ‌ها",
  canManageArticles: "مدیریت مقالات",
  canManageHeadCodes: "مدیریت کدهای تحلیلی",
  canManageTerms: "مدیریت قوانین",
  canUseCopilot: "دسترسی به دستیار هوشمند",
  canManageAdmins: "مدیریت ادمین‌ها (فقط سوپرادمین)",
  canManageTickets: "مدیریت تیکت‌های پشتیبانی",
};

function emptyPermissions(): AdminPermissions {
  return {
    canViewDashboard: true,
    canManageUsers: false,
    canViewFinance: false,
    canManagePrograms: false,
    canManageCheckups: false,
    canManageArticles: false,
    canManageHeadCodes: false,
    canManageTerms: false,
    canUseCopilot: false,
    canManageAdmins: false,
    canManageTickets: false,
  };
}

const PLAN_COLORS: Record<string, string> = {
  basic: "#64748b", standard: "#06b6d4", advanced: "#f59e0b", ultimate: "#a855f7",
};

const ARTICLE_CATEGORIES: { value: string; label: string }[] = [
  // فارسی (نسخه جدید)
  { value: "عمومی", label: "عمومی" },
  { value: "تغذیه", label: "تغذیه" },
  { value: "تمرین", label: "تمرین" },
  { value: "انگیزشی", label: "انگیزشی" },
  { value: "مکمل", label: "مکمل" },
  { value: "بازیابی", label: "بازیابی" },
  { value: "حرکات", label: "حرکات" },
  { value: "اخبار", label: "اخبار" },
  // انگلیسی (backward compat — مقالات قدیمی)
  { value: "general", label: "عمومی" },
  { value: "nutrition", label: "تغذیه" },
  { value: "training", label: "تمرین" },
  { value: "motivation", label: "انگیزشی" },
  { value: "news", label: "اخبار" },
];

function articleCategoryLabel(cat: string): string {
  return ARTICLE_CATEGORIES.find((c) => c.value === cat)?.label || cat || "عمومی";
}

// ---- Head Code (analytics / search console / pixels / Inamad) ----
const HEAD_CODE_TYPES: { value: string; label: string; color: string }[] = [
  { value: "analytics", label: "تحلیل آمار", color: "#f59e0b" },
  { value: "search_console", label: "سرچ کنسول", color: "#10b981" },
  { value: "pixel", label: "پیکسل تبلیغات", color: "#a855f7" },
  { value: "inamad", label: "اینماد", color: "#0ea5e9" },
  { value: "samandehi", label: "ساماندهی", color: "#16a34a" },
  { value: "custom", label: "سفارشی", color: "#64748b" },
];

const HEAD_CODE_PLACEMENTS: { value: string; label: string }[] = [
  { value: "head", label: "داخل <head>" },
  { value: "body_start", label: "ابتدای <body>" },
  { value: "body_end", label: "انتهای <body>" },
];

function headCodeTypeLabel(t: string): string {
  return HEAD_CODE_TYPES.find((x) => x.value === t)?.label || "سفارشی";
}
function headCodeTypeColor(t: string): string {
  return HEAD_CODE_TYPES.find((x) => x.value === t)?.color || "#64748b";
}
function headCodePlacementLabel(p: string): string {
  return HEAD_CODE_PLACEMENTS.find((x) => x.value === p)?.label || p;
}

// Quick template snippets — inserted into the code textarea on click
const HEAD_CODE_TEMPLATES: { id: string; label: string; type: string; placement: string; code: string }[] = [
  {
    id: "ga4",
    label: "Google Analytics 4",
    type: "analytics",
    placement: "head",
    code: `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`,
  },
  {
    id: "search_console",
    label: "Google Search Console",
    type: "search_console",
    placement: "head",
    code: `<meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />`,
  },
  {
    id: "meta_pixel",
    label: "Meta (Facebook) Pixel",
    type: "pixel",
    placement: "body_start",
    code: `<!-- Meta Pixel Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID');
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1" alt="" />
</noscript>
<!-- End Meta Pixel Code -->`,
  },
  {
    id: "microsoft_clarity",
    label: "Microsoft Clarity",
    type: "analytics",
    placement: "head",
    code: `<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window,document,"clarity","script","YOUR_CLARITY_ID");
</script>`,
  },
  {
    id: "inamad",
    label: "اینماد (نماد اعتماد الکترونیکی)",
    type: "inamad",
    placement: "body_end",
    code: `<!-- نماد اعتماد الکترونیکی (اینماد) -->
<!-- جایگزین کنید: YOUR_INAMAD_ID = شناسه نماد شما -->
<div style="display:flex;justify-content:center;padding:16px 0;">
  <img id="nbzmaeg" src="https://trustseal.enamad.ir/namad.php?id=YOUR_INAMAD_ID" alt="نماد اعتماد الکترونیکی" style="width:100px;height:100px;cursor:pointer;" onclick="window.open('https://trustseal.enamad.ir/Verify.aspx?id=YOUR_INAMAD_ID&p=YOUR_INAMAD_TOKEN', 'Popup','toolbar=no, scrollbars=no, location=no, statusbar=no, menubar=no, resizable=0, width=580, height=600, top=30')" />
</div>
<script src="https://trustseal.enamad.ir/scriptContent?a=YOUR_INAMAD_ID"></script>
<!-- پایان اینماد -->`,
  },
  {
    id: "samandehi",
    label: "ساماندهی (نماد ساماندهی)",
    type: "samandehi",
    placement: "body_end",
    code: `<!-- نماد ساماندهی -->
<!-- جایگزین کنید: YOUR_SAMANDEHI_ID = شناسه ساماندهی شما -->
<div style="display:flex;justify-content:center;padding:16px 0;">
  <img id="nbzma" src="https://logo.samandehi.ir/logo.aspx?id=YOUR_SAMANDEHI_ID" alt="نماد ساماندهی" style="width:100px;height:100px;cursor:pointer;" onclick="window.open('https://logo.samandehi.ir/Verify.aspx?id=YOUR_SAMANDEHI_ID', 'Popup','toolbar=no, scrollbars=no, location=no, statusbar=no, menubar=no, resizable=0, width=580, height=600, top=30')" />
</div>
<!-- پایان ساماندهی -->`,
  },
];

export function AdminOverlay({ standalone = false }: { standalone?: boolean } = {}) {
  const { setOverlay, setScreen, reset } = useAppStore();
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [permissions, setPermissions] = useState<AdminPermissions>(ALL_TRUE_PERMISSIONS);
  const [permsLoaded, setPermsLoaded] = useState(false);

  // Fetch the current admin's permissions on mount — used to filter visible tabs
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/permissions", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data?.permissions) setPermissions(data.permissions as AdminPermissions);
        }
      } catch {
        // fall back to all-true if the call fails (best-effort)
      } finally {
        setPermsLoaded(true);
      }
    })();
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      try {
        window.sessionStorage.removeItem("fitap_last_screen");
      } catch {}
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

  /**
   * بازگشت به صفحه اصلی سایت — بستن overlay پنل مدیر و رفتن به landing.
   * کاربر با کلیک روی لوگوی فیتاپ در هدر پنل مدیر این کار را انجام می‌دهد.
   */
  function goHome() {
    setOverlay(null);
    setScreen("landing");
    try {
      window.history.replaceState({}, "", "/");
    } catch {}
  }

  // All possible tabs — we filter the visible ones based on permissions
  const allTabs: { id: AdminTab; label: string; icon: any; perm: PermissionKey }[] = [
    { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, perm: "canViewDashboard" },
    { id: "users", label: "کاربران", icon: Users, perm: "canManageUsers" },
    { id: "finance", label: "مالی و تراکنش‌ها", icon: Wallet, perm: "canViewFinance" },
    { id: "accounting", label: "حسابداری مدیریت", icon: Calculator, perm: "canViewFinance" },
    { id: "discounts", label: "کدهای تخفیف", icon: Ticket, perm: "canViewFinance" },
    { id: "programs", label: "صف برنامه‌ها", icon: ListChecks, perm: "canManagePrograms" },
    { id: "checkups", label: "چکاپ‌ها", icon: ClipboardCheck, perm: "canManageCheckups" },
    { id: "articles", label: "مقالات", icon: Newspaper, perm: "canManageArticles" },
    { id: "head_codes", label: "کدهای تحلیلی", icon: Code2, perm: "canManageHeadCodes" },
    { id: "terms", label: "قوانین", icon: ShieldCheck, perm: "canManageTerms" },
    { id: "tickets", label: "تیکت‌ها", icon: MessageSquare, perm: "canManageTickets" },
    { id: "surveys", label: "نظرسنجی‌ها", icon: ClipboardList, perm: "canViewDashboard" },
    { id: "copilot", label: "دستیار هوشمند", icon: Sparkles, perm: "canUseCopilot" },
    { id: "admins", label: "مدیریت ادمین‌ها", icon: ShieldCheck, perm: "canManageAdmins" },
    { id: "domain", label: "دامنه و رکوردها", icon: Globe, perm: "canManageHeadCodes" },
    { id: "seo", label: "سئو هوشمند", icon: Rocket, perm: "canManageArticles" },
    { id: "search_console", label: "سرچ کنسول", icon: LineChartIcon, perm: "canManageUsers" },
    { id: "logs", label: "لاگ خطاها", icon: Bug, perm: "canViewDashboard" },
    { id: "settings", label: "تنظیمات سایت", icon: SettingsIcon, perm: "canViewDashboard" },
  ];

  // Filter tabs by permission; always show at least the dashboard
  const tabs = allTabs.filter((t) => permissions[t.perm]);

  // If the current tab is not visible (e.g. perms changed), fall back to first available
  useEffect(() => {
    if (permsLoaded && tabs.length > 0 && !tabs.some((t) => t.id === tab)) {
      setTab(tabs[0].id);
    }
  }, [permsLoaded, permissions, tabs, tab]);

  return (
    <div className={`flex flex-col h-full bg-background ${standalone ? "fixed inset-0 z-50" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b glass-dark">
        <div className="flex items-center gap-2">
          {/* لوگوی فیتاپ — قابل کلیک برای بازگشت به صفحه اصلی */}
          <button
            onClick={goHome}
            className="flex items-center gap-2 group rounded-xl p-1 -m-1 hover:bg-white/5 transition"
            title="بازگشت به صفحه اصلی"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
            </div>
            <h2 className="font-bold text-sm sm:text-base group-hover:text-primary transition">پنل مدیریت فیتاپ</h2>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="rounded-xl gap-1.5 text-xs">
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">تنظیمات سایت</span>
          </Button>
          {standalone ? (
            <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-xl gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">خروج</span>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setOverlay(null)} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b overflow-x-auto no-scrollbar glass-dark">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition ${
              tab === t.id ? "bg-primary text-primary-foreground glow-gold-sm" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            {tab === "dashboard" && <DashboardTab />}
            {tab === "users" && <UsersTab />}
            {tab === "finance" && <FinanceTab />}
            {tab === "accounting" && <AccountingTab />}
            {tab === "discounts" && <DiscountsTab />}
            {tab === "programs" && <ProgramsTab />}
            {tab === "checkups" && <CheckupsTab />}
            {tab === "articles" && <ArticlesTab />}
            {tab === "head_codes" && <HeadCodesTab />}
            {tab === "terms" && <TermsTab />}
            {tab === "tickets" && <TicketsTab />}
            {tab === "surveys" && <SurveysTab />}
            {tab === "copilot" && <CopilotTab />}
            {tab === "admins" && <AdminsTab />}
            {tab === "domain" && <DomainTab />}
            {tab === "seo" && <SeoAgentTab />}
            {tab === "search_console" && <SearchConsoleTab />}
            {tab === "logs" && <LogsTab />}
            {tab === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Site Settings Dialog */}
      <SiteSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

/* ============================================================
   ۱. داشبورد — KPIs + نمودارها
   ============================================================ */
function DashboardTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        const d = await res.json();
        setData(d);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;

  const s = data?.stats;
  const planDistData = (data?.planDistribution || []).map((p: any) => ({
    name: PLAN_LABELS[p.planName as Plan] || p.planName,
    value: p._count,
    color: PLAN_COLORS[p.planName] || "#888",
  }));

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="مجموع درآمد" value={`${toPersianDigits(formatToman(s?.totalRevenue || 0))} ت`} color="emerald" />
        <KpiCard icon={Users} label="کل کاربران" value={toPersianDigits(s?.totalUsers || 0)} sub={`ورزشکاران فعال: ${toPersianDigits(s?.activeSubscriptions || 0)}`} color="cyan" />
        <KpiCard icon={ListChecks} label="برنامه‌های فعال" value={toPersianDigits(s?.activeSubscriptions || 0)} sub={`در انتظار: ${toPersianDigits(s?.pendingPrograms || 0)}`} color="amber" />
        <KpiCard icon={Target} label="نرخ تبدیل" value={`${toPersianDigits(s?.conversionRate || 0)}٪`} sub={`${toPersianDigits(s?.usersWithPlan || 0)} کاربر پولی`} color="violet" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* User growth */}
        <Card className="p-4 glass">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> روند رشد کاربران</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data?.userGrowth || []}>
              <defs>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F4C542" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#F4C542" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/20" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="total" stroke="#F4C542" strokeWidth={2} fill="url(#userGrad)" name="کل کاربران" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Revenue growth */}
        <Card className="p-4 glass">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" /> روند درآمد (۶ ماه)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.revenueGrowth || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/20" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11, fill: "currentColor" }} className="text-muted-foreground" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}م`} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: any) => `${toPersianDigits(formatToman(v))} ت`} />
              <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} name="درآمد" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Plan distribution + Revenue by plan */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 glass">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-primary" /> توزیع کاربران در پلن‌ها</h3>
          {planDistData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={planDistData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {planDistData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-sm text-muted-foreground py-12">داده‌ای موجود نیست</p>}
        </Card>

        <Card className="p-4 glass">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-500" /> درآمد بر اساس پلن</h3>
          <div className="space-y-2">
            {(data?.revenueByPlan || []).map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: PLAN_COLORS[r.plan] || "#888" }} />
                  <span className="text-sm font-medium">{PLAN_LABELS[r.plan as Plan] || r.plan}</span>
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm font-stat">{toPersianDigits(formatToman(r._sum.amount || 0))} ت</p>
                  <p className="text-[10px] text-muted-foreground">{toPersianDigits(r._count)} پرداخت</p>
                </div>
              </div>
            ))}
            {(data?.revenueByPlan || []).length === 0 && <p className="text-center text-sm text-muted-foreground py-8">داده‌ای موجود نیست</p>}
          </div>
        </Card>
      </div>

      {/* Recent users */}
      <Card className="p-4 glass">
        <h3 className="font-bold text-sm mb-3">آخرین کاربران ثبت‌نام‌شده</h3>
        <div className="space-y-2">
          {(data?.recentUsers || []).map((u: any) => (
            <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">{u.name?.[0] || "ک"}</div>
                <div>
                  <p className="text-sm font-medium">{u.name || "بدون نام"}</p>
                  <p className="text-[11px] text-muted-foreground" dir="ltr">{u.mobile}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                {u.planName && <Badge className="text-[9px]" style={{ background: `${PLAN_COLORS[u.planName]}20`, color: PLAN_COLORS[u.planName] }}>{PLAN_LABELS[u.planName as Plan]}</Badge>}
                {u.onboardingDone && <span>✓ آنبوردینگ</span>}
                <span>{new Date(u.createdAt).toLocaleDateString("fa-IR")}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
    cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-500",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-500",
    violet: "from-violet-500/20 to-violet-500/5 text-violet-500",
    red: "from-red-500/20 to-red-500/5 text-red-500",
  };
  return (
    <Card className="p-4 glass relative overflow-hidden">
      <div className={`absolute -left-3 -top-3 w-14 h-14 rounded-full bg-gradient-to-br ${colors[color]} opacity-50`} />
      <div className="relative">
        <Icon className={`w-5 h-5 mb-2 ${colors[color].split(" ").pop()}`} />
        <p className="text-lg font-black font-stat">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {sub && <p className="text-[9px] text-muted-foreground/70">{sub}</p>}
      </div>
    </Card>
  );
}

/* ============================================================
   ۲. مدیریت کاربران
   ============================================================ */
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewUser, setViewUser] = useState<any>(null);
  const [chargeUser, setChargeUser] = useState<any>(null);
  const [notifyUser, setNotifyUser] = useState<any>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const pageSize = 15;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, page: String(page), pageSize: String(pageSize) });
      if (roleFilter) params.set("role", roleFilter);
      if (planFilter) params.set("plan", planFilter);
      const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const data = await res.json();
      setUsers(data.users || []);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, planFilter, page]);

  async function action(userId: string, act: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: act }),
      });
      if (!res.ok) throw new Error();
      toast.success("عملیات انجام شد");
      load();
    } catch { toast.error("خطا"); }
  }

  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="جستجو با شماره یا نام..." className="pr-10 rounded-xl glass" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[130px] rounded-xl glass"><SelectValue placeholder="نقش" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه نقش‌ها</SelectItem>
            <SelectItem value="USER">ورزشکار</SelectItem>
            <SelectItem value="ADMIN">ادمین</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[130px] rounded-xl glass"><SelectValue placeholder="پلن" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه پلن‌ها</SelectItem>
            <SelectItem value="none">بدون پلن</SelectItem>
            <SelectItem value="basic">اقتصادی</SelectItem>
            <SelectItem value="standard">استاندارد</SelectItem>
            <SelectItem value="advanced">پیشرفته</SelectItem>
            <SelectItem value="ultimate">حرفه‌ای</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="rounded-xl glass gap-2"
          onClick={async () => {
            try {
              const params = new URLSearchParams();
              if (search) params.set("search", search);
              if (roleFilter) params.set("role", roleFilter);
              if (planFilter) params.set("plan", planFilter);
              toast.success("در حال آماده‌سازی فایل اکسل...");
              const res = await fetch(`/api/admin/users/export?${params}`, { cache: "no-store" });
              if (!res.ok) throw new Error();
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `fitap-users-${new Date().toISOString().slice(0, 10)}.xlsx`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              toast.success("فایل اکسل دانلود شد");
            } catch { toast.error("خطا در دانلود فایل"); }
          }}
        >
          <Download className="w-4 h-4" />
          دانلود اکسل
        </Button>
        <Button
          variant="default"
          className="rounded-xl gap-2 bg-gradient-to-l from-amber-500 to-orange-500 text-white hover:opacity-95 shrink-0"
          onClick={() => setBroadcastOpen(true)}
          title="ارسال نوتیف کلی به همه کاربران"
        >
          <Megaphone className="w-4 h-4" />
          ارسال نوتیف کلی
        </Button>
      </div>

      {/* Table */}
      <Card className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">کاربر</th>
                <th className="text-right p-3 font-bold hidden sm:table-cell">نقش</th>
                <th className="text-right p-3 font-bold">پلن</th>
                <th className="text-right p-3 font-bold hidden md:table-cell">کیف پول</th>
                <th className="text-right p-3 font-bold hidden lg:table-cell">ثبت‌نام</th>
                <th className="text-center p-3 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1,2,3].map(i => <tr key={i}><td colSpan={6}><Skeleton className="h-12 m-1" /></td></tr>)
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">کاربری یافت نشد</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">{u.name?.[0] || "ک"}</div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate flex items-center gap-1">
                          {u.name || "بدون نام"}
                          {u.isBlocked && <Ban className="w-3 h-3 text-destructive" />}
                        </p>
                        <p className="text-[10px] text-muted-foreground" dir="ltr">{u.mobile}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    {u.role === "ADMIN" ? <Badge className="bg-primary text-[9px]">ادمین</Badge> : <span className="text-xs text-muted-foreground">ورزشکار</span>}
                  </td>
                  <td className="p-3">
                    {u.planName ? (
                      <Badge className="text-[9px]" style={{ background: `${PLAN_COLORS[u.planName]}20`, color: PLAN_COLORS[u.planName] }}>
                        {PLAN_LABELS[u.planName as Plan]}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3 hidden md:table-cell font-stat text-xs">{toPersianDigits(formatToman(u.walletBalance || 0))} ت</td>
                  <td className="p-3 hidden lg:table-cell text-[11px] text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("fa-IR")}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewUser(u)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition" title="مشاهده پروفایل"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setChargeUser(u)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-cyan-500 transition" title="شارژ کیف پول"><Wallet className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setNotifyUser(u)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-500 transition" title="ارسال اعلان"><Bell className="w-3.5 h-3.5" /></button>
                      {u.isBlocked ? (
                        <button onClick={() => action(u.id, "unblock")} className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition" title="رفع مسدودیت"><Check className="w-3.5 h-3.5" /></button>
                      ) : (
                        <button onClick={() => action(u.id, "block")} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition" title="مسدود"><Ban className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg h-8"><ChevronRight className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg h-8"><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      {/* View user profile */}
      {viewUser && <UserProfileDialog user={viewUser} onClose={() => setViewUser(null)} />}
      {/* Charge wallet */}
      {chargeUser && <ChargeWalletDialog user={chargeUser} onClose={() => setChargeUser(null)} onDone={() => { load(); setChargeUser(null); }} />}
      {/* Send notification */}
      {notifyUser && <SendNotificationDialog user={notifyUser} onClose={() => setNotifyUser(null)} onDone={() => setNotifyUser(null)} />}
      {/* Broadcast notification (admin → all users) */}
      {broadcastOpen && <BroadcastNotificationDialog onClose={() => setBroadcastOpen(false)} />}
    </div>
  );
}

function UserProfileDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [manageSubOpen, setManageSubOpen] = useState(false);
  const [editOnboarding, setEditOnboarding] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [savingOnboarding, setSavingOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${user.id}/details`, { cache: "no-store" });
        const data = await res.json();
        setDetails(data);
        if (data?.profile) setEditForm(data.profile);
      } catch {} finally { setLoading(false); }
    })();
  }, [user.id]);

  const profile = details?.profile;
  const subs = details?.subscriptions || [];
  const workouts = details?.workoutPlans || [];
  const meals = details?.mealPlans || [];
  const checkups = details?.checkups || [];
  const weights = details?.weightLogs || [];
  const payments = details?.payments || [];
  const totalPurchased = details?.totalPurchased || 0;
  const successfulPaymentCount = details?.successfulPaymentCount || 0;

  async function saveOnboarding() {
    setSavingOnboarding(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره");
      toast.success("پروفایل آنبوردینگ به‌روزرسانی شد");
      setEditOnboarding(false);
      // reload details
      const dr = await fetch(`/api/admin/users/${user.id}/details`, { cache: "no-store" });
      const dd = await dr.json();
      setDetails(dd);
      if (dd?.profile) setEditForm(dd.profile);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSavingOnboarding(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden custom-scrollbar [&>*]:min-w-0">
        <DialogHeader><DialogTitle className="flex items-center gap-2">پروفایل {user.name || "ورزشکار"}</DialogTitle></DialogHeader>
        {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : details ? (
          <div className="space-y-4 text-sm">
            {/* مدیریت اشتراک توسط ادمین — ۴ دکمه */}
            <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-xs text-violet-700">مدیریت اشتراک</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg h-7 text-xs gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-100"
                  onClick={() => setManageSubOpen(true)}
                >
                  <Crown className="w-3.5 h-3.5" />
                  مدیریت اشتراک
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                پلن فعلی: <b>{user.planName ? (PLAN_LABELS[user.planName as Plan] || user.planName) : "—"}</b>
                {user.planExpiresAt && (
                  <span> • انقضا: {new Date(user.planExpiresAt).toLocaleDateString("fa-IR")}</span>
                )}
              </p>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <InfoRow label="موبایل" value={user.mobile} />
              <InfoRow label="نقش" value={user.role === "ADMIN" ? "ادمین" : "ورزشکار"} />
              <InfoRow label="پلن" value={user.planName ? PLAN_LABELS[user.planName as Plan] : "بدون پلن"} />
              <InfoRow label="کیف پول" value={`${toPersianDigits(formatToman(user.walletBalance || 0))} ت`} />
              <InfoRow label="ثبت‌نام" value={new Date(user.createdAt).toLocaleDateString("fa-IR")} />
              <InfoRow label="کد معرفی" value={user.referralCode || "—"} />
            </div>

            {/* Onboarding Profile — قابل ویرایش توسط ادمین */}
            {profile && (
              <div className="rounded-xl border border-orange-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-xs text-orange-600">اطلاعات آنبوردینگ</p>
                  <Button
                    size="sm"
                    variant={editOnboarding ? "outline" : "ghost"}
                    className="h-7 text-[11px] gap-1"
                    onClick={() => {
                      if (editOnboarding) {
                        // reset و خروج از حالت ویرایش
                        setEditForm(profile);
                      }
                      setEditOnboarding(!editOnboarding);
                    }}
                  >
                    {editOnboarding ? (
                      <><X className="w-3 h-3" /> انصراف</>
                    ) : (
                      <><Pencil className="w-3 h-3" /> ویرایش</>
                    )}
                  </Button>
                </div>
                {!editOnboarding ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <InfoRow label="جنسیت" value={profile.gender === "male" ? "آقا" : "خانم"} />
                    <InfoRow label="سن" value={toPersianDigits(profile.age)} />
                    <InfoRow label="قد" value={`${toPersianDigits(profile.height)} cm`} />
                    <InfoRow label="وزن اولیه" value={`${toPersianDigits(profile.weight)} kg`} />
                    {profile.targetWeight && <InfoRow label="وزن هدف" value={`${toPersianDigits(profile.targetWeight)} kg`} />}
                    <InfoRow label="هدف" value={profile.goal || "—"} />
                    <InfoRow label="سطح فعالیت" value={profile.activityLevel || "—"} />
                    <InfoRow label="روزهای تمرین" value={toPersianDigits(profile.workoutDays || 0)} />
                    <InfoRow label="مکان تمرین" value={profile.workoutPlace || "—"} />
                    <InfoRow label="نوع رژیم" value={profile.dietType || "—"} />
                    {profile.trainingExperience && <InfoRow label="سابقه ورزشی" value={profile.trainingExperience} />}
                    {profile.bodyFrame && <InfoRow label="اندازه استخوان" value={profile.bodyFrame} />}
                    {profile.sleepHours != null && <InfoRow label="خواب (ساعت)" value={toPersianDigits(profile.sleepHours)} />}
                    {profile.stressLevel != null && <InfoRow label="سطح استرس" value={toPersianDigits(profile.stressLevel)} />}
                    {profile.workoutTime && <InfoRow label="ساعت تمرین" value={profile.workoutTime} />}
                    {profile.preferredCuisine && <InfoRow label="سبک آشپزی" value={profile.preferredCuisine} />}
                    {profile.diseases && <InfoRow label="بیماری‌ها" value={profile.diseases} />}
                    {profile.injuries && <InfoRow label="آسیب‌دیدگی" value={profile.injuries} />}
                    {profile.allergies && <InfoRow label="حساسیت غذایی" value={profile.allergies} />}
                    {profile.medicalConditions && <InfoRow label="شرایط پزشکی" value={profile.medicalConditions} />}
                    {profile.currentMedications && <InfoRow label="داروهای فعلی" value={profile.currentMedications} />}
                    {profile.currentSupplements && <InfoRow label="مکمل‌های فعلی" value={profile.currentSupplements} />}
                    {profile.dislikedFoods && <InfoRow label="غذاهای حذفی" value={profile.dislikedFoods} />}
                    {profile.drugAllergies && <InfoRow label="حساسیت دارویی" value={profile.drugAllergies} />}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <EditableField label="سن" value={editForm.age ?? ""} onChange={(v) => setEditForm({ ...editForm, age: v ? Number(v) : null })} type="number" />
                      <EditableField label="قد (cm)" value={editForm.height ?? ""} onChange={(v) => setEditForm({ ...editForm, height: v ? Number(v) : null })} type="number" />
                      <EditableField label="وزن (kg)" value={editForm.weight ?? ""} onChange={(v) => setEditForm({ ...editForm, weight: v ? Number(v) : null })} type="number" />
                      <EditableField label="وزن هدف (kg)" value={editForm.targetWeight ?? ""} onChange={(v) => setEditForm({ ...editForm, targetWeight: v ? Number(v) : null })} type="number" />
                      <EditableField label="هدف" value={editForm.goal ?? ""} onChange={(v) => setEditForm({ ...editForm, goal: v })} />
                      <EditableField label="سطح فعالیت" value={editForm.activityLevel ?? ""} onChange={(v) => setEditForm({ ...editForm, activityLevel: v })} />
                      <EditableField label="روزهای تمرین" value={editForm.workoutDays ?? ""} onChange={(v) => setEditForm({ ...editForm, workoutDays: v ? Number(v) : null })} type="number" />
                      <EditableField label="مکان تمرین" value={editForm.workoutPlace ?? ""} onChange={(v) => setEditForm({ ...editForm, workoutPlace: v })} />
                      <EditableField label="نوع رژیم" value={editForm.dietType ?? ""} onChange={(v) => setEditForm({ ...editForm, dietType: v })} />
                      <EditableField label="سابقه ورزشی" value={editForm.trainingExperience ?? ""} onChange={(v) => setEditForm({ ...editForm, trainingExperience: v })} />
                      <EditableField label="خواب (ساعت)" value={editForm.sleepHours ?? ""} onChange={(v) => setEditForm({ ...editForm, sleepHours: v ? Number(v) : null })} type="number" />
                      <EditableField label="سطح استرس (1-5)" value={editForm.stressLevel ?? ""} onChange={(v) => setEditForm({ ...editForm, stressLevel: v ? Number(v) : null })} type="number" />
                      <EditableField label="ساعت تمرین" value={editForm.workoutTime ?? ""} onChange={(v) => setEditForm({ ...editForm, workoutTime: v })} />
                      <EditableField label="بیماری‌ها" value={editForm.diseases ?? ""} onChange={(v) => setEditForm({ ...editForm, diseases: v })} />
                      <EditableField label="آسیب‌دیدگی" value={editForm.injuries ?? ""} onChange={(v) => setEditForm({ ...editForm, injuries: v })} />
                      <EditableField label="حساسیت غذایی" value={editForm.allergies ?? ""} onChange={(v) => setEditForm({ ...editForm, allergies: v })} />
                      <EditableField label="شرایط پزشکی" value={editForm.medicalConditions ?? ""} onChange={(v) => setEditForm({ ...editForm, medicalConditions: v })} />
                      <EditableField label="داروهای فعلی" value={editForm.currentMedications ?? ""} onChange={(v) => setEditForm({ ...editForm, currentMedications: v })} />
                      <EditableField label="مکمل‌های فعلی" value={editForm.currentSupplements ?? ""} onChange={(v) => setEditForm({ ...editForm, currentSupplements: v })} />
                      <EditableField label="غذاهای حذفی" value={editForm.dislikedFoods ?? ""} onChange={(v) => setEditForm({ ...editForm, dislikedFoods: v })} />
                      <EditableField label="حساسیت دارویی" value={editForm.drugAllergies ?? ""} onChange={(v) => setEditForm({ ...editForm, drugAllergies: v })} />
                    </div>
                    <Button
                      size="sm"
                      onClick={saveOnboarding}
                      disabled={savingOnboarding}
                      className="rounded-xl gap-1.5 w-full"
                    >
                      {savingOnboarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      ذخیره تغییرات
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Total Purchased — مجموع خرید کاربر از سایت */}
            <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-emerald-700 font-bold">مجموع خرید از سایت</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">{toPersianDigits(successfulPaymentCount)} پرداخت موفق</p>
                </div>
                <p className="text-lg font-black text-emerald-700 font-stat">
                  {toPersianDigits(formatToman(totalPurchased))} ت
                </p>
              </div>
            </div>

            {/* Subscription History */}
            {subs.length > 0 && (
              <div className="rounded-xl border border-orange-100 p-3">
                <p className="font-bold text-xs text-orange-600 mb-2">تاریخچه اشتراک ({toPersianDigits(subs.length)})</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  {subs.map((s: any) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] p-2 rounded-lg bg-slate-50">
                      <span className="font-bold shrink-0">{PLAN_LABELS[s.plan as Plan] || s.plan}</span>
                      <span className={`px-1.5 py-0.5 rounded shrink-0 ${s.status === "active" ? "bg-emerald-100 text-emerald-600" : s.status === "pending" ? "bg-amber-100 text-amber-600" : "bg-slate-200 text-slate-500"}`}>
                        {s.status === "active" ? "فعال" : s.status === "pending" ? "در انتظار" : "منقضی"}
                      </span>
                      <span className="text-slate-400 min-w-0 truncate">
                        {s.startDate ? new Date(s.startDate).toLocaleDateString("fa-IR") : "—"}
                        {" → "}
                        {s.endDate ? new Date(s.endDate).toLocaleDateString("fa-IR") : "—"}
                      </span>
                      <span className="text-slate-500 shrink-0">{toPersianDigits(formatToman(s.pricePaid))} ت</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payments / Transactions — لیست تراکنش‌ها */}
            {payments.length > 0 && (
              <div className="rounded-xl border border-orange-100 p-3">
                <p className="font-bold text-xs text-orange-600 mb-2">تراکنش‌ها ({toPersianDigits(payments.length)})</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] p-2 rounded-lg bg-slate-50">
                      <span className="font-bold shrink-0">{PLAN_LABELS[p.plan as Plan] || p.plan}</span>
                      <span className={`px-1.5 py-0.5 rounded shrink-0 ${p.status === "success" ? "bg-emerald-100 text-emerald-600" : p.status === "pending" ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
                        {p.status === "success" ? "موفق" : p.status === "pending" ? "در انتظار" : p.status === "failed" ? "ناموفق" : p.status === "refunded" ? "بازگشت‌خورده" : p.status}
                      </span>
                      <span className="text-slate-500 font-stat shrink-0">{toPersianDigits(formatToman(p.amount))} ت</span>
                      {p.refId && <span className="text-slate-400 min-w-0 truncate">کد: {p.refId}</span>}
                      <span className="text-slate-400 shrink-0">{new Date(p.createdAt).toLocaleDateString("fa-IR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Workout Plans */}
            {workouts.length > 0 && (
              <div className="rounded-xl border border-orange-100 p-3">
                <p className="font-bold text-xs text-orange-600 mb-2">برنامه‌های تمرینی ({toPersianDigits(workouts.length)})</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {workouts.map((wp: any) => (
                    <div key={wp.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] p-2 rounded-lg bg-slate-50">
                      <span className="flex-1 min-w-0 truncate">{wp.summary}</span>
                      {wp.active && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 font-bold shrink-0">فعال</span>}
                      <span className="text-slate-400 shrink-0">{new Date(wp.createdAt).toLocaleDateString("fa-IR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meal Plans */}
            {meals.length > 0 && (
              <div className="rounded-xl border border-orange-100 p-3">
                <p className="font-bold text-xs text-orange-600 mb-2">برنامه‌های غذایی ({toPersianDigits(meals.length)})</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {meals.map((mp: any) => (
                    <div key={mp.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] p-2 rounded-lg bg-slate-50">
                      <span className="shrink-0">{toPersianDigits(mp.totalCal || 0)} کالری</span>
                      {mp.active && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-600 font-bold shrink-0">فعال</span>}
                      <span className="text-slate-400 shrink-0">{new Date(mp.createdAt).toLocaleDateString("fa-IR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checkups */}
            {checkups.length > 0 && (
              <div className="rounded-xl border border-orange-100 p-3">
                <p className="font-bold text-xs text-orange-600 mb-2">چکاپ‌ها ({toPersianDigits(checkups.length)})</p>
                <div className="space-y-1.5">
                  {checkups.map((c: any) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] p-2 rounded-lg bg-slate-50">
                      <span className="shrink-0">فاز {toPersianDigits(c.phaseNumber)}</span>
                      <span className="shrink-0">وزن: {toPersianDigits(c.weight)} kg</span>
                      {c.bodyFatPercent && <span className="shrink-0">چربی: {toPersianDigits(c.bodyFatPercent)}٪</span>}
                      <span className={`px-1.5 py-0.5 rounded shrink-0 ${c.phaseCompleted ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                        {c.phaseCompleted ? "تکمیل" : "در انتظار"}
                      </span>
                      <span className="text-slate-400 shrink-0">{new Date(c.createdAt).toLocaleDateString("fa-IR")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weight Logs */}
            {weights.length > 0 && (
              <div className="rounded-xl border border-orange-100 p-3">
                <p className="font-bold text-xs text-orange-600 mb-2">آخرین وزن‌ها ({toPersianDigits(weights.length)})</p>
                <div className="flex flex-wrap gap-1.5">
                  {weights.slice(0, 10).map((w: any) => (
                    <span key={w.id} className="text-[11px] px-2 py-1 rounded-lg bg-slate-50">
                      {toPersianDigits(w.weight)} kg — {new Date(w.loggedAt).toLocaleDateString("fa-IR")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-slate-500">اطلاعاتی یافت نشد</p>
        )}
        {/* توضیحات مدیر — تاریخچه یادداشت‌های پایدار (آخرین بخش مودال) */}
        <UserAdminNotesSection userId={user.id} />
        <DialogFooter><Button onClick={onClose} variant="outline" className="rounded-xl">بستن</Button></DialogFooter>
      </DialogContent>
      {manageSubOpen && (
        <ManageSubscriptionDialog
          user={user}
          onClose={() => setManageSubOpen(false)}
          onDone={() => {
            setManageSubOpen(false);
            // reload user details
            (async () => {
              try {
                const res = await fetch(`/api/admin/users/${user.id}/details`, { cache: "no-store" });
                const data = await res.json();
                setDetails(data);
                if (data?.user) {
                  // به‌روزرسانی فیلدهای پلن روی user object بیرونی
                  Object.assign(user, {
                    planName: data.user.planName,
                    planExpiresAt: data.user.planExpiresAt,
                    planStartedAt: data.user.planStartedAt,
                  });
                }
              } catch {}
            })();
          }}
        />
      )}
    </Dialog>
  );
}

/* ============================================================
   توضیحات مدیر — یادداشت‌های پایدار هر کاربر (UserAdminNote)
   تاریخچه گفتگوها/تماس‌ها؛ همیشه ذخیره می‌ماند تا سال‌ها بعد
   هم ادمین بتواند سوابق را مرور کند. CRUD کامل روی
   /api/admin/users/[id]/notes
   ============================================================ */
type AdminNote = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorMobile: string | null;
};

const ADMIN_NOTE_MAX = 5000;
const ADMIN_NOTE_MIN = 2;

function UserAdminNotesSection({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // بارگذاری یادداشت‌ها همزمان با باز شدن مودال
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/notes`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setNotes(Array.isArray(data?.notes) ? data.notes : []);
      } catch {} finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function addNote() {
    const text = newBody.trim();
    if (text.length < ADMIN_NOTE_MIN || text.length > ADMIN_NOTE_MAX || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره یادداشت");
      setNotes((prev) => [data.note as AdminNote, ...prev]);
      setNewBody("");
      toast.success("یادداشت ثبت شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(note: AdminNote) {
    setDeletingId(null);
    setEditingId(note.id);
    setEditBody(note.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
  }

  async function saveEdit() {
    if (!editingId) return;
    const text = editBody.trim();
    if (text.length < ADMIN_NOTE_MIN || text.length > ADMIN_NOTE_MAX || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره یادداشت");
      setNotes((prev) => prev.map((n) => (n.id === editingId ? (data.note as AdminNote) : n)));
      cancelEdit();
      toast.success("یادداشت به‌روزرسانی شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSavingEdit(false);
    }
  }

  async function doDelete(noteId: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes?id=${encodeURIComponent(noteId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در حذف یادداشت");
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setDeletingId(null);
      toast.success("یادداشت حذف شد");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-orange-100 p-4 text-sm mt-4">
      {/* سربرگ بخش */}
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <NotebookPen className="w-4 h-4 text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-orange-600">توضیحات مدیر</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">تاریخچه گفتگوها و سوابق — همیشه ذخیره می‌ماند</p>
        </div>
        {!loading && notes.length > 0 && (
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{toPersianDigits(notes.length)} یادداشت</span>
        )}
      </div>

      {/* ثبت یادداشت جدید */}
      <Textarea
        dir="rtl"
        value={newBody}
        onChange={(e) => setNewBody(e.target.value.slice(0, ADMIN_NOTE_MAX))}
        placeholder="مثلاً: تماس تلفنی ۱۴۰۵/۰۶/۱۰ — کاربر گفت..."
        rows={3}
        className="rounded-xl text-xs min-h-20 resize-y bg-white/60"
      />
      <div className="flex items-center justify-between gap-2 mt-1.5 mb-3">
        <span className="text-[10px] text-muted-foreground shrink-0">
          {toPersianDigits(newBody.trim().length)} / {toPersianDigits(ADMIN_NOTE_MAX)}
        </span>
        <Button
          size="sm"
          onClick={addNote}
          disabled={adding || newBody.trim().length < ADMIN_NOTE_MIN}
          className="rounded-xl h-8 gap-1.5 text-xs"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          افزودن یادداشت
        </Button>
      </div>

      {/* لیست یادداشت‌ها (جدیدترین اول) — تاریخچه طولانی با اسکرول داخلی */}
      {loading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : notes.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-3">هنوز یادداشتی ثبت نشده است</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {notes.map((n) => {
            const edited =
              new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 60_000;
            if (editingId === n.id) {
              return (
                <div key={n.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
                  <Textarea
                    dir="rtl"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value.slice(0, ADMIN_NOTE_MAX))}
                    rows={3}
                    className="rounded-lg text-xs min-h-20 resize-y bg-white/80"
                  />
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {toPersianDigits(editBody.trim().length)} / {toPersianDigits(ADMIN_NOTE_MAX)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                        className="h-7 px-2 text-[11px] gap-1 rounded-lg"
                      >
                        <X className="w-3 h-3" /> انصراف
                      </Button>
                      <Button
                        size="sm"
                        onClick={saveEdit}
                        disabled={savingEdit || editBody.trim().length < ADMIN_NOTE_MIN}
                        className="h-7 px-2.5 text-[11px] gap-1 rounded-lg"
                      >
                        {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        ذخیره
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                <div className="flex items-center justify-between gap-x-2 gap-y-1 flex-wrap mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span
                      className="text-[10px] text-muted-foreground shrink-0"
                      title={new Date(n.createdAt).toLocaleString("fa-IR")}
                    >
                      {timeAgo(n.createdAt)}
                    </span>
                    {n.authorMobile && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-700 shrink-0 font-stat">
                        {toPersianDigits(n.authorMobile)}
                      </span>
                    )}
                    {edited && <span className="text-[10px] text-muted-foreground/70">(ویرایش شده)</span>}
                  </div>
                  {deletingId === n.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(null)}
                        disabled={deleting}
                        className="h-6 px-2 text-[10px] rounded-lg"
                      >
                        انصراف
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => doDelete(n.id)}
                        disabled={deleting}
                        className="h-6 px-2 text-[10px] gap-1 rounded-lg"
                      >
                        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        تأیید حذف
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(n)}
                        className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-orange-600 rounded-lg"
                      >
                        <Pencil className="w-3 h-3" /> ویرایش
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(n.id)}
                        className="h-6 px-1.5 text-[10px] gap-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" /> حذف
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/90">{n.body}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   مدیریت اشتراک کاربر توسط ادمین — ۵ اکشن
   ============================================================ */
function ManageSubscriptionDialog({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [action, setAction] = useState<"remove" | "activate" | "extend" | "reduce" | "activate_days">("activate");
  const [plan, setPlan] = useState<string>(user.planName ?? "ultimate");
  const [days, setDays] = useState<string>("20");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (action !== "remove" && !plan && (action === "activate" || action === "activate_days")) {
      toast.error("پلن را انتخاب کنید");
      return;
    }
    if ((action === "extend" || action === "reduce" || action === "activate_days") && (!days || Number(days) <= 0)) {
      toast.error("تعداد روز معتبر وارد کنید");
      return;
    }
    setSaving(true);
    try {
      const body: any = { action };
      if (action === "activate" || action === "activate_days") body.plan = plan;
      if (action === "extend" || action === "reduce" || action === "activate_days") body.days = Number(days);

      const res = await fetch(`/api/admin/users/${user.id}/manage-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در اعمال تغییرات");
      toast.success("تغییرات با موفقیت اعمال شد");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-violet-500" />
            مدیریت اشتراک — {user.name || user.mobile}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-2.5 rounded-xl bg-muted/40 text-xs">
            <p>پلن فعلی: <b>{user.planName ? (PLAN_LABELS[user.planName as Plan] || user.planName) : "—"}</b></p>
            {user.planExpiresAt && (
              <p>انقضا: {new Date(user.planExpiresAt).toLocaleDateString("fa-IR")}</p>
            )}
          </div>

          <div>
            <Label className="mb-1 block">نوع اکشن</Label>
            <Select value={action} onValueChange={(v) => setAction(v as any)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activate">فعال‌سازی پلن جدید</SelectItem>
                <SelectItem value="activate_days">فعال‌سازی پلن برای مدت مشخص</SelectItem>
                <SelectItem value="extend">تمدید (افزودن روز)</SelectItem>
                <SelectItem value="reduce">کاهش (کم کردن روز)</SelectItem>
                <SelectItem value="remove">حذف پلن فعلی</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(action === "activate" || action === "activate_days") && (
            <div>
              <Label className="mb-1 block">پلن</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_PLANS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(action === "extend" || action === "reduce" || action === "activate_days") && (
            <div>
              <Label className="mb-1 block">تعداد روز</Label>
              <Input
                type="number"
                dir="ltr"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="مثلاً 20"
                className="rounded-xl text-center font-stat"
              />
            </div>
          )}

          {action === "remove" && (
            <div className="p-2.5 rounded-xl bg-destructive/5 border border-destructive/20 text-xs text-destructive">
              ⚠️ اشتراک فعال فعلی کاربر لغو و به‌عنوان expired علامت‌گذاری می‌شود. این عمل قابل بازگشت نیست.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            اعمال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChargeWalletDialog({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  async function charge() {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/wallet-charge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, amount: Number(amount), description: desc }),
      });
      if (!res.ok) throw new Error();
      toast.success(`کیف پول ${toPersianDigits(formatToman(Number(amount)))} ت شارژ شد`);
      onDone();
    } catch { toast.error("خطا در شارژ"); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader><DialogTitle>شارژ کیف پول — {user.name || user.mobile}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="p-2 rounded-lg bg-muted/40 text-xs text-center">موجودی فعلی: <b className="font-stat">{toPersianDigits(formatToman(user.walletBalance || 0))} ت</b></div>
          <div>
            <Label className="mb-1 block">مبلغ (تومان)</Label>
            <Input type="number" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مثلاً 500000" className="rounded-xl text-center font-stat" />
          </div>
          <div>
            <Label className="mb-1 block">توضیحات (اختیاری)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="شارژ تستی / پشتیبانی" className="rounded-xl" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[100000, 500000, 1000000].map(v => (
              <button key={v} onClick={() => setAmount(String(v))} className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition font-stat">
                {toPersianDigits(formatToman(v))}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button onClick={charge} disabled={!amount || saving} className="rounded-xl">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "شارژ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

/* ============================================================
   EditableField — فیلد قابل ویرایش برای فرم ویرایش آنبوردینگ ادمین
   ============================================================ */
function EditableField({ label, value, onChange, type = "text" }: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40">
      <label className="text-[10px] text-muted-foreground">{label}</label>
      <Input
        type={type}
        dir="ltr"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs rounded-md font-stat text-right"
      />
    </div>
  );
}

/* ============================================================
   ارسال اعلان به کاربر (admin → user)
   ============================================================ */
const NOTIFICATION_TYPES = [
  { value: "system", label: "سیستمی" },
  { value: "workout_reminder", label: "یادآوری تمرین" },
  { value: "water_reminder", label: "یادآوری آب" },
  { value: "achievement", label: "دستاورد" },
  { value: "upgrade", label: "ارتقا پلن" },
  { value: "renewal", label: "تمدید اشتراک" },
  { value: "re_engagement", label: "بازگردانی کاربر" },
  { value: "checkup", label: "چکاپ" },
  { value: "coach", label: "مربی" },
  { value: "welcome", label: "خوش‌آمد" },
  { value: "subscription", label: "اشتراک" },
];

function SendNotificationDialog({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("system");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          type,
          link: link.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ارسال اعلان");
      toast.success("اعلان با موفقیت ارسال شد");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ارسال اعلان");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            ارسال اعلان به {user.name || user.mobile}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">عنوان *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: تبریک! هدف ماهانه محقق شد"
              maxLength={200}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1 block">متن پیام *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="متن کامل اعلان..."
              rows={4}
              maxLength={2000}
              className="rounded-xl resize-none"
            />
          </div>
          <div>
            <Label className="mb-1 block">نوع اعلان</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">لینک داخلی (اختیاری)</Label>
            <Input
              dir="ltr"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="مثلاً: ?tab=workouts"
              maxLength={500}
              className="rounded-xl text-left"
            />
            <p className="text-[10px] text-muted-foreground mt-1">کاربر با کلیک روی اعلان به این مسیر در اپ هدایت می‌شود.</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button
            onClick={send}
            disabled={!title.trim() || !body.trim() || sending}
            className="rounded-xl"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            ارسال اعلان
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ارسال اعلان کلی (broadcast) به همه کاربران (admin → all users)
   - مدیر می‌تواند یک پیام را به همه کاربران ارسال کند
   - اختیاری: فقط کاربران دارای پلن فعال
   - پس از ارسال، تعداد گیرنده‌ها + پوش‌نوتیف‌های موفق نمایش داده می‌شود
   ============================================================ */
function BroadcastNotificationDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("system");
  const [link, setLink] = useState("");
  const [onlyActivePlan, setOnlyActivePlan] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number; pushed: number } | null>(null);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/broadcast-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          type,
          link: link.trim() || null,
          onlyActivePlan,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ارسال اعلان کلی");
      setResult({
        sent: data.sent ?? 0,
        total: data.total ?? 0,
        pushed: data.pushed ?? 0,
      });
      toast.success(`اعلان به ${toPersianDigits(data.sent ?? 0)} کاربر ارسال شد`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ارسال اعلان کلی");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-500" />
            ارسال نوتیف کلی به همه کاربران
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700 leading-relaxed">
            ⚠️ این پیام به <b>همه کاربران</b> (غیرمسدود شده) ارسال می‌شود. از ارسال
            پیام‌های تبلیغاتی بی‌مورد خودداری کنید.
          </div>
          <div>
            <Label className="mb-1 block">عنوان *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: خبر جدید فیتاپ 🎉"
              maxLength={200}
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1 block">متن پیام *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="متن کامل اعلان..."
              rows={4}
              maxLength={2000}
              className="rounded-xl resize-none"
            />
          </div>
          <div>
            <Label className="mb-1 block">نوع اعلان</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">لینک داخلی (اختیاری)</Label>
            <Input
              dir="ltr"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="مثلاً: ?tab=programs"
              maxLength={500}
              className="rounded-xl text-left"
            />
            <p className="text-[10px] text-muted-foreground mt-1">کاربر با کلیک روی اعلان به این مسیر در اپ هدایت می‌شود.</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox checked={onlyActivePlan} onCheckedChange={(v) => setOnlyActivePlan(v === true)} />
            <span className="text-xs">فقط به کاربران دارای پلن فعال ارسال شود</span>
          </label>

          {result && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-700 mb-1">
                <CheckCircle2 className="w-4 h-4" />
                ارسال موفق!
              </div>
              <div className="space-y-0.5 text-emerald-800">
                <p>تعداد گیرندگان: <b className="font-stat">{toPersianDigits(result.total)}</b> کاربر</p>
                <p>اعلان‌های ساخته‌شده: <b className="font-stat">{toPersianDigits(result.sent)}</b></p>
                <p>پوش‌نوتیف موفق: <b className="font-stat">{toPersianDigits(result.pushed)}</b></p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">بستن</Button>
          <Button
            onClick={send}
            disabled={!title.trim() || !body.trim() || sending}
            className="rounded-xl gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
            ارسال به همه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ۳. مالی و تراکنش‌ها
   ============================================================ */
function FinanceTab() {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const pageSize = 20;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/transactions?${params}`, { cache: "no-store" });
      const data = await res.json();
      setTxns(data.transactions || []);
      setTotalPages(data.totalPages || 1);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search]);

  const STATUS_LABELS: Record<string, string> = { success: "موفق", failed: "ناموفق", pending: "در انتظار", verifying: "در حال پردازش", cancelled: "لغو شده", refunded: "مسترد شده", manual_resolved: "رسیدگی دستی (قدیمی)", expired: "منقضی — پرداخت‌نشده" };
  const STATUS_COLORS: Record<string, string> = { success: "text-emerald-500", failed: "text-red-500", pending: "text-amber-500", verifying: "text-sky-500", cancelled: "text-muted-foreground", refunded: "text-violet-500", manual_resolved: "text-slate-500", expired: "text-rose-400" };

  // ─── FIX (درخواست مالک): بازیابی پرداخت معلق در همان منوی «مالی و تراکنش‌ها» ───
  // قبلاً دکمه بازیابی فقط در تب «پرداخت‌ها» (زیر حسابداری) بود؛ ادمین اینجا فقط
  // استعلام می‌دید («پرداخت شده ولی در انتظار») و دستی فعال می‌کرد!
  const [recoveringTxnId, setRecoveringTxnId] = useState<string | null>(null);
  async function recoverTxn(txn: any) {
    if (txn.type !== "payment" || txn.paymentMethod !== "gateway") return;
    setRecoveringTxnId(txn.id);
    try {
      const res = await fetch("/api/payment/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: txn.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "خطا در بازیابی");
      const r = d.results?.[0];
      if (r?.recovered) {
        toast.success("پرداخت بازیابی شد — پلن/کیف پول کاربر فعال و تراکنش ثبت شد ✅");
      } else {
        toast.info(r?.message || "زرین‌پال هنوز این پرداخت را تأیید نکرده — بعداً دوباره");
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در بازیابی");
    } finally {
      setRecoveringTxnId(null);
    }
  }

  async function handleRefund(txn: any) {
    if (txn.type !== "payment") return;
    if (txn.status !== "success") return;
    if (txn.paymentMethod !== "gateway") {
      alert("استرداد فقط برای پرداخت‌های درگاهی امکان‌پذیر است.");
      return;
    }
    if (!confirm(`آیا از استرداد این تراکنش مطمئن هستید؟\n\nکاربر: ${txn.userName}\nمبلغ: ${toPersianDigits(formatToman(txn.amount))} تومان\nکد پیگیری: ${txn.refId || "—"}\n\nاین عملیات فقط تا ۳۰ دقیقه پس از پرداخت امکان‌پذیر است.`)) return;
    try {
      const res = await fetch("/api/payment/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: txn.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`خطا: ${data.error || "استرداد ناموفق بود"}`);
        return;
      }
      alert("تراکنش با موفقیت استرداد شد ✓");
      load();
    } catch {
      alert("خطا در ارتباط با سرور");
    }
  }

  async function handleInquiry(txn: any) {
    if (txn.type !== "payment") return;
    if (txn.paymentMethod !== "gateway") return;
    try {
      const res = await fetch(`/api/payment/inquiry?paymentId=${txn.id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        alert(`خطا: ${data.error || "استعلام ناموفق بود"}`);
        return;
      }
      const statusMap: Record<string, string> = {
        VERIFIED: "وریفای شده",
        PAID: "پرداخت شده (وریفای نشده)",
        IN_BANK: "در حال پرداخت",
        FAILED: "ناموفق",
        REVERSED: "ریورس شده",
      };
      const zpStatus = statusMap[data.status] || data.status || "نامشخص";
      const dbStatus = STATUS_LABELS[txn.status] || txn.status;

      // ─── FIX: استعلام actionable — پول واقعاً داده شده ولی تحویل نشده ───
      // دقیقاً سناریوی «زرین‌پال: پرداخت شده / دیتابیس: در انتظار» — به‌جای alert
      // بی‌عمل، پیشنهاد بازیابی خودکار (استعلام + تحویل پلن + ثبت تراکنش موفق)
      const paidAtGateway = data.status === "PAID" || data.status === "VERIFIED";
      const unresolvedInDb = txn.status === "pending" || txn.status === "verifying";
      if (paidAtGateway && unresolvedInDb) {
        const ok = window.confirm(
          `وضعیت در زرین‌پال: ${zpStatus}\nوضعیت در دیتابیس: ${dbStatus}\n\nپرداخت واقعاً انجام شده ولی تحویل نشده (همان باگ «در انتظار»).\n«OK» را بزنید تا همین حالا بازیابی شود: استعلام زرین‌پال + فعال‌سازی پلن کاربر + ثبت تراکنش موفق.`
        );
        if (ok) await recoverTxn(txn);
        return;
      }
      alert(`وضعیت در زرین‌پال: ${zpStatus}\nوضعیت در دیتابیس: ${dbStatus}`);
    } catch {
      alert("خطا در ارتباط با سرور");
    }
  }

  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="جستجو با شماره یا نام..." className="pr-10 rounded-xl glass" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[140px] rounded-xl glass"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه</SelectItem>
            <SelectItem value="success">موفق</SelectItem>
            <SelectItem value="pending">در انتظار</SelectItem>
            <SelectItem value="failed">ناموفق</SelectItem>
            <SelectItem value="cancelled">لغو شده</SelectItem>
            <SelectItem value="refunded">مسترد شده</SelectItem>
            <SelectItem value="verifying">در حال پردازش</SelectItem>
            <SelectItem value="manual_resolved">رسیدگی دستی (قدیمی)</SelectItem>
            <SelectItem value="expired">منقضی — پرداخت‌نشده</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">کاربر</th>
                <th className="text-right p-3 font-bold">نوع</th>
                <th className="text-right p-3 font-bold">مبلغ</th>
                <th className="text-right p-3 font-bold hidden md:table-cell">پلن/روش</th>
                <th className="text-right p-3 font-bold">وضعیت</th>
                <th className="text-right p-3 font-bold hidden lg:table-cell">تاریخ</th>
                <th className="text-right p-3 font-bold hidden xl:table-cell">کارت/کد پیگیری</th>
                <th className="text-right p-3 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3].map(i => <tr key={i}><td colSpan={8}><Skeleton className="h-12 m-1" /></td></tr>) :
               txns.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">تراکنشی یافت نشد</td></tr> :
               txns.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <p className="text-sm font-medium">{t.userName || "—"}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{t.userMobile}</p>
                  </td>
                  <td className="p-3">
                    {t.type === "wallet" ? <Badge className="bg-cyan-500/15 text-cyan-500 text-[9px]">کیف پول</Badge> : <Badge className="bg-amber-500/15 text-amber-500 text-[9px]">پلن</Badge>}
                  </td>
                  <td className="p-3 font-stat text-sm font-bold">{t.amount > 0 ? "+" : ""}{toPersianDigits(formatToman(Math.abs(t.amount)))} ت</td>
                  <td className="p-3 hidden md:table-cell text-xs">
                    {t.plan ? <span>{PLAN_LABELS[t.plan as Plan] || t.plan}</span> : ""}
                    <span className="text-muted-foreground"> • {t.paymentMethod === "wallet" ? "کیف پول" : "درگاه"}</span>
                  </td>
                  <td className="p-3"><span className={`text-xs font-bold ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span></td>
                  <td className="p-3 hidden lg:table-cell text-[11px] text-muted-foreground">{new Date(t.createdAt).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="p-3 hidden xl:table-cell text-[10px]">
                    {t.cardPan && <p className="font-mono text-muted-foreground" dir="ltr">{t.cardPan}</p>}
                    <p className="font-mono text-muted-foreground" dir="ltr">{t.refId?.slice(0, 12) || "—"}</p>
                    {t.fee != null && <p className="text-[9px] text-amber-500">کارمزد: {toPersianDigits(formatToman(t.fee))} ت</p>}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {t.type === "payment" && t.status === "success" && t.paymentMethod === "gateway" && (
                        <button
                          onClick={() => handleRefund(t)}
                          className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold hover:bg-red-100 transition"
                          title="استرداد (Reverse)"
                        >
                          استرداد
                        </button>
                      )}
                      {t.type === "payment" && t.paymentMethod === "gateway" && (
                        <button
                          onClick={() => handleInquiry(t)}
                          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-100 transition"
                          title="استعلام وضعیت"
                        >
                          استعلام
                        </button>
                      )}
                      {t.type === "payment" && t.paymentMethod === "gateway" && (t.status === "pending" || t.status === "verifying") && (
                        <button
                          onClick={() => recoverTxn(t)}
                          disabled={recoveringTxnId === t.id}
                          className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold hover:bg-amber-100 transition disabled:opacity-50 flex items-center gap-1"
                          title="بازیابی — استعلام زرین‌پال و تحویل خودکار پلن در صورت پرداخت واقعی"
                        >
                          {recoveringTxnId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          بازیابی
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg h-8"><ChevronRight className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg h-8"><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   ۳.۵. حسابداری مدیریت (ACCOUNTING-SYSTEM)
   ============================================================ */

type AccountingSubtab = "overview" | "range" | "compare" | "details";
type AccountingAnalysisResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  salesRecommendations: string[];
  forecast: string;
  healthScore: number;
};

// ─── Presets برای بازه‌های سریع ───
const RANGE_PRESETS: { id: string; label: string; kind: "today" | "days" | "thisMonth" | "lastMonth"; days?: number }[] = [
  { id: "today", label: "امروز", kind: "today" },
  { id: "7d", label: "۷ روز", kind: "days", days: 7 },
  { id: "30d", label: "۳۰ روز", kind: "days", days: 30 },
  { id: "90d", label: "۹۰ روز", kind: "days", days: 90 },
  { id: "thisMonth", label: "این ماه", kind: "thisMonth" },
  { id: "lastMonth", label: "ماه قبل", kind: "lastMonth" },
];

function presetToRange(p: (typeof RANGE_PRESETS)[number]): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (p.kind === "today") {
    // from/to = today
  } else if (p.kind === "thisMonth") {
    from.setDate(1);
  } else if (p.kind === "lastMonth") {
    from.setMonth(from.getMonth() - 1);
    from.setDate(1);
    const endOfLastMonth = new Date(now);
    endOfLastMonth.setDate(0);
    endOfLastMonth.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: endOfLastMonth.toISOString() };
  } else if (p.kind === "days" && p.days) {
    from.setDate(from.getDate() - (p.days - 1));
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function fmtShamsi(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("fa-IR", opts || { year: "numeric", month: "short", day: "numeric" });
}

function fmtShamsiDate(iso: string | null): string {
  return fmtShamsi(iso, { year: "numeric", month: "short", day: "numeric" });
}

function fmtShamsiDateTime(iso: string | null): string {
  return fmtShamsi(iso, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function healthScoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function healthScoreLabel(score: number): string {
  if (score >= 75) return "عالی";
  if (score >= 50) return "متوسط";
  return "نیاز به توجه";
}

function pctText(pct: number | null): string {
  if (pct === null) return "نامحدود";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${toPersianDigits(pct)}٪`;
}

function pctColor(pct: number | null): string {
  if (pct === null) return "text-amber-500";
  if (pct > 0) return "text-emerald-500";
  if (pct < 0) return "text-red-500";
  return "text-muted-foreground";
}

// ─── دکمه و مدال تحلیل هوشمند ───
function AccountingAnalysisModal({
  open, onClose, loading, analysis, error,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  analysis: AccountingAnalysisResult | null;
  error: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onClose(); }}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            تحلیل هوشمند حسابداری
          </DialogTitle>
        </DialogHeader>
        {loading && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">در حال تحلیل توسط هوش مصنوعی... ممکن است چند ثانیه طول بکشد.</p>
          </div>
        )}
        {!loading && error && (
          <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && analysis && (
          <div className="space-y-4">
            {/* Health Score */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20">
              <div className="text-4xl font-black font-stat" style={{ color: healthScoreColor(analysis.healthScore) }}>
                {toPersianDigits(analysis.healthScore)}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">امتیاز سلامت مالی</p>
                <p className="text-sm font-bold">{healthScoreLabel(analysis.healthScore)}</p>
              </div>
            </div>
            {/* Summary */}
            <div>
              <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5"><Activity className="w-4 h-4 text-primary" />خلاصه وضعیت</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
            </div>
            {/* Strengths */}
            {analysis.strengths.length > 0 && (
              <div>
                <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5 text-emerald-600"><ThumbsUp className="w-4 h-4" />نقاط قوت</h4>
                <ul className="space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Weaknesses */}
            {analysis.weaknesses.length > 0 && (
              <div>
                <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5 text-red-600"><AlertTriangle className="w-4 h-4" />نقاط ضعف</h4>
                <ul className="space-y-1">
                  {analysis.weaknesses.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Sales Recommendations */}
            {analysis.salesRecommendations.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5 text-amber-700"><Lightbulb className="w-4 h-4" />راهکار افزایش فروش</h4>
                <ol className="space-y-1.5">
                  {analysis.salesRecommendations.map((s, i) => (
                    <li key={i} className="text-sm text-foreground flex gap-2">
                      <span className="font-black text-amber-600 shrink-0">{toPersianDigits(i + 1)}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {/* Forecast */}
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5 text-blue-700"><TrendingUp className="w-4 h-4" />پیش‌بینی روند</h4>
              <p className="text-sm text-foreground leading-relaxed">{analysis.forecast}</p>
            </div>
          </div>
        )}
        {!loading && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} className="rounded-xl">بستن</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AiAnalyzeButton({ mode, buildPayload, disabled }: { mode: "overview" | "compare" | "details"; buildPayload: () => any; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AccountingAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const payload = buildPayload();
      const res = await fetch("/api/admin/accounting/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, data: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در تحلیل");
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای ناشناخته");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={run}
        disabled={disabled}
        className="rounded-xl gap-2 text-white shrink-0"
        style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        size="sm"
      >
        <Wand2 className="w-4 h-4" />
        تحلیل هوشمند
      </Button>
      <AccountingAnalysisModal open={open} onClose={() => setOpen(false)} loading={loading} analysis={analysis} error={error} />
    </>
  );
}

// ─── کنترل بازه: preset chips + PersianDatePicker ───
function RangeControls({
  from, to, onChange, compact,
}: {
  from: string; to: string; onChange: (from: string, to: string) => void; compact?: boolean;
}) {
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // sync local state when parent prop changes externally
  useEffect(() => { setFromVal(from); }, [from]);
  useEffect(() => { setToVal(to); }, [to]);

  function applyPreset(p: (typeof RANGE_PRESETS)[number]) {
    const r = presetToRange(p);
    setFromVal(r.from);
    setToVal(r.to);
    setActivePreset(p.id);
    onChange(r.from, r.to);
  }

  function applyCustom() {
    setActivePreset(null);
    onChange(fromVal, toVal);
  }

  return (
    <div className={`flex flex-col gap-2 ${compact ? "" : "sm:flex-row sm:items-end sm:gap-3"}`}>
      <div className="flex flex-wrap gap-1">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
              activePreset === p.id ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <PersianDatePicker
          value={fromVal}
          onChange={(v) => { setFromVal(v || new Date().toISOString()); setActivePreset(null); }}
          label="از تاریخ"
          placeholder="شروع بازه"
          className="w-[170px]"
        />
        <PersianDatePicker
          value={toVal}
          onChange={(v) => { setToVal(v || new Date().toISOString()); setActivePreset(null); }}
          label="تا تاریخ"
          placeholder="پایان بازه"
          className="w-[170px]"
        />
        <Button onClick={applyCustom} size="sm" className="rounded-xl gap-1.5 h-9">
          <Check className="w-4 h-4" /> اعمال
        </Button>
      </div>
    </div>
  );
}

// ─── محتوای مشترک Overview (داشبورد + بازه خاص) ───
function OverviewContent({ from, to, onData }: { from: string; to: string; onData?: (data: any) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams({ from, to });
        const res = await fetch(`/api/admin/accounting/overview?${params}`, { cache: "no-store" });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "خطا در دریافت آمار");
        }
        const d = await res.json();
        setData(d);
        onData?.(d);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "خطا");
      } finally { setLoading(false); }
    })();
  }, [from, to, onData]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <div className="grid lg:grid-cols-2 gap-3">{[1,2].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
      </div>
    );
  }
  if (err) {
    return <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err}</div>;
  }

  const s = data?.stats;
  const planData = (data?.revenueByPlan || []).map((p: any) => ({
    name: p.label,
    revenue: p.revenue,
    count: p.count,
    color: PLAN_COLORS[p.plan] || "#888",
  }));
  const lineData = (data?.revenueDaily || []).map((d: any) => ({ name: d.label, revenue: d.revenue, count: d.count }));

  const STATUS_LABELS: Record<string, string> = { success: "موفق", failed: "ناموفق", pending: "در انتظار", cancelled: "لغو شده", refunded: "مسترد شده" };
  const STATUS_COLORS: Record<string, string> = { success: "text-emerald-500", failed: "text-red-500", pending: "text-amber-500", cancelled: "text-muted-foreground", refunded: "text-violet-500" };

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={DollarSign} label="درآمد کل بازه" value={`${toPersianDigits(formatToman(s?.totalRevenue || 0))} ت`} color="emerald" />
        <KpiCard icon={ListChecks} label="تعداد پرداخت‌ها" value={toPersianDigits(s?.totalPayments || 0)} sub={`میانگین: ${toPersianDigits(formatToman(s?.avgTicket || 0))} ت`} color="cyan" />
        <KpiCard icon={Users} label="کاربران جدید" value={toPersianDigits(s?.totalUsers || 0)} color="amber" />
        <KpiCard icon={Crown} label="اشتراک‌های فعال" value={toPersianDigits(s?.activeSubscriptions || 0)} color="violet" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4 glass">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><LineChartIcon className="w-4 h-4 text-primary" /> روند درآمد روزانه</h3>
          {lineData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">داده‌ای در این بازه نیست</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => toPersianDigits(formatToman(v))} width={70} />
                <Tooltip
                  formatter={(v: any) => [`${toPersianDigits(formatToman(Number(v)))} ت`, "درآمد"]}
                  contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4 glass">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-primary" /> درآمد بر اساس پلن</h3>
          {planData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">داده‌ای در این بازه نیست</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={planData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {planData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${toPersianDigits(formatToman(Number(v)))} ت`} contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {planData.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground mr-auto">{toPersianDigits(formatToman(p.revenue))} ت</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Plan bar chart (count) */}
      <Card className="p-4 glass">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> تعداد پرداخت بر اساس پلن</h3>
        {planData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">داده‌ای نیست</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={planData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} width={30} />
              <Tooltip formatter={(v: any) => [toPersianDigits(Number(v)), "تعداد"]} contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {planData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Recent payments + users */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-4 glass">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> آخرین پرداخت‌ها</h3>
          <div className="space-y-1.5">
            {(data?.recentPayments || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">پرداختی در این بازه نیست</p>
            ) : (
              (data?.recentPayments || []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 border-border/40">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{p.userName || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtShamsiDateTime(p.createdAt)}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-xs font-bold font-stat">{toPersianDigits(formatToman(p.amount))} ت</p>
                    <p className={`text-[10px] font-bold ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status] || p.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 glass">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> آخرین کاربران ثبت‌نام‌شده</h3>
          <div className="space-y-1.5">
            {(data?.recentUsers || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">کاربر جدیدی در این بازه نیست</p>
            ) : (
              (data?.recentUsers || []).map((u: any) => (
                <div key={u.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0 border-border/40">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{u.name || "بدون نام"}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{u.mobile}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-[10px] text-muted-foreground">{fmtShamsiDate(u.createdAt)}</p>
                    {u.planName && <Badge className="text-[9px] h-4" style={{ background: `${PLAN_COLORS[u.planName]}22`, color: PLAN_COLORS[u.planName] }}>{PLAN_LABELS[u.planName as Plan]}</Badge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── سابتَب ۱: داشبورد کلی ───
function OverviewSubtab() {
  const init = presetToRange(RANGE_PRESETS[2]); // 30d
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [ovData, setOvData] = useState<any>(null);
  const onData = useCallback((d: any) => setOvData(d), []);

  return (
    <div className="space-y-3">
      <Card className="p-3 glass">
        <RangeControls from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          بازه: {fmtShamsiDate(from)} تا {fmtShamsiDate(to)}
        </p>
        <AiAnalyzeButton mode="overview" buildPayload={() => ({ from, to, source: "overview", stats: ovData?.stats, revenueByPlan: ovData?.revenueByPlan, revenueDaily: (ovData?.revenueDaily || []).slice(-30) })} />
      </div>
      <OverviewContent from={from} to={to} onData={onData} />
    </div>
  );
}

// ─── سابتَب ۲: بازه زمانی خاص ───
function RangeSubtab() {
  const init = presetToRange(RANGE_PRESETS[2]);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [ovData, setOvData] = useState<any>(null);
  const onData = useCallback((d: any) => setOvData(d), []);

  return (
    <div className="space-y-3">
      <Card className="p-3 glass">
        <div className="flex items-center gap-2 mb-2">
          <CalendarRange className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">انتخاب بازه زمانی دلخواه</h3>
        </div>
        <RangeControls from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          بازه: {fmtShamsiDate(from)} تا {fmtShamsiDate(to)}
        </p>
        <AiAnalyzeButton mode="overview" buildPayload={() => ({ from, to, source: "range", stats: ovData?.stats, revenueByPlan: ovData?.revenueByPlan, revenueDaily: (ovData?.revenueDaily || []).slice(-30) })} />
      </div>
      <OverviewContent from={from} to={to} onData={onData} />
    </div>
  );
}

// ─── سابتَب ۳: مقایسه دو بازه ───
function CompareSubtab() {
  const r1Init = presetToRange(RANGE_PRESETS[3]); // 90d as range1 default... actually use lastMonth
  const r2Init = presetToRange(RANGE_PRESETS[2]); // 30d as range2 default
  const [from1, setFrom1] = useState(r1Init.from);
  const [to1, setTo1] = useState(r1Init.to);
  const [from2, setFrom2] = useState(r2Init.from);
  const [to2, setTo2] = useState(r2Init.to);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ from1, to1, from2, to2 });
      const res = await fetch(`/api/admin/accounting/compare?${params}`, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "خطا");
      }
      const d = await res.json();
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطا");
    } finally { setLoading(false); }
  }

  // initial load
  useEffect(() => { load(); }, []);

  const diffs = data?.diffs;
  const ranges = data?.ranges;
  const daily = data?.daily || [];

  function DiffCard({ label, diff, curr, prev }: { label: string; diff: any; curr: number; prev: number }) {
    const isPositive = (diff.pct ?? 0) > 0;
    const isNeutral = diff.pct === 0 || diff.pct === null;
    return (
      <Card className="p-3 glass">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <div className="flex items-end gap-2 mt-1">
          <p className="text-lg font-black font-stat">{toPersianDigits(formatToman(curr))}</p>
          <p className="text-[10px] text-muted-foreground mb-1">/ {toPersianDigits(formatToman(prev))}</p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${pctColor(diff.pct)}`}>
          {!isNeutral && (isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
          <span>{pctText(diff.pct)}</span>
          <span className="text-muted-foreground font-normal mr-1">
            ({diff.absolute >= 0 ? "+" : ""}{toPersianDigits(formatToman(diff.absolute))})
          </span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 glass space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-sm bg-cyan-500" />
            <h3 className="font-bold text-sm">بازه اول</h3>
          </div>
          <RangeControls from={from1} to={to1} onChange={(f, t) => { setFrom1(f); setTo1(t); }} compact />
        </div>
        <div className="pt-3 border-t border-border/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-sm bg-amber-500" />
            <h3 className="font-bold text-sm">بازه دوم</h3>
          </div>
          <RangeControls from={from2} to={to2} onChange={(f, t) => { setFrom2(f); setTo2(t); }} compact />
        </div>
        <div className="pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            مقایسه {fmtShamsiDate(from1)} تا {fmtShamsiDate(to1)} با {fmtShamsiDate(from2)} تا {fmtShamsiDate(to2)}
          </p>
          <div className="flex gap-2">
            <Button onClick={load} disabled={loading} size="sm" variant="outline" className="rounded-xl gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
              مقایسه
            </Button>
            <AiAnalyzeButton mode="compare" disabled={!data} buildPayload={() => ({ range1: ranges?.range1, range2: ranges?.range2, diffs, daily: daily.slice(-30) })} />
          </div>
        </div>
      </Card>

      {err && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{err}</div>}

      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      )}

      {data && ranges && (
        <>
          {/* Diff cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <DiffCard label="درآمد (تومان)" diff={diffs.revenue} curr={ranges.range2.revenue} prev={ranges.range1.revenue} />
            <DiffCard label="تعداد پرداخت" diff={diffs.payments} curr={ranges.range2.payments} prev={ranges.range1.payments} />
            <DiffCard label="کاربر جدید" diff={diffs.newUsers} curr={ranges.range2.newUsers} prev={ranges.range1.newUsers} />
            <DiffCard label="میانگین سبد (تومان)" diff={diffs.avgTicket} curr={ranges.range2.avgTicket} prev={ranges.range1.avgTicket} />
          </div>

          {/* Side-by-side bar chart */}
          <Card className="p-4 glass">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> مقایسه روزانه درآمد</h3>
            {daily.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">داده‌ای برای مقایسه نیست</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={daily.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => toPersianDigits(formatToman(v))} width={70} />
                  <Tooltip formatter={(v: any) => `${toPersianDigits(formatToman(Number(v)))} ت`} contentStyle={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 12, fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="range1" name="بازه اول" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="range2" name="بازه دوم" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Range summary cards */}
          <div className="grid md:grid-cols-2 gap-3">
            <Card className="p-3 glass">
              <h4 className="font-bold text-xs mb-2 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" />بازه اول</h4>
              <p className="text-[11px] text-muted-foreground">{fmtShamsiDate(ranges.range1.from)} تا {fmtShamsiDate(ranges.range1.to)}</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div><span className="text-muted-foreground">درآمد:</span> <span className="font-bold font-stat">{toPersianDigits(formatToman(ranges.range1.revenue))} ت</span></div>
                <div><span className="text-muted-foreground">پرداخت:</span> <span className="font-bold">{toPersianDigits(ranges.range1.payments)}</span></div>
                <div><span className="text-muted-foreground">کاربر جدید:</span> <span className="font-bold">{toPersianDigits(ranges.range1.newUsers)}</span></div>
                <div><span className="text-muted-foreground">میانگین سبد:</span> <span className="font-bold font-stat">{toPersianDigits(formatToman(ranges.range1.avgTicket))} ت</span></div>
              </div>
            </Card>
            <Card className="p-3 glass">
              <h4 className="font-bold text-xs mb-2 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />بازه دوم</h4>
              <p className="text-[11px] text-muted-foreground">{fmtShamsiDate(ranges.range2.from)} تا {fmtShamsiDate(ranges.range2.to)}</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div><span className="text-muted-foreground">درآمد:</span> <span className="font-bold font-stat">{toPersianDigits(formatToman(ranges.range2.revenue))} ت</span></div>
                <div><span className="text-muted-foreground">پرداخت:</span> <span className="font-bold">{toPersianDigits(ranges.range2.payments)}</span></div>
                <div><span className="text-muted-foreground">کاربر جدید:</span> <span className="font-bold">{toPersianDigits(ranges.range2.newUsers)}</span></div>
                <div><span className="text-muted-foreground">میانگین سبد:</span> <span className="font-bold font-stat">{toPersianDigits(formatToman(ranges.range2.avgTicket))} ت</span></div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ─── سابتَب ۴: جدول جزئیات ───
function DetailsSubtab() {
  const [inner, setInner] = useState<"payments" | "subscriptions" | "wallet">("payments");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 p-1 rounded-2xl glass">
        {[
          { id: "payments", label: "پرداخت‌ها", icon: Wallet },
          { id: "subscriptions", label: "اشتراک‌ها", icon: Crown },
          { id: "wallet", label: "تراکنش‌های کیف پول", icon: ListChecks },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setInner(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
              inner === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {inner === "payments" && <PaymentsDetailsTable />}
      {inner === "subscriptions" && <SubscriptionsDetailsTable />}
      {inner === "wallet" && <WalletDetailsTable />}
    </div>
  );
}

function PaymentsDetailsTable() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const pageSize = 15;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (plan) params.set("plan", plan);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/accounting/payments?${params}`, { cache: "no-store" });
      const d = await res.json();
      setRows(d.payments || []);
      setTotalPages(d.totalPages || 1);
      setTotal(d.total || 0);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, plan, status, from, to, page]);

  async function exportCsv() {
    try {
      toast.success("در حال آماده‌سازی فایل CSV...");
      const params = new URLSearchParams({ export: "csv", pageSize: "5000" });
      if (search) params.set("search", search);
      if (plan) params.set("plan", plan);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/accounting/payments?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fitap-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("خطا در خروجی CSV"); }
  }

  const STATUS_LABELS: Record<string, string> = {
    success: "موفق",
    failed: "ناموفق",
    pending: "در انتظار",
    verifying: "در حال پردازش",
    cancelled: "لغو شده",
    refunded: "مسترد شده",
    manual_resolved: "رسیدگی دستی (قدیمی)",
    expired: "منقضی — پرداخت‌نشده",
  };
  const STATUS_COLORS: Record<string, string> = {
    success: "text-emerald-500",
    failed: "text-red-500",
    pending: "text-amber-500",
    verifying: "text-sky-500",
    cancelled: "text-muted-foreground",
    refunded: "text-violet-500",
    manual_resolved: "text-slate-500",
    expired: "text-rose-400",
  };

  // ─── بازیابی پرداخت معلق (باگ «در انتظار») ───
  // استعلام زرین‌پال + تحویل خودکار پلن؛ برای ردیف‌های pending/verifying.
  // ردیف‌های بسته‌شده (manual_resolved/expired) فقط با تأییدیه صریح ادمین —
  // چون manual_resolved یعنی قبلاً «دستی» تعیین‌تکلیف شده و تحویل مجدد ممکن است
  // اشتراک تکراری بسازد.
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  async function recoverPayment(paymentId: string, closedLegacy = false) {
    if (closedLegacy) {
      const ok = window.confirm(
        "این پرداخت قدیمی/منقضی است و ممکن است قبلاً دستی فعال شده باشد.\nبازیابی مجدد = استعلام زرین‌پال و تحویل پلن در صورت پرداخت واقعی. ادامه می‌دهید؟"
      );
      if (!ok) return;
    }
    setRecoveringId(paymentId);
    try {
      const res = await fetch("/api/payment/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "خطا در بازیابی");
      const r = d.results?.[0];
      if (r?.recovered) {
        toast.success("پرداخت بازیابی و پلن کاربر فعال شد ✅");
      } else {
        toast.info(r?.message || "پرداخت هنوز توسط زرین‌پال تایید نشده است — بعداً دوباره تلاش کنید");
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در بازیابی");
    } finally {
      setRecoveringId(null);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-3 glass space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="جستجو نام کاربر / کد پیگیری / Authority..." className="pr-10 rounded-xl glass h-9" />
          </div>
          <Select value={plan || "all"} onValueChange={(v) => { setPlan(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[120px] rounded-xl glass h-9"><SelectValue placeholder="پلن" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه پلن‌ها</SelectItem>
              <SelectItem value="basic">اقتصادی</SelectItem>
              <SelectItem value="standard">استاندارد</SelectItem>
              <SelectItem value="advanced">پیشرفته</SelectItem>
              <SelectItem value="ultimate">حرفه‌ای</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[120px] rounded-xl glass h-9"><SelectValue placeholder="وضعیت" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="success">موفق</SelectItem>
              <SelectItem value="pending">در انتظار</SelectItem>
              <SelectItem value="verifying">در حال پردازش</SelectItem>
              <SelectItem value="failed">ناموفق</SelectItem>
              <SelectItem value="cancelled">لغو شده</SelectItem>
              <SelectItem value="refunded">مسترد شده</SelectItem>
              <SelectItem value="manual_resolved">رسیدگی دستی (قدیمی)</SelectItem>
              <SelectItem value="expired">منقضی — پرداخت‌نشده</SelectItem>
            </SelectContent>
          </Select>
          <PersianDatePicker value={from} onChange={(v) => { setFrom(v); setPage(1); }} placeholder="از تاریخ" className="w-[150px]" />
          <PersianDatePicker value={to} onChange={(v) => { setTo(v); setPage(1); }} placeholder="تا تاریخ" className="w-[150px]" />
          <Button onClick={exportCsv} variant="outline" size="sm" className="rounded-xl gap-1.5 h-9">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <AiAnalyzeButton
            mode="details"
            buildPayload={() => ({
              table: "payments",
              filters: { search, plan, status, from, to },
              total,
              sample: rows.slice(0, 20).map((r) => ({ amount: r.amount, plan: r.plan, status: r.status, paymentMethod: r.paymentMethod, createdAt: r.createdAt })),
            })}
          />
        </div>
      </Card>

      <Card className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">کاربر</th>
                <th className="text-right p-3 font-bold">مبلغ</th>
                <th className="text-right p-3 font-bold">پلن</th>
                <th className="text-right p-3 font-bold">تاریخ شمسی</th>
                <th className="text-right p-3 font-bold">وضعیت</th>
                <th className="text-right p-3 font-bold">اقدام</th>
                <th className="text-right p-3 font-bold hidden md:table-cell">کد پیگیری</th>
                <th className="text-right p-3 font-bold hidden lg:table-cell">روش</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3].map(i => <tr key={i}><td colSpan={8}><Skeleton className="h-12 m-1" /></td></tr>) :
               rows.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">پرداختی یافت نشد</td></tr> :
               rows.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <p className="text-sm font-medium">{p.userName || "—"}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{p.userMobile}</p>
                  </td>
                  <td className="p-3 font-stat text-sm font-bold">{toPersianDigits(formatToman(p.amount))} ت</td>
                  <td className="p-3">
                    <Badge className="text-[9px]" style={{ background: `${PLAN_COLORS[p.plan]}22`, color: PLAN_COLORS[p.plan] }}>{PLAN_LABELS[p.plan as Plan] || p.plan}</Badge>
                  </td>
                  <td className="p-3 text-[11px] text-muted-foreground">{fmtShamsiDateTime(p.createdAt)}</td>
                  <td className="p-3"><span className={`text-xs font-bold ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status] || p.status}</span></td>
                  <td className="p-3">
                    {(p.status === "pending" || p.status === "verifying") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={recoveringId === p.id}
                        onClick={() => recoverPayment(p.id)}
                        className="rounded-lg h-7 text-[11px] gap-1"
                        title="استعلام زرین‌پال و تحویل خودکار پلن در صورت پرداخت"
                      >
                        {recoveringId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        بازیابی
                      </Button>
                    )}
                    {(p.status === "manual_resolved" || p.status === "expired") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={recoveringId === p.id}
                        onClick={() => recoverPayment(p.id, true)}
                        className="rounded-lg h-7 text-[11px] gap-1 text-muted-foreground"
                        title="بازیابی صریح (با تأیید) — استعلام زرین‌پال و تحویل در صورت پرداخت واقعی"
                      >
                        {recoveringId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                        بازیابی دستی
                      </Button>
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell text-[10px] font-mono text-muted-foreground" dir="ltr">{p.refId || p.authority?.slice(0, 12) || "—"}</td>
                  <td className="p-3 hidden lg:table-cell text-[11px]">{p.paymentMethod === "wallet" ? "کیف پول" : "درگاه"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)} (مجموع {toPersianDigits(total)})</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg h-8"><ChevronRight className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg h-8"><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function SubscriptionsDetailsTable() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const pageSize = 15;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (plan) params.set("plan", plan);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/accounting/subscriptions?${params}`, { cache: "no-store" });
      const d = await res.json();
      setRows(d.subscriptions || []);
      setTotalPages(d.totalPages || 1);
      setTotal(d.total || 0);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, plan, status, page]);

  const STATUS_LABELS: Record<string, string> = { active: "فعال", pending: "در انتظار", expired: "منقضی", cancelled: "لغو شده" };
  const STATUS_COLORS: Record<string, string> = { active: "text-emerald-500", pending: "text-amber-500", expired: "text-muted-foreground", cancelled: "text-red-500" };

  return (
    <div className="space-y-3">
      <Card className="p-3 glass">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="جستجو نام کاربر..." className="pr-10 rounded-xl glass h-9" />
          </div>
          <Select value={plan || "all"} onValueChange={(v) => { setPlan(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[120px] rounded-xl glass h-9"><SelectValue placeholder="پلن" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه پلن‌ها</SelectItem>
              <SelectItem value="basic">اقتصادی</SelectItem>
              <SelectItem value="standard">استاندارد</SelectItem>
              <SelectItem value="advanced">پیشرفته</SelectItem>
              <SelectItem value="ultimate">حرفه‌ای</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[120px] rounded-xl glass h-9"><SelectValue placeholder="وضعیت" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="pending">در انتظار</SelectItem>
              <SelectItem value="expired">منقضی</SelectItem>
              <SelectItem value="cancelled">لغو شده</SelectItem>
            </SelectContent>
          </Select>
          <AiAnalyzeButton
            mode="details"
            buildPayload={() => ({
              table: "subscriptions",
              filters: { search, plan, status },
              total,
              statusBreakdown: countBy(rows, "status"),
              planBreakdown: countBy(rows, "plan"),
            })}
          />
        </div>
      </Card>

      <Card className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">کاربر</th>
                <th className="text-right p-3 font-bold">پلن</th>
                <th className="text-right p-3 font-bold">شروع</th>
                <th className="text-right p-3 font-bold">پایان</th>
                <th className="text-right p-3 font-bold">وضعیت</th>
                <th className="text-right p-3 font-bold hidden md:table-cell">مبلغ پرداخت‌شده</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3].map(i => <tr key={i}><td colSpan={6}><Skeleton className="h-12 m-1" /></td></tr>) :
               rows.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">اشتراکی یافت نشد</td></tr> :
               rows.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <p className="text-sm font-medium">{s.userName || "—"}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{s.userMobile}</p>
                  </td>
                  <td className="p-3"><Badge className="text-[9px]" style={{ background: `${PLAN_COLORS[s.plan]}22`, color: PLAN_COLORS[s.plan] }}>{PLAN_LABELS[s.plan as Plan] || s.plan}</Badge></td>
                  <td className="p-3 text-[11px] text-muted-foreground">{fmtShamsiDate(s.startDate)}</td>
                  <td className="p-3 text-[11px] text-muted-foreground">{fmtShamsiDate(s.endDate)}</td>
                  <td className="p-3"><span className={`text-xs font-bold ${STATUS_COLORS[s.status]}`}>{STATUS_LABELS[s.status] || s.status}</span></td>
                  <td className="p-3 hidden md:table-cell text-xs font-stat">{toPersianDigits(formatToman(s.pricePaid))} ت</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)} (مجموع {toPersianDigits(total)})</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg h-8"><ChevronRight className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg h-8"><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function WalletDetailsTable() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const pageSize = 15;

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("search", search);
      if (type) params.set("type", type);
      const res = await fetch(`/api/admin/accounting/wallet?${params}`, { cache: "no-store" });
      const d = await res.json();
      setRows(d.transactions || []);
      setTotalPages(d.totalPages || 1);
      setTotal(d.total || 0);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, type, page]);

  const TYPE_LABELS: Record<string, string> = { deposit: "شارژ", purchase: "خرید", refund: "بازگشت", bonus: "پاداش" };
  const TYPE_COLORS: Record<string, string> = { deposit: "text-emerald-500", purchase: "text-red-500", refund: "text-amber-500", bonus: "text-violet-500" };

  return (
    <div className="space-y-3">
      <Card className="p-3 glass">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="جستجو نام کاربر / توضیحات..." className="pr-10 rounded-xl glass h-9" />
          </div>
          <Select value={type || "all"} onValueChange={(v) => { setType(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[130px] rounded-xl glass h-9"><SelectValue placeholder="نوع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="deposit">شارژ</SelectItem>
              <SelectItem value="purchase">خرید</SelectItem>
              <SelectItem value="refund">بازگشت</SelectItem>
              <SelectItem value="bonus">پاداش</SelectItem>
            </SelectContent>
          </Select>
          <AiAnalyzeButton
            mode="details"
            buildPayload={() => ({
              table: "wallet",
              filters: { search, type },
              total,
              typeBreakdown: countBy(rows, "type"),
              sample: rows.slice(0, 20).map((r) => ({ type: r.type, amount: r.amount, description: r.description })),
            })}
          />
        </div>
      </Card>

      <Card className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">کاربر</th>
                <th className="text-right p-3 font-bold">نوع</th>
                <th className="text-right p-3 font-bold">مبلغ</th>
                <th className="text-right p-3 font-bold hidden md:table-cell">موجودی پس از</th>
                <th className="text-right p-3 font-bold">توضیحات</th>
                <th className="text-right p-3 font-bold">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1,2,3].map(i => <tr key={i}><td colSpan={6}><Skeleton className="h-12 m-1" /></td></tr>) :
               rows.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">تراکنشی یافت نشد</td></tr> :
               rows.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <p className="text-sm font-medium">{t.userName || "—"}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{t.userMobile}</p>
                  </td>
                  <td className="p-3"><span className={`text-xs font-bold ${TYPE_COLORS[t.type]}`}>{TYPE_LABELS[t.type] || t.type}</span></td>
                  <td className="p-3 font-stat text-sm font-bold">{t.amount > 0 ? "+" : ""}{toPersianDigits(formatToman(t.amount))} ت</td>
                  <td className="p-3 hidden md:table-cell text-xs font-stat">{toPersianDigits(formatToman(t.balance))} ت</td>
                  <td className="p-3 text-[11px] text-muted-foreground max-w-[200px] truncate">{t.description || "—"}</td>
                  <td className="p-3 text-[11px] text-muted-foreground">{fmtShamsiDateTime(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)} (مجموع {toPersianDigits(total)})</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg h-8"><ChevronRight className="w-4 h-4" /></Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-lg h-8"><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function countBy(arr: any[], key: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of arr) {
    const k = String(r?.[key] ?? "unknown");
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

// ─── کامپوننت اصلی تب حسابداری ───
function AccountingTab() {
  const [subtab, setSubtab] = useState<AccountingSubtab>("overview");
  const SUBTABS: { id: AccountingSubtab; label: string; icon: any }[] = [
    { id: "overview", label: "داشبورد کلی", icon: LayoutDashboard },
    { id: "range", label: "بازه زمانی خاص", icon: CalendarRange },
    { id: "compare", label: "مقایسه دو بازه", icon: GitCompare },
    { id: "details", label: "جزئیات", icon: Table2 },
  ];
  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto">
      <Card className="p-3 glass">
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-bold text-sm">حسابداری مدیریت</h2>
            <p className="text-[11px] text-muted-foreground">تحلیل درآمد، پرداخت‌ها و تراکنش‌ها با نمودار، مقایسه بازه‌ها و تحلیل هوشمند AI</p>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {SUBTABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubtab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition ${
                subtab === t.id ? "bg-primary text-primary-foreground glow-gold-sm" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {subtab === "overview" && <OverviewSubtab />}
      {subtab === "range" && <RangeSubtab />}
      {subtab === "compare" && <CompareSubtab />}
      {subtab === "details" && <DetailsSubtab />}
    </div>
  );
}

/* ============================================================
   ۳.۶. مدیریت کدهای تخفیف
   ============================================================ */
interface DiscountCodeRow {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  maxUses: number;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  active: boolean;
  applicablePlans: string;
  createdAt: string;
}

const PLAN_OPTIONS = [
  { value: "basic", label: "اقتصادی" },
  { value: "standard", label: "استاندارد" },
  { value: "advanced", label: "پیشرفته" },
  { value: "ultimate", label: "حرفه‌ای" },
];

function planLabel(plan: string): string {
  return PLAN_OPTIONS.find((p) => p.value === plan)?.label || plan;
}

function DiscountsTab() {
  const [codes, setCodes] = useState<DiscountCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editCode, setEditCode] = useState<DiscountCodeRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DiscountCodeRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/discount-codes?${params}`, { cache: "no-store" });
      const data = await res.json();
      setCodes(data.codes || []);
    } catch {
      toast.error("خطا در بارگذاری کدها");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function toggleActive(c: DiscountCodeRow) {
    try {
      const res = await fetch(`/api/admin/discount-codes/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "خطا");
      }
      toast.success(c.active ? "کد غیرفعال شد" : "کد فعال شد");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/admin/discount-codes/${confirmDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "خطا");
      }
      toast.success("کد تخفیف حذف شد");
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  }

  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس کد..."
            className="pr-10 rounded-xl"
            dir="ltr"
          />
        </div>
        <Button onClick={() => setShowCreate(true)} className="rounded-xl gap-1.5">
          <Plus className="w-4 h-4" />
          ساخت کد تخفیف
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">کد</th>
                <th className="text-right p-3 font-bold">نوع</th>
                <th className="text-right p-3 font-bold">مقدار</th>
                <th className="text-right p-3 font-bold">پلن‌ها</th>
                <th className="text-right p-3 font-bold">استفاده</th>
                <th className="text-right p-3 font-bold hidden sm:table-cell">انقضا</th>
                <th className="text-center p-3 font-bold">فعال</th>
                <th className="text-center p-3 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}><td colSpan={8}><Skeleton className="h-12 m-1" /></td></tr>
                ))
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    کد تخفیفی ثبت نشده است. روی «ساخت کد تخفیف» بزنید.
                  </td>
                </tr>
              ) : codes.map((c) => {
                const expired = c.validUntil && new Date(c.validUntil) < new Date();
                const exhausted = c.maxUses !== -1 && c.usedCount >= c.maxUses;
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-mono font-bold text-sm" dir="ltr">{c.code}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">
                        {c.type === "percent" ? "درصدی" : "مبلغی"}
                      </Badge>
                    </td>
                    <td className="p-3 font-stat">
                      {c.type === "percent"
                        ? `${toPersianDigits(c.value)}٪`
                        : `${toPersianDigits(formatToman(c.value))} ت`}
                    </td>
                    <td className="p-3 text-xs">
                      {c.applicablePlans === "all"
                        ? "همه پلن‌ها"
                        : c.applicablePlans.split(",").map((p) => planLabel(p.trim())).filter(Boolean).join("، ")}
                    </td>
                    <td className="p-3 text-xs">
                      <span className="font-stat">{toPersianDigits(c.usedCount)}</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="font-stat text-muted-foreground">
                        {c.maxUses === -1 ? "∞" : toPersianDigits(c.maxUses)}
                      </span>
                      {exhausted && (
                        <Badge variant="outline" className="text-[9px] mr-1 text-red-600 border-red-200">
                          تکمیل
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 hidden sm:table-cell text-[11px]">
                      {c.validUntil ? (
                        <span className={expired ? "text-red-600" : "text-muted-foreground"}>
                          {new Date(c.validUntil).toLocaleDateString("fa-IR")}
                          {expired && " (منقضی)"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        <Switch
                          checked={c.active}
                          onCheckedChange={() => toggleActive(c)}
                          disabled={expired || exhausted}
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditCode(c)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition"
                          title="ویرایش"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(c)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {(showCreate || editCode) && (
        <DiscountCodeEditorDialog
          code={editCode}
          onClose={() => { setShowCreate(false); setEditCode(null); }}
          onSaved={() => { setShowCreate(false); setEditCode(null); load(); }}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent dir="rtl" className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                حذف کد تخفیف
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              آیا از حذف کد <b className="font-mono text-foreground" dir="ltr">{confirmDelete.code}</b> مطمئن هستید؟
              این عمل قابل بازگشت نیست. در صورت نیاز می‌توانید فقط کد را غیرفعال کنید.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)} className="rounded-xl">انصراف</Button>
              <Button variant="destructive" onClick={doDelete} className="rounded-xl gap-1.5">
                <Trash2 className="w-4 h-4" />
                حذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DiscountCodeEditorDialog({
  code,
  onClose,
  onSaved,
}: {
  code: DiscountCodeRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!code;
  const [codeValue, setCodeValue] = useState(code?.code ?? "");
  const [type, setType] = useState<"percent" | "fixed">(code?.type ?? "percent");
  const [value, setValue] = useState<string>(code ? String(code.value) : "");
  const [maxUses, setMaxUses] = useState<string>(
    code ? (code.maxUses === -1 ? "" : String(code.maxUses)) : ""
  );
  const [validUntil, setValidUntil] = useState<string>(
    code?.validUntil ?? ""
  );
  const [active, setActive] = useState<boolean>(code?.active ?? true);
  // applicablePlans: "all" یا لیست جدا شده با کاما (مثلاً "advanced,ultimate")
  // برای UI: اگر "all" باشد، هیچ چک‌باکسی تیک نخورده است. در غیر این صورت، پلن‌های
  // انتخاب‌شده تیک می‌خورند. اگر کاربر هیچ پلنی انتخاب نکند، "all" ذخیره می‌شود.
  const initialSelectedPlans = code?.applicablePlans && code.applicablePlans !== "all"
    ? code.applicablePlans.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const [selectedPlans, setSelectedPlans] = useState<string[]>(initialSelectedPlans);
  const [saving, setSaving] = useState(false);

  function togglePlan(planValue: string) {
    setSelectedPlans((prev) =>
      prev.includes(planValue)
        ? prev.filter((p) => p !== planValue)
        : [...prev, planValue]
    );
  }

  async function save() {
    const trimmed = codeValue.trim();
    if (!trimmed) {
      toast.error("کد را وارد کنید");
      return;
    }
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("مقدار تخفیف نامعتبر است");
      return;
    }
    if (type === "percent" && v > 100) {
      toast.error("درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد");
      return;
    }
    setSaving(true);
    try {
      // اگر هیچ پلنی انتخاب نشده باشد، "all" ذخیره می‌شود.
      const finalApplicablePlans = selectedPlans.length === 0 ? "all" : selectedPlans.join(",");
      const body: any = {
        code: trimmed,
        type,
        value: v,
        maxUses: maxUses === "" ? -1 : Math.floor(Number(maxUses)),
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        active,
        applicablePlans: finalApplicablePlans,
      };
      const res = isEdit
        ? await fetch(`/api/admin/discount-codes/${code!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/discount-codes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "خطا در ذخیره");
      toast.success(isEdit ? "کد به‌روزرسانی شد" : "کد تخفیف ساخته شد");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-amber-500" />
            {isEdit ? "ویرایش کد تخفیف" : "ساخت کد تخفیف جدید"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">کد تخفیف *</Label>
            <Input
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value.toUpperCase())}
              placeholder="مثلاً: SUMMER1403"
              className="rounded-xl font-mono"
              dir="ltr"
              maxLength={40}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              حروف بزرگ انگلیسی، عدد، خط تیره و زیرخط. حداقل ۳ کاراکتر.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block">نوع تخفیف</Label>
              <Select value={type} onValueChange={(v) => setType(v as "percent" | "fixed")}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">درصدی (٪)</SelectItem>
                  <SelectItem value="fixed">مبلغ ثابت (تومان)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">مقدار *</Label>
              <Input
                type="number"
                dir="ltr"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "percent" ? "20" : "100000"}
                className="rounded-xl text-center font-stat"
              />
              {type === "percent" && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  می‌توانید تا ۱۰۰٪ وارد کنید (تخفیف کامل).
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block">حداکثر استفاده</Label>
              <Input
                type="number"
                dir="ltr"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="خالی = نامحدود"
                className="rounded-xl text-center font-stat"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                خالی = نامحدود، ۱ = یک‌بار مصرف، ...
              </p>
            </div>
            <div>
              <Label className="mb-1 block">تاریخ انقضا (شمسی)</Label>
              <PersianDatePicker
                value={validUntil || null}
                onChange={(iso) => setValidUntil(iso ?? "")}
                placeholder="انتخاب تاریخ..."
                className="w-full"
              />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">پلن‌های قابل اعمال (چندانتخابی)</Label>
            <div className="space-y-1.5 p-2.5 rounded-xl bg-muted/40">
              <p className="text-[10px] text-muted-foreground mb-1">
                اگر هیچ پلنی انتخاب نشود، کد برای همه پلن‌ها قابل استفاده است.
              </p>
              {PLAN_OPTIONS.map((p) => (
                <label
                  key={p.value}
                  className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-background transition"
                >
                  <Checkbox
                    checked={selectedPlans.includes(p.value)}
                    onCheckedChange={() => togglePlan(p.value)}
                  />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
            <div>
              <Label className="block">فعال</Label>
              <span className="text-[10px] text-muted-foreground">کد غیرفعال در زمان خرید قابل استفاده نیست.</span>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button onClick={save} disabled={saving} className="rounded-xl gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? "ذخیره تغییرات" : "ساخت کد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ۴. صف برنامه‌ها
   ============================================================ */
function ProgramsTab() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/programs?${params}`, { cache: "no-store" });
      const data = await res.json();
      setPrograms(data.programs || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function updateStatus(programId: string, status: string) {
    try {
      const res = await fetch("/api/admin/programs", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, status }),
      });
      if (!res.ok) throw new Error();
      toast.success("وضعیت برنامه به‌روزرسانی شد");
      load();
    } catch { toast.error("خطا"); }
  }

  const STATUS_LABELS: Record<string, string> = { pending: "در انتظار تولید", generating: "در حال تولید", ready: "آماده", failed: "ناموفق" };
  const STATUS_ICONS: Record<string, any> = { pending: Clock, generating: Loader2, ready: CheckCircle2, failed: AlertTriangle };
  const STATUS_COLORS: Record<string, string> = { pending: "text-amber-500", generating: "text-cyan-500", ready: "text-emerald-500", failed: "text-red-500" };

  return (
    <div className="p-4 space-y-3 max-w-5xl mx-auto">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "pending", label: "در انتظار تولید" },
          { id: "generating", label: "در حال تولید" },
          { id: "ready", label: "آماده" },
          { id: "failed", label: "ناموفق" },
          { id: "all", label: "همه" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              statusFilter === f.id ? "bg-primary text-primary-foreground glow-gold-sm" : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Program cards */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : programs.length === 0 ? (
        <Card className="p-8 text-center glass">
          <ListChecks className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">برنامه‌ای در این وضعیت موجود نیست</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {programs.map((p) => {
            const StatusIcon = STATUS_ICONS[p.status] || Clock;
            const isVip = p.plan === "ultimate";
            return (
              <Card key={p.id} className={`p-4 glass ${isVip ? "border-violet-500/30" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${PLAN_COLORS[p.plan]}20` }}>
                      <Crown className="w-5 h-5" style={{ color: PLAN_COLORS[p.plan] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-sm truncate">{p.userName || "—"}</p>
                        <Badge className="text-[9px]" style={{ background: `${PLAN_COLORS[p.plan]}20`, color: PLAN_COLORS[p.plan] }}>{PLAN_LABELS[p.plan as Plan] || p.plan}</Badge>
                        {isVip && <Badge className="bg-violet-500/15 text-violet-500 text-[9px]">VIP</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground" dir="ltr">{p.userMobile}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusIcon className={`w-3.5 h-3.5 ${STATUS_COLORS[p.status]} ${p.status === "generating" ? "animate-spin" : ""}`} />
                        <span className={`text-xs font-bold ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                        <span className="text-[10px] text-muted-foreground">• {new Date(p.createdAt).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.status === "pending" && (
                      <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={() => updateStatus(p.id, "generating")}>
                        شروع تولید
                      </Button>
                    )}
                    {p.status === "generating" && (
                      <Button size="sm" className="rounded-lg text-xs h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatus(p.id, "ready")}>
                        <Check className="w-3.5 h-3.5" /> تایید
                      </Button>
                    )}
                    {p.status === "pending" && (
                      <Button size="sm" variant="ghost" className="rounded-lg text-xs h-8 text-destructive" onClick={() => updateStatus(p.id, "failed")}>
                        رد
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ۵. مقالات — Article CMS
   ============================================================ */
interface ArticleRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string;
  status: "draft" | "published";
  coverImage: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  // SEO fields
  seoTitle?: string;
  seoDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  robots?: string;
  readingMinutes?: number;
  // Scheduled publish date (ISO Gregorian string, null if not scheduled)
  scheduledAt?: string | null;
  // تاریخ انتشار واقعی مقاله (ISO Gregorian string) — زمانی که از draft به published تبدیل شد.
  // برای نمایش به کاربر و JSON-LD datePublished استفاده می‌شود. null برای draftها.
  publishedAt?: string | null;
  // SEO agent metadata (only attached when include_seo=true)
  isSeo?: boolean;
  seoKeyword?: string;
  seoCoverImagePrompt?: string;
}

/* ============================================================
   ۴.۵. چکاپ‌ها — بررسی مربی / ادمین
   ============================================================ */
function CheckupsTab() {
  const [checkups, setCheckups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeCheckup, setActiveCheckup] = useState<any | null>(null);
  const [coachNotes, setCoachNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/checkup?${params}`, { cache: "no-store" });
      const data = await res.json();
      setCheckups(data.checkups || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function openReview(c: any) {
    setActiveCheckup(c);
    setCoachNotes(c.coachNotes ?? "");
    setReviewOpen(true);
  }

  async function submitReview(markCompleted: boolean) {
    if (!activeCheckup) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/checkup/${activeCheckup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachNotes,
          status: markCompleted ? "completed" : "pending_coach",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(markCompleted ? "چکاپ تأیید شد و به ورزشکار اطلاع داده شد." : "یادداشت ذخیره شد.");
      setReviewOpen(false);
      setActiveCheckup(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h3 className="font-bold">چکاپ‌های دوره‌ای ورزشکاران</h3>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 rounded-xl">
            <SelectValue placeholder="همه وضعیت‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            <SelectItem value="pending_coach">در انتظار مربی</SelectItem>
            <SelectItem value="completed">تأیید شده</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : checkups.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">چکاپی یافت نشد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {checkups.map((c) => (
            <Card key={c.id} className="p-4 glass">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">فاز {toPersianDigits(c.phaseNumber)}</span>
                    {c.isFinalCheckup && <span className="text-[10px] text-amber-600">نهایی</span>}
                    {c.user?.name || c.user?.mobile}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {c.status === "completed" ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">تأیید شده</Badge>
                ) : (
                  <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20">در انتظار</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-2">
                <div className="rounded-lg bg-muted/40 p-1.5">
                  <p className="text-muted-foreground">وزن</p>
                  <p className="font-bold">{toPersianDigits(c.weight)} kg</p>
                </div>
                {c.bodyFatPercent != null && (
                  <div className="rounded-lg bg-muted/40 p-1.5">
                    <p className="text-muted-foreground">چربی</p>
                    <p className="font-bold">{toPersianDigits(c.bodyFatPercent)}٪</p>
                  </div>
                )}
                {c.aiAnalysis && (
                  <div className="rounded-lg bg-primary/10 p-1.5">
                    <p className="text-muted-foreground">امتیاز</p>
                    <p className="font-bold text-primary">{toPersianDigits(c.aiAnalysis.bodyScore)}/۱۰۰</p>
                  </div>
                )}
              </div>
              {c.notes && (
                <p className="text-[11px] text-muted-foreground bg-muted/30 rounded p-2 mb-2 line-clamp-2">{c.notes}</p>
              )}
              <Button size="sm" variant="outline" className="w-full rounded-xl text-xs" onClick={() => openReview(c)}>
                <Eye className="w-3.5 h-3.5" /> بررسی و یادداشت مربی
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <ClipboardCheck className="w-5 h-5 text-orange-500" />
              بررسی چکاپ فاز {activeCheckup ? toPersianDigits(activeCheckup.phaseNumber) : ""}
            </DialogTitle>
          </DialogHeader>
          {activeCheckup && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-xs text-slate-500 mb-1">ورزشکار</p>
                <p className="font-bold">{activeCheckup.user?.name || "—"} • {activeCheckup.user?.mobile}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">وزن</p><p className="font-bold">{toPersianDigits(activeCheckup.weight)} kg</p></div>
                {activeCheckup.bodyFatPercent != null && <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">چربی</p><p className="font-bold">{toPersianDigits(activeCheckup.bodyFatPercent)}٪</p></div>}
                {activeCheckup.leanBodyMass != null && <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">LBM</p><p className="font-bold">{toPersianDigits(activeCheckup.leanBodyMass)} kg</p></div>}
                {activeCheckup.waistMeasurement != null && <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">کمر</p><p className="font-bold">{toPersianDigits(activeCheckup.waistMeasurement)}</p></div>}
                {activeCheckup.armMeasurement != null && <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">بازو</p><p className="font-bold">{toPersianDigits(activeCheckup.armMeasurement)}</p></div>}
                {activeCheckup.chestMeasurement != null && <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">سینه</p><p className="font-bold">{toPersianDigits(activeCheckup.chestMeasurement)}</p></div>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">پیروی تمرین</p><p className="font-bold">{toPersianDigits(activeCheckup.workoutAdherence)}/۵</p></div>
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">پیروی رژیم</p><p className="font-bold">{toPersianDigits(activeCheckup.dietAdherence)}/۵</p></div>
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">کیفیت خواب</p><p className="font-bold">{toPersianDigits(activeCheckup.sleepQuality)}/۵</p></div>
                <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">خستگی</p><p className="font-bold">{toPersianDigits(activeCheckup.fatigueLevel)}/۵</p></div>
              </div>
              {activeCheckup.notes && (
                <div className="rounded-xl bg-amber-50 p-3 text-xs border border-amber-200">
                  <p className="text-amber-700 font-bold mb-1">یادداشت ورزشکار:</p>
                  <p className="text-slate-700">{activeCheckup.notes}</p>
                </div>
              )}
              {activeCheckup.aiAnalysis && (
                <div className="rounded-xl bg-white p-3 border-2 border-orange-200">
                  <p className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1">
                    <Brain className="w-3.5 h-3.5 text-orange-500" /> تحلیل هوش مصنوعی (امتیاز: {toPersianDigits(activeCheckup.aiAnalysis.bodyScore)}/۱۰۰)
                  </p>
                  <p className="text-[11px] text-slate-700 leading-relaxed">{activeCheckup.aiAnalysis.analysis}</p>
                  {activeCheckup.aiAnalysis.recommendations?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {activeCheckup.aiAnalysis.recommendations.map((r: string, i: number) => (
                        <li key={i} className="text-[11px] text-slate-600">• {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div>
                <Label className="mb-1.5 block text-sm text-slate-700">یادداشت مربی</Label>
                <Textarea
                  value={coachNotes}
                  onChange={(e) => setCoachNotes(e.target.value)}
                  placeholder="بازخورد، توصیه‌ها، یا تأیید چکاپ..."
                  rows={4}
                  className="rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={saving}>بستن</Button>
            <Button
              variant="outline"
              onClick={() => submitReview(false)}
              disabled={saving}
              className="rounded-xl"
            >
              ذخیره یادداشت
            </Button>
            <Button
              onClick={() => submitReview(true)}
              disabled={saving}
              className="rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              تأیید و اطلاع به ورزشکار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArticlesTab() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<ArticleRow | null>(null);
  // Per-article rebuild loading state — slug → boolean
  const [rebuilding, setRebuilding] = useState<Record<string, boolean>>({});
  // اعمال واترمارک به همه تصاویر (دکمه در نوار ابزار)
  const [watermarking, setWatermarking] = useState(false);
  // تعمیر خودکار تصاویر مفقود همه مقالات (کاور + inline)
  const [repairingMedia, setRepairingMedia] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // مهم: همیشه status=all می‌فرستیم تا هم مقالات منتشرشده و هم پیش‌نویس‌ها
      // (از جمله مقالات زمان‌بندی‌شده‌ی سئو) در لیست ظاهر شوند. include_seo=true
      // هم برای نمایش بج سئو و دکمه بازسازی تصاویر لازم است.
      const params = new URLSearchParams({ pageSize: "100", status: "all", include_seo: "true" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/articles?${params}`, { cache: "no-store" });
      const data = await res.json();
      setArticles(data.articles || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, categoryFilter]);

  async function deleteArticle(article: ArticleRow) {
    if (!confirm(`حذف مقاله «${article.title}»؟`)) return;
    try {
      const res = await fetch(`/api/articles/${article.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("مقاله حذف شد");
      load();
    } catch { toast.error("خطا در حذف"); }
  }

  async function toggleStatus(article: ArticleRow) {
    const newStatus = article.status === "published" ? "draft" : "published";
    try {
      // When publishing immediately, clear any scheduled date (they are mutually exclusive).
      // When reverting to draft, leave scheduledAt alone (a scheduled draft is still a draft).
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === "published" && article.scheduledAt) {
        payload.scheduledAt = null;
      }
      const res = await fetch(`/api/articles/${article.slug}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === "published" ? "مقاله منتشر شد" : "مقاله پیش‌نویس شد");
      load();
    } catch { toast.error("خطا"); }
  }

  /**
   * بازسازی تصاویر مقاله:
   *  - همیشه کاور جدید تولید می‌کند (حتی اگر کاور موجود باشد)
   *  - تصاویر داخل متن بدون URL یا alt، تولید/اصلاح می‌شوند
   *  - alt text فارسی حاوی کلمه کلیدی تنظیم می‌شود
   *  - برای همه مقالات (نه فقط سئو) قابل استفاده است
   */
  async function rebuildImages(article: ArticleRow) {
    const confirmMsg = `بازسازی تمام تصاویر مقاله «${article.title}»؟\n\n— کاور جدید تولید می‌شود (حتی اگر موجود باشد).\n— تصاویر داخل متن تولید/اصلاح می‌شوند.\n— alt text فارسی حاوی کلمه کلیدی تنظیم می‌شود.`;
    if (!confirm(confirmMsg)) return;
    setRebuilding((s) => ({ ...s, [article.slug]: true }));
    try {
      const res = await fetch(`/api/articles/${article.slug}/rebuild-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در بازسازی تصاویر");
      const parts: string[] = [];
      if (data.inlineRebuilt > 0) parts.push(`${toPersianDigits(data.inlineRebuilt)} تصویر داخل متن تولید شد`);
      if (data.altFixed > 0) parts.push(`${toPersianDigits(data.altFixed)} alt text اصلاح شد`);
      if (data.coverImage) parts.push("کاور جدید تولید شد");
      toast.success(`بازسازی تصاویر کامل شد${parts.length ? " — " + parts.join("، ") : ""}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "خطا در بازسازی تصاویر");
    } finally {
      setRebuilding((s) => {
        const next = { ...s };
        delete next[article.slug];
        return next;
      });
    }
  }

  /**
   * تعمیر خودکار رسانه همه مقالات (کاور + inline):
   *  ۱. اول اسکن سریع (بدون تغییر) — تعداد مسائل به ادمین نشان داده می‌شود
   *  ۲. بعد از تأیید، ترمیم کامل در پس‌زمینه شروع می‌شود
   *     (تصاویر مفقود با AI تولید می‌شوند؛ ترمیم idempotent است)
   */
  async function repairAllMedia() {
    if (repairingMedia) return;
    setRepairingMedia(true);
    try {
      toast.info("در حال اسکن تصاویر مقالات...");
      const scanRes = await fetch("/api/admin/repair-article-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanOnly: true }),
      });
      const scan = await scanRes.json();
      if (!scanRes.ok) throw new Error(scan.error || "خطا در اسکن");
      const s = scan.stats;
      if (!s || s.articlesWithIssues === 0) {
        toast.success(`همه تصاویر مقالات سالم هستند ✓ (${toPersianDigits(s?.totalArticles ?? "?")} مقاله بررسی شد)`);
        return;
      }
      const msg =
        `${toPersianDigits(s.articlesWithIssues)} مقاله نیاز به ترمیم دارد:\n` +
        `• ${toPersianDigits(s.coversMissing)} کاور مفقود\n` +
        `• ${toPersianDigits(s.brokenInlineRefs)} تصویر داخل متن مفقود\n` +
        `• ${toPersianDigits(s.articlesWithoutInlines)} مقاله بدون تصویر داخل متن\n\n` +
        `تصاویر مفقود با هوش مصنوعی تولید و ذخیره می‌شوند. شروع ترمیم؟`;
      if (!confirm(msg)) return;
      const res = await fetch("/api/admin/repair-article-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در شروع ترمیم");
      toast.success("ترمیم تصاویر در پس‌زمینه شروع شد — بعد از چند دقیقه دوباره «بررسی سلامت» را بزنید");
    } catch (e: any) {
      toast.error(e.message || "خطا در ترمیر تصاویر");
    } finally {
      setRepairingMedia(false);
    }
  }

  return (
    <div className="p-4 space-y-3 max-w-7xl mx-auto">
      {/* Filters + create */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی عنوان یا تگ..." className="pr-10 rounded-xl glass" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] rounded-xl glass"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            <SelectItem value="published">منتشر شده</SelectItem>
            <SelectItem value="draft">پیش‌نویس</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[120px] rounded-xl glass"><SelectValue placeholder="دسته" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌ها</SelectItem>
            {ARTICLE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditArticle(null); setEditorOpen(true); }} className="rounded-xl gap-1.5 bg-primary text-primary-foreground glow-gold-sm">
          <Plus className="w-4 h-4" /> مقاله جدید
        </Button>
        <Button
          variant="outline"
          className="rounded-xl glass gap-1.5"
          onClick={async () => {
            try {
              const params = new URLSearchParams();
              if (statusFilter !== "all") params.set("status", statusFilter);
              toast.success("در حال آماده‌سازی فایل اکسل...");
              const res = await fetch(`/api/articles/export?${params}`, { cache: "no-store" });
              if (!res.ok) throw new Error();
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `fitap-articles-${new Date().toISOString().slice(0, 10)}.xlsx`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              toast.success("فایل اکسل دانلود شد");
            } catch { toast.error("خطا در دانلود فایل"); }
          }}
        >
          <Download className="w-4 h-4" /> دانلود همه
        </Button>
        <Button
          variant="outline"
          className="rounded-xl glass gap-1.5"
          onClick={async () => {
            try {
              toast.info("در حال بررسی سلامت مقالات...");
              const res = await fetch("/api/articles/health", { cache: "no-store" });
              if (!res.ok) throw new Error();
              const data = await res.json();
              if (data.status === "healthy") {
                toast.success(`سلامت مقالات: ✓ همه چیز خوب است (${data.totalArticles} مقاله، ${data.totalImages} تصویر)`);
              } else {
                const parts: string[] = [];
                if (data.missingImagesCount > 0) parts.push(`${data.missingImagesCount} تصویر مفقود`);
                if (data.issuesCount > 0) parts.push(`${data.issuesCount} مشکل دیگر`);
                toast.error(`مشکلات یافت شد: ${parts.join("، ")} — برای جزئیات کنسول را ببینید`);
                console.log("=== ARTICLE HEALTH REPORT ===");
                console.log("Status:", data.status);
                console.log("Total articles:", data.totalArticles);
                console.log("Total images:", data.totalImages);
                console.log("Missing images:", data.missingImages);
                console.log("Other issues:", data.issues);
                console.log("Uploads dir exists:", data.checks.uploadsDirExists);
                console.log("Uploads dir path:", data.checks.uploadsDirPath);
                console.log("CWD:", data.checks.cwd);
              }
            } catch { toast.error("خطا در بررسی سلامت مقالات"); }
          }}
        >
          <Activity className="w-4 h-4" /> بررسی سلامت
        </Button>
        <Button
          variant="outline"
          className="rounded-xl glass gap-1.5"
          disabled={repairingMedia}
          onClick={repairAllMedia}
        >
          {repairingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          {repairingMedia ? "در حال اسکن..." : "تعمیر تصاویر"}
        </Button>
        <Button
          variant="outline"
          className="rounded-xl glass gap-1.5"
          disabled={watermarking}
          onClick={async () => {
            if (!confirm("اعمال واترمارک FitUp به همه تصاویر مقالات؟\n\nاین عملیات تصاویری که واترمارک ندارند را پیدا کرده و واترمارک FitUp را به آن‌ها اضافه می‌کند. تصاویری که از قبل واترمارک دارند، دست‌نخورده باقی می‌مانند.\n\nممکن است چند دقیقه طول بکشد.")) return;
            setWatermarking(true);
            try {
              toast.info("در حال اعمال واترمارک به تصاویر...");
              const res = await fetch("/api/admin/watermark-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: 500 }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "خطا در اعمال واترمارک");
              toast.success(data.message || `پردازش کامل شد — ${toPersianDigits(data.processed)} واترمارک اضافه شد`);
            } catch (e: any) {
              toast.error(e.message || "خطا در اعمال واترمارک");
            } finally {
              setWatermarking(false);
            }
          }}
        >
          {watermarking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {watermarking ? "در حال اعمال..." : "اعمال واترمارک"}
        </Button>
      </div>

      {/* Table */}
      <Card className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">عنوان</th>
                <th className="text-right p-3 font-bold hidden sm:table-cell">دسته</th>
                <th className="text-right p-3 font-bold">وضعیت</th>
                <th className="text-right p-3 font-bold hidden md:table-cell">بازدید</th>
                <th className="text-right p-3 font-bold hidden lg:table-cell">تاریخ انتشار</th>
                <th className="text-center p-3 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => <tr key={i}><td colSpan={6}><Skeleton className="h-12 m-1" /></td></tr>)
              ) : articles.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Newspaper className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  مقاله‌ای یافت نشد — اولین مقاله را بسازید!
                </td></tr>
              ) : articles.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate max-w-xs">{a.title}</p>
                      {a.isSeo && (
                        <span
                          className="inline-flex items-center gap-0.5 shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-bold"
                          title={`مقاله سئو هوشمند — کلمه کلیدی: ${a.seoKeyword || "—"}\nقابل بازسازی تصاویر`}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          سئو
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">/{a.slug}</p>
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <Badge className="text-[9px] bg-primary/15 text-primary">{articleCategoryLabel(a.category)}</Badge>
                  </td>
                  <td className="p-3">
                    <button onClick={() => toggleStatus(a)} className="inline-flex items-center gap-1.5" title="تغییر وضعیت">
                      {a.status === "published" ? (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-bold text-emerald-500">منتشر شده</span>
                        </>
                      ) : a.scheduledAt ? (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-xs font-bold text-blue-500" title={`زمان‌بندی: ${new Date(a.scheduledAt).toLocaleString("fa-IR")}`}>
                            زمان‌بندی‌شده
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-xs font-bold text-amber-500">پیش‌نویس</span>
                        </>
                      )}
                    </button>
                    {a.scheduledAt && a.status === "draft" && (
                      <p className="text-[9px] text-blue-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(a.scheduledAt).toLocaleDateString("fa-IR")}
                      </p>
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell font-stat text-xs">{toPersianDigits(a.views)}</td>
                  <td className="p-3 hidden lg:table-cell text-[11px] text-muted-foreground">
                {(() => {
                  // برای مقالات منتشرشده: publishedAt نشان بده (تاریخ انتشار واقعی).
                  // برای draftها: createdAt نشان بده (تاریخ تولید).
                  const isPublished = a.status === "published" && a.publishedAt;
                  const dateStr = isPublished ? a.publishedAt! : a.createdAt;
                  return (
                    <span
                      title={isPublished ? "تاریخ انتشار" : "تاریخ تولید (پیش‌نویس)"}
                      className={isPublished ? "text-emerald-600 font-medium" : ""}
                    >
                      {new Date(dateStr).toLocaleDateString("fa-IR")}
                    </span>
                  );
                })()}
              </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      {/* ویرایش — برای همه مقالات (سئو و غیر سئو) */}
                      <button
                        onClick={() => { setEditArticle(a); setEditorOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition"
                        title="ویرایش"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* بازسازی تصاویر — برای همه مقالات */}
                      <button
                        onClick={() => rebuildImages(a)}
                        disabled={!!rebuilding[a.slug]}
                        className="p-1.5 rounded-lg hover:bg-orange-50 text-muted-foreground hover:text-orange-600 transition disabled:opacity-60 disabled:cursor-wait"
                        title="بازسازی تمام تصاویر — تولید کاور جدید و تصاویر داخل متن"
                      >
                          {rebuilding[a.slug] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                      </button>
                      <button
                        onClick={() => deleteArticle(a)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editorOpen && (
        <ArticleEditorDialog
          article={editArticle}
          onClose={() => { setEditorOpen(false); setEditArticle(null); }}
          onSaved={() => { setEditorOpen(false); setEditArticle(null); load(); }}
        />
      )}
    </div>
  );
}

/* ---- Article Editor Dialog — Rich Markdown + SEO ---- */
function ArticleEditorDialog({ article, onClose, onSaved }: { article: ArticleRow | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(article?.title || "");
  const [slug, setSlug] = useState(article?.slug || "");
  const [excerpt, setExcerpt] = useState(article?.excerpt || "");
  const [content, setContent] = useState(article?.content || "");
  const [category, setCategory] = useState(article?.category || "general");
  const [tags, setTags] = useState(article?.tags || "");
  const [coverImage, setCoverImage] = useState(article?.coverImage || "");
  const [published, setPublished] = useState(article?.status === "published");
  // Scheduled publish date (ISO Gregorian). When set, the article stays "draft"
  // and the cron publisher will flip it to "published" at the scheduled time.
  // Note: if both `published` and `scheduledAt` are set, the API will keep it as
  // draft + scheduled (because publishing immediately + scheduling are mutually
  // exclusive). The UI shows a hint about this behavior.
  const [scheduledAt, setScheduledAt] = useState<string | null>(article?.scheduledAt ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  // SEO state
  const [seoTitle, setSeoTitle] = useState(article?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(article?.seoDescription || "");
  const [metaKeywords, setMetaKeywords] = useState(article?.metaKeywords || "");
  const [canonicalUrl, setCanonicalUrl] = useState(article?.canonicalUrl || "");
  const [ogImage, setOgImage] = useState(article?.ogImage || "");
  const [robots, setRobots] = useState(article?.robots || "index,follow");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate slug from title
  useEffect(() => {
    if (!article && title) {
      setSlug(title.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  /** Insert markdown syntax at cursor position / wrap selection */
  function insertMarkdown(before: string, after: string = "", placeholder: string = "") {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.substring(start, end) || placeholder;
    const newText = `${before}${selected}${after}`;
    const newContent = content.substring(0, start) + newText + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    }, 0);
  }

  /** Insert a full line prefix (headings, lists) */
  function insertLinePrefix(prefix: string, placeholder: string = "متن...") {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = content.indexOf("\n", start);
    const actualLineEnd = lineEnd === -1 ? content.length : lineEnd;
    const currentLine = content.substring(lineStart, actualLineEnd) || placeholder;
    const newLine = `${prefix}${currentLine}`;
    const newContent = content.substring(0, lineStart) + newLine + content.substring(actualLineEnd);
    setContent(newContent);
    setTimeout(() => {
      el.focus();
      el.selectionStart = lineStart + prefix.length;
      el.selectionEnd = lineStart + prefix.length + currentLine.length;
    }, 0);
  }

  /** Upload an image file (cover or inline) and return its URL */
  async function uploadImage(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/articles/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در آپلود");
      return data.url as string;
    } catch (e: any) {
      toast.error(e.message || "خطا در آپلود تصویر");
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      setCoverImage(url);
      toast.success("کاور مقاله آپلود شد ✓");
    }
    e.target.value = "";
  }

  async function handleInlineImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      // insert markdown image at cursor
      insertMarkdown(`\n![`, `](${url})\n`, "توضیح تصویر");
      toast.success("تصویر در متن درج شد ✓");
    }
    e.target.value = "";
  }

  async function save() {
    if (!title.trim() || title.trim().length < 3) {
      toast.error("عنوان حداقل ۳ کاراکتر باید باشد");
      return;
    }
    if (!content.trim() || content.trim().length < 10) {
      toast.error("محتوای مقاله را کامل کنید");
      return;
    }
    setSaving(true);
    try {
      // If a scheduled date is set, the article is saved as draft regardless of
      // the "published" toggle (the cron publisher will flip it later). We send
      // status="draft" + scheduledAt; the API guarantees consistency.
      // If no scheduled date: behavior is unchanged (publish toggle controls status).
      const useScheduling = !!scheduledAt;
      const body = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim(),
        content,
        category,
        tags: tags.trim(),
        coverImage: coverImage.trim(),
        status: useScheduling ? "draft" : (published ? "published" : "draft"),
        scheduledAt: useScheduling ? scheduledAt : null,
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        metaKeywords: metaKeywords.trim(),
        canonicalUrl: canonicalUrl.trim(),
        ogImage: (ogImage.trim() || coverImage.trim()),
        robots,
      };
      const url = article ? `/api/articles/${article.slug}` : "/api/articles";
      const method = article ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "خطا در ذخیره");
      }
      toast.success(
        useScheduling
          ? "مقاله برای انتشار زمان‌بندی شد"
          : article
          ? "مقاله به‌روزرسانی شد"
          : "مقاله ساخته شد"
      );
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally { setSaving(false); }
  }

  // Toolbar buttons config
  const toolbar: { icon: any; label: string; action: () => void; }[] = [
    { icon: Heading1, label: "تیتر ۱", action: () => insertLinePrefix("# ", "تیتر اصلی") },
    { icon: Heading2, label: "تیتر ۲", action: () => insertLinePrefix("## ", "تیتر فرعی") },
    { icon: Heading3, label: "تیتر ۳", action: () => insertLinePrefix("### ", "تیتر کوچک") },
    { icon: Bold, label: "ضخیم", action: () => insertMarkdown("**", "**", "متن ضخیم") },
    { icon: Italic, label: "کج", action: () => insertMarkdown("*", "*", "متن کج") },
    { icon: List, label: "لیست نقطه‌ای", action: () => insertLinePrefix("- ", "مورد لیست") },
    { icon: ListOrdered, label: "لیست شماره‌دار", action: () => insertLinePrefix("1. ", "مورد لیست") },
    { icon: Quote, label: "نقل قول", action: () => insertLinePrefix("> ", "نقل قول") },
    { icon: Link2, label: "لینک", action: () => insertMarkdown("[", "](https://)", "متن لینک") },
    { icon: Code2, label: "بلاک کد", action: () => insertMarkdown("\n```javascript\n", "\n```\n", "کد شما") },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-4xl max-h-[92vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            {article ? "ویرایش مقاله" : "مقاله جدید"}
          </DialogTitle>
        </DialogHeader>

        {/* Title + Slug */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>عنوان مقاله *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: ۵ نکته طلایی برای عضله‌سازی" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>شناسه URL (slug)</Label>
            <Input dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated" className="rounded-xl font-mono text-sm" />
          </div>
        </div>

        {/* Excerpt */}
        <div className="space-y-1.5">
          <Label>خلاصه کوتاه</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="توضیح یک‌خطی برای پیش‌نمایش و سئو" className="rounded-xl resize-none" />
        </div>

        {/* Category + Tags */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>دسته‌بندی</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ARTICLE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>تگ‌ها (با ویرگول)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="تغذیه,تمرین,مبتدی" className="rounded-xl" />
          </div>
        </div>

        {/* Cover Image Upload */}
        <div className="space-y-1.5">
          <Label>تصویر کاور</Label>
          <div className="flex items-center gap-2">
            <Input dir="ltr" value={coverImage} onChange={(e) => setCoverImage(e.target.value)} placeholder="/uploads/articles/... یا https://..." className="rounded-xl text-xs flex-1" />
            <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" onClick={() => coverInputRef.current?.click()} disabled={uploading} className="rounded-xl gap-1.5 shrink-0">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              آپلود
            </Button>
          </div>
          {coverImage && (
            <div className="mt-2 rounded-xl overflow-hidden border border-border max-h-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toWebp(coverImage)} alt="cover" className="w-full h-40 object-cover" />
            </div>
          )}
        </div>

        {/* Rich Markdown Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label>محتوا (Markdown غنی)</Label>
            <input ref={inlineImageInputRef} type="file" accept="image/*" onChange={handleInlineImageUpload} className="hidden" />
            <Button type="button" variant="outline" size="sm" onClick={() => inlineImageInputRef.current?.click()} disabled={uploading} className="rounded-lg text-xs gap-1 h-7">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
              درج تصویر در متن
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 flex-wrap p-2 rounded-t-xl border border-b-0 border-border bg-muted/40">
            {toolbar.map((b, i) => (
              <button
                key={i}
                type="button"
                onClick={b.action}
                title={b.label}
                className="w-8 h-8 rounded-lg hover:bg-primary/15 hover:text-primary flex items-center justify-center transition"
              >
                <b.icon className="w-4 h-4" />
              </button>
            ))}
            <div className="w-px h-6 bg-border mx-1" />
            <span className="text-[10px] text-muted-foreground px-2">Markdown</span>
          </div>
          <Textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={14}
            placeholder={"# عنوان مقاله\n\nمقدمه مقاله...\n\n## بخش اول\n\n- مورد ۱\n- مورد ۲\n\n![توضیح](image-url)\n\n> نقل قول مهم"}
            className="rounded-t-none rounded-xl resize-y font-mono text-sm leading-relaxed"
            dir="rtl"
          />
          <p className="text-[10px] text-muted-foreground">پشتیبانی از: تیتر (#, ##, ###)، ضخیم (**)، کج (*)، لیست (-، ۱.)، نقل قول ({">"})، لینک، تصویر، بلاک کد</p>
        </div>

        {/* SEO Section (collapsible) */}
        <div className="rounded-xl border border-orange-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSeo(!showSeo)}
            className="w-full flex items-center justify-between p-3 bg-orange-50/50 hover:bg-orange-50 transition"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-orange-500" />
              <span className="font-bold text-sm text-slate-800">تنظیمات سئو (SEO)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">حرفه‌ای</span>
            </div>
            <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform ${showSeo ? "-rotate-90" : ""}`} />
          </button>
          {showSeo && (
            <div className="p-3 space-y-3 bg-white">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">عنوان سئو (SEO Title) — {seoTitle.length}/۶۰</Label>
                  <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value.slice(0, 60))} placeholder="عنوان برای موتور جستجو" className="rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">کلمات کلیدی (Meta Keywords)</Label>
                  <Input value={metaKeywords} onChange={(e) => setMetaKeywords(e.target.value)} placeholder="کلمه1, کلمه2, کلمه3" className="rounded-xl text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">توضیحات متا (Meta Description) — {seoDescription.length}/۱۶۰</Label>
                <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value.slice(0, 160))} rows={2} placeholder="توضیح کوتاه برای نمایش در نتایج جستجو" className="rounded-xl resize-none text-sm" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Canonical URL (اختیاری)</Label>
                  <Input dir="ltr" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://fittup.ir/..." className="rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">تصویر Open Graph (OG Image)</Label>
                  <Input dir="ltr" value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="خالی = تصویر کاور" className="rounded-xl text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">دستورالعمل ربات‌ها (Robots)</Label>
                <Select value={robots} onValueChange={setRobots}>
                  <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index,follow">index,follow (پیش‌فرض — ایندکس شود)</SelectItem>
                    <SelectItem value="noindex,follow">noindex,follow (ایندکس نشود)</SelectItem>
                    <SelectItem value="index,nofollow">index,nofollow (لینک‌ها دنبال نشود)</SelectItem>
                    <SelectItem value="noindex,nofollow">noindex,nofollow (کاملاً مخفی)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-[10px] text-muted-foreground bg-orange-50/50 rounded-lg p-2">
                💡 اگر عنوان سئو خالی باشد، از عنوان مقاله استفاده می‌شود. اگر توضیحات متا خالی باشد، از خلاصه استفاده می‌شود. زمان مطالعه به‌صورت خودکار از روی متن محاسبه می‌شود.
              </div>
            </div>
          )}
        </div>

        {/* Publish toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl glass">
          <div>
            <Label className="text-sm font-medium">انتشار مقاله</Label>
            <p className="text-[11px] text-muted-foreground">در صورت خاموش بودن، به‌صورت پیش‌نویس ذخیره می‌شود</p>
          </div>
          <Switch
            checked={published}
            onCheckedChange={(v) => {
              setPublished(v);
              // If admin enables publishing immediately, clear any scheduled date
              // (publishing now and scheduling are mutually exclusive).
              if (v && scheduledAt) {
                setScheduledAt(null);
                toast.info("تاریخ انتشار زمان‌بندی‌شده حذف شد — مقاله فوراً منتشر خواهد شد.");
              }
            }}
            disabled={!!scheduledAt}
          />
        </div>

        {/* Scheduled publish date */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                زمان‌بندی انتشار
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                با انتخاب تاریخ، مقاله به‌صورت پیش‌نویس ذخیره می‌شود و در زمان مشخص‌شده به‌صورت خودکار منتشر خواهد شد.
              </p>
            </div>
          </div>
          <PersianDatePicker
            value={scheduledAt}
            onChange={(iso) => {
              setScheduledAt(iso);
              // Selecting a schedule overrides the immediate-publish toggle:
              // the article becomes a scheduled draft instead.
              if (iso && published) {
                setPublished(false);
              }
            }}
            placeholder="بدون زمان‌بندی (انتشار فوری)"
            minDate={new Date().toISOString()}
            clearable
          />
          {scheduledAt && (
            <div className="text-[10px] text-emerald-700 bg-emerald-100/60 rounded-lg p-2 flex items-start gap-1.5">
              <Clock className="w-3 h-3 mt-0.5 shrink-0" />
              <span>
                مقاله در تاریخ <strong>{new Date(scheduledAt).toLocaleDateString("fa-IR")}</strong> ساعت{" "}
                <strong>{new Date(scheduledAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</strong>{" "}
                به‌صورت خودکار منتشر خواهد شد (نیازمند فعال بودن cron publisher).
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button onClick={save} disabled={saving || uploading} className="rounded-xl gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            ذخیره مقاله
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ۶. دستیار هوشمند — Admin AI Copilot
   ============================================================ */
interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

function CopilotTab() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<{ totalUsers: number; totalRevenue: number; activeSubs: number; pendingPrograms: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial greeting + load stats
    (async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        const d = await res.json();
        const s = d.stats;
        if (s) {
          setStats({
            totalUsers: s.totalUsers || 0,
            totalRevenue: s.totalRevenue || 0,
            activeSubs: s.activeSubscriptions || 0,
            pendingPrograms: s.pendingPrograms || 0,
          });
          setMessages([{
            role: "assistant",
            content: `سلام مدیر عزیز 👋 من دستیار هوشمند پنل فیتاپ هستم.\n\nآمار فعلی سایت شما:\n• 👥 ${toPersianDigits(s.totalUsers || 0)} کاربر\n• 💰 ${toPersianDigits(formatToman(s.totalRevenue || 0))} تومان درآمد\n• 🔥 ${toPersianDigits(s.activeSubscriptions || 0)} اشتراک فعال\n• ⏳ ${toPersianDigits(s.pendingPrograms || 0)} برنامه در انتظار تولید\n\nچطور می‌تونم کمکتون کنم؟ می‌تونم در تحلیل آمار، پیشنهاد استراتژی، نوشتن مقالات یا پاسخ به سوالات فنی کمک کنم.`,
          }]);
        }
      } catch {
        setMessages([{ role: "assistant", content: "سلام! دستیار هوشمند آماده پاسخگویی است." }]);
      }
    })();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    const nextMessages = [...messages, { role: "user" as const, content: msg }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const res = await fetch("/api/admin/copilot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: nextMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.context) setStats(data.context);
      setMessages([...nextMessages, { role: "assistant", content: data.reply || "پاسخی دریافت نشد." }]);
    } catch {
      toast.error("خطا در ارتباط با دستیار");
      setMessages([...nextMessages, { role: "assistant", content: "متأسفم، در ارتباط با سرور خطایی رخ داد. دوباره تلاش کنید." }]);
    } finally { setSending(false); }
  }

  const QUICK_PROMPTS = [
    "تحلیل کلی وضعیت سایت",
    "چطور می‌تونم نرخ تبدیل رو افزایش بدم؟",
    "یک مقاله کوتاه درباره اهمیت پروتئین بنویس",
    "کدام پلن بیشترین درآمد رو داشته؟",
    "پیشنهاد استراتژی برای نگه‌داشت کاربران",
  ];

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4" style={{ minHeight: "calc(95vh - 130px)" }}>
      {/* Stats banner */}
      {stats && (
        <Card className="p-3 glass-gold mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">کاربران</p>
              <p className="font-stat font-bold text-sm">{toPersianDigits(stats.totalUsers)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">درآمد (تومان)</p>
              <p className="font-stat font-bold text-sm">{toPersianDigits(formatToman(stats.totalRevenue))}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">اشتراک فعال</p>
              <p className="font-stat font-bold text-sm">{toPersianDigits(stats.activeSubs)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">در انتظار تولید</p>
              <p className="font-stat font-bold text-sm">{toPersianDigits(stats.pendingPrograms)}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-3">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              m.role === "user" ? "bg-primary/15 text-primary" : "bg-gradient-to-br from-amber-500/20 to-yellow-500/10 text-amber-500 glow-gold-sm"
            }`}>
              {m.role === "user" ? <Shield className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === "user" ? "bg-primary text-primary-foreground rounded-tl-sm" : "glass rounded-tr-sm"
            }`}>
              {m.content}
            </div>
          </motion.div>
        ))}
        {sending && (
          <div className="flex gap-2 flex-row">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-500/20 to-yellow-500/10 text-amber-500">
              <Bot className="w-4 h-4" />
            </div>
            <div className="glass p-3 rounded-2xl rounded-tr-sm">
              <div className="flex gap-1">
                <span className="typing-dot w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span className="typing-dot w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span className="typing-dot w-2 h-2 rounded-full bg-amber-500 inline-block" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {QUICK_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => send(p)} className="text-xs px-3 py-1.5 rounded-xl glass hover:bg-primary hover:text-primary-foreground transition">
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="سوال یا درخواست خود را بنویسید... (Enter برای ارسال)"
          rows={1}
          className="rounded-xl resize-none min-h-[44px] max-h-32 glass"
        />
        <Button onClick={() => send()} disabled={!input.trim() || sending} className="rounded-xl h-11 w-11 p-0 bg-primary text-primary-foreground glow-gold-sm shrink-0">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
   ۶.۴. کدهای تحلیلی — Analytics / Search Console / Pixels
   ============================================================ */
interface HeadCodeRow {
  id: string;
  name: string;
  type: string;
  code: string;
  placement: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function HeadCodesTab() {
  const [codes, setCodes] = useState<HeadCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editCode, setEditCode] = useState<HeadCodeRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/head-codes", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCodes(data.codes || []);
    } catch {
      toast.error("خطا در بارگذاری کدها");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(c: HeadCodeRow) {
    try {
      const res = await fetch(`/api/admin/head-codes/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(c.isActive ? "کد غیرفعال شد" : "کد فعال شد");
      load();
    } catch { toast.error("خطا در تغییر وضعیت"); }
  }

  async function remove(c: HeadCodeRow) {
    if (!confirm(`حذف «${c.name}»؟ این عمل قابل بازگشت نیست.`)) return;
    try {
      const res = await fetch(`/api/admin/head-codes/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "خطا در حذف");
      }
      toast.success("کد حذف شد");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در حذف");
    }
  }

  const activeCount = codes.filter((c) => c.isActive).length;

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Summary card */}
      <Card className="p-5 glass">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">کدهای تحلیلی و ردیاب</p>
              <h3 className="font-black text-base">تزریق کد به صفحات سایت</h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-500">{toPersianDigits(activeCount)} فعال</Badge>
                <Badge className="text-[10px] bg-muted text-foreground">{toPersianDigits(codes.length)} کل</Badge>
                <span>Google Analytics • Search Console • Meta Pixel</span>
              </p>
            </div>
          </div>
          <Button
            onClick={() => { setEditCode(null); setEditorOpen(true); }}
            className="rounded-xl gap-1.5 bg-primary text-primary-foreground glow-gold-sm"
          >
            <Plus className="w-4 h-4" /> کد جدید
          </Button>
        </div>
      </Card>

      {/* Codes table */}
      <Card className="glass overflow-hidden">
        <div className="p-3 border-b bg-muted/40">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" />
            همه کدها ({toPersianDigits(codes.length)})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">نام</th>
                <th className="text-right p-3 font-bold">نوع</th>
                <th className="text-right p-3 font-bold hidden sm:table-cell">محل تزریق</th>
                <th className="text-center p-3 font-bold">فعال</th>
                <th className="text-center p-3 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2].map((i) => <tr key={i}><td colSpan={5}><Skeleton className="h-12 m-1" /></td></tr>)
              ) : codes.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">
                  <Code2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  هنوز کدی اضافه نشده است.
                </td></tr>
              ) : codes.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <p className="font-medium text-sm truncate max-w-[200px]">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px] font-mono" dir="ltr">
                      {c.code.replace(/<[^>]+>/g, "").trim().slice(0, 50) || c.code.slice(0, 50)}
                    </p>
                  </td>
                  <td className="p-3">
                    <Badge
                      className="text-[10px]"
                      style={{ background: `${headCodeTypeColor(c.type)}20`, color: headCodeTypeColor(c.type) }}
                    >
                      {headCodeTypeLabel(c.type)}
                    </Badge>
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <span className="text-[11px] text-muted-foreground font-mono" dir="ltr">{headCodePlacementLabel(c.placement)}</span>
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={c.isActive} onCheckedChange={() => toggleActive(c)} aria-label="فعال/غیرفعال" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setEditCode(c); setEditorOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition"
                        title="ویرایش"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editorOpen && (
        <HeadCodeEditorDialog
          code={editCode}
          onClose={() => { setEditorOpen(false); setEditCode(null); }}
          onSaved={() => { setEditorOpen(false); setEditCode(null); load(); }}
        />
      )}
    </div>
  );
}

/* ---- Head Code Editor Dialog ---- */
function HeadCodeEditorDialog({ code, onClose, onSaved }: { code: HeadCodeRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(code?.name || "");
  const [type, setType] = useState(code?.type || "custom");
  const [placement, setPlacement] = useState(code?.placement || "head");
  const [codeValue, setCodeValue] = useState(code?.code || "");
  const [isActive, setIsActive] = useState(code?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  function applyTemplate(tplId: string) {
    const tpl = HEAD_CODE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setCodeValue(tpl.code);
    setType(tpl.type);
    setPlacement(tpl.placement);
    if (!name.trim()) setName(tpl.label);
    toast.success(`قالب «${tpl.label}» بارگذاری شد`);
  }

  async function save() {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("نام باید حداقل ۲ کاراکتر باشد");
      return;
    }
    if (!codeValue.trim() || codeValue.trim().length < 5) {
      toast.error("کد را به‌صورت کامل وارد کنید");
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!code;
      const url = isEdit ? `/api/admin/head-codes/${code!.id}` : "/api/admin/head-codes";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          placement,
          code: codeValue.trim(),
          isActive,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "خطا در ذخیره");
      }
      toast.success(isEdit ? "کد به‌روزرسانی شد" : "کد جدید اضافه شد");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" />
            {code ? `ویرایش «${code.name}»` : "افزودن کد تحلیلی جدید"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1">
          {/* Quick templates */}
          <div className="space-y-1.5">
            <Label className="text-xs">قالب‌های آماده</Label>
            <div className="flex flex-wrap gap-1.5">
              {HEAD_CODE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20 transition flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              با کلیک روی هر قالب، کد نمونه در فیلد کد قرار می‌گیرد. مقادیرPLACEHOLDER را با شناسه واقعی خود جایگزین کنید.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">نام</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: Google Analytics 4"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">نوع</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HEAD_CODE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">محل تزریق</Label>
            <Select value={placement} onValueChange={setPlacement}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HEAD_CODE_PLACEMENTS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              برای متا تگ‌ها (مانند تأییدیه گوگل) و اسکریپت‌های زودهنگام، «داخل head» را انتخاب کنید.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">کد (HTML / Script)</Label>
            <Textarea
              value={codeValue}
              onChange={(e) => setCodeValue(e.target.value)}
              rows={10}
              dir="ltr"
              className="rounded-xl font-mono text-xs resize-y leading-relaxed"
              placeholder={'<!-- Google tag (gtag.js) -->\n<script async src="https://..."></script>\n<script>...</script>'}
            />
            <p className="text-[10px] text-muted-foreground">
              کد را دقیقاً همان‌طور که از سرویس دریافت کرده‌اید اینجا قرار دهید.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/40">
            <div>
              <p className="text-sm font-bold">فعال‌سازی کد</p>
              <p className="text-[11px] text-muted-foreground">
                کدهای فعال به‌صورت خودکار در تمام صفحات سایت تزریق می‌شوند.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button onClick={save} disabled={saving} className="rounded-xl gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {code ? "ذخیره تغییرات" : "افزودن کد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ۶.۵. قوانین — Terms & Conditions Management
   ============================================================ */
interface TermsRow {
  id: string;
  version: number;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function TermsTab() {
  const [versions, setVersions] = useState<TermsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTerms, setEditTerms] = useState<TermsRow | null>(null);
  const [previewTerms, setPreviewTerms] = useState<TermsRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/terms", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVersions(data.versions || []);
    } catch {
      toast.error("خطا در بارگذاری قوانین");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function setActive(v: TermsRow) {
    if (v.isActive) return;
    try {
      const res = await fetch(`/api/admin/terms/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error();
      toast.success(`نسخه ${toPersianDigits(v.version)} فعال شد`);
      load();
    } catch { toast.error("خطا در فعال‌سازی نسخه"); }
  }

  async function deactivate(v: TermsRow) {
    try {
      const res = await fetch(`/api/admin/terms/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error();
      toast.success(`نسخه ${toPersianDigits(v.version)} غیرفعال شد`);
      load();
    } catch { toast.error("خطا در غیرفعال‌سازی نسخه"); }
  }

  async function remove(v: TermsRow) {
    if (!confirm(`حذف نسخه ${toPersianDigits(v.version)} — «${v.title}»؟`)) return;
    try {
      const res = await fetch(`/api/admin/terms/${v.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "خطا در حذف");
      }
      toast.success("نسخه حذف شد");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در حذف");
    }
  }

  const activeVersion = versions.find((v) => v.isActive) || null;

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Active version summary */}
      <Card className="p-5 glass">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">نسخه فعال فعلی</p>
              {activeVersion ? (
                <>
                  <h3 className="font-black text-base">{activeVersion.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <Badge className="text-[10px] bg-primary/15 text-primary">نسخه {toPersianDigits(activeVersion.version)}</Badge>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(activeVersion.updatedAt).toLocaleDateString("fa-IR")}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">هیچ نسخه فعالی موجود نیست — یک نسخه را فعال کنید.</p>
              )}
            </div>
          </div>
          <Button
            onClick={() => { setEditTerms(null); setEditorOpen(true); }}
            className="rounded-xl gap-1.5 bg-primary text-primary-foreground glow-gold-sm"
          >
            <Plus className="w-4 h-4" /> نسخه جدید
          </Button>
        </div>
      </Card>

      {/* Versions list */}
      <Card className="glass overflow-hidden">
        <div className="p-3 border-b bg-muted/40">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            همه نسخه‌ها ({toPersianDigits(versions.length)})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="text-right p-3 font-bold">نسخه</th>
                <th className="text-right p-3 font-bold">عنوان</th>
                <th className="text-right p-3 font-bold">وضعیت</th>
                <th className="text-right p-3 font-bold hidden md:table-cell">آخرین تغییر</th>
                <th className="text-center p-3 font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2].map((i) => <tr key={i}><td colSpan={5}><Skeleton className="h-12 m-1" /></td></tr>)
              ) : versions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  هنوز نسخه‌ای ساخته نشده است.
                </td></tr>
              ) : versions.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <Badge className="text-[10px] bg-muted text-foreground">v{toPersianDigits(v.version)}</Badge>
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-sm truncate max-w-[200px]">{v.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{v.content.slice(0, 60).replace(/[#*]/g, "")}...</p>
                  </td>
                  <td className="p-3">
                    {v.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />فعال
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                        <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40" />غیرفعال
                      </span>
                    )}
                  </td>
                  <td className="p-3 hidden md:table-cell text-[11px] text-muted-foreground">
                    {new Date(v.updatedAt).toLocaleDateString("fa-IR")}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setPreviewTerms(v)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition"
                        title="مشاهده"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setEditTerms(v); setEditorOpen(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition"
                        title="ویرایش"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {v.isActive ? (
                        <button
                          onClick={() => deactivate(v)}
                          className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-500 transition"
                          title="غیرفعال کردن"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setActive(v)}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition"
                          title="فعال کردن"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => remove(v)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editorOpen && (
        <TermsEditorDialog
          terms={editTerms}
          onClose={() => { setEditorOpen(false); setEditTerms(null); }}
          onSaved={() => { setEditorOpen(false); setEditTerms(null); load(); }}
        />
      )}

      {previewTerms && (
        <TermsPreviewDialog terms={previewTerms} onClose={() => setPreviewTerms(null)} />
      )}
    </div>
  );
}

/* ---- Terms Editor Dialog ---- */
function TermsEditorDialog({ terms, onClose, onSaved }: { terms: TermsRow | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(terms?.title || "شرایط و قوانین فیت‌آپ");
  const [content, setContent] = useState(terms?.content || "");
  const [isActive, setIsActive] = useState(terms?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || title.trim().length < 3) {
      toast.error("عنوان حداقل ۳ کاراکتر باید باشد");
      return;
    }
    if (!content.trim() || content.trim().length < 10) {
      toast.error("محتوای قوانین را کامل کنید");
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!terms;
      const url = isEdit ? `/api/admin/terms/${terms!.id}` : "/api/admin/terms";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), isActive }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "خطا در ذخیره");
      }
      toast.success(isEdit ? "نسخه به‌روزرسانی شد" : "نسخه جدید ساخته شد");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ذخیره");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {terms ? `ویرایش نسخه ${toPersianDigits(terms.version)}` : "ایجاد نسخه جدید قوانین"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs">عنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">محتوا (Markdown)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              dir="rtl"
              className="rounded-xl font-mono text-xs resize-y leading-relaxed"
              placeholder="# شرایط و قوانین&#10;&#10;متن قوانین را اینجا بنویسید..."
            />
            <p className="text-[10px] text-muted-foreground">
              از Markdown استفاده کنید: # عنوان، ## زیرعنوان، **پررنگ**، - فهرست
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/40">
            <div>
              <p className="text-sm font-bold">فعال‌سازی به عنوان نسخه فعلی</p>
              <p className="text-[11px] text-muted-foreground">
                با فعال‌سازی، سایر نسخه‌ها غیرفعال می‌شوند و کاربران جدید باید این نسخه را بپذیرند.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button onClick={save} disabled={saving} className="rounded-xl gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {terms ? "ذخیره تغییرات" : "ایجاد نسخه"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Terms Preview Dialog ---- */
function TermsPreviewDialog({ terms, onClose }: { terms: TermsRow; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            {terms.title}
            <Badge className="text-[10px] bg-muted text-foreground">نسخه {toPersianDigits(terms.version)}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto custom-scrollbar pr-1">
          <div dir="rtl" className="text-sm leading-relaxed text-foreground/90">
            <ReactMarkdown>{terms.content}</ReactMarkdown>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">بستن</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ۷. تنظیمات سایت — Site Settings Dialog
   ============================================================ */
function SiteSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<{ key: string; label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await res.json();
      setSettings(data.settings || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  function update(key: string, value: string) {
    setSettings((s) => s.map((x) => (x.key === key ? { ...x, value } : x)));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const promises = settings.map((s) =>
        fetch("/api/admin/settings", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: s.key, value: s.value }),
        })
      );
      await Promise.all(promises);
      toast.success("تنظیمات ذخیره شد");
      onClose();
    } catch { toast.error("خطا در ذخیره"); } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            تنظیمات سایت
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {settings.map((s) => (
              <div key={s.key} className="space-y-1.5">
                <Label className="text-xs">{s.label}</Label>
                {s.key === "heroSubtitle" ? (
                  <Textarea value={s.value} onChange={(e) => update(s.key, e.target.value)} rows={2} className="rounded-xl resize-none" />
                ) : s.key === "primaryColor" ? (
                  <div className="flex gap-2">
                    <Input dir="ltr" value={s.value} onChange={(e) => update(s.key, e.target.value)} placeholder="#F4C542" className="rounded-xl font-mono text-sm" />
                    <input
                      type="color"
                      value={/^#[0-9A-Fa-f]{6}$/.test(s.value) ? s.value : "#F4C542"}
                      onChange={(e) => update(s.key, e.target.value)}
                      className="w-11 h-9 rounded-lg border border-border cursor-pointer bg-transparent"
                      aria-label="انتخاب رنگ"
                    />
                  </div>
                ) : s.key === "app_latest_version_code" || s.key === "app_min_version_code" ? (
                  <div>
                    <Input type="number" dir="ltr" value={s.value} onChange={(e) => update(s.key, e.target.value)} className="rounded-xl font-stat" placeholder="1" />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {s.key === "app_latest_version_code"
                        ? "شماره نسخه (versionCode) آخرین نسخه APK منتشرشده در کافه‌بازار"
                        : "کاربران اپ با کد نسخه کمتر از این عدد، آپدیت اجباری می‌گیرند"}
                    </p>
                  </div>
                ) : (
                  <Input value={s.value} onChange={(e) => update(s.key, e.target.value)} className="rounded-xl" />
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button onClick={saveAll} disabled={saving || loading} className="rounded-xl gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            ذخیره تغییرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ۸. مدیریت ادمین‌ها — AdminsTab
   ============================================================ */
interface AdminRow {
  id: string;
  mobile: string;
  name: string | null;
  role: string;
  createdAt: string;
  isSuperAdmin: boolean;
  permissions: AdminPermissions | null;
}

function AdminsTab() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/admins", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.admins)) setAdmins(data.admins);
    } catch {
      toast.error("خطا در دریافت لیست ادمین‌ها");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function removeAdmin(a: AdminRow) {
    if (a.isSuperAdmin) {
      toast.error("سوپرادمین قابل حذف نیست");
      return;
    }
    if (!confirm(`حذف دسترسی ادمین از «${a.name || a.mobile}»؟ نقش کاربر به ورزشکار بازمی‌گردد.`)) return;
    try {
      const res = await fetch(`/api/admin/admins/${a.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "خطا در حذف");
      }
      toast.success("ادمین حذف شد");
      setAdmins((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-sm">مدیریت ادمین‌ها</h3>
            <p className="text-[11px] text-muted-foreground">
              {toPersianDigits(admins.length)} ادمین فعال
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)} className="rounded-xl gap-1.5">
          <Plus className="w-4 h-4" />
          افزودن ادمین
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : admins.length === 0 ? (
        <Card className="p-8 text-center glass">
          <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">ادمینی یافت نشد</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {admins.map((a) => (
            <AdminCard key={a.id} admin={a} onEdit={() => setEditing(a)} onRemove={() => removeAdmin(a)} />
          ))}
        </div>
      )}

      {creating && (
        <AdminEditDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); void load(); }}
        />
      )}
      {editing && (
        <AdminEditDialog
          mode="edit"
          admin={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function AdminCard({ admin, onEdit, onRemove }: { admin: AdminRow; onEdit: () => void; onRemove: () => void }) {
  // Collect active permission badges
  const activePerms = admin.permissions
    ? PERMISSION_KEYS.filter((k) => (admin.permissions as any)[k])
    : [];
  return (
    <Card className="p-4 glass">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold shrink-0">
            {admin.isSuperAdmin ? "★" : (admin.name?.[0] || "ا")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-sm">{admin.name || "بدون نام"}</p>
              {admin.isSuperAdmin ? (
                <Badge className="text-[9px] bg-amber-500 text-white">سوپرادمین</Badge>
              ) : (
                <Badge className="text-[9px] bg-primary text-primary-foreground">ادمین</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1" dir="ltr">
              <Phone className="w-3 h-3" />
              {admin.mobile}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {activePerms.length === 0 ? (
                <span className="text-[10px] text-muted-foreground">بدون دسترسی خاص</span>
              ) : (
                activePerms.slice(0, 6).map((k) => (
                  <Badge key={k} variant="outline" className="text-[9px]">
                    {PERMISSION_LABELS[k]}
                  </Badge>
                ))
              )}
              {activePerms.length > 6 && (
                <Badge variant="outline" className="text-[9px]">
                  +{toPersianDigits(activePerms.length - 6)}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!admin.isSuperAdmin && (
            <>
              <button
                onClick={onEdit}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition"
                title="ویرایش دسترسی‌ها"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onRemove}
                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                title="حذف ادمین"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function AdminEditDialog({
  mode,
  admin,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  admin?: AdminRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<AdminPermissions>(emptyPermissions());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === "edit" && admin) {
      setMobile(admin.mobile);
      setName(admin.name || "");
      setPerms(admin.permissions ? { ...admin.permissions } : ALL_TRUE_PERMISSIONS);
    }
  }, [mode, admin]);

  function togglePerm(k: PermissionKey, val: boolean) {
    setPerms((p) => ({ ...p, [k]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      if (mode === "create") {
        if (!/^09\d{9}$/.test(mobile.replace(/\s/g, ""))) {
          toast.error("شماره موبایل نامعتبر است (مثال: 09123456789)");
          setSaving(false);
          return;
        }
        const res = await fetch("/api/admin/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mobile: mobile.replace(/\s/g, ""),
            name: name.trim() || undefined,
            permissions: perms,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "خطا در ایجاد ادمین");
        toast.success("ادمین جدید اضافه شد");
        onSaved();
      } else if (admin) {
        const res = await fetch(`/api/admin/admins/${admin.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || undefined,
            permissions: perms,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "خطا در به‌روزرسانی");
        toast.success("دسترسی‌ها به‌روزرسانی شد");
        onSaved();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {mode === "create" ? "افزودن ادمین جدید" : "ویرایش دسترسی ادمین"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1">
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label className="text-xs">شماره موبایل</Label>
              <Input
                dir="ltr"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
                placeholder="09123456789"
                className="rounded-xl text-left font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                اگر کاربری با این شماره وجود داشته باشد، به ادمین ارتقا می‌یابد. در غیر این‌صورت حساب جدید ساخته می‌شود.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">نام نمایشی (اختیاری)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" placeholder="مثلاً: علی ادمین" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">دسترسی‌ها</Label>
            <div className="space-y-2 p-3 rounded-xl bg-muted/40">
              {PERMISSION_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <Label htmlFor={`perm-${k}`} className="text-xs font-normal cursor-pointer">
                    {PERMISSION_LABELS[k]}
                  </Label>
                  <Switch
                    id={`perm-${k}`}
                    checked={perms[k]}
                    onCheckedChange={(v) => togglePerm(k, v)}
                  />
                </div>
              ))}
            </div>
            {mode === "edit" && admin?.isSuperAdmin && (
              <p className="text-[10px] text-amber-600">
                توجه: سوپرادمین همیشه همه دسترسی‌ها را دارد.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline" className="rounded-xl">انصراف</Button>
          <Button onClick={save} disabled={saving} className="rounded-xl gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mode === "create" ? "ایجاد ادمین" : "ذخیره تغییرات"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ۹. تیکت‌های پشتیبانی — TicketsTab
   ============================================================ */
const TICKET_CATEGORY_LABELS: Record<string, string> = {
  general: "عمومی",
  technical: "فنی",
  payment: "پرداخت",
  program: "برنامه",
  bug: "باگ",
};

const TICKET_PRIORITY_LABELS: Record<string, string> = {
  low: "کم",
  normal: "معمولی",
  high: "مهم",
  urgent: "فوری",
};

const TICKET_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-cyan-100 text-cyan-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "باز",
  answered: "پاسخ داده شد",
  closed: "بسته شد",
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  answered: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

interface AdminTicketDto {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
  repliedAt: string | null;
  userId: string;
  user: { id: string; name: string | null; mobile: string; planName: string | null };
  replies: Array<{
    id: string;
    role: string;
    message: string;
    createdAt: string;
    user: { id: string; name: string | null; mobile: string };
  }>;
}

function TicketsTab() {
  const [tickets, setTickets] = useState<AdminTicketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selected, setSelected] = useState<AdminTicketDto | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/support/tickets", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data.tickets)) setTickets(data.tickets);
    } catch {
      toast.error("خطا در دریافت تیکت‌ها");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function applyFilters(t: AdminTicketDto) {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  }

  const filtered = tickets.filter(applyFilters);

  function handleUpdated(t: AdminTicketDto) {
    setTickets((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    setSelected(t);
  }

  if (selected) {
    return (
      <AdminTicketDetail
        ticket={selected}
        onBack={() => setSelected(null)}
        onUpdated={handleUpdated}
      />
    );
  }

  return (
    <div className="p-4 space-y-3 max-w-5xl mx-auto">
      {/* Header + filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-sm">تیکت‌های پشتیبانی</h3>
            <p className="text-[11px] text-muted-foreground">
              {toPersianDigits(filtered.length)} تیکت
            </p>
          </div>
        </div>
        <Button onClick={() => void load()} variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Loader2 className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          به‌روزرسانی
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] rounded-xl glass"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            <SelectItem value="open">باز</SelectItem>
            <SelectItem value="answered">پاسخ داده شد</SelectItem>
            <SelectItem value="closed">بسته شد</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[130px] rounded-xl glass"><SelectValue placeholder="دسته" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌ها</SelectItem>
            <SelectItem value="general">عمومی</SelectItem>
            <SelectItem value="technical">فنی</SelectItem>
            <SelectItem value="payment">پرداخت</SelectItem>
            <SelectItem value="program">برنامه</SelectItem>
            <SelectItem value="bug">باگ</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[130px] rounded-xl glass"><SelectValue placeholder="اولویت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه اولویت‌ها</SelectItem>
            <SelectItem value="low">کم</SelectItem>
            <SelectItem value="normal">معمولی</SelectItem>
            <SelectItem value="high">مهم</SelectItem>
            <SelectItem value="urgent">فوری</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center glass">
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">تیکتی یافت نشد</p>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
          {filtered.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)} className="w-full text-right">
              <Card className="p-3.5 glass hover:border-primary/30 transition-all hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.message}</p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Badge className={`text-[10px] ${TICKET_STATUS_COLORS[t.status] || "bg-slate-100"}`}>
                          {TICKET_STATUS_LABELS[t.status] || t.status}
                        </Badge>
                        <Badge className={`text-[10px] ${TICKET_PRIORITY_COLORS[t.priority] || "bg-slate-100"}`}>
                          {TICKET_PRIORITY_LABELS[t.priority] || t.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {TICKET_CATEGORY_LABELS[t.category] || t.category}
                        </Badge>
                        {t.replies.length > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MessageSquare className="w-3 h-3" />
                            {toPersianDigits(t.replies.length)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[11px] font-medium">{t.user.name || "بدون نام"}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{t.user.mobile}</p>
                    {t.user.planName && (
                      <Badge className="text-[9px]" style={{ background: `${PLAN_COLORS[t.user.planName]}20`, color: PLAN_COLORS[t.user.planName] }}>
                        {PLAN_LABELS[t.user.planName as Plan]}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-1">
                      {new Date(t.updatedAt).toLocaleDateString("fa-IR")}
                    </span>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminTicketDetail({
  ticket,
  onBack,
  onUpdated,
}: {
  ticket: AdminTicketDto;
  onBack: () => void;
  onUpdated: (t: AdminTicketDto) => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [ticket.replies.length]);

  async function sendReply(e?: React.FormEvent) {
    e?.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "خطا در ارسال پاسخ");
      onUpdated(data.ticket);
      setReply("");
      toast.success("پاسخ ارسال شد");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(status: string, label: string) {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "خطا در تغییر وضعیت");
      onUpdated(data.ticket);
      toast.success(`تیکت ${label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="p-4 space-y-3 max-w-4xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
        <ChevronRight className="w-4 h-4" />
        بازگشت به لیست تیکت‌ها
      </button>

      {/* User info card */}
      <Card className="p-3 glass">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold">
              {ticket.user.name?.[0] || "؟"}
            </div>
            <div>
              <p className="font-bold text-sm">{ticket.user.name || "بدون نام"}</p>
              <p className="text-[11px] text-muted-foreground" dir="ltr">{ticket.user.mobile}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ticket.user.planName && (
              <Badge style={{ background: `${PLAN_COLORS[ticket.user.planName]}20`, color: PLAN_COLORS[ticket.user.planName] }}>
                {PLAN_LABELS[ticket.user.planName as Plan]}
              </Badge>
            )}
            <Badge className={TICKET_STATUS_COLORS[ticket.status] || "bg-slate-100"}>
              {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Ticket message card */}
      <Card className="p-4 glass">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="font-bold text-base">{ticket.subject}</h2>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {new Date(ticket.createdAt).toLocaleString("fa-IR")}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <Badge variant="outline" className="text-[10px]">
            {TICKET_CATEGORY_LABELS[ticket.category] || ticket.category}
          </Badge>
          <Badge className={`text-[10px] ${TICKET_PRIORITY_COLORS[ticket.priority] || "bg-slate-100"}`}>
            اولویت: {TICKET_PRIORITY_LABELS[ticket.priority] || ticket.priority}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
      </Card>

      {/* Replies thread */}
      <Card className="p-3 glass">
        <h3 className="text-xs font-bold mb-2">گفتگو ({toPersianDigits(ticket.replies.length)} پاسخ)</h3>
        <div ref={scrollRef} className="max-h-[40vh] overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
          {ticket.replies.length === 0 && (
            <div className="text-center py-4 text-xs text-muted-foreground">
              هنوز پاسخی ثبت نشده است
            </div>
          )}
          {ticket.replies.map((r) => {
            const isAdmin = r.role === "admin";
            return (
              <div key={r.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  isAdmin
                    ? "bg-primary/10 border border-primary/20 text-foreground rounded-bl-md"
                    : "bg-muted text-foreground rounded-br-md"
                }`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {isAdmin ? (
                      <Badge className="text-[9px] bg-primary text-primary-foreground">ادمین</Badge>
                    ) : (
                      <span className="text-[10px] font-bold">{r.user.name || "کاربر"}</span>
                    )}
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("fa-IR")}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Reply + actions */}
      <Card className="p-3 glass space-y-3">
        <form onSubmit={sendReply} className="space-y-2">
          <Label className="text-xs">پاسخ به کاربر</Label>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="پاسخ خود را بنویسید..."
            rows={3}
            className="rounded-xl resize-none"
            dir="rtl"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={sending || !reply.trim()} className="rounded-xl gap-1.5">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              ارسال پاسخ
            </Button>
          </div>
        </form>

        {/* Status actions */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
          <span className="text-[11px] text-muted-foreground">تغییر وضعیت:</span>
          <Button
            size="sm"
            variant="outline"
            disabled={updatingStatus || ticket.status === "open"}
            onClick={() => changeStatus("open", "باز شد")}
            className="rounded-lg h-8 gap-1 text-xs"
          >
            <AlertTriangle className="w-3 h-3" />
            باز کردن
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={updatingStatus || ticket.status === "answered"}
            onClick={() => changeStatus("answered", "پاسخ داده شد")}
            className="rounded-lg h-8 gap-1 text-xs"
          >
            <CheckCircle2 className="w-3 h-3" />
            پاسخ داده شد
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={updatingStatus || ticket.status === "closed"}
            onClick={() => changeStatus("closed", "بسته شد")}
            className="rounded-lg h-8 gap-1 text-xs text-destructive hover:text-destructive"
          >
            <Ban className="w-3 h-3" />
            بستن
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   ۱۲. مدیریت دامنه و رکوردها — DomainTab
   ============================================================ */
function DomainTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- DNS Records management (TXT & CNAME) ---
  const [dnsRecords, setDnsRecords] = useState<{ id: string; type: "TXT" | "CNAME"; name: string; value: string }[]>([]);
  const [newRecord, setNewRecord] = useState<{ type: "TXT" | "CNAME"; name: string; value: string }>({ type: "TXT", name: "", value: "" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/domain", { cache: "no-store" });
        const data = await res.json();
        setSettings(data.settings || {});
        // Load DNS records from settings
        const recordsStr = data.settings?.dns_records_json || "[]";
        try {
          setDnsRecords(JSON.parse(recordsStr));
        } catch { setDnsRecords([]); }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ...settings,
            dns_records_json: JSON.stringify(dnsRecords),
          },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("تنظیمات دامنه ذخیره شد");
    } catch {
      toast.error("خطا در ذخیره");
    } finally { setSaving(false); }
  }

  function addRecord() {
    if (!newRecord.name.trim() || !newRecord.value.trim()) {
      toast.error("نام و مقدار رکورد را پر کنید");
      return;
    }
    setDnsRecords((prev) => [...prev, { ...newRecord, id: `rec-${Date.now()}` }]);
    setNewRecord({ type: "TXT", name: "", value: "" });
  }

  function removeRecord(id: string) {
    setDnsRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const fields = [
    { key: "site_url", label: "آدرس اصلی سایت", placeholder: "https://fittup.ir", desc: "آدرس canonical سایت" },
    { key: "domain_primary", label: "دامنه اصلی", placeholder: "fittup.ir", desc: "دامنه اصلی سایت" },
    { key: "domain_www", label: "دامنه www", placeholder: "www.fittup.ir", desc: "دامنه www (در صورت وجود)" },
    { key: "domain_redirect_www", label: "ریدایرکت www به غیر-www", placeholder: "yes / no", desc: "آیا www به دامنه اصلی ریدایرکت شود؟" },
    { key: "domain_ssl", label: "وضعیت SSL", placeholder: "active / inactive", desc: "وضعیت گواهینامه SSL" },
    { key: "dns_a_record", label: "رکورد A (IPv4)", placeholder: "123.45.67.89", desc: "آی‌پی سرور برای رکورد A" },
    { key: "dns_aaaa_record", label: "رکورد AAAA (IPv6)", placeholder: "::1", desc: "آی‌پی IPv6 (در صورت وجود)" },
    { key: "dns_mx_record", label: "رکورد MX (ایمیل)", placeholder: "mail.fittup.ir", desc: "سرور ایمیل برای رکورد MX" },
    { key: "redirect_old_1", label: "ریدایرکت دامنه قدیمی ۱", placeholder: "old-domain.ir → fittup.ir", desc: "دامنه قدیمی که باید ریدایرکت شود" },
    { key: "redirect_old_2", label: "ریدایرکت دامنه قدیمی ۲", placeholder: "", desc: "دامنه قدیمی دیگر (اختیاری)" },
  ];

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* تنظیمات پایه دامنه */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-primary" />
          <h3 className="font-bold">مدیریت دامنه و رکوردهای DNS</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          این بخش برای ثبت و مدیریت تنظیمات دامنه، رکوردهای DNS و ریدایرکت‌هاست.
          تغییرات اینجا فقط اطلاعات را ذخیره می‌کند — برای اعمال واقعی باید در پنل دامنه یا سرور تنظیم کنید.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs font-bold">{f.label}</Label>
              <Input
                value={settings[f.key] || ""}
                onChange={(e) => setSettings((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                dir="ltr"
                className="rounded-xl text-sm"
              />
              <p className="text-[10px] text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* رکوردهای TXT و CNAME */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-bold">رکوردهای TXT و CNAME</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          رکوردهای TXT (برای SPF، DKIM، تأیید مالکیت) و CNAME (برای ساب‌دامنه‌ها) را مدیریت کنید.
        </p>

        {/* لیست رکوردها */}
        {dnsRecords.length > 0 && (
          <div className="space-y-2 mb-4">
            {dnsRecords.map((rec) => (
              <div key={rec.id} className="flex items-center gap-2 p-3 rounded-xl border border-orange-100 bg-orange-50/30">
                <span
                  className="text-[10px] font-bold px-2 py-1 rounded-md text-white shrink-0"
                  style={{ background: rec.type === "TXT" ? "#f59e0b" : "#8b5cf6" }}
                >
                  {rec.type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate" dir="ltr">{rec.name}</p>
                  <p className="text-[10px] text-slate-500 truncate" dir="ltr">{rec.value}</p>
                </div>
                <button
                  onClick={() => removeRecord(rec.id)}
                  className="shrink-0 p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* فرم افزودن رکورد جدید */}
        <div className="p-3 rounded-xl border-2 border-dashed border-orange-200 bg-white">
          <p className="text-[11px] font-bold text-slate-700 mb-2">افزودن رکورد جدید</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] mb-1">نوع رکورد</Label>
              <select
                value={newRecord.type}
                onChange={(e) => setNewRecord((prev) => ({ ...prev, type: e.target.value as "TXT" | "CNAME" }))}
                className="w-full h-10 rounded-xl border border-orange-100 bg-white px-3 text-sm"
              >
                <option value="TXT">TXT</option>
                <option value="CNAME">CNAME</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] mb-1">نام / Host</Label>
              <Input
                value={newRecord.name}
                onChange={(e) => setNewRecord((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={newRecord.type === "TXT" ? "@ یا _dmarc" : "www یا sub"}
                dir="ltr"
                className="rounded-xl text-sm h-10"
              />
            </div>
            <div>
              <Label className="text-[10px] mb-1">مقدار / Value</Label>
              <Input
                value={newRecord.value}
                onChange={(e) => setNewRecord((prev) => ({ ...prev, value: e.target.value }))}
                placeholder={newRecord.type === "TXT" ? "v=spf1 include:..." : "fittup.ir"}
                dir="ltr"
                className="rounded-xl text-sm h-10"
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="outline" onClick={addRecord} className="rounded-xl gap-1 text-xs">
              <Plus className="w-3.5 h-3.5" />
              افزودن رکورد
            </Button>
          </div>
        </div>
      </Card>

      {/* دکمه ذخیره */}
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="rounded-xl gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          ذخیره همه تنظیمات
        </Button>
      </div>

      {/* راهنما */}
      <Card className="p-5 bg-orange-50/30 border-orange-200">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <h4 className="font-bold text-sm text-slate-800">راهنمای تنظیم دامنه</h4>
        </div>
        <div className="space-y-2 text-[11px] text-slate-600 leading-relaxed">
          <p>• <b>رکورد A:</b> آی‌پی سرور خود را در پنل دامنه (ایران‌سامانه یا پنل دامنه) وارد کنید.</p>
          <p>• <b>رکورد MX:</b> برای فعال‌سازی ایمیل، رکورد MX را به سرور ایمیل خود指向 کنید.</p>
          <p>• <b>رکورد TXT:</b> برای SPF، DKIM، DMARC و تأیید مالکیت دامنه استفاده می‌شود.</p>
          <p>• <b>رکورد CNAME:</b> برای ساب‌دامنه‌ها (مثل www، blog، shop) استفاده می‌شود.</p>
          <p>• <b>SSL:</b> برای فعال‌سازی HTTPS، از Let's Encrypt در سرور یا cPanel استفاده کنید.</p>
          <p>• <b>ریدایرکت www:</b> در فایل <code dir="ltr" className="bg-slate-100 px-1 rounded">.htaccess</code> یا Nginx تنظیم کنید.</p>
          <p>• <b>ریدایرکت دامنه قدیمی:</b> دامنه قدیمی را به دامنه جدید در پنل دامنه pointing کنید.</p>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   ۱۳. سئو هوشمند — SeoAgentTab (fully automated agentic SEO)
   ============================================================ */
type SeoMode = "full" | "continue" | "strategy_only" | "content_refresh";

function SeoAgentTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [mode, setMode] = useState<SeoMode>("full");
  const [articleCount, setArticleCount] = useState(5);
  // If true, generated articles are published immediately instead of being
  // scheduled for future publishing. Default is false (schedule articles
  // spaced out over weeks based on the strategy content calendar).
  const [publishImmediately, setPublishImmediately] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [liveRun, setLiveRun] = useState<any>(null);
  const [showStrategy, setShowStrategy] = useState(true);
  const [showPlanned, setShowPlanned] = useState(true);
  const [showLogs, setShowLogs] = useState(true);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Initial load
  const loadData = async () => {
    try {
      const res = await fetch("/api/admin/seo-agent", { cache: "no-store" });
      const d = await res.json();
      setData(d);
      if (d.running && d.currentRun?.id) {
        setCurrentRunId(d.currentRun.id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Polling for live run progress
  useEffect(() => {
    if (!currentRunId) return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const res = await fetch(`/api/admin/seo-agent/${currentRunId}`, { cache: "no-store" });
        const d = await res.json();
        if (active) {
          setLiveRun(d);
          if (d.status !== "running") {
            // Run finished — reload data and stop polling
            setCurrentRunId(null);
            loadData();
            if (d.status === "completed" || d.status === "partial") {
              toast.success(`ایجنت سئو کامل شد — ${toPersianDigits(d.successCount)} مقاله منتشر شد 🚀`);
            } else if (d.status === "failed") {
              toast.error("ایجنت سئو با خطا متوقف شد");
            }
            return;
          }
        }
      } catch {
        // ignore transient errors
      }
      if (active) {
        setTimeout(poll, 1500);
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [currentRunId]);

  // Auto-scroll logs
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [liveRun?.logs?.length]);

  async function startAgent() {
    try {
      const res = await fetch("/api/admin/seo-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, count: articleCount, publishImmediately }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "خطا در شروع ایجنت");
      setCurrentRunId(d.runId);
      setLiveRun(null);
      toast.success(d.message || "ایجنت سئو شروع شد");
    } catch (e: any) {
      toast.error(e.message || "خطا در شروع ایجنت سئو");
    }
  }

  async function resetAgent() {
    if (!confirm("آیا مطمئن هستید؟ استراتژی فعال و صف مقالات حذف می‌شود (مقالات منتشرشده باقی می‌مانند).")) return;
    try {
      const res = await fetch("/api/admin/seo-agent", { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "خطا در ریست");
      toast.success("ریست کامل انجام شد");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "خطا در ریست");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const running = !!currentRunId;
  const strategy = data?.strategy;
  const strategyContent = strategy?.content || null;
  const stats = data?.stats || { totalArticles: 0, totalViews: 0, withCover: 0, withoutCover: 0, categoryStats: {}, scheduledDrafts: 0 };
  const planned = data?.plannedArticles || [];
  const recentRuns = data?.recentRuns || [];
  const articles = data?.articles || [];
  const scheduledArticles = data?.scheduledArticles || [];

  // Compute live progress percentage
  const liveProgress = liveRun
    ? Math.min(
        100,
        Math.round(
          ((liveRun.successCount + liveRun.failCount) /
            Math.max(1, liveRun.requestedCount)) *
            100
        )
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* ===== هدر + کنترل‌ها ===== */}
      <Card className="p-5 relative overflow-hidden border-2 border-orange-200">
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-orange-100/50 blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-amber-100/40 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              <Rocket className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900">ایجنت سئو هوشمند — تمام خودکار</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-bold">
              Agentic · AvalAI · Nano Banana 2 Lite
            </span>
            {running && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                در حال اجرا
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            یک سیستم سئوی کاملاً خودکار و ایجنتیک: سایت را تحلیل می‌کند، کلمات کلیدی استخراج
            می‌کند، استراتژی جامع می‌نویسد، مقالات کامل سئوشده (۱۸۰۰+ کلمه) با تصاویر
            تولیدشده توسط هوش مصنوعی تولید و منتشر می‌کند. تصاویر ریسایز و با نام SEO-friendly
            ذخیره می‌شوند. لینک‌سازی داخلی بر اساس مقالات موجود سایت به‌صورت دقیق انجام می‌شود.
            پایدار و قابل‌استمرار — هر بار اجرا، سایت را دوباره تحلیل می‌کند.
          </p>

          {/* انتخاب حالت */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {([
              { id: "full", label: "کامل", desc: "تحلیل + استراتژی + تولید" },
              { id: "continue", label: "ادامه", desc: "تولید از صف موجود" },
              { id: "strategy_only", label: "فقط استراتژی", desc: "بدون تولید مقاله" },
              { id: "content_refresh", label: "آپدیت محتواها", desc: "بر اساس گزارش سرچ کنسول" },
            ] as { id: SeoMode; label: string; desc: string }[]).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                disabled={running}
                className={`p-2.5 rounded-xl text-right transition border ${
                  mode === m.id
                    ? "text-white border-transparent shadow-md"
                    : "bg-white text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50/30"
                }`}
                style={mode === m.id ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}
              >
                <p className="text-xs font-bold">{m.label}</p>
                <p className={`text-[10px] mt-0.5 ${mode === m.id ? "text-white/80" : "text-slate-400"}`}>{m.desc}</p>
              </button>
            ))}
          </div>

          {/* تعداد مقاله — برای حالت‌های full و continue و content_refresh */}
          {mode !== "strategy_only" && (
            <div className="flex items-center gap-3 mb-4">
              <Label className="text-xs font-bold shrink-0">تعداد مقالات:</Label>
              <div className="flex gap-1.5 flex-wrap">
                {[3, 5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setArticleCount(n)}
                    disabled={running}
                    className={`w-10 h-9 rounded-xl text-sm font-bold transition disabled:opacity-50 ${
                      articleCount === n
                        ? "text-white shadow-md"
                        : "bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100"
                    }`}
                    style={articleCount === n ? { background: "linear-gradient(135deg, #f59e0b, #f97316)" } : {}}
                  >
                    {toPersianDigits(n)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* زمان‌بندی انتشار — فقط برای حالت‌های full و continue */}
          {mode !== "strategy_only" && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 mb-4">
              <div className="flex-1">
                <Label className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  زمان‌بندی انتشار مقالات
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  در صورت فعال بودن، مقالات به‌جای انتشار فوری، به‌صورت پیش‌نویس با تاریخ انتشار
                  زمان‌بندی‌شده (یک مقاله در هر هفته بر اساس تقویم محتوایی استراتژی) ذخیره می‌شوند
                  و توسط cron publisher به‌صورت خودکار منتشر خواهند شد.
                </p>
              </div>
              <Switch
                checked={!publishImmediately}
                onCheckedChange={(checked) => setPublishImmediately(!checked)}
                disabled={running}
              />
            </div>
          )}

          {/* دکمه شروع */}
          <div className="flex gap-2">
            <Button
              onClick={startAgent}
              disabled={running}
              className="flex-1 rounded-xl text-white gap-2 h-12"
              style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
            >
              {running ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  ایجنت در حال کار کردن... ({toPersianDigits(liveRun?.successCount || 0)} موفق)
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  {mode === "full"
                    ? publishImmediately
                      ? `شروع کامل — استراتژی + انتشار فوری ${toPersianDigits(articleCount)} مقاله`
                      : `شروع کامل — استراتژی + زمان‌بندی ${toPersianDigits(articleCount)} مقاله`
                    : mode === "strategy_only"
                    ? "تولید استراتژی سئو"
                    : publishImmediately
                    ? `ادامه — تولید و انتشار فوری ${toPersianDigits(articleCount)} مقاله از صف`
                    : `ادامه — تولید و زمان‌بندی ${toPersianDigits(articleCount)} مقاله از صف`}
                </>
              )}
            </Button>
            <Button
              onClick={resetAgent}
              disabled={running}
              variant="outline"
              className="rounded-xl h-12 px-3"
              title="ریست استراتژی و صف (مقالات منتشرشده حفظ می‌شوند)"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ===== پیشرفت زنده ===== */}
      {running && liveRun && (
        <Card className="p-5 border-2 border-emerald-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <h4 className="font-bold text-sm text-slate-900">پیشرفت زنده اجرا</h4>
            </div>
            <span className="text-[10px] text-slate-400">
              {toPersianDigits(liveProgress)}٪
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-slate-100 mb-3 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #f59e0b, #f97316)" }}
              animate={{ width: `${liveProgress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded-lg bg-emerald-50">
              <p className="text-lg font-black text-emerald-600">{toPersianDigits(liveRun.successCount || 0)}</p>
              <p className="text-[10px] text-slate-500">موفق</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50">
              <p className="text-lg font-black text-red-600">{toPersianDigits(liveRun.failCount || 0)}</p>
              <p className="text-[10px] text-slate-500">ناموفق</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <p className="text-lg font-black text-slate-700">
                {toPersianDigits(Math.max(0, (liveRun.requestedCount || 0) - (liveRun.successCount || 0) - (liveRun.failCount || 0)))}
              </p>
              <p className="text-[10px] text-slate-500">باقی‌مانده</p>
            </div>
          </div>

          {/* Live log */}
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-3 max-h-72 overflow-y-auto custom-scrollbar" dir="ltr">
            <div className="space-y-1 font-mono text-[11px]">
              {(liveRun.logs || []).slice(-50).map((log: any, i: number) => (
                <div key={i} className="flex gap-2">
                  <span className="text-slate-500 shrink-0">
                    {new Date(log.ts).toLocaleTimeString("en-GB")}
                  </span>
                  <span
                    className={`shrink-0 ${
                      log.level === "error"
                        ? "text-red-400"
                        : log.level === "warn"
                        ? "text-amber-400"
                        : log.level === "success"
                        ? "text-emerald-400"
                        : "text-sky-400"
                    }`}
                  >
                    [{log.level.toUpperCase()}]
                  </span>
                  <span
                    className={`text-slate-200 ${
                      log.level === "error" ? "text-red-300" : log.level === "success" ? "text-emerald-300" : ""
                    }`}
                    dir="rtl"
                  >
                    {log.msg}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </Card>
      )}

      {/* ===== خلاصه اجرای قبلی (اگر just finished) ===== */}
      {!running && liveRun && liveRun.status !== "running" && (
        <Card className={`p-4 ${liveRun.status === "completed" ? "bg-emerald-50/40 border-emerald-200" : liveRun.status === "partial" ? "bg-amber-50/40 border-amber-200" : "bg-red-50/40 border-red-200"}`}>
          <div className="flex items-center gap-2 mb-2">
            {liveRun.status === "completed" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : liveRun.status === "partial" ? (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
            <h4 className="font-bold text-sm text-slate-900">نتیجه آخرین اجرا</h4>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-black text-emerald-600">{toPersianDigits(liveRun.successCount || 0)}</p>
              <p className="text-[10px] text-slate-500">مقالات منتشر شده</p>
            </div>
            <div>
              <p className="text-2xl font-black text-red-600">{toPersianDigits(liveRun.failCount || 0)}</p>
              <p className="text-[10px] text-slate-500">خطاها</p>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-700">
                {liveRun.durationMs ? toPersianDigits(Math.round(liveRun.durationMs / 1000)) : "۰"}
              </p>
              <p className="text-[10px] text-slate-500">ثانیه</p>
            </div>
          </div>
        </Card>
      )}

      {/* ===== استراتژی سئو ===== */}
      {strategy && (
        <Card className="p-5">
          <button
            onClick={() => setShowStrategy(!showStrategy)}
            className="flex items-center gap-2 w-full text-right mb-3"
          >
            <SearchIcon className="w-5 h-5 text-orange-500" />
            <h4 className="font-bold text-sm text-slate-900 flex-1">
              استراتژی سئو (نسخه {toPersianDigits(strategy.version)})
            </h4>
            <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform ${showStrategy ? "-rotate-90" : ""}`} />
          </button>
          {showStrategy && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500 bg-orange-50/50 p-2.5 rounded-lg">{strategy.summary}</p>

              {/* Content pillars */}
              {strategyContent?.contentPillars?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">ستون‌های محتوایی</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {strategyContent.contentPillars.map((p: any) => (
                      <div key={p.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-xs font-bold text-slate-800">{p.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target keywords */}
              {strategyContent?.targetKeywords?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-700">کلمات کلیدی هدف</p>
                    <span className="text-[10px] text-slate-400">{toPersianDigits(strategyContent.targetKeywords.length)} کلمه</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                    {strategyContent.targetKeywords.map((k: any, i: number) => (
                      <span
                        key={i}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 border border-orange-200 font-medium flex items-center gap-1.5"
                      >
                        {k.keyword}
                        <span className="text-[9px] px-1 py-0.5 rounded bg-orange-100 text-orange-600">
                          {k.difficulty === "low" ? "آسان" : k.difficulty === "medium" ? "متوسط" : "سخت"}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Clusters */}
              {strategyContent?.clusters?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">کلاسترهای موضوعی</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {strategyContent.clusters.map((c: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg bg-amber-50/40 border border-amber-100">
                        <p className="text-[11px] font-bold text-amber-800">{c.theme}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{(c.keywords || []).join("، ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sustainability plan */}
              {strategyContent?.sustainabilityPlan && (
                <div className="p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100">
                  <p className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    برنامه پایداری
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{strategyContent.sustainabilityPlan}</p>
                </div>
              )}

              {strategy.lastRunAt && (
                <p className="text-[10px] text-slate-400 text-left" dir="ltr">
                  آخرین اجرا: {new Date(strategy.lastRunAt).toLocaleString("fa-IR")}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ===== صف مقالات برنامه‌ریزی‌شده ===== */}
      {planned.length > 0 && (
        <Card className="p-5">
          <button
            onClick={() => setShowPlanned(!showPlanned)}
            className="flex items-center gap-2 w-full text-right mb-3"
          >
            <ListChecks className="w-5 h-5 text-orange-500" />
            <h4 className="font-bold text-sm text-slate-900 flex-1">
              صف مقالات برنامه‌ریزی‌شده ({toPersianDigits(planned.length)} مقاله)
            </h4>
            <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform ${showPlanned ? "-rotate-90" : ""}`} />
          </button>
          {showPlanned && (
            <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
              {planned.map((p: any) => (
                <div key={p.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs font-bold text-slate-800 truncate flex-1">{p.title}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold shrink-0">
                      {p.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>🔑 {p.keyword}</span>
                    <span dir="ltr">{p.slug}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ===== آمار فعلی ===== */}
      <Card className="p-5">
        <h4 className="font-bold text-sm text-slate-900 mb-3">آمار فعلی مقالات</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          <div className="p-3 rounded-xl bg-orange-50/50 text-center">
            <p className="text-2xl font-black text-orange-600">{toPersianDigits(stats.totalArticles)}</p>
            <p className="text-[10px] text-slate-500">کل مقالات</p>
          </div>
          <div className="p-3 rounded-xl bg-orange-50/50 text-center">
            <p className="text-2xl font-black text-orange-600">{toPersianDigits(stats.totalViews)}</p>
            <p className="text-[10px] text-slate-500">بازدید کل</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/50 text-center">
            <p className="text-2xl font-black text-emerald-600">{toPersianDigits(stats.withCover)}</p>
            <p className="text-[10px] text-slate-500">با تصویر</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/50 text-center">
            <p className="text-2xl font-black text-amber-600">{toPersianDigits(stats.withoutCover)}</p>
            <p className="text-[10px] text-slate-500">بدون تصویر</p>
          </div>
          <div className="p-3 rounded-xl bg-sky-50/50 text-center">
            <p className="text-2xl font-black text-sky-600">{toPersianDigits(stats.scheduledDrafts || 0)}</p>
            <p className="text-[10px] text-slate-500">زمان‌بندی‌شده</p>
          </div>
        </div>

        {/* Scheduled draft articles list (auto-publish via cron) */}
        {scheduledArticles.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-sky-500" />
              <h5 className="text-xs font-bold text-slate-700">
                مقالات زمان‌بندی‌شده برای انتشار ({toPersianDigits(scheduledArticles.length)} مقاله)
              </h5>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
              {scheduledArticles.map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 text-[11px] p-2 rounded-lg bg-sky-50/60 border border-sky-100"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 truncate">{a.title}</p>
                    <p className="text-[9px] text-slate-400" dir="ltr">/{a.slug}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-[10px] font-bold text-sky-700">
                      {new Date(a.scheduledAt).toLocaleDateString("fa-IR")}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {new Date(a.scheduledAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent articles list */}
        {articles.length > 0 && (
          <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
            {articles.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 text-[11px] p-2 rounded-lg bg-slate-50">
                {a.coverImage ? (
                  <img src={toWebp(a.coverImage)} alt="" width={32} height={32} className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-3 h-3 text-slate-400" />
                  </div>
                )}
                <span className="font-medium text-slate-700 truncate flex-1">{a.title}</span>
                <span className="text-slate-400 shrink-0">{toPersianDigits(a.views)} بازدید</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ===== تاریخچه اجراها ===== */}
      {recentRuns.length > 0 && (
        <Card className="p-5">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-2 w-full text-right mb-3"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <h4 className="font-bold text-sm text-slate-900 flex-1">تاریخچه اجراها</h4>
            <ChevronLeft className={`w-4 h-4 text-slate-400 transition-transform ${showLogs ? "-rotate-90" : ""}`} />
          </button>
          {showLogs && (
            <div className="space-y-1.5">
              {recentRuns.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        r.status === "completed"
                          ? "bg-emerald-500"
                          : r.status === "running"
                          ? "bg-sky-500 animate-pulse"
                          : r.status === "partial"
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                    />
                    <span className="font-medium text-slate-700">{r.mode}</span>
                    <span className="text-slate-400" dir="ltr">{new Date(r.startedAt).toLocaleString("fa-IR")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="text-emerald-600">✓ {toPersianDigits(r.successCount)}</span>
                    <span className="text-red-600">✗ {toPersianDigits(r.failCount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   لاگ خطاها — Error Logs Management
   ============================================================ */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${toPersianDigits(sec)} ثانیه پیش`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${toPersianDigits(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${toPersianDigits(hr)} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${toPersianDigits(day)} روز پیش`;
  return new Date(dateStr).toLocaleDateString("fa-IR");
}

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [reviewedFilter, setReviewedFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const limit = 50;

  async function load(resetOffset = false) {
    const newOffset = resetOffset ? 0 : offset;
    if (resetOffset) setOffset(0);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(newOffset),
      });
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (reviewedFilter !== "all") params.set("reviewed", reviewedFilter);
      const res = await fetch(`/api/error-log?${params}&_t=${Date.now()}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      if (resetOffset) setSelectedIds(new Set());
    } catch {
      toast.error("خطا در بارگذاری لاگ‌ها");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, reviewedFilter]);

  async function markReviewed(ids: string[]) {
    try {
      const res = await fetch("/api/error-log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      toast.success(toPersianDigits(ids.length) + " لاگ بررسی‌شده شد");
      setSelectedIds(new Set());
      load();
    } catch {
      toast.error("خطا");
    }
  }

  async function markAllReviewed() {
    if (!confirm("همه لاگ‌های بررسی‌نشده به‌عنوان بررسی‌شده علامت بخورند؟")) return;
    try {
      const res = await fetch("/api/error-log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(toPersianDigits(data.updated || 0) + " لاگ بررسی‌شده شد");
      load(true);
    } catch {
      toast.error("خطا");
    }
  }

  async function deleteLogs(ids: string[]) {
    if (!confirm(`حذف ${toPersianDigits(ids.length)} لاگ؟`)) return;
    try {
      const res = await fetch("/api/error-log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
      toast.success("لاگ‌ها حذف شدند");
      setSelectedIds(new Set());
      load();
    } catch {
      toast.error("خطا در حذف");
    }
  }

  async function deleteAll() {
    if (!confirm("همه لاگ‌های خطا حذف شوند؟ این عمل قابل بازگشت نیست!")) return;
    try {
      const res = await fetch("/api/error-log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(toPersianDigits(data.deleted || 0) + " لاگ حذف شد");
      load(true);
    } catch {
      toast.error("خطا در حذف");
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  const sourceBadge: Record<string, { label: string; bg: string; text: string }> = {
    client: { label: "کلاینت", bg: "#dbeafe", text: "#1e40af" },
    api: { label: "API", bg: "#ffedd5", text: "#9a3412" },
    server: { label: "سرور", bg: "#fee2e2", text: "#991b1b" },
  };

  return (
    <div className="p-4 space-y-3 max-w-6xl mx-auto">
      {/* Filters + actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[130px] rounded-xl glass"><SelectValue placeholder="منبع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه منابع</SelectItem>
            <SelectItem value="client">کلاینت</SelectItem>
            <SelectItem value="api">API</SelectItem>
            <SelectItem value="server">سرور</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reviewedFilter} onValueChange={setReviewedFilter}>
          <SelectTrigger className="w-[140px] rounded-xl glass"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            <SelectItem value="false">بررسی‌نشده</SelectItem>
            <SelectItem value="true">بررسی‌شده</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Badge className="bg-primary/15 text-primary text-xs">
          {toPersianDigits(total)} لاگ
        </Badge>
        <Button
          onClick={markAllReviewed}
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-xs"
          disabled={total === 0}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          بررسی همه
        </Button>
        <Button
          onClick={deleteAll}
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-xs text-red-600 hover:bg-red-50 border-red-200"
          disabled={total === 0}
        >
          <Trash2 className="w-3.5 h-3.5" />
          حذف همه
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <Card className="p-3 glass-gold flex items-center gap-2">
          <span className="text-sm font-bold">
            {toPersianDigits(selectedIds.size)} لاگ انتخاب شده
          </span>
          <div className="flex-1" />
          <Button
            onClick={() => markReviewed(Array.from(selectedIds))}
            size="sm"
            className="rounded-xl gap-1.5 text-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            بررسی شد
          </Button>
          <Button
            onClick={() => deleteLogs(Array.from(selectedIds))}
            size="sm"
            variant="outline"
            className="rounded-xl gap-1.5 text-xs text-red-600 hover:bg-red-50 border-red-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            حذف
          </Button>
        </Card>
      )}

      {/* Logs list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-12 glass text-center">
          <Bug className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">هیچ لاگ خطایی یافت نشد</p>
          <p className="text-xs text-muted-foreground/70 mt-1">یا همه خطاها بررسی شده‌اند یا هنوز خطایی ثبت نشده است.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <ErrorLogCard
              key={log.id}
              log={log}
              selected={selectedIds.has(log.id)}
              onToggle={() => toggleSelect(log.id)}
              onMarkReviewed={() => markReviewed([log.id])}
              onDelete={() => deleteLogs([log.id])}
              sourceBadge={sourceBadge}
            />
          ))}
          {/* Load more */}
          {offset + limit < total && (
            <div className="flex justify-center pt-3">
              <Button
                onClick={() => {
                  const next = offset + limit;
                  setOffset(next);
                  // load with new offset
                  (async () => {
                    setLoading(true);
                    try {
                      const params = new URLSearchParams({
                        limit: String(limit),
                        offset: String(next),
                      });
                      if (sourceFilter !== "all") params.set("source", sourceFilter);
                      if (reviewedFilter !== "all") params.set("reviewed", reviewedFilter);
                      const res = await fetch(`/api/error-log?${params}&_t=${Date.now()}`, { cache: "no-store", credentials: "include" });
                      const data = await res.json();
                      setLogs((prev) => [...prev, ...(data.logs || [])]);
                      setTotal(data.total || 0);
                    } catch {
                      toast.error("خطا در بارگذاری");
                    } finally {
                      setLoading(false);
                    }
                  })();
                }}
                variant="outline"
                className="rounded-xl gap-1.5"
              >
                <AlertTriangle className="w-4 h-4" />
                بارگذاری بیشتر ({toPersianDigits(total - offset - limit)} لاگ باقی‌مانده)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorLogCard({
  log,
  selected,
  onToggle,
  onMarkReviewed,
  onDelete,
  sourceBadge,
}: {
  log: any;
  selected: boolean;
  onToggle: () => void;
  onMarkReviewed: () => void;
  onDelete: () => void;
  sourceBadge: Record<string, { label: string; bg: string; text: string }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showStack, setShowStack] = useState(false);
  const badge = sourceBadge[log.source] || { label: log.source, bg: "#e2e8f0", text: "#475569" };

  return (
    <Card className={`p-4 glass ${log.reviewed ? "opacity-60" : ""} ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className="mt-1 w-5 h-5 rounded-md border-2 border-slate-300 flex items-center justify-center shrink-0 hover:border-primary transition"
          style={selected ? { background: "#f59e0b", borderColor: "#f59e0b" } : {}}
        >
          {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge
              className="text-[10px] font-bold"
              style={{ background: badge.bg, color: badge.text }}
            >
              {badge.label}
            </Badge>
            {log.statusCode > 0 && (
              <Badge
                className="text-[10px] font-bold"
                style={{
                  background: log.statusCode >= 500 ? "#fee2e2" : log.statusCode >= 400 ? "#fef3c7" : "#f1f5f9",
                  color: log.statusCode >= 500 ? "#991b1b" : log.statusCode >= 400 ? "#92400e" : "#475569",
                }}
              >
                {toPersianDigits(log.statusCode)}
              </Badge>
            )}
            {log.method && (
              <Badge variant="outline" className="text-[10px] font-mono" dir="ltr">
                {log.method}
              </Badge>
            )}
            {log.reviewed ? (
              <Badge className="text-[10px] bg-emerald-100 text-emerald-700">
                <Check className="w-3 h-3 ml-1" />
                بررسی‌شده
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-amber-100 text-amber-700">
                <Clock className="w-3 h-3 ml-1" />
                جدید
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground mr-auto" title={new Date(log.createdAt).toLocaleString("fa-IR")}>
              {timeAgo(log.createdAt)}
            </span>
          </div>

          {/* Message */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="block w-full text-right"
          >
            <p className={`text-sm font-medium text-slate-800 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {log.message}
            </p>
          </button>

          {/* URL */}
          {log.url && (
            <p className="text-[11px] text-muted-foreground mt-1.5 truncate font-mono" dir="ltr" title={log.url}>
              📍 {log.url}
            </p>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 space-y-2 text-xs">
              {/* User info */}
              {log.user && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                    {log.user.name?.[0] || "؟"}
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">{log.user.name || "بدون نام"}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{log.user.mobile}</p>
                  </div>
                </div>
              )}
              {/* User agent */}
              {log.userAgent && (
                <p className="text-[10px] text-muted-foreground font-mono break-all" dir="ltr">
                  UA: {log.userAgent}
                </p>
              )}
              {/* Context */}
              {log.context && log.context !== "{}" && (
                <div className="p-2 rounded-lg bg-muted/40">
                  <p className="text-[10px] text-muted-foreground mb-1 font-bold">زمینه:</p>
                  <pre className="text-[10px] font-mono text-slate-700 whitespace-pre-wrap break-all" dir="ltr">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(log.context), null, 2); } catch { return log.context; }
                    })()}
                  </pre>
                </div>
              )}
              {/* Stack trace */}
              {log.stack && (
                <div className="p-2 rounded-lg bg-slate-900 text-slate-100">
                  <button
                    onClick={() => setShowStack(!showStack)}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-300 mb-1"
                  >
                    {showStack ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Stack trace
                  </button>
                  {showStack && (
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar" dir="ltr">
                      {log.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 mt-2 -mb-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-muted-foreground hover:text-primary transition px-1.5 py-1 rounded-lg hover:bg-muted"
            >
              {expanded ? "بستن" : "جزئیات"}
            </button>
            {!log.reviewed && (
              <button
                onClick={onMarkReviewed}
                className="text-[10px] text-emerald-600 hover:bg-emerald-50 transition px-1.5 py-1 rounded-lg flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" />
                بررسی شد
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-[10px] text-red-600 hover:bg-red-50 transition px-1.5 py-1 rounded-lg flex items-center gap-1 mr-auto"
            >
              <Trash2 className="w-3 h-3" />
              حذف
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   تنظیمات سایت — SettingsTab
   ============================================================ */
function SettingsTab() {
  const [settings, setSettings] = useState<{ key: string; label: string; value: string }[]>([]);
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({
    basic: 350000,
    standard: 800000,
    advanced: 1200000,
    ultimate: 1800000,
  });
  const [defaultPrices, setDefaultPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, pricingRes] = await Promise.all([
          fetch("/api/admin/settings", { cache: "no-store" }),
          fetch("/api/admin/pricing", { cache: "no-store" }),
        ]);
        const settingsData = await settingsRes.json();
        setSettings((settingsData.settings || []).filter((s: any) => !s.key.startsWith("plan_price_")));

        const pricingData = await pricingRes.json();
        const prices: Record<string, number> = {};
        const defs: Record<string, number> = {};
        for (const p of pricingData.prices || []) {
          prices[p.id] = p.currentPrice;
          defs[p.id] = p.defaultPrice;
        }
        setPlanPrices(prices);
        setDefaultPrices(defs);
      } catch {
        toast.error("خطا در بارگذاری تنظیمات");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function savePrices() {
    setSavingPrices(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices: planPrices }),
      });
      if (!res.ok) throw new Error();
      toast.success("قیمت‌ها در کل سایت اعمال شد ✅");
    } catch {
      toast.error("خطا در ذخیره قیمت‌ها");
    } finally {
      setSavingPrices(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      // Save other settings
      await Promise.all(
        settings.map((s) =>
          fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: s.key, value: s.value, label: s.label }),
          })
        )
      );
      toast.success("تنظیمات ذخیره شد ✅");
    } catch {
      toast.error("خطا در ذخیره");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Plan Prices */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Tags className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-sm text-slate-900">قیمت پلن‌ها (تومان)</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(planPrices).map(([planId, price]) => (
            <div key={planId}>
              <Label className="text-xs font-bold mb-1 block">
                {PLAN_LABELS[planId as keyof typeof PLAN_LABELS] || planId}
              </Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => { const v = e.target.value; setPlanPrices((p) => ({ ...p, [planId]: v ? Number(v) : undefined } as any)); }}
                className="rounded-xl"
                dir="ltr"
              />
              {defaultPrices[planId] !== undefined && (
                <p className="text-[10px] text-slate-400 mt-1">
                  پیش‌فرض: {toPersianDigits(defaultPrices[planId].toLocaleString("en-US"))} ت
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Button
            onClick={savePrices}
            disabled={savingPrices}
            className="rounded-xl text-white gap-2"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            {savingPrices ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> در حال ذخیره...</>
            ) : (
              <><Save className="w-4 h-4" /> اعمال قیمت‌ها در کل سایت</>
            )}
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={() => {
              if (Object.keys(defaultPrices).length > 0) {
                setPlanPrices({ ...defaultPrices });
                toast.success("قیمت‌ها به حالت پیش‌فرض بازگردانده شد (برای اعمال، ذخیره کنید)");
              }
            }}
          >
            بازگشت به پیش‌فرض
          </Button>
        </div>
        <p className="text-[11px] text-emerald-600 mt-2 flex items-center gap-1">
          ✓ با ذخیره، قیمت‌ها فوراً در تمام سایت (صفحه اشتراک‌ها، پرداخت و...) اعمال می‌شود.
        </p>
      </Card>

      {/* Other Settings */}
      {settings.filter((s) => !s.key.startsWith("plan_price_")).length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-sm text-slate-900">سایر تنظیمات</h3>
          </div>
          <div className="space-y-3">
            {settings
              .filter((s) => !s.key.startsWith("plan_price_"))
              .map((s) => (
                <div key={s.key}>
                  <Label className="text-xs font-bold mb-1 block">{s.label || s.key}</Label>
                  {s.key === "app_latest_version_code" || s.key === "app_min_version_code" ? (
                    <Input
                      type="number"
                      dir="ltr"
                      value={s.value}
                      onChange={(e) => setSettings((arr) => arr.map((x) => (x.key === s.key ? { ...x, value: e.target.value } : x)))}
                      className="rounded-xl text-sm font-stat"
                      placeholder="1"
                    />
                  ) : (
                    <Input
                      value={s.value}
                      onChange={(e) => setSettings((arr) => arr.map((x) => (x.key === s.key ? { ...x, value: e.target.value } : x)))}
                      className="rounded-xl text-sm"
                    />
                  )}
                  {s.key === "app_latest_version_code" && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      شماره نسخه (versionCode) آخرین نسخه APK منتشرشده در کافه‌بازار — عدد صحیح ۱ تا ۱۰۰۰۰۰۰
                    </p>
                  )}
                  {s.key === "app_min_version_code" && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      کاربران اپ با کد نسخه کمتر از این عدد، آپدیت اجباری می‌گیرند — عدد صحیح ۱ تا ۱۰۰۰۰۰۰
                    </p>
                  )}
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Save Button */}
      <Button
        onClick={saveAll}
        disabled={saving}
        className="w-full rounded-xl text-white gap-2 h-12"
        style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            در حال ذخیره...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            ذخیره تنظیمات
          </>
        )}
      </Button>
    </div>
  );
}

/* ============================================================
   نظرسنجی‌ها — آمار، نمودار، جدول + تحلیل هوشمند AI
   ============================================================ */
type SurveyStats = {
  total: number;
  overallAvg: number;
  perQuestion: { id: string; label: string; avg: number; count: number }[];
  perPlan: { plan: string; planLabel: string; avg: number; count: number }[];
};

type SurveyListItem = {
  id: string;
  userId: string;
  userName: string;
  userMobile: string;
  plan: string;
  planLabel: string;
  ratings: string; // JSON string
  comment: string;
  createdAt: string;
};

type SurveyAnalysisResult = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  overallSatisfaction: number; // 0-5
  sentiment: "very_positive" | "positive" | "neutral" | "negative" | "very_negative";
};

const SURVEY_PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "همه پلن‌ها" },
  { value: "basic", label: "اقتصادی" },
  { value: "standard", label: "استاندارد" },
  { value: "advanced", label: "پیشرفته" },
  { value: "ultimate", label: "حرفه‌ای" },
];

const SURVEY_SENTIMENT_LABELS: Record<SurveyAnalysisResult["sentiment"], { label: string; color: string; bg: string }> = {
  very_positive: { label: "بسیار مثبت", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  positive:      { label: "مثبت",       color: "text-emerald-600", bg: "bg-emerald-50/70 border-emerald-200/70" },
  neutral:       { label: "خنثی",       color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  negative:      { label: "منفی",       color: "text-red-600",     bg: "bg-red-50 border-red-200" },
  very_negative: { label: "بسیار منفی", color: "text-red-700",     bg: "bg-red-100 border-red-300" },
};

function satisfactionColor(v: number): string {
  if (v >= 4.5) return "text-emerald-600";
  if (v >= 3.5) return "text-lime-600";
  if (v >= 2.5) return "text-amber-600";
  if (v > 0) return "text-red-600";
  return "text-muted-foreground";
}

function satisfactionLabel(v: number): string {
  if (v >= 4.5) return "عالی";
  if (v >= 3.5) return "خوب";
  if (v >= 2.5) return "متوسط";
  if (v > 0) return "ضعیف";
  return "—";
}

function SurveysTab() {
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // فیلترها
  const [plan, setPlan] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // modal تحلیل AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<SurveyAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const pageSize = 15;

  function buildQuery(p: number) {
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(pageSize));
    if (plan) params.set("plan", plan);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search) params.set("search", search);
    return params;
  }

  async function load(p = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/surveys?${buildQuery(p).toString()}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "خطا در دریافت نظرسنجی‌ها");
      setStats(d.stats || null);
      setSurveys(d.surveys || []);
      setPage(d.page || 1);
      setTotalPages(d.totalPages || 1);
      setTotal(d.stats?.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, from, to, search]);

  async function runAnalyze() {
    setAiOpen(true);
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const res = await fetch("/api/admin/surveys/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, from, to }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "خطا در تحلیل");
      setAiAnalysis(d.analysis);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "خطا");
    } finally {
      setAiLoading(false);
    }
  }

  function applySearch() {
    setSearch(searchInput.trim());
    setPage(1);
  }

  // داده نمودار Bar برای میانگین هر سوال
  const chartData = (stats?.perQuestion || []).map((q) => ({
    name: q.label,
    avg: q.avg,
    count: q.count,
  }));

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      {/* فیلترها + دکمه تحلیل */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold">پلن</Label>
              <Select value={plan} onValueChange={(v) => { setPlan(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] rounded-xl">
                  <SelectValue placeholder="همه پلن‌ها" />
                </SelectTrigger>
                <SelectContent>
                  {SURVEY_PLAN_OPTIONS.map((p) => (
                    <SelectItem key={p.value || "all"} value={p.value || "all"}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PersianDatePicker
              value={from}
              onChange={(v) => { setFrom(v || ""); setPage(1); }}
              label="از تاریخ"
              placeholder="شروع بازه"
              className="w-[170px]"
            />
            <PersianDatePicker
              value={to}
              onChange={(v) => { setTo(v || ""); setPage(1); }}
              label="تا تاریخ"
              placeholder="پایان بازه"
              className="w-[170px]"
            />

            <div className="flex flex-col gap-1">
              <Label className="text-xs font-bold">جستجوی کاربر</Label>
              <div className="flex gap-1">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
                  placeholder="نام یا موبایل..."
                  className="rounded-xl w-[180px]"
                />
                <Button size="icon" onClick={applySearch} className="rounded-xl">
                  <SearchIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="ms-auto">
              <Button
                onClick={runAnalyze}
                disabled={loading || total === 0}
                className="rounded-xl gap-2 text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
              >
                <Wand2 className="w-4 h-4" />
                تحلیل هوشمند AI
              </Button>
            </div>
          </div>

          {(plan || from || to || search) && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">فیلتر فعال:</span>
              {plan && <Badge variant="secondary" className="rounded-lg">{SURVEY_PLAN_OPTIONS.find((p) => p.value === plan)?.label}</Badge>}
              {(from || to) && (
                <Badge variant="secondary" className="rounded-lg">
                  {from ? new Date(from).toLocaleDateString("fa-IR") : "—"} تا {to ? new Date(to).toLocaleDateString("fa-IR") : "—"}
                </Badge>
              )}
              {search && <Badge variant="secondary" className="rounded-lg">«{search}»</Badge>}
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg h-7 text-xs"
                onClick={() => { setPlan(""); setFrom(""); setTo(""); setSearch(""); setSearchInput(""); setPage(1); }}
              >
                پاک کردن فیلترها
              </Button>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* KPI کارت‌ها */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={ClipboardList} label="کل نظرسنجی‌ها" value={toPersianDigits(stats?.total || 0)} color="cyan" />
          <KpiCard
            icon={Star}
            label="میانگین رضایت کلی"
            value={`${toPersianDigits(stats?.overallAvg || 0)} / ۵`}
            sub={satisfactionLabel(stats?.overallAvg || 0)}
            color="amber"
          />
          <KpiCard
            icon={ThumbsUp}
            label="بالاترین نمره"
            value={stats && stats.perQuestion.length > 0 ? `${toPersianDigits(Math.max(...stats.perQuestion.map((q) => q.avg)))} / ۵` : "—"}
            sub={stats && stats.perQuestion.length > 0 ? stats.perQuestion.slice().sort((a, b) => b.avg - a.avg)[0]?.label : ""}
            color="emerald"
          />
          <KpiCard
            icon={AlertTriangle}
            label="پایین‌ترین نمره"
            value={stats && stats.perQuestion.length > 0 ? `${toPersianDigits(Math.min(...stats.perQuestion.map((q) => q.avg)))} / ۵` : "—"}
            sub={stats && stats.perQuestion.length > 0 ? stats.perQuestion.slice().sort((a, b) => a.avg - b.avg)[0]?.label : ""}
            color="red"
          />
        </div>
      )}

      {/* نمودار Bar میانگین هر سوال */}
      {!loading && stats && stats.perQuestion.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">میانگین نمره هر سوال</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => toPersianDigits(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={80} />
                <Tooltip
                  formatter={(value: any) => [`${toPersianDigits(Number(value))} از ۵`, "میانگین"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Bar dataKey="avg" radius={[0, 6, 6, 0]} maxBarSize={26}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.avg >= 4 ? "#10b981" : entry.avg >= 3 ? "#84cc16" : entry.avg >= 2 ? "#f59e0b" : "#ef4444"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* توزیع پلن‌ها */}
      {!loading && stats && stats.perPlan.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <PieChartIcon className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">توزیع نظرسنجی‌ها بر اساس پلن</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.perPlan.map((p) => (
              <div key={p.plan} className="p-3 rounded-2xl border bg-card">
                <div className="flex items-center justify-between">
                  <Badge style={{ backgroundColor: PLAN_COLORS[p.plan] || "#888", color: "white" }} className="rounded-lg">
                    {p.planLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{toPersianDigits(p.count)} نظر</span>
                </div>
                <div className="mt-2">
                  <div className={`text-2xl font-black font-stat ${satisfactionColor(p.avg)}`}>
                    {toPersianDigits(p.avg)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{satisfactionLabel(p.avg)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* جدول نظرسنجی‌ها */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Table2 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">جدول نظرسنجی‌ها</h3>
          </div>
          <span className="text-xs text-muted-foreground">کل: {toPersianDigits(total)}</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : surveys.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-sm">
            هنوز هیچ نظرسنجی ثبت نشده است.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-right font-bold py-2 px-2">کاربر</th>
                    <th className="text-right font-bold py-2 px-2">پلن</th>
                    <th className="text-right font-bold py-2 px-2">نمرات</th>
                    <th className="text-right font-bold py-2 px-2">کامنت</th>
                    <th className="text-right font-bold py-2 px-2">تاریخ</th>
                  </tr>
                </thead>
                <tbody>
                  {surveys.map((s) => {
                    let ratings: Record<string, number> = {};
                    try { ratings = JSON.parse(s.ratings || "{}"); } catch { ratings = {}; }
                    const values = Object.values(ratings).filter((v) => typeof v === "number" && v >= 1 && v <= 5);
                    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 px-2 align-top">
                          <div className="font-medium">{s.userName || "—"}</div>
                          <div className="text-xs text-muted-foreground font-stat" dir="ltr">{s.userMobile || ""}</div>
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <Badge style={{ backgroundColor: PLAN_COLORS[s.plan] || "#888", color: "white" }} className="rounded-lg">
                            {s.planLabel}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <div className={`font-bold font-stat ${satisfactionColor(avg)}`}>
                            {toPersianDigits(Math.round(avg * 10) / 10)} / ۵
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(ratings).slice(0, 5).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-muted/60"
                                title={k}
                              >
                                <Star className={`w-2.5 h-2.5 ${Number(v) >= 4 ? "fill-amber-400 text-amber-400" : Number(v) >= 3 ? "fill-amber-300 text-amber-300" : "fill-red-400 text-red-400"}`} />
                                {toPersianDigits(Number(v))}
                              </span>
                            ))}
                            {Object.keys(ratings).length > 5 && (
                              <span className="text-[10px] text-muted-foreground px-1">+{toPersianDigits(Object.keys(ratings).length - 5)}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 align-top max-w-xs">
                          {s.comment ? (
                            <div className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{s.comment}</div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(s.createdAt).toLocaleDateString("fa-IR")}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-stat" dir="ltr">
                            {new Date(s.createdAt).toLocaleTimeString("fa-IR")}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p); }}
                  disabled={page <= 1}
                  className="rounded-xl gap-1"
                >
                  <ChevronRight className="w-4 h-4" /> قبلی
                </Button>
                <span className="text-xs text-muted-foreground">
                  صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); load(p); }}
                  disabled={page >= totalPages}
                  className="rounded-xl gap-1"
                >
                  بعدی <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* مدال تحلیل AI */}
      <Dialog open={aiOpen} onOpenChange={(o) => { if (!o && !aiLoading) setAiOpen(false); }}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              تحلیل هوشمند نظرسنجی‌ها
            </DialogTitle>
          </DialogHeader>
          {aiLoading && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">در حال تحلیل نظرسنجی‌ها توسط هوش مصنوعی... ممکن است چند ثانیه طول بکشد.</p>
            </div>
          )}
          {!aiLoading && aiError && (
            <div className="p-4 rounded-xl bg-red-50 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}
          {!aiLoading && !aiError && aiAnalysis && (
            <div className="space-y-4">
              {/* Overall satisfaction + sentiment */}
              <div className={`p-4 rounded-2xl border ${SURVEY_SENTIMENT_LABELS[aiAnalysis.sentiment].bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">میانگین رضایت کلی</p>
                    <div className={`text-3xl font-black font-stat ${satisfactionColor(aiAnalysis.overallSatisfaction)}`}>
                      {toPersianDigits(aiAnalysis.overallSatisfaction)} <span className="text-base font-normal text-muted-foreground">/ ۵</span>
                    </div>
                    <p className={`text-sm font-bold ${SURVEY_SENTIMENT_LABELS[aiAnalysis.sentiment].color}`}>
                      {SURVEY_SENTIMENT_LABELS[aiAnalysis.sentiment].label}
                    </p>
                  </div>
                  <Star className={`w-14 h-14 ${satisfactionColor(aiAnalysis.overallSatisfaction)}`} />
                </div>
              </div>

              {/* Summary */}
              <div>
                <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-primary" />خلاصه وضعیت
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.summary}</p>
              </div>

              {/* Strengths */}
              {aiAnalysis.strengths.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5 text-emerald-600">
                    <ThumbsUp className="w-4 h-4" />نقاط قوت
                  </h4>
                  <ul className="space-y-1">
                    {aiAnalysis.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {aiAnalysis.weaknesses.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5 text-red-600">
                    <AlertTriangle className="w-4 h-4" />نقاط ضعف
                  </h4>
                  <ul className="space-y-1">
                    {aiAnalysis.weaknesses.map((s, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {aiAnalysis.recommendations.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <h4 className="font-bold text-sm mb-1.5 flex items-center gap-1.5 text-amber-700">
                    <Lightbulb className="w-4 h-4" />راهکار برای بهتر شدن
                  </h4>
                  <ol className="space-y-1.5">
                    {aiAnalysis.recommendations.map((s, i) => (
                      <li key={i} className="text-sm text-foreground flex gap-2">
                        <span className="font-black text-amber-600 shrink-0">{toPersianDigits(i + 1)}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
          {!aiLoading && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setAiOpen(false)} className="rounded-xl">بستن</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================================================
   ۱۴. سرچ کنسول — SearchConsoleTab (T4 + T6)
   داده‌های واقعی Google Search Console با کش ۲۴ ساعته و سقف فراخوانی
   ساعتی — بهینه برای کوتای API رایگان گوگل. تنظیم از طریق سرویس‌اکانت.
   ============================================================ */

interface GscData {
  ok: boolean;
  error?: string;
  status?: { configured: boolean; siteUrl: string | null; lastError: string | null; cache: { fetchedAt: string | null; stale: boolean; ttlHours: number } };
  data?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    daily: { date: string; clicks: number; impressions: number; ctr: number; position: number }[];
    queries: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
    pages: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
  } | null;
}

interface GscTestResponse {
  ok: boolean;
  error?: string;
  message?: string;
  testOk?: boolean;
  resolvedSiteUrl?: string | null;
  availableSites?: string[];
}

function SearchConsoleTab() {
  const [loading, setLoading] = useState(true);
  const [gsc, setGsc] = useState<GscData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saJson, setSaJson] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [queriesTab, setQueriesTab] = useState<"queries" | "pages">("queries");
  // نتیجه‌ی آخرین تست اتصال — خطای دقیق + پراپرتی‌های قابل‌دسترس را نگه می‌دارد
  const [testResult, setTestResult] = useState<GscTestResponse | null>(null);
  const [retesting, setRetesting] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/search-console", { cache: "no-store" });
      const d = (await res.json()) as GscData;
      setGsc(d);
      if (!d.status?.configured) setShowConfig(true);
    } catch {
      setGsc(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/search-console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const d = (await res.json()) as GscData;
      setGsc(d);
      if (d.ok) toast.success("داده‌های سرچ کنسول تازه شد ✓");
      else toast.error(d.error || "خطا در واکشی داده‌ها");
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/search-console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-config", saJson, siteUrl, apiKey }),
      });
      const d = (await res.json()) as GscTestResponse;
      if (!res.ok && d.error) {
        toast.error(d.error);
        return;
      }
      if (d.testOk) {
        toast.success(d.message || "ذخیره شد");
        setShowConfig(false);
        setTestResult(null);
        await load();
      } else {
        // خطا → پنل باز بماند تا کاربر JSON را تصحیح کند؛ خطا در کارت قرمز داخل پنل هم دیده شود
        toast.error(d.message || "اتصال ناموفق بود");
        setTestResult(d);
        await load();
      }
    } catch {
      toast.error("خطا در ذخیره پیکربندی");
    } finally {
      setSavingConfig(false);
    }
  }

  // تست مجدد — بعد از فعال‌کردن API در گوگل کلاد یا Add user در سرچ کنسول،
  // بدون نیاز به paste مجدد JSON همین دکمه را بزنید
  async function retestConnection() {
    setRetesting(true);
    try {
      const res = await fetch("/api/admin/search-console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const d = (await res.json()) as GscTestResponse;
      setTestResult(d);
      if (d.testOk) {
        toast.success(d.message || "اتصال برقرار است ✓");
        setShowConfig(false);
        await load();
      } else {
        toast.error(d.message || "اتصال هنوز برقرار نیست");
      }
    } catch {
      toast.error("خطا در ارتباط با سرور");
    } finally {
      setRetesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const d = gsc?.data;
  const status = gsc?.status;
  const configured = status?.configured;
  const fetchedAt = status?.cache?.fetchedAt
    ? new Date(status.cache.fetchedAt).toLocaleString("fa-IR")
    : null;

  return (
    <div className="space-y-4">
      {/* هدر + راهنمای کوتا (T6) */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <LineChartIcon className="w-4 h-4 text-primary" />
            Google Search Console — {status?.siteUrl || "غیرفعال"}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            کش ۲۴ ساعته • حداکثر ۵ فراخوانی API در ساعت • بازه ۲۸ روز — بهینه برای کوتای رایگان گوگل
            {fetchedAt && ` • آخرین به‌روزرسانی: ${fetchedAt}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig((v) => !v)} className="rounded-xl">
            <SettingsIcon className="w-3.5 h-3.5" />
            پیکربندی
          </Button>
          {configured && (
            <Button size="sm" onClick={refresh} disabled={refreshing} className="rounded-xl">
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              به‌روزرسانی
            </Button>
          )}
        </div>
      </div>

      {/* کارت پیکربندی */}
      {showConfig && (
        <Card className="p-4 bg-amber-50/40 border-amber-200">
          <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-amber-600" />
            اتصال به سرچ کنسول (Service Account)
          </h4>
          <div className="space-y-3 text-xs">
            <div className="bg-white/70 rounded-xl p-3 space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800">راهنمای قدم‌به‌قدم (هر قدم دقیقاً در سایت خود گوگل):</p>
              <p>۱. <b>console.cloud.google.com</b> را باز کنید — بالای صفحه از منوی پروژه، همان پروژه‌ای را انتخاب کنید که سرویس‌اکانت در آن ساخته شده</p>
              <p>۲. ⭐ <b>مهم‌ترین قدم (عامل ۹۰٪ خطاهای 403):</b> از منوی چپ <b>APIs &amp; Services → Library</b> → در جستجو بنویسید «Search Console API» → روی <b>Google Search Console API</b> کلیک کنید → دکمه‌ی <b>Enable</b> → ۱-۲ دقیقه صبر کنید</p>
              <p>۳. <b>APIs &amp; Services → Credentials → Create Credentials → Service Account</b> — اگر قبلاً ساخته‌اید رد شوید</p>
              <p>۴. روی سرویس‌اکانت کلیک کنید → تب <b>Keys</b> → <b>Add Key → Create new key → JSON</b> → فایل دانلود می‌شود</p>
              <p>۵. <b>search.google.com/search-console</b> → Settings (چرخ‌دنده) → Users and permissions → <b>Add user</b> → ایمیل سرویس‌اکانت (xxx@yyy.iam.gserviceaccount.com) → دسترسی <b>Restricted</b> → بعد ~۵ دقیقه صبر کنید</p>
              <p>۶. کل فایل JSON دانلودی را بدون هیچ تغییری در کادر زیر paste کنید + آدرس سایت (فقط fittup.ir کافی است — فرمت دقیق خودکار تشخیص داده می‌شود)</p>
              <p className="text-amber-700 mt-1">⚠️ نکته: Search Console API کلید API ساده (مثل کلیدهای Gemini) نمی‌پذیرد — فقط سرویس‌اکانت JSON.</p>
            </div>
            <div>
              <Label className="text-[11px] mb-1">JSON سرویس‌اکانت (کل فایل)</Label>
              <Textarea
                value={saJson}
                onChange={(e) => setSaJson(e.target.value)}
                rows={4}
                dir="ltr"
                placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "client_email": "xxx@yyy.iam.gserviceaccount.com",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n..."\n}'}
                className="rounded-xl font-mono text-[10px]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] mb-1">آدرس سایت (Site URL)</Label>
                <Input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  dir="ltr"
                  placeholder="fittup.ir (یا https://fittup.ir یا sc-domain:fittup.ir)"
                  className="rounded-xl font-mono text-[11px]"
                />
                <p className="text-[10px] text-slate-400 mt-1">فرمت دقیق را لازم نیست بدانید — به‌صورت خودکار با پراپرتی ثبت‌شده در گوگل تطبیق داده می‌شود</p>
              </div>
              <div>
                <Label className="text-[11px] mb-1">کلید API گوگل (اختیاری — برای سرویس‌های آینده)</Label>
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  dir="ltr"
                  placeholder="AQ.Ab8..."
                  className="rounded-xl font-mono text-[11px]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={saveConfig} disabled={savingConfig || (!saJson.trim() && !siteUrl.trim())} className="rounded-xl">
                {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                ذخیره و تست اتصال
              </Button>
              {/* اگر قبلاً JSON ذخیره شده، بدون paste مجدد قابل تست مجدد است — بعد از فعال‌کردن API در گوگل */}
              {(gsc?.status?.configured || !!testResult) && (
                <Button variant="outline" size="sm" onClick={retestConnection} disabled={retesting} className="rounded-xl">
                  {retesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  تست مجدد اتصال
                </Button>
              )}
            </div>

            {/* نتیجه‌ی تست — خطای دقیق مرحله‌به‌مرحله + پراپرتی‌های قابل‌دسترس */}
            {testResult && !testResult.testOk && (
              <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 space-y-2">
                <p className="text-[11px] text-red-700 leading-relaxed font-medium" dir="auto">{testResult.message}</p>
                {(testResult.availableSites?.length ?? 0) > 0 && (
                  <div className="text-[11px] text-slate-600">
                    <p className="font-bold mb-1">پراپرتی‌هایی که سرویس‌اکانت به آن‌ها دسترسی دارد:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {testResult.availableSites!.map((s) => (
                        <button
                          key={s}
                          onClick={() => setSiteUrl(s)}
                          className="px-2 py-1 rounded-lg bg-white border border-red-100 font-mono text-[10px] hover:border-orange-400 hover:text-orange-600 transition"
                          dir="ltr"
                          title="کلیک کنید تا در کادر آدرس سایت قرار گیرد"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5">روی هر کدام کلیک کنید تا در کادر بالا قرار گیرد، بعد «ذخیره و تست اتصال» را بزنید.</p>
                  </div>
                )}
                {/* راهنمای رفع سریع بر اساس نوع خطا */}
                {(testResult.message || "").includes("403") && (
                  <p className="text-[11px] text-red-600 bg-red-100/60 rounded-lg p-2 leading-relaxed">
                    چک‌لیست ۴۰۳: ① آیا قدم ۲ راهنمای بالا (فعال‌کردن Search Console API در گوگل کلاد) را انجام داده‌اید؟ ② آیا ۵ دقیقه از Add user در سرچ کنسول گذشته؟ — بعد از هر کدام، «تست مجدد اتصال» را بزنید.
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* خطا / راهنما */}
      {!configured && !showConfig && (
        <Card className="p-6 text-center">
          <Search className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-bold text-slate-700 mb-1">سرچ کنسول پیکربندی نشده</p>
          <p className="text-xs text-slate-500 mb-3">برای دیدن داده‌های واقعی جستجوی گوگل، سرویس‌اکانت را وصل کنید.</p>
          <Button size="sm" onClick={() => setShowConfig(true)} className="rounded-xl">شروع پیکربندی</Button>
        </Card>
      )}

      {configured && gsc?.error && !d && (
        <Card className="p-4 bg-red-50/60 border-red-200">
          <p className="text-xs text-red-700 leading-relaxed">{gsc.error}</p>
        </Card>
      )}

      {/* داده‌ها */}
      {d && (
        <>
          {/* KPI ها */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-3.5">
              <p className="text-[10px] text-slate-400 font-bold mb-1">کلیک‌ها (۲۸ روز)</p>
              <p className="text-xl font-black text-primary">{toPersianDigits(d.clicks.toLocaleString("en-US"))}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[10px] text-slate-400 font-bold mb-1">نمایش‌ها</p>
              <p className="text-xl font-black text-blue-600">{toPersianDigits(d.impressions.toLocaleString("en-US"))}</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[10px] text-slate-400 font-bold mb-1">نرخ کلیک (CTR)</p>
              <p className="text-xl font-black text-emerald-600">{toPersianDigits((d.ctr * 100).toFixed(1))}٪</p>
            </Card>
            <Card className="p-3.5">
              <p className="text-[10px] text-slate-400 font-bold mb-1">میانگین جایگاه</p>
              <p className="text-xl font-black text-violet-600">{toPersianDigits(d.position.toFixed(1))}</p>
            </Card>
          </div>

          {/* نمودار روند روزانه */}
          <Card className="p-4">
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              روند کلیک و نمایش (روزانه)
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={d.daily}>
                <defs>
                  <linearGradient id="gscClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-muted/20" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "currentColor" }} className="text-muted-foreground" tickFormatter={(v: string) => v.slice(5)} />
                <YAxis yAxisId="left" tick={{ fontSize: 9, fill: "currentColor" }} className="text-muted-foreground" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: "currentColor" }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", fontSize: "11px" }}
                  formatter={(v: any, name: any) => [toPersianDigits(Number(v).toLocaleString("en-US")), name === "clicks" ? "کلیک" : "نمایش"]}
                />
                <Area yAxisId="left" type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2} fill="url(#gscClicks)" name="clicks" />
                <Line yAxisId="right" type="monotone" dataKey="impressions" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="impressions" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* جدول کوئری‌ها / صفحه‌ها */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm">
                {queriesTab === "queries" ? "پرتکرارترین کوئری‌ها" : "پرتکرارترین صفحه‌ها"}
              </h4>
              <div className="flex gap-1 bg-muted/40 rounded-lg p-0.5">
                <button
                  onClick={() => setQueriesTab("queries")}
                  className={`text-[11px] px-3 py-1 rounded-md transition font-bold ${queriesTab === "queries" ? "bg-white shadow text-primary" : "text-slate-500"}`}
                >
                  کوئری‌ها
                </button>
                <button
                  onClick={() => setQueriesTab("pages")}
                  className={`text-[11px] px-3 py-1 rounded-md transition font-bold ${queriesTab === "pages" ? "bg-white shadow text-primary" : "text-slate-500"}`}
                >
                  صفحه‌ها
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-slate-400">
                    <th className="text-right py-2 font-bold">{queriesTab === "queries" ? "کوئری" : "صفحه"}</th>
                    <th className="text-center py-2 font-bold">کلیک</th>
                    <th className="text-center py-2 font-bold">نمایش</th>
                    <th className="text-center py-2 font-bold">CTR</th>
                    <th className="text-center py-2 font-bold">جایگاه</th>
                  </tr>
                </thead>
                <tbody>
                  {(queriesTab === "queries" ? d.queries : d.pages).map((row, i) => {
                    const isOpportunity = queriesTab === "queries" && row.position >= 4 && row.position <= 20;
                    return (
                      <tr key={i} className="border-t border-slate-100 hover:bg-orange-50/30">
                        <td className="py-2 text-right max-w-[220px] truncate font-medium text-slate-700" title={row.keys[0]}>
                          {isOpportunity && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 ml-1.5" title="فرصت رشد — جایگاه ۴ تا ۲۰" />}
                          {row.keys[0]}
                        </td>
                        <td className="text-center text-slate-600">{toPersianDigits(row.clicks.toLocaleString("en-US"))}</td>
                        <td className="text-center text-slate-600">{toPersianDigits(row.impressions.toLocaleString("en-US"))}</td>
                        <td className="text-center text-slate-600">{toPersianDigits((row.ctr * 100).toFixed(1))}٪</td>
                        <td className="text-center">
                          <span className={`px-1.5 py-0.5 rounded-full font-bold text-[10px] ${row.position <= 3 ? "bg-emerald-50 text-emerald-600" : isOpportunity ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"}`}>
                            {toPersianDigits(row.position.toFixed(1))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              🔶 نقطه‌ی طلایی = «فرصت رشد» (جایگاه ۴ تا ۲۰) — برای این کوئری‌ها در تب «سئو هوشمند» گزینه‌ی «آپدیت محتواها» را اجرا کنید تا مقالات مرتبط برای رتبه ۱ بازنویسی شوند.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
