'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FiArrowRight } from 'react-icons/fi';
import api from '@/lib/api';
import ProductCard from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';

export default function FeaturedProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(false);
    api.get('/products/featured?limit=8')
      .then((res) => setProducts(res.data?.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <section className="py-12 lg:py-16 bg-surface-container-low">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-dark mb-1">
              Featured Cakes
            </h2>
            <p className="text-sm text-outline">Handpicked, just for you</p>
          </div>
          <Link
            href="/products?tag=featured"
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-pink-deep hover:underline group"
          >
            View All
            <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-outline mb-3">Couldn&apos;t load featured cakes right now.</p>
            <button onClick={fetchData} className="px-5 py-2 rounded-full text-sm font-semibold text-pink-deep border border-pink-deep hover:bg-pink-light/20 transition-colors">
              Try Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {products.map((product, i) => (
              <ProductCard key={product._id} product={product} index={i} />
            ))}
          </div>
        )}

        <div className="sm:hidden mt-6 text-center">
          <Link
            href="/products?tag=featured"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold"
          >
            View All Featured
            <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
