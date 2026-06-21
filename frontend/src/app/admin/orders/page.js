'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineMapPin,
  HiOutlineXMark,
  HiOutlineCalendarDays,
  HiOutlineEye,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlineTruck,
} from 'react-icons/hi2';
import adminApi, { formatPrice, formatDateTime, ORDER_STATUSES, PAYMENT_STATUSES } from '@/lib/adminApi';
import { StatusBadge, Pagination, LoadingSkeleton, EmptyState, RefreshButton, AdminModal, AdminToast, useAdminToast } from '@/components/admin/AdminUI';
import AdminCombobox from '@/components/admin/AdminCombobox';
import AdminDateRangePicker from '@/components/admin/AdminDateRangePicker';

const STATUS_LABELS = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  packed: 'Packed', dispatched: 'Dispatched', out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded',
};

// Professional status hues — mirror the StatusBadge palette in admin.css.
const STATUS_HEX = {
  pending: '#FBBF24', confirmed: '#60A5FA', preparing: '#A5B4FC', packed: '#7DD3FC',
  dispatched: '#5EEAD4', out_for_delivery: '#5EEAD4', delivered: '#4ADE80',
  completed: '#4ADE80', cancelled: '#F87171', refunded: '#E879F9', expired: '#F87171', failed: '#F87171',
};
const statusHex = (s) => STATUS_HEX[s] || '#9BA4B5';

const UNPAID_ONLINE_ALLOWED_STATUSES = new Set(['cancelled']);

const fmtLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const titleCase = (v = '') => v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Delivery-address modal (icons instead of emoji).
function AddressModal({ order, onClose }) {
  if (!order) return null;
  const addr = order.shippingAddress || {};
  const customer = order.user?.name || order.guestInfo?.name || addr.fullName || '—';
  const email = order.user?.email || order.guestInfo?.email || '';
  const phone = order.user?.phone || order.guestInfo?.phone || addr.phone || '';

  return (
    <AdminModal open={!!order} title={`Delivery Address — #${order.orderNumber}`} onClose={onClose} width={420}>
      <div className="admin-addr">
        <div className="admin-addr-block">
          <div className="admin-addr-name">{customer}</div>
          {email && <div className="admin-addr-line"><HiOutlineEnvelope aria-hidden /> {email}</div>}
          {phone && <div className="admin-addr-line"><HiOutlinePhone aria-hidden /> {phone}</div>}
          {!order.user && <span className="admin-pill admin-pill-guest" style={{ marginTop: '0.35rem' }}>Guest</span>}
        </div>

        {addr.fullName || addr.addressLine1 ? (
          <div className="admin-addr-block">
            <div className="admin-addr-name">{addr.fullName}</div>
            {addr.phone && <div className="admin-addr-line"><HiOutlinePhone aria-hidden /> {addr.phone}</div>}
            <div style={{ marginTop: '0.25rem', color: 'var(--admin-text-secondary)' }}>{addr.addressLine1}</div>
            {addr.addressLine2 && <div style={{ color: 'var(--admin-text-secondary)' }}>{addr.addressLine2}</div>}
            {addr.area && <div className="admin-addr-line"><HiOutlineMapPin aria-hidden /> {addr.area}</div>}
            {addr.landmark && <div className="admin-addr-muted">Landmark: {addr.landmark}</div>}
            <div className="admin-addr-name" style={{ marginTop: '0.375rem' }}>
              {addr.city}{addr.state ? `, ${addr.state}` : ''} — {addr.pincode}
            </div>
          </div>
        ) : (
          <div className="admin-addr-muted" style={{ textAlign: 'center', padding: '1rem' }}>No address on file</div>
        )}

        {(order.deliveryDate || order.deliverySlot) && (
          <div className="admin-addr-schedule">
            <HiOutlineTruck aria-hidden /> Deliver on{' '}
            <strong>
              {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            </strong>
            {(order.deliverySlot?.label || order.deliverySlot?.startTime) && (
              <> &nbsp;·&nbsp; {order.deliverySlot.label || `${order.deliverySlot.startTime}–${order.deliverySlot.endTime}`}</>
            )}
          </div>
        )}

        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Link href={`/admin/orders/${order._id}`} className="admin-link">View full order →</Link>
        </div>
      </div>
    </AdminModal>
  );
}

// Inline quick-status <select>, tinted by the current status.
function QuickStatus({ order, saving, onChange }) {
  const isUnpaidOnline = order.paymentMethod === 'online' && order.paymentStatus !== 'paid';
  if (saving) return <span className="admin-quick-saving">Saving…</span>;
  const hex = statusHex(order.status);
  return (
    <select
      className="admin-status-select"
      value={order.status}
      onChange={(e) => onChange(order, e.target.value)}
      title="Change order status"
      style={{ borderColor: `${hex}66`, color: hex }}
    >
      {ORDER_STATUSES.map((s) => (
        <option key={s} value={s} disabled={isUnpaidOnline && !UNPAID_ONLINE_ALLOWED_STATUSES.has(s)}>
          {STATUS_LABELS[s] || s}
        </option>
      ))}
    </select>
  );
}

function PaymentChip({ method }) {
  if (method !== 'cod' && method !== 'online') return <span className="admin-row-meta">—</span>;
  return (
    <span className={`admin-payment-chip ${method === 'cod' ? 'admin-payment-chip-cod' : 'admin-payment-chip-online'}`}>
      {method === 'cod' ? 'COD' : 'Online'}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: '', paymentStatus: '', orderNumber: '', city: '', branchId: '', from: '', to: '' });
  const [cities, setCities] = useState([]);
  const [branches, setBranches] = useState([]);
  const [quickSaving, setQuickSaving] = useState({});
  const [addressOrder, setAddressOrder] = useState(null);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filters.status) params.status = filters.status;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.orderNumber) params.orderNumber = filters.orderNumber;
      if (filters.city) params.city = filters.city;
      if (filters.branchId) params.branchId = filters.branchId;
      if (filters.from && filters.to) { params.from = filters.from; params.to = filters.to; }
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

  useEffect(() => {
    let active = true;
    Promise.all([
      adminApi.delivery.getZones(),
      adminApi.delivery.getBranches().catch(() => ({ data: { data: [] } })),
    ])
      .then(([zonesRes, branchesRes]) => {
        if (!active) return;
        setCities(Array.from(new Set((zonesRes.data.data || []).map((zone) => zone.city).filter(Boolean))).sort());
        setBranches((branchesRes.data.data || []).filter((b) => b.isActive !== false));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleQuickStatus = async (order, newStatus) => {
    if (newStatus === order.status) return;
    setQuickSaving((prev) => ({ ...prev, [order._id]: true }));
    setOrders((prev) => prev.map((o) => (o._id === order._id ? { ...o, status: newStatus } : o)));
    try {
      await adminApi.orders.updateStatus(order._id, newStatus, '');
      showToast(`Order #${order.orderNumber} → "${STATUS_LABELS[newStatus]}"`, 'success');
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o._id === order._id ? { ...o, status: order.status } : o)));
      showToast(err.response?.data?.message || 'Status update failed', 'error');
    } finally {
      setQuickSaving((prev) => { const n = { ...prev }; delete n[order._id]; return n; });
    }
  };

  const setFilter = useCallback((patch) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); }, []);

  const cityOptions = useMemo(() => cities.map((c) => ({ value: c, label: c })), [cities]);
  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b._id, label: b.code ? `${b.name} (${b.code})` : b.name })),
    [branches],
  );
  const paymentOptions = useMemo(() => PAYMENT_STATUSES.map((s) => ({ value: s, label: titleCase(s) })), []);

  const hasFilters = filters.status || filters.paymentStatus || filters.orderNumber || filters.city || filters.branchId || filters.from || filters.to;

  // Per-order view data shared by the desktop table + mobile cards.
  const view = useMemo(() => orders.map((order) => {
    const firstItem = order.items?.[0];
    const moreItems = (order.items?.length || 1) - 1;
    const customerName = order.user?.name || order.guestInfo?.name || order.shippingAddress?.fullName || '—';
    return {
      order,
      id: order._id,
      orderNumber: order.orderNumber,
      href: `/admin/orders/${order._id}`,
      isNew: (Date.now() - new Date(order.createdAt).getTime()) < 60 * 60 * 1000,
      fromInquiry: order.source === 'inquiry',
      isGuest: !order.user,
      customerName,
      initial: (customerName || '?').trim().charAt(0).toUpperCase() || '?',
      contact: order.user?.email || order.guestInfo?.email || order.user?.phone || order.guestInfo?.phone || '',
      itemName: firstItem?.name || null,
      itemMeta: firstItem
        ? `${firstItem.weight || ''} · Qty ${firstItem.quantity}${firstItem.flavor ? ` · ${firstItem.flavor}` : ''}`
        : '',
      moreItems,
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—',
      deliverySlot: order.deliverySlot?.label || order.deliverySlot?.startTime || '',
      total: formatPrice(order.total),
      createdAtLabel: formatDateTime(order.createdAt),
    };
  }), [orders]);

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />
      <AddressModal order={addressOrder} onClose={() => setAddressOrder(null)} />

      <div className="admin-page-header admin-sales-header">
        <div className="admin-page-heading">
          <div className="admin-page-kicker">Operations</div>
          <h1 className="admin-page-title admin-title-gradient">
            Orders
            {total > 0 && <span className="admin-count-badge">{total.toLocaleString('en-IN')}</span>}
          </h1>
          <div className="admin-page-subtitle">Track, filter, and update fulfillment across every order.</div>
        </div>
        <div className="admin-page-actions">
          {filters.from && filters.to && (
            <span className="admin-range-pill">
              <HiOutlineCalendarDays aria-hidden />
              {filters.from} – {filters.to}
            </span>
          )}
          <RefreshButton onRefresh={fetchOrders} />
        </div>
      </div>

      {/* Status filter chips */}
      <div className="admin-chip-row" role="group" aria-label="Filter by status">
        {['', ...ORDER_STATUSES].map((s) => {
          const activeChip = filters.status === s;
          const hex = s ? statusHex(s) : 'var(--admin-accent-hover)';
          return (
            <button
              key={s || 'all'}
              type="button"
              className={`admin-chip ${activeChip ? 'active' : ''}`}
              onClick={() => setFilter({ status: s })}
              aria-pressed={activeChip}
              style={activeChip ? { color: s ? hex : '#fff', borderColor: s ? `${hex}66` : 'transparent', background: s ? `${hex}22` : 'var(--admin-accent)' } : undefined}
            >
              {s ? titleCase(s) : 'All'}
            </button>
          );
        })}
      </div>

      {/* Premium filter panel */}
      <div className="admin-card admin-filter-panel">
        <div className="admin-filter-panel-head">
          <div className="admin-filter-panel-title">
            <HiOutlineFunnel aria-hidden />
            <span>Filters</span>
          </div>
          <div className="admin-filter-chips" />
          {hasFilters && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm admin-filter-reset"
              onClick={() => { setFilters({ status: '', paymentStatus: '', orderNumber: '', city: '', branchId: '', from: '', to: '' }); setPage(1); }}
            >
              <HiOutlineXMark aria-hidden /> Clear
            </button>
          )}
        </div>

        <div className="admin-filter-panel-fields">
          <div className="admin-filter-field">
            <span className="admin-filter-label">Search</span>
            <div className="admin-search-field">
              <HiOutlineMagnifyingGlass aria-hidden />
              <input
                className="admin-search-input"
                placeholder="Order number…"
                value={filters.orderNumber}
                onChange={(e) => setFilter({ orderNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-filter-field">
            <span className="admin-filter-label">Payment</span>
            <AdminCombobox
              ariaLabel="Filter by payment status"
              value={filters.paymentStatus}
              onChange={(paymentStatus) => setFilter({ paymentStatus })}
              options={paymentOptions}
              emptyLabel="All Payments"
              placeholder="All Payments"
              searchPlaceholder="Search…"
            />
          </div>

          {branchOptions.length > 0 && (
            <div className="admin-filter-field">
              <span className="admin-filter-label">Branch</span>
              <AdminCombobox
                ariaLabel="Filter by branch"
                value={filters.branchId}
                onChange={(branchId) => setFilter({ branchId })}
                options={branchOptions}
                emptyLabel="All Branches"
                placeholder="All Branches"
                searchPlaceholder="Search branches…"
                leadingIcon={<HiOutlineMapPin aria-hidden />}
              />
            </div>
          )}

          <div className="admin-filter-field">
            <span className="admin-filter-label">City</span>
            <AdminCombobox
              ariaLabel="Filter by city"
              value={filters.city}
              onChange={(city) => setFilter({ city })}
              options={cityOptions}
              emptyLabel="All Cities"
              placeholder="All Cities"
              searchPlaceholder="Search cities…"
              leadingIcon={<HiOutlineMapPin aria-hidden />}
            />
          </div>

          <div className="admin-filter-field">
            <span className="admin-filter-label">Order date</span>
            <AdminDateRangePicker
              from={filters.from}
              to={filters.to}
              max={fmtLocal(new Date())}
              onChange={({ from, to }) => setFilter({ from, to })}
            />
          </div>
        </div>
      </div>

      <div className="admin-card admin-orders-panel" style={{ padding: 0 }}>
        {loading ? (
          <LoadingSkeleton rows={10} cols={7} />
        ) : view.length === 0 ? (
          <EmptyState message="No orders found" />
        ) : (
          <>
            {/* Desktop table */}
            <div className="admin-table-wrap admin-orders-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Delivery</th>
                    <th className="admin-num">Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className="admin-order-num-cell">
                          <Link href={v.href} className="admin-table-action-link">#{v.orderNumber}</Link>
                          {v.isNew && <span className="admin-pill admin-pill-success">New</span>}
                          {v.fromInquiry && <span className="admin-pill admin-pill-guest">From Inquiry</span>}
                        </div>
                      </td>
                      <td>
                        <div className="admin-cust">
                          <span className="admin-cust-avatar" aria-hidden>{v.initial}</span>
                          <div className="admin-cust-info">
                            <div className="admin-cust-name">
                              {v.customerName}
                              {v.isGuest && <span className="admin-pill admin-pill-guest">Guest</span>}
                            </div>
                            {v.contact && <div className="admin-row-meta">{v.contact}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        {v.itemName && (
                          <div>
                            <div className="admin-row-title admin-ellipsis">{v.itemName}</div>
                            <div className="admin-row-meta">
                              {v.itemMeta}
                              {v.moreItems > 0 && <span style={{ color: 'var(--admin-accent-hover)' }}> +{v.moreItems} more</span>}
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem' }}>{v.deliveryDate}</div>
                        <div className="admin-row-meta">{v.deliverySlot || '—'}</div>
                      </td>
                      <td className="admin-num admin-row-value">{v.total}</td>
                      <td>
                        <QuickStatus order={v.order} saving={!!quickSaving[v.id]} onChange={handleQuickStatus} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                          <PaymentChip method={v.order.paymentMethod} />
                          <StatusBadge status={v.order.paymentStatus} />
                        </div>
                      </td>
                      <td className="admin-row-meta" style={{ whiteSpace: 'nowrap' }}>{v.createdAtLabel}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                          <button
                            className="admin-btn admin-btn-ghost admin-btn-sm"
                            onClick={() => setAddressOrder(v.order)}
                            title="View delivery address"
                          >
                            <HiOutlineMapPin aria-hidden /> Address
                          </button>
                          <Link href={v.href} className="admin-btn admin-btn-ghost admin-btn-sm" style={{ textDecoration: 'none' }}>
                            <HiOutlineEye aria-hidden /> Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="admin-orders-cards" style={{ padding: '1rem' }}>
              {view.map((v) => (
                <div key={v.id} className="admin-order-card admin-order-card-static">
                  <div className="admin-order-card-row">
                    <div className="admin-order-num-cell">
                      <Link href={v.href} className="admin-order-card-num">#{v.orderNumber}</Link>
                      {v.isNew && <span className="admin-pill admin-pill-success">New</span>}
                      {v.fromInquiry && <span className="admin-pill admin-pill-guest">Inquiry</span>}
                    </div>
                    <span className="admin-order-card-total">{v.total}</span>
                  </div>

                  <div className="admin-cust">
                    <span className="admin-cust-avatar" aria-hidden>{v.initial}</span>
                    <div className="admin-cust-info">
                      <div className="admin-cust-name">
                        {v.customerName}
                        {v.isGuest && <span className="admin-pill admin-pill-guest">Guest</span>}
                      </div>
                      {v.contact && <div className="admin-row-meta">{v.contact}</div>}
                    </div>
                  </div>

                  {v.itemName && (
                    <div className="admin-order-card-product">
                      <span className="admin-row-title">{v.itemName}</span>
                      <span className="admin-row-meta">
                        {v.itemMeta}{v.moreItems > 0 ? ` · +${v.moreItems} more` : ''}
                      </span>
                    </div>
                  )}

                  <div className="admin-order-card-foot">
                    <QuickStatus order={v.order} saving={!!quickSaving[v.id]} onChange={handleQuickStatus} />
                    <PaymentChip method={v.order.paymentMethod} />
                    <StatusBadge status={v.order.paymentStatus} />
                    <span className="admin-order-card-delivery">Deliver {v.deliveryDate}</span>
                  </div>

                  <div className="admin-order-card-actions">
                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setAddressOrder(v.order)}>
                      <HiOutlineMapPin aria-hidden /> Address
                    </button>
                    <Link href={v.href} className="admin-btn admin-btn-secondary admin-btn-sm" style={{ textDecoration: 'none' }}>
                      <HiOutlineEye aria-hidden /> Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '0 1rem 0.5rem' }}>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
