'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import ProductCard from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { formatOccasion, OCCASION_EMOJIS } from '@/lib/utils';
import api from '@/lib/api';

export default function OccasionProductsPage() {
  const { occasion } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/products/by-occasion/${occasion}?limit=20`)
      .then((res) => {
        const data = res.data?.data;
        setProducts(Array.isArray(data) ? data : (data?.items || data?.docs || []));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [occasion]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <span className="text-5xl block mb-3">{OCCASION_EMOJIS[occasion] || '🎂'}</span>
          <h1 className="text-2xl lg:text-3xl font-bold text-dark">
            {formatOccasion(occasion)} Cakes
          </h1>
          <p className="text-sm text-outline mt-1">The perfect cakes for your special celebration</p>
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-outline">No cakes found for this occasion yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {products.map((p, i) => (
              <ProductCard key={p._id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
