'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import { FiPackage, FiHeart, FiMapPin, FiLogOut, FiUser, FiShoppingBag } from 'react-icons/fi';
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

export default function AccountPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated, isSessionLoading, user } = useSelector((s) => s.auth);
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Note: We no longer auto-redirect. We will show a friendly message in the render if not authenticated.

  // Fetch data only when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    Promise.all([
      api.get('/orders/my').catch(() => ({ data: { data: [] } })),
      api.get('/addresses').catch(() => ({ data: { data: [] } })),
    ]).then(([ordersRes, addressesRes]) => {
      setOrders(ordersRes.data?.data?.items || ordersRes.data?.data?.docs || ordersRes.data?.data || []);
      setAddresses(addressesRes.data?.data || []);
    }).finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await dispatch(logout());
    dispatch(resetCart());
    dispatch(clearGuestCartAndStorage());
    dispatch(resetWishlist());
    dispatch(addToast({ message: 'Logged out successfully', type: 'success' }));
    router.push('/');
  };

  const STATUS_COLORS = {
    pending: 'bg-warning/10 text-warning',
    confirmed: 'bg-info/10 text-info',
    preparing: 'bg-secondary/10 text-secondary',
    out_for_delivery: 'bg-pink/20 text-pink-deep',
    delivered: 'bg-success/10 text-success',
    cancelled: 'bg-error/10 text-error',
  };

  // Still restoring session — render AppShell but show loading inside
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
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-deep to-pink flex items-center justify-center text-white text-xl font-bold">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark">{user?.name}</h1>
            <p className="text-sm text-outline">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-error border border-error/30 rounded-lg hover:bg-error/5 transition-colors"
          >
            <FiLogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto no-scrollbar border-b border-outline-variant/20 pb-0">
          {TABS.map(({ label, icon: Icon, key }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === key
                  ? 'border-pink-deep text-pink-deep'
                  : 'border-transparent text-outline hover:text-dark'
                }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'orders' && (
          <div>
            {orders.length === 0 ? (
              <div className="text-center py-12">
                <FiShoppingBag className="w-12 h-12 text-outline mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-dark">No orders yet</h3>
                <p className="text-sm text-outline mb-4">Start ordering delicious cakes!</p>
                <Link href="/products" className="inline-flex px-5 py-2 rounded-full gradient-primary text-white text-sm font-semibold">
                  Browse Cakes
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order._id} className="bg-surface-container-lowest rounded-2xl p-5 shadow-card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-outline">Order #{order.orderNumber || order._id.slice(-8)}</p>
                        <p className="text-xs text-outline">{formatDate(order.createdAt)}</p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[order.status] || 'bg-surface-container-high text-outline'}`}>
                        {order.status?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      {order.items?.length || 0} items
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-base font-bold text-pink-deep">{formatPrice(order.totalAmount || order.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'addresses' && (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div key={addr._id} className="p-4 bg-surface-container-lowest rounded-xl shadow-card">
                <p className="text-sm font-semibold text-dark">{addr.label}</p>
                <p className="text-sm text-outline">{addr.addressLine1}, {addr.city} - {addr.pincode}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-card max-w-lg">
            <div className="space-y-4 text-sm">
              <div>
                <label className="text-outline text-xs uppercase tracking-wider">Name</label>
                <p className="font-medium text-dark">{user?.name}</p>
              </div>
              <div>
                <label className="text-outline text-xs uppercase tracking-wider">Email</label>
                <p className="font-medium text-dark">{user?.email}</p>
              </div>
              <div>
                <label className="text-outline text-xs uppercase tracking-wider">Phone</label>
                <p className="font-medium text-dark">{user?.phone || 'Not set'}</p>
              </div>
              <div>
                <label className="text-outline text-xs uppercase tracking-wider">Member Since</label>
                <p className="font-medium text-dark">{formatDate(user?.createdAt)}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wishlist' && (
          <div className="text-center py-12">
            <FiHeart className="w-12 h-12 text-pink-deep/30 mx-auto mb-3" />
            <h3 className="font-semibold text-dark mb-2">Your Wishlist</h3>
            <p className="text-sm text-outline mb-5">View and manage all your saved items</p>
            <Link href="/wishlist" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              <FiHeart className="w-4 h-4" /> View Wishlist
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
