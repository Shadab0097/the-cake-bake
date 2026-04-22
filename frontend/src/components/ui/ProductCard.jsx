'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiHeart, FiShoppingBag, FiStar } from 'react-icons/fi';
import { formatPrice, getProductImage } from '@/lib/utils';
import { toggleWishlistItem } from '@/store/slices/wishlistSlice';
import { addToCart, addGuestItem, openCartDrawer } from '@/store/slices/cartSlice';
import { addToast } from '@/store/slices/toastSlice';

export default function ProductCard({ product, index = 0 }) {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const wishlistItems = useSelector((s) => s.wishlist.items);

  const isWishlisted = wishlistItems.some(
    (item) => item._id === product._id
  );

  const imageUrl = getProductImage(product);
  const hasDiscount = product.variants?.[0]?.compareAtPrice > 0;
  const basePrice = product.variants?.[0]?.price || product.basePrice;
  const comparePrice = product.variants?.[0]?.compareAtPrice;

  const handleWishlistToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      dispatch(addToast({
        message: 'Sign in to save to wishlist',
        type: 'info',
        link: '/login',
        linkLabel: 'Sign in',
      }));
      return;
    }
    await dispatch(toggleWishlistItem(product._id));
    dispatch(addToast({
      message: isWishlisted ? 'Removed from wishlist' : 'Added to wishlist ♡',
      type: 'success',
    }));
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isAuthenticated) {
      // Add via API for logged-in users
      try {
        await dispatch(addToCart({
          product: product._id,
          variant: product.variants?.[0]?._id,
          quantity: 1,
        })).unwrap();
        dispatch(addToast({ message: 'Added to cart! 🎂', type: 'success' }));
        dispatch(openCartDrawer());
      } catch (err) {
        dispatch(addToast({ message: err || 'Failed to add to cart', type: 'error' }));
      }
    } else {
      // Add to local guest cart
      dispatch(addGuestItem({
        product: product._id,
        productName: product.name,
        productSlug: product.slug,
        productImage: imageUrl,
        variant: product.variants?.[0]?._id || null,
        variantWeight: product.variants?.[0]?.weight || null,
        price: basePrice,
        quantity: 1,
        isEggless: false,
        cakeMessage: '',
      }));
      dispatch(addToast({ message: 'Added to cart! 🎂', type: 'success' }));
      dispatch(openCartDrawer());
    }
  };

  // Badges
  const badges = [];
  if (product.tags?.includes('bestseller')) badges.push({ label: 'Bestseller', color: 'bg-secondary text-white' });
  if (product.tags?.includes('trending')) badges.push({ label: 'Trending', color: 'bg-pink-deep text-white' });
  if (product.tags?.includes('new')) badges.push({ label: 'New', color: 'bg-success text-white' });
  if (product.isEggless) badges.push({ label: 'Eggless', color: 'bg-success/10 text-success' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="group"
    >
      <Link href={`/products/${product.slug}`} className="block">
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden card-hover shadow-card">
          {/* Image */}
          <div className="relative aspect-square bg-surface-container-low overflow-hidden">
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={(e) => { e.currentTarget.src = '/images/placeholder-cake.svg'; }}
              unoptimized={imageUrl.includes('placeholder')}
            />

            {/* Badges */}
            {badges.length > 0 && (
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {badges.map((badge) => (
                  <span
                    key={badge.label}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {/* Wishlist */}
            <button
              onClick={handleWishlistToggle}
              className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isWishlisted
                  ? 'bg-pink-deep text-white'
                  : 'bg-white/80 text-dark hover:bg-pink-light'
              }`}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <FiHeart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>

            {/* Quick Add — appears on hover */}
            <button
              onClick={handleQuickAdd}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark/80 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 backdrop-blur-sm whitespace-nowrap"
            >
              <FiShoppingBag className="w-3.5 h-3.5" />
              Quick Add
            </button>

            {/* Discount badge */}
            {hasDiscount && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-pink-deep text-white text-[10px] font-bold rounded-full">
                {Math.round(((comparePrice - basePrice) / comparePrice) * 100)}% OFF
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3 sm:p-4">
            {product.category && (
              <p className="text-[10px] uppercase tracking-wider text-outline mb-1 font-medium">
                {product.category?.name || product.category}
              </p>
            )}

            <h3 className="text-sm font-semibold text-dark line-clamp-2 mb-1.5 group-hover:text-pink-deep transition-colors">
              {product.name}
            </h3>

            {product.averageRating > 0 && (
              <div className="flex items-center gap-1 mb-2">
                <FiStar className="w-3.5 h-3.5 text-secondary fill-secondary" />
                <span className="text-xs font-medium text-dark">
                  {product.averageRating.toFixed(1)}
                </span>
                {product.reviewCount > 0 && (
                  <span className="text-xs text-outline">({product.reviewCount})</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-pink-deep">
                {formatPrice(basePrice)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-outline line-through">
                  {formatPrice(comparePrice)}
                </span>
              )}
            </div>

            {product.minWeight && (
              <p className="text-[10px] text-outline mt-1">Starting from {product.minWeight}</p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
