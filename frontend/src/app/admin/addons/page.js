'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi, { formatPrice, ADDON_CATEGORIES } from '@/lib/adminApi';
import { AdminModal, ConfirmDialog, AdminToast, useAdminToast, EmptyState, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';

const emptyAddon = { name: '', description: '', image: '', price: '', category: 'candles', sortOrder: 0, isActive: true };

export default function AdminAddonsPage() {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null });
  const [form, setForm] = useState(emptyAddon);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const { toast, showToast, hideToast } = useAdminToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterCat) params.category = filterCat;
      const res = await adminApi.addons.list(params);
      setAddons(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterCat]);

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => { setForm({ ...emptyAddon }); setModal({ open: true, mode: 'create', data: null }); };
  const openEdit = (a) => { setForm({ ...a, price: a.price }); setModal({ open: true, mode: 'edit', data: a }); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { ...form, price: Number(form.price), sortOrder: Number(form.sortOrder) || 0 };
      if (modal.mode === 'create') await adminApi.addons.create(data);
      else await adminApi.addons.update(modal.data._id, data);
      showToast(modal.mode === 'create' ? 'Add-on created' : 'Add-on updated');
      setModal({ open: false, mode: 'create', data: null }); fetch();
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await adminApi.addons.delete(deleteId); showToast('Add-on deactivated'); setDeleteId(null); fetch(); }
    catch (err) { showToast('Delete failed', 'error'); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />
      <ConfirmDialog open={!!deleteId} title="Delete Add-On" message="This will deactivate the add-on." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Add-Ons</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <RefreshButton onRefresh={fetch} />
          <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ Add Add-On</button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <select className="admin-input admin-select" style={{ maxWidth: 180 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {ADDON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{addons.length} add-ons</span>
      </div>

      {loading ? <LoadingSkeleton rows={6} cols={5} /> : addons.length === 0 ? <EmptyState message="No add-ons found" icon="🧁" /> : (
        <div className="admin-card" style={{ padding: 0 }}>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {addons.map(a => (
                  <tr key={a._id}>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td><span className="admin-badge badge-new" style={{ textTransform: 'capitalize' }}>{a.category}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatPrice(a.price)}</td>
                    <td><span className={`admin-badge ${a.isActive !== false ? 'badge-active' : 'badge-inactive'}`}>{a.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openEdit(a)}>Edit</button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteId(a._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminModal open={modal.open} title={modal.mode === 'create' ? 'Add Add-On' : 'Edit Add-On'} onClose={() => setModal({ open: false, mode: 'create', data: null })}>
        <div className="admin-field"><label className="admin-label">Name *</label><input className="admin-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="admin-field"><label className="admin-label">Description</label><input className="admin-input" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="admin-field"><label className="admin-label">Price (paise) *</label><input className="admin-input" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Category</label><select className="admin-input admin-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{ADDON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="admin-field"><label className="admin-label">Image URL</label><input className="admin-input" value={form.image || ''} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} /></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} /> Active
        </label>
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => setModal({ open: false, mode: 'create', data: null })}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.price}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </AdminModal>
    </div>
  );
}
