'use client';

import { useState, useEffect, useCallback } from 'react';
import { HiOutlineCube } from 'react-icons/hi2';
import adminApi from '@/lib/adminApi';

const BLANK = { weight: '', price: '', compareAtPrice: '', costPrice: '', stock: 999, sku: '' };

const rupee = (paise) => {
  const n = Number(paise);
  return Number.isFinite(n) && n > 0 ? `₹${(n / 100).toLocaleString('en-IN')}` : '';
};

const marginOf = (price, cost) => {
  const p = Number(price);
  const c = Number(cost) || 0;
  if (!Number.isFinite(p) || p <= 0 || c <= 0) return null;
  return Math.round(((p - c) / p) * 100);
};

// Decorate a server variant with editable string mirrors (_field) so inputs
// stay controlled and we can diff against the saved values for dirty state.
const decorate = (variant) => ({
  ...variant,
  _weight: variant.weight ?? '',
  _price: String(variant.price ?? ''),
  _compareAtPrice: String(variant.compareAtPrice ?? ''),
  _costPrice: String(variant.costPrice ?? ''),
  _stock: String(variant.stock ?? ''),
  _sku: variant.sku ?? '',
});

const isDirty = (v) => (
  v._weight !== (v.weight ?? '')
  || v._price !== String(v.price ?? '')
  || v._compareAtPrice !== String(v.compareAtPrice ?? '')
  || v._costPrice !== String(v.costPrice ?? '')
  || v._stock !== String(v.stock ?? '')
  || v._sku !== (v.sku ?? '')
);

