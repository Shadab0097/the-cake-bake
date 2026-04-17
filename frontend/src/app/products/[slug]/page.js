'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FiHeart, FiShoppingBag, FiStar, FiMinus, FiPlus, FiShare2, FiCheck } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import ProductCard from '@/components/ui/ProductCard';
import { formatPrice, getProductImage, getStarDisplay } from '@/lib/utils';
import { addToCart, openCartDrawer } from '@/store/slices/cartSlice';
import { toggleWishlistItem } from '@/store/slices/wishlistSlice';
import { addToast } from '@/store/slices/toastSlice';
import api from '@/lib/api';

export default function ProductDetailPage() {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const wishlistItems = useSelector((s) => s.wishlist.items);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isEggless, setIsEggless] = useState(false);
  const [cakeMessage, setCakeMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [adding, setAdding] = useState(false);

  const isWishlisted = product && wishlistItems.some(
    (item) => item._id === product._id
  );

  // Fetch product
  useEffect(() => {
    setLoading(true);
    api.get(`/products/${slug}`)
      .then((res) => {
        const p = res.data?.data;
        setProduct(p);
        // Fetch related
        if (p?.category?._id) {
          api.get(`/products?category=${p.category._id}&limit=5`)
            .then((r) => {
              const d = r.data?.data;
              const list = Array.isArray(d) ? d : (d?.items || d?.docs || []);
              setRelatedProducts(list.filter((item) => item._id !== p._id));
            })
            .catch(() => {});
        }
        // Fetch reviews
        api.get(`/reviews?product=${p?._id}&limit=5`)
          .then((r) => {
            const d = r.data?.data;
            setReviews(Array.isArray(d) ? d : (d?.items || d?.docs || []));
          })
          .catch(() => {});
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      dispatch(addToast({ message: 'Please login to add items to cart', type: 'info' }));
      return;
    }
    setAdding(true);
    try {
      await dispatch(addToCart({
        product: product._id,
        variant: product.variants?.[selectedVariant]?._id,
        quantity,
        isEggless,
        cakeMessage: cakeMessage.trim() || undefined,
      })).unwrap();
      dispatch(addToast({ message: 'Added to cart! 🎂', type: 'success' }));
      dispatch(openCartDrawer());
    } catch (err) {
      dispatch(addToast({ message: err || 'Failed to add to cart', type: 'error' }));
    }
    setAdding(false);
  };

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      dispatch(addToast({ message: 'Please login to use wishlist', type: 'info' }));
      return;
    }
    await dispatch(toggleWishlistItem(product._id));
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="aspect-square bg-surface-container rounded-2xl animate-pulse" />
            <div className="space-y-4">
              <div className="h-6 bg-surface-container rounded w-32 animate-pulse" />
              <div className="h-8 bg-surface-container rounded w-3/4 animate-pulse" />
              <div className="h-10 bg-surface-container rounded w-40 animate-pulse" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell>
        <div className="text-center py-24">
          <span className="text-6xl block mb-4">😕</span>
          <h1 className="text-2xl font-bold text-dark">Product Not Found</h1>
        </div>
      </AppShell>
    );
  }

  const variant = product.variants?.[selectedVariant];
  const price = variant?.price || product.basePrice;
  const comparePrice = variant?.compareAtPrice;
  const hasDiscount = comparePrice > 0 && comparePrice > price;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Images */}
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative aspect-square bg-surface-container-low rounded-2xl overflow-hidden mb-3"
            >
              <Image
                src={getProductImage(product, selectedImage)}
                alt={product.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              {hasDiscount && (
                <div className="absolute top-4 left-4 px-3 py-1 bg-pink-deep text-white text-sm font-bold rounded-full">
                  {Math.round(((comparePrice - price) / comparePrice) * 100)}% OFF
                </div>
              )}
            </motion.div>

            {/* Thumbnails */}
            {product.images?.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === selectedImage ? 'border-pink-deep' : 'border-transparent'
                    }`}
                  >
                    <Image
                      src={img.url?.startsWith('/') ? `http://localhost:5000${img.url}` : (img.url || '/images/placeholder-cake.svg')}
                      alt={`${product.name} view ${i + 1}`}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {/* Category + Share */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-widest text-outline font-medium">
                {product.category?.name}
              </span>
              <button
                onClick={() => navigator.share?.({ title: product.name, url: window.location.href })}
                className="p-2 rounded-full hover:bg-surface-container-low transition-colors"
              >
                <FiShare2 className="w-4 h-4 text-outline" />
              </button>
            </div>

            {/* Name */}
            <h1 className="text-2xl lg:text-3xl font-bold text-dark mb-3">
              {product.name}
            </h1>

            {/* Rating */}
            {product.averageRating > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FiStar
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.round(product.averageRating)
                          ? 'text-secondary fill-secondary'
                          : 'text-outline-variant'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-dark">
                  {product.averageRating.toFixed(1)}
                </span>
                <span className="text-sm text-outline">
                  ({product.reviewCount} reviews)
                </span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-3xl font-bold text-pink-deep">
                {formatPrice(price)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-lg text-outline line-through">
                    {formatPrice(comparePrice)}
                  </span>
                  <span className="text-sm font-semibold text-success bg-success-light px-2 py-0.5 rounded-full">
                    Save {formatPrice(comparePrice - price)}
                  </span>
                </>
              )}
            </div>

            {/* Short Description */}
            {product.shortDescription && (
              <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                {product.shortDescription}
              </p>
            )}

            {/* Variant Selector (Weight) */}
            {product.variants?.length > 0 && (
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-dark mb-2">Select Weight</h4>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v, i) => (
                    <button
                      key={v._id || i}
                      onClick={() => setSelectedVariant(i)}
                      className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all ${
                        i === selectedVariant
                          ? 'border-pink-deep bg-pink-deep text-white'
                          : 'border-outline-variant/30 text-dark hover:border-pink-deep'
                      }`}
                    >
                      {v.weight} — {formatPrice(v.price)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Eggless Toggle */}
            {product.isEggless !== undefined && (
              <div className="mb-5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEggless}
                    onChange={(e) => setIsEggless(e.target.checked)}
                    className="w-4 h-4 accent-pink-deep"
                  />
                  <span className="font-medium text-dark">Make it Eggless</span>
                  <span className="text-outline">(+₹50)</span>
                </label>
              </div>
            )}

            {/* Cake Message */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-dark mb-2 block">
                Message on Cake <span className="text-outline font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={cakeMessage}
                onChange={(e) => setCakeMessage(e.target.value)}
                maxLength={50}
                placeholder="e.g. Happy Birthday Priya!"
                className="w-full px-4 py-2.5 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline bg-surface-container-lowest"
              />
              <p className="text-xs text-outline mt-1">{cakeMessage.length}/50 characters</p>
            </div>

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 border border-outline-variant/30 rounded-xl px-2 py-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-low transition-colors"
                >
                  <FiMinus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-semibold text-dark">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-low transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={adding}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {adding ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <FiShoppingBag className="w-5 h-5" />
                    Add to Cart
                  </>
                )}
              </button>

              <button
                onClick={handleWishlistToggle}
                className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
                  isWishlisted
                    ? 'bg-pink-deep border-pink-deep text-white'
                    : 'border-outline-variant/30 text-dark hover:border-pink-deep'
                }`}
              >
                <FiHeart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-3 border-t border-outline-variant/20 pt-6">
              {[
                { icon: '🚀', label: 'Free Delivery', sub: 'On orders above ₹499' },
                { icon: '🎂', label: 'Freshly Baked', sub: 'Made to order' },
                { icon: '🔒', label: 'Secure Payment', sub: '100% safe checkout' },
                { icon: '💬', label: 'Custom Message', sub: 'Personalize your cake' },
              ].map((feat) => (
                <div key={feat.label} className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-container-low">
                  <span className="text-lg">{feat.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-dark">{feat.label}</p>
                    <p className="text-[10px] text-outline">{feat.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="mt-12 max-w-4xl">
            <h2 className="text-xl font-bold text-dark mb-4">About This Cake</h2>
            <div className="prose prose-sm text-on-surface-variant">
              <p className="leading-relaxed">{product.description}</p>
            </div>
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-dark mb-6">Customer Reviews</h2>
            <div className="space-y-4 max-w-2xl">
              {reviews.map((review) => (
                <div key={review._id} className="p-4 bg-surface-container-lowest rounded-xl shadow-card">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <FiStar
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < review.rating ? 'text-secondary fill-secondary' : 'text-outline-variant'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-dark">{review.user?.name}</span>
                  </div>
                  {review.title && <p className="text-sm font-medium text-dark mb-1">{review.title}</p>}
                  <p className="text-sm text-on-surface-variant">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-bold text-dark mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {relatedProducts.slice(0, 4).map((p, i) => (
                <ProductCard key={p._id} product={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
