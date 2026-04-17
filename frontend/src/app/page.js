import AppShell from '@/components/layout/AppShell';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryCarousel from '@/components/home/CategoryCarousel';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import BestsellerSection from '@/components/home/BestsellerSection';
import OccasionGrid from '@/components/home/OccasionGrid';
import PromoBanner from '@/components/home/PromoBanner';
import HowItWorks from '@/components/home/HowItWorks';
import TestimonialMarquee from '@/components/home/TestimonialMarquee';

export default function HomePage() {
  return (
    <AppShell>
      {/* 1. Hero Banner (hardcoded slides) */}
      <HeroBanner />

      {/* 2. Categories Carousel */}
      <CategoryCarousel />

      {/* 3. Featured Products Grid */}
      <FeaturedProducts />

      {/* 4. Bestsellers Horizontal Scroll */}
      <BestsellerSection />

      {/* 5. Occasion Grid */}
      <OccasionGrid />

      {/* 6. Promo Banner (WELCOME20) */}
      <PromoBanner />

      {/* 7. How It Works */}
      <HowItWorks />

      {/* 8. Testimonials Marquee */}
      <TestimonialMarquee />

      {/* 9. Celebration Reminders CTA */}
      <section className="py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-surface-container-lowest rounded-3xl p-8 sm:p-12 text-center shadow-card">
            <span className="text-4xl mb-4 block">🔔</span>
            <h3 className="text-xl sm:text-2xl font-bold text-dark mb-2">
              Never Miss a Celebration
            </h3>
            <p className="text-sm text-outline max-w-md mx-auto mb-6">
              Set reminders for birthdays, anniversaries & special occasions. We&apos;ll notify you in advance so you can order the perfect cake!
            </p>
            <a
              href="/account/reminders"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full gradient-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Set Reminders 📅
            </a>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
