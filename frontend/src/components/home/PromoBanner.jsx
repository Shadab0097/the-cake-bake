'use client';

import Link from 'next/link';

export default function PromoBanner() {
  return (
    <section className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl gradient-primary p-8 sm:p-12 lg:p-16">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-center sm:text-left">
              <p className="text-sm text-white/80 uppercase tracking-widest font-medium mb-2">
                First Time? Welcome!
              </p>
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                Get 20% Off Your First Order
              </h3>
              <p className="text-white/80 text-sm sm:text-base">
                Use code <span className="font-bold text-white bg-white/20 px-2 py-0.5 rounded">WELCOME20</span> at checkout
              </p>
            </div>
            <Link
              href="/products"
              className="shrink-0 inline-flex items-center gap-2 px-7 py-3 bg-white text-pink-deep font-bold rounded-full hover:bg-pink-light transition-colors shadow-lg"
            >
              Shop Now 🛒
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
