'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import adminApi, { formatPrice, formatDate, formatDateTime, ORDER_STATUSES } from '@/lib/adminApi';
import { StatusBadge, AdminToast, useAdminToast } from '@/components/admin/AdminUI';
import { HiOutlineArrowLeft, HiOutlinePhone, HiOutlineMapPin, HiOutlineCalendarDays, HiOutlineClock, HiOutlineUser, HiOutlineCreditCard, HiOutlineTruck } from 'react-icons/hi2';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
const STATUS_COLOR = {
  pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6',
  packed: '#06b6d4', dispatched: '#f97316', out_for_delivery: '#10b981',
  delivered: '#22c55e', cancelled: '#ef4444', refunded: '#6b7280',
};
const STATUS_ICON = {
  pending: '🕐', confirmed: '✅', preparing: '🎂', packed: '📦',
  dispatched: '🚚', out_for_delivery: '🛵', delivered: '🎉',
  cancelled: '❌', refunded: '💸',
};

function InfoRow({ label, value, highlight }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', padding: '0.375rem 0', borderBottom: '1px solid var(--admin-border)' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: highlight ? 700 : 400, color: highlight ? 'var(--admin-text)' : 'var(--admin-text-secondary)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function AdminOrderDetailPage({ params }) {
  const { id } = use(params);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();
  const router = useRouter();

  const fetchOrder = useCallback(async () => {
    try {
      const res = await adminApi.orders.get(id);
      setOrder(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleStatusUpdate = async () => {
    if (!newStatus) return;
    setUpdating(true);
    try {
      await adminApi.orders.updateStatus(id, newStatus, statusNote);
      showToast(`Status updated to "${newStatus.replace(/_/g, ' ')}"`);
      setNewStatus('');
      setStatusNote('');
      fetchOrder();
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="admin-loading"><div className="admin-spinner" /></div>;
  if (!order) return <div className="admin-empty">Order not found</div>;

  const addr = order.shippingAddress || {};
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded';
  const currentIdx = STATUS_STEPS.indexOf(order.status);
  // Sort history newest-first
  const history = [...(order.statusHistory || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/admin/orders')} className="admin-btn admin-btn-ghost admin-btn-icon">
          <HiOutlineArrowLeft />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>Order #{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
            {order.paymentMethod === 'cod' && <span className="admin-badge" style={{ background: '#78350f22', color: '#d97706', border: '1px solid #d9770640' }}>COD</span>}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
            Placed on {formatDateTime(order.createdAt)}
          </div>
        </div>
      </div>

      {/* Progress Bar — only for non-cancelled orders */}
      {!isCancelled && (
        <div className="admin-card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            {/* Track line */}
            <div style={{ position: 'absolute', top: 16, left: 24, right: 24, height: 3, background: 'var(--admin-border)', borderRadius: 2, zIndex: 0 }} />
            <div style={{ position: 'absolute', top: 16, left: 24, height: 3, width: `${Math.max(0, (currentIdx / (STATUS_STEPS.length - 1)) * 100)}%`, background: 'linear-gradient(90deg, var(--admin-accent), #22c55e)', borderRadius: 2, zIndex: 1, transition: 'width 0.5s' }} />

            {STATUS_STEPS.map((s, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 2, flex: 1 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                    background: done ? (STATUS_COLOR[s] || 'var(--admin-accent)') : 'var(--admin-surface-hover)',
                    border: active ? `3px solid ${STATUS_COLOR[s]}` : `2px solid ${done ? STATUS_COLOR[s] : 'var(--admin-border)'}`,
                    boxShadow: active ? `0 0 0 4px ${STATUS_COLOR[s]}22` : 'none',
                    transition: 'all 0.3s',
                  }}>
                    {done ? STATUS_ICON[s] : '·'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: done ? 'var(--admin-text)' : 'var(--admin-text-muted)', fontWeight: active ? 700 : 400, textAlign: 'center', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                    {s.replace(/_/g, ' ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem' }} className="order-detail-grid">

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Items */}
          <div className="admin-card">
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>🎂 Order Items ({order.items?.length || 0})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {order.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
                  {/* Image */}
                  {item.image ? (
                    <img src={item.image} alt={item.name} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 8, background: 'var(--admin-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🎂</div>
                  )}

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{item.name || item.snapshotName}</div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.375rem' }}>
                      {item.weight && <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: 'var(--admin-surface-hover)', borderRadius: 20, color: 'var(--admin-text-secondary)' }}>⚖ {item.weight}</span>}
                      {item.flavor && <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: 'var(--admin-surface-hover)', borderRadius: 20, color: 'var(--admin-text-secondary)' }}>🍫 {item.flavor}</span>}
                      {item.isEggless && <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: '#14532d22', color: '#22c55e', borderRadius: 20 }}>🥚 Eggless</span>}
                      {item.quantity > 1 && <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: 'var(--admin-accent-soft)', color: 'var(--admin-accent)', borderRadius: 20 }}>× {item.quantity}</span>}
                    </div>

                    {item.cakeMessage && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', background: 'var(--admin-surface)', padding: '0.375rem 0.625rem', borderRadius: 6, borderLeft: '3px solid var(--admin-accent)', marginBottom: '0.375rem' }}>
                        🎂 Message: <em>"{item.cakeMessage}"</em>
                      </div>
                    )}

                    {/* Add-ons */}
                    {item.addOns?.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                        🧁 Add-ons: {item.addOns.map(a => typeof a === 'object' ? a.name : a).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{formatPrice(item.price * (item.quantity || 1))}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{formatPrice(item.price)} × {item.quantity || 1}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order totals */}
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
              <InfoRow label="Subtotal" value={formatPrice(order.subtotal)} />
              <InfoRow label="Delivery Charge" value={formatPrice(order.deliveryCharge)} />
              {order.discount > 0 && <InfoRow label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`} value={`−${formatPrice(order.discount)}`} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', marginTop: '0.25rem', borderTop: '2px solid var(--admin-border)' }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--admin-accent)' }}>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Status Timeline */}
          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>📋 Status Timeline</h3>
            {history.length === 0 ? (
              <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No history yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {history.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem', paddingBottom: i < history.length - 1 ? '1.25rem' : 0, position: 'relative' }}>
                    {/* Vertical line */}
                    {i < history.length - 1 && (
                      <div style={{ position: 'absolute', left: 15, top: 32, width: 2, bottom: 0, background: 'var(--admin-border)' }} />
                    )}
                    {/* Dot */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: i === 0 ? (STATUS_COLOR[h.status] || 'var(--admin-accent)') : 'var(--admin-surface-hover)',
                      border: `2px solid ${i === 0 ? (STATUS_COLOR[h.status] || 'var(--admin-accent)') : 'var(--admin-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', flexShrink: 0, zIndex: 1,
                    }}>
                      {STATUS_ICON[h.status] || '·'}
                    </div>
                    <div style={{ paddingTop: '0.25rem', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <StatusBadge status={h.status} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{formatDateTime(h.timestamp)}</span>
                      </div>
                      {h.note && <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', marginTop: '0.25rem', fontStyle: 'italic' }}>"{h.note}"</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Update Status */}
          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>⚡ Update Status</h3>
            <div className="admin-field">
              <label className="admin-label">New Status</label>
              <select className="admin-input admin-select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                <option value="">Select status...</option>
                {ORDER_STATUSES.map(s => (
                  <option key={s} value={s} disabled={s === order.status}>
                    {STATUS_ICON[s]} {s.replace(/_/g, ' ')} {s === order.status ? '(current)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Note (optional)</label>
              <input className="admin-input" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="e.g. Out for delivery via Swiggy" />
            </div>
            <button className="admin-btn admin-btn-primary" style={{ width: '100%' }} onClick={handleStatusUpdate} disabled={!newStatus || updating}>
              {updating ? 'Updating...' : 'Update Status'}
            </button>
          </div>

          {/* Customer Info */}
          <div className="admin-card">
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><HiOutlineUser /> Customer</h3>
            <div style={{ fontSize: '0.875rem', lineHeight: 1.8 }}>
              <div style={{ fontWeight: 600, color: 'var(--admin-text)', marginBottom: '0.25rem' }}>{order.user?.name || addr.fullName || '—'}</div>
              {order.user?.email && <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem' }}>✉ {order.user.email}</div>}
              {order.user?.phone && <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem' }}>📱 {order.user.phone}</div>}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="admin-card">
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><HiOutlineMapPin /> Delivery Address</h3>
            {addr.fullName ? (
              <div style={{ fontSize: '0.875rem', lineHeight: 1.75, color: 'var(--admin-text-secondary)' }}>
                <div style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{addr.fullName}</div>
                {addr.phone && <div>📱 {addr.phone}</div>}
                <div style={{ marginTop: '0.25rem' }}>{addr.addressLine1}</div>
                {addr.addressLine2 && <div>{addr.addressLine2}</div>}
                {addr.area && <div>📍 {addr.area}</div>}
                {addr.landmark && <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>Landmark: {addr.landmark}</div>}
                <div style={{ fontWeight: 500, color: 'var(--admin-text)', marginTop: '0.25rem' }}>{addr.city}{addr.state ? `, ${addr.state}` : ''}</div>
                <div>Pincode: <strong>{addr.pincode}</strong></div>
              </div>
            ) : <div style={{ color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No address info</div>}
          </div>

          {/* Delivery Schedule */}
          <div className="admin-card">
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><HiOutlineTruck /> Delivery Schedule</h3>
            <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HiOutlineCalendarDays style={{ color: 'var(--admin-accent)', flexShrink: 0 }} />
                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>Date:</span>
                <span style={{ fontWeight: 600 }}>{order.deliveryDate ? formatDate(order.deliveryDate) : '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HiOutlineClock style={{ color: 'var(--admin-accent)', flexShrink: 0 }} />
                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>Slot:</span>
                <span style={{ fontWeight: 500 }}>
                  {order.deliverySlot?.label ||
                   (order.deliverySlot?.startTime && order.deliverySlot?.endTime ? `${order.deliverySlot.startTime} – ${order.deliverySlot.endTime}` : '—')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HiOutlineMapPin style={{ color: 'var(--admin-accent)', flexShrink: 0 }} />
                <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>City:</span>
                <span>{order.deliveryCity || addr.city || '—'}</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="admin-card">
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><HiOutlineCreditCard /> Payment</h3>
            <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <InfoRow label="Method" value={order.paymentMethod === 'cod' ? '💵 Cash on Delivery' : '💳 Online'} />
              <InfoRow label="Status" value={<StatusBadge status={order.paymentStatus} />} />
              {order.paymentId?.razorpayOrderId && <InfoRow label="Razorpay Order" value={order.paymentId.razorpayOrderId} />}
              {order.paymentId?.razorpayPaymentId && <InfoRow label="Payment ID" value={order.paymentId.razorpayPaymentId} />}
              <InfoRow label="Amount" value={formatPrice(order.total)} highlight />
            </div>
          </div>

          {/* Special Instructions */}
          {(order.specialInstructions || order.isGift || order.giftMessage) && (
            <div className="admin-card">
              <h3 style={{ marginTop: 0 }}>🎁 Special Info</h3>
              {order.isGift && (
                <div style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.2)', borderRadius: 6, fontSize: '0.875rem', color: '#ec4899' }}>
                  🎁 Gift Order{order.giftMessage ? `: "${order.giftMessage}"` : ''}
                </div>
              )}
              {order.specialInstructions && (
                <div style={{ fontSize: '0.875rem', color: 'var(--admin-text-secondary)', background: 'var(--admin-bg)', padding: '0.5rem 0.75rem', borderRadius: 6, borderLeft: '3px solid var(--admin-accent)' }}>
                  📝 {order.specialInstructions}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .order-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
