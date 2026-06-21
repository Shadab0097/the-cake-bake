'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiPackage, FiRefreshCw, FiXCircle, FiAlertTriangle,
} from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import OrderTrackingView, { isCancellable } from '@/components/order/OrderTrackingView';
import { addToast } from '@/store/slices/toastSlice';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError.mjs';

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-pulse space-y-6">
        <div className="h-5 bg-surface-container-high rounded w-32" />
        <div className="h-8 bg-surface-container-high rounded w-56" />
        <div className="bg-surface-container-lowest rounded-2xl p-6 space-y-4 shadow-card">
          <div className="h-4 bg-surface-container-high rounded w-40" />
          <div className="flex gap-3">
            {[1,2,3,4].map(i => <div key={i} className="flex-1 h-12 bg-surface-container-high rounded-xl" />)}
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl p-6 space-y-3 shadow-card">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-surface-container-high rounded-xl" />)}
        </div>
      </div>
    </AppShell>
  );
}

export default function OrderTrackingPage() {
  const { orderNumber } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { isAuthenticated, isSessionLoading } = useSelector((s) => s.auth);
  const trackingToken = searchParams.get('token') || '';
  const isGuestTracking = Boolean(trackingToken);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [error, setError] = useState('');

  const fetchOrder = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = isGuestTracking
        ? await api.get(`/guest-orders/${orderNumber}`, { params: { token: trackingToken } })
        : await api.get(`/orders/${orderNumber}`);
      setOrder(res.data?.data || null);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Order not found.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isGuestTracking, orderNumber, trackingToken]);

  useEffect(() => {
    if (isGuestTracking) {
      fetchOrder();
      return;
    }

    if (isSessionLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=/order-tracking/${orderNumber}`);
      return;
    }
    fetchOrder();
  }, [isGuestTracking, isSessionLoading, isAuthenticated, fetchOrder, orderNumber, router]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.put(`/orders/${orderNumber}/cancel`);
      dispatch(addToast({ message: 'Order cancelled successfully.', type: 'success' }));
      setShowCancelModal(false);
      await fetchOrder(true);
    } catch (err) {
      dispatch(addToast({ message: getApiErrorMessage(err, 'Failed to cancel order.'), type: 'error' }));
    } finally {
      setCancelling(false);
    }
  };

  if ((!isGuestTracking && isSessionLoading) || loading) return <Skeleton />;

  if (error || !order) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <FiPackage className="w-14 h-14 text-outline/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-dark mb-2">Order Not Found</h2>
          <p className="text-sm text-outline mb-6">{error || 'This order does not exist or belongs to another account.'}</p>
          <Link href={isGuestTracking ? '/products' : '/account'} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold">
            <FiArrowLeft className="w-4 h-4" /> {isGuestTracking ? 'Continue Shopping' : 'Back to My Orders'}
          </Link>
        </div>
      </AppShell>
    );
  }

  const topBar = (
    <div className="flex items-center justify-between mb-6">
      <Link
        href={isGuestTracking ? '/products' : '/account'}
        className="flex items-center gap-1.5 text-sm text-outline hover:text-pink-deep transition-colors"
      >
        <FiArrowLeft className="w-4 h-4" /> {isGuestTracking ? 'Continue Shopping' : 'My Orders'}
      </Link>
      <button
        onClick={() => fetchOrder(true)}
        disabled={refreshing}
        className="flex items-center gap-1.5 text-xs text-outline hover:text-pink-deep transition-colors disabled:opacity-50"
      >
        <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );

  return (
    <AppShell>
      <OrderTrackingView
        order={order}
        topBar={topBar}
        canCancel={!isGuestTracking && isCancellable(order.status)}
        onCancelClick={() => setShowCancelModal(true)}
      />

      {/* ── Cancel Confirmation Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => !cancelling && setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-container-lowest rounded-2xl p-6 shadow-float max-w-sm w-full border border-outline-variant/10"
            >
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <FiAlertTriangle className="w-7 h-7 text-error" />
              </div>
              <h3 className="text-lg font-bold text-dark text-center mb-2">Cancel Order?</h3>
              <p className="text-sm text-outline text-center mb-6 leading-relaxed">
                Are you sure you want to cancel order{' '}
                <span className="font-semibold text-dark font-mono">#{order.orderNumber}</span>?
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-dark text-sm font-medium hover:bg-surface-container-low transition-colors disabled:opacity-50"
                >
                  Keep Order
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 py-2.5 rounded-xl bg-error text-white text-sm font-semibold hover:bg-error/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {cancelling ? (
                    <><FiRefreshCw className="w-4 h-4 animate-spin" /> Cancelling…</>
                  ) : (
                    <><FiXCircle className="w-4 h-4" /> Yes, Cancel</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
