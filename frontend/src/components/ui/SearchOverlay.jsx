'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiX, FiTrendingUp } from 'react-icons/fi';
import { closeSearch } from '@/store/slices/uiSlice';
import { debounce } from '@/lib/utils';
import api from '@/lib/api';

const POPULAR_SEARCHES = ['Chocolate', 'Birthday', 'Wedding', 'Eggless', 'Butterscotch', 'Red Velvet'];

export default function SearchOverlay() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isSearchOpen } = useSelector((s) => s.ui);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchProducts = useCallback(
    debounce(async (term) => {
      if (!term || term.length < 2) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await api.get(`/products/search?q=${encodeURIComponent(term)}&limit=6`);
        const d = res.data?.data;
        setResults(Array.isArray(d) ? d : (d?.items || d?.docs || []));
      } catch {
        setResults([]);
      }
      setIsSearching(false);
    }, 300),
    []
  );

  useEffect(() => {
    searchProducts(query);
  }, [query, searchProducts]);

  useEffect(() => {
    if (isSearchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setResults([]);
    }
  }, [isSearchOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      dispatch(closeSearch());
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handlePopularClick = (term) => {
    dispatch(closeSearch());
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => dispatch(closeSearch())}
        >
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: 'spring', damping: 25 }}
            className="bg-white w-full max-w-2xl mx-auto mt-20 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/20">
              <FiSearch className="w-5 h-5 text-outline shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for cakes, flavors, occasions..."
                className="flex-1 text-base text-dark placeholder:text-outline bg-transparent outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => dispatch(closeSearch())}
                className="p-1.5 rounded-full hover:bg-surface-container-high transition-colors"
              >
                <FiX className="w-5 h-5 text-outline" />
              </button>
            </form>

            {/* Content */}
            <div className="max-h-[400px] overflow-y-auto p-5">
              {query.length < 2 ? (
                <>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-outline mb-3 flex items-center gap-1.5">
                    <FiTrendingUp className="w-3.5 h-3.5" />
                    Popular Searches
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_SEARCHES.map((term) => (
                      <button
                        key={term}
                        onClick={() => handlePopularClick(term)}
                        className="px-3 py-1.5 text-sm bg-surface-container-low text-dark rounded-full hover:bg-pink-light/30 hover:text-pink-deep transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </>
              ) : isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-pink-deep border-t-transparent rounded-full animate-spin" />
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((product) => (
                    <button
                      key={product._id}
                      onClick={() => {
                        dispatch(closeSearch());
                        router.push(`/products/${product.slug}`);
                      }}
                      className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-surface-container-low transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-lg bg-surface-container shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-dark line-clamp-1">
                          {product.name}
                        </p>
                        <p className="text-xs text-outline">
                          {product.category?.name}
                        </p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={handleSubmit}
                    className="w-full text-center text-sm text-pink-deep font-medium py-2 hover:underline"
                  >
                    View all results for &ldquo;{query}&rdquo;
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-outline">No results found for &ldquo;{query}&rdquo;</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
