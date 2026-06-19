'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineArrowDownTray, HiOutlineInformationCircle } from 'react-icons/hi2';
import adminApi, { formatPrice, formatDate } from '@/lib/adminApi';
import { exportToCsv, paiseToRupees } from '@/lib/exportCsv';
import { LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';

const PRESETS = [
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '90 Days' },
  { key: 'mtd', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const fmtLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function buildParams({ preset, from, to }) {
  if (preset === 'custom' && from && to) return { from, to };
  if (preset === 'mtd') {
    const now = new Date();
    return { from: fmtLocal(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmtLocal(now) };
  }
  return { days: parseInt(preset, 10) || 30 };
}

export default function AdminGstPage() {
  const [filters, setFilters] = useState({ preset: '30', from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => buildParams(filters), [filters]);
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await adminApi.gst.report(params);
      setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load GST report');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = data?.summary || {};
  const byDay = data?.byDay || [];
  const range = data?.range || {};

  const cards = [
    { label: 'Taxable Value', value: formatPrice(summary.taxableValue || 0) },
    { label: 'Tax Collected', value: formatPrice(summary.tax || 0) },
    { label: 'Total Collected', value: formatPrice(summary.total || 0) },
    { label: 'Orders', value: (summary.orders || 0).toLocaleString('en-IN') },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <div className="admin-page-kicker">Compliance</div>
          <h1 className="admin-page-title">GST Summary</h1>
          <div className="admin-page-subtitle">
            Taxable value and output tax on paid orders.
            {range.from && range.to && <> &nbsp;·&nbsp; <strong>{formatDate(range.from)} – {formatDate(range.to)}</strong></>}
          </div>
        </div>
        <RefreshButton onRefresh={() => fetchData({ silent: true })} />
      </div>

      <div className="admin-card" style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, preset: preset.key }))}
              className="admin-btn admin-btn-sm"
              style={{
                background: filters.preset === preset.key ? 'var(--admin-accent)' : 'var(--admin-surface)',
                color: filters.preset === preset.key ? '#fff' : 'var(--admin-text-secondary)',
                border: `1px solid ${filters.preset === preset.key ? 'transparent' : 'var(--admin-border)'}`,
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {filters.preset === 'custom' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="date" className="admin-input" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} />
            <span style={{ color: 'var(--admin-text-muted)' }}>to</span>
            <input type="date" className="admin-input" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} />
          </div>
        )}
      </div>

      <div className="admin-card" style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.6rem', alignItems: 'center', borderLeft: '3px solid var(--admin-info)' }}>
        <HiOutlineInformationCircle style={{ color: 'var(--admin-info)', fontSize: '1.3rem', flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)' }}>
          Orders currently store ₹0 tax (GST is not charged at checkout yet). This report is ready and will populate once tax is enabled.
        </span>
      </div>

      {error && (
        <div className="admin-error-panel" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => fetchData()}>Retry</button>
        </div>
      )}

      {loading && !data ? (
        <LoadingSkeleton rows={6} cols={4} />
      ) : (
        <>
          <div className="admin-dashboard-grid admin-animate-in" style={{ marginBottom: '1.5rem' }}>
            {cards.map((card) => (
              <div className="admin-card admin-stat-card" key={card.label}>
                <div className="admin-stat-body">
                  <div className="admin-stat-label">{card.label}</div>
                  <div className="admin-stat-value">{card.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="admin-card">
            <div className="admin-section-heading">
              <h3>By Day</h3>
              {byDay.length > 0 && (
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => exportToCsv(`gst-${fmtLocal(new Date())}`, byDay, [
                    { label: 'Date', key: '_id' },
                    { label: 'Taxable Value (₹)', map: (row) => paiseToRupees(row.taxableValue) },
                    { label: 'Tax (₹)', map: (row) => paiseToRupees(row.tax) },
                    { label: 'Orders', key: 'orders' },
                  ])}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <HiOutlineArrowDownTray /> CSV
                </button>
              )}
            </div>
            {byDay.length === 0 ? (
              <div className="admin-empty-compact">No paid orders in this period</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Date</th><th>Taxable Value</th><th>Tax</th><th>Orders</th></tr>
                  </thead>
                  <tbody>
                    {byDay.map((row) => (
                      <tr key={row._id}>
                        <td>{formatDate(row._id)}</td>
                        <td>{formatPrice(row.taxableValue || 0)}</td>
                        <td>{formatPrice(row.tax || 0)}</td>
                        <td>{row.orders || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
