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
  if (product.tags?.includes('bestseller')) badges.push({ label: 'Bestseller', color: 'bg-gradient-to-r from-secondary to-secondary-container text-white shadow-sm' });
  if (product.tags?.includes('trending')) badges.push({ label: 'Trending', color: 'bg-gradient-to-r from-pink-deep to-pink text-white shadow-sm' });
  if (product.tags?.includes('new')) badges.push({ label: 'New', color: 'bg-dark text-white shadow-sm' });
  if (product.isEggless) badges.push({ label: 'Eggless', color: 'bg-success/10 text-success border border-success/20' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: (index % 4) * 0.1, duration: 0.5, ease: "easeOut" }}
      className="group h-full"
    >
      <Link href={`/products/${product.slug}`} className="block h-full">
        <div className="bg-white rounded-[20px] overflow-hidden shadow-ambient hover:shadow-float transition-all duration-500 border border-surface-dim/30 flex flex-col h-full group-hover:-translate-y-1">
          {/* Image Container */}
          <div className="relative aspect-square bg-surface-container-low overflow-hidden">
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onError={(e) => { e.currentTarget.src = '/images/placeholder-cake.svg'; }}
              unoptimized={imageUrl.includes('placeholder')}
            />

            {/* Subtle Overlay on Hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-dark/60 via-dark/0 to-dark/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Badges */}
            {badges.length > 0 && (
              <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                {badges.map((badge) => (
                  <span
                    key={badge.label}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full backdrop-blur-sm ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {/* Wishlist */}
            <button
              onClick={handleWishlistToggle}
              className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 z-10 shadow-sm backdrop-blur-md ${isWishlisted
                  ? 'bg-pink-deep text-white hover:bg-pink-deep/90'
                  : 'bg-white/90 text-dark hover:bg-white hover:text-pink-deep hover:scale-110'
                }`}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <FiHeart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
            </button>

            {/* Quick Add Button */}
            <div className="absolute bottom-4 left-0 w-full px-4 flex justify-center z-10 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <button
                onClick={handleQuickAdd}
                className="w-full sm:w-[85%] flex items-center justify-center gap-2 py-2.5 rounded-full bg-white/95 text-dark font-bold text-xs sm:text-sm shadow-float hover:bg-dark hover:text-white transition-colors duration-300 backdrop-blur-md"
              >
                <FiShoppingBag className="w-4 h-4" />
                <span>Quick Add</span>
              </button>
            </div>

            {/* Discount badge */}
            {hasDiscount && (
              <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-error text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm z-10">
                {Math.round(((comparePrice - basePrice) / comparePrice) * 100)}% OFF
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="p-4 sm:p-5 flex flex-col flex-grow bg-white z-20 relative">
            {product.category && (
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-outline mb-1.5 font-semibold">
                {product.category?.name || product.category}
              </p>
            )}

            <h3 className="text-sm sm:text-base font-bold text-dark line-clamp-2 mb-2 group-hover:text-pink-deep transition-colors duration-300">
              {product.name}
            </h3>

            {/* Ratings & Weight info wrapper */}
            <div className="flex items-center justify-between mt-auto pt-2 mb-3">
              {product.averageRating > 0 ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-secondary/10 px-1.5 py-0.5 rounded text-secondary">
                    <FiStar className="w-3 h-3 fill-current" />
                    <span className="text-xs font-bold ml-1">
                      {product.averageRating.toFixed(1)}
                    </span>
                  </div>
                  {product.reviewCount > 0 && (
                    <span className="text-xs text-outline font-medium">({product.reviewCount})</span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-outline/60 italic">No reviews yet</div>
              )}

              {product.minWeight && (
                <span className="text-[10px] sm:text-xs font-medium text-outline bg-surface-container px-2 py-1 rounded-full">
                  {product.minWeight}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-end gap-2 mt-1">
              <span className="text-base sm:text-lg font-bold text-pink-deep">
                {formatPrice(basePrice)}
              </span>
              {hasDiscount && (
                <span className="text-xs sm:text-sm text-outline line-through mb-0.5 font-medium">
                  {formatPrice(comparePrice)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
