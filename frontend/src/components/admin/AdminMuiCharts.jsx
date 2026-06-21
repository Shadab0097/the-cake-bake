'use client';

/**
 * Pre-themed MUI X Charts (Community / MIT) wrappers for the admin area.
 *
 * Each wrapper renders the underlying self-contained MUI chart inside the
 * scoped dark theme (see MuiChartsProvider) and applies the admin series
 * palette + sensible dark-mode defaults. They pass through every other prop,
 * so the full MUI X Charts API stays available at the call site:
 *
 *   <AdminBarChart
 *     height={320}
 *     xAxis={[{ scaleType: 'band', data: ['Jan', 'Feb', 'Mar'] }]}
 *     series={[{ data: [4, 2, 6], label: 'Revenue' }]}
 *   />
 *
 * Community chart types available: Bar, Line (incl. area), Pie, Scatter,
 * Sparkline, Gauge, Radar.
 *
 * NOTE: charts are not wired into any page yet — these are the building blocks.
 */

import { useSyncExternalStore } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { Gauge } from '@mui/x-charts/Gauge';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import MuiChartsProvider, { ADMIN_SERIES_COLORS } from './MuiChartsProvider';

const DEFAULT_HEIGHT = 300;
const DEFAULT_MARGIN = { top: 12, right: 16, bottom: 24, left: 48 };

// Disable chart mount/transition animations when the OS requests reduced motion.
// useSyncExternalStore keeps this SSR-safe and subscribes to live changes.
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(callback) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(REDUCED_MOTION_QUERY).matches : false),
    () => false,
  );
}

export function AdminBarChart({ height = DEFAULT_HEIGHT, margin = DEFAULT_MARGIN, ...props }) {
  const reduced = usePrefersReducedMotion();
  return (
    <MuiChartsProvider>
      <BarChart colors={ADMIN_SERIES_COLORS} height={height} margin={margin} skipAnimation={reduced} {...props} />
    </MuiChartsProvider>
  );
}

export function AdminLineChart({ height = DEFAULT_HEIGHT, margin = DEFAULT_MARGIN, ...props }) {
  const reduced = usePrefersReducedMotion();
  return (
    <MuiChartsProvider>
      <LineChart colors={ADMIN_SERIES_COLORS} height={height} margin={margin} skipAnimation={reduced} {...props} />
    </MuiChartsProvider>
  );
}

export function AdminPieChart({ height = DEFAULT_HEIGHT, ...props }) {
  const reduced = usePrefersReducedMotion();
  return (
    <MuiChartsProvider>
      <PieChart colors={ADMIN_SERIES_COLORS} height={height} skipAnimation={reduced} {...props} />
    </MuiChartsProvider>
  );
}

export function AdminScatterChart({ height = DEFAULT_HEIGHT, margin = DEFAULT_MARGIN, ...props }) {
  return (
    <MuiChartsProvider>
      <ScatterChart colors={ADMIN_SERIES_COLORS} height={height} margin={margin} {...props} />
    </MuiChartsProvider>
  );
}

export function AdminSparkLineChart({ height = 64, ...props }) {
  return (
    <MuiChartsProvider>
      <SparkLineChart colors={ADMIN_SERIES_COLORS} height={height} {...props} />
    </MuiChartsProvider>
  );
}

export function AdminGauge({ height = DEFAULT_HEIGHT, ...props }) {
  return (
    <MuiChartsProvider>
      <Gauge height={height} {...props} />
    </MuiChartsProvider>
  );
}

export { ADMIN_SERIES_COLORS } from './MuiChartsProvider';

/* =====================================================================
   Dashboard chart compositions (MUI X Charts, admin-themed).
   Self-contained: pass raw API payloads, get a finished chart.
   ===================================================================== */

const ACCENT = '#D81B60';
const ACCENT_HOVER = '#F06292';
const INFO = '#3B82F6';
const VIOLET = '#7C3AED';

