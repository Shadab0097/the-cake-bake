'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiFilter, FiX, FiChevronDown } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import ProductCard from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import api from '@/lib/api';

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Popular', value: 'popularity' },
  { label: 'Price: Low → High', value: 'price_asc' },
  { label: 'Price: High → Low', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
];

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [products, setProducts] = useState([]);
  const categories = useSelector((s) => s.categories.items);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filters state from URL
  const currentPage = parseInt(searchParams.get('page') || '1');
  const currentSort = searchParams.get('sort') || 'newest';
  const currentCategory = searchParams.get('category') || '';
  const currentTag = searchParams.get('tag') || '';
  const isEggless = searchParams.get('eggless') === 'true';
  const currentMin = searchParams.get('minPrice') || '';
  const currentMax = searchParams.get('maxPrice') || '';

  // Fetch products
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('limit', '12');
    if (currentSort) params.set('sort', currentSort);
    if (currentCategory) params.set('category', currentCategory);
    if (currentTag) params.set('tags', currentTag);
    if (isEggless) params.set('isEggless', 'true');
    if (currentMin) params.set('minPrice', currentMin);
    if (currentMax) params.set('maxPrice', currentMax);

    api.get(`/products?${params.toString()}`)
      .then((res) => {
        const data = res.data?.data;
        setProducts(Array.isArray(data) ? data : (data?.items || data?.docs || []));
        setTotalPages(data?.pagination?.totalPages || data?.totalPages || 1);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [currentPage, currentSort, currentCategory, currentTag, isEggless, currentMin, currentMax]);

  // Update URL params
  const updateParams = useCallback(
    (key, value) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      if (key !== 'page') params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-dark">
              {currentTag ? `${currentTag.charAt(0).toUpperCase()}${currentTag.slice(1)} Cakes` : 'All Cakes'}
            </h1>
            <p className="text-sm text-outline mt-1">
              Discover our premium collection of freshly baked cakes
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-outline-variant/30 rounded-lg hover:bg-surface-container-low transition-colors"
            >
              <FiFilter className="w-4 h-4" />
              Filters
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={currentSort}
                onChange={(e) => updateParams('sort', e.target.value)}
                className="appearance-none px-4 py-2 pr-8 text-sm font-medium bg-surface-container-lowest border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <aside
            className={`shrink-0 w-64 ${
              showFilters
                ? 'fixed inset-0 z-50 bg-white p-6 overflow-y-auto lg:static lg:p-0 lg:bg-transparent'
                : 'hidden lg:block'
            }`}
          >
            {showFilters && (
              <button
                onClick={() => setShowFilters(false)}
                className="lg:hidden absolute top-4 right-4 p-2 rounded-full hover:bg-surface-container-high"
              >
                <FiX className="w-5 h-5" />
              </button>
            )}

            <div className="space-y-6">
              {/* Categories */}
              <div>
                <h3 className="text-sm font-semibold text-dark mb-3 uppercase tracking-wider">
                  Category
                </h3>
                <div className="space-y-1.5">
                  <button
                    onClick={() => updateParams('category', '')}
                    className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      !currentCategory ? 'bg-pink-light/30 text-pink-deep font-medium' : 'text-dark hover:bg-surface-container-low'
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat._id}
                      onClick={() => {
                        updateParams('category', cat._id);
                        setShowFilters(false);
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                        currentCategory === cat._id ? 'bg-pink-light/30 text-pink-deep font-medium' : 'text-dark hover:bg-surface-container-low'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eggless Filter */}
              <div>
                <h3 className="text-sm font-semibold text-dark mb-3 uppercase tracking-wider">
                  Dietary
                </h3>
                <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low rounded-lg">
                  <input
                    type="checkbox"
                    checked={isEggless}
                    onChange={(e) => updateParams('eggless', e.target.checked ? 'true' : '')}
                    className="w-4 h-4 accent-pink-deep"
                  />
                  Eggless Only
                </label>
              </div>

              {/* Price Range */}
              <div>
                <h3 className="text-sm font-semibold text-dark mb-3 uppercase tracking-wider">
                  Price Range
                </h3>
                <div className="flex items-center gap-2 px-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={currentMin}
                    onChange={(e) => updateParams('minPrice', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep"
                  />
                  <span className="text-xs text-outline">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={currentMax}
                    onChange={(e) => updateParams('maxPrice', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep"
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {loading ? (
              <ProductGridSkeleton count={12} />
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl mb-4 block">🔍</span>
                <h3 className="text-lg font-semibold text-dark mb-1">No cakes found</h3>
                <p className="text-sm text-outline">
                  Try adjusting your filters or browse all our products.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6">
                  {products.map((product, i) => (
                    <ProductCard key={product._id} product={product} index={i} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-10">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => updateParams('page', page.toString())}
                        className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                          page === currentPage
                            ? 'gradient-primary text-white'
                            : 'bg-surface-container-low text-dark hover:bg-pink-light/30'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<AppShell><div className="max-w-7xl mx-auto px-4 py-8"><ProductGridSkeleton count={12} /></div></AppShell>}>
      <ProductsContent />
    </Suspense>
  );
}
