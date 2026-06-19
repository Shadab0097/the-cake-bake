'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineBellAlert,
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineCreditCard,
  HiOutlineCube,
  HiOutlineCurrencyRupee,
  HiOutlineExclamationTriangle,
  HiOutlineReceiptRefund,
  HiOutlineShieldExclamation,
  HiOutlineShoppingBag,
  HiOutlineShoppingCart,
  HiOutlineTicket,
  HiOutlineUsers,
} from 'react-icons/hi2';
import adminApi, { formatDateTime, formatPrice } from '@/lib/adminApi';
import { LoadingSkeleton, RefreshButton, StatCard, StatusBadge } from '@/components/admin/AdminUI';
import {
  OrderStatusDonut,
  RevenueTrendChart,
  TopCitiesChart,
  TopProductsChart,
} from '@/components/admin/AdminCharts';

const RANGE_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

function getErrorMessage(error, fallback = 'Failed to load dashboard data') {
  return error?.response?.data?.message || error?.message || fallback;
}

function RangeSwitcher({ value, onChange, disabled }) {
  return (
    <div className="admin-range-switch" role="group" aria-label="Select analytics time range">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`admin-range-btn ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
          disabled={disabled}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, keys, children, loading }) {
  return (
    <div className="admin-card admin-chart-card">
      <div className="admin-chart-head">
        <div className="admin-chart-head-titles">
          <h3>{title}</h3>
          {subtitle && <div className="admin-section-subtitle">{subtitle}</div>}
        </div>
        {keys && <div className="admin-chart-keys">{keys}</div>}
      </div>
      <div className="admin-chart-body">
        {loading && (
          <div className="admin-chart-loading" aria-hidden="true">
            <div className="admin-spinner" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function OperationCard({ label, value, icon, tone = 'info', href }) {
  const content = (
    <div className="admin-card admin-operation-card">
      <div className={`admin-operation-icon ${tone}`}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div className="admin-operation-label">{label}</div>
        <div className="admin-operation-value">{value}</div>
      </div>
    </div>
  );

  if (!href) return content;
  return (
    <Link href={href} className="admin-card-link">
      {content}
    </Link>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className="admin-card">
      <div className="admin-section-heading">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyPanel({ message }) {
  return <div className="admin-empty-compact">{message}</div>;
}

export default function AdminDashboardPage() {
  const [dashData, setDashData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);
  const [error, setError] = useState('');

  const fetchData = useCallback(async ({ silent = false, days = 30 } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [dashRes, analyticsRes] = await Promise.all([
        adminApi.dashboard.get(),
        adminApi.dashboard.getAnalytics(days),
      ]);
      setDashData(dashRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const changeRange = useCallback(async (days) => {
    if (days === rangeDays) return;
    setRangeDays(days);
    setAnalyticsLoading(true);
    setError('');
    try {
      const res = await adminApi.dashboard.getAnalytics(days);
      setAnalytics(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [rangeDays]);

  useEffect(() => {
    fetchData({ days: 30 });
  }, [fetchData]);

  const overview = dashData?.overview || {};
  const operations = dashData?.operations || {};
  const recentOrders = dashData?.recentOrders || [];
  const statusDistribution = dashData?.statusDistribution;
  const statusDist = useMemo(() => (
    Object.entries(statusDistribution || {}).map(([_id, count]) => ({ _id, count }))
  ), [statusDistribution]);

  const revenueByDay = useMemo(() => analytics?.revenueByDay || [], [analytics]);
  const topProducts = useMemo(() => analytics?.topProducts || [], [analytics]);
  const topCities = useMemo(() => analytics?.topCities || [], [analytics]);

  const periodTotals = useMemo(() => revenueByDay.reduce(
    (acc, item) => ({
      revenue: acc.revenue + (item.revenue || 0),
      orders: acc.orders + (item.orders || 0),
    }),
    { revenue: 0, orders: 0 },
  ), [revenueByDay]);

  const operationCards = [
    {
      label: 'Pending Payments',
      value: operations.payments?.pending || 0,
      icon: <HiOutlineCreditCard />,
      tone: (operations.payments?.stalePending || 0) > 0 ? 'warning' : 'info',
      href: '/admin/orders?paymentStatus=pending',
    },
    {
      label: 'Failed Payments',
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
      label: 'Low Stock',
      value: operations.inventory?.lowStockCount || 0,
      icon: <HiOutlineCube />,
      tone: (operations.inventory?.lowStockCount || 0) > 0 ? 'warning' : 'success',
      href: '/admin/products',
    },
    {
      label: 'Critical Alerts',
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

  if (loading && !dashData) {
    return (
      <div>
        <div className="admin-page-header">
          <div>
            <div className="admin-page-kicker">Operations</div>
            <h1 className="admin-page-title">Admin Dashboard</h1>
          </div>
        </div>
        <div className="admin-dashboard-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="admin-card">
              <div className="admin-skeleton" style={{ height: 64 }} />
            </div>
          ))}
        </div>
        <LoadingSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <div className="admin-page-kicker">Operations</div>
          <h1 className="admin-page-title">Admin Dashboard</h1>
          <div className="admin-page-subtitle">
            Monitor revenue, fulfillment, inventory, refunds, and customer-impacting alerts from one place.
          </div>
        </div>
        <RefreshButton onRefresh={() => fetchData({ silent: true, days: rangeDays })} />
      </div>

      {error && (
        <div className="admin-error-panel" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => fetchData({ days: rangeDays })}>
            Retry
          </button>
        </div>
      )}

      <div className="admin-dashboard-grid admin-animate-in">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <section className="admin-dashboard-section">
        <div className="admin-section-heading">
          <div>
            <h2>Live Operations</h2>
            <div className="admin-section-subtitle">
              Last {operations.windowHours || 24} hours for payment, refund, stock, and notification health.
            </div>
          </div>
        </div>

        <div className="admin-dashboard-ops-grid admin-animate-in">
          {operationCards.map((card) => (
            <OperationCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-section-heading">
          <div>
            <h2>Performance Analytics</h2>
            <div className="admin-section-subtitle">
              Revenue, orders, products, and locations for the selected window.
            </div>
          </div>
          <RangeSwitcher value={rangeDays} onChange={changeRange} disabled={analyticsLoading} />
        </div>

        <div className="admin-chart-grid-main">
          <ChartCard
            title="Revenue Trend"
            subtitle={`${formatPrice(periodTotals.revenue)} from ${periodTotals.orders.toLocaleString('en-IN')} paid orders · last ${rangeDays} days`}
            loading={analyticsLoading}
            keys={(
              <>
                <span className="admin-chart-key">
                  <span className="admin-chart-key-dot" style={{ background: 'var(--admin-accent-hover)' }} />
                  Revenue
                </span>
                <span className="admin-chart-key">
                  <span className="admin-chart-key-dot admin-chart-key-line" style={{ background: 'var(--admin-info)' }} />
                  Orders
                </span>
              </>
            )}
          >
            <RevenueTrendChart data={revenueByDay} />
          </ChartCard>

          <ChartCard title="Order Status" subtitle="All active orders by stage">
            <OrderStatusDonut data={statusDist} />
          </ChartCard>
        </div>

        <div className="admin-chart-grid-secondary">
          <ChartCard title="Top Products" subtitle={`By units sold · last ${rangeDays} days`} loading={analyticsLoading}>
            <TopProductsChart data={topProducts} />
          </ChartCard>

          <ChartCard title="Top Cities" subtitle={`By revenue · last ${rangeDays} days`} loading={analyticsLoading}>
            <TopCitiesChart data={topCities} />
          </ChartCard>
        </div>
      </section>

      <div className="admin-dashboard-panel-grid admin-animate-in">
        <SectionCard title="Low Stock" action={<Link href="/admin/products" className="admin-link">Manage</Link>}>
          {(operations.inventory?.lowStock || []).length > 0 ? (
            <div className="admin-inline-list">
              {operations.inventory.lowStock.map((variant, index) => (
                <div key={variant._id || variant.sku || index} className="admin-row">
                  <div className="admin-row-main">
                    <div className="admin-row-title">{variant.product?.name || 'Product'}</div>
                    <div className="admin-row-meta">{variant.weight || variant.sku || 'Variant'}</div>
                  </div>
                  <span className={`admin-badge ${variant.stock <= 0 ? 'badge-failed' : 'badge-warning'}`}>
                    {variant.stock}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel message="No low-stock variants" />
          )}
        </SectionCard>

        <SectionCard title="Refund Queue" action={<Link href="/admin/refunds" className="admin-link">Open</Link>}>
          {(operations.refunds?.queue || []).length > 0 ? (
            <div className="admin-inline-list">
              {operations.refunds.queue.map((refund) => (
                <div key={refund._id} className="admin-row">
                  <div className="admin-row-main">
                    <div className="admin-row-title">#{refund.order?.orderNumber || 'Order'}</div>
                    <div className="admin-row-meta">{formatDateTime(refund.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="admin-row-value">{formatPrice(refund.amount || 0)}</span>
                    <StatusBadge status={refund.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel message="No refunds waiting" />
          )}
        </SectionCard>

        <SectionCard title="Open Alerts" action={<Link href="/admin/notifications" className="admin-link">Review</Link>}>
          {(operations.alerts?.recent || []).length > 0 ? (
            <div className="admin-inline-list">
              {operations.alerts.recent.map((alert) => (
                <div key={alert._id} className="admin-row">
                  <div className="admin-row-main">
                    <div className="admin-row-title">{alert.type}</div>
                    <div className="admin-row-meta">{alert.message}</div>
                  </div>
                  <StatusBadge status={alert.severity} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel message="No open operational alerts" />
          )}
        </SectionCard>

        <SectionCard title="Coupon Usage" action={<HiOutlineTicket style={{ color: 'var(--admin-accent-hover)' }} />}>
          {(operations.coupons?.top || []).length > 0 ? (
            <div className="admin-inline-list">
              {operations.coupons.top.slice(0, 6).map((coupon) => {
                const usageLimit = coupon.usageLimit || 0;
                const percent = usageLimit > 0 ? Math.min(100, Math.round((coupon.usageCount / usageLimit) * 100)) : 0;
                return (
                  <div key={coupon._id}>
                    <div className="admin-row" style={{ marginBottom: '0.35rem' }}>
                      <span className="admin-row-title">{coupon.code}</span>
                      <span className="admin-row-meta" style={{ whiteSpace: 'nowrap' }}>
                        {coupon.usageCount || 0}{usageLimit > 0 ? ` / ${usageLimit}` : ''}
                      </span>
                    </div>
                    {usageLimit > 0 && (
                      <div className="admin-progress">
                        <div
                          className="admin-progress-bar"
                          style={{
                            width: `${percent}%`,
                            background: percent >= 80 ? 'var(--admin-warning)' : 'var(--admin-info)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyPanel message="No coupon usage yet" />
          )}
        </SectionCard>
      </div>

      <div className="admin-card admin-section-animate">
        <div className="admin-section-heading">
          <h3>Recent Orders</h3>
          <Link href="/admin/orders" className="admin-link">View all</Link>
        </div>

        {recentOrders.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
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
                  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : 0;
                  const isNew = createdAt > 0 && (Date.now() - createdAt) < 60 * 60 * 1000;
                  const customerName = order.user?.name || order.guestInfo?.name || order.shippingAddress?.fullName || '-';
                  return (
                    <tr key={order._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <Link href={`/admin/orders/${order._id}`} className="admin-table-action-link">
                            #{order.orderNumber}
                          </Link>
                          {isNew && <span className="admin-pill admin-pill-success">New</span>}
                          {order.source === 'inquiry' && <span className="admin-pill admin-pill-guest">From Inquiry</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{customerName}</span>
                          {!order.user && <span className="admin-pill admin-pill-guest">Guest</span>}
                        </div>
                        <div className="admin-row-meta">{formatDateTime(order.createdAt)}</div>
                      </td>
                      <td style={{ maxWidth: 180 }}>
                        {firstItem ? (
                          <div>
                            <div className="admin-row-title">{firstItem.name}</div>
                            <div className="admin-row-meta">
                              {firstItem.weight}{order.items?.length > 1 ? ` +${order.items.length - 1}` : ''}
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--admin-text-secondary)' }}>
                        {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                      </td>
                      <td className="admin-row-value">{formatPrice(order.total || 0)}</td>
                      <td><StatusBadge status={order.status} /></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                          <span className={`admin-payment-chip ${order.paymentMethod === 'cod' ? 'admin-payment-chip-cod' : 'admin-payment-chip-online'}`}>
                            {order.paymentMethod === 'cod' ? 'COD' : 'Online'}
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
          <EmptyPanel message="No orders yet" />
        )}
      </div>
    </div>
  );
}
