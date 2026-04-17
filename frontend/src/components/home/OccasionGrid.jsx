'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatOccasion, OCCASIONS, OCCASION_EMOJIS } from '@/lib/utils';

export default function OccasionGrid() {
  const displayOccasions = OCCASIONS.slice(0, 12);

  return (
    <section className="py-12 lg:py-16 bg-surface-container-low">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl lg:text-3xl font-bold text-dark mb-2">
            Cakes for Every Occasion
          </h2>
          <p className="text-sm text-outline">
            Find the perfect cake to celebrate life&apos;s sweetest moments
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4">
          {displayOccasions.map((occasion, index) => (
            <motion.div
              key={occasion}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.04 }}
            >
              <Link
                href={`/occasions/${occasion}`}
                className="group flex flex-col items-center gap-2 p-4 lg:p-5 rounded-2xl bg-surface-container-lowest hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <span className="text-3xl lg:text-4xl group-hover:scale-110 transition-transform duration-300">
                  {OCCASION_EMOJIS[occasion] || '🎂'}
                </span>
                <span className="text-xs lg:text-sm font-medium text-dark text-center group-hover:text-pink-deep transition-colors">
                  {formatOccasion(occasion)}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
