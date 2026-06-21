'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HiOutlineArrowDownTray,
  HiOutlineInformationCircle,
  HiOutlineFunnel,
  HiOutlineCalendarDays,
  HiOutlineReceiptPercent,
  HiOutlineCurrencyRupee,
  HiOutlineBanknotes,
  HiOutlineShoppingBag,
  HiOutlineChevronUpDown,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
} from 'react-icons/hi2';
import adminApi, { formatPrice, formatDate } from '@/lib/adminApi';
import { exportToCsv, paiseToRupees } from '@/lib/exportCsv';
import { LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';
import AdminDateRangePicker from '@/components/admin/AdminDateRangePicker';
import { MuiSpark } from '@/components/admin/AdminMuiCharts';

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

// KPI tile with a daily sparkline. No trend pill — the GST report has no
// previous-period comparison.
function GstKpiCard({ label, value, icon, tone, spark }) {
  return (
    <div className={`admin-card admin-kpi-card tone-${tone}`}>
      <div className="admin-kpi-top">
        <span className="admin-kpi-icon">{icon}</span>
      </div>
      <div className="admin-kpi-value">{value}</div>
      <div className="admin-kpi-label">{label}</div>
      <MuiSpark data={spark} color={tone} />
    </div>
  );
}

function SortHeader({ label, columnKey, sort, onSort, numeric = false }) {
  const active = sort.key === columnKey;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th className={numeric ? 'admin-num' : undefined} aria-sort={ariaSort}>
      <button type="button" className={`admin-th-sort ${active ? 'active' : ''}`} onClick={() => onSort(columnKey)}>
        <span>{label}</span>
        {active
          ? (sort.dir === 'asc' ? <HiOutlineChevronUp aria-hidden /> : <HiOutlineChevronDown aria-hidden />)
          : <HiOutlineChevronUpDown aria-hidden />}
      </button>
    </th>
  );
}

