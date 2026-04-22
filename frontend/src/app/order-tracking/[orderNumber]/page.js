'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiPackage, FiCheckCircle, FiClock, FiTruck,
  FiXCircle, FiRefreshCw, FiMapPin, FiCalendar, FiPhone,
  FiCreditCard, FiAlertTriangle, FiUser,
} from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import { addToast } from '@/store/slices/toastSlice';
import { formatPrice, formatDate } from '@/lib/utils';
import api from '@/lib/api';

// ── Status pipeline (matches backend ORDER_STATUSES) ─────────────────────────
const STATUS_STEPS = [
  { key: 'pending',          label: 'Order Placed',      icon: FiClock,        desc: 'Your order has been received.' },
  { key: 'confirmed',        label: 'Confirmed',          icon: FiCheckCircle,  desc: 'We confirmed your order.' },
  { key: 'preparing',        label: 'Preparing',          icon: FiRefreshCw,    desc: 'Our bakers are making your cake.' },
  { key: 'packed',           label: 'Packed',             icon: FiPackage,      desc: 'Your order has been packed.' },
  { key: 'dispatched',       label: 'Dispatched',         icon: FiTruck,        desc: 'Your order is on the way.' },
  { key: 'out_for_delivery', label: 'Out for Delivery',   icon: FiTruck,        desc: 'Delivery partner is nearby!' },
  { key: 'delivered',        label: 'Delivered',          icon: FiCheckCircle,  desc: 'Enjoy your delicious cake! 🎂' },
];

const CANCELLED_STEP = { key: 'cancelled', label: 'Cancelled', icon: FiXCircle, desc: 'This order was cancelled.' };
const REFUNDED_STEP  = { key: 'refunded',  label: 'Refunded',  icon: FiRefreshCw, desc: 'Refund has been initiated.' };

const STATUS_COLOR = {
  pending:          { bg: 'bg-amber-100',  ring: 'ring-amber-300',  text: 'text-amber-700',  bar: 'bg-amber-400' },
  confirmed:        { bg: 'bg-blue-100',   ring: 'ring-blue-300',   text: 'text-blue-700',   bar: 'bg-blue-500' },
  preparing:        { bg: 'bg-purple-100', ring: 'ring-purple-300', text: 'text-purple-700', bar: 'bg-purple-500' },
  packed:           { bg: 'bg-indigo-100', ring: 'ring-indigo-300', text: 'text-indigo-700', bar: 'bg-indigo-500' },
  dispatched:       { bg: 'bg-cyan-100',   ring: 'ring-cyan-300',   text: 'text-cyan-700',   bar: 'bg-cyan-500' },
  out_for_delivery: { bg: 'bg-pink-100',   ring: 'ring-pink-300',   text: 'text-pink-700',   bar: 'bg-pink-500' },
  delivered:        { bg: 'bg-green-100',  ring: 'ring-green-300',  text: 'text-green-700',  bar: 'bg-green-500' },
  cancelled:        { bg: 'bg-red-100',    ring: 'ring-red-300',    text: 'text-red-700',    bar: 'bg-red-400' },
  refunded:         { bg: 'bg-gray-100',   ring: 'ring-gray-300',   text: 'text-gray-600',   bar: 'bg-gray-400' },
};

