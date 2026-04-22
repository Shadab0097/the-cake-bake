'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  FiPackage, FiHeart, FiMapPin, FiLogOut, FiUser,
  FiShoppingBag, FiChevronRight, FiClock, FiCalendar,
  FiTruck, FiCheckCircle, FiXCircle, FiRefreshCw,
} from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import { logout } from '@/store/slices/authSlice';
import { resetCart, clearGuestCartAndStorage } from '@/store/slices/cartSlice';
import { resetWishlist } from '@/store/slices/wishlistSlice';
import { addToast } from '@/store/slices/toastSlice';
import { formatPrice, formatDate } from '@/lib/utils';
import api from '@/lib/api';

const TABS = [
  { label: 'Orders', icon: FiPackage, key: 'orders' },
  { label: 'Wishlist', icon: FiHeart, key: 'wishlist' },
  { label: 'Addresses', icon: FiMapPin, key: 'addresses' },
  { label: 'Profile', icon: FiUser, key: 'profile' },
];

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-amber-50 text-amber-700 border border-amber-200',
    icon: FiClock,
    dot: 'bg-amber-400',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-blue-50 text-blue-700 border border-blue-200',
    icon: FiCheckCircle,
    dot: 'bg-blue-400',
  },
  preparing: {
    label: 'Preparing',
    color: 'bg-purple-50 text-purple-700 border border-purple-200',
    icon: FiRefreshCw,
    dot: 'bg-purple-400',
  },
  packed: {
    label: 'Packed',
    color: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    icon: FiPackage,
    dot: 'bg-indigo-400',
  },
  dispatched: {
    label: 'Dispatched',
    color: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    icon: FiTruck,
    dot: 'bg-cyan-400',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    color: 'bg-pink-50 text-pink-700 border border-pink-200',
    icon: FiTruck,
    dot: 'bg-pink-400',
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-green-50 text-green-700 border border-green-200',
    icon: FiCheckCircle,
    dot: 'bg-green-500',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-50 text-red-700 border border-red-200',
    icon: FiXCircle,
    dot: 'bg-red-400',
  },
  refunded: {
    label: 'Refunded',
    color: 'bg-gray-50 text-gray-700 border border-gray-200',
    icon: FiRefreshCw,
    dot: 'bg-gray-400',
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    color: 'bg-surface-container-high text-outline border border-outline-variant/20',
    dot: 'bg-outline',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function OrderCard({ order }) {
  const itemPreview = order.items?.slice(0, 2) || [];
  const extra = (order.items?.length || 0) - 2;

  return (
    <Link
      href={`/order-tracking/${order.orderNumber}`}
      className="group block bg-surface-container-lowest rounded-2xl p-5 shadow-card border border-outline-variant/10 hover:border-pink-deep/30 hover:shadow-lg transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-dark">
              #{order.orderNumber}
            </p>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-outline flex items-center gap-1">
              <FiCalendar className="w-3 h-3" />
              {formatDate(order.createdAt)}
            </span>
            {order.deliveryDate && (
              <span className="text-xs text-outline flex items-center gap-1">
                <FiTruck className="w-3 h-3" />
                Delivery: {formatDate(order.deliveryDate)}
              </span>
            )}
          </div>
        </div>
        <FiChevronRight className="w-4 h-4 text-outline group-hover:text-pink-deep transition-colors shrink-0 mt-1" />
      </div>

      {/* Items preview */}
      {itemPreview.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {itemPreview.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-surface-container-low rounded-lg px-2.5 py-1.5">
              <FiPackage className="w-3 h-3 text-pink-deep shrink-0" />
              <span className="text-xs text-dark font-medium truncate max-w-[120px]">{item.name}</span>
              {item.weight && <span className="text-xs text-outline">({item.weight})</span>}
              <span className="text-xs text-outline">×{item.quantity}</span>
            </div>
          ))}
          {extra > 0 && (
            <span className="text-xs text-outline bg-surface-container-low rounded-lg px-2.5 py-1.5">
              +{extra} more
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-outline">Total</p>
            <p className="text-sm font-bold text-pink-deep">{formatPrice(order.total)}</p>
          </div>
          {order.paymentMethod && (
            <div>
              <p className="text-xs text-outline">Payment</p>
              <p className="text-xs font-medium text-dark capitalize">{order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online'}</p>
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-pink-deep group-hover:underline flex items-center gap-1">
          Track Order <FiChevronRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
}

export default function AccountPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated, isSessionLoading, user } = useSelector((s) => s.auth);
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);

  const fetchData = async (refreshOnly = false) => {
    if (refreshOnly) {
      setOrdersRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [ordersRes, addressesRes] = await Promise.all([
        api.get('/orders').catch(() => ({ data: { data: [] } })),
        api.get('/addresses').catch(() => ({ data: { data: [] } })),
      ]);
      // Handle paginated response shape: { docs: [] } or flat array
      const ordersData = ordersRes.data?.data;
      const ordersList = Array.isArray(ordersData)
        ? ordersData
        : (ordersData?.docs || ordersData?.items || ordersData?.orders || []);
      setOrders(ordersList);
      setAddresses(addressesRes.data?.data || []);
    } finally {
      setLoading(false);
      setOrdersRefreshing(false);
    }
  };

  // Fetch data only when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await dispatch(logout());
    dispatch(resetCart());
    dispatch(clearGuestCartAndStorage());
    dispatch(resetWishlist());
    dispatch(addToast({ message: 'Logged out successfully', type: 'success' }));
    router.push('/');
  };

  // Still restoring session
  if (isSessionLoading) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="w-10 h-10 border-3 border-pink-deep border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="text-4xl mb-4">👋</div>
          <h2 className="text-2xl font-bold text-dark mb-2">Welcome Back!</h2>
          <p className="text-outline mb-6">Please login to view your account dashboard, orders, and addresses.</p>
          <Link href="/login" className="px-6 py-2 rounded-full gradient-primary text-white font-semibold shadow-md">
            Login
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-deep to-pink flex items-center justify-center text-white text-xl font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-dark truncate">{user?.name}</h1>
            <p className="text-sm text-outline truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-error border border-error/30 rounded-lg hover:bg-error/5 transition-colors shrink-0"
          >
            <FiLogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto no-scrollbar border-b border-outline-variant/20 pb-0">
          {TABS.map(({ label, icon: Icon, key }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'border-pink-deep text-pink-deep'
                  : 'border-transparent text-outline hover:text-dark'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {key === 'orders' && orders.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-pink-deep/10 text-pink-deep rounded-full font-semibold">
                  {orders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'orders' && (
          <div>
            {/* Refresh button */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-outline">
                {orders.length > 0 ? `${orders.length} order${orders.length !== 1 ? 's' : ''} found` : ''}
              </p>
              <button
                onClick={() => fetchData(true)}
                disabled={ordersRefreshing || loading}
                className="flex items-center gap-1.5 text-xs text-outline hover:text-pink-deep transition-colors disabled:opacity-50"
              >
                <FiRefreshCw className={`w-3.5 h-3.5 ${ordersRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-surface-container-lowest rounded-2xl p-5 shadow-card animate-pulse">
                    <div className="flex justify-between mb-4">
                      <div className="space-y-2">
                        <div className="h-4 bg-surface-container-high rounded w-32" />
                        <div className="h-3 bg-surface-container-high rounded w-24" />
                      </div>
                      <div className="h-6 bg-surface-container-high rounded-full w-20" />
                    </div>
                    <div className="flex gap-2 mb-4">
                      <div className="h-7 bg-surface-container-high rounded-lg w-36" />
                    </div>
                    <div className="h-px bg-surface-container-high mb-3" />
                    <div className="flex justify-between">
                      <div className="h-4 bg-surface-container-high rounded w-20" />
                      <div className="h-4 bg-surface-container-high rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
                  <FiShoppingBag className="w-10 h-10 text-outline/50" />
                </div>
                <h3 className="text-lg font-semibold text-dark mb-2">No orders yet</h3>
                <p className="text-sm text-outline mb-6">Start ordering delicious cakes and your orders will appear here!</p>
                <Link
                  href="/products"
                  className="inline-flex px-6 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Browse Cakes
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <OrderCard key={order._id} order={order} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'addresses' && (
          <div className="space-y-3">
            {addresses.length === 0 ? (
              <div className="text-center py-12">
                <FiMapPin className="w-10 h-10 text-outline/40 mx-auto mb-3" />
                <p className="text-sm text-outline">No saved addresses yet.</p>
              </div>
            ) : (
              addresses.map((addr) => (
                <div key={addr._id} className="p-4 bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant/10">
                  <div className="flex items-center gap-2 mb-1">
                    <FiMapPin className="w-4 h-4 text-pink-deep" />
                    <p className="text-sm font-semibold text-dark">{addr.label || 'Address'}</p>
                  </div>
                  <p className="text-sm text-outline ml-6">
                    {addr.addressLine1 || addr.line1}
                    {addr.area ? `, ${addr.area}` : ''}
                    {`, ${addr.city}`}
                    {addr.state ? `, ${addr.state}` : ''}
                    {` - ${addr.pincode}`}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card max-w-lg border border-outline-variant/10">
            <div className="space-y-4 text-sm">
              {[
                { label: 'Name', value: user?.name },
                { label: 'Email', value: user?.email },
                { label: 'Phone', value: user?.phone || 'Not set' },
                { label: 'Member Since', value: formatDate(user?.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <label className="text-outline text-xs uppercase tracking-wider">{label}</label>
                  <p className="font-medium text-dark">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-pink-light/20 flex items-center justify-center mx-auto mb-4">
              <FiHeart className="w-10 h-10 text-pink-deep/40" />
            </div>
            <h3 className="font-semibold text-dark mb-2">Your Wishlist</h3>
            <p className="text-sm text-outline mb-5">View and manage all your saved items</p>
            <Link
              href="/wishlist"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <FiHeart className="w-4 h-4" /> View Wishlist
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
