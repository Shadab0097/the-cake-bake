'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import adminApi, { formatPrice, formatDate } from '@/lib/adminApi';
import { StatusBadge } from '@/components/admin/AdminUI';
import { HiOutlineArrowLeft, HiOutlineSparkles } from 'react-icons/hi2';

export default function AdminCustomerDetailPage({ params }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Points adjustment
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjPoints, setAdjPoints] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjMsg, setAdjMsg] = useState(null);

  useEffect(() => {
    adminApi.customers.get(id)
      .then(res => setCustomer(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="admin-loading"><div className="admin-spinner" /></div>;
  if (!customer) return <div className="admin-empty">Customer not found</div>;

  // Backend returns { customer, orders } (see admin.service.js getCustomerDetail)
  const user = customer.customer || customer.user || customer;
  const orders = customer.orders || [];
  const stats = customer.stats || {};

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => router.push('/admin/customers')} className="admin-btn admin-btn-ghost admin-btn-icon"><HiOutlineArrowLeft /></button>
        <h1 style={{ margin: 0 }}>Customer Details</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
        {/* Profile */}
        <div className="admin-card">
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #D81B60, #F06292)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: '1.5rem', margin: '0 auto 0.75rem' }}>
              {(user?.name || '?').charAt(0).toUpperCase()}
            </div>
            <h3 style={{ margin: '0 0 0.25rem' }}>{user?.name || '—'}</h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{user?.email}</div>
          </div>
          <div className="admin-divider" />
          <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--admin-text-muted)' }}>Phone</span><span>{user?.phone || '—'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--admin-text-muted)' }}>Role</span><span style={{ textTransform: 'capitalize' }}>{user?.role || 'customer'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--admin-text-muted)' }}>Verified</span><span>{user?.isVerified ? '✓ Yes' : '✕ No'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--admin-text-muted)' }}>Loyalty</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>{user?.loyaltyPoints || 0}</strong> pts
                <button
                  onClick={() => { setShowAdjust(!showAdjust); setAdjMsg(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--admin-primary)' }}
                  title="Adjust points"
                >
                  <HiOutlineSparkles size={16} />
                </button>
              </span>
            </div>
            {showAdjust && (
              <div style={{ background: 'var(--admin-card-alt, #f8f8f8)', borderRadius: '0.5rem', padding: '0.75rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="number"
                    value={adjPoints}
                    onChange={(e) => setAdjPoints(e.target.value)}
                    placeholder="+50 or -20"
                    style={{ flex: 1, padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--admin-border)', fontSize: '0.8125rem' }}
                  />
                </div>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Reason (e.g. Birthday bonus)"
                  style={{ width: '100%', padding: '0.375rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--admin-border)', fontSize: '0.8125rem', marginBottom: '0.5rem', boxSizing: 'border-box' }}
                />
                <button
                  className="admin-btn admin-btn-sm"
                  disabled={!adjPoints || !adjReason.trim() || adjLoading}
                  onClick={async () => {
                    setAdjLoading(true);
                    setAdjMsg(null);
                    try {
                      const res = await adminApi.customers.adjustPoints(id, { points: parseInt(adjPoints, 10), reason: adjReason.trim() });
                      const newBal = res.data?.data?.loyaltyPoints;
                      setAdjMsg({ type: 'ok', text: `Done! New balance: ${newBal} pts` });
                      // Update local state
                      setCustomer((prev) => {
                        const c = { ...prev };
                        if (c.customer) c.customer = { ...c.customer, loyaltyPoints: newBal };
                        return c;
                      });
                      setAdjPoints(''); setAdjReason('');
                    } catch (err) {
                      setAdjMsg({ type: 'err', text: err.response?.data?.message || 'Failed' });
                    } finally {
                      setAdjLoading(false);
                    }
                  }}
                  style={{ width: '100%' }}
                >
                  {adjLoading ? 'Saving…' : 'Adjust Points'}
                </button>
                {adjMsg && (
                  <p style={{ fontSize: '0.75rem', marginTop: '0.375rem', color: adjMsg.type === 'ok' ? 'var(--admin-success, #22c55e)' : 'var(--admin-error, #ef4444)' }}>
                    {adjMsg.text}
                  </p>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--admin-text-muted)' }}>Joined</span><span>{formatDate(user?.createdAt)}</span></div>
          </div>
          {stats.totalSpent != null && (
            <>
              <div className="admin-divider" />
              <div style={{ fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--admin-text-muted)' }}>Total Spent</span><span style={{ fontWeight: 600 }}>{formatPrice(stats.totalSpent)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--admin-text-muted)' }}>Total Orders</span><span>{stats.totalOrders || 0}</span></div>
              </div>
            </>
          )}
        </div>

        {/* Orders */}
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Recent Orders</h3>
          {orders.length === 0 ? <div className="admin-empty" style={{ padding: '2rem' }}>No orders yet</div> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Order #</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td style={{ fontWeight: 500 }}>{o.orderNumber}</td>
                      <td>{formatPrice(o.total)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) { div[style*="grid-template-columns: 300px"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