export default function AdminGstPage() {
  const [filters, setFilters] = useState({ preset: '30', from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'label', dir: 'asc' });

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
  const byDay = useMemo(() => data?.byDay || [], [data]);
  const range = data?.range || {};

  const sparks = useMemo(() => ({
    taxableValue: byDay.map((d) => (d.taxableValue || 0) / 100),
    tax: byDay.map((d) => (d.tax || 0) / 100),
    total: byDay.map((d) => ((d.taxableValue || 0) + (d.tax || 0)) / 100),
    orders: byDay.map((d) => d.orders || 0),
  }), [byDay]);

  const kpis = [
    { key: 'taxable', label: 'Taxable Value', value: formatPrice(summary.taxableValue || 0), icon: <HiOutlineCurrencyRupee />, tone: 'info', spark: sparks.taxableValue },
    { key: 'tax', label: 'Tax Collected', value: formatPrice(summary.tax || 0), icon: <HiOutlineReceiptPercent />, tone: 'accent', spark: sparks.tax },
    { key: 'total', label: 'Total Collected', value: formatPrice(summary.total || 0), icon: <HiOutlineBanknotes />, tone: 'success', spark: sparks.total },
    { key: 'orders', label: 'Orders', value: (summary.orders || 0).toLocaleString('en-IN'), icon: <HiOutlineShoppingBag />, tone: 'violet', spark: sparks.orders },
  ];

  const rows = useMemo(() => byDay.map((d) => ({
    id: d._id,
    label: d._id,
    taxableValue: d.taxableValue || 0,
    tax: d.tax || 0,
    orders: d.orders || 0,
  })), [byDay]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    const { key, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (key === 'label') return mul * String(a.label).localeCompare(String(b.label));
      return mul * ((a[key] || 0) - (b[key] || 0));
    });
    return list;
  }, [rows, sort]);

  const onSort = useCallback((key) => {
    setSort((prev) => (prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'label' ? 'asc' : 'desc' }));
  }, []);

  const exportSummary = useCallback(() => {
    if (!data) return;
    const s = data.summary || {};
    exportToCsv(`gst-summary-${fmtLocal(new Date())}`, [
      { metric: 'Taxable Value', value: paiseToRupees(s.taxableValue || 0) },
      { metric: 'Tax Collected', value: paiseToRupees(s.tax || 0) },
      { metric: 'Total Collected', value: paiseToRupees(s.total || 0) },
      { metric: 'Orders', value: s.orders || 0 },
    ], [
      { label: 'Metric', key: 'metric' },
      { label: 'Value', key: 'value' },
    ]);
  }, [data]);

  const hasFilters = filters.preset !== '30';

  return (
    <div>
      <div className="admin-page-header admin-sales-header">
        <div className="admin-page-heading">
          <div className="admin-page-kicker">Compliance</div>
          <h1 className="admin-page-title admin-title-gradient">GST Summary</h1>
          <div className="admin-page-subtitle">Taxable value and output tax on paid orders.</div>
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
          <RefreshButton onRefresh={() => fetchData({ silent: true })} />
        </div>
      </div>

      {/* Premium filter panel */}
      <div className="admin-card admin-filter-panel">
        <div className="admin-filter-panel-head">
          <div className="admin-filter-panel-title">
            <HiOutlineFunnel aria-hidden />
            <span>Filters</span>
          </div>
          <div className="admin-filter-chips" />
          {hasFilters && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm admin-filter-reset"
              onClick={() => setFilters({ preset: '30', from: '', to: '' })}
            >
              Reset
            </button>
          )}
        </div>

        <div className="admin-filter-panel-fields">
          <div className="admin-filter-field">
            <span className="admin-filter-label">Period</span>
            <div className="admin-range-switch" role="group" aria-label="Select GST period">
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
        </div>
      </div>

      <div className="admin-card admin-info-banner">
        <HiOutlineInformationCircle aria-hidden />
        <span>
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
          <div className="admin-kpi-grid admin-animate-in">
            {kpis.map((card) => <GstKpiCard key={card.key} {...card} />)}
          </div>

          <div className="admin-card admin-records-card" style={{ marginTop: '1.5rem' }}>
            <div className="admin-records-head">
              <div className="admin-chart-head-titles">
                <h3>By Day</h3>
                <div className="admin-section-subtitle">Daily taxable value and output tax — click a column to sort.</div>
              </div>
              <button
                className="admin-btn admin-btn-secondary admin-btn-sm"
                disabled={byDay.length === 0}
                onClick={() => exportToCsv(`gst-${fmtLocal(new Date())}`, byDay, [
                  { label: 'Date', key: '_id' },
                  { label: 'Taxable Value (₹)', map: (row) => paiseToRupees(row.taxableValue) },
                  { label: 'Tax (₹)', map: (row) => paiseToRupees(row.tax) },
                  { label: 'Orders', key: 'orders' },
                ])}
              >
                <HiOutlineArrowDownTray /> CSV
              </button>
            </div>

            {byDay.length === 0 ? (
              <div className="admin-chart-empty">No paid orders in this period</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-records-table">
                  <thead>
                    <tr>
                      <SortHeader label="Date" columnKey="label" sort={sort} onSort={onSort} />
                      <SortHeader label="Taxable Value" columnKey="taxableValue" sort={sort} onSort={onSort} numeric />
                      <SortHeader label="Tax" columnKey="tax" sort={sort} onSort={onSort} numeric />
                      <SortHeader label="Orders" columnKey="orders" sort={sort} onSort={onSort} numeric />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.id}>
                        <td className="admin-records-name">{formatDate(row.label)}</td>
                        <td className="admin-num">{formatPrice(row.taxableValue)}</td>
                        <td className="admin-num admin-records-revenue">{formatPrice(row.tax)}</td>
                        <td className="admin-num">{row.orders.toLocaleString('en-IN')}</td>
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