function getStepIndex(status) {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function isCancellable(status) {
  return status === 'pending' || status === 'confirmed';
}

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
  const dispatch = useDispatch();
  const { isAuthenticated, isSessionLoading } = useSelector((s) => s.auth);

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
      const res = await api.get(`/orders/${orderNumber}`);
      setOrder(res.data?.data || null);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Order not found.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (isSessionLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=/order-tracking/${orderNumber}`);
      return;
    }
    fetchOrder();
  }, [isSessionLoading, isAuthenticated, fetchOrder, orderNumber, router]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.put(`/orders/${orderNumber}/cancel`);
      dispatch(addToast({ message: 'Order cancelled successfully.', type: 'success' }));
      setShowCancelModal(false);
      await fetchOrder(true);
    } catch (err) {
      dispatch(addToast({ message: err?.response?.data?.message || 'Failed to cancel order.', type: 'error' }));
    } finally {
      setCancelling(false);
    }
  };

  if (isSessionLoading || loading) return <Skeleton />;

  if (error || !order) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <FiPackage className="w-14 h-14 text-outline/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-dark mb-2">Order Not Found</h2>
          <p className="text-sm text-outline mb-6">{error || 'This order does not exist or belongs to another account.'}</p>
          <Link href="/account" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold">
            <FiArrowLeft className="w-4 h-4" /> Back to My Orders
          </Link>
        </div>
      </AppShell>
    );
  }

  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  const isDelivered = order.status === 'delivered';
  const currentStepIdx = isCancelled ? -1 : getStepIndex(order.status);
  const activeSteps = isCancelled
    ? [CANCELLED_STEP]
    : order.status === 'refunded'
    ? [REFUNDED_STEP]
    : STATUS_STEPS;

  const colors = STATUS_COLOR[order.status] || STATUS_COLOR.pending;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Back + Refresh */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/account"
            className="flex items-center gap-1.5 text-sm text-outline hover:text-pink-deep transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" /> My Orders
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

        {/* Order Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-card border border-outline-variant/10 mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-outline mb-1">Order Number</p>
              <h1 className="text-lg sm:text-xl font-bold text-dark font-mono">#{order.orderNumber}</h1>
              <p className="text-xs text-outline mt-1">Placed on {formatDate(order.createdAt)}</p>
            </div>
            <div className={`self-start sm:self-center inline-flex items-center gap-2 px-4 py-2 rounded-full ${colors.bg} ${colors.text} font-semibold text-sm ring-1 ${colors.ring}`}>
              {isDelivered ? <FiCheckCircle className="w-4 h-4" /> : isCancelled ? <FiXCircle className="w-4 h-4" /> : <FiClock className="w-4 h-4" />}
              {order.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </div>
          </div>

          {/* Key info row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: FiCalendar, label: 'Delivery Date', value: order.deliveryDate ? formatDate(order.deliveryDate) : '—' },
              { icon: FiClock,    label: 'Delivery Slot', value: order.deliverySlot?.label || '—' },
              { icon: FiCreditCard, label: 'Payment', value: order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online' },
              { icon: FiPackage,  label: 'Items', value: `${order.items?.length || 0} item${order.items?.length !== 1 ? 's' : ''}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-surface-container-low rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-outline" />
                  <p className="text-xs text-outline">{label}</p>
                </div>
                <p className="text-sm font-semibold text-dark leading-snug">{value}</p>
              </div>
            ))}
          </div>

          {/* Cancel button */}
          {isCancellable(order.status) && (
            <div className="mt-4 pt-4 border-t border-outline-variant/10">
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-2 text-sm font-medium text-error hover:bg-error/5 px-4 py-2 rounded-lg transition-colors border border-error/20"
              >
                <FiXCircle className="w-4 h-4" />
                Cancel Order
              </button>
            </div>
          )}
        </motion.div>

        {/* ── Status Timeline ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-card border border-outline-variant/10 mb-6"
        >
          <h2 className="text-base font-bold text-dark mb-5">Order Timeline</h2>

          {isCancelled ? (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 ring-2 ring-red-300 flex items-center justify-center shrink-0">
                <FiXCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="pt-1.5">
                <p className="text-sm font-semibold text-dark">Order Cancelled</p>
                {order.statusHistory?.slice().reverse().find((h) => h.status === 'cancelled') && (
                  <p className="text-xs text-outline mt-0.5">
                    {formatDate(order.statusHistory.slice().reverse().find((h) => h.status === 'cancelled').timestamp, {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
                <p className="text-xs text-outline mt-1">
                  {order.statusHistory?.slice().reverse().find((h) => h.status === 'cancelled')?.note || 'Cancelled by customer.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical track */}
              <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-surface-container-high" />

              <div className="space-y-0">
                {STATUS_STEPS.map((step, idx) => {
                  const isCompleted = idx < currentStepIdx;
                  const isActive    = idx === currentStepIdx;
                  const isPending   = idx > currentStepIdx;

                  // Find matching history entry
                  const historyEntry = order.statusHistory
                    ?.slice()
                    .reverse()
                    .find((h) => h.status === step.key);

                  const Icon = step.icon;

                  return (
                    <div key={step.key} className="relative flex items-start gap-4 pb-6 last:pb-0">
                      {/* Step circle */}
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isCompleted
                          ? 'bg-green-500 ring-2 ring-green-200'
                          : isActive
                          ? `${colors.bg} ring-2 ${colors.ring}`
                          : 'bg-surface-container-high ring-1 ring-surface-dim'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          isCompleted ? 'text-white' : isActive ? colors.text : 'text-outline/40'
                        } ${isActive && !isDelivered ? 'animate-pulse' : ''}`} />
                      </div>

                      {/* Step content */}
                      <div className="pt-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-semibold ${
                            isCompleted ? 'text-green-700' : isActive ? colors.text : 'text-outline/50'
                          }`}>
                            {step.label}
                          </p>
                          {isActive && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text}`}>
                              Current
                            </span>
                          )}
                          {isCompleted && (
                            <FiCheckCircle className="w-3.5 h-3.5 text-green-500" />
                          )}
                        </div>

                        {historyEntry ? (
                          <p className="text-xs text-outline mt-0.5">
                            {formatDate(historyEntry.timestamp, {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                            {historyEntry.note ? ` · ${historyEntry.note}` : ''}
                          </p>
                        ) : (
                          <p className={`text-xs mt-0.5 ${isPending ? 'text-outline/40' : 'text-outline'}`}>
                            {isPending ? 'Awaiting…' : step.desc}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Order Items ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-card border border-outline-variant/10 mb-6"
        >
          <h2 className="text-base font-bold text-dark mb-4">Order Items</h2>
          <div className="space-y-3">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl">
                {/* Image / placeholder */}
                <div className="w-14 h-14 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <FiPackage className="w-6 h-6 text-outline/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dark truncate">{item.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {item.weight && <span className="text-xs text-outline">{item.weight}</span>}
                    {item.isEggless && <span className="text-xs text-green-600 font-medium">Eggless</span>}
                    {item.flavor && <span className="text-xs text-outline">{item.flavor}</span>}
                    <span className="text-xs text-outline">Qty: {item.quantity}</span>
                  </div>
                  {item.cakeMessage && (
                    <p className="text-xs text-outline mt-1 italic">"{item.cakeMessage}"</p>
                  )}
                  {item.addOns?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.addOns.map((a, i) => (
                        <span key={i} className="text-xs bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full border border-pink-100">
                          {a.name} +{formatPrice(a.price)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold text-pink-deep shrink-0">{formatPrice(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>

          {/* Price breakdown */}
          <div className="mt-4 pt-4 border-t border-outline-variant/10 space-y-2">
            {[
              { label: 'Subtotal', value: order.subtotal },
              { label: 'Delivery Charge', value: order.deliveryCharge },
              order.discount > 0 && { label: `Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, value: -order.discount },
            ].filter(Boolean).map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-outline">{label}</span>
                <span className={value < 0 ? 'text-green-600 font-medium' : 'text-dark'}>
                  {value < 0 ? `-${formatPrice(-value)}` : formatPrice(value)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-outline-variant/10">
              <span className="text-dark">Total</span>
              <span className="text-pink-deep">{formatPrice(order.total)}</span>
            </div>
          </div>
        </motion.div>

        {/* ── Delivery Address ──────────────────────────────────────────── */}
        {order.shippingAddress && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-card border border-outline-variant/10 mb-6"
          >
            <h2 className="text-base font-bold text-dark mb-4">Delivery Address</h2>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center shrink-0">
                <FiMapPin className="w-5 h-5 text-pink-deep" />
              </div>
              <div>
                <p className="text-sm font-semibold text-dark flex items-center gap-2">
                  <FiUser className="w-3.5 h-3.5 text-outline" />
                  {order.shippingAddress.fullName}
                </p>
                <p className="text-sm text-outline mt-0.5 flex items-center gap-2">
                  <FiPhone className="w-3.5 h-3.5" />
                  {order.shippingAddress.phone}
                </p>
                <p className="text-sm text-outline mt-1">
                  {order.shippingAddress.addressLine1}
                  {order.shippingAddress.addressLine2 ? `, ${order.shippingAddress.addressLine2}` : ''}
                  {order.shippingAddress.landmark ? `, Near ${order.shippingAddress.landmark}` : ''}
                  {`, ${order.shippingAddress.city}`}
                  {order.shippingAddress.state ? `, ${order.shippingAddress.state}` : ''}
                  {` - ${order.shippingAddress.pincode}`}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Need help */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.26 }}
          className="text-center py-4"
        >
          <p className="text-xs text-outline">
            Need help?{' '}
            <Link href="/contact" className="text-pink-deep hover:underline font-medium">
              Contact Support
            </Link>
          </p>
        </motion.div>
      </div>

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
