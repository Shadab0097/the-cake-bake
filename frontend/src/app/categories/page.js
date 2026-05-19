'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiGrid } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import { getCategoryImageUrl } from '@/lib/utils';

export default function CategoriesPage() {
  const categories = useSelector((s) => s.categories.items);
  const loading = useSelector((s) => !s.categories.hasFetched);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-dark mb-2">Cake Categories</h1>
          <p className="text-sm text-outline">Browse our curated collection of cakes for every craving</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface-container-lowest shadow-card">
                <div className="w-16 h-16 rounded-full bg-surface-container-high" />
                <div className="h-4 bg-surface-container-high rounded w-24" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-16">
            <FiGrid className="w-12 h-12 text-outline/40 mx-auto mb-3" />
            <p className="text-outline">No categories available right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {categories.map((cat, i) => {
              const categoryImage = getCategoryImageUrl(cat, 'category');

              return (
                <motion.div
                  key={cat._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-surface-container-lowest shadow-card hover:shadow-lg transition-all hover:-translate-y-1"
                  >
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-surface-container-low flex items-center justify-center group-hover:scale-110 transition-transform">
                      {categoryImage ? (
                        <Image
                          src={categoryImage}
                          alt={cat.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <FiGrid className="w-7 h-7 text-outline" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-dark text-center group-hover:text-pink-deep transition-colors">
                      {cat.name}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
