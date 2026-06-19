'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFilter, FiX, FiChevronDown, FiCheck } from 'react-icons/fi';
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

const PRICE_PRESETS = [
  { label: 'Under ₹500', min: '', max: '500' },
  { label: '₹500 – ₹1000', min: '500', max: '1000' },
  { label: '₹1000 – ₹2000', min: '1000', max: '2000' },
  { label: 'Over ₹2000', min: '2000', max: '' },
];

/* ── Collapsible filter group ──────────────────────────────────────────── */
function FilterGroup({ title, count = 0, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-outline-variant/15 pb-5 last:border-b-0 last:pb-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between w-full"
      >
        <span className="flex items-center gap-2 text-[13px] font-bold text-dark uppercase tracking-wider">
          {title}
          {count > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-pink-deep text-white text-[10px] font-bold leading-none">
              {count}
            </span>
          )}
        </span>
        <FiChevronDown className={`w-4 h-4 text-outline transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Custom checkbox row ───────────────────────────────────────────────── */
function CheckRow({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 px-2 py-2 text-sm text-dark cursor-pointer rounded-lg hover:bg-surface-container-low transition-colors">
      <span
        className={`flex items-center justify-center w-[18px] h-[18px] rounded-[5px] border transition-colors ${
          checked ? 'bg-pink-deep border-pink-deep' : 'border-outline-variant bg-white'
        }`}
      >
        {checked && <FiCheck className="w-3 h-3 text-white" />}
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const categories = useSelector((s) => s.categories.items);
  const [result, setResult] = useState({ query: '', products: [], totalPages: 1, total: 0 });
  const [showFilters, setShowFilters] = useState(false);

  // Filters state from URL
  const currentPage = parseInt(searchParams.get('page') || '1');
  const currentSort = searchParams.get('sort') || 'newest';
  const currentCategory = searchParams.get('category') || '';
  const currentTag = searchParams.get('tag') || '';
  const isEggless = searchParams.get('eggless') === 'true';
  const hasEgglessOption = searchParams.get('hasEgglessOption') === 'true';
  const inStock = searchParams.get('available') === 'true';
  const currentMin = searchParams.get('minPrice') || '';
  const currentMax = searchParams.get('maxPrice') || '';

  const [priceDraft, setPriceDraft] = useState({ min: currentMin, max: currentMax });
  const [syncedPrice, setSyncedPrice] = useState({ min: currentMin, max: currentMax });
  // Sync the draft inputs when the URL price changes (presets / clear all).
  // Adjusting state during render avoids an effect-driven cascading re-render.
  if (syncedPrice.min !== currentMin || syncedPrice.max !== currentMax) {
    setSyncedPrice({ min: currentMin, max: currentMax });
    setPriceDraft({ min: currentMin, max: currentMax });
  }

  const productQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('limit', '12');
    if (currentSort) params.set('sort', currentSort);
    if (currentCategory) params.set('category', currentCategory);
    if (currentTag) params.set('tags', currentTag);
    if (isEggless) params.set('isEggless', 'true');
    if (hasEgglessOption) params.set('hasEgglessOption', 'true');
    if (inStock) params.set('available', 'true');
    if (currentMin) params.set('minPrice', currentMin);
    if (currentMax) params.set('maxPrice', currentMax);

    return params.toString();
  }, [currentPage, currentSort, currentCategory, currentTag, isEggless, hasEgglessOption, inStock, currentMin, currentMax]);

  const isLoaded = result.query === productQuery;
  const products = isLoaded ? result.products : [];
  const totalPages = isLoaded ? result.totalPages : 1;
  const total = isLoaded ? result.total : 0;
  const loading = !isLoaded;

  // Fetch products
  useEffect(() => {
    let isCurrent = true;

    api.get(`/products?${productQuery}`)
      .then((res) => {
        if (!isCurrent) return;

        const data = res.data?.data;
        const items = Array.isArray(data) ? data : (data?.items || data?.docs || []);
        setResult({
          query: productQuery,
          products: items,
          totalPages: data?.pagination?.totalPages || data?.totalPages || 1,
          total: data?.pagination?.total ?? items.length,
        });
      })
      .catch(() => {
        if (!isCurrent) return;

        setResult({ query: productQuery, products: [], totalPages: 1, total: 0 });
      });

    return () => {
      isCurrent = false;
    };
  }, [productQuery]);

  // Lock body scroll while the mobile filter drawer is open
  useEffect(() => {
    if (!showFilters) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [showFilters]);

  // Update a single URL param (filters reset to page 1; pagination keeps page)
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

  // Update several params at once (always resets to page 1)
  const applyParams = useCallback(
    (updates) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Clear all filters, keep the chosen sort
  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (currentSort && currentSort !== 'newest') params.set('sort', currentSort);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [currentSort, pathname, router]);

  const categoryName = categories.find((c) => c._id === currentCategory)?.name;
  const priceLabel = currentMin && currentMax
    ? `₹${currentMin} – ₹${currentMax}`
    : currentMin
      ? `Over ₹${currentMin}`
      : currentMax
        ? `Under ₹${currentMax}`
        : '';

  // Active filter chips
  const activeFilters = [];
  if (currentCategory) activeFilters.push({ key: 'category', label: categoryName || 'Category', onRemove: () => updateParams('category', '') });
  if (currentTag) activeFilters.push({ key: 'tag', label: `${currentTag.charAt(0).toUpperCase()}${currentTag.slice(1)}`, onRemove: () => updateParams('tag', '') });
  if (isEggless) activeFilters.push({ key: 'eggless', label: 'Eggless', onRemove: () => updateParams('eggless', '') });
  if (hasEgglessOption) activeFilters.push({ key: 'hasEgglessOption', label: 'Eggless option', onRemove: () => updateParams('hasEgglessOption', '') });
  if (inStock) activeFilters.push({ key: 'available', label: 'In stock', onRemove: () => updateParams('available', '') });
  if (priceLabel) activeFilters.push({ key: 'price', label: priceLabel, onRemove: () => applyParams({ minPrice: '', maxPrice: '' }) });

  const dietaryCount = (isEggless ? 1 : 0) + (hasEgglessOption ? 1 : 0);
  const isPresetActive = (p) => (p.min || '') === currentMin && (p.max || '') === currentMax;

  const renderFilters = () => (
    <div className="space-y-5">
      {/* Categories */}
      <FilterGroup title="Category" count={currentCategory ? 1 : 0}>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 no-scrollbar">
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
              onClick={() => updateParams('category', cat._id)}
              className={`block w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                currentCategory === cat._id ? 'bg-pink-light/30 text-pink-deep font-medium' : 'text-dark hover:bg-surface-container-low'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </FilterGroup>

      {/* Price Range */}
      <FilterGroup title="Price Range" count={priceLabel ? 1 : 0}>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRICE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() =>
                isPresetActive(p)
                  ? applyParams({ minPrice: '', maxPrice: '' })
                  : applyParams({ minPrice: p.min, maxPrice: p.max })
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isPresetActive(p)
                  ? 'bg-pink-deep border-pink-deep text-white'
                  : 'border-outline-variant/40 text-dark hover:border-pink-deep hover:text-pink-deep'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            placeholder="Min"
            value={priceDraft.min}
            onChange={(e) => setPriceDraft((d) => ({ ...d, min: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep"
          />
          <span className="text-xs text-outline">to</span>
          <input
            type="number"
            min="0"
            placeholder="Max"
            value={priceDraft.max}
            onChange={(e) => setPriceDraft((d) => ({ ...d, max: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep"
          />
        </div>
        <button
          onClick={() => applyParams({ minPrice: priceDraft.min, maxPrice: priceDraft.max })}
          className="mt-3 w-full py-2 rounded-lg text-sm font-semibold text-pink-deep border border-pink-deep/40 hover:bg-pink-light/20 transition-colors"
        >
          Apply Price
        </button>
      </FilterGroup>

      {/* Dietary */}
      <FilterGroup title="Dietary" count={dietaryCount}>
        <CheckRow
          checked={isEggless}
          onChange={(e) => updateParams('eggless', e.target.checked ? 'true' : '')}
          label="Eggless Only"
        />
        <CheckRow
          checked={hasEgglessOption}
          onChange={(e) => updateParams('hasEgglessOption', e.target.checked ? 'true' : '')}
          label="Eggless Option Available"
        />
      </FilterGroup>

      {/* Availability */}
      <FilterGroup title="Availability" count={inStock ? 1 : 0}>
        <CheckRow
          checked={inStock}
          onChange={(e) => updateParams('available', e.target.checked ? 'true' : '')}
          label="In Stock Only"
        />
      </FilterGroup>
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-dark">
              {currentTag ? `${currentTag.charAt(0).toUpperCase()}${currentTag.slice(1)} Cakes` : 'All Cakes'}
            </h1>
            <p className="text-sm text-outline mt-1">
              Discover our premium collection of freshly baked cakes
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters(true)}
              className="lg:hidden relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-outline-variant/30 rounded-lg hover:bg-surface-container-low transition-colors"
            >
              <FiFilter className="w-4 h-4" />
              Filters
              {activeFilters.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-pink-deep text-white text-[10px] font-bold leading-none">
                  {activeFilters.length}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={currentSort}
                onChange={(e) => updateParams('sort', e.target.value)}
                aria-label="Sort products"
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
          {/* Sidebar Filters (desktop) */}
          <aside className="hidden lg:block shrink-0 w-72 self-start lg:sticky lg:top-32">
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-5 shadow-sm max-h-[calc(100vh-9rem)] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant/15">
                <h2 className="flex items-center gap-2 text-base font-bold text-dark">
                  <FiFilter className="w-4 h-4 text-pink-deep" />
                  Filters
                </h2>
                {activeFilters.length > 0 && (
                  <button onClick={clearFilters} className="text-xs font-semibold text-pink-deep hover:underline">
                    Clear all
                  </button>
                )}
              </div>
              {renderFilters()}
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1 min-w-0">
            {/* Result meta + active chips */}
            <div className="flex flex-col gap-3 mb-5">
              <p className="text-sm text-outline">
                {loading ? (
                  'Loading…'
                ) : (
                  <>
                    <span className="font-semibold text-dark">{total}</span> {total === 1 ? 'cake' : 'cakes'} found
                  </>
                )}
              </p>
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {activeFilters.map((f) => (
                    <button
                      key={f.key}
                      onClick={f.onRemove}
                      className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-pink-light/30 text-pink-deep text-xs font-medium hover:bg-pink-light/50 transition-colors"
                    >
                      {f.label}
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  ))}
                  <button
                    onClick={clearFilters}
                    className="text-xs font-semibold text-outline hover:text-pink-deep underline underline-offset-2"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <ProductGridSkeleton count={12} />
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl mb-4 block">🔍</span>
                <h3 className="text-lg font-semibold text-dark mb-1">No cakes found</h3>
                <p className="text-sm text-outline mb-4">
                  Try adjusting your filters or browse all our products.
                </p>
                {activeFilters.length > 0 && (
                  <button
                    onClick={clearFilters}
                    className="px-5 py-2 rounded-full text-sm font-semibold text-white gradient-primary"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                  {products.map((product, i) => (
                    <ProductCard key={product._id} product={product} index={i} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-wrap justify-center gap-2 mt-10">
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

      {/* Mobile Filter Drawer */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              key="filter-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-50 lg:hidden"
              onClick={() => setShowFilters(false)}
            />
            <motion.div
              key="filter-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="fixed top-0 left-0 bottom-0 z-50 w-[85%] max-w-sm bg-white shadow-2xl flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15">
                <h2 className="flex items-center gap-2 text-base font-bold text-dark">
                  <FiFilter className="w-4 h-4 text-pink-deep" />
                  Filters
                </h2>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
                  aria-label="Close filters"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {renderFilters()}
              </div>

              <div className="flex items-center gap-3 px-5 py-4 border-t border-outline-variant/15">
                <button
                  onClick={clearFilters}
                  className="flex-1 py-3 rounded-full border border-outline-variant/40 text-sm font-semibold text-dark hover:bg-surface-container-low transition-colors"
                >
                  Clear all
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 py-3 rounded-full gradient-primary text-white text-sm font-semibold"
                >
                  Show {total} {total === 1 ? 'result' : 'results'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
