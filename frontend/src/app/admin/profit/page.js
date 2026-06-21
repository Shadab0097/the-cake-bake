'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  HiOutlineBanknotes,
  HiOutlineReceiptPercent,
  HiOutlineCurrencyRupee,
  HiOutlineCube,
  HiOutlineArrowDownTray,
  HiOutlineFunnel,
  HiOutlineMapPin,
  HiOutlineXMark,
  HiOutlineCalendarDays,
  HiOutlineAdjustmentsHorizontal,
  HiArrowTrendingUp,
  HiArrowTrendingDown,
  HiOutlineChevronUpDown,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
} from 'react-icons/hi2';
import adminApi, { formatPrice, formatDate } from '@/lib/adminApi';
import { exportToCsv, paiseToRupees } from '@/lib/exportCsv';
import { LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';
import AdminCombobox from '@/components/admin/AdminCombobox';
import AdminDateRangePicker from '@/components/admin/AdminDateRangePicker';
import { DashProfitTrend, DashDonut, MuiSpark, compactRupees } from '@/components/admin/AdminMuiCharts';

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

function buildParams({ preset, from, to, city, branchId }) {
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
  if (branchId) params.branchId = branchId;
  return params;
}

// Premium KPI card — icon chip, big value, trend pill, daily sparkline, footer.
// `trendUnit` is '%' for ratios or 'pts' for the margin point-difference.
function ProfitKpiCard({ label, value, previous, icon, tone, spark, trend, trendUnit = '%' }) {
  const hasTrend = trend !== null && trend !== undefined;
  const direction = !hasTrend || trend === 0 ? 'flat' : trend > 0 ? 'up' : 'down';
  return (
    <div className={`admin-card admin-kpi-card tone-${tone}`}>
      <div className="admin-kpi-top">
        <span className="admin-kpi-icon">{icon}</span>
        <span className={`admin-kpi-trend is-${direction}`}>
          {direction === 'up' && <HiArrowTrendingUp aria-hidden />}
          {direction === 'down' && <HiArrowTrendingDown aria-hidden />}
          {hasTrend ? `${trend > 0 ? '+' : ''}${trend}${trendUnit === 'pts' ? ' pts' : '%'}` : 'New'}
        </span>
      </div>
      <div className="admin-kpi-value">{value}</div>
      <div className="admin-kpi-label">{label}</div>
      <MuiSpark data={spark} color={tone} />
      <div className="admin-kpi-foot">
        <span className="admin-kpi-foot-label">vs prev</span>
        <span className="admin-kpi-foot-value">{previous}</span>
      </div>
    </div>
  );
}

// One line of the money-flow waterfall, with a share-of-gross bar.
function FlowRow({ label, value, tone, gross, strong }) {
  const color = tone === 'out' ? 'var(--admin-danger)' : tone === 'in' ? 'var(--admin-success)' : 'var(--admin-text)';
  const pct = gross > 0 ? Math.min(100, Math.round((Math.abs(value) / gross) * 100)) : 0;
  return (
    <div className={`admin-flow-row ${strong ? 'is-strong' : ''}`}>
      <div className="admin-flow-row-head">
        <span className="admin-flow-row-label">{label}</span>
        <span className="admin-flow-row-value" style={{ color }}>
          {tone === 'out' && value > 0 ? '− ' : ''}{formatPrice(Math.abs(value))}
        </span>
      </div>
      <span className="admin-flow-bar">
        <span className="admin-flow-fill" style={{ width: `${pct}%`, background: color }} />
      </span>
    </div>
  );
}

// Sortable column header (ARIA-correct) for the product-margin table.
function SortHeader({ label, columnKey, sort, onSort, numeric = false, width }) {
  const active = sort.key === columnKey;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th className={numeric ? 'admin-num' : undefined} aria-sort={ariaSort} style={width ? { width } : undefined}>
      <button type="button" className={`admin-th-sort ${active ? 'active' : ''}`} onClick={() => onSort(columnKey)}>
        <span>{label}</span>
        {active
          ? (sort.dir === 'asc' ? <HiOutlineChevronUp aria-hidden /> : <HiOutlineChevronDown aria-hidden />)
          : <HiOutlineChevronUpDown aria-hidden />}
      </button>
    </th>
  );
}

