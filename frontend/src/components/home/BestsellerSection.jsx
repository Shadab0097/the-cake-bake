'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';
import api from '@/lib/api';
import ProductCard from '@/components/ui/ProductCard';

export default function BestsellerSection() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(false);

  const fetchData = () => {
    setError(false);
    api.get('/products/bestsellers?limit=6')
      .then((res) => setProducts(res.data?.data || []))
      .catch(() => setError(true));
  };

  useEffect(() => { fetchData(); }, []);

  if (!error && products.length === 0) return null;

  return (
    <section className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-xs uppercase tracking-widest text-secondary font-semibold mb-1 block">
              🏆 Most Loved
            </span>
            <h2 className="text-2xl lg:text-3xl font-bold text-dark">
              Bestsellers
            </h2>
          </div>
          <Link
            href="/products?sort=popularity"
            className="flex items-center gap-1 text-sm font-semibold text-pink-deep hover:underline group"
          >
            View All
            <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-sm text-outline mb-3">Couldn&apos;t load bestsellers right now.</p>
            <button onClick={fetchData} className="px-5 py-2 rounded-full text-sm font-semibold text-pink-deep border border-pink-deep hover:bg-pink-light/20 transition-colors">
              Try Again
            </button>
          </div>
        ) : (
          <div className="flex gap-4 lg:gap-6 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory">
            {products.map((product, i) => (
              <div key={product._id} className="snap-start shrink-0 w-[240px] sm:w-[260px] lg:w-[280px]">
                <ProductCard product={product} index={i} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
