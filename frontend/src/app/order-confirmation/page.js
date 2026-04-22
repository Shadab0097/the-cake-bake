'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { FiCheckCircle, FiPackage, FiShoppingBag } from 'react-icons/fi';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  // Accept both orderId (legacy) and orderNumber (preferred)
  const orderNumber = searchParams.get('orderNumber');
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md w-full"
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6"
        >
          <FiCheckCircle className="w-12 h-12 text-success" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h1 className="text-2xl sm:text-3xl font-bold text-dark mb-2">Order Placed! 🎉</h1>
          <p className="text-sm text-outline mb-6 leading-relaxed">
            Your delicious cake is being prepared with love.&nbsp;
            We&apos;ll notify you when it&apos;s on its way!
          </p>
        </motion.div>

        {/* Order reference */}
        {(orderNumber || orderId) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-surface-container-low rounded-xl p-4 mb-6 text-sm"
          >
            <p className="text-outline text-xs mb-1">
              {orderNumber ? 'Order Number' : 'Order Reference'}
            </p>
            <p className="font-mono font-bold text-dark text-base">
              {orderNumber ? `#${orderNumber}` : orderId}
            </p>
          </motion.div>
        )}

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          {orderNumber ? (
            <Link
              href={`/order-tracking/${orderNumber}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full gradient-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <FiPackage className="w-4 h-4" />
              Track My Order
            </Link>
          ) : (
            <Link
              href="/account"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full gradient-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <FiPackage className="w-4 h-4" />
              My Orders
            </Link>
          )}
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-outline-variant/30 text-dark font-medium text-sm hover:bg-surface-container-low transition-colors"
          >
            <FiShoppingBag className="w-4 h-4" />
            Continue Shopping
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-pink-deep border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrderConfirmationContent />
    </Suspense>
  );
}
