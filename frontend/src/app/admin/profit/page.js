'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineBanknotes,
  HiOutlineReceiptPercent,
  HiOutlineCurrencyRupee,
  HiOutlineCube,
  HiOutlineExclamationTriangle,
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

const fmtLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function getErrorMessage(error, fallback = 'Failed to load profit data') {
  return error?.response?.data?.message || error?.message || fallback;
}

function buildParams({ preset, from, to, city }) {
  const params = {};
  if (preset === 'custom' && from && to) {
    params.from = from;
    params.to = to;
  } else if (preset === 'mtd') {
    const now = new Date();
    params.from = fmtLocal(new Date(now.getFullYear(), now.getMonth(), 1));
    params.to = fmtLocal(now);
  } else {
    params.days = parseInt(preset, 10) || 30;
  }
  if (city) params.city = city;
  return params;
}

// Profit can dip below zero, so this chart scales across [min, max] with a
// visible zero baseline — unlike the revenue chart which assumes >= 0.
function ProfitChart({ data }) {
  if (!data.length) {
    return <div className="admin-empty-compact">No data in this period</div>;
  }

  const width = 600;
  const height = 210;
  const padX = 24;
  const top = 18;
  const bottom = 184;
  const values = data.map((item) => item.profit || 0);
  const maxV = Math.max(...values, 0);
  const minV = Math.min(...values, 0);
  const span = (maxV - minV) || 1;
  const yFor = (value) => bottom - ((value - minV) / span) * (bottom - top);
  const denominator = Math.max(data.length - 1, 1);
  const points = data.map((item, index) => ({
    x: padX + (index / denominator) * (width - padX * 2),
    y: yFor(item.profit || 0),
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const zeroY = yFor(0);
  const areaPath = `${linePath} L${points[points.length - 1].x},${zeroY} L${points[0].x},${zeroY} Z`;
  const totalProfit = values.reduce((sum, value) => sum + value, 0);
  const stroke = totalProfit >= 0 ? '#34d399' : '#f87171';

  return (
    <>
      <div className="admin-chart-frame">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Net profit trend">
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="4 4" />
          <path d={areaPath} fill="url(#profitFill)" />
          <path d={linePath} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {points.map((point, index) => (
            <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={index === points.length - 1 ? 4 : 2.5} fill={stroke} />
          ))}
        </svg>
      </div>
      <div className="admin-chart-legend">
        <span>{formatDate(data[0]?._id)} to {formatDate(data[data.length - 1]?._id)}</span>
        <span>{formatPrice(totalProfit)} net profit</span>
      </div>
    </>
  );
}

function FlowRow({ label, value, tone, strong }) {
  const color = tone === 'out' ? 'var(--admin-danger)' : tone === 'in' ? 'var(--admin-success)' : 'var(--admin-text)';
  return (
    <div className="admin-row" style={{ borderTop: strong ? '1px solid var(--admin-border)' : 'none', paddingTop: strong ? '0.6rem' : undefined }}>
      <span className="admin-row-title" style={{ flex: 1, fontWeight: strong ? 700 : 500 }}>{label}</span>
      <span className="admin-row-value" style={{ color, fontWeight: strong ? 800 : 600 }}>
        {tone === 'out' && value > 0 ? '− ' : ''}{formatPrice(Math.abs(value))}
      </span>
    </div>
  );
}

export default function AdminProfitPage() {
  const [filters, setFilters] = useState({ preset: '30', from: '', to: '', city: '' });
  const [data, setData] = useState(null);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    adminApi.delivery.getZones()
      .then((res) => {
        if (!active) return;
        setCities(Array.from(new Set((res.data.data || []).map((zone) => zone.city).filter(Boolean))).sort());
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const params = useMemo(() => buildParams(filters), [filters]);
  const paramsKey = JSON.stringify(params);

  const fetchProfit = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await adminApi.dashboard.getProfit(params);
      setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => { fetchProfit(); }, [fetchProfit]);

  const summary = data?.summary || {};
  const deltas = data?.deltas || {};
  const range = data?.range || {};
  const gatewayPct = data ? (data.gatewayFeeRate * 100).toFixed(2) : '2.36';

  const statCards = [
    { label: 'Net Profit', value: formatPrice(summary.netProfit || 0), icon: <HiOutlineBanknotes />, trend: deltas.netProfit, color: 'var(--admin-success-soft)' },
    { label: 'Margin', value: `${summary.margin ?? 0}%`, icon: <HiOutlineReceiptPercent />, color: 'var(--admin-accent-soft)' },
    { label: 'Gross Sales', value: formatPrice(summary.grossSales || 0), icon: <HiOutlineCurrencyRupee />, trend: deltas.grossSales, color: 'var(--admin-info-soft)' },
    { label: 'COGS', value: formatPrice(summary.cogs || 0), icon: <HiOutlineCube />, color: 'var(--admin-warning-soft)' },
  ];

  const coverage = summary.costCoverage ?? 0;
  const showCoverageWarning = data && summary.units > 0 && coverage < 100;
  const hasFilters = filters.city || filters.preset !== '30';

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <div className="admin-page-kicker">Business</div>
          <h1 className="admin-page-title">Profit &amp; Loss</h1>
          <div className="admin-page-subtitle">
            Net profit after cost of goods, discounts, and payment-gateway fees.
            {range.from && range.to && (
              <> &nbsp;·&nbsp; <strong>{formatDate(range.from)} – {formatDate(range.to)}</strong></>
            )}
          </div>
        </div>
        <RefreshButton onRefresh={() => fetchProfit({ silent: true })} />
      </div>

      {/* Filter bar */}
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

        <select className="admin-input admin-select" value={filters.city} onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))} style={{ maxWidth: 180 }}>
          <option value="">All Cities</option>
          {cities.map((city) => <option key={city} value={city}>{city}</option>)}
        </select>

        {hasFilters && (
          <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setFilters({ preset: '30', from: '', to: '', city: '' })}>
            ✕ Reset
          </button>
        )}

        <Link href="/admin/costs" className="admin-btn admin-btn-secondary admin-btn-sm" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
          Set Cost Prices →
        </Link>
      </div>

      {error && (
        <div className="admin-error-panel" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => fetchProfit()}>Retry</button>
        </div>
      )}

      {loading && !data ? (
        <LoadingSkeleton rows={6} cols={4} />
      ) : (
        <>
          {showCoverageWarning && (
            <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', borderLeft: '3px solid var(--admin-warning)' }}>
              <HiOutlineExclamationTriangle style={{ color: 'var(--admin-warning)', fontSize: '1.4rem', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--admin-text-secondary)' }}>
                Only <strong style={{ color: 'var(--admin-text)' }}>{coverage}%</strong> of sold units have a cost price set, so profit is <strong>overstated</strong>. Set the missing costs for an accurate figure.
              </div>
              <Link href="/admin/costs" className="admin-btn admin-btn-primary admin-btn-sm" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Fix costs
              </Link>
            </div>
          )}

          <div className="admin-dashboard-grid admin-animate-in" style={{ marginBottom: '0.5rem' }}>
            {statCards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>
          <div className="admin-section-subtitle" style={{ marginBottom: '1.5rem' }}>
            Trend vs the previous period of equal length. Margin = net profit ÷ gross sales.
          </div>

          <div className="admin-dashboard-chart-grid admin-animate-in">
            <div className="admin-card admin-chart-card">
              <div className="admin-section-heading">
                <div>
                  <h3>Profit Trend</h3>
                  <div className="admin-section-subtitle">Net profit by day.</div>
                </div>
              </div>
              <ProfitChart data={data?.profitByDay || []} />
            </div>

            <div className="admin-card">
              <div className="admin-section-heading">
                <h3>Money Flow</h3>
              </div>
              <div className="admin-status-list">
                <FlowRow label="Gross sales" value={summary.grossSales || 0} tone="in" />
                <FlowRow label="Cost of goods (COGS)" value={summary.cogs || 0} tone="out" />
                <FlowRow label="Discounts &amp; points" value={summary.discounts || 0} tone="out" />
                <FlowRow label={`Gateway fees (~${gatewayPct}%)`} value={summary.gatewayFees || 0} tone="out" />
                <FlowRow label="Net profit" value={summary.netProfit || 0} tone={(summary.netProfit || 0) >= 0 ? 'in' : 'out'} strong />
              </div>
              <div className="admin-section-subtitle" style={{ marginTop: '0.75rem' }}>
                Pass-through (not profit): GST {formatPrice(summary.tax || 0)} · Delivery {formatPrice(summary.deliveryCharge || 0)}.
              </div>
            </div>
          </div>

          <div className="admin-card admin-section-animate" style={{ marginTop: '1.75rem' }}>
            <div className="admin-section-heading">
              <div>
                <h3>Product Gross Margin</h3>
                <span className="admin-section-subtitle">Sell price minus cost, per product</span>
              </div>
              {(data?.topProducts || []).length > 0 && (
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => exportToCsv(`product-margins-${fmtLocal(new Date())}`, data.topProducts, [
                    { label: 'Product', map: (row) => row.name || 'Product' },
                    { label: 'Units', key: 'units' },
                    { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
                    { label: 'Cost (₹)', map: (row) => paiseToRupees(row.cost) },
                    { label: 'Profit (₹)', map: (row) => paiseToRupees(row.profit) },
                    { label: 'Margin (%)', map: (row) => Math.round(row.margin || 0) },
                  ])}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <HiOutlineArrowDownTray /> CSV
                </button>
              )}
            </div>
            {(data?.topProducts || []).length === 0 ? (
              <div className="admin-empty-compact">No product sales in this period</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units</th>
                      <th>Revenue</th>
                      <th>Cost</th>
                      <th>Profit</th>
                      <th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((product) => {
                      const noCost = !product.cost;
                      return (
                        <tr key={product._id || product.name}>
                          <td className="admin-row-title">{product.name || 'Product'}</td>
                          <td>{product.units || 0}</td>
                          <td>{formatPrice(product.revenue || 0)}</td>
                          <td>{noCost ? <span className="admin-pill admin-pill-guest">no cost set</span> : formatPrice(product.cost || 0)}</td>
                          <td className="admin-row-value">{formatPrice(product.profit || 0)}</td>
                          <td style={{ fontWeight: 700, color: (product.margin || 0) >= 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                            {Math.round(product.margin || 0)}%
                          </td>
                        </tr>
                      );
                    })}
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
