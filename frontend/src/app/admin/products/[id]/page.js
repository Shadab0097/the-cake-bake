'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import adminApi, { PRODUCT_TAGS } from '@/lib/adminApi';
import { AdminToast, useAdminToast } from '@/components/admin/AdminUI';
import { HiOutlineArrowLeft } from 'react-icons/hi2';
import AdminImageGallery from '@/components/admin/AdminImageGallery';
import { deleteAdminImage, prepareProductImages } from '@/lib/uploadApi';

export default function AdminEditProductPage({ params }) {
  const { id } = use(params);
  const [form, setForm] = useState(null);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useAdminToast();
  const router = useRouter();

  // Track latest images so we can revoke object-URL previews on unmount.
  const imagesRef = useRef([]);
  imagesRef.current = form?.images || [];

  const fetchProduct = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        adminApi.products.list({ page: 1, limit: 100 }),
        adminApi.categories.list(),
      ]);
      setCategories(catRes.data.data || []);
      const products = prodRes.data.data?.items || [];
      const product = products.find(p => p._id === id);
      if (product) {
        setForm({
          ...product,
          category: product.category?._id || product.category || '',
          flavors: (product.flavors || []).join(', '),
          cities: (product.cities || []).join(', '),
          egglessExtraPrice: product.egglessExtraPrice || '',
          images: (product.images || [])
            .filter((img) => img?.url)
            .map((img) => ({ url: img.url, publicId: img.publicId || '', alt: img.alt || '' })),
          seo: product.seo || { title: '', description: '', keywords: '' },
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);
  useEffect(() => {
    return () => {
      imagesRef.current?.forEach((img) => img?.previewUrl && URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let uploadedPublicIds = [];
    try {
      const prepared = await prepareProductImages(form.images, { altFallback: form.name });
      uploadedPublicIds = prepared.uploadedPublicIds;

      const data = {
        name: form.name, description: form.description, shortDescription: form.shortDescription,
        category: form.category, basePrice: Number(form.basePrice),
        tags: form.tags, occasions: form.occasions,
        egglessExtraPrice: form.egglessExtraPrice ? Number(form.egglessExtraPrice) : 0,
        flavors: typeof form.flavors === 'string' ? form.flavors.split(',').map(f => f.trim()).filter(Boolean) : form.flavors,
        cities: typeof form.cities === 'string' ? form.cities.split(',').map(c => c.trim()).filter(Boolean) : form.cities,
        isEggless: form.isEggless, hasEgglessOption: form.hasEgglessOption,
        isFeatured: form.isFeatured, isVeg: form.isVeg, isActive: form.isActive,
        images: prepared.productImages,
        seo: form.seo,
      };
      await adminApi.products.update(id, data);
      showToast('Product updated successfully');
      // Replace local entries (which may include File previews) with the saved
      // image set so previews are released and state stays consistent.
      setForm(f => ({ ...f, images: prepared.productImages.map((img) => ({ url: img.url, publicId: img.publicId, alt: img.alt })) }));
    } catch (err) {
      if (uploadedPublicIds.length && err.response) {
        await Promise.all(uploadedPublicIds.map((pid) => deleteAdminImage(pid).catch(() => {})));
      }
      showToast(err.response?.data?.message || err.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-loading"><div className="admin-spinner" /></div>;
  if (!form) return <div className="admin-empty">Product not found</div>;

  return (
    <div style={{ maxWidth: 800 }}>
      <AdminToast {...toast} onClose={hideToast} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => router.push('/admin/products')} className="admin-btn admin-btn-ghost admin-btn-icon"><HiOutlineArrowLeft /></button>
        <h1 style={{ margin: 0 }}>Edit Product</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Basic Info</h3>
          <div className="admin-field">
            <label className="admin-label">Product Name *</label>
            <input className="admin-input" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Short Description</label>
            <input className="admin-input" value={form.shortDescription || ''} onChange={(e) => set('shortDescription', e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Description</label>
            <textarea className="admin-input admin-textarea" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="admin-field">
              <label className="admin-label">Category</label>
              <select className="admin-input admin-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Base Price (paise)</label>
              <input className="admin-input" type="number" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Tags & Options</h3>
          <div className="admin-field">
            <label className="admin-label">Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {PRODUCT_TAGS.map(tag => (
                <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={(form.tags || []).includes(tag)} onChange={(e) => {
                    set('tags', e.target.checked ? [...(form.tags || []), tag] : (form.tags || []).filter(t => t !== tag));
                  }} /> {tag}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="admin-field">
              <label className="admin-label">Flavors</label>
              <input className="admin-input" value={form.flavors} onChange={(e) => set('flavors', e.target.value)} />
            </div>
            <div className="admin-field">
              <label className="admin-label">Cities</label>
              <input className="admin-input" value={form.cities} onChange={(e) => set('cities', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[['isFeatured', 'Featured'], ['isEggless', 'Eggless'], ['hasEgglessOption', 'Has Eggless Option'], ['isActive', 'Active']].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[key]} onChange={(e) => set(key, e.target.checked)} /> {label}
              </label>
            ))}
          </div>
        </div>

        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Product Images</h3>
          <AdminImageGallery
            images={form.images}
            altText={form.name}
            onChange={(images) => set('images', images)}
            onError={(message) => showToast(message, 'error')}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => router.push('/admin/products')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
