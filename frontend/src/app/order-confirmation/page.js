'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { FiCheckCircle, FiPackage } from 'react-icons/fi';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <FiCheckCircle className="w-10 h-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-dark mb-2">Order Placed! 🎉</h1>
        <p className="text-sm text-outline mb-6">
          Your delicious cake is being prepared with love. We&apos;ll notify you when it&apos;s on its way!
        </p>

        {orderId && (
          <p className="text-xs text-outline mb-6 bg-surface-container-low rounded-lg p-3">
            Order ID: <span className="font-mono font-semibold text-dark">{orderId}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/account" className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full gradient-primary text-white font-semibold text-sm">
            <FiPackage className="w-4 h-4" />
            Track Order
          </Link>
          <Link href="/products" className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-outline-variant/30 text-dark font-medium text-sm hover:bg-surface-container-low transition-colors">
            Continue Shopping
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-pink-deep border-t-transparent rounded-full animate-spin" /></div>}>
      <OrderConfirmationContent />
    </Suspense>
  );
}
