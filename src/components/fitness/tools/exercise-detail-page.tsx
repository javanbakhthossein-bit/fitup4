"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Dumbbell,
  ChevronLeft,
  AlertTriangle,
  Info,
  Youtube,
  Share2,
  Search,
  SearchX,
} from "lucide-react";
import { useAppStore } from "@/lib/fitness/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { toPersianDigits } from "@/lib/fitness/types";
import { pushScreen, replaceScreen } from "@/lib/fitness/navigation";
import { toast } from "sonner";
import { NikaWidget } from "@/components/fitness/nika-widget";
import { CtaSection } from "./cta-section";

interface Exercise {
  id: string;
  name: string;
  muscle: string;
  category: string;
  equipment: string;
  description: string;
  tips: string;
  mediaUrl: string;
  youtubeUrl?: string;
  difficulty: string;
}

interface RelatedExercise {
  id: string;
  name: string;
  muscle: string;
  category: string;
  equipment: string;
  difficulty: string;
  youtubeUrl?: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "مبتدی",
  intermediate: "متوسط",
  advanced: "پیشرفته",
};
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  push: "Push (فشار)",
  pull: "Pull (کشش)",
  legs: "پا",
  core: "مرکز (شکم)",
  cardio: "هوازی",
  fullbody: "بدن کامل",
};

