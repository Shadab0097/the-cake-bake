'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi, { formatPrice, formatDate, COUPON_TYPES } from '@/lib/adminApi';
import { Pagination, AdminModal, ConfirmDialog, AdminToast, useAdminToast, EmptyState, LoadingSkeleton, StatusBadge, RefreshButton } from '@/components/admin/AdminUI';

const emptyCoupon = { code: '', type: 'percentage', value: '', maxDiscount: '', minOrderAmount: '', description: '', usageLimit: 0, perUserLimit: 1, validFrom: '', validUntil: '', isActive: true };

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null });
  const [form, setForm] = useState(emptyCoupon);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.coupons.list({ page, limit: 15 });
      const d = res.data.data;
      setCoupons(d.items || []);
      setTotalPages(d.pagination?.totalPages || 1);
      setTotal(d.pagination?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setForm(emptyCoupon); setModal({ open: true, mode: 'create', data: null }); };
  const openEdit = (c) => {
    setForm({
      code: c.code, type: c.type, value: c.value, maxDiscount: c.maxDiscount || '', minOrderAmount: c.minOrderAmount || '',
      description: c.description || '', usageLimit: c.usageLimit || 0, perUserLimit: c.perUserLimit || 1,
      validFrom: c.validFrom ? new Date(c.validFrom).toISOString().slice(0, 10) : '',
      validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 10) : '',
      isActive: c.isActive !== false,
    });
    setModal({ open: true, mode: 'edit', data: c });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { ...form, value: Number(form.value), maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : 0, minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0, usageLimit: Number(form.usageLimit), perUserLimit: Number(form.perUserLimit) };
      if (modal.mode === 'create') {
        await adminApi.coupons.create(data);
        showToast('Coupon created');
      } else {
        await adminApi.coupons.update(modal.data._id, data);
        showToast('Coupon updated');
      }
      setModal({ open: false, mode: 'create', data: null }); fetch();
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await adminApi.coupons.delete(deleteId); showToast('Coupon deactivated'); setDeleteId(null); fetch(); }
    catch (err) { showToast('Delete failed', 'error'); }
    finally { setDeleting(false); }
  };

  const isExpired = (c) => c.validUntil && new Date(c.validUntil) < new Date();

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />
      <ConfirmDialog open={!!deleteId} title="Delete Coupon" message="This will deactivate the coupon." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Coupons</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <RefreshButton onRefresh={fetch} />
          <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ Add Coupon</button>
        </div>
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? <LoadingSkeleton rows={8} cols={7} /> : coupons.length === 0 ? <EmptyState message="No coupons found" icon="🏷️" /> : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Usage</th><th>Valid Until</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c._id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{c.code}</td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--admin-text-secondary)' }}>{c.type}</td>
                      <td style={{ fontWeight: 600 }}>{c.type === 'percentage' ? `${c.value}%` : formatPrice(c.value)}</td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{c.minOrderAmount ? formatPrice(c.minOrderAmount) : '—'}</td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{c.usageCount || 0}{c.usageLimit > 0 ? `/${c.usageLimit}` : ''}</td>
                      <td style={{ color: isExpired(c) ? 'var(--admin-danger)' : 'var(--admin-text-secondary)', fontSize: '0.8125rem' }}>
                        {c.validUntil ? formatDate(c.validUntil) : '—'} {isExpired(c) && '(Expired)'}
                      </td>
                      <td><span className={`admin-badge ${c.isActive ? 'badge-active' : 'badge-inactive'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openEdit(c)}>Edit</button>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteId(c._id)}>Delete</button>
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

      <AdminModal open={modal.open} title={modal.mode === 'create' ? 'Add Coupon' : 'Edit Coupon'} onClose={() => setModal({ open: false, mode: 'create', data: null })}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="admin-field"><label className="admin-label">Code *</label><input className="admin-input" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME20" /></div>
          <div className="admin-field"><label className="admin-label">Type</label><select className="admin-input admin-select" value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}>{COUPON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="admin-field"><label className="admin-label">Value *</label><input className="admin-input" type="number" value={form.value} onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === 'percentage' ? '20' : '10000'} /></div>
          <div className="admin-field"><label className="admin-label">Max Discount (paise)</label><input className="admin-input" type="number" value={form.maxDiscount} onChange={(e) => setForm(f => ({ ...f, maxDiscount: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Min Order (paise)</label><input className="admin-input" type="number" value={form.minOrderAmount} onChange={(e) => setForm(f => ({ ...f, minOrderAmount: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Usage Limit</label><input className="admin-input" type="number" value={form.usageLimit} onChange={(e) => setForm(f => ({ ...f, usageLimit: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Valid From</label><input className="admin-input" type="date" value={form.validFrom} onChange={(e) => setForm(f => ({ ...f, validFrom: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Valid Until</label><input className="admin-input" type="date" value={form.validUntil} onChange={(e) => setForm(f => ({ ...f, validUntil: e.target.value }))} /></div>
        </div>
        <div className="admin-field"><label className="admin-label">Description</label><input className="admin-input" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', cursor: 'pointer', marginTop: '0.5rem' }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} /> Active
        </label>
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => setModal({ open: false, mode: 'create', data: null })}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !form.code || !form.value}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </AdminModal>
    </div>
  );
}
