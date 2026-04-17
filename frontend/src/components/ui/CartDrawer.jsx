'use client';

import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { FiX, FiMinus, FiPlus, FiTrash2, FiShoppingBag } from 'react-icons/fi';
import {
  closeCartDrawer,
  updateCartItem, removeCartItem,
  updateGuestItem, removeGuestItem,
} from '@/store/slices/cartSlice';
import { formatPrice, getProductImage } from '@/lib/utils';

export default function CartDrawer() {
  const dispatch = useDispatch();
  const { isDrawerOpen, items, guestItems, cart } = useSelector((s) => s.cart);
  const { isAuthenticated } = useSelector((s) => s.auth);

  // Use correct cart source
  const cartItems = isAuthenticated ? items : guestItems;

  const subtotal = isAuthenticated
    ? cartItems.reduce((sum, item) => sum + (item.snapshotPrice || item.variant?.price || 0) * item.quantity, 0)
    : cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

  const handleQtyChange = (item, newQty) => {
    if (newQty < 1) return;
    if (isAuthenticated) {
      dispatch(updateCartItem({ itemId: item._id, data: { quantity: newQty } }));
    } else {
      dispatch(updateGuestItem({ localId: item.localId, quantity: newQty }));
    }
  };

  const handleRemove = (item) => {
    if (isAuthenticated) {
      dispatch(removeCartItem(item._id));
    } else {
      dispatch(removeGuestItem(item.localId));
    }
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(closeCartDrawer())}
            className="fixed inset-0 bg-black/40 z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-white z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <FiShoppingBag className="w-5 h-5 text-pink-deep" />
                <h2 className="text-lg font-semibold text-dark">
                  Your Cart
                  {cartItems.length > 0 && (
                    <span className="text-sm font-normal text-outline ml-1">
                      ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
                    </span>
                  )}
                </h2>
              </div>
              <button
                onClick={() => dispatch(closeCartDrawer())}
                className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mb-4">
                    <FiShoppingBag className="w-8 h-8 text-outline" />
                  </div>
                  <h3 className="text-lg font-semibold text-dark mb-1">Your cart is empty</h3>
                  <p className="text-sm text-outline mb-6">Add some delicious cakes to get started!</p>
                  <Link
                    href="/products"
                    onClick={() => dispatch(closeCartDrawer())}
                    className="px-6 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Browse Cakes
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => {
                    const itemKey = isAuthenticated ? item._id : item.localId;
                    const itemImage = isAuthenticated ? getProductImage(item.product) : (item.productImage || '/images/placeholder-cake.svg');
                    const itemName = isAuthenticated ? (item.snapshotName || item.product?.name) : item.productName;
                    const itemWeight = isAuthenticated ? item.variant?.weight : item.variantWeight;
                    const itemPrice = isAuthenticated ? (item.snapshotPrice || item.variant?.price || 0) : (item.price || 0);

                    return (
                      <motion.div
                        key={itemKey}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 100 }}
                        className="flex gap-3 p-3 bg-surface-container-low rounded-xl"
                      >
                        {/* Image */}
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-surface-container">
                          <Image
                            src={itemImage}
                            alt={itemName || 'Product'}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-dark line-clamp-1">{itemName}</h4>
                          <p className="text-xs text-outline mt-0.5">
                            {itemWeight}
                            {item.isEggless && ' • Eggless'}
                          </p>
                          {item.cakeMessage && (
                            <p className="text-[10px] text-outline mt-0.5 line-clamp-1">✉️ {item.cakeMessage}</p>
                          )}

                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-bold text-pink-deep">
                              {formatPrice(itemPrice * item.quantity)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleQtyChange(item, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                                className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-pink-light/40 disabled:opacity-40 transition-colors"
                              >
                                <FiMinus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => handleQtyChange(item, item.quantity + 1)}
                                className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-pink-light/40 transition-colors"
                              >
                                <FiPlus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Remove */}
                        <button
                          onClick={() => handleRemove(item)}
                          className="self-start p-1.5 rounded-full hover:bg-error/10 hover:text-error transition-colors text-outline"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="border-t border-outline-variant/20 px-5 py-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant">Subtotal</span>
                  <span className="text-lg font-bold text-dark">{formatPrice(subtotal)}</span>
                </div>
                <p className="text-xs text-outline">Shipping & taxes calculated at checkout</p>
                <Link
                  href="/checkout"
                  onClick={() => dispatch(closeCartDrawer())}
                  className="block w-full text-center py-3 rounded-full gradient-primary text-white font-semibold hover:opacity-90 transition-opacity"
                >
                  Proceed to Checkout
                </Link>
                <Link
                  href="/cart"
                  onClick={() => dispatch(closeCartDrawer())}
                  className="block w-full text-center py-2.5 rounded-full bg-surface-container-high text-dark text-sm font-medium hover:bg-surface-container transition-colors"
                >
                  View Full Cart
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
