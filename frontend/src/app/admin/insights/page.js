'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HiOutlineUsers,
  HiOutlineArrowPath,
  HiOutlineShoppingBag,
  HiOutlineCurrencyRupee,
  HiOutlineArrowDownTray,
} from 'react-icons/hi2';
import adminApi, { formatPrice, formatDate } from '@/lib/adminApi';
import { exportToCsv, paiseToRupees } from '@/lib/exportCsv';
import { StatCard, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';

const PRESETS = [
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '90 Days' },
  { key: 'mtd', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const SEGMENTS = [
  { key: 'champions', label: 'Champions', hint: '3+ orders, recent', color: 'var(--admin-success)' },
  { key: 'loyal', label: 'Loyal', hint: '2 orders, recent', color: 'var(--admin-info)' },
  { key: 'new', label: 'New', hint: '1 order, recent', color: 'var(--admin-accent)' },
  { key: 'at_risk', label: 'At Risk', hint: 'no order 60–120d', color: 'var(--admin-warning)' },
  { key: 'lost', label: 'Lost', hint: 'no order 120d+', color: 'var(--admin-danger)' },
];

const fmtLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function getErrorMessage(error, fallback = 'Failed to load customer insights') {
  return error?.response?.data?.message || error?.message || fallback;
}

function buildParams({ preset, from, to }) {
  if (preset === 'custom' && from && to) return { from, to };
  if (preset === 'mtd') {
    const now = new Date();
    return { from: fmtLocal(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmtLocal(now) };
  }
  return { days: parseInt(preset, 10) || 30 };
}

export default function AdminInsightsPage() {
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
      const res = await adminApi.customers.analytics(params);
      setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = data?.summary || {};
  const acquisition = data?.acquisition || { new: 0, returning: 0 };
  const segments = data?.segments || {};
  const topCustomers = data?.topCustomers || [];
  const range = data?.range || {};

  const statCards = [
    { label: 'Total Customers', value: (summary.totalCustomers || 0).toLocaleString('en-IN'), icon: <HiOutlineUsers />, color: 'var(--admin-info-soft)' },
    { label: 'Repeat Rate', value: `${summary.repeatRate ?? 0}%`, icon: <HiOutlineArrowPath />, color: 'var(--admin-success-soft)' },
    { label: 'Avg Orders / Customer', value: summary.avgOrders ?? 0, icon: <HiOutlineShoppingBag />, color: 'var(--admin-accent-soft)' },
    { label: 'Avg Customer Value', value: formatPrice(summary.avgLtv || 0), icon: <HiOutlineCurrencyRupee />, color: 'var(--admin-warning-soft)' },
  ];

  const acqTotal = (acquisition.new || 0) + (acquisition.returning || 0);
  const newPct = acqTotal > 0 ? Math.round((acquisition.new / acqTotal) * 100) : 0;
  const segMax = Math.max(...SEGMENTS.map((seg) => segments[seg.key] || 0), 1);

  const handleExport = () => {
    exportToCsv(`top-customers-${fmtLocal(new Date())}`, topCustomers, [
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Phone', key: 'phone' },
      { label: 'Orders', key: 'orders' },
      { label: 'Total Spent (₹)', map: (row) => paiseToRupees(row.spent) },
      { label: 'Last Order', map: (row) => formatDate(row.lastOrder) },
    ]);
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <div className="admin-page-kicker">Business</div>
          <h1 className="admin-page-title">Customer Insights</h1>
          <div className="admin-page-subtitle">
            Lifetime metrics are all-time; acquisition uses the selected range.
            {range.from && range.to && (
              <> &nbsp;·&nbsp; <strong>{formatDate(range.from)} – {formatDate(range.to)}</strong></>
            )}
          </div>
        </div>
        <RefreshButton onRefresh={() => fetchData({ silent: true })} />
      </div>

      {/* Date filter (drives acquisition) */}
      <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
            <input type="date" className="admin-input" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
            <span style={{ color: 'var(--admin-text-muted)' }}>to</span>
            <input type="date" className="admin-input" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
          </div>
        )}
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
          <div className="admin-dashboard-grid admin-animate-in" style={{ marginBottom: '1.75rem' }}>
            {statCards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>

          <div className="admin-dashboard-chart-grid admin-animate-in">
            {/* Acquisition */}
            <div className="admin-card">
              <div className="admin-section-heading">
                <div>
                  <h3>Acquisition</h3>
                  <div className="admin-section-subtitle">New vs returning buyers in the selected range.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1, padding: '1rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-accent-soft)' }}>
                  <div className="admin-stat-value" style={{ fontSize: '1.5rem' }}>{acquisition.new || 0}</div>
                  <div className="admin-row-meta">New customers</div>
                </div>
                <div style={{ flex: 1, padding: '1rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-info-soft)' }}>
                  <div className="admin-stat-value" style={{ fontSize: '1.5rem' }}>{acquisition.returning || 0}</div>
                  <div className="admin-row-meta">Returning customers</div>
                </div>
              </div>
              <div className="admin-progress" style={{ height: 10 }}>
                <div className="admin-progress-bar" style={{ width: `${newPct}%`, background: 'var(--admin-accent)' }} />
              </div>
              <div className="admin-chart-legend">
                <span>{newPct}% new</span>
                <span>{100 - newPct}% returning</span>
              </div>
            </div>

            {/* Segments */}
            <div className="admin-card">
              <div className="admin-section-heading">
                <div>
                  <h3>Segments (RFM-lite)</h3>
                  <div className="admin-section-subtitle">All registered buyers, by recency &amp; frequency.</div>
                </div>
              </div>
              <div className="admin-status-list">
                {SEGMENTS.map((seg) => {
                  const count = segments[seg.key] || 0;
                  const percent = Math.round((count / segMax) * 100);
                  return (
                    <div key={seg.key} className="admin-row">
                      <div style={{ width: 130 }}>
                        <div className="admin-row-title">{seg.label}</div>
                        <div className="admin-row-meta">{seg.hint}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="admin-progress">
                          <div className="admin-progress-bar" style={{ width: `${percent}%`, background: seg.color }} />
                        </div>
                      </div>
                      <span className="admin-row-value">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top customers */}
          <div className="admin-card admin-section-animate" style={{ marginTop: '1.75rem' }}>
            <div className="admin-section-heading">
              <div>
                <h3>Top Customers by Lifetime Value</h3>
                <span className="admin-section-subtitle">Highest total paid spend, all-time</span>
              </div>
              {topCustomers.length > 0 && (
                <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <HiOutlineArrowDownTray /> Export CSV
                </button>
              )}
            </div>
            {topCustomers.length === 0 ? (
              <div className="admin-empty-compact">No customer orders yet</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Orders</th>
                      <th>Total Spent</th>
                      <th>Last Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((customer, index) => (
                      <tr key={customer._id || index}>
                        <td style={{ color: 'var(--admin-text-muted)' }}>{index + 1}</td>
                        <td className="admin-row-title">{customer.name}</td>
                        <td className="admin-row-meta">{customer.email || customer.phone || '—'}</td>
                        <td>{customer.orders}</td>
                        <td className="admin-row-value">{formatPrice(customer.spent || 0)}</td>
                        <td style={{ color: 'var(--admin-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(customer.lastOrder)}</td>
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
