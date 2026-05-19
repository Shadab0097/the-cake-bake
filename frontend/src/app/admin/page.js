'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import adminApi, { formatPrice, formatDate, formatDateTime } from '@/lib/adminApi';
import { StatusBadge, StatCard, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';
import {
  HiOutlineCurrencyRupee, HiOutlineShoppingBag, HiOutlineUsers,
  HiOutlineCube, HiOutlineClock, HiOutlineCalendarDays,
  HiOutlineExclamationTriangle, HiOutlineBellAlert, HiOutlineCreditCard,
  HiOutlineReceiptRefund, HiOutlineShieldExclamation, HiOutlineShoppingCart,
  HiOutlineTicket
} from 'react-icons/hi2';

function OperationCard({ label, value, icon, tone = 'info', href }) {
  const colors = {
    danger: 'var(--admin-danger-soft)',
    warning: 'var(--admin-warning-soft)',
    success: 'var(--admin-success-soft)',
    info: 'var(--admin-info-soft)',
    accent: 'var(--admin-accent-soft)',
  };

  const content = (
    <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minHeight: 94 }}>
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 'var(--admin-radius-sm)',
        background: colors[tone] || colors.info,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--admin-text)' }}>{value}</div>
      </div>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      {content}
    </Link>
  );
}

function CompactPanel({ title, action, children }) {
  return (
    <div className="admin-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyPanel({ message }) {
  return <div className="admin-empty" style={{ padding: '1.5rem 0' }}>{message}</div>;
}

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
  const operations = dashData?.operations || {};
  const operationCards = [
    {
      label: 'Pending Payments',
      value: operations.payments?.pending || 0,
      icon: <HiOutlineCreditCard />,
      tone: (operations.payments?.stalePending || 0) > 0 ? 'warning' : 'info',
      href: '/admin/orders?paymentStatus=pending',
    },
    {
      label: 'Failed/Expired Payments',
      value: (operations.payments?.failed || 0) + (operations.payments?.expired || 0),
      icon: <HiOutlineExclamationTriangle />,
      tone: ((operations.payments?.failed || 0) + (operations.payments?.expired || 0)) > 0 ? 'danger' : 'success',
      href: '/admin/orders?paymentStatus=failed',
    },
    {
      label: 'Refund Queue',
      value: (operations.refunds?.requested || 0) + (operations.refunds?.approved || 0) + (operations.refunds?.processing || 0),
      icon: <HiOutlineReceiptRefund />,
      tone: (operations.refunds?.failed || 0) > 0 ? 'danger' : 'warning',
      href: '/admin/refunds',
    },
    {
      label: 'Low Stock Variants',
      value: operations.inventory?.lowStockCount || 0,
      icon: <HiOutlineCube />,
      tone: (operations.inventory?.lowStockCount || 0) > 0 ? 'warning' : 'success',
      href: '/admin/products',
    },
    {
      label: 'Open Critical Alerts',
      value: operations.alerts?.critical || 0,
      icon: <HiOutlineBellAlert />,
      tone: (operations.alerts?.critical || 0) > 0 ? 'danger' : 'success',
      href: '/admin/notifications',
    },
    {
      label: 'High-Risk COD',
      value: operations.cod?.highRiskCount || 0,
      icon: <HiOutlineShieldExclamation />,
      tone: (operations.cod?.highRiskCount || 0) > 0 ? 'warning' : 'success',
      href: '/admin/orders?paymentMethod=cod',
    },
    {
      label: 'Failed Notifications',
      value: operations.notifications?.failed || 0,
      icon: <HiOutlineBellAlert />,
      tone: (operations.notifications?.failed || 0) > 0 ? 'warning' : 'success',
      href: '/admin/notifications',
    },
    {
      label: 'Abandoned Carts',
      value: operations.carts?.abandoned || 0,
      icon: <HiOutlineShoppingCart />,
      tone: (operations.carts?.abandoned || 0) > 0 ? 'accent' : 'success',
    },
  ];

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

      {/* Operations Row */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Live Operations</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
              Last {operations.windowHours || 24} hours for payment and notification health
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {operationCards.map((card) => (
            <OperationCard key={card.label} {...card} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <CompactPanel
            title="Low Stock"
            action={<Link href="/admin/products" style={{ fontSize: '0.8125rem', color: 'var(--admin-accent-hover)', textDecoration: 'none' }}>Manage</Link>}
          >
            {(operations.inventory?.lowStock || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {operations.inventory.lowStock.map((variant) => (
                  <div key={variant._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {variant.product?.name || 'Product'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                        {variant.weight || variant.sku || 'Variant'}
                      </div>
                    </div>
                    <span style={{
                      minWidth: 46,
                      textAlign: 'center',
                      borderRadius: 999,
                      padding: '0.2rem 0.55rem',
                      background: variant.stock <= 0 ? 'var(--admin-danger-soft)' : 'var(--admin-warning-soft)',
                      color: variant.stock <= 0 ? 'var(--admin-danger)' : 'var(--admin-warning)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                    }}>
                      {variant.stock}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel message="No low-stock variants" />
            )}
          </CompactPanel>

          <CompactPanel
            title="Refund Queue"
            action={<Link href="/admin/refunds" style={{ fontSize: '0.8125rem', color: 'var(--admin-accent-hover)', textDecoration: 'none' }}>Open</Link>}
          >
            {(operations.refunds?.queue || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {operations.refunds.queue.map((refund) => (
                  <div key={refund._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        #{refund.order?.orderNumber || 'Order'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                        {formatDateTime(refund.createdAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{formatPrice(refund.amount || 0)}</span>
                      <StatusBadge status={refund.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel message="No refunds waiting" />
            )}
          </CompactPanel>

          <CompactPanel
            title="Open Alerts"
            action={<Link href="/admin/notifications" style={{ fontSize: '0.8125rem', color: 'var(--admin-accent-hover)', textDecoration: 'none' }}>Review</Link>}
          >
            {(operations.alerts?.recent || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {operations.alerts.recent.map((alert) => (
                  <div key={alert._id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {alert.type}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {alert.message}
                      </div>
                    </div>
                    <StatusBadge status={alert.severity} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel message="No open operational alerts" />
            )}
          </CompactPanel>

          <CompactPanel title="Coupon Usage">
            {(operations.coupons?.top || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {operations.coupons.top.slice(0, 6).map((coupon) => {
                  const usageLimit = coupon.usageLimit || 0;
                  const percent = usageLimit > 0 ? Math.min(100, Math.round((coupon.usageCount / usageLimit) * 100)) : 0;
                  return (
                    <div key={coupon._id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{coupon.code}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                          {coupon.usageCount || 0}{usageLimit > 0 ? ` / ${usageLimit}` : ''}
                        </span>
                      </div>
                      {usageLimit > 0 && (
                        <div style={{ height: 6, background: 'var(--admin-bg)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${percent}%`, background: percent >= 80 ? 'var(--admin-warning)' : 'var(--admin-info)', borderRadius: 99 }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyPanel message="No coupon usage yet" />
            )}
          </CompactPanel>
        </div>
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