export default function ProductVariants({ productId, showToast }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newVariant, setNewVariant] = useState(BLANK);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.products.getVariants(productId);
      setVariants((res.data.data || []).map(decorate));
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Failed to load variants', 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, showToast]);

  useEffect(() => { load(); }, [load]);

  const edit = (id, key, val) => setVariants((prev) => prev.map((v) => (v._id === id ? { ...v, [key]: val } : v)));

  // Existing rows carry _field string mirrors; the new-variant row carries the
  // plain field names — pick whichever is present.
  const buildPayload = (source) => {
    const pick = (mirror, plain) => (mirror ?? plain);
    const compare = pick(source._compareAtPrice, source.compareAtPrice);
    const cost = pick(source._costPrice, source.costPrice);
    return {
      weight: String(pick(source._weight, source.weight) ?? '').trim(),
      price: Number(pick(source._price, source.price)),
      compareAtPrice: compare ? Number(compare) : 0,
      costPrice: cost ? Number(cost) : 0,
      stock: Number(pick(source._stock, source.stock)) || 0,
    };
  };

  const validPayload = (payload) => payload.weight && !Number.isNaN(payload.price) && payload.price >= 0;

  const save = async (v) => {
    // Only send a non-empty SKU: '' is a real value under the sparse-unique
    // index, so multiple blank SKUs would collide. Clearing isn't supported.
    const payload = buildPayload(v);
    const sku = (v._sku || '').trim();
    if (sku) payload.sku = sku;
    if (!validPayload(payload)) {
      showToast?.('Weight and a valid price are required', 'error');
      return;
    }
    setSavingId(v._id);
    try {
      const res = await adminApi.products.updateVariant(productId, v._id, payload);
      setVariants((prev) => prev.map((x) => (x._id === v._id ? decorate(res.data.data) : x)));
      showToast?.(`Variant ${res.data.data.weight} saved`, 'success');
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (v) => {
    setSavingId(v._id);
    try {
      const res = await adminApi.products.updateVariant(productId, v._id, { isActive: !v.isActive });
      setVariants((prev) => prev.map((x) => (x._id === v._id ? { ...x, isActive: res.data.data.isActive } : x)));
      showToast?.(`Variant ${res.data.data.isActive ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Update failed', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const add = async () => {
    const payload = buildPayload(newVariant);
    if (newVariant.sku.trim()) payload.sku = newVariant.sku.trim();
    if (!validPayload(payload)) {
      showToast?.('Weight and a valid price are required', 'error');
      return;
    }
    setAdding(true);
    try {
      await adminApi.products.addVariant(productId, payload);
      setNewVariant(BLANK);
      await load();
      showToast?.('Variant added', 'success');
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Add failed', 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="admin-card admin-form-section">
      <header className="admin-form-section-head">
        <span className="admin-form-section-icon"><HiOutlineCube /></span>
        <div className="admin-form-section-titles">
          <h3 className="admin-form-section-title">Variants</h3>
          <p className="admin-form-section-desc">Weights, pricing, cost, and stock. Amounts are in paise (₹1 = 100 paise).</p>
        </div>
      </header>

      {loading ? (
        <div className="admin-empty-compact">Loading variants…</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Weight</th>
                <th>Price</th>
                <th>Compare</th>
                <th>Cost</th>
                <th>Margin</th>
                <th>Stock</th>
                <th>SKU</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 && (
                <tr><td colSpan={9} className="admin-empty-compact">No variants yet — add one below.</td></tr>
              )}
              {variants.map((v) => {
                const margin = marginOf(v._price, v._costPrice);
                const dirty = isDirty(v);
                return (
                  <tr key={v._id} style={{ opacity: v.isActive ? 1 : 0.55 }}>
                    <td><input className="admin-input" style={{ minWidth: 80 }} value={v._weight} onChange={(e) => edit(v._id, '_weight', e.target.value)} placeholder="0.5 kg" /></td>
                    <td>
                      <input className="admin-input" style={{ width: 96 }} type="number" min="0" value={v._price} onChange={(e) => edit(v._id, '_price', e.target.value)} />
                      <div className="admin-row-meta">{rupee(v._price)}</div>
                    </td>
                    <td><input className="admin-input" style={{ width: 96 }} type="number" min="0" value={v._compareAtPrice} onChange={(e) => edit(v._id, '_compareAtPrice', e.target.value)} /></td>
                    <td>
                      <input className="admin-input" style={{ width: 96 }} type="number" min="0" value={v._costPrice} onChange={(e) => edit(v._id, '_costPrice', e.target.value)} />
                      <div className="admin-row-meta">{rupee(v._costPrice)}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: margin == null ? 'var(--admin-text-muted)' : margin >= 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                      {margin == null ? '—' : `${margin}%`}
                    </td>
                    <td><input className="admin-input" style={{ width: 76 }} type="number" min="0" value={v._stock} onChange={(e) => edit(v._id, '_stock', e.target.value)} /></td>
                    <td><input className="admin-input" style={{ minWidth: 90 }} value={v._sku} onChange={(e) => edit(v._id, '_sku', e.target.value)} placeholder="—" /></td>
                    <td>
                      <button type="button" className={`admin-pill ${v.isActive ? 'admin-pill-success' : 'admin-pill-guest'}`} onClick={() => toggleActive(v)} disabled={savingId === v._id} style={{ cursor: 'pointer', border: 'none' }} title="Toggle active">
                        {v.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={!dirty || savingId === v._id} onClick={() => save(v)}>
                        {savingId === v._id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {/* Add new variant row */}
              <tr style={{ background: 'var(--admin-bg)' }}>
                <td><input className="admin-input" style={{ minWidth: 80 }} value={newVariant.weight} onChange={(e) => setNewVariant((p) => ({ ...p, weight: e.target.value }))} placeholder="1 kg" /></td>
                <td><input className="admin-input" style={{ width: 96 }} type="number" min="0" value={newVariant.price} onChange={(e) => setNewVariant((p) => ({ ...p, price: e.target.value }))} placeholder="price" /></td>
                <td><input className="admin-input" style={{ width: 96 }} type="number" min="0" value={newVariant.compareAtPrice} onChange={(e) => setNewVariant((p) => ({ ...p, compareAtPrice: e.target.value }))} /></td>
                <td><input className="admin-input" style={{ width: 96 }} type="number" min="0" value={newVariant.costPrice} onChange={(e) => setNewVariant((p) => ({ ...p, costPrice: e.target.value }))} placeholder="cost" /></td>
                <td>—</td>
                <td><input className="admin-input" style={{ width: 76 }} type="number" min="0" value={newVariant.stock} onChange={(e) => setNewVariant((p) => ({ ...p, stock: e.target.value }))} /></td>
                <td><input className="admin-input" style={{ minWidth: 90 }} value={newVariant.sku} onChange={(e) => setNewVariant((p) => ({ ...p, sku: e.target.value }))} placeholder="optional" /></td>
                <td>—</td>
                <td>
                  <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={adding} onClick={add}>
                    {adding ? 'Adding…' : '+ Add'}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
