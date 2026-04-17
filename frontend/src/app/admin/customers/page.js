'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import adminApi, { formatDate } from '@/lib/adminApi';
import { Pagination, LoadingSkeleton, EmptyState, RefreshButton } from '@/components/admin/AdminUI';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (search) params.search = search;
      const res = await adminApi.customers.list(params);
      const d = res.data.data;
      setCustomers(d.items || []);
      setTotalPages(d.pagination?.totalPages || 1);
      setTotal(d.pagination?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Customers</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--admin-text-muted)' }}>{total} total</span>
          <RefreshButton onRefresh={fetch} />
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <input className="admin-input" placeholder="Search by name, email, or phone..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 320 }} />
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? <LoadingSkeleton rows={10} cols={5} /> : customers.length === 0 ? <EmptyState message="No customers found" icon="👥" /> : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Customer</th><th>Phone</th><th>Loyalty</th><th>Verified</th><th>Joined</th></tr></thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <Link href={`/admin/customers/${c._id}`} style={{ textDecoration: 'none' }}>
                          <div style={{ fontWeight: 500, color: 'var(--admin-accent-hover)' }}>{c.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{c.email}</div>
                        </Link>
                      </td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{c.phone || '—'}</td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{c.loyaltyPoints || 0} pts</td>
                      <td>{c.isVerified ? <span style={{ color: 'var(--admin-success)' }}>✓</span> : <span style={{ color: 'var(--admin-text-muted)' }}>—</span>}</td>
                      <td style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem' }}>{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0 1rem' }}><Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} /></div>
          </>
        )}
      </div>
    </div>
  );
}
