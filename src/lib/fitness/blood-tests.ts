/**
 * Comprehensive blood test panel categories for athletes & bodybuilders.
 * Used by:
 *   - src/components/fitness/views/blood-test-view.tsx (UI display)
 *   - src/lib/fitness/ai.ts (AI prompt for analyzeBloodTest)
 *
 * The categories cover the full athlete blood-work panel recommended for
 * designing optimized training & nutrition programs on the Fitap platform.
 */

export type BloodTestStatus = "normal" | "low" | "high" | "borderline" | "unknown";

export interface BloodTestItem {
  /** Stable identifier */
  key: string;
  /** Persian display name */
  name: string;
  /** English name — used for AI matching against lab report text */
  enName: string;
  /** Typical unit (Latin) */
  unit?: string;
  /** Persian reference range hint */
  refRange?: string;
  /** Short Persian description */
  desc?: string;
}

export interface BloodTestCategory {
  /** Stable identifier */
  id: string;
  /** Persian display name */
  name: string;
  /** English name for AI context */
  enName: string;
  /** Emoji icon */
  icon: string;
  /** Short Persian description */
  description: string;
  /** Tests in this category */
  tests: BloodTestItem[];
}

export const BLOOD_TEST_CATEGORIES: BloodTestCategory[] = [
  {
    id: "cbc",
    name: "آزمایش خون کامل (CBC)",
    enName: "Complete Blood Count",
    icon: "🩸",
    description: "بررسی سلول‌های خونی و سلامت عمومی",
    tests: [
      {
        key: "hemoglobin",
        name: "هموگلوبین",
        enName: "Hemoglobin (Hb)",
        unit: "g/dL",
        refRange: "مردان ۱۳.۵-۱۷.۵ / زنان ۱۲-۱۵.۵",
        desc: "پروتئین حامل اکسیژن",
      },
      {
        key: "hematocrit",
        name: "هماتوکریت",
        enName: "Hematocrit (HCT)",
        unit: "%",
        refRange: "مردان ۴۱-۵۳ / زنان ۳۶-۴۶",
        desc: "درصد حجم گلبول قرمز",
      },
      {
        key: "rbc",
        name: "گلبول قرمز",
        enName: "RBC (Red Blood Cells)",
        unit: "M/µL",
        refRange: "مردان ۴.۵-۵.۹ / زنان ۴.۱-۵.۱",
        desc: "تعداد گلبول قرمز",
      },
      {
        key: "wbc",
        name: "گلبول سفید",
        enName: "WBC (White Blood Cells)",
        unit: "K/µL",
        refRange: "۴.۵-۱۱",
        desc: "سیستم ایمنی و عفونت",
      },
      {
        key: "platelets",
        name: "پلاکت",
        enName: "Platelets",
        unit: "K/µL",
        refRange: "۱۵۰-۴۵۰",
        desc: "لخته شدن خون",
      },
      {
        key: "mcv",
        name: "MCV",
        enName: "Mean Corpuscular Volume (MCV)",
        unit: "fL",
        refRange: "۸۰-۱۰۰",
        desc: "حجم متوسط گلبول قرمز",
      },
      {
        key: "mch",
        name: "MCH",
        enName: "Mean Corpuscular Hemoglobin (MCH)",
        unit: "pg",
        refRange: "۲۷-۳۳",
        desc: "هموگلوبین متوسط هر گلبول",
      },
      {
        key: "mchc",
        name: "MCHC",
        enName: "Mean Corpuscular Hemoglobin Concentration (MCHC)",
        unit: "g/dL",
        refRange: "۳۲-۳۶",
        desc: "غلظت هموگلوبین",
      },
    ],
  },
  {
    id: "lipid",
    name: "پنل چربی خون (Lipid Panel)",
    enName: "Lipid Panel",
    icon: "🧈",
    description: "بررسی چربی‌های خون و ریسک قلبی",
    tests: [
      {
        key: "total_cholesterol",
        name: "کلسترول کل",
        enName: "Total Cholesterol",
        unit: "mg/dL",
        refRange: "< ۲۰۰ مطلوب",
        desc: "کل چربی خون",
      },
      {
        key: "ldl",
        name: "کلسترول بد (LDL)",
        enName: "LDL Cholesterol",
        unit: "mg/dL",
        refRange: "< ۱۰۰ مطلوب",
        desc: "کلسترول مضر",
      },
      {
        key: "hdl",
        name: "کلسترول خوب (HDL)",
        enName: "HDL Cholesterol",
        unit: "mg/dL",
        refRange: "مردان > ۴۰ / زنان > ۵۰",
        desc: "کلسترول مفید",
      },
      {
        key: "triglycerides",
        name: "تری‌گلیسیرید",
        enName: "Triglycerides",
        unit: "mg/dL",
        refRange: "< ۱۵۰ مطلوب",
        desc: "چربی خون ناشتا",
      },
    ],
  },
  {
    id: "liver",
    name: "عملکرد کبد (Liver Function)",
    enName: "Liver Function Tests",
    icon: "🫀",
    description: "بررسی آنزیم‌های کبدی و سلامت کبد",
    tests: [
      {
        key: "alt",
        name: "ALT (SGPT)",
        enName: "Alanine Aminotransferase (ALT/SGPT)",
        unit: "U/L",
        refRange: "۷-۵۶",
        desc: "آنزیم کبدی",
      },
      {
        key: "ast",
        name: "AST (SGOT)",
        enName: "Aspartate Aminotransferase (AST/SGOT)",
        unit: "U/L",
        refRange: "۱۰-۴۰",
        desc: "آنزیم کبدی و عضلانی",
      },
      {
        key: "bilirubin",
        name: "بیلی‌روبین",
        enName: "Bilirubin (Total)",
        unit: "mg/dL",
        refRange: "۰.۲-۱.۲",
        desc: "محصول تجزیه گلبول قرمز",
      },
      {
        key: "alp",
        name: "فسفاتاز قلیایی",
        enName: "Alkaline Phosphatase (ALP)",
        unit: "U/L",
        refRange: "۴۴-۱۴۷",
        desc: "آنزیم کبد و استخوان",
      },
    ],
  },
  {
    id: "kidney",
    name: "عملکرد کلیه (Kidney Function)",
    enName: "Kidney Function Tests",
    icon: "💧",
    description: "بررسی عملکرد کلیه‌ها و دفع مواد زائد",
    tests: [
      {
        key: "creatinine",
        name: "کراتینین",
        enName: "Creatinine",
        unit: "mg/dL",
        refRange: "۰.۶-۱.۲",
        desc: "حاصل متابولیسم عضلانی",
      },
      {
        key: "bun",
        name: "ازوت اوره خون (BUN)",
        enName: "Blood Urea Nitrogen (BUN)",
        unit: "mg/dL",
        refRange: "۷-۲۰",
        desc: "اوره خون",
      },
      {
        key: "uric_acid",
        name: "اسید اوریک",
        enName: "Uric Acid",
        unit: "mg/dL",
        refRange: "مردان ۳.۴-۷ / زنان ۲.۴-۶",
        desc: "متابولیت پورین",
      },
    ],
  },
  {
    id: "thyroid",
    name: "تیروئید (Thyroid Panel)",
    enName: "Thyroid Panel",
    icon: "🦋",
    description: "بررسی عملکرد غده تیروئید و متابولیسم",
    tests: [
      {
        key: "tsh",
        name: "TSH",
        enName: "Thyroid Stimulating Hormone (TSH)",
        unit: "mIU/L",
        refRange: "۰.۴-۴",
        desc: "هورمون محرک تیروئید",
      },
      {
        key: "ft3",
        name: "T3 آزاد",
        enName: "Free T3 (FT3)",
        unit: "pg/mL",
        refRange: "۲.۳-۴.۲",
        desc: "هورمون فعال تیروئید",
      },
      {
        key: "ft4",
        name: "T4 آزاد",
        enName: "Free T4 (FT4)",
        unit: "ng/dL",
        refRange: "۰.۸-۱.۸",
        desc: "پیش‌هورمون تیروئید",
      },
    ],
  },
  {
    id: "hormones",
    name: "پنل هورمونی (Hormones)",
    enName: "Hormone Panel — important for bodybuilders",
    icon: "💪",
    description: "هورمون‌های آنابولیک و کاتابولیک — حیاتی برای بدنسازان",
    tests: [
      {
        key: "testosterone_total",
        name: "تستوسترون کل",
        enName: "Total Testosterone",
        unit: "ng/dL",
        refRange: "مردان ۳۰۰-۱۰۰۰ / زنان ۱۵-۷۰",
        desc: "هورمون آنابولیک اصلی",
      },
      {
        key: "testosterone_free",
        name: "تستوسترون آزاد",
        enName: "Free Testosterone",
        unit: "pg/mL",
        refRange: "مردان ۵۰-۲۱۰",
        desc: "بخش فعال تستوسترون",
      },
      {
        key: "estrogen",
        name: "استروژن",
        enName: "Estrogen (Estradiol / E2)",
        unit: "pg/mL",
        refRange: "زنان ۳۰-۴۰۰ / مردان ۱۰-۴۰",
        desc: "هورمون زنانه",
      },
      {
        key: "cortisol",
        name: "کورتیزول",
        enName: "Cortisol",
        unit: "µg/dL",
        refRange: "صبح ۶-۲۳",
        desc: "هورمون استرس کاتابولیک",
      },
      {
        key: "insulin",
        name: "انسولین",
        enName: "Insulin (Fasting)",
        unit: "µIU/mL",
        refRange: "۲-۲۵",
        desc: "هورمون ذخیره‌ساز",
      },
      {
        key: "growth_hormone",
        name: "هورمون رشد",
        enName: "Growth Hormone (HGH / somatotropin)",
        unit: "ng/mL",
        refRange: "۰-۸",
        desc: "هورمون آنابولیک",
      },
      {
        key: "lh",
        name: "LH",
        enName: "Luteinizing Hormone (LH)",
        unit: "mIU/mL",
        refRange: "مردان ۱.۲-۷.۸ / زنان متغیر",
        desc: "تنظیم تستوسترون",
      },
      {
        key: "fsh",
        name: "FSH",
        enName: "Follicle Stimulating Hormone (FSH)",
        unit: "mIU/mL",
        refRange: "مردان ۱.۵-۱۲ / زنان متغیر",
        desc: "تنظیم باروری",
      },
      {
        key: "prolactin",
        name: "پرولاکتین",
        enName: "Prolactin",
        unit: "ng/mL",
        refRange: "مردان ۴-۱۵ / زنان ۴-۲۳",
        desc: "مرتبط با تستوسترون",
      },
    ],
  },
  {
    id: "vitamins_minerals",
    name: "ویتامین‌ها و مواد معدنی",
    enName: "Vitamins & Minerals",
    icon: "💊",
    description: "بررسی کمبودهای تغذیه‌ای ورزشکار",
    tests: [
      {
        key: "vitamin_d",
        name: "ویتامین D",
        enName: "Vitamin D (25-OH)",
        unit: "ng/mL",
        refRange: "۳۰-۱۰۰ مطلوب",
        desc: "استخوان و تستوسترون",
      },
      {
        key: "vitamin_b12",
        name: "ویتامین B12",
        enName: "Vitamin B12",
        unit: "pg/mL",
        refRange: "۲۰۰-۹۰۰",
        desc: "انرژی و اعصاب",
      },
      {
        key: "iron",
        name: "آهن سرم",
        enName: "Iron (Serum)",
        unit: "µg/dL",
        refRange: "مردان ۶۵-۱۷۵ / زنان ۵۰-۱۷۰",
        desc: "حمل اکسیژن",
      },
      {
        key: "ferritin",
        name: "فریتین",
        enName: "Ferritin",
        unit: "ng/mL",
        refRange: "مردان ۲۴-۳۳۶ / زنان ۱۱-۳۰۷",
        desc: "ذخیره آهن بدن",
      },
      {
        key: "magnesium",
        name: "منیزیم",
        enName: "Magnesium",
        unit: "mg/dL",
        refRange: "۱.۷-۲.۲",
        desc: "انقباض عضلانی",
      },
      {
        key: "zinc",
        name: "روی",
        enName: "Zinc",
        unit: "µg/dL",
        refRange: "۷۰-۱۲۰",
        desc: "تستوسترون و ایمنی",
      },
      {
        key: "calcium",
        name: "کلسیم",
        enName: "Calcium",
        unit: "mg/dL",
        refRange: "۸.۵-۱۰.۵",
        desc: "استخوان و عضله",
      },
      {
        key: "phosphorus",
        name: "فسفر",
        enName: "Phosphorus",
        unit: "mg/dL",
        refRange: "۲.۵-۴.۵",
        desc: "انرژی ATP",
      },
    ],
  },
  {
    id: "blood_sugar",
    name: "قند خون (Blood Sugar)",
    enName: "Blood Sugar Panel",
    icon: "🍬",
    description: "بررسی دیابت و مقاومت به انسولین",
    tests: [
      {
        key: "fbs",
        name: "قند خون ناشتا",
        enName: "Fasting Blood Sugar (FBS / Glucose)",
        unit: "mg/dL",
        refRange: "۷۰-۱۰۰",
        desc: "قند خون ناشتا",
      },
      {
        key: "hba1c",
        name: "هموگلوبین گلیکوزیله",
        enName: "HbA1c (Glycated Hemoglobin)",
        unit: "%",
        refRange: "< ۵.۷ نرمال",
        desc: "میانگین قند ۳ ماه",
      },
    ],
  },
  {
    id: "inflammation",
    name: "التهاب (Inflammation)",
    enName: "Inflammation Markers",
    icon: "🔥",
    description: "بررسی نشانگرهای التهابی بدن",
    tests: [
      {
        key: "crp",
        name: "پروتئین C واکنشی (CRP)",
        enName: "C-Reactive Protein (CRP)",
        unit: "mg/L",
        refRange: "< ۳",
        desc: "نشانگر التهاب",
      },
      {
        key: "esr",
        name: "سرعت ته‌نشینی گلبول (ESR)",
        enName: "Erythrocyte Sedimentation Rate (ESR)",
        unit: "mm/hr",
        refRange: "مردان ۰-۱۵ / زنان ۰-۲۰",
        desc: "التهاب مزمن",
      },
    ],
  },
];

