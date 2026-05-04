'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import api from '@/lib/api';

const FALLBACK_SLIDES = [
  {
    title: 'Freshly Baked,\nDelivered with Love',
    subtitle: 'Premium artisan cakes for every celebration',
    cta: { label: 'Order Now', href: '/products' },
    bg: 'from-pink-deep/90 to-primary/80',
    emoji: '🎂',
  },
  {
    title: 'Custom Cake\nDesigns',
    subtitle: 'Turn your imagination into reality with our bespoke designs',
    cta: { label: 'Design Yours', href: '/custom-cake' },
    bg: 'from-secondary/80 to-secondary/60',
    emoji: '🎨',
  },
  {
    title: 'Corporate\nCelebrations',
    subtitle: 'Elevate your events with premium cake solutions',
    cta: { label: 'Get a Quote', href: '/corporate' },
    bg: 'from-tertiary/80 to-pink-deep/60',
    emoji: '🏢',
  },
];

const resolveMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('/')) {
    return `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'}${url}`;
  }
  return url;
};

const bannerToSlide = (banner) => ({
  title: banner.title || '',
  subtitle: banner.subtitle || '',
  cta: { label: 'Explore Now', href: banner.link || '/products' },
  bg: 'from-pink-deep/90 to-primary/80',
  emoji: '',
  image: resolveMediaUrl(banner.image?.desktop || banner.image?.mobile || ''),
});

export default function HeroBanner() {
  const [slides, setSlides] = useState(FALLBACK_SLIDES);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let cancelled = false;

    api.get('/banners?position=hero')
      .then((res) => {
        const banners = Array.isArray(res.data?.data) ? res.data.data : [];
        const liveSlides = banners
          .map(bannerToSlide)
          .filter((slide) => slide.title || slide.image);

        if (!cancelled && liveSlides.length > 0) {
          setSlides(liveSlides);
          setCurrent(0);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[current] || slides[0] || FALLBACK_SLIDES[0];

  return (
    <section className="relative w-full h-[480px] sm:h-[540px] lg:h-[600px] overflow-hidden rounded-b-[2rem] lg:rounded-b-[3rem]">
      {/* Background */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className={`absolute inset-0 bg-gradient-to-br ${slide.bg}`}
        >
          {slide.image && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.image} alt={slide.title || 'Hero banner'} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/10" />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-xl" />
      <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-white/5 blur-xl" />

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.5 }}
            className="max-w-xl"
          >
            {slide.emoji && <div className="text-6xl sm:text-7xl mb-4">{slide.emoji}</div>}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight whitespace-pre-line mb-4 font-montserrat">
              {slide.title}
            </h1>
            <p className="text-base sm:text-lg text-white/85 mb-8 max-w-md">
              {slide.subtitle}
            </p>
            <Link
              href={slide.cta.href}
              className="inline-flex items-center gap-2 px-7 py-3 bg-white text-pink-deep font-semibold rounded-full hover:bg-pink-light transition-colors shadow-lg group"
            >
              {slide.cta.label}
              <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2">
        <button
          onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors text-white"
          aria-label="Previous slide"
        >
          <FiChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors text-white"
          aria-label="Next slide"
        >
          <FiChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 rounded-full transition-all ${
              i === current ? 'w-8 bg-white' : 'w-2 bg-white/40'
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
