'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  HiOutlineArrowLeft,
  HiOutlineInformationCircle,
  HiOutlineSparkles,
  HiOutlinePhoto,
  HiOutlineScale,
  HiOutlineMagnifyingGlass,
  HiOutlineCheck,
} from 'react-icons/hi2';
import adminApi, { PRODUCT_TAGS, OCCASIONS } from '@/lib/adminApi';
import { AdminToast, useAdminToast } from '@/components/admin/AdminUI';
import AdminImageGallery from '@/components/admin/AdminImageGallery';
import { deleteAdminImage, prepareProductImages } from '@/lib/uploadApi';

const emptyProduct = {
  name: '', description: '', shortDescription: '', category: '',
  basePrice: '', tags: [], occasions: [], flavors: '',
  isEggless: false, hasEgglessOption: false, egglessExtraPrice: '',
  isFeatured: false, isVeg: false, cities: '',
  images: [],
  seo: { title: '', description: '', keywords: '' },
  variants: [{ weight: '', price: '', compareAtPrice: '', costPrice: '', sku: '', stock: 999 }],
};

const BOOLEAN_OPTIONS = [
  ['isFeatured', 'Featured', 'Highlight on home & featured rails'],
  ['isVeg', 'Vegetarian', 'Mark this product as veg'],
  ['isEggless', 'Eggless', 'Product is eggless by default'],
  ['hasEgglessOption', 'Has Eggless Option', 'Let customers choose eggless'],
];

