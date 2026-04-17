'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import api from '@/lib/api';

export default function CategoryCarousel() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/categories')
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => {});
  }, []);

  if (categories.length === 0) return null;

  const CATEGORY_EMOJIS = {
    'chocolate-cakes': '🍫',
    'fruit-cakes': '🍓',
    'cheesecakes': '🧀',
    'cupcakes': '🧁',
    'pastries': '🥐',
    'cookies': '🍪',
    'donuts': '🍩',
    'brownies': '🟤',
    'photo-cakes': '📸',
    'tier-cakes': '🎂',
    'jar-cakes': '🫙',
    'dry-cakes': '🥮',
  };

  return (
    <section className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl lg:text-3xl font-bold text-dark mb-2">
            Shop by Category
          </h2>
          <p className="text-sm text-outline">Find the perfect cake for any craving</p>
        </div>

        <div className="flex gap-4 lg:gap-6 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory">
          {categories.filter((c) => c.isActive !== false).map((category, index) => (
            <motion.div
              key={category._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="snap-center shrink-0"
            >
              <Link
                href={`/categories/${category.slug}`}
                className="flex flex-col items-center gap-3 group"
              >
                <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-surface-container-low flex items-center justify-center text-3xl lg:text-4xl group-hover:bg-pink-light/30 group-hover:scale-110 transition-all duration-300 shadow-card">
                  {CATEGORY_EMOJIS[category.slug] || '🎂'}
                </div>
                <span className="text-xs lg:text-sm font-medium text-dark group-hover:text-pink-deep transition-colors text-center whitespace-nowrap">
                  {category.name}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