const STATUS_COLORS = {
  pending: '#F59E0B', confirmed: '#3B82F6', preparing: '#6366F1', packed: '#0EA5E9',
  dispatched: '#14B8A6', out_for_delivery: '#2DD4BF', delivered: '#22C55E', completed: '#16A34A',
  cancelled: '#EF4444', expired: '#EF4444', failed: '#EF4444', refunded: '#D946EF',
};
const statusColor = (s) => STATUS_COLORS[s] || '#778092';
const titleCase = (v = '') => v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const compactRupees = (rupees) => {
  const v = rupees || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v % 1e7 === 0 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 === 0 ? 0 : 1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1)}k`;
  return `₹${v}`;
};
export const fullRupees = (rupees) => `₹${Math.round(rupees || 0).toLocaleString('en-IN')}`;
const shortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
const truncate = (v = '', max = 16) => (v.length > max ? `${v.slice(0, max - 1)}…` : v);

function ChartEmpty({ message }) {
  return <div className="admin-chart-empty">{message}</div>;
}

// Revenue area (left axis) + orders line (right axis), by day.
export function DashRevenueTrend({ data = [], height = 300 }) {
  if (!data.length) return <ChartEmpty message="No revenue recorded for this period" />;
  const labels = data.map((d) => shortDate(d._id));
  const revenue = data.map((d) => (d.revenue || 0) / 100);
  const orders = data.map((d) => d.orders || 0);
  return (
    <AdminLineChart
      height={height}
      hideLegend
      margin={{ top: 14, right: 12, bottom: 26, left: 12 }}
      grid={{ horizontal: true }}
      xAxis={[{ scaleType: 'point', data: labels, tickLabelStyle: { fontSize: 11 } }]}
      yAxis={[
        { id: 'rev', position: 'left', width: 56, valueFormatter: (v) => compactRupees(v) },
        { id: 'ord', position: 'right', width: 34, valueFormatter: (v) => `${v}` },
      ]}
      series={[
        { id: 'rev', label: 'Revenue', data: revenue, area: true, showMark: false, curve: 'catmullRom', color: ACCENT_HOVER, yAxisId: 'rev', valueFormatter: (v) => fullRupees(v) },
        { id: 'ord', label: 'Orders', data: orders, showMark: false, curve: 'catmullRom', color: INFO, yAxisId: 'ord', valueFormatter: (v) => `${v ?? 0}` },
      ]}
      sx={{ '& .MuiAreaElement-series-rev': { fillOpacity: 0.16 } }}
    />
  );
}

/* Tone → solid hue, for tinting sparklines + donut slices. */
const TONE_HEX = { accent: ACCENT, info: INFO, violet: VIOLET, success: '#22C55E', warning: '#F59E0B' };
const DONUT_PALETTE = [ACCENT, INFO, VIOLET, '#22C55E', '#F59E0B', '#F06292', '#0EA5E9', '#A78BFA'];

// Tiny MUI "wave" sparkline for KPI tiles. Color applied via sx (SparkLineChart
// has no per-instance color prop). Decorative → animation skipped.
export function MuiSpark({ data = [], color = 'accent', height = 38 }) {
  const hex = TONE_HEX[color] || color;
  if (!data || data.length < 2) return <div className="admin-spark-empty" style={{ height }} aria-hidden />;
  return (
    <div className="admin-kpi-spark" style={{ height }} aria-hidden>
      <MuiChartsProvider>
        <SparkLineChart
          data={data}
          height={height}
          area
          curve="catmullRom"
          showTooltip={false}
          showHighlight={false}
          skipAnimation
          margin={{ top: 3, bottom: 2, left: 0, right: 0 }}
          sx={{
            '& .MuiAreaElement-root': { fill: hex, fillOpacity: 0.18 },
            '& .MuiLineElement-root': { stroke: hex, strokeWidth: 2 },
          }}
        />
      </MuiChartsProvider>
    </div>
  );
}

// Net-profit "wave" area that crosses zero — green above the dashed baseline,
// red below, colored by the period's net result.
export function DashProfitTrend({ data = [], height = 300 }) {
  if (!data.length) return <ChartEmpty message="No profit recorded for this period" />;
  const labels = data.map((d) => shortDate(d._id));
  const profit = data.map((d) => (d.profit || 0) / 100);
  const total = profit.reduce((sum, v) => sum + v, 0);
  const color = total >= 0 ? '#22C55E' : '#EF4444';
  return (
    <AdminLineChart
      height={height}
      hideLegend
      margin={{ top: 14, right: 14, bottom: 26, left: 12 }}
      grid={{ horizontal: true }}
      xAxis={[{ scaleType: 'point', data: labels, tickLabelStyle: { fontSize: 11 } }]}
      yAxis={[{ width: 56, valueFormatter: (v) => compactRupees(v) }]}
      series={[{ id: 'profit', label: 'Net profit', data: profit, area: true, showMark: false, curve: 'catmullRom', color, valueFormatter: (v) => fullRupees(v) }]}
      sx={{ '& .MuiAreaElement-series-profit': { fillOpacity: 0.18 } }}
    >
      <ChartsReferenceLine y={0} lineStyle={{ stroke: 'rgba(255,255,255,0.28)', strokeDasharray: '4 4' }} />
    </AdminLineChart>
  );
}

// Generic donut with center label + themed legend. Data: [{ id, label, value, color? }].
export function DashDonut({ data = [], height = 260, centerValue, centerCaption, valueKind = 'count', emptyMessage = 'No data for this period' }) {
  const series = data
    .filter((s) => (s.value || 0) > 0)
    .map((s, i) => ({ ...s, color: s.color || DONUT_PALETTE[i % DONUT_PALETTE.length] }));
  const total = series.reduce((sum, s) => sum + s.value, 0);
  if (!series.length) return <ChartEmpty message={emptyMessage} />;
  const fmt = valueKind === 'currency' ? (v) => fullRupees(v) : (v) => v.toLocaleString('en-IN');
  return (
    <div className="admin-donut-wrap">
      <div className="admin-donut-chart" style={{ height }}>
        <AdminPieChart
          height={height}
          hideLegend
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          series={[{
            data: series,
            innerRadius: '62%',
            outerRadius: '92%',
            paddingAngle: series.length > 1 ? 2 : 0,
            cornerRadius: 3,
            highlightScope: { fade: 'global', highlight: 'item' },
            valueFormatter: (item) => `${fmt(item.value)} (${total > 0 ? Math.round((item.value / total) * 100) : 0}%)`,
          }]}
        />
        {(centerValue !== undefined) && (
          <div className="admin-donut-center">
            <span className="admin-donut-total">{centerValue}</span>
            {centerCaption && <span className="admin-donut-caption">{centerCaption}</span>}
          </div>
        )}
      </div>
      <ul className="admin-donut-legend">
        {series.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.id} className="admin-donut-legend-item">
              <span className="admin-donut-legend-dot" style={{ background: s.color }} />
              <span className="admin-donut-legend-label">{s.label}</span>
              <span className="admin-donut-legend-pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Horizontal ranked bars. `valueKind`: 'currency' | 'count'. Data: [{ name, value }].
export function DashTopBars({ data = [], tone = 'accent', valueKind = 'currency', emptyMessage = 'No data for this period', height }) {
  if (!data.length) return <ChartEmpty message={emptyMessage} />;
  const names = data.map((d) => d.name);
  const values = data.map((d) => d.value || 0);
  const color = tone === 'info' ? INFO : tone === 'violet' ? VIOLET : ACCENT;
  const axisFmt = valueKind === 'currency' ? (v) => compactRupees(v) : (v) => (v || 0).toLocaleString('en-IN');
  const tipFmt = valueKind === 'currency' ? (v) => fullRupees(v) : (v) => (v || 0).toLocaleString('en-IN');
  return (
    <AdminBarChart
      layout="horizontal"
      height={height || Math.max(220, data.length * 42)}
      borderRadius={6}
      hideLegend
      margin={{ top: 8, right: 18, bottom: 24, left: 12 }}
      grid={{ vertical: true }}
      yAxis={[{ scaleType: 'band', data: names, width: 118, tickLabelStyle: { fontSize: 11 }, valueFormatter: (v) => truncate(v) }]}
      xAxis={[{ valueFormatter: axisFmt }]}
      series={[{ data: values, color, valueFormatter: tipFmt }]}
    />
  );
}

// Order-status donut with center total + themed legend list. Data: [{ _id, count }].
export function DashStatusDonut({ data = [], height = 260 }) {
  const series = data
    .filter((s) => (s.count || 0) > 0)
    .map((s) => ({ id: s._id, value: s.count, label: titleCase(s._id), color: statusColor(s._id) }))
    .sort((a, b) => b.value - a.value);
  const total = series.reduce((sum, s) => sum + s.value, 0);
  if (!series.length) return <ChartEmpty message="No order status data yet" />;
  return (
    <div className="admin-donut-wrap">
      <div className="admin-donut-chart" style={{ height }}>
        <AdminPieChart
          height={height}
          hideLegend
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          series={[{
            data: series,
            innerRadius: '62%',
            outerRadius: '92%',
            paddingAngle: series.length > 1 ? 2 : 0,
            cornerRadius: 3,
            highlightScope: { fade: 'global', highlight: 'item' },
            valueFormatter: (item) => `${item.value.toLocaleString('en-IN')} (${total > 0 ? Math.round((item.value / total) * 100) : 0}%)`,
          }]}
        />
        <div className="admin-donut-center">
          <span className="admin-donut-total">{total.toLocaleString('en-IN')}</span>
          <span className="admin-donut-caption">Orders</span>
        </div>
      </div>
      <ul className="admin-donut-legend">
        {series.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <li key={s.id} className="admin-donut-legend-item">
              <span className="admin-donut-legend-dot" style={{ background: s.color }} />
              <span className="admin-donut-legend-label">{s.label}</span>
              <span className="admin-donut-legend-value">{s.value}</span>
              <span className="admin-donut-legend-pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
