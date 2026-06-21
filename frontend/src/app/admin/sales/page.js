'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HiOutlineCurrencyRupee,
  HiOutlineShoppingBag,
  HiOutlineReceiptPercent,
  HiOutlineCube,
  HiOutlineArrowDownTray,
  HiOutlineFunnel,
  HiOutlineSparkles,
  HiOutlineMapPin,
  HiOutlineCalendarDays,
  HiOutlineTableCells,
  HiArrowTrendingUp,
  HiArrowTrendingDown,
  HiOutlineXMark,
  HiOutlineChevronUpDown,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
} from 'react-icons/hi2';
import adminApi, { formatPrice, formatDate } from '@/lib/adminApi';
import { exportToCsv, paiseToRupees } from '@/lib/exportCsv';
import { LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';
import AdminCombobox from '@/components/admin/AdminCombobox';
import AdminDateRangePicker from '@/components/admin/AdminDateRangePicker';
import {
  DashRevenueTrend,
  DashTopBars,
  DashDonut,
  MuiSpark,
  compactRupees,
} from '@/components/admin/AdminMuiCharts';

const PRESETS = [
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '90 Days' },
  { key: 'mtd', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

// Detailed-records table dimensions. Each maps to one slice of the sales payload.
const TABLE_DIMENSIONS = [
  { key: 'products', label: 'Products', icon: <HiOutlineCube /> },
  { key: 'addons', label: 'Add-ons', icon: <HiOutlineSparkles /> },
  { key: 'cities', label: 'Cities', icon: <HiOutlineMapPin /> },
  { key: 'daily', label: 'Daily', icon: <HiOutlineCalendarDays /> },
];

const fmtLocal = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function getErrorMessage(error, fallback = 'Failed to load sales data') {
  return error?.response?.data?.message || error?.message || fallback;
}

// Translate the filter UI into backend query params.
function buildParams({ preset, from, to, city, product, branchId }) {
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
  if (product) params.product = product;
  if (branchId) params.branchId = branchId;
  return params;
}

function SalesChartCard({ title, subtitle, action, keys, children }) {
  return (
    <div className="admin-card admin-chart-card">
      <div className="admin-chart-head">
        <div className="admin-chart-head-titles">
          <h3>{title}</h3>
          {subtitle && <div className="admin-section-subtitle">{subtitle}</div>}
        </div>
        {(keys || action) && (
          <div className="admin-chart-head-actions">
            {keys}
            {action}
          </div>
        )}
      </div>
      <div className="admin-chart-body">{children}</div>
    </div>
  );
}

// Premium KPI card — icon chip, big value, trend pill, daily sparkline, and
// a "vs previous period" footer. The sparkline is tone-matched to the metric.
function SalesKpiCard({ label, value, previous, icon, trend, tone, spark, sparkColor }) {
  const hasTrend = trend !== null && trend !== undefined;
  const direction = !hasTrend || trend === 0 ? 'flat' : trend > 0 ? 'up' : 'down';
  return (
    <div className={`admin-card admin-kpi-card tone-${tone}`}>
      <div className="admin-kpi-top">
        <span className="admin-kpi-icon">{icon}</span>
        <span className={`admin-kpi-trend is-${direction}`}>
          {direction === 'up' && <HiArrowTrendingUp aria-hidden />}
          {direction === 'down' && <HiArrowTrendingDown aria-hidden />}
          {hasTrend ? `${trend > 0 ? '+' : ''}${trend}%` : 'New'}
        </span>
      </div>
      <div className="admin-kpi-value">{value}</div>
      <div className="admin-kpi-label">{label}</div>
      <MuiSpark data={spark} color={sparkColor || tone} />
      <div className="admin-kpi-foot">
        <span className="admin-kpi-foot-label">vs prev</span>
        <span className="admin-kpi-foot-value">{previous}</span>
      </div>
    </div>
  );
}

// Clickable, ARIA-correct sortable column header for the records table.
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

// Mini share-of-total bar used inside the detailed-records table.
function ShareCell({ value, total, tone = 'accent' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`admin-share tone-${tone}`}>
      <span className="admin-share-track">
        <span className="admin-share-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </span>
      <span className="admin-share-pct">{pct}%</span>
    </div>
  );
}

export default function AdminSalesPage() {
  const [filters, setFilters] = useState({ preset: '30', from: '', to: '', city: '', product: '', branchId: '' });
  const [data, setData] = useState(null);
  const [cities, setCities] = useState([]);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableDim, setTableDim] = useState('products');

  // Load filter options (serviceable cities + product catalogue) once.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [zonesRes, productsRes, branchesRes] = await Promise.all([
          adminApi.delivery.getZones(),
          adminApi.products.list({ limit: 100 }),
          adminApi.delivery.getBranches().catch(() => ({ data: { data: [] } })),
        ]);
        if (!active) return;
        const zoneCities = Array.from(new Set((zonesRes.data.data || []).map((zone) => zone.city).filter(Boolean))).sort();
        setCities(zoneCities);
        setBranches((branchesRes.data.data || []).filter((b) => b.isActive !== false));
        const productList = (productsRes.data.data?.items || [])
          .map((product) => ({ _id: product._id, name: product.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setProducts(productList);
      } catch {
        // Filter options are non-critical; the page still works without them.
      }
    })();
    return () => { active = false; };
  }, []);

  const params = useMemo(() => buildParams(filters), [filters]);
  const paramsKey = JSON.stringify(params);

  const fetchSales = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await adminApi.dashboard.getSales(params);
      setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const summary = data?.summary || {};
  const previous = data?.previous || {};
  const deltas = data?.deltas || {};
  const range = data?.range || {};

  const revenueByDay = useMemo(() => data?.revenueByDay || [], [data]);

  // Daily series powering each KPI's sparkline (revenue arrives in paise).
  const sparks = useMemo(() => ({
    revenue: revenueByDay.map((day) => (day.revenue || 0) / 100),
    orders: revenueByDay.map((day) => day.orders || 0),
    aov: revenueByDay.map((day) => (day.orders > 0 ? day.revenue / day.orders : 0) / 100),
    units: revenueByDay.map((day) => day.units || 0),
  }), [revenueByDay]);

  const kpis = [
    {
      key: 'revenue',
      label: 'Revenue',
      value: formatPrice(summary.revenue || 0),
      previous: formatPrice(previous.revenue || 0),
      icon: <HiOutlineCurrencyRupee />,
      trend: deltas.revenue,
      tone: 'accent',
      spark: sparks.revenue,
    },
    {
      key: 'orders',
      label: 'Orders',
      value: (summary.orders || 0).toLocaleString('en-IN'),
      previous: (previous.orders || 0).toLocaleString('en-IN'),
      icon: <HiOutlineShoppingBag />,
      trend: deltas.orders,
      tone: 'info',
      spark: sparks.orders,
    },
    {
      key: 'aov',
      label: 'Avg Order Value',
      value: formatPrice(summary.aov || 0),
      previous: formatPrice(previous.aov || 0),
      icon: <HiOutlineReceiptPercent />,
      trend: deltas.aov,
      tone: 'success',
      spark: sparks.aov,
    },
    {
      key: 'units',
      label: 'Units Sold',
      value: (summary.units || 0).toLocaleString('en-IN'),
      previous: (previous.units || 0).toLocaleString('en-IN'),
      icon: <HiOutlineCube />,
      trend: deltas.units,
      tone: 'violet',
      spark: sparks.units,
    },
  ];

  const productSeries = useMemo(
    () => (data?.topProducts || []).slice(0, 8).map((row) => ({
      name: row.name || 'Product',
      value: (row.revenue || 0) / 100,
      units: row.units || 0,
      orders: row.orders || 0,
    })),
    [data],
  );

  const citySeries = useMemo(
    () => (data?.topCities || []).filter((row) => row._id).slice(0, 8).map((row) => ({
      name: row._id || 'Unknown',
      value: (row.revenue || 0) / 100,
      orders: row.orders || 0,
    })),
    [data],
  );

  const addonSeries = useMemo(
    () => (data?.topAddons || []).filter((row) => row._id).slice(0, 8).map((row) => ({
      name: row._id || 'Add-on',
      value: (row.revenue || 0) / 100,
      units: row.units || 0,
      orders: row.orders || 0,
    })),
    [data],
  );

  // Shape every dimension into uniform table rows once per payload.
  const tableModel = useMemo(() => ({
    products: (data?.topProducts || []).map((row, i) => ({
      rank: i + 1, label: row.name || 'Product', units: row.units || 0, orders: row.orders || 0, revenue: row.revenue || 0,
    })),
    addons: (data?.topAddons || []).filter((row) => row._id).map((row, i) => ({
      rank: i + 1, label: row._id || 'Add-on', units: row.units || 0, orders: row.orders || 0, revenue: row.revenue || 0,
    })),
    cities: (data?.topCities || []).filter((row) => row._id).map((row, i) => ({
      rank: i + 1, label: row._id || 'Unknown', orders: row.orders || 0, revenue: row.revenue || 0,
    })),
    daily: (data?.revenueByDay || []).map((row) => ({
      label: row._id, orders: row.orders || 0, revenue: row.revenue || 0,
    })),
  }), [data]);

  const activeRows = useMemo(() => tableModel[tableDim] || [], [tableModel, tableDim]);
  const activeTone = tableDim === 'addons' ? 'violet' : tableDim === 'cities' ? 'info' : 'accent';
  const activeRevenueTotal = useMemo(
    () => activeRows.reduce((sum, row) => sum + (row.revenue || 0), 0),
    [activeRows],
  );

  // Sortable detailed-records table. Columns differ per dimension, so reset to
  // the default (revenue, high→low) whenever the dimension changes.
  const [sort, setSort] = useState({ key: 'revenue', dir: 'desc' });
  useEffect(() => { setSort({ key: 'revenue', dir: 'desc' }); }, [tableDim]);

  const sortedRows = useMemo(() => {
    const rows = [...activeRows];
    const { key, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (key === 'label') {
        return mul * String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
      }
      return mul * ((a[key] || 0) - (b[key] || 0));
    });
    return rows;
  }, [activeRows, sort]);

  const onSort = useCallback((key) => {
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'label' ? 'asc' : 'desc' }));
  }, []);

  const exportTable = useCallback(() => {
    const stamp = fmtLocal(new Date());
    if (tableDim === 'products') {
      exportToCsv(`sales-products-${stamp}`, data?.topProducts || [], [
        { label: 'Product', map: (row) => row.name || 'Product' },
        { label: 'Units', key: 'units' },
        { label: 'Orders', key: 'orders' },
        { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
      ]);
    } else if (tableDim === 'addons') {
      exportToCsv(`sales-addons-${stamp}`, data?.topAddons || [], [
        { label: 'Add-on', map: (row) => row._id || 'Add-on' },
        { label: 'Units', key: 'units' },
        { label: 'Orders', key: 'orders' },
        { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
      ]);
    } else if (tableDim === 'cities') {
      exportToCsv(`sales-cities-${stamp}`, data?.topCities || [], [
        { label: 'City', map: (row) => row._id || 'Unknown' },
        { label: 'Orders', key: 'orders' },
        { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
      ]);
    } else {
      exportToCsv(`sales-daily-${stamp}`, data?.revenueByDay || [], [
        { label: 'Date', map: (row) => row._id },
        { label: 'Orders', key: 'orders' },
        { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
      ]);
    }
  }, [tableDim, data]);

  // One-click export of the four headline KPIs (current vs previous period).
  const exportSummary = useCallback(() => {
    if (!data) return;
    const s = data.summary || {};
    const p = data.previous || {};
    const d = data.deltas || {};
    const rows = [
      { metric: 'Revenue', value: paiseToRupees(s.revenue || 0), previous: paiseToRupees(p.revenue || 0), change: d.revenue },
      { metric: 'Orders', value: s.orders || 0, previous: p.orders || 0, change: d.orders },
      { metric: 'Avg Order Value', value: paiseToRupees(s.aov || 0), previous: paiseToRupees(p.aov || 0), change: d.aov },
      { metric: 'Units Sold', value: s.units || 0, previous: p.units || 0, change: d.units },
    ];
    exportToCsv(`sales-summary-${fmtLocal(new Date())}`, rows, [
      { label: 'Metric', key: 'metric' },
      { label: 'Value', key: 'value' },
      { label: 'Previous', key: 'previous' },
      { label: 'Change (%)', map: (row) => (row.change === null || row.change === undefined ? 'New' : row.change) },
    ]);
  }, [data]);

  const cityOptions = useMemo(() => cities.map((c) => ({ value: c, label: c })), [cities]);
  const branchOptions = useMemo(
    () => branches.map((b) => ({ value: b._id, label: b.code ? `${b.name} (${b.code})` : b.name })),
    [branches],
  );
  const productOptions = useMemo(
    () => products.map((p) => ({ value: p._id, label: p.name })),
    [products],
  );

  const productName = useMemo(
    () => products.find((p) => p._id === filters.product)?.name || '',
    [products, filters.product],
  );
  const branchName = useMemo(
    () => branches.find((b) => b._id === filters.branchId)?.name || '',
    [branches, filters.branchId],
  );

  const hasFilters = filters.city || filters.product || filters.branchId || filters.preset !== '30';

  return (
    <div>
      <div className="admin-page-header admin-sales-header">
        <div className="admin-page-heading">
          <div className="admin-page-kicker">Business · Analytics</div>
          <h1 className="admin-page-title admin-title-gradient">Sales</h1>
          <div className="admin-page-subtitle">
            Revenue, products, add-ons, and locations — filter by date range, city, and product.
          </div>
        </div>
        <div className="admin-page-actions">
          {range.from && range.to && (
            <span className="admin-range-pill" title="Active reporting window">
              <HiOutlineCalendarDays aria-hidden />
              {formatDate(range.from)} – {formatDate(range.to)}
            </span>
          )}
          <button
            type="button"
            className="admin-btn admin-btn-secondary admin-btn-sm"
            onClick={exportSummary}
            disabled={!data}
          >
            <HiOutlineArrowDownTray aria-hidden /> Export
          </button>
          <RefreshButton onRefresh={() => fetchSales({ silent: true })} />
        </div>
      </div>

      {/* Filter panel */}
      <div className="admin-card admin-filter-panel">
        <div className="admin-filter-panel-head">
          <div className="admin-filter-panel-title">
            <HiOutlineFunnel aria-hidden />
            <span>Filters</span>
          </div>
          <div className="admin-filter-chips">
            {filters.branchId && (
              <button
                type="button"
                className="admin-filter-chip"
                onClick={() => setFilters((prev) => ({ ...prev, branchId: '' }))}
              >
                <HiOutlineMapPin aria-hidden /> {branchName || 'Branch'} <HiOutlineXMark aria-hidden />
              </button>
            )}
            {filters.city && (
              <button
                type="button"
                className="admin-filter-chip"
                onClick={() => setFilters((prev) => ({ ...prev, city: '' }))}
              >
                <HiOutlineMapPin aria-hidden /> {filters.city} <HiOutlineXMark aria-hidden />
              </button>
            )}
            {filters.product && (
              <button
                type="button"
                className="admin-filter-chip"
                onClick={() => setFilters((prev) => ({ ...prev, product: '' }))}
              >
                <HiOutlineCube aria-hidden /> {productName || 'Product'} <HiOutlineXMark aria-hidden />
              </button>
            )}
          </div>
          {hasFilters && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm admin-filter-reset"
              onClick={() => setFilters({ preset: '30', from: '', to: '', city: '', product: '', branchId: '' })}
            >
              <HiOutlineXMark aria-hidden /> Reset
            </button>
          )}
        </div>

        <div className="admin-filter-panel-fields">
          <div className="admin-filter-field">
            <span className="admin-filter-label">Period</span>
            <div className="admin-range-switch" role="group" aria-label="Select sales period">
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

          <div className="admin-filter-field">
            <span className="admin-filter-label">Product</span>
            <AdminCombobox
              ariaLabel="Filter by product"
              value={filters.product}
              onChange={(product) => setFilters((prev) => ({ ...prev, product }))}
              options={productOptions}
              emptyLabel="All Products"
              placeholder="All Products"
              searchPlaceholder="Search products…"
              leadingIcon={<HiOutlineCube aria-hidden />}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="admin-error-panel" role="alert">
          <span>{error}</span>
          <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => fetchSales()}>
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <LoadingSkeleton rows={6} cols={4} />
      ) : (
        <>
          <div className="admin-kpi-grid admin-animate-in">
            {kpis.map((card) => <SalesKpiCard key={card.key} {...card} />)}
          </div>
          <div className="admin-section-subtitle" style={{ marginBottom: '1.5rem' }}>
            Trend percentages compare to the previous period of equal length.
          </div>

          <SalesChartCard
            title="Revenue Trend"
            subtitle="Paid order revenue and order volume, by day."
            keys={(
              <>
                <span className="admin-chart-key">
                  <span className="admin-chart-key-dot" style={{ background: 'var(--admin-accent-hover)' }} />
                  Revenue
                </span>
                <span className="admin-chart-key">
                  <span className="admin-chart-key-dot admin-chart-key-line" style={{ background: 'var(--admin-info)' }} />
                  Orders
                </span>
              </>
            )}
          >
            <DashRevenueTrend data={revenueByDay} height={320} />
          </SalesChartCard>

          <div className="admin-chart-grid-triple" style={{ marginTop: '1.75rem' }}>
            <SalesChartCard
              title={filters.product ? 'Selected Product' : 'Top Products'}
              subtitle="By revenue in this period"
              action={productSeries.length > 0 && (
                <button
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={() => exportToCsv(`top-products-${fmtLocal(new Date())}`, data.topProducts, [
                    { label: 'Product', map: (row) => row.name || 'Product' },
                    { label: 'Units', key: 'units' },
                    { label: 'Orders', key: 'orders' },
                    { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
                  ])}
                >
                  <HiOutlineArrowDownTray /> CSV
                </button>
              )}
            >
              <DashTopBars
                data={productSeries}
                tone="accent"
                valueKind="currency"
                height={340}
                emptyMessage="No product sales in this period"
              />
            </SalesChartCard>

            <SalesChartCard
              title="Top Add-ons"
              subtitle="Add-on revenue in this period"
              action={addonSeries.length > 0 && (
                <button
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={() => exportToCsv(`top-addons-${fmtLocal(new Date())}`, data.topAddons, [
                    { label: 'Add-on', map: (row) => row._id || 'Add-on' },
                    { label: 'Units', key: 'units' },
                    { label: 'Orders', key: 'orders' },
                    { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
                  ])}
                >
                  <HiOutlineArrowDownTray /> CSV
                </button>
              )}
            >
              <DashTopBars
                data={addonSeries}
                tone="violet"
                valueKind="currency"
                height={340}
                emptyMessage="No add-on sales in this period"
              />
            </SalesChartCard>

            <SalesChartCard
              title="Revenue by City"
              subtitle="Share of revenue by location"
              action={citySeries.length > 0 && (
                <button
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={() => exportToCsv(`top-cities-${fmtLocal(new Date())}`, data.topCities, [
                    { label: 'City', map: (row) => row._id || 'Unknown' },
                    { label: 'Orders', key: 'orders' },
                    { label: 'Revenue (₹)', map: (row) => paiseToRupees(row.revenue) },
                  ])}
                >
                  <HiOutlineArrowDownTray /> CSV
                </button>
              )}
            >
              <DashDonut
                data={citySeries.map((c) => ({ id: c.name, label: c.name, value: c.value }))}
                valueKind="currency"
                height={300}
                centerValue={compactRupees(citySeries.reduce((sum, c) => sum + c.value, 0))}
                centerCaption="Revenue"
                emptyMessage="No city sales in this period"
              />
            </SalesChartCard>
          </div>

          {/* Detailed records */}
          <div className="admin-card admin-records-card" style={{ marginTop: '1.75rem' }}>
            <div className="admin-records-head">
              <div className="admin-chart-head-titles">
                <h3>
                  <HiOutlineTableCells aria-hidden style={{ verticalAlign: '-2px', marginRight: '0.4rem' }} />
                  Detailed Records
                </h3>
                <div className="admin-section-subtitle">
                  Row-level breakdown for the selected dimension and filters.
                </div>
              </div>
              <div className="admin-records-actions">
                <div className="admin-records-tabs" role="tablist" aria-label="Record dimension">
                  {TABLE_DIMENSIONS.map((dim) => (
                    <button
                      key={dim.key}
                      type="button"
                      role="tab"
                      aria-selected={tableDim === dim.key}
                      className={`admin-records-tab ${tableDim === dim.key ? 'active' : ''}`}
                      onClick={() => setTableDim(dim.key)}
                    >
                      {dim.icon}
                      <span>{dim.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  onClick={exportTable}
                  disabled={activeRows.length === 0}
                >
                  <HiOutlineArrowDownTray /> CSV
                </button>
              </div>
            </div>

            {activeRows.length === 0 ? (
              <div className="admin-chart-empty">No records in this period</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-records-table">
                  <thead>
                    {(tableDim === 'products' || tableDim === 'addons') && (
                      <tr>
                        <th style={{ width: 48 }}>#</th>
                        <SortHeader label={tableDim === 'addons' ? 'Add-on' : 'Product'} columnKey="label" sort={sort} onSort={onSort} />
                        <SortHeader label="Units" columnKey="units" sort={sort} onSort={onSort} numeric />
                        <SortHeader label="Orders" columnKey="orders" sort={sort} onSort={onSort} numeric />
                        <SortHeader label="Revenue" columnKey="revenue" sort={sort} onSort={onSort} numeric />
                        <th style={{ width: 160 }}>Share of revenue</th>
                      </tr>
                    )}
                    {tableDim === 'cities' && (
                      <tr>
                        <th style={{ width: 48 }}>#</th>
                        <SortHeader label="City" columnKey="label" sort={sort} onSort={onSort} />
                        <SortHeader label="Orders" columnKey="orders" sort={sort} onSort={onSort} numeric />
                        <SortHeader label="Revenue" columnKey="revenue" sort={sort} onSort={onSort} numeric />
                        <th style={{ width: 160 }}>Share of revenue</th>
                      </tr>
                    )}
                    {tableDim === 'daily' && (
                      <tr>
                        <SortHeader label="Date" columnKey="label" sort={sort} onSort={onSort} />
                        <SortHeader label="Orders" columnKey="orders" sort={sort} onSort={onSort} numeric />
                        <SortHeader label="Revenue" columnKey="revenue" sort={sort} onSort={onSort} numeric />
                        <th style={{ width: 160 }}>Share of revenue</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {sortedRows.map((row, i) => (
                      <tr key={`${tableDim}-${row.label}-${i}`}>
                        {(tableDim === 'products' || tableDim === 'addons') && (
                          <>
                            <td className="admin-records-rank">{i + 1}</td>
                            <td className="admin-records-name">{row.label}</td>
                            <td className="admin-num">{(row.units || 0).toLocaleString('en-IN')}</td>
                            <td className="admin-num">{(row.orders || 0).toLocaleString('en-IN')}</td>
                            <td className="admin-num admin-records-revenue">{formatPrice(row.revenue || 0)}</td>
                            <td><ShareCell value={row.revenue || 0} total={activeRevenueTotal} tone={activeTone} /></td>
                          </>
                        )}
                        {tableDim === 'cities' && (
                          <>
                            <td className="admin-records-rank">{i + 1}</td>
                            <td className="admin-records-name">{row.label}</td>
                            <td className="admin-num">{(row.orders || 0).toLocaleString('en-IN')}</td>
                            <td className="admin-num admin-records-revenue">{formatPrice(row.revenue || 0)}</td>
                            <td><ShareCell value={row.revenue || 0} total={activeRevenueTotal} tone={activeTone} /></td>
                          </>
                        )}
                        {tableDim === 'daily' && (
                          <>
                            <td className="admin-records-name">{formatDate(row.label)}</td>
                            <td className="admin-num">{(row.orders || 0).toLocaleString('en-IN')}</td>
                            <td className="admin-num admin-records-revenue">{formatPrice(row.revenue || 0)}</td>
                            <td><ShareCell value={row.revenue || 0} total={activeRevenueTotal} tone={activeTone} /></td>
                          </>
                        )}
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
