'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiShoppingBag, FiTrash2, FiStar, FiArrowLeft } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import { toggleWishlistItem } from '@/store/slices/wishlistSlice';
import { addToCart, openCartDrawer } from '@/store/slices/cartSlice';
import { addToast } from '@/store/slices/toastSlice';
import { formatPrice, getProductImage } from '@/lib/utils';

const PLACEHOLDER = '/images/placeholder-cake.svg';

export default function WishlistPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated, isSessionLoading } = useSelector((s) => s.auth);
  const { items, isLoading } = useSelector((s) => s.wishlist);

  // AppShell already fetches the wishlist when isAuthenticated becomes true,
  // so no duplicate fetch is needed here.

  const handleRemove = async (productId, productName) => {
    // toggleWishlistItem already returns the updated wishlist and updates state — no need for a separate fetchWishlist
    await dispatch(toggleWishlistItem(productId));
    dispatch(addToast({ message: `Removed "${productName}" from wishlist`, type: 'info' }));
  };

  const handleAddToCart = async (product) => {
    const basePrice = product.variants?.[0]?.price || product.basePrice;
    try {
      await dispatch(addToCart({
        product: product._id,
        variant: product.variants?.[0]?._id,
        quantity: 1,
      })).unwrap();
      dispatch(addToast({ message: `"${product.name}" added to cart! 🎂`, type: 'success' }));
      dispatch(openCartDrawer());
    } catch (err) {
      dispatch(addToast({ message: err || 'Failed to add to cart', type: 'error' }));
    }
  };

  // Still restoring session — render AppShell but show nothing inside
  if (isSessionLoading) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="w-10 h-10 border-3 border-pink-deep border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="text-4xl mb-4">❤️</div>
          <h2 className="text-2xl font-bold text-dark mb-2">Save your favorites</h2>
          <p className="text-outline mb-6">Please login to save and view your wishlisted items.</p>
          <Link href="/login" className="px-6 py-2 rounded-full gradient-primary text-white font-semibold shadow-md">
            Login
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-surface-container-low transition-colors text-outline hover:text-dark"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-dark flex items-center gap-3">
              <FiHeart className="w-7 h-7 text-pink-deep" />
              My Wishlist
            </h1>
            {items.length > 0 && (
              <p className="text-sm text-outline mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''} saved</p>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="aspect-square bg-surface-container-low animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-surface-container-low animate-pulse rounded" />
                  <div className="h-3 bg-surface-container-low animate-pulse rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-24 h-24 rounded-full bg-pink-light/20 flex items-center justify-center mx-auto mb-5">
              <FiHeart className="w-10 h-10 text-pink-deep/40" />
            </div>
            <h2 className="text-xl font-bold text-dark mb-2">Your wishlist is empty</h2>
            <p className="text-sm text-outline mb-6 max-w-xs mx-auto">
              Save your favourite cakes here and come back to order them anytime!
            </p>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full gradient-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <FiShoppingBag className="w-4 h-4" />
              Browse Cakes
            </Link>
          </motion.div>
        )}

        {/* Wishlist Grid */}
        {!isLoading && items.length > 0 && (
          <AnimatePresence>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {items.map((product, index) => {
                const productId = product._id;
                const name = product.name || 'Cake';
                const imageUrl = getProductImage(product);
                const basePrice = product.basePrice || 0;
                const slug = product.slug;
                const rating = product.averageRating;

                return (
                  <motion.div
                    key={productId}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-surface-container-lowest rounded-2xl overflow-hidden shadow-card card-hover"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-surface-container-low overflow-hidden">
                      <Link href={slug ? `/products/${slug}` : '#'}>
                        <Image
                          src={imageUrl}
                          alt={name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                          unoptimized={imageUrl.includes('placeholder')}
                        />
                      </Link>

                      {/* Remove button */}
                      <button
                        onClick={() => handleRemove(productId, name)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-error/10 hover:text-error transition-all shadow text-dark"
                        aria-label="Remove from wishlist"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Quick Add to Cart — hover */}
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark/80 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 backdrop-blur-sm whitespace-nowrap"
                      >
                        <FiShoppingBag className="w-3.5 h-3.5" />
                        Add to Cart
                      </button>
                    </div>

                    {/* Info */}
                    <div className="p-3 sm:p-4">
                      <Link href={slug ? `/products/${slug}` : '#'}>
                        <h3 className="text-sm font-semibold text-dark line-clamp-2 hover:text-pink-deep transition-colors mb-2">
                          {name}
                        </h3>
                      </Link>

                      {rating > 0 && (
                        <div className="flex items-center gap-1 mb-2">
                          <FiStar className="w-3.5 h-3.5 text-secondary fill-secondary" />
                          <span className="text-xs font-medium text-dark">{rating.toFixed(1)}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-bold text-pink-deep">
                          {formatPrice(basePrice)}
                        </span>

                        <button
                          onClick={() => handleAddToCart(product)}
                          className="p-2 rounded-xl bg-pink-light/20 text-pink-deep hover:bg-pink-deep hover:text-white transition-all"
                          title="Add to cart"
                        >
                          <FiShoppingBag className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </AppShell>
  );
}
