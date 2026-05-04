'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi from '@/lib/adminApi';
import { AdminModal, ConfirmDialog, AdminToast, useAdminToast, EmptyState, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';
import AdminImageUpload from '@/components/admin/AdminImageUpload';
import { createImagePreview, deleteAdminImage, uploadAdminImage, validateImageFiles } from '@/lib/uploadApi';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, mode: 'create', data: null });
  const [form, setForm] = useState({ name: '', description: '', image: '', imagePublicId: '', sortOrder: 0, seo: { title: '', description: '', keywords: '' } });
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.categories.list();
      setCategories(res.data.data || []);
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

  const openCreate = () => {
    clearImageFile();
    setForm({ name: '', description: '', image: '', imagePublicId: '', sortOrder: 0, seo: { title: '', description: '', keywords: '' } });
    setModal({ open: true, mode: 'create', data: null });
  };

  const openEdit = (cat) => {
    clearImageFile();
    setForm({ name: cat.name, description: cat.description || '', image: cat.image || '', imagePublicId: cat.imagePublicId || '', sortOrder: cat.sortOrder || 0, seo: cat.seo || { title: '', description: '', keywords: '' } });
    setModal({ open: true, mode: 'edit', data: cat });
  };

  const handleSave = async () => {
    setSaving(true);
    let uploadedImage = null;
    try {
      const data = { ...form };
      if (imageFile) {
        uploadedImage = await uploadAdminImage(imageFile, 'categories');
        data.image = uploadedImage.url;
        data.imagePublicId = uploadedImage.publicId;
      }

      if (modal.mode === 'create') {
        await adminApi.categories.create(data);
        showToast('Category created');
      } else {
        await adminApi.categories.update(modal.data._id, data);
        showToast('Category updated');
      }
      clearImageFile();
      setModal({ open: false, mode: 'create', data: null });
      fetch();
    } catch (err) {
      if (uploadedImage?.publicId && err.response) {
        deleteAdminImage(uploadedImage.publicId).catch(() => {});
      }
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminApi.categories.delete(deleteId);
      showToast('Category deactivated');
      setDeleteId(null);
      fetch();
    } catch (err) { showToast('Delete failed', 'error'); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />
      <ConfirmDialog open={!!deleteId} title="Delete Category" message="This will deactivate the category." onConfirm={handleDelete} onCancel={() => setDeleteId(null)} loading={deleting} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Categories</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <RefreshButton onRefresh={fetch} />
          <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ Add Category</button>
        </div>
      </div>

      {loading ? <LoadingSkeleton rows={6} cols={4} /> : categories.length === 0 ? (
        <EmptyState message="No categories found" icon="📂" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {categories.map((cat) => (
            <div key={cat._id} className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h4 style={{ margin: 0 }}>{cat.name}</h4>
                <span className={`admin-badge ${cat.isActive !== false ? 'badge-active' : 'badge-inactive'}`}>{cat.isActive !== false ? 'Active' : 'Inactive'}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', flex: 1 }}>{cat.description || 'No description'}</p>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Slug: {cat.slug} • Order: {cat.sortOrder || 0}</div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => openEdit(cat)}>Edit</button>
                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteId(cat._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminModal open={modal.open} title={modal.mode === 'create' ? 'Add Category' : 'Edit Category'} onClose={() => { clearImageFile(); setModal({ open: false, mode: 'create', data: null }); }}>
        <div className="admin-field"><label className="admin-label">Name *</label><input className="admin-input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
        <div className="admin-field"><label className="admin-label">Description</label><textarea className="admin-input admin-textarea" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <AdminImageUpload
          label="Category Image"
          value={form.image}
          previewUrl={imagePreview}
          file={imageFile}
          onFileChange={handleImageFile}
          onClearFile={clearImageFile}
          onUrlChange={(value) => {
            clearImageFile();
            setForm(f => ({ ...f, image: value, imagePublicId: '' }));
          }}
        />
        <div className="admin-field"><label className="admin-label">Sort Order</label><input className="admin-input" type="number" value={form.sortOrder} onChange={(e) => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} style={{ maxWidth: 120 }} /></div>
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => { clearImageFile(); setModal({ open: false, mode: 'create', data: null }); }}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </AdminModal>
    </div>
  );
}
