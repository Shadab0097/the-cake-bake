'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import adminApi, { formatPrice } from '@/lib/adminApi';
import { LoadingSkeleton, EmptyState, RefreshButton, AdminToast, useAdminToast } from '@/components/admin/AdminUI';

export default function AdminCostsPage() {
  const [rows, setRows] = useState([]);
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetchVariants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.products.listVariants();
      const list = res.data.data || [];
      setRows(list);
      setEdits(Object.fromEntries(list.map((variant) => [variant._id, String(variant.costPrice ?? 0)])));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to load variants', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchVariants(); }, [fetchVariants]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((variant) => (
      (variant.product?.name || '').toLowerCase().includes(term) ||
      (variant.sku || '').toLowerCase().includes(term) ||
      (variant.weight || '').toLowerCase().includes(term)
    ));
  }, [rows, search]);

  const handleSave = async (row) => {
    const raw = edits[row._id];
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value) || value < 0) {
      showToast('Enter a valid cost (paise, 0 or more)', 'error');
      return;
    }
    setSavingId(row._id);
    try {
      await adminApi.products.updateVariant(row.product._id, row._id, { costPrice: value });
      setRows((prev) => prev.map((variant) => (variant._id === row._id ? { ...variant, costPrice: value } : variant)));
      showToast(`Cost saved for ${row.product?.name || 'variant'} (${row.weight})`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const missingCount = rows.filter((variant) => !variant.costPrice).length;

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Cost Prices</h1>
          <div className="admin-page-subtitle">
            Set each variant&apos;s make/buy cost (in paise) to power profit reporting.
            {missingCount > 0 && <> &nbsp;·&nbsp; <strong style={{ color: 'var(--admin-warning)' }}>{missingCount} missing</strong></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link href="/admin/profit" className="admin-btn admin-btn-ghost admin-btn-sm" style={{ textDecoration: 'none' }}>← Profit</Link>
          <RefreshButton onRefresh={fetchVariants} />
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <input
          className="admin-input"
          placeholder="🔍 Search product, weight, or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? (
          <LoadingSkeleton rows={10} cols={6} />
        ) : filtered.length === 0 ? (
          <EmptyState message="No variants found" icon="🎂" />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Weight</th>
                  <th>Sell Price</th>
                  <th>Cost (paise)</th>
                  <th>Margin</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const editValue = edits[row._id] ?? '';
                  const costNum = Number(editValue) || 0;
                  const margin = row.price > 0 ? Math.round(((row.price - costNum) / row.price) * 100) : 0;
                  const dirty = editValue !== String(row.costPrice ?? 0);
                  return (
                    <tr key={row._id}>
                      <td className="admin-row-title">{row.product?.name || 'Product'}</td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{row.weight}</td>
                      <td>{formatPrice(row.price || 0)}</td>
                      <td>
                        <input
                          className="admin-input"
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [row._id]: e.target.value }))}
                          style={{ maxWidth: 120, borderColor: dirty ? 'var(--admin-accent)' : undefined }}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: margin >= 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                        {costNum > 0 ? `${margin}%` : '—'}
                      </td>
                      <td>
                        <button
                          className="admin-btn admin-btn-primary admin-btn-sm"
                          disabled={!dirty || savingId === row._id}
                          onClick={() => handleSave(row)}
                        >
                          {savingId === row._id ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
