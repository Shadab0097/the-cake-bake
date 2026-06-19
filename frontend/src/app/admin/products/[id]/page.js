'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  HiOutlineArrowLeft,
  HiOutlineInformationCircle,
  HiOutlineSparkles,
  HiOutlinePhoto,
  HiOutlineMagnifyingGlass,
  HiOutlineCheck,
} from 'react-icons/hi2';
import adminApi, { PRODUCT_TAGS, OCCASIONS } from '@/lib/adminApi';
import { AdminToast, useAdminToast } from '@/components/admin/AdminUI';
import AdminImageGallery from '@/components/admin/AdminImageGallery';
import ProductVariants from '@/components/admin/ProductVariants';
import { deleteAdminImage, prepareProductImages } from '@/lib/uploadApi';

const BOOLEAN_OPTIONS = [
  ['isActive', 'Active', 'Visible & purchasable on the store'],
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
  const setSeo = (key, val) => setForm(f => ({ ...f, seo: { ...(f.seo || {}), [key]: val } }));

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

  const seo = form.seo || { title: '', description: '', keywords: '' };
  const seoTitle = seo.title || form.name || 'Product title';
  const seoDesc = seo.description || form.shortDescription || 'Your product description will appear here in search results.';

  return (
    <div className="admin-form">
      <AdminToast {...toast} onClose={hideToast} />

      <div className="admin-page-header">
        <div>
          <div className="admin-page-kicker">Catalog</div>
          <h1 className="admin-page-title">Edit Product</h1>
          <p className="admin-page-subtitle">Update details for <strong style={{ color: 'var(--admin-text-secondary)' }}>{form.name}</strong>.</p>
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
            <input className="admin-input" required value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Short Description</label>
            <input className="admin-input" value={form.shortDescription || ''} onChange={(e) => set('shortDescription', e.target.value)} placeholder="A short, catchy tagline shown on cards" />
            <span className="admin-hint">Appears on product cards and listings. Keep it brief.</span>
          </div>
          <div className="admin-field">
            <label className="admin-label">Full Description</label>
            <textarea className="admin-input admin-textarea" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="admin-form-grid admin-form-grid-2">
            <div className="admin-field">
              <label className="admin-label">Category</label>
              <select className="admin-input admin-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Base Price (in paise)</label>
              <input className="admin-input" type="number" min="0" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} placeholder="69900" />
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
                const on = (form.tags || []).includes(tag);
                return (
                  <label key={tag} className={`admin-chip${on ? ' admin-chip-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={(e) => set('tags', e.target.checked ? [...(form.tags || []), tag] : (form.tags || []).filter(t => t !== tag))} />
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
                const on = (form.occasions || []).includes(occ);
                return (
                  <label key={occ} className={`admin-chip${on ? ' admin-chip-on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={(e) => set('occasions', e.target.checked ? [...(form.occasions || []), occ] : (form.occasions || []).filter(o => o !== occ))} />
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
                <div className="admin-seo-preview-url">thecakebake.in › products › {slugify(form.slug || form.name) || 'product'}</div>
              </div>
            </div>
            <div className="admin-seo-preview-title">{seoTitle}</div>
            <p className="admin-seo-preview-desc">{seoDesc}</p>
          </div>

          <div className="admin-field">
            <label className="admin-label">SEO Title</label>
            <input className="admin-input" value={seo.title || ''} onChange={(e) => setSeo('title', e.target.value)} placeholder={form.name || 'Defaults to the product name'} maxLength={70} />
            <span className={`admin-charcount${(seo.title || '').length > 60 ? ' admin-charcount-over' : ''}`}>{(seo.title || '').length}/60 recommended</span>
          </div>
          <div className="admin-field">
            <label className="admin-label">SEO Description</label>
            <textarea className="admin-input admin-textarea" value={seo.description || ''} onChange={(e) => setSeo('description', e.target.value)} placeholder="A concise summary that appears under the title in search results." maxLength={200} />
            <span className={`admin-charcount${(seo.description || '').length > 160 ? ' admin-charcount-over' : ''}`}>{(seo.description || '').length}/160 recommended</span>
          </div>
          <div className="admin-field" style={{ marginBottom: 0 }}>
            <label className="admin-label">SEO Keywords</label>
            <input className="admin-input" value={seo.keywords || ''} onChange={(e) => setSeo('keywords', e.target.value)} placeholder="chocolate cake, birthday cake, eggless" />
            <span className="admin-hint">Comma-separated keywords relevant to this product.</span>
          </div>
        </section>

        <div className="admin-form-actions">
          <span className="admin-form-actions-note">Changes are saved to the live catalog.</span>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => router.push('/admin/products')}>Cancel</button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>

      <ProductVariants productId={id} showToast={showToast} />
    </div>
  );
}
