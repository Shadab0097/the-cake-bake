'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import adminApi, { formatPrice, formatDate, formatDateTime } from '@/lib/adminApi';
import { StatusBadge, StatCard, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';
import {
  HiOutlineCurrencyRupee, HiOutlineShoppingBag, HiOutlineUsers,
  HiOutlineCube, HiOutlineClock, HiOutlineCalendarDays
} from 'react-icons/hi2';

export default function AdminDashboardPage() {
  const [dashData, setDashData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, analyticsRes] = await Promise.all([
        adminApi.dashboard.get(),
        adminApi.dashboard.getAnalytics(30),
      ]);
      setDashData(dashRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div>
        <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="admin-card"><div className="admin-skeleton" style={{ height: 60 }} /></div>
          ))}
        </div>
        <LoadingSkeleton rows={8} cols={5} />
      </div>
    );
  }

  const overview = dashData?.overview || {};
  const recentOrders = dashData?.recentOrders || [];
  // statusDistribution is an object { 'pending': 5, 'delivered': 12, ... }
  const statusDistObj = dashData?.statusDistribution || {};
  const statusDist = Object.entries(statusDistObj).map(([_id, count]) => ({ _id, count }));
  const revenueByDay = analytics?.revenueByDay || [];
  // topProducts has _id (name), totalQuantity, totalRevenue
  const topProducts = (analytics?.topProducts || []).map(p => ({ ...p, name: p._id, totalOrders: p.totalQuantity }));

  const stats = [
    { label: 'Total Revenue', value: formatPrice(overview.totalRevenue || 0), icon: <HiOutlineCurrencyRupee />, color: 'var(--admin-accent-soft)' },
    { label: "Today's Revenue", value: formatPrice(overview.todayRevenue || 0), icon: <HiOutlineCurrencyRupee />, color: 'var(--admin-success-soft)' },
    { label: 'Monthly Revenue', value: formatPrice(overview.monthRevenue || 0), icon: <HiOutlineCalendarDays />, color: 'var(--admin-info-soft)' },
    { label: 'Total Orders', value: (overview.totalOrders || 0).toLocaleString(), icon: <HiOutlineShoppingBag />, color: 'var(--admin-accent-soft)' },
    { label: "Today's Orders", value: overview.todayOrders || 0, icon: <HiOutlineClock />, color: 'var(--admin-success-soft)' },
    { label: 'Pending Orders', value: overview.pendingOrders || 0, icon: <HiOutlineShoppingBag />, color: 'var(--admin-warning-soft)' },
    { label: 'Total Customers', value: (overview.totalCustomers || 0).toLocaleString(), icon: <HiOutlineUsers />, color: 'var(--admin-info-soft)' },
    { label: 'Active Products', value: overview.totalProducts || 0, icon: <HiOutlineCube />, color: 'var(--admin-success-soft)' },
  ];

  // Mini chart: revenue last 30 days
  const maxRevenue = Math.max(...revenueByDay.map(d => d.revenue || 0), 1);
  const chartHeight = 120;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <RefreshButton onRefresh={fetchData} />
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {stats.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {/* Revenue Chart */}
        <div className="admin-card" style={{ gridColumn: revenueByDay.length > 0 ? undefined : '1 / -1' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Revenue (Last 30 Days)</h3>
          {revenueByDay.length > 0 ? (
            <div style={{ position: 'relative', height: chartHeight }}>
              <svg width="100%" height={chartHeight} viewBox={`0 0 ${revenueByDay.length * 20} ${chartHeight}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D81B60" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#D81B60" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={revenueByDay.map((d, i) => {
                    const x = i * 20;
                    const y = chartHeight - (((d.revenue || 0) / maxRevenue) * (chartHeight - 10));
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                  }).join(' ') + ` L${(revenueByDay.length - 1) * 20},${chartHeight} L0,${chartHeight} Z`}
                  fill="url(#revGrad)"
                />
                <path
                  d={revenueByDay.map((d, i) => {
                    const x = i * 20;
                    const y = chartHeight - (((d.revenue || 0) / maxRevenue) * (chartHeight - 10));
                    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#D81B60"
                  strokeWidth="2"
                />
              </svg>
            </div>
          ) : (
            <div className="admin-empty">No revenue data</div>
          )}
        </div>

        {/* Order Status Distribution */}
        <div className="admin-card">
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Order Status Distribution</h3>
          {statusDist.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {statusDist.map((s, i) => {
                const totalCount = statusDist.reduce((a, b) => a + (b.count || 0), 0);
                const pct = totalCount > 0 ? ((s.count / totalCount) * 100).toFixed(1) : 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <StatusBadge status={s._id} />
                    <div style={{ flex: 1, height: 6, background: 'var(--admin-bg)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--admin-accent)', borderRadius: 99, transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', minWidth: 40, textAlign: 'right' }}>{s.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="admin-empty">No order data</div>
          )}
        </div>
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className="admin-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Top Products</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {topProducts.slice(0, 8).map((p, i) => {
              const maxOrders = topProducts[0]?.totalOrders || 1;
              const pct = ((p.totalOrders / maxOrders) * 100).toFixed(0);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', width: 20, textAlign: 'right' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <div style={{ width: 120, height: 6, background: 'var(--admin-bg)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--admin-info)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', minWidth: 30, textAlign: 'right' }}>{p.totalOrders}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="admin-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Recent Orders</h3>
          <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: 'var(--admin-accent-hover)', textDecoration: 'none' }}>
            View All →
          </Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Delivery</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const firstItem = order.items?.[0];
                  const isNew = (Date.now() - new Date(order.createdAt).getTime()) < 60 * 60 * 1000;
                  return (
                    <tr key={order._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <Link href={`/admin/orders/${order._id}`} style={{ color: 'var(--admin-accent-hover)', textDecoration: 'none', fontWeight: 700 }}>
                            #{order.orderNumber}
                          </Link>
                          {isNew && (
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 20, background: '#22c55e', color: '#fff', letterSpacing: '0.04em', animation: 'adminPulse 2s infinite' }}>
                              NEW
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                            {order.user?.name || order.guestInfo?.name || order.shippingAddress?.fullName || '—'}
                          </span>
                          {!order.user && (
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 20, background: '#8b5cf6', color: '#fff', letterSpacing: '0.04em' }}>
                              GUEST
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>{formatDateTime(order.createdAt)}</div>
                      </td>
                      <td style={{ maxWidth: 160 }}>
                        {firstItem ? (
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{firstItem.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>{firstItem.weight}{order.items?.length > 1 ? ` +${order.items.length - 1}` : ''}</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--admin-text-secondary)' }}>
                        {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      </td>
                      <td style={{ fontWeight: 700 }}>{formatPrice(order.total)}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{
                            display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20,
                            background: order.paymentMethod === 'cod' ? 'rgba(217,119,6,0.12)' : 'rgba(59,130,246,0.12)',
                            color: order.paymentMethod === 'cod' ? '#d97706' : '#3b82f6',
                            border: `1px solid ${order.paymentMethod === 'cod' ? 'rgba(217,119,6,0.3)' : 'rgba(59,130,246,0.3)'}`,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            {order.paymentMethod === 'cod' ? '💵 COD' : '💳 Online'}
                          </span>
                          <StatusBadge status={order.paymentStatus} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">No orders yet</div>
        )}
      </div>
    </div>
  );
}
