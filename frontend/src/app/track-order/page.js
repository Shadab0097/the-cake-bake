'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  FiPackage, FiSearch, FiMail, FiHash, FiArrowLeft, FiRefreshCw, FiUser, FiAlertCircle,
} from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import OrderTrackingView from '@/components/order/OrderTrackingView';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError.mjs';

export default function TrackOrderPage() {
  const { isAuthenticated } = useSelector((s) => s.auth);

  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookup = async (e) => {
    if (e) e.preventDefault();
    const trimmedOrder = orderNumber.trim().replace(/^#/, '');
    const trimmedEmail = email.trim();
    if (!trimmedOrder || !trimmedEmail) {
      setError('Please enter both your order number and email.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/guest-orders/lookup', {
        orderNumber: trimmedOrder,
        email: trimmedEmail,
      });
      setOrder(res.data?.data || null);
    } catch (err) {
      setOrder(null);
      setError(getApiErrorMessage(
        err,
        'We couldn\'t find an order matching those details. Please check and try again.',
      ));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setOrder(null);
    setError('');
  };

  // ── Results view ────────────────────────────────────────────────────────────
  if (order) {
    const topBar = (
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm text-outline hover:text-pink-deep transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" /> Track another order
        </button>
        <button
          onClick={() => lookup()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-outline hover:text-pink-deep transition-colors disabled:opacity-50"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    );

    return (
      <AppShell>
        <OrderTrackingView order={order} topBar={topBar} />
      </AppShell>
    );
  }

  // ── Lookup form ───────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-4">
            <FiPackage className="w-8 h-8 text-pink-deep" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-dark mb-2">Track Your Order</h1>
          <p className="text-sm text-outline leading-relaxed">
            Enter your order number and the email you used at checkout to see your order status.
          </p>
        </motion.div>

        {/* Logged-in convenience banner */}
        {isAuthenticated && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
            <FiUser className="w-5 h-5 text-pink-deep shrink-0 mt-0.5" />
            <p className="text-sm text-dark">
              You&apos;re signed in.{' '}
              <Link href="/account" className="text-pink-deep font-semibold hover:underline">
                View all your orders
              </Link>{' '}
              in your account — or look up a guest order below.
            </p>
          </div>
        )}

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          onSubmit={lookup}
          className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-card border border-outline-variant/10 space-y-4"
        >
          {/* Order number */}
          <div>
            <label htmlFor="track-order-number" className="block text-xs font-medium text-outline mb-1.5">
              Order Number
            </label>
            <div className="relative">
              <FiHash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                id="track-order-number"
                type="text"
                inputMode="text"
                autoComplete="off"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. TCB-1A2B3C"
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/20 text-sm text-dark placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-pink-deep/40 focus:border-pink-deep/40"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="track-email" className="block text-xs font-medium text-outline mb-1.5">
              Email
            </label>
            <div className="relative">
              <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                id="track-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-surface-container-low border border-outline-variant/20 text-sm text-dark placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-pink-deep/40 focus:border-pink-deep/40"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-error/5 border border-error/20 p-3">
              <FiAlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full gradient-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><FiRefreshCw className="w-4 h-4 animate-spin" /> Looking up…</>
            ) : (
              <><FiSearch className="w-4 h-4" /> Track Order</>
            )}
          </button>
        </motion.form>

        <p className="text-xs text-outline text-center mt-6 leading-relaxed">
          Your order number is in your confirmation email.{' '}
          Need help?{' '}
          <Link href="/contact" className="text-pink-deep hover:underline font-medium">
            Contact Support
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
