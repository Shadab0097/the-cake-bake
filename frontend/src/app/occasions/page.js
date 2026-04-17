'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import AppShell from '@/components/layout/AppShell';
import { formatOccasion, OCCASIONS, OCCASION_EMOJIS } from '@/lib/utils';

export default function OccasionsPage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-dark mb-2">Cakes for Every Occasion</h1>
          <p className="text-sm text-outline">Make every celebration unforgettable with the perfect cake</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {OCCASIONS.map((occasion, i) => (
            <motion.div
              key={occasion}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                href={`/occasions/${occasion}`}
                className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface-container-lowest shadow-card hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <span className="text-4xl group-hover:scale-110 transition-transform">
                  {OCCASION_EMOJIS[occasion] || '🎂'}
                </span>
                <span className="text-sm font-medium text-dark text-center group-hover:text-pink-deep transition-colors">
                  {formatOccasion(occasion)}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
