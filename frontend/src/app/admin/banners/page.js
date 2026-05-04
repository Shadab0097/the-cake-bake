'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi, { BANNER_POSITIONS } from '@/lib/adminApi';
import { AdminModal, ConfirmDialog, AdminToast, useAdminToast, EmptyState, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';
import AdminImageUpload from '@/components/admin/AdminImageUpload';
import { createImagePreview, deleteAdminImage, uploadAdminImage, validateImageFiles } from '@/lib/uploadApi';

const emptyBanner = { title: '', subtitle: '', imageUrl: '', imagePublicId: '', link: '', position: 'hero', sortOrder: 0, isActive: true };

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null });
  const [form, setForm] = useState(emptyBanner);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.banners.list();
      setBanners(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const clearImageFile = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
  };

  const handleImageFile = (file) => {
    if (!file) return;
    try {
      validateImageFiles([file]);
      clearImageFile();
      setImageFile(file);
      setImagePreview(createImagePreview(file));
    } catch (err) {
      showToast(err.message || 'Invalid image file', 'error');
    }
  };

  const openCreate = () => { clearImageFile(); setForm({ ...emptyBanner }); setModal({ open: true, mode: 'create', data: null }); };
  const openEdit = (b) => {
    clearImageFile();
    setForm({
      title: b.title || '',
      subtitle: b.subtitle || '',
      imageUrl: b.imageUrl || b.image?.desktop || '',
      imagePublicId: b.imagePublicId?.desktop || b.imagePublicId || '',
      link: b.link || '',
      position: b.position || 'hero',
      sortOrder: b.sortOrder || 0,
      isActive: b.isActive !== false,
    });
    setModal({ open: true, mode: 'edit', data: b });
  };

  const handleSave = async () => {
    setSaving(true);
    let uploadedImage = null;
    try {
      const data = { ...form, sortOrder: Number(form.sortOrder) || 0 };
      if (imageFile) {
        uploadedImage = await uploadAdminImage(imageFile, 'banners');
        data.imageUrl = uploadedImage.url;
        data.imagePublicId = uploadedImage.publicId;
      }
      if (modal.mode === 'create') await adminApi.banners.create(data);
      else await adminApi.banners.update(modal.data._id, data);
      showToast(modal.mode === 'create' ? 'Banner created' : 'Banner updated');
      clearImageFile();
      setModal({ open: false, mode: 'create', data: null }); fetch();
    } catch (err) {
      if (uploadedImage?.publicId && err.response) {
        deleteAdminImage(uploadedImage.publicId).catch(() => {});
      }
      showToast(err.response?.data?.message || 'Save failed', 'error');
    }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await adminApi.banners.delete(deleteId); showToast('Banner deleted'); setDeleteId(null); fetch(); }
    catch (err) { showToast('Delete failed', 'error'); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />
      <ConfirmDialog open={!!deleteId} title="Delete Banner" message="This will permanently delete the banner." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Banners</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <RefreshButton onRefresh={fetch} />
          <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ Add Banner</button>
        </div>
      </div>

      {loading ? <LoadingSkeleton rows={4} cols={5} /> : banners.length === 0 ? <EmptyState message="No banners found" icon="🖼️" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {banners.map(b => (
            <div key={b._id} className="admin-card">
              {(b.imageUrl || b.image?.desktop) && (
                <div style={{ height: 120, borderRadius: 'var(--admin-radius-sm)', overflow: 'hidden', marginBottom: '0.75rem', background: 'var(--admin-bg)' }}>
                  <img src={b.imageUrl || b.image?.desktop} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h4 style={{ margin: 0 }}>{b.title || 'Untitled'}</h4>
                <span className={`admin-badge ${b.isActive !== false ? 'badge-active' : 'badge-inactive'}`}>{b.isActive !== false ? 'Active' : 'Inactive'}</span>
              </div>
              {b.subtitle && <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>{b.subtitle}</p>}
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '0.75rem' }}>
                Position: <span style={{ textTransform: 'capitalize' }}>{b.position}</span> • Order: {b.sortOrder || 0}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => openEdit(b)}>Edit</button>
                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteId(b._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminModal open={modal.open} title={modal.mode === 'create' ? 'Add Banner' : 'Edit Banner'} onClose={() => { clearImageFile(); setModal({ open: false, mode: 'create', data: null }); }}>
        <div className="admin-field"><label className="admin-label">Title</label><input className="admin-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="admin-field"><label className="admin-label">Subtitle</label><input className="admin-input" value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} /></div>
        <AdminImageUpload
          label="Banner Image"
          value={form.imageUrl}
          previewUrl={imagePreview}
          file={imageFile}
          onFileChange={handleImageFile}
          onClearFile={clearImageFile}
          onUrlChange={(value) => {
            clearImageFile();
            setForm(f => ({ ...f, imageUrl: value, imagePublicId: '' }));
          }}
        />
        <div className="admin-field"><label className="admin-label">Link URL</label><input className="admin-input" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="/products" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="admin-field"><label className="admin-label">Position</label><select className="admin-input admin-select" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>{BANNER_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div className="admin-field"><label className="admin-label">Sort Order</label><input className="admin-input" type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} /> Active
        </label>
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => { clearImageFile(); setModal({ open: false, mode: 'create', data: null }); }}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </AdminModal>
    </div>
  );
}
