'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import ProductCard from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import api from '@/lib/api';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) { setLoading(false); return; }
    setLoading(true);
    api.get(`/products/search?q=${encodeURIComponent(query)}&limit=20`)
      .then((res) => {
        const data = res.data?.data;
        setProducts(Array.isArray(data) ? data : (data?.items || data?.docs || []));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-dark mb-1">
          Search Results
        </h1>
        <p className="text-sm text-outline mb-6">
          {query ? `Showing results for "${query}"` : 'Enter a search query'}
        </p>

        {loading ? (
          <ProductGridSkeleton count={8} />
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl block mb-3">🔍</span>
            <h3 className="text-lg font-semibold text-dark mb-1">No results found</h3>
            <p className="text-sm text-outline">Try different keywords or browse our categories.</p>
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

export default function SearchPage() {
  return (
    <Suspense fallback={<AppShell><div className="max-w-7xl mx-auto px-4 py-8"><ProductGridSkeleton count={8} /></div></AppShell>}>
      <SearchContent />
    </Suspense>
  );
}