// Margin shown as a 0–100 bar + colored percentage (loss bars clamp to 0).
function MarginCell({ margin }) {
  const pct = Math.max(0, Math.min(100, Math.round(margin || 0)));
  const positive = (margin || 0) >= 0;
  return (
    <div className={`admin-margin-cell ${positive ? 'is-pos' : 'is-neg'}`}>
      <span className="admin-margin-track">
        <span className="admin-margin-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="admin-margin-pct">{Math.round(margin || 0)}%</span>
    </div>
  );
}

export default function AdminProfitPage() {
  const [filters, setFilters] = useState({ preset: '30', from: '', to: '', city: '', branchId: '' });
  const [data, setData] = useState(null);
  const [cities, setCities] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'profit', dir: 'desc' });

  useEffect(() => {
    let active = true;
    Promise.all([
      adminApi.delivery.getZones(),
      adminApi.delivery.getBranches().catch(() => ({ data: { data: [] } })),
    ])
      .then(([zonesRes, branchesRes]) => {
        if (!active) return;
        setCities(Array.from(new Set((zonesRes.data.data || []).map((zone) => zone.city).filter(Boolean))).sort());
        setBranches((branchesRes.data.data || []).filter((b) => b.isActive !== false));
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

  const summary = useMemo(() => data?.summary || {}, [data]);
  const previous = data?.previous || {};
  const deltas = data?.deltas || {};
  const range = data?.range || {};
  const gatewayPct = data ? (data.gatewayFeeRate * 100).toFixed(2) : '2.36';
  const profitByDay = useMemo(() => data?.profitByDay || [], [data]);

  // Daily series for each KPI sparkline (values arrive in paise).
  const sparks = useMemo(() => ({
    netProfit: profitByDay.map((d) => (d.profit || 0) / 100),
    grossSales: profitByDay.map((d) => (d.grossSales || 0) / 100),
    cogs: profitByDay.map((d) => (d.cogs || 0) / 100),
    margin: profitByDay.map((d) => (d.grossSales > 0 ? (d.profit / d.grossSales) * 100 : 0)),
  }), [profitByDay]);

  const kpis = [
    { key: 'net', label: 'Net Profit', value: formatPrice(summary.netProfit || 0), previous: formatPrice(previous.netProfit || 0), icon: <HiOutlineBanknotes />, tone: 'success', trend: deltas.netProfit, spark: sparks.netProfit },
    { key: 'margin', label: 'Margin', value: `${summary.margin ?? 0}%`, previous: `${previous.margin ?? 0}%`, icon: <HiOutlineReceiptPercent />, tone: 'accent', trend: deltas.margin, trendUnit: 'pts', spark: sparks.margin },
    { key: 'gross', label: 'Gross Sales', value: formatPrice(summary.grossSales || 0), previous: formatPrice(previous.grossSales || 0), icon: <HiOutlineCurrencyRupee />, tone: 'info', trend: deltas.grossSales, spark: sparks.grossSales },
    { key: 'cogs', label: 'COGS', value: formatPrice(summary.cogs || 0), previous: formatPrice(previous.cogs || 0), icon: <HiOutlineCube />, tone: 'violet', trend: null, spark: sparks.cogs },
  ];

  const products = useMemo(() => (data?.topProducts || []).map((p) => ({
    id: p._id || p.name,
    label: p.name || 'Product',
    units: p.units || 0,
    revenue: p.revenue || 0,
    cost: p.cost || 0,
    hasCost: !!p.cost,
    profit: p.profit || 0,
    margin: p.margin || 0,
  })), [data]);

  const sortedProducts = useMemo(() => {
    const rows = [...products];
    const { key, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (key === 'label') return mul * String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
      return mul * ((a[key] || 0) - (b[key] || 0));
    });
    return rows;
  }, [products, sort]);

  const onSort = useCallback((key) => {
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'label' ? 'asc' : 'desc' }));
  }, []);

  const cityOptions = useMemo(() => cities.map((c) => ({ value: c, label: c })), [cities]);
  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b._id, label: b.code ? `${b.name} (${b.code})` : b.name })),
    [branches],
  );
  const branchName = useMemo(
    () => branches.find((b) => b._id === filters.branchId)?.name || '',
    [branches, filters.branchId],
  );

  const exportSummary = useCallback(() => {
    if (!data) return;
    const s = data.summary || {};
    const rows = [
      { metric: 'Gross Sales', value: paiseToRupees(s.grossSales || 0) },
      { metric: 'COGS', value: paiseToRupees(s.cogs || 0) },
      { metric: 'Discounts & Points', value: paiseToRupees(s.discounts || 0) },
      { metric: 'Gateway Fees', value: paiseToRupees(s.gatewayFees || 0) },
      { metric: 'Net Profit', value: paiseToRupees(s.netProfit || 0) },
      { metric: 'Margin (%)', value: s.margin ?? 0 },
      { metric: 'GST (pass-through)', value: paiseToRupees(s.tax || 0) },
      { metric: 'Delivery (pass-through)', value: paiseToRupees(s.deliveryCharge || 0) },
    ];
    exportToCsv(`profit-summary-${fmtLocal(new Date())}`, rows, [
      { label: 'Metric', key: 'metric' },
      { label: 'Value', key: 'value' },
    ]);
  }, [data]);

  const coverage = summary.costCoverage ?? 0;
  const coverageLow = data && summary.units > 0 && coverage < 100;
  const hasFilters = filters.city || filters.branchId || filters.preset !== '30';

  // Where gross sales goes — donut slices (net profit only when positive).
  const breakdown = useMemo(() => [
    { id: 'cogs', label: 'COGS', value: summary.cogs || 0, color: '#A78BFA' },
    { id: 'discounts', label: 'Discounts', value: summary.discounts || 0, color: '#F59E0B' },
    { id: 'fees', label: 'Gateway fees', value: summary.gatewayFees || 0, color: '#60A5FA' },
    ...((summary.netProfit || 0) > 0 ? [{ id: 'net', label: 'Net profit', value: summary.netProfit, color: '#22C55E' }] : []),
  ], [summary]);

  return (
    <div>
      <div className="admin-page-header admin-sales-header">
        <div className="admin-page-heading">
          <div className="admin-page-kicker">Business · Analytics</div>
          <h1 className="admin-page-title admin-title-gradient">Profit &amp; Loss</h1>
          <div className="admin-page-subtitle">
            Net profit after cost of goods, discounts, and payment-gateway fees.
          </div>
        </div>
        <div className="admin-page-actions">
          {range.from && range.to && (
            <span className="admin-range-pill" title="Active reporting window">
              <HiOutlineCalendarDays aria-hidden />
              {formatDate(range.from)} – {formatDate(range.to)}
            </span>
          )}
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={exportSummary} disabled={!data}>
            <HiOutlineArrowDownTray aria-hidden /> Export
          </button>
          <Link href="/admin/costs" className="admin-btn admin-btn-secondary admin-btn-sm" style={{ textDecoration: 'none' }}>
            <HiOutlineAdjustmentsHorizontal aria-hidden /> Set Costs
          </Link>
          <RefreshButton onRefresh={() => fetchProfit({ silent: true })} />
        </div>
      </div>

      {/* Premium filter panel */}
      <div className="admin-card admin-filter-panel">
        <div className="admin-filter-panel-head">
          <div className="admin-filter-panel-title">
            <HiOutlineFunnel aria-hidden />
            <span>Filters</span>
          </div>
          <div className="admin-filter-chips">
            {filters.branchId && (
              <button type="button" className="admin-filter-chip" onClick={() => setFilters((prev) => ({ ...prev, branchId: '' }))}>
                <HiOutlineMapPin aria-hidden /> {branchName || 'Branch'} <HiOutlineXMark aria-hidden />
              </button>
            )}
            {filters.city && (
              <button type="button" className="admin-filter-chip" onClick={() => setFilters((prev) => ({ ...prev, city: '' }))}>
                <HiOutlineMapPin aria-hidden /> {filters.city} <HiOutlineXMark aria-hidden />
              </button>
            )}
          </div>
          {hasFilters && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm admin-filter-reset"
              onClick={() => setFilters({ preset: '30', from: '', to: '', city: '', branchId: '' })}
            >
              <HiOutlineXMark aria-hidden /> Reset
            </button>
          )}
        </div>

        <div className="admin-filter-panel-fields">
          <div className="admin-filter-field">
            <span className="admin-filter-label">Period</span>
            <div className="admin-range-switch" role="group" aria-label="Select profit period">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`admin-range-btn ${filters.preset === preset.key ? 'active' : ''}`}
                  onClick={() => setFilters((prev) => ({ ...prev, preset: preset.key }))}
                  aria-pressed={filters.preset === preset.key}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {filters.preset === 'custom' && (
            <div className="admin-filter-field">
              <span className="admin-filter-label">Range</span>
              <AdminDateRangePicker
                from={filters.from}
                to={filters.to}
                max={fmtLocal(new Date())}
                onChange={({ from, to }) => setFilters((prev) => ({ ...prev, from, to }))}
              />
            </div>
          )}

          {branchOptions.length > 0 && (
            <div className="admin-filter-field">
              <span className="admin-filter-label">Branch</span>
              <AdminCombobox
                ariaLabel="Filter by branch"
                value={filters.branchId}
                onChange={(branchId) => setFilters((prev) => ({ ...prev, branchId }))}
                options={branchOptions}
                emptyLabel="All Branches"
                placeholder="All Branches"
                searchPlaceholder="Search branches…"
                leadingIcon={<HiOutlineMapPin aria-hidden />}
              />
            </div>
          )}

          <div className="admin-filter-field">
            <span className="admin-filter-label">City</span>
            <AdminCombobox
              ariaLabel="Filter by city"
              value={filters.city}
              onChange={(city) => setFilters((prev) => ({ ...prev, city }))}
              options={cityOptions}
              emptyLabel="All Cities"
              placeholder="All Cities"
              searchPlaceholder="Search cities…"
              leadingIcon={<HiOutlineMapPin aria-hidden />}
            />
          </div>
        </div>
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
          <div className="admin-kpi-grid admin-animate-in">
            {kpis.map((card) => <ProfitKpiCard key={card.key} {...card} />)}
          </div>
          <div className="admin-section-subtitle" style={{ marginBottom: '1.5rem' }}>
            Trend vs the previous period of equal length. Margin = net profit ÷ gross sales.
          </div>

          <div className="admin-dashboard-chart-grid admin-animate-in">
            <div className="admin-card admin-chart-card">
              <div className="admin-chart-head">
                <div className="admin-chart-head-titles">
                  <h3>Profit Trend</h3>
                  <div className="admin-section-subtitle">Net profit by day — green above the line, red below.</div>
                </div>
              </div>
              <div className="admin-chart-body">
                <DashProfitTrend data={profitByDay} height={300} />
              </div>
            </div>

            <div className="admin-card admin-chart-card">
              <div className="admin-chart-head">
                <div className="admin-chart-head-titles">
                  <h3>Where Gross Sales Goes</h3>
                  <div className="admin-section-subtitle">Share of gross sales by cost &amp; profit.</div>
                </div>
              </div>
              <div className="admin-chart-body">
                <DashDonut
                  data={breakdown}
                  valueKind="currency"
                  height={260}
                  centerValue={compactRupees((summary.grossSales || 0) / 100)}
                  centerCaption="Gross"
                  emptyMessage="No sales in this period"
                />
              </div>
            </div>
          </div>

          <div className="admin-card admin-animate-in">
            <div className="admin-section-heading">
              <h3>Money Flow</h3>
            </div>
            <div className="admin-flow-list">
              <FlowRow label="Gross sales" value={summary.grossSales || 0} tone="in" gross={summary.grossSales || 0} />
              <FlowRow label="Cost of goods (COGS)" value={summary.cogs || 0} tone="out" gross={summary.grossSales || 0} />
              <FlowRow label="Discounts &amp; points" value={summary.discounts || 0} tone="out" gross={summary.grossSales || 0} />
              <FlowRow label={`Gateway fees (~${gatewayPct}%)`} value={summary.gatewayFees || 0} tone="out" gross={summary.grossSales || 0} />
              <FlowRow label="Net profit" value={summary.netProfit || 0} tone={(summary.netProfit || 0) >= 0 ? 'in' : 'out'} gross={summary.grossSales || 0} strong />
            </div>

            <div className={`admin-coverage ${coverageLow ? 'is-low' : ''}`}>
              <div className="admin-coverage-head">
                <span>Cost coverage</span>
                <span className="admin-coverage-pct">{coverage}%</span>
              </div>
              <span className="admin-coverage-bar">
                <span className="admin-coverage-fill" style={{ width: `${Math.min(100, coverage)}%` }} />
              </span>
              {coverageLow ? (
                <div className="admin-coverage-note">
                  Profit overstated — <Link href="/admin/costs" className="admin-link">set missing costs</Link>.
                </div>
              ) : (
                <div className="admin-section-subtitle" style={{ marginTop: '0.4rem' }}>
                  Pass-through: GST {formatPrice(summary.tax || 0)} · Delivery {formatPrice(summary.deliveryCharge || 0)}.
                </div>
              )}
            </div>
          </div>

          <div className="admin-card admin-records-card" style={{ marginTop: '1.75rem' }}>
            <div className="admin-records-head">
              <div className="admin-chart-head-titles">
                <h3>Product Gross Margin</h3>
                <div className="admin-section-subtitle">Sell price minus cost, per product — click a column to sort.</div>
              </div>
              <button
                className="admin-btn admin-btn-secondary admin-btn-sm"
                disabled={products.length === 0}
                onClick={() => exportToCsv(`product-margins-${fmtLocal(new Date())}`, data.topProducts, [
                  { label: 'Product', map: (row) => row.name || 'Product' },
                  { label: 'Units', key: 'units' },
                  { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
                  { label: 'Cost (₹)', map: (row) => paiseToRupees(row.cost) },
                  { label: 'Profit (₹)', map: (row) => paiseToRupees(row.profit) },
                  { label: 'Margin (%)', map: (row) => Math.round(row.margin || 0) },
                ])}
              >
                <HiOutlineArrowDownTray /> CSV
              </button>
            </div>

            {products.length === 0 ? (
              <div className="admin-chart-empty">No product sales in this period</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-records-table">
                  <thead>
                    <tr>
                      <th style={{ width: 48 }}>#</th>
                      <SortHeader label="Product" columnKey="label" sort={sort} onSort={onSort} />
                      <SortHeader label="Units" columnKey="units" sort={sort} onSort={onSort} numeric />
                      <SortHeader label="Revenue" columnKey="revenue" sort={sort} onSort={onSort} numeric />
                      <SortHeader label="Cost" columnKey="cost" sort={sort} onSort={onSort} numeric />
                      <SortHeader label="Profit" columnKey="profit" sort={sort} onSort={onSort} numeric />
                      <SortHeader label="Margin" columnKey="margin" sort={sort} onSort={onSort} width={160} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((row, i) => (
                      <tr key={row.id}>
                        <td className="admin-records-rank">{i + 1}</td>
                        <td className="admin-records-name">{row.label}</td>
                        <td className="admin-num">{row.units.toLocaleString('en-IN')}</td>
                        <td className="admin-num">{formatPrice(row.revenue)}</td>
                        <td className="admin-num">
                          {row.hasCost ? formatPrice(row.cost) : <span className="admin-pill admin-pill-guest">no cost set</span>}
                        </td>
                        <td className="admin-num admin-records-revenue">{formatPrice(row.profit)}</td>
                        <td><MarginCell margin={row.margin} /></td>
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
