'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi, { formatDate } from '@/lib/adminApi';
import { Pagination, ConfirmDialog, AdminToast, useAdminToast, EmptyState, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filter) params.isApproved = filter;
      const res = await adminApi.reviews.list(params);
      const d = res.data.data;
      setReviews(d.items || []);
      setTotalPages(d.pagination?.totalPages || 1);
      setTotal(d.pagination?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleApprove = async (id) => {
    try {
      await adminApi.reviews.approve(id);
      showToast('Review approved');
      fetch();
    } catch (err) { showToast('Approve failed', 'error'); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await adminApi.reviews.delete(deleteId); showToast('Review deleted'); setDeleteId(null); fetch(); }
    catch (err) { showToast('Delete failed', 'error'); }
    finally { setDeleting(false); }
  };

  const renderStars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />
      <ConfirmDialog open={!!deleteId} title="Delete Review" message="This will permanently delete the review." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Reviews</h1>
        <RefreshButton onRefresh={fetch} />
      </div>

      <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <select className="admin-input admin-select" style={{ maxWidth: 180 }} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
          <option value="">All Reviews</option>
          <option value="true">Approved</option>
          <option value="false">Pending</option>
        </select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{total} reviews</span>
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? <LoadingSkeleton rows={8} cols={6} /> : reviews.length === 0 ? <EmptyState message="No reviews found" icon="⭐" /> : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Product</th><th>Customer</th><th>Rating</th><th>Comment</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r._id}>
                      <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.product?.name || '—'}</td>
                      <td>
                        <div style={{ fontSize: '0.875rem' }}>{r.user?.name || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{r.user?.email || ''}</div>
                      </td>
                      <td><span style={{ color: '#F59E0B', letterSpacing: '2px' }}>{renderStars(r.rating)}</span></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--admin-text-secondary)' }}>
                        {r.title ? <strong>{r.title}: </strong> : ''}{r.comment || '—'}
                      </td>
                      <td>
                        <span className={`admin-badge ${r.isApproved ? 'badge-active' : 'badge-pending'}`}>{r.isApproved ? 'Approved' : 'Pending'}</span>
                        {r.isVerified && <span style={{ fontSize: '0.6875rem', color: 'var(--admin-info)', marginLeft: '0.375rem' }}>✓ Verified</span>}
                      </td>
                      <td style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          {!r.isApproved && <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleApprove(r._id)}>Approve</button>}
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteId(r._id)}>Delete</button>
                        </div>
                      </td>
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