// Pricing is stored in paise (1 rupee = 100 paise). Show a live rupee hint so
// the admin can sanity-check the amount they typed.
const rupeeHint = (paise) => {
  const n = Number(paise);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `= ₹${(n / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const slugify = (s) => (s || '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function AdminNewProductPage() {
  const [form, setForm] = useState(emptyProduct);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();
  const router = useRouter();

  // Track latest images so we can revoke object-URL previews on unmount.
  const imagesRef = useRef(form.images);
  imagesRef.current = form.images;

  useEffect(() => {
    adminApi.categories.list().then(res => {
      setCategories(res.data.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      imagesRef.current?.forEach((img) => img?.previewUrl && URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setSeo = (key, val) => setForm(f => ({ ...f, seo: { ...f.seo, [key]: val } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let uploadedPublicIds = [];
    try {
      const prepared = await prepareProductImages(form.images, { altFallback: form.name });
      uploadedPublicIds = prepared.uploadedPublicIds;

      const data = {
        ...form,
        basePrice: Number(form.basePrice),
        egglessExtraPrice: form.egglessExtraPrice ? Number(form.egglessExtraPrice) : 0,
        flavors: form.flavors ? form.flavors.split(',').map(f => f.trim()).filter(Boolean) : [],
        cities: form.cities ? form.cities.split(',').map(c => c.trim()).filter(Boolean) : [],
        images: prepared.productImages,
        variants: form.variants.filter(v => v.weight && v.price).map(v => ({
          weight: v.weight,
          price: Number(v.price),
          compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
          costPrice: v.costPrice ? Number(v.costPrice) : 0,
          stock: Number(v.stock) || 999,
          ...(v.sku ? { sku: v.sku } : {}),
        })),
      };
      await adminApi.products.create(data);
      showToast('Product created successfully');
      setTimeout(() => router.push('/admin/products'), 1000);
    } catch (err) {
      if (uploadedPublicIds.length && err.response) {
        await Promise.all(uploadedPublicIds.map((id) => deleteAdminImage(id).catch(() => {})));
      }
      showToast(err.response?.data?.message || err.message || 'Failed to create product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addVariant = () => setForm(f => ({ ...f, variants: [...f.variants, { weight: '', price: '', compareAtPrice: '', costPrice: '', sku: '', stock: 999 }] }));
  const updateVariant = (i, key, val) => {
    const v = [...form.variants]; v[i] = { ...v[i], [key]: val }; setForm(f => ({ ...f, variants: v }));
  };
  const removeVariant = (i) => setForm(f => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }));

  const seoTitle = form.seo.title || form.name || 'Product title';
  const seoDesc = form.seo.description || form.shortDescription || 'Your product description will appear here in search results.';

  return (
    <div className="admin-form">
      <AdminToast {...toast} onClose={hideToast} />

      <div className="admin-page-header">
        <div>
          <div className="admin-page-kicker">Catalog</div>
          <h1 className="admin-page-title">Add New Product</h1>
          <p className="admin-page-subtitle">Create a new cake listing. Fields marked <span className="admin-required">*</span> are required.</p>
        </div>
        <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => router.push('/admin/products')}>
          <HiOutlineArrowLeft /> Back to products
        </button>
      </div>

      <form onSubmit={handleSubmit} className="admin-animate-in">
        {/* Basic Info */}
        <section className="admin-card admin-form-section">
          <header className="admin-form-section-head">
            <span className="admin-form-section-icon"><HiOutlineInformationCircle /></span>
            <div className="admin-form-section-titles">
              <h3 className="admin-form-section-title">Basic Information</h3>
              <p className="admin-form-section-desc">Name, description, category and pricing shown to customers.</p>
            </div>
          </header>

          <div className="admin-field">
            <label className="admin-label">Product Name <span className="admin-required">*</span></label>
            <input className="admin-input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Belgian Chocolate Truffle Cake" />
          </div>
          <div className="admin-field">
            <label className="admin-label">Short Description</label>
            <input className="admin-input" value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="A short, catchy tagline shown on cards" />
            <span className="admin-hint">Appears on product cards and listings. Keep it brief.</span>
          </div>
          <div className="admin-field">
            <label className="admin-label">Full Description</label>
            <textarea className="admin-input admin-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe ingredients, taste, occasion suitability..." />
          </div>
          <div className="admin-form-grid admin-form-grid-2">
            <div className="admin-field">
              <label className="admin-label">Category <span className="admin-required">*</span></label>
              <select className="admin-input admin-select" required value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Base Price (in paise) <span className="admin-required">*</span></label>
              <input className="admin-input" type="number" min="0" required value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} placeholder="69900" />
              <span className="admin-hint">
                Enter the amount in <strong>paise</strong> (₹1 = 100 paise). {rupeeHint(form.basePrice) && <span className="admin-hint-accent">{rupeeHint(form.basePrice)}</span>}
              </span>
            </div>
          </div>
        </section>

        {/* Tags & Options */}
        <section className="admin-card admin-form-section">
          <header className="admin-form-section-head">
            <span className="admin-form-section-icon"><HiOutlineSparkles /></span>
            <div className="admin-form-section-titles">
              <h3 className="admin-form-section-title">Tags &amp; Options</h3>
              <p className="admin-form-section-desc">Help customers discover this product and set dietary options.</p>
            </div>
          </header>

          <div className="admin-field">
            <label className="admin-label">Tags</label>
            <div className="admin-chips">
              {PRODUCT_TAGS.map(tag => {
                const on = form.tags.includes(tag);
                return (
                  <label key={tag} className={`admin-chip${on ? ' admin-chip-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={(e) => set('tags', e.target.checked ? [...form.tags, tag] : form.tags.filter(t => t !== tag))} />
                    {on && <span className="admin-chip-check"><HiOutlineCheck /></span>}
                    {tag}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="admin-field">
            <label className="admin-label">Occasions</label>
            <div className="admin-chips">
              {OCCASIONS.map(occ => {
                const on = form.occasions.includes(occ);
                return (
                  <label key={occ} className={`admin-chip${on ? ' admin-chip-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={(e) => set('occasions', e.target.checked ? [...form.occasions, occ] : form.occasions.filter(o => o !== occ))} />
                    {on && <span className="admin-chip-check"><HiOutlineCheck /></span>}
                    {occ.replace(/_/g, ' ')}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="admin-form-grid admin-form-grid-2">
            <div className="admin-field">
              <label className="admin-label">Flavors</label>
              <input className="admin-input" value={form.flavors} onChange={(e) => set('flavors', e.target.value)} placeholder="chocolate, vanilla, butterscotch" />
              <span className="admin-hint">Separate multiple flavors with commas.</span>
            </div>
            <div className="admin-field">
              <label className="admin-label">Available Cities</label>
              <input className="admin-input" value={form.cities} onChange={(e) => set('cities', e.target.value)} placeholder="Mumbai, Delhi, Bengaluru" />
              <span className="admin-hint">Separate multiple cities with commas. Leave empty for all.</span>
            </div>
          </div>

          <div className="admin-field" style={{ marginBottom: form.hasEgglessOption ? '1rem' : 0 }}>
            <label className="admin-label">Attributes</label>
            <div className="admin-toggles">
              {BOOLEAN_OPTIONS.map(([key, label, desc]) => {
                const on = !!form[key];
                return (
                  <label key={key} className={`admin-toggle${on ? ' admin-toggle-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={(e) => set(key, e.target.checked)} />
                    <span className="admin-switch" aria-hidden="true" />
                    <span className="admin-toggle-text">
                      <span className="admin-toggle-label">{label}</span>
                      <span className="admin-toggle-desc">{desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {form.hasEgglessOption && (
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label">Eggless Extra Price (in paise)</label>
              <input className="admin-input" type="number" min="0" value={form.egglessExtraPrice} onChange={(e) => set('egglessExtraPrice', e.target.value)} placeholder="5000" style={{ maxWidth: 240 }} />
              <span className="admin-hint">Surcharge when a customer picks the eggless option. {rupeeHint(form.egglessExtraPrice) && <span className="admin-hint-accent">{rupeeHint(form.egglessExtraPrice)}</span>}</span>
            </div>
          )}
        </section>

        {/* Images */}
        <section className="admin-card admin-form-section">
          <header className="admin-form-section-head">
            <span className="admin-form-section-icon"><HiOutlinePhoto /></span>
            <div className="admin-form-section-titles">
              <h3 className="admin-form-section-title">Product Images</h3>
              <p className="admin-form-section-desc">The first image is used as the main thumbnail. Drag to reorder.</p>
            </div>
          </header>
          <AdminImageGallery
            images={form.images}
            altText={form.name}
            onChange={(images) => set('images', images)}
            onError={(message) => showToast(message, 'error')}
          />
        </section>

        {/* Variants */}
        <section className="admin-card admin-form-section">
          <header className="admin-form-section-head">
            <span className="admin-form-section-icon"><HiOutlineScale /></span>
            <div className="admin-form-section-titles">
              <h3 className="admin-form-section-title">Variants</h3>
              <p className="admin-form-section-desc">Add weight/price options. Variants without weight &amp; price are skipped.</p>
            </div>
            <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm admin-form-section-action" onClick={addVariant}>+ Add Variant</button>
          </header>

          {form.variants.map((v, i) => (
            <div key={i} className="admin-variant">
              <span className="admin-variant-index">Variant {i + 1}</span>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Weight</label>
                <input className="admin-input" value={v.weight} onChange={(e) => updateVariant(i, 'weight', e.target.value)} placeholder="0.5 kg" />
              </div>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Price (paise)</label>
                <input className="admin-input" type="number" min="0" value={v.price} onChange={(e) => updateVariant(i, 'price', e.target.value)} placeholder="69900" />
              </div>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Compare Price</label>
                <input className="admin-input" type="number" min="0" value={v.compareAtPrice} onChange={(e) => updateVariant(i, 'compareAtPrice', e.target.value)} placeholder="89900" />
              </div>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Cost (paise)</label>
                <input className="admin-input" type="number" min="0" value={v.costPrice} onChange={(e) => updateVariant(i, 'costPrice', e.target.value)} placeholder="45000" title="Your make/buy cost — powers profit reporting" />
              </div>
              <div className="admin-field" style={{ marginBottom: 0 }}>
                <label className="admin-label">Stock</label>
                <input className="admin-input" type="number" min="0" value={v.stock} onChange={(e) => updateVariant(i, 'stock', e.target.value)} />
              </div>
              {form.variants.length > 1 && (
                <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeVariant(i)} aria-label={`Remove variant ${i + 1}`}>✕</button>
              )}
            </div>
          ))}
        </section>

        {/* SEO */}
        <section className="admin-card admin-form-section">
          <header className="admin-form-section-head">
            <span className="admin-form-section-icon"><HiOutlineMagnifyingGlass /></span>
            <div className="admin-form-section-titles">
              <h3 className="admin-form-section-title">Search Engine Optimization</h3>
              <p className="admin-form-section-desc">Control how this product appears in Google and social previews.</p>
            </div>
          </header>

          <div className="admin-seo-preview">
            <div className="admin-seo-preview-head">
              <span className="admin-seo-preview-fav" />
              <div>
                <div className="admin-seo-preview-host">The Cake Bake</div>
                <div className="admin-seo-preview-url">thecakebake.in › products › {slugify(form.name) || 'product'}</div>
              </div>
            </div>
            <div className="admin-seo-preview-title">{seoTitle}</div>
            <p className="admin-seo-preview-desc">{seoDesc}</p>
          </div>

          <div className="admin-field">
            <label className="admin-label">SEO Title</label>
            <input className="admin-input" value={form.seo.title} onChange={(e) => setSeo('title', e.target.value)} placeholder={form.name || 'Defaults to the product name'} maxLength={70} />
            <span className={`admin-charcount${form.seo.title.length > 60 ? ' admin-charcount-over' : ''}`}>{form.seo.title.length}/60 recommended</span>
          </div>
          <div className="admin-field">
            <label className="admin-label">SEO Description</label>
            <textarea className="admin-input admin-textarea" value={form.seo.description} onChange={(e) => setSeo('description', e.target.value)} placeholder="A concise summary that appears under the title in search results." maxLength={200} />
            <span className={`admin-charcount${form.seo.description.length > 160 ? ' admin-charcount-over' : ''}`}>{form.seo.description.length}/160 recommended</span>
          </div>
          <div className="admin-field" style={{ marginBottom: 0 }}>
            <label className="admin-label">SEO Keywords</label>
            <input className="admin-input" value={form.seo.keywords} onChange={(e) => setSeo('keywords', e.target.value)} placeholder="chocolate cake, birthday cake, eggless" />
            <span className="admin-hint">Comma-separated keywords relevant to this product.</span>
          </div>
        </section>

        <div className="admin-form-actions">
          <span className="admin-form-actions-note">Review the details above, then create your product.</span>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => router.push('/admin/products')}>Cancel</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Creating...' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