export function ExerciseDetailPage() {
  const { exerciseId, setExerciseId, setScreen } = useAppStore();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [related, setRelated] = useState<RelatedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Detect ID from URL on initial mount (so refresh + deep-link works)
  useEffect(() => {
    if (!exerciseId) {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get("exercise");
      if (urlId) {
        setExerciseId(urlId);
        return;
      }
      // no exercise id → back to exercises database
      setScreen("tool-exercises");
      replaceScreen("tool-exercises", { tool: "exercises" });
      return;
    }
  }, []);

  useEffect(() => {
    if (!exerciseId) return;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const res = await fetch(`/api/exercises/${encodeURIComponent(exerciseId)}`);
        const data = await res.json();
        if (res.ok && data.exercise) {
          setExercise(data.exercise);
          setRelated(data.related || []);
          applySeo(data.exercise as Exercise);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [exerciseId]);

  function applySeo(ex: Exercise) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fittup.ir";
    const exUrl = `${siteUrl}/?exercise=${ex.id}`;
    const desc = `آموزش ${ex.name} با ویدیو. ${(ex.description || "").substring(0, 100)}`;
    const ytId = ex.youtubeUrl ? extractYouTubeId(ex.youtubeUrl) : null;
    const ogImage = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : `${siteUrl}/fitup-logo.png`;

    document.title = `${ex.name} - آموزش و نحوه اجرا | فیتاپ`;
    setMetaTag("description", desc);
    setMetaTag("keywords", `${ex.name}, آموزش ${ex.name}, ${ex.muscle}, ${ex.equipment}, بدنسازی, فیتاپ`);
    setMetaTag("robots", "index,follow");

    // ─── Canonical ───
    setLinkTag("canonical", exUrl);

    // Open Graph
    setMetaProp("og:title", `${ex.name} - آموزش و نحوه اجرا | فیتاپ`);
    setMetaProp("og:description", desc);
    setMetaProp("og:type", "article");
    setMetaProp("og:locale", "fa_IR");
    setMetaProp("og:url", exUrl);
    setMetaProp("og:image", ogImage);
    setMetaProp("og:site_name", "فیتاپ");

    // Twitter
    setMetaProp("twitter:card", "summary_large_image");
    setMetaProp("twitter:title", `${ex.name} - آموزش و نحوه اجرا | فیتاپ`);
    setMetaProp("twitter:description", desc);
    setMetaProp("twitter:image", ogImage);

    // JSON-LD: VideoObject (if YouTube URL)
    const hasYoutube = !!ex.youtubeUrl && ex.youtubeUrl.trim() !== "";
    const jsonLdBlocks: Record<string, any> = {};

    // ─── BreadcrumbList schema ───
    jsonLdBlocks["breadcrumb-schema"] = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "فیتاپ", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "بانک حرکات بدنسازی", item: `${siteUrl}/?tool=exercises` },
        { "@type": "ListItem", position: 3, name: ex.name, item: exUrl },
      ],
    };

    if (hasYoutube) {
      jsonLdBlocks["video-schema"] = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: `آموزش ${ex.name}`,
        description: ex.description || `آموزش نحوه اجرای حرکت ${ex.name}`,
        thumbnailUrl: ex.youtubeUrl
          ? `https://img.youtube.com/vi/${extractYouTubeId(ex.youtubeUrl)}/hqdefault.jpg`
          : undefined,
        uploadDate: new Date().toISOString(),
        embedUrl: ex.youtubeUrl,
        contentUrl: ex.youtubeUrl,
      };
    }

    // JSON-LD: HowTo
    const steps = (ex.description || "")
      .split(/[.\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5)
      .slice(0, 6)
      .map((text, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: `مرحله ${toPersianDigits(i + 1)}`,
        text,
      }));

    jsonLdBlocks["howto-schema"] = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `آموزش ${ex.name}`,
      description: ex.description || `نحوه اجرای صحیح ${ex.name}`,
      totalTime: "PT30M",
      supply: (ex.equipment || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ "@type": "HowToSupply", name })),
      step: steps.length > 0 ? steps : undefined,
    };

    // FAQ JSON-LD
    jsonLdBlocks["faq-schema"] = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `چگونه ${ex.name} را به درستی اجرا کنم؟`,
          acceptedAnswer: {
            "@type": "Answer",
            text: ex.description || `برای اجرای صحیح ${ex.name} به توضیحات گام‌به‌گام و ویدیوی آموزشی این صفحه مراجعه کنید.`,
          },
        },
        {
          "@type": "Question",
          name: `${ex.name} کدام عضله را درگیر می‌کند؟`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `حرکت ${ex.name} عمدتاً عضله ${ex.muscle} را هدف قرار می‌دهد.`,
          },
        },
        {
          "@type": "Question",
          name: `${ex.name} برای چه سطحی مناسب است؟`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `این حرکت برای سطح ${DIFFICULTY_LABELS[ex.difficulty] || ex.difficulty} مناسب است.`,
          },
        },
      ],
    };

    // Apply all JSON-LD blocks
    Object.entries(jsonLdBlocks).forEach(([id, data]) => setJsonLd(id, data));
  }

  function extractYouTubeId(url: string): string {
    const m = url.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  function setMetaTag(name: string, content: string) {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }
  function setMetaProp(prop: string, content: string) {
    if (!content) return;
    let el = document.querySelector(`meta[property="${prop}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("property", prop);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }
  function setJsonLd(id: string, data: any) {
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }
  function setLinkTag(rel: string, href: string) {
    if (!href) return;
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function goBack() {
    setExerciseId(null);
    setScreen("tool-exercises");
    replaceScreen("tool-exercises", { tool: "exercises" });
  }

  function goLanding() {
    setScreen("landing");
    replaceScreen("landing");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openExercise(id: string) {
    setExerciseId(id);
    setScreen("exercise-detail");
    pushScreen("exercise-detail", { exercise: id });
  }

  function shareLink() {
    if (!exercise) return;
    const url = `${window.location.origin}/?exercise=${encodeURIComponent(exercise.id)}`;
    if (navigator.share) {
      navigator.share({ title: exercise.name, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("لینک حرکت کپی شد ✓");
    }
  }

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <DetailTopNav onBack={goBack} onLogo={goLanding} />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 rounded-xl mb-4" />
          <Skeleton className="h-64 rounded-2xl mb-6" />
          <Skeleton className="h-4 rounded mb-3" />
          <Skeleton className="h-4 rounded mb-3" />
          <Skeleton className="h-4 rounded mb-3" />
        </div>
      </div>
    );
  }

  // ─── 404 state ───
  if (notFound || !exercise) {
    return (
      <div className="min-h-screen bg-white">
        <DetailTopNav onBack={goBack} onLogo={goLanding} />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-slate-100">
            <SearchX className="w-10 h-10 text-slate-400" />
          </div>
          <h1 className="text-xl font-black text-slate-900 mb-2">حرکت یافت نشد</h1>
          <p className="text-sm text-slate-500 mb-6">
            متأسفانه حرکت موردنظر در بانک فیتاپ موجود نیست. شاید آدرس را اشتباه وارد کرده‌اید.
          </p>
          <Button
            onClick={goBack}
            className="text-white rounded-xl"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <Search className="w-4 h-4" /> جستجوی حرکات دیگر
          </Button>
        </div>
      </div>
    );
  }

  const hasYoutube = !!exercise.youtubeUrl && exercise.youtubeUrl.trim() !== "";

  return (
    <div className="min-h-screen bg-white">
      <DetailTopNav onBack={goBack} onLogo={goLanding} onShare={shareLink} />

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {/* Category + difficulty badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge className="bg-orange-100 text-orange-700 text-[11px]">
            {exercise.muscle}
          </Badge>
          {CATEGORY_LABELS[exercise.category] && (
            <Badge className="bg-amber-100 text-amber-700 text-[11px]">
              {CATEGORY_LABELS[exercise.category]}
            </Badge>
          )}
          <Badge
            className={`text-[11px] ${
              DIFFICULTY_COLORS[exercise.difficulty] ||
              "bg-slate-100 text-slate-600"
            }`}
          >
            {DIFFICULTY_LABELS[exercise.difficulty] || exercise.difficulty}
          </Badge>
        </div>

        {/* Title (H1) */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-black text-slate-900 mb-3 leading-tight"
        >
          {exercise.name}
        </motion.h1>

        {/* Quick info row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-3 rounded-xl border-2" style={{ borderColor: "#fed7aa" }}>
            <p className="text-[10px] text-slate-400 mb-1">عضله هدف</p>
            <p className="text-sm font-bold text-slate-900">{exercise.muscle}</p>
          </Card>
          <Card className="p-3 rounded-xl border-2" style={{ borderColor: "#fed7aa" }}>
            <p className="text-[10px] text-slate-400 mb-1">سطح دشواری</p>
            <p className="text-sm font-bold text-slate-900">
              {DIFFICULTY_LABELS[exercise.difficulty] || exercise.difficulty}
            </p>
          </Card>
          <Card className="p-3 rounded-xl border-2" style={{ borderColor: "#fed7aa" }}>
            <p className="text-[10px] text-slate-400 mb-1">دسته‌بندی</p>
            <p className="text-sm font-bold text-slate-900">
              {CATEGORY_LABELS[exercise.category] || exercise.category}
            </p>
          </Card>
          <Card className="p-3 rounded-xl border-2" style={{ borderColor: "#fed7aa" }}>
            <p className="text-[10px] text-slate-400 mb-1">تجهیزات</p>
            <p className="text-sm font-bold text-slate-900 truncate">
              {exercise.equipment || "وزن بدن"}
            </p>
          </Card>
        </div>

        {/* YouTube embed */}
        {hasYoutube && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl overflow-hidden mb-4 shadow-lg"
          >
            <div className="aspect-video w-full bg-black">
              <iframe
                src={exercise.youtubeUrl}
                title={`ویدیو آموزشی ${exercise.name}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-t border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-700 font-medium">
                ⚠️ این ویدیو متعلق به سایت یوتیوب می‌باشد
              </p>
            </div>
          </motion.div>
        )}

        {/* Description */}
        {exercise.description && (
          <section className="mb-6">
            <h2 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-orange-500" />
              آموزش اجرای {exercise.name}
            </h2>
            <div className="text-sm text-slate-700 leading-relaxed space-y-2">
              {exercise.description.split(/\n+/).map((p, i) =>
                p.trim() ? <p key={i}>{p.trim()}</p> : null
              )}
            </div>
          </section>
        )}

        {/* Tips */}
        {exercise.tips && (
          <section className="mb-6">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <h2 className="font-bold text-base text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                نکات ایمنی و تکنیک
              </h2>
              <p className="text-sm text-amber-700 leading-relaxed">{exercise.tips}</p>
            </div>
          </section>
        )}

        {/* CTA — دعوت به خرید برنامه */}
        <CtaSection context="exercise" />

        {/* Related exercises */}
        {related.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xl font-black text-slate-900 mb-3 flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-orange-500" />
              حرکات مرتبط برای {exercise.muscle}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((rel, i) => (
                <motion.button
                  key={rel.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -2 }}
                  onClick={() => openExercise(rel.id)}
                  className="text-right bg-white rounded-xl border-2 p-3 transition hover:shadow-md"
                  style={{ borderColor: "#fed7aa" }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                      <Dumbbell className="w-4 h-4 text-white" />
                    </div>
                    {rel.youtubeUrl && rel.youtubeUrl.trim() !== "" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-[9px] font-bold text-red-600">
                        <Youtube className="w-3 h-3" /> ویدیو
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-sm text-slate-900">{rel.name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge className={`text-[9px] ${DIFFICULTY_COLORS[rel.difficulty] || "bg-slate-100 text-slate-600"}`}>
                      {DIFFICULTY_LABELS[rel.difficulty] || rel.difficulty}
                    </Badge>
                    <span className="text-[10px] text-slate-400">{rel.muscle}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* ── SEO content with FAQ ── */}
        <section className="mt-10 space-y-6">
          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            <h2 className="text-2xl font-black text-slate-900">
              آموزش {exercise.name} — راهنمای کامل تکنیک و نکات ایمنی
            </h2>
            <p>
              در این صفحه به <strong>آموزش {exercise.name}</strong> پرداخته‌ایم؛ حرکتی برای
              عضله <strong>{exercise.muscle}</strong> که در دسته‌بندی{" "}
              <strong>{CATEGORY_LABELS[exercise.category] || exercise.category}</strong> قرار
              می‌گیرد. برای اجرای صحیح این حرکت به{" "}
              {exercise.equipment ? `تجهیزاتی نظیر ${exercise.equipment} نیاز دارید` : "هیچ تجهیز خاصی نیاز ندارید و با وزن بدن قابل اجراست"}.
              سطح دشواری این حرکت{" "}
              <strong>{DIFFICULTY_LABELS[exercise.difficulty] || exercise.difficulty}</strong>{" "}
              است.
            </p>
            <p>
              <strong>{exercise.name}</strong> یکی از حرکات مؤثر در برنامه‌های بدنسازی است
              که به تقویت و رشد عضلات {exercise.muscle} کمک می‌کند. رعایت تکنیک صحیح و کنترل
              حرکت در فاز منفی، از ارکان اصلی پیشگیری از آسیب و رسیدن به بهترین نتیجه است.
              توصیه می‌شود قبل از افزایش وزنه، فرم اجرای حرکت را با وزنه سبک تمرین کنید.
            </p>
            <p>
              برای طراحی برنامه تمرینی هدفمند، می‌توانید این حرکت را با سایر حرکات مرتبط
              بالا ترکیب کنید. اگر در حال طراحی <strong>برنامه بدنسازی</strong> برای عضله{" "}
              {exercise.muscle} هستید، ترکیب حرکات مرکب و فرعی در کنار هم به بهترین تحریک
              عضلانی منجر می‌شود.
            </p>
          </div>

          {/* FAQ */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold text-slate-900">
              سوالات متداول درباره {exercise.name}
            </h3>
            <Accordion
              type="single"
              collapsible
              className="w-full bg-white rounded-2xl border-2 px-4"
              style={{ borderColor: "#fed7aa" }}
            >
              <AccordionItem value="q1">
                <AccordionTrigger>
                  چگونه {exercise.name} را به درستی اجرا کنم؟
                </AccordionTrigger>
                <AccordionContent>
                  برای اجرای صحیح {exercise.name}، ابتدا به توضیحات گام‌به‌گام بالا و ویدیوی
                  آموزشی مراجعه کنید. مهم‌ترین اصول: گرم کردن مناسب قبل از شروع، حفظ فرم
                  صحیح بدن، کنترل حرکت در فاز منفی (Eccentric) و تنفس صحیح (دم در فاز منفی
                  و بازدم در فاز مثبت). اگر مبتدی هستید، ابتدا با وزنه سبک تمرین کنید تا
                  تکنیک کاملاً یاد بگیرید.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>
                  {exercise.name} کدام عضله را درگیر می‌کند؟
                </AccordionTrigger>
                <AccordionContent>
                  حرکت {exercise.name} عمدتاً عضله <strong>{exercise.muscle}</strong> را هدف
                  قرار می‌دهد. این حرکت در دسته‌بندی{" "}
                  {CATEGORY_LABELS[exercise.category] || exercise.category} قرار دارد و در
                  برنامه‌های تمرینی مختلف می‌تواند برای رشد و تقویت این عضله استفاده شود.
                  {exercise.equipment
                    ? ` تجهیزات موردنیاز برای این حرکت شامل ${exercise.equipment} است.`
                    : ""}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>
                  {exercise.name} برای چه سطحی مناسب است؟
                </AccordionTrigger>
                <AccordionContent>
                  این حرکت برای سطح{" "}
                  <strong>{DIFFICULTY_LABELS[exercise.difficulty] || exercise.difficulty}</strong>{" "}
                  مناسب است.{" "}
                  {exercise.difficulty === "beginner"
                    ? "افراد مبتدی می‌توانند از این حرکت برای شروع بدنسازی استفاده کنند و با وزنه سبک آن را تمرین کنند."
                    : exercise.difficulty === "advanced"
                    ? "این حرکت برای افراد پیشرفته مناسب است؛ توصیه می‌شود افراد مبتدی ابتدا با حرکات ساده‌تر شروع کنند."
                    : "افراد با سطح متوسط می‌توانند از این حرکت در برنامه تمرینی خود استفاده کنند. مبتدیان می‌توانند با وزنه سبک‌تر آن را تمرین کنند."}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>
      </article>

      <NikaWidget />
    </div>
  );
}

function DetailTopNav({
  onBack,
  onLogo,
  onShare,
}: {
  onBack: () => void;
  onLogo?: () => void;
  onShare?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b" style={{ borderColor: "#fed7aa" }}>
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-orange-600 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          بانک حرکات
        </button>
        <button
          onClick={onLogo}
          className="flex items-center gap-2 group cursor-pointer"
          aria-label="رفتن به صفحه اصلی"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden group-hover:scale-105 transition"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
          >
            <img src="/fitup-logo.png" alt="فیتاپ" className="w-full h-full object-cover" />
          </div>
          <span className="font-black text-sm text-slate-900 group-hover:text-orange-600 transition">فیتاپ</span>
        </button>
        {onShare && (
          <button
            onClick={onShare}
            className="p-2 rounded-lg hover:bg-slate-100 transition"
            aria-label="اشتراک‌گذاری"
          >
            <Share2 className="w-4 h-4 text-slate-500" />
          </button>
        )}
      </div>
    </header>
  );
}
