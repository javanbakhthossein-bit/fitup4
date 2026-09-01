"use client";

import { LandingNav } from "./landing-nav";
import { HeroSection } from "./sections/hero-section";
import { TrustBar } from "./sections/trust-bar";
import { CoachVsTraditionalSection } from "./sections/coach-vs-traditional-section";
import { FeaturesSection } from "./sections/features-section";
import { ToolsSection } from "./sections/tools-section";
import { AiCoachSection } from "./sections/ai-coach-section";
import { CoachesTrustSection } from "./sections/coaches-trust-section";
import { PricingSection } from "./sections/pricing-section";
import { TestimonialsSection } from "./sections/testimonials-section";
import { FaqSection } from "./sections/faq-section";
import { CtaSection } from "./sections/cta-section";
import { ArticlesSliderSection } from "./sections/articles-slider-section";
import { AppInstallSection } from "./sections/app-install-section";
import { InstagramCtaSection } from "./sections/instagram-cta-section";
import { LandingFooter } from "./landing-footer";

export function LandingPage() {
  // NOTE: scroll detection moved into LandingNav to prevent re-rendering
  // all child sections (which caused the "white flash" flicker on scroll).
  // Each section uses whileInView animations with viewport={{ once: true }},
  // and parent re-renders were resetting their animation state briefly.
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingNav />
      <main>
        <HeroSection />
        <TrustBar />
        <CoachVsTraditionalSection />
        <FeaturesSection />
        <ToolsSection />
        <AiCoachSection />
        <CoachesTrustSection />
        <PricingSection />
        <ArticlesSliderSection />
        <TestimonialsSection />
        <FaqSection />
        <AppInstallSection />
        <CtaSection />
        {/* CTA اینستاگرام — بالای فوتر */}
        <InstagramCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
