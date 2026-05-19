'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { FiChevronDown, FiSearch, FiSliders, FiX } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import ProductCard from '@/components/ui/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import api from '@/lib/api';
import { OCCASIONS, formatOccasion } from '@/lib/utils';

const SORT_OPTIONS = [
  { label: 'Relevant', value: '' },
  { label: 'Newest', value: 'newest' },
  { label: 'Popular', value: 'popularity' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
];

const COMMON_FLAVORS = [
  'chocolate',
  'vanilla',
  'red velvet',
  'butterscotch',
  'black forest',
  'pineapple',
  'strawberry',
];

const FILTER_KEYS = ['q', 'category', 'flavor', 'occasion', 'city', 'minPrice', 'maxPrice', 'sort', 'available'];

const getSearchState = (searchParams) => ({
  q: searchParams.get('q') || '',
  category: searchParams.get('category') || '',
  flavor: searchParams.get('flavor') || '',
  occasion: searchParams.get('occasion') || '',
  city: searchParams.get('city') || '',
  minPrice: searchParams.get('minPrice') || '',
  maxPrice: searchParams.get('maxPrice') || '',
  sort: searchParams.get('sort') || '',
  available: searchParams.get('available') === 'true',
});

const hasSearchCriteria = (state) => FILTER_KEYS.some((key) => {
  if (key === 'sort') return false;
  if (key === 'available') return state.available;
  return Boolean(String(state[key] || '').trim());
});

const toPaise = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed * 100) : '';
};

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const categories = useSelector((s) => s.categories.items);
  const searchParamString = searchParams.toString();

  const searchState = useMemo(() => getSearchState(new URLSearchParams(searchParamString)), [searchParamString]);
  const [draft, setDraft] = useState(searchState);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const currentPage = Number.parseInt(searchParams.get('page') || '1', 10) || 1;
  const criteriaActive = hasSearchCriteria(searchState);

  useEffect(() => {
    setDraft(searchState);
  }, [searchState]);

  const pushParams = useCallback((nextState, nextPage = '1') => {
    const params = new URLSearchParams();
    FILTER_KEYS.forEach((key) => {
      if (key === 'available') {
        if (nextState.available) params.set('available', 'true');
        return;
      }

      const value = String(nextState[key] || '').trim();
      if (value) params.set(key, value);
    });

    if (nextPage && nextPage !== '1') params.set('page', nextPage);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router]);

  const updateFilter = useCallback((key, value) => {
    const nextState = { ...searchState, [key]: value };
    pushParams(nextState);
  }, [pushParams, searchState]);

  const handleSubmit = (event) => {
    event.preventDefault();
    pushParams(draft);
  };

  const applyDraftFilters = () => {
    pushParams(draft);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDraft({
      q: '',
      category: '',
      flavor: '',
      occasion: '',
      city: '',
      minPrice: '',
      maxPrice: '',
      sort: '',
      available: false,
    });
    router.push(pathname, { scroll: false });
  };

  useEffect(() => {
    if (!criteriaActive) {
      setProducts([]);
      setPagination(null);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    params.set('limit', '12');
    params.set('page', String(currentPage));

    if (searchState.q.trim()) params.set('q', searchState.q.trim());
    if (searchState.category) params.set('category', searchState.category);
    if (searchState.flavor) params.set('flavor', searchState.flavor.trim());
    if (searchState.occasion) params.set('occasion', searchState.occasion);
    if (searchState.city) params.set('city', searchState.city.trim());
    if (searchState.sort) params.set('sort', searchState.sort);
    if (searchState.available) params.set('available', 'true');

    const minPrice = toPaise(searchState.minPrice);
    const maxPrice = toPaise(searchState.maxPrice);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);

    let cancelled = false;
    setLoading(true);

    api.get(`/products/search?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        const items = Array.isArray(data) ? data : (data?.items || data?.docs || []);
        setProducts(items);
        setPagination(data?.pagination || null);
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
        setPagination(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [criteriaActive, currentPage, searchState]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-dark">Search Cakes</h1>
            <p className="text-sm text-outline mt-1">
              {criteriaActive ? `${pagination?.total || products.length} matching products` : 'Find cakes by name, flavor, occasion, price, and delivery city'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full lg:max-w-xl">
            <div className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-white px-3 py-2 shadow-sm">
              <FiSearch className="w-5 h-5 text-outline shrink-0" />
              <input
                value={draft.q}
                onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
                placeholder="Search cakes, flavors, occasions"
                className="min-w-0 flex-1 bg-transparent text-sm text-dark placeholder:text-outline focus:outline-none"
                maxLength={80}
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-pink-deep px-4 py-2 text-sm font-semibold text-white hover:bg-pink-deep/90 transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className="lg:hidden inline-flex w-fit items-center gap-2 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-medium text-dark"
          >
            <FiSliders className="w-4 h-4" />
            Filters
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={searchState.sort}
                onChange={(e) => updateFilter('sort', e.target.value)}
                className="appearance-none rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 pr-8 text-sm font-medium text-dark focus:outline-none focus:border-pink-deep"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value || 'relevant'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FiChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            </div>

            {criteriaActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm font-medium text-dark hover:bg-surface-container-low transition-colors"
              >
                <FiX className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-8">
          <aside
            className={`shrink-0 w-72 ${
              showFilters
                ? 'fixed inset-0 z-50 overflow-y-auto bg-white p-6 lg:static lg:p-0 lg:bg-transparent'
                : 'hidden lg:block'
            }`}
          >
            {showFilters && (
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="absolute right-4 top-4 rounded-full p-2 hover:bg-surface-container-high lg:hidden"
                aria-label="Close filters"
              >
                <FiX className="h-5 w-5" />
              </button>
            )}

            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark">Category</h2>
                <select
                  value={searchState.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-dark focus:outline-none focus:border-pink-deep"
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark">Availability</h2>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-dark hover:bg-surface-container-low">
                  <input
                    type="checkbox"
                    checked={searchState.available}
                    onChange={(e) => updateFilter('available', e.target.checked)}
                    className="h-4 w-4 accent-pink-deep"
                  />
                  In stock only
                </label>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark">Flavor</h2>
                <input
                  list="search-flavors"
                  value={draft.flavor}
                  onChange={(e) => setDraft((prev) => ({ ...prev, flavor: e.target.value }))}
                  onBlur={() => pushParams(draft)}
                  placeholder="Flavor"
                  className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-dark placeholder:text-outline focus:outline-none focus:border-pink-deep"
                />
                <datalist id="search-flavors">
                  {COMMON_FLAVORS.map((flavor) => (
                    <option key={flavor} value={flavor} />
                  ))}
                </datalist>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark">Occasion</h2>
                <select
                  value={searchState.occasion}
                  onChange={(e) => updateFilter('occasion', e.target.value)}
                  className="w-full rounded-lg border border-outline-variant/30 bg-white px-3 py-2 text-sm text-dark focus:outline-none focus:border-pink-deep"
                >
                  <option value="">Any occasion</option>
                  {OCCASIONS.map((occasion) => (
                    <option key={occasion} value={occasion}>
                      {formatOccasion(occasion)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark">Delivery City</h2>
                <input
                  value={draft.city}
                  onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
                  onBlur={() => pushParams(draft)}
                  placeholder="City"
                  className="w-full rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-dark placeholder:text-outline focus:outline-none focus:border-pink-deep"
                />
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark">Price</h2>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={draft.minPrice}
                    onChange={(e) => setDraft((prev) => ({ ...prev, minPrice: e.target.value }))}
                    onBlur={() => pushParams(draft)}
                    placeholder="Min Rs."
                    className="min-w-0 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-dark placeholder:text-outline focus:outline-none focus:border-pink-deep"
                  />
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={draft.maxPrice}
                    onChange={(e) => setDraft((prev) => ({ ...prev, maxPrice: e.target.value }))}
                    onBlur={() => pushParams(draft)}
                    placeholder="Max Rs."
                    className="min-w-0 rounded-lg border border-outline-variant/30 px-3 py-2 text-sm text-dark placeholder:text-outline focus:outline-none focus:border-pink-deep"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={applyDraftFilters}
                className="w-full rounded-lg bg-pink-deep px-4 py-2.5 text-sm font-semibold text-white hover:bg-pink-deep/90 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </aside>

          <section className="min-w-0 flex-1">
            {loading ? (
              <ProductGridSkeleton count={12} />
            ) : !criteriaActive ? (
              <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest px-6 py-12 text-center">
                <FiSearch className="mx-auto mb-3 h-8 w-8 text-outline" />
                <h2 className="mb-1 text-lg font-semibold text-dark">Start your search</h2>
                <p className="text-sm text-outline">Use the search box or filters to find matching cakes.</p>
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest px-6 py-12 text-center">
                <FiSearch className="mx-auto mb-3 h-8 w-8 text-outline" />
                <h2 className="mb-1 text-lg font-semibold text-dark">No results found</h2>
                <p className="text-sm text-outline">Change the search terms or remove one filter.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
                  {products.map((product, index) => (
                    <ProductCard key={product._id} product={product} index={index} />
                  ))}
                </div>

                {pagination?.totalPages > 1 && (
                  <div className="mt-10 flex justify-center gap-2">
                    {Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => pushParams(searchState, String(page))}
                        className={`h-10 w-10 rounded-xl text-sm font-medium transition-all ${
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
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<AppShell><div className="max-w-7xl mx-auto px-4 py-8"><ProductGridSkeleton count={12} /></div></AppShell>}>
      <SearchContent />
    </Suspense>
  );
}
