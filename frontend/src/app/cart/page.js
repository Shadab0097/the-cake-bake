'use client';

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMinus, FiPlus, FiTrash2, FiShoppingBag, FiTag, FiUser, FiArrowRight } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import AddOnModal from '@/components/ui/AddOnModal';
import {
  fetchCart, updateCartItem, removeCartItem, applyCoupon, removeCoupon,
  updateGuestItem, removeGuestItem,
} from '@/store/slices/cartSlice';
import { addToast } from '@/store/slices/toastSlice';
import { formatPrice, getProductImage } from '@/lib/utils';

export default function CartPage() {
  const dispatch = useDispatch();
  const { items, guestItems, cart, isLoading } = useSelector((s) => s.cart);
  const { isAuthenticated } = useSelector((s) => s.auth);
  const [couponCode, setCouponCode] = useState('');
  const [showAddOnModal, setShowAddOnModal] = useState(false);

  // Fetch server cart if authenticated
  useEffect(() => {
    if (isAuthenticated) dispatch(fetchCart());
  }, [isAuthenticated, dispatch]);

  // Use guest items when not authenticated
  const cartItems = isAuthenticated ? items : guestItems;

  // Totals
  const subtotal = isAuthenticated
    ? cartItems.reduce((sum, item) => sum + (item.snapshotPrice || item.variant?.price || 0) * item.quantity, 0)
    : cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const discount = cart?.discount || 0;
  const total = subtotal - discount;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (!isAuthenticated) {
      dispatch(addToast({ message: 'Login to apply coupons at checkout', type: 'info' }));
      return;
    }
    try {
      await dispatch(applyCoupon(couponCode.trim())).unwrap();
      dispatch(addToast({ message: 'Coupon applied! 🎉', type: 'success' }));
      setCouponCode('');
    } catch (err) {
      dispatch(addToast({ message: err || 'Invalid coupon', type: 'error' }));
    }
  };

  const handleQuantityChange = (item, newQty) => {
    if (isAuthenticated) {
      dispatch(updateCartItem({ itemId: item._id, data: { quantity: Math.max(1, newQty) } }));
    } else {
      dispatch(updateGuestItem({ localId: item.localId, quantity: Math.max(1, newQty) }));
    }
  };

  const handleRemove = (item) => {
    if (isAuthenticated) {
      dispatch(removeCartItem(item._id));
    } else {
      dispatch(removeGuestItem(item.localId));
    }
  };

  // Empty cart state
  if (cartItems.length === 0) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="w-24 h-24 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
            <FiShoppingBag className="w-10 h-10 text-outline" />
          </div>
          <h1 className="text-2xl font-bold text-dark mb-2">Your Cart is Empty</h1>
          <p className="text-sm text-outline mb-6">Add some delicious cakes and come back!</p>
          <Link href="/products" className="inline-flex px-6 py-2.5 rounded-full gradient-primary text-white font-semibold text-sm">
            Browse Cakes
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-dark mb-8">
          Shopping Cart
          <span className="ml-2 text-base font-normal text-outline">({cartItems.length} item{cartItems.length !== 1 ? 's' : ''})</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items List */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {cartItems.map((item) => {
                const itemImage = isAuthenticated ? getProductImage(item.product) : (item.productImage || '/images/placeholder-cake.svg');
                const itemName = isAuthenticated ? (item.snapshotName || item.product?.name) : item.productName;
                const itemPrice = isAuthenticated ? (item.snapshotPrice || item.variant?.price || 0) : (item.price || 0);
                const itemWeight = isAuthenticated ? item.variant?.weight : item.variantWeight;
                const itemId = isAuthenticated ? item._id : item.localId;

                return (
                  <motion.div
                    key={itemId}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex gap-4 p-4 bg-surface-container-lowest rounded-2xl shadow-card"
                  >
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-surface-container">
                      <Image
                        src={itemImage}
                        alt={itemName || 'Product'}
                        fill
                        className="object-cover"
                        sizes="112px"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/products/${isAuthenticated ? (item.product?.slug || '#') : (item.productSlug || '#')}`}
                        className="hover:text-pink-deep transition-colors"
                      >
                        <h3 className="text-sm sm:text-base font-semibold text-dark line-clamp-1">{itemName}</h3>
                      </Link>
                      <p className="text-xs text-outline mt-1">
                        {itemWeight}
                        {item.isEggless && ' • Eggless'}
                      </p>
                      {item.cakeMessage && (
                        <p className="text-xs text-outline mt-0.5">✉️ {item.cakeMessage}</p>
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 border border-outline-variant/30 rounded-lg px-1.5 py-0.5">
                          <button
                            onClick={() => handleQuantityChange(item, item.quantity - 1)}
                            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container-high transition-colors"
                          >
                            <FiMinus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                          <button
                            onClick={() => handleQuantityChange(item, item.quantity + 1)}
                            className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-container-high transition-colors"
                          >
                            <FiPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className="text-base font-bold text-pink-deep">
                          {formatPrice(itemPrice * item.quantity)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(item)}
                      className="self-start p-2 rounded-full hover:bg-error/10 hover:text-error transition-colors text-outline"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card sticky top-24">
              <h3 className="text-lg font-bold text-dark mb-4">Order Summary</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Subtotal</span>
                  <span className="text-dark font-medium">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Discount</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Delivery</span>
                  <span className="text-success font-medium">{subtotal >= 49900 ? 'Free' : formatPrice(4900)}</span>
                </div>
                <div className="border-t border-outline-variant/20 pt-3 flex justify-between">
                  <span className="font-semibold text-dark">Total</span>
                  <span className="text-xl font-bold text-pink-deep">
                    {formatPrice(subtotal >= 49900 ? total : total + 4900)}
                  </span>
                </div>
              </div>

              {/* Coupon — only for logged-in users */}
              {isAuthenticated && (
                <div className="mt-5">
                  {cart?.coupon ? (
                    <div className="flex items-center justify-between p-3 bg-success/10 rounded-xl">
                      <div className="flex items-center gap-2">
                        <FiTag className="w-4 h-4 text-success" />
                        <span className="text-sm font-medium text-success">{cart.coupon.code}</span>
                      </div>
                      <button
                        onClick={() => dispatch(removeCoupon())}
                        className="text-xs text-error hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Coupon code"
                        className="flex-1 px-3 py-2 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-surface-container-lowest placeholder:text-outline"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        className="px-4 py-2 text-sm font-semibold text-pink-deep border border-pink-deep rounded-xl hover:bg-pink-light/20 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Proceed to Checkout */}
              <button
                onClick={() => setShowAddOnModal(true)}
                className="flex items-center justify-center gap-2 w-full mt-5 py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Proceed to Checkout
                <FiArrowRight className="w-4 h-4" />
              </button>

              {/* Guest prompt — soft nudge */}
              {!isAuthenticated && (
                <p className="text-xs text-center text-outline mt-3">
                  <Link href="/login?next=/checkout" className="text-pink-deep font-medium hover:underline">
                    Login
                  </Link>
                  {' '}to save your cart & earn rewards, or{' '}
                  <span className="text-dark font-medium">checkout as guest</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add-on Modal */}
      <AddOnModal isOpen={showAddOnModal} onClose={() => setShowAddOnModal(false)} />
    </AppShell>
  );
}
