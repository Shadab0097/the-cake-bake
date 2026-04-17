'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import adminApi, { formatPrice, formatDate } from '@/lib/adminApi';
import { StatusBadge } from '@/components/admin/AdminUI';
import { HiOutlineArrowLeft } from 'react-icons/hi2';

export default function AdminCustomerDetailPage({ params }) {
  const { id } = use(params);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--admin-text-muted)' }}>Loyalty</span><span>{user?.loyaltyPoints || 0} pts</span></div>
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
