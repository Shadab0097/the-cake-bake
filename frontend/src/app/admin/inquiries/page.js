'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi, { formatDate, INQUIRY_STATUSES } from '@/lib/adminApi';
import { Pagination, AdminModal, StatusBadge, AdminToast, useAdminToast, EmptyState, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';

// Status color map for the inline dropdown highlight
const STATUS_COLORS = {
  new: 'var(--admin-accent)',
  contacted: '#f59e0b',
  quoted: '#8b5cf6',
  confirmed: '#3b82f6',
  completed: 'var(--admin-success)',
  cancelled: 'var(--admin-danger)',
};

// Nicely-labelled status options
const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function AdminInquiriesPage() {
  const [tab, setTab] = useState('custom');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [editModal, setEditModal] = useState({ open: false, data: null });
  const [editForm, setEditForm] = useState({ status: '', adminNotes: '', quotedPrice: '' });
  const [saving, setSaving] = useState(false);
  // Track which row is currently saving a quick status update: { [id]: true }
  const [quickSaving, setQuickSaving] = useState({});
  const { toast, showToast, hideToast } = useAdminToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const res = tab === 'custom'
        ? await adminApi.inquiries.getCustom(params)
        : await adminApi.inquiries.getCorporate(params);
      const d = res.data.data;
      setItems(d.items || []);
      setTotalPages(d.pagination?.totalPages || 1);
      setTotal(d.pagination?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [tab, page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [tab]);

  // ── Full modal ──────────────────────────────────────────────
  const openEdit = (item) => {
    setEditForm({
      status: item.status || 'new',
      adminNotes: item.adminNotes || '',
      quotedPrice: item.quotedPrice || '',
    });
    setEditModal({ open: true, data: item });
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const data = { status: editForm.status, adminNotes: editForm.adminNotes };
      if (editForm.quotedPrice !== '' && editForm.quotedPrice !== undefined) {
        data.quotedPrice = Number(editForm.quotedPrice);
      }
      await adminApi.inquiries.update(editModal.data._id, data);
      showToast('Inquiry updated successfully', 'success');
      setEditModal({ open: false, data: null });
      // Optimistically update the item in the list
      setItems(prev => prev.map(i =>
        i._id === editModal.data._id
          ? { ...i, status: data.status, adminNotes: data.adminNotes, quotedPrice: data.quotedPrice ?? i.quotedPrice }
          : i
      ));
    } catch (err) { showToast(err.response?.data?.message || 'Update failed', 'error'); }
    finally { setSaving(false); }
  };

  // ── Inline quick-status update ───────────────────────────────
  const handleQuickStatus = async (item, newStatus) => {
    if (newStatus === item.status) return;
    setQuickSaving(prev => ({ ...prev, [item._id]: true }));
    // Optimistically update the item locally
    setItems(prev => prev.map(i => i._id === item._id ? { ...i, status: newStatus } : i));
    try {
      await adminApi.inquiries.update(item._id, { status: newStatus });
      showToast(`Status updated to "${STATUS_LABELS[newStatus]}"`, 'success');
    } catch (err) {
      // Roll back on error
      setItems(prev => prev.map(i => i._id === item._id ? { ...i, status: item.status } : i));
      showToast(err.response?.data?.message || 'Status update failed', 'error');
    } finally {
      setQuickSaving(prev => { const n = { ...prev }; delete n[item._id]; return n; });
    }
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Inquiries</h1>
        <RefreshButton onRefresh={fetchData} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
        <button className={`admin-btn ${tab === 'custom' ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setTab('custom')}>Custom Cake</button>
        <button className={`admin-btn ${tab === 'corporate' ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setTab('corporate')}>Corporate</button>
      </div>

      {/* Filter */}
      <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <select className="admin-input admin-select" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {INQUIRY_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
        </select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{total} inquiries</span>
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? <LoadingSkeleton rows={8} cols={6} /> : items.length === 0 ? (
          <EmptyState message="No inquiries found" icon="📩" />
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>{tab === 'corporate' ? 'Company' : 'Occasion'}</th>
                    <th>Contact</th>
                    <th>{tab === 'corporate' ? 'Event Type' : 'Flavor / Weight'}</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.name || item.contactPerson || item.contactName || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{item.email || ''}</div>
                      </td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>
                        {tab === 'corporate' ? (item.companyName || '—') : (item.occasion || '—')}
                      </td>
                      <td style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem' }}>{item.phone || '—'}</td>
                      <td style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem' }}>
                        {tab === 'corporate'
                          ? (item.eventType || '—')
                          : `${item.flavor || '—'} / ${item.weight || '—'}`}
                      </td>

                      {/* ── Inline Quick-Status Cell ── */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {quickSaving[item._id] ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Saving…</span>
                          ) : (
                            <select
                              value={item.status || 'new'}
                              onChange={(e) => handleQuickStatus(item, e.target.value)}
                              title="Change status"
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                padding: '0.25rem 0.5rem',
                                border: `2px solid ${STATUS_COLORS[item.status] || 'var(--admin-border)'}`,
                                borderRadius: 'var(--admin-radius-sm)',
                                background: 'var(--admin-surface)',
                                color: STATUS_COLORS[item.status] || 'var(--admin-text)',
                                cursor: 'pointer',
                                outline: 'none',
                                minWidth: 100,
                              }}
                            >
                              {INQUIRY_STATUSES.map(s => (
                                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      <td style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDate(item.createdAt)}</td>
                      <td>
                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openEdit(item)}>Manage</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0 1rem' }}>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* ── Full Edit Modal ── */}
      <AdminModal open={editModal.open} title="Manage Inquiry" onClose={() => setEditModal({ open: false, data: null })} width={570}>
        {editModal.data && (
          <>
            {/* Inquiry details */}
            <div style={{ background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', padding: '1rem', marginBottom: '1rem', fontSize: '0.8125rem', lineHeight: 1.8 }}>
              <div><strong>Name:</strong> {editModal.data.name || editModal.data.contactPerson || editModal.data.contactName}</div>
              <div><strong>Email:</strong> {editModal.data.email}</div>
              <div><strong>Phone:</strong> {editModal.data.phone}</div>
              {editModal.data.occasion && <div><strong>Occasion:</strong> {editModal.data.occasion}</div>}
              {editModal.data.flavor && <div><strong>Flavor:</strong> {editModal.data.flavor}</div>}
              {editModal.data.weight && <div><strong>Weight:</strong> {editModal.data.weight}</div>}
              {editModal.data.designDescription && <div><strong>Design:</strong> {editModal.data.designDescription}</div>}
              {editModal.data.budget && <div><strong>Budget:</strong> ₹{editModal.data.budget}</div>}
              {editModal.data.companyName && <div><strong>Company:</strong> {editModal.data.companyName}</div>}
              {editModal.data.eventType && <div><strong>Event:</strong> {editModal.data.eventType}</div>}
              {editModal.data.quantity && <div><strong>Quantity:</strong> {editModal.data.quantity}</div>}
              {editModal.data.requirements && <div><strong>Requirements:</strong> {editModal.data.requirements}</div>}
              {editModal.data.city && <div><strong>City:</strong> {editModal.data.city}</div>}
              {editModal.data.deliveryDate && <div><strong>Delivery Date:</strong> {formatDate(editModal.data.deliveryDate)}</div>}
              {editModal.data.quotedPrice > 0 && <div><strong>Current Quoted Price:</strong> ₹{editModal.data.quotedPrice}</div>}
            </div>

            {/* Status – shown with a visual indicator */}
            <div className="admin-field">
              <label className="admin-label">Status</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <select
                  className="admin-input admin-select"
                  value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  style={{
                    borderColor: STATUS_COLORS[editForm.status] || 'var(--admin-border)',
                    color: STATUS_COLORS[editForm.status] || 'var(--admin-text)',
                    fontWeight: 600,
                  }}
                >
                  {INQUIRY_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                </select>
                {/* Live status badge preview */}
                <StatusBadge status={editForm.status} />
              </div>
            </div>

            <div className="admin-field">
              <label className="admin-label">Quoted Price (₹)</label>
              <input
                className="admin-input"
                type="number"
                min="0"
                value={editForm.quotedPrice}
                onChange={e => setEditForm(f => ({ ...f, quotedPrice: e.target.value }))}
                placeholder="e.g. 2500"
              />
            </div>

            <div className="admin-field">
              <label className="admin-label">Admin Notes</label>
              <textarea
                className="admin-input admin-textarea"
                value={editForm.adminNotes}
                onChange={e => setEditForm(f => ({ ...f, adminNotes: e.target.value }))}
                placeholder="Internal notes visible only to admins…"
                rows={3}
              />
            </div>

            <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
              <button className="admin-btn admin-btn-secondary" onClick={() => setEditModal({ open: false, data: null })}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleUpdate} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </AdminModal>
    </div>
  );
}
