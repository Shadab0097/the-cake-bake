'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import adminApi, { formatPrice, formatDateTime, ORDER_STATUSES, PAYMENT_STATUSES } from '@/lib/adminApi';
import { StatusBadge, Pagination, LoadingSkeleton, EmptyState, RefreshButton, AdminModal, AdminToast, useAdminToast } from '@/components/admin/AdminUI';

const STATUS_COLORS = {
  pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6',
  packed: '#06b6d4', dispatched: '#f97316', out_for_delivery: '#10b981',
  delivered: '#22c55e', cancelled: '#ef4444', refunded: '#6b7280',
};

const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  packed: 'Packed', dispatched: 'Dispatched', out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
};

const STATUS_ICON = {
  pending: '🕐', confirmed: '✅', preparing: '🎂', packed: '📦',
  dispatched: '🚚', out_for_delivery: '🛵', delivered: '🎉',
  cancelled: '❌', refunded: '💸',
};

// Small address modal content
function AddressModal({ order, onClose }) {
  if (!order) return null;
  const addr = order.shippingAddress || {};
  const customer = order.user?.name || order.guestInfo?.name || addr.fullName || '—';
  const email = order.user?.email || order.guestInfo?.email || '';
  const phone = order.user?.phone || order.guestInfo?.phone || addr.phone || '';

  return (
    <AdminModal open={!!order} title={`📍 Delivery Address — #${order.orderNumber}`} onClose={onClose} width={420}>
      <div style={{ fontSize: '0.875rem', lineHeight: 1.85 }}>
        {/* Customer */}
        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
          <div style={{ fontWeight: 700, color: 'var(--admin-text)', marginBottom: '0.125rem' }}>{customer}</div>
          {email && <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.8rem' }}>✉ {email}</div>}
          {phone && <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.8rem' }}>📱 {phone}</div>}
          {!order.user && (
            <span style={{ display: 'inline-block', marginTop: '0.25rem', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: 20, background: '#8b5cf6', color: '#fff', letterSpacing: '0.04em' }}>GUEST</span>
          )}
        </div>

        {/* Address */}
        {addr.fullName || addr.addressLine1 ? (
          <div style={{ padding: '0.75rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
            <div style={{ fontWeight: 600, color: 'var(--admin-text)', marginBottom: '0.25rem' }}>{addr.fullName}</div>
            {addr.phone && <div>📱 {addr.phone}</div>}
            <div style={{ marginTop: '0.25rem' }}>{addr.addressLine1}</div>
            {addr.addressLine2 && <div>{addr.addressLine2}</div>}
            {addr.area && <div>📍 {addr.area}</div>}
            {addr.landmark && (
              <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.8rem', marginTop: '0.125rem' }}>
                📌 Landmark: {addr.landmark}
              </div>
            )}
            <div style={{ fontWeight: 600, color: 'var(--admin-text)', marginTop: '0.375rem' }}>
              {addr.city}{addr.state ? `, ${addr.state}` : ''} — {addr.pincode}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>
            No address on file
          </div>
        )}

        {/* Delivery schedule summary */}
        {(order.deliveryDate || order.deliverySlot) && (
          <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', background: 'var(--admin-accent-soft)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid rgba(216,27,96,0.2)', fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
            🚚 Deliver on{' '}
            <strong style={{ color: 'var(--admin-text)' }}>
              {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </strong>
            {(order.deliverySlot?.label || order.deliverySlot?.startTime) && (
              <> &nbsp;·&nbsp; {order.deliverySlot.label || `${order.deliverySlot.startTime}–${order.deliverySlot.endTime}`}</>
            )}
          </div>
        )}

        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Link
            href={`/admin/orders/${order._id}`}
            style={{ fontSize: '0.8125rem', color: 'var(--admin-accent-hover)', textDecoration: 'none', fontWeight: 500 }}
          >
            View full order →
          </Link>
        </div>
      </div>
    </AdminModal>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: '', paymentStatus: '', orderNumber: '' });
  // inline quick-status: { [orderId]: true }
  const [quickSaving, setQuickSaving] = useState({});
  // address modal
  const [addressOrder, setAddressOrder] = useState(null);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filters.status) params.status = filters.status;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.orderNumber) params.orderNumber = filters.orderNumber;
      const res = await adminApi.orders.list(params);
      const d = res.data.data;
      setOrders(d.items || []);
      setTotalPages(d.pagination?.totalPages || 1);
      setTotal(d.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Inline quick-status update ─────────────────────────────
  const handleQuickStatus = async (order, newStatus) => {
    if (newStatus === order.status) return;
    setQuickSaving(prev => ({ ...prev, [order._id]: true }));
    // Optimistic update
    setOrders(prev => prev.map(o => o._id === order._id ? { ...o, status: newStatus } : o));
    try {
      await adminApi.orders.updateStatus(order._id, newStatus, '');
      showToast(`Order #${order.orderNumber} → "${STATUS_LABELS[newStatus]}"`, 'success');
    } catch (err) {
      // Roll back
      setOrders(prev => prev.map(o => o._id === order._id ? { ...o, status: order.status } : o));
      showToast(err.response?.data?.message || 'Status update failed', 'error');
    } finally {
      setQuickSaving(prev => { const n = { ...prev }; delete n[order._id]; return n; });
    }
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      {/* Address modal */}
      <AddressModal order={addressOrder} onClose={() => setAddressOrder(null)} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ margin: 0 }}>Orders</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)', background: 'var(--admin-surface)', padding: '0.25rem 0.75rem', borderRadius: 20, border: '1px solid var(--admin-border)' }}>{total} total orders</span>
          <RefreshButton onRefresh={fetchOrders} />
        </div>
      </div>

      {/* Quick status filter chips */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['', ...ORDER_STATUSES].map(s => (
          <button
            key={s || 'all'}
            onClick={() => { setFilters(f => ({ ...f, status: s })); setPage(1); }}
            style={{
              padding: '0.3rem 0.75rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500, border: 'none', cursor: 'pointer',
              background: filters.status === s ? (STATUS_COLORS[s] || 'var(--admin-accent)') : 'var(--admin-surface)',
              color: filters.status === s ? '#fff' : 'var(--admin-text-secondary)',
              border: `1px solid ${filters.status === s ? 'transparent' : 'var(--admin-border)'}`,
              textTransform: 'capitalize', transition: 'all 0.2s',
            }}
          >
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="admin-input"
          placeholder="🔍 Search order #..."
          value={filters.orderNumber}
          onChange={(e) => { setFilters(f => ({ ...f, orderNumber: e.target.value })); setPage(1); }}
          style={{ maxWidth: 200 }}
        />
        <select
          className="admin-input admin-select"
          value={filters.paymentStatus}
          onChange={(e) => { setFilters(f => ({ ...f, paymentStatus: e.target.value })); setPage(1); }}
          style={{ maxWidth: 170 }}
        >
          <option value="">All Payments</option>
          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filters.status || filters.paymentStatus || filters.orderNumber) && (
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setFilters({ status: '', paymentStatus: '', orderNumber: '' }); setPage(1); }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? <LoadingSkeleton rows={10} cols={7} /> : orders.length === 0 ? (
          <EmptyState message="No orders found" icon="📦" />
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Delivery</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const firstItem = order.items?.[0];
                    const moreItems = (order.items?.length || 1) - 1;
                    const isNew = (Date.now() - new Date(order.createdAt).getTime()) < 60 * 60 * 1000;
                    return (
                      <tr key={order._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <Link href={`/admin/orders/${order._id}`} style={{ color: 'var(--admin-accent-hover)', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>
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
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                            {order.user?.email || order.guestInfo?.email || order.user?.phone || order.guestInfo?.phone || ''}
                          </div>
                        </td>
                        <td style={{ maxWidth: 200 }}>
                          {firstItem && (
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                                {firstItem.name}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)' }}>
                                {firstItem.weight} · Qty {firstItem.quantity}
                                {firstItem.flavor ? ` · ${firstItem.flavor}` : ''}
                                {moreItems > 0 ? <span style={{ color: 'var(--admin-accent)' }}> +{moreItems} more</span> : ''}
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', whiteSpace: 'nowrap' }}>
                          <div>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</div>
                          <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.72rem' }}>{order.deliverySlot?.label || order.deliverySlot?.startTime || '—'}</div>
                        </td>
                        <td style={{ fontWeight: 700 }}>{formatPrice(order.total)}</td>

                        {/* ── Inline Quick-Status Cell ── */}
                        <td>
                          {quickSaving[order._id] ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Saving…</span>
                          ) : (
                            <select
                              value={order.status}
                              onChange={(e) => handleQuickStatus(order, e.target.value)}
                              title="Change order status"
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                padding: '0.25rem 0.5rem',
                                border: `2px solid ${STATUS_COLORS[order.status] || 'var(--admin-border)'}`,
                                borderRadius: 'var(--admin-radius-sm)',
                                background: 'var(--admin-surface)',
                                color: STATUS_COLORS[order.status] || 'var(--admin-text)',
                                cursor: 'pointer',
                                outline: 'none',
                                minWidth: 100,
                                paddingRight: '1.5rem',
                                // custom arrow color trick via background-image override
                                WebkitAppearance: 'none',
                                MozAppearance: 'none',
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239BA4B5' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 0.4rem center',
                              }}
                            >
                              {ORDER_STATUSES.map(s => (
                                <option key={s} value={s}>
                                  {STATUS_ICON[s]} {STATUS_LABELS[s] || s}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{
                              display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20,
                              background: order.paymentMethod === 'cod' ? 'rgba(217,119,6,0.12)' : 'rgba(59,130,246,0.12)',
                              color: order.paymentMethod === 'cod' ? '#d97706' : '#3b82f6',
                              border: `1px solid ${order.paymentMethod === 'cod' ? 'rgba(217,119,6,0.3)' : 'rgba(59,130,246,0.3)'}`,
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                            }}>
                              {order.paymentMethod === 'cod' ? '💵 COD' : order.paymentMethod === 'online' ? '💳 Online' : '—'}
                            </span>
                            <StatusBadge status={order.paymentStatus} />
                          </div>
                        </td>
                        <td style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {formatDateTime(order.createdAt)}
                        </td>

                        {/* ── Actions Cell ── */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {/* Address button */}
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              onClick={() => setAddressOrder(order)}
                              title="View delivery address"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                            >
                              📍 Address
                            </button>
                            {/* View detail link */}
                            <Link
                              href={`/admin/orders/${order._id}`}
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              style={{ textDecoration: 'none', textAlign: 'center', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            >
                              🔍 Details
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0 1rem' }}>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
