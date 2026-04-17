'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import ProductCard from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import api from '@/lib/api';

export default function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Fetch category info and its products
    Promise.all([
      api.get(`/categories/${slug}`).catch(() => null),
      api.get(`/categories/${slug}/products?limit=20`).catch(() => null),
    ]).then(([catRes, prodRes]) => {
      if (catRes?.data?.data) setCategory(catRes.data.data);
      setProducts(prodRes?.data?.data?.items || prodRes?.data?.data?.docs || prodRes?.data?.data || []);
    }).finally(() => setLoading(false));
  }, [slug]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-dark">
            {category?.name || slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </h1>
          {category?.description && (
            <p className="text-sm text-outline mt-1">{category.description}</p>
          )}
        </div>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl block mb-3">🔍</span>
            <p className="text-outline">No products found in this category.</p>
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