/** Flat list of all blood test items — useful for lookups & AI prompt building. */
export const ALL_BLOOD_TESTS: BloodTestItem[] = BLOOD_TEST_CATEGORIES.flatMap((c) => c.tests);

/** Count of total tests across all categories. */
export const TOTAL_BLOOD_TESTS = ALL_BLOOD_TESTS.length;

/** Lookup test item by key. */
export function findBloodTest(key: string): BloodTestItem | undefined {
  return ALL_BLOOD_TESTS.find((t) => t.key === key);
}

/** Lookup category by id. */
export function findBloodCategory(id: string): BloodTestCategory | undefined {
  return BLOOD_TEST_CATEGORIES.find((c) => c.id === id);
}

/** Build a compact Persian summary of all categories for the printable prescription. */
export function bloodTestSummaryForPrint(): { categoryName: string; tests: { name: string; desc?: string }[] }[] {
  return BLOOD_TEST_CATEGORIES.map((c) => ({
    categoryName: `${c.icon} ${c.name}`,
    tests: c.tests.map((t) => ({ name: t.name, desc: t.desc })),
  }));
}

/** Build a structured description for the AI prompt — listing every expected test. */
export function bloodTestPromptSummary(): string {
  return BLOOD_TEST_CATEGORIES.map((c) => {
    const lines = c.tests.map(
      (t) => `  - ${t.name} (${t.enName})${t.unit ? ` | واحد: ${t.unit}` : ""}${t.refRange ? ` | محدوده نرمال: ${t.refRange}` : ""}`
    );
    return `■ دسته: ${c.name} (${c.enName})\n${lines.join("\n")}`;
  }).join("\n\n");
}
