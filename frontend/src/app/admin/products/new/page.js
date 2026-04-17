'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import adminApi, { PRODUCT_TAGS, OCCASIONS } from '@/lib/adminApi';
import { AdminToast, useAdminToast } from '@/components/admin/AdminUI';

const emptyProduct = {
  name: '', description: '', shortDescription: '', category: '',
  basePrice: '', tags: [], occasions: [], flavors: '',
  isEggless: false, hasEgglessOption: false, egglessExtraPrice: '',
  isFeatured: false, isVeg: false, cities: '',
  images: [{ url: '', alt: '' }],
  seo: { title: '', description: '', keywords: '' },
  variants: [{ weight: '', price: '', compareAtPrice: '', sku: '', stock: 999 }],
};

export default function AdminNewProductPage() {
  const [form, setForm] = useState(emptyProduct);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();
  const router = useRouter();

  useEffect(() => {
    adminApi.categories.list().then(res => {
      setCategories(res.data.data || []);
    }).catch(() => {});
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...form,
        basePrice: Number(form.basePrice),
        egglessExtraPrice: form.egglessExtraPrice ? Number(form.egglessExtraPrice) : 0,
        flavors: form.flavors ? form.flavors.split(',').map(f => f.trim()).filter(Boolean) : [],
        cities: form.cities ? form.cities.split(',').map(c => c.trim()).filter(Boolean) : [],
        images: form.images.filter(img => img.url),
        variants: form.variants.filter(v => v.weight && v.price).map(v => ({
          weight: v.weight,
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
          stock: Number(v.stock) || 999,
          ...(v.sku ? { sku: v.sku } : {}),
        })),
      };
      await adminApi.products.create(data);
      showToast('Product created successfully');
      setTimeout(() => router.push('/admin/products'), 1000);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addVariant = () => setForm(f => ({ ...f, variants: [...f.variants, { weight: '', price: '', compareAtPrice: '', sku: '', stock: 999 }] }));
  const updateVariant = (i, key, val) => {
    const v = [...form.variants]; v[i] = { ...v[i], [key]: val }; setForm(f => ({ ...f, variants: v }));
  };
  const removeVariant = (i) => setForm(f => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }));

  return (
    <div style={{ maxWidth: 800 }}>
      <AdminToast {...toast} onClose={hideToast} />
      <h1 style={{ marginBottom: '1.5rem' }}>Add New Product</h1>

      <form onSubmit={handleSubmit}>
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Basic Info</h3>
          <div className="admin-field">
            <label className="admin-label">Product Name *</label>
            <input className="admin-input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Belgian Chocolate Cake" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Short Description</label>
            <input className="admin-input" value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="Brief tagline" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Description</label>
            <textarea className="admin-input admin-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Full description..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="admin-field">
              <label className="admin-label">Category *</label>
              <select className="admin-input admin-select" required value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Base Price (paise) *</label>
              <input className="admin-input" type="number" required value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} placeholder="69900" />
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
                  <input type="checkbox" checked={form.tags.includes(tag)} onChange={(e) => {
                    set('tags', e.target.checked ? [...form.tags, tag] : form.tags.filter(t => t !== tag));
                  }} />
                  {tag}
                </label>
              ))}
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Occasions</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {OCCASIONS.map(occ => (
                <label key={occ} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.occasions.includes(occ)} onChange={(e) => {
                    set('occasions', e.target.checked ? [...form.occasions, occ] : form.occasions.filter(o => o !== occ));
                  }} />
                  {occ.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="admin-field">
              <label className="admin-label">Flavors (comma-separated)</label>
              <input className="admin-input" value={form.flavors} onChange={(e) => set('flavors', e.target.value)} placeholder="chocolate, vanilla" />
            </div>
            <div className="admin-field">
              <label className="admin-label">Cities (comma-separated)</label>
              <input className="admin-input" value={form.cities} onChange={(e) => set('cities', e.target.value)} placeholder="Mumbai, Delhi" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              ['isFeatured', 'Featured'],
              ['isEggless', 'Eggless'],
              ['hasEgglessOption', 'Has Eggless Option'],
              ['isVeg', 'Vegetarian'],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          {form.hasEgglessOption && (
            <div className="admin-field" style={{ marginTop: '1rem' }}>
              <label className="admin-label">Eggless Extra Price (paise)</label>
              <input className="admin-input" type="number" value={form.egglessExtraPrice} onChange={(e) => set('egglessExtraPrice', e.target.value)} placeholder="5000" style={{ maxWidth: 200 }} />
            </div>
          )}
        </div>

        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Image URL</h3>
          <div className="admin-field">
            <label className="admin-label">Image URL</label>
            <input className="admin-input" value={form.images[0]?.url || ''} onChange={(e) => setForm(f => ({ ...f, images: [{ url: e.target.value, alt: f.name }] }))} placeholder="https://..." />
          </div>
        </div>

        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Variants</h3>
            <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={addVariant}>+ Add Variant</button>
          </div>
          {form.variants.map((v, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'end' }}>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Weight</label>
                <input className="admin-input" value={v.weight} onChange={(e) => updateVariant(i, 'weight', e.target.value)} placeholder="0.5 kg" />
              </div>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Price (paise)</label>
                <input className="admin-input" type="number" value={v.price} onChange={(e) => updateVariant(i, 'price', e.target.value)} placeholder="69900" />
              </div>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Compare Price</label>
                <input className="admin-input" type="number" value={v.compareAtPrice} onChange={(e) => updateVariant(i, 'compareAtPrice', e.target.value)} placeholder="89900" />
              </div>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Stock</label>
                <input className="admin-input" type="number" value={v.stock} onChange={(e) => updateVariant(i, 'stock', e.target.value)} />
              </div>
              {form.variants.length > 1 && <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeVariant(i)}>✕</button>}
            </div>
          ))}
        </div>

        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>SEO</h3>
          <div className="admin-field">
            <label className="admin-label">SEO Title</label>
            <input className="admin-input" value={form.seo.title} onChange={(e) => setForm(f => ({ ...f, seo: { ...f.seo, title: e.target.value } }))} />
          </div>
          <div className="admin-field">
            <label className="admin-label">SEO Description</label>
            <textarea className="admin-input admin-textarea" value={form.seo.description} onChange={(e) => setForm(f => ({ ...f, seo: { ...f.seo, description: e.target.value } }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Product'}
          </button>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => router.push('/admin/products')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
