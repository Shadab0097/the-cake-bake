'use client';

/**
 * Reusable analytics charts for the admin dashboard, built on Recharts.
 * Every chart is tuned to the admin dark theme + pink/magenta accent and
 * renders client-side only (data arrives from a client fetch, so charts never
 * server-render with data and there is no hydration mismatch).
 */

import { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/* ---- Palette (mirrors admin.css custom properties) ---- */
const ACCENT = '#D81B60';
const ACCENT_HOVER = '#F06292';
const ACCENT_SOFT = '#F8BBD0';
const INFO = '#3B82F6';
const INFO_LIGHT = '#60A5FA';
const VIOLET = '#7C3AED';
const VIOLET_LIGHT = '#A78BFA';
const GRID = 'rgba(255, 255, 255, 0.06)';
const AXIS = 'rgba(255, 255, 255, 0.08)';
const TICK = '#778092';
const TICK_STRONG = '#A9B2C3';

/* Order-status colors, aligned with the badge palette in admin.css */
export const STATUS_COLORS = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  preparing: '#A78BFA',
  packed: '#7DD3FC',
  dispatched: '#6EE7B7',
  out_for_delivery: '#34D399',
  delivered: '#22C55E',
  completed: '#22C55E',
  cancelled: '#EF4444',
  expired: '#EF4444',
  failed: '#EF4444',
  refunded: '#F0ABFC',
};

const statusColor = (status) => STATUS_COLORS[status] || '#778092';
const titleCase = (value = '') => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/* ---- Formatters (revenue arrives in paise) ---- */
export const paiseToRupees = (paise) => (paise || 0) / 100;

export function compactRupees(rupees) {
  const value = rupees || 0;
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(value % 1e7 === 0 ? 0 : 1)}Cr`;
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(value % 1e5 === 0 ? 0 : 1)}L`;
  if (value >= 1e3) return `₹${(value / 1e3).toFixed(value % 1e3 === 0 ? 0 : 1)}k`;
  return `₹${value}`;
}

export function fullRupees(rupees) {
  return `₹${Math.round(rupees || 0).toLocaleString('en-IN')}`;
}

function truncate(label = '', max = 18) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fullDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

/* ---- Shared bits ---- */
function ChartEmpty({ message }) {
  return <div className="admin-chart-empty">{message}</div>;
}

function TooltipShell({ title, rows }) {
  return (
    <div className="admin-chart-tooltip">
      <div className="admin-chart-tooltip-title">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="admin-chart-tooltip-row">
          <span className="admin-chart-tooltip-dot" style={{ background: row.color }} />
          <span className="admin-chart-tooltip-label">{row.label}</span>
          <span className="admin-chart-tooltip-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   Revenue trend — revenue area (left axis) + orders line (right axis)
   ===================================================================== */
function RevenueTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipShell
      title={point.fullLabel}
      rows={[
        { label: 'Revenue', value: fullRupees(point.revenue), color: ACCENT_HOVER },
        { label: 'Paid orders', value: point.orders.toLocaleString('en-IN'), color: INFO },
      ]}
    />
  );
}

export function RevenueTrendChart({ data = [], height = 300 }) {
  const series = useMemo(
    () =>
      data.map((item) => ({
        label: shortDate(item._id),
        fullLabel: fullDate(item._id),
        revenue: paiseToRupees(item.revenue),
        orders: item.orders || 0,
      })),
    [data],
  );

  if (!series.length) return <ChartEmpty message="No revenue recorded for this period" />;

  return (
    <div className="admin-chart-area" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="adminRevenueArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT_HOVER} stopOpacity={0.42} />
              <stop offset="55%" stopColor={ACCENT} stopOpacity={0.14} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label"
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: AXIS }}
            minTickGap={28}
            interval="preserveStartEnd"
            tickMargin={8}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={compactRupees}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            content={<RevenueTooltip />}
            cursor={{ stroke: 'rgba(240, 98, 146, 0.35)', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={ACCENT_HOVER}
            strokeWidth={2.5}
            fill="url(#adminRevenueArea)"
            dot={false}
            activeDot={{ r: 4, fill: ACCENT_SOFT, stroke: ACCENT, strokeWidth: 2 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="orders"
            name="Orders"
            stroke={INFO}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, fill: INFO_LIGHT, stroke: '#0F141D', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* =====================================================================
   Order-status donut
   ===================================================================== */
function StatusTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const percent = total > 0 ? Math.round((point.count / total) * 100) : 0;
  return (
    <TooltipShell
      title={point.label}
      rows={[{ label: 'Orders', value: `${point.count.toLocaleString('en-IN')} (${percent}%)`, color: point.fill }]}
    />
  );
}

export function OrderStatusDonut({ data = [], height = 260 }) {
  const series = useMemo(
    () =>
      data
        .filter((item) => (item.count || 0) > 0)
        .map((item) => ({
          status: item._id,
          label: titleCase(item._id),
          count: item.count || 0,
          fill: statusColor(item._id),
        }))
        .sort((a, b) => b.count - a.count),
    [data],
  );

  const total = useMemo(() => series.reduce((sum, item) => sum + item.count, 0), [series]);

  if (!series.length) return <ChartEmpty message="No order status data yet" />;

  return (
    <div className="admin-donut-wrap">
      <div className="admin-donut-chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<StatusTooltip total={total} />} cursor={false} />
            <Pie
              data={series}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={series.length > 1 ? 2 : 0}
              stroke="#0F141D"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
            >
              {series.map((item) => (
                <Cell key={item.status} fill={item.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="admin-donut-center">
          <span className="admin-donut-total">{total.toLocaleString('en-IN')}</span>
          <span className="admin-donut-caption">Orders</span>
        </div>
      </div>
      <ul className="admin-donut-legend">
        {series.map((item) => {
          const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <li key={item.status} className="admin-donut-legend-item">
              <span className="admin-donut-legend-dot" style={{ background: item.fill }} />
              <span className="admin-donut-legend-label">{item.label}</span>
              <span className="admin-donut-legend-value">{item.count}</span>
              <span className="admin-donut-legend-pct">{percent}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* =====================================================================
   Horizontal ranked bar chart (used for products + cities)
   ===================================================================== */
function VerticalTick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={TICK_STRONG} fontSize={12}>
      {truncate(payload.value)}
    </text>
  );
}

function RankedBarChart({ data, barColorId, gradient, valueFormatter, tooltip, height }) {
  return (
    <div className="admin-chart-area" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap={10}>
          <defs>
            <linearGradient id={barColorId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis
            type="number"
            tick={{ fill: TICK, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={valueFormatter}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tickLine={false}
            axisLine={false}
            tick={<VerticalTick />}
          />
          <Tooltip content={tooltip} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
          <Bar dataKey="value" fill={`url(#${barColorId})`} radius={[0, 6, 6, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProductsTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipShell
      title={point.name}
      rows={[
        { label: 'Units sold', value: point.value.toLocaleString('en-IN'), color: ACCENT_HOVER },
        { label: 'Revenue', value: fullRupees(point.revenue), color: ACCENT },
      ]}
    />
  );
}

export function TopProductsChart({ data = [], limit = 8, height }) {
  const series = useMemo(
    () =>
      data.slice(0, limit).map((item) => ({
        name: item._id || item.name || 'Product',
        value: item.totalQuantity || 0,
        revenue: paiseToRupees(item.totalRevenue),
      })),
    [data, limit],
  );

  if (!series.length) return <ChartEmpty message="No product sales for this period" />;

  return (
    <RankedBarChart
      data={series}
      barColorId="adminProductsBar"
      gradient={[ACCENT, ACCENT_HOVER]}
      valueFormatter={(v) => v.toLocaleString('en-IN')}
      tooltip={<ProductsTooltip />}
      height={height || Math.max(200, series.length * 40)}
    />
  );
}

function CitiesTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipShell
      title={point.name}
      rows={[
        { label: 'Revenue', value: fullRupees(point.value), color: INFO },
        { label: 'Orders', value: point.orders.toLocaleString('en-IN'), color: INFO_LIGHT },
      ]}
    />
  );
}

export function TopCitiesChart({ data = [], limit = 8, height }) {
  const series = useMemo(
    () =>
      data
        .filter((item) => item._id)
        .slice(0, limit)
        .map((item) => ({
          name: item._id || 'Unknown',
          value: paiseToRupees(item.revenue),
          orders: item.orders || 0,
        })),
    [data, limit],
  );

  if (!series.length) return <ChartEmpty message="No city-level sales yet" />;

  return (
    <RankedBarChart
      data={series}
      barColorId="adminCitiesBar"
      gradient={[INFO, INFO_LIGHT]}
      valueFormatter={compactRupees}
      tooltip={<CitiesTooltip />}
      height={height || Math.max(200, series.length * 40)}
    />
  );
}


/* =====================================================================
   Sparkline — tiny filled trend line for KPI tiles. No axes/tooltips,
   pure shape. Expects a flat array of numbers; renders nothing meaningful
   below 2 points so a single data day doesn't draw a misleading flat line.
   ===================================================================== */
export function Sparkline({ data = [], color = 'accent', height = 38 }) {
  const gradient = CHART_GRADIENTS[color] || CHART_GRADIENTS.accent;
  const rawId = useId();
  const gradientId = `spark-${rawId.replace(/[:]/g, '')}`;

  const series = useMemo(
    () => (data || []).map((value, i) => ({ i, value: Number.isFinite(value) ? value : 0 })),
    [data],
  );

  if (series.length < 2) return <div className="admin-spark-empty" style={{ height }} aria-hidden />;

  return (
    <div className="admin-kpi-spark" style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 3, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradient[1]} stopOpacity={0.4} />
              <stop offset="100%" stopColor={gradient[1]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={gradient[1]}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* =====================================================================
   Generic horizontal ranked bar — reusable across analytics pages.
   Expects pre-shaped data: [{ name, value, ...extra }].
   `tooltipRows(datum)` returns rows for the themed tooltip.
   ===================================================================== */
export const CHART_GRADIENTS = {
  accent: [ACCENT, ACCENT_HOVER],
  info: [INFO, INFO_LIGHT],
  violet: [VIOLET, VIOLET_LIGHT],
  success: ['#16A34A', '#22C55E'],
};

function BarTooltip({ active, payload, rowsBuilder }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return <TooltipShell title={point.name} rows={rowsBuilder ? rowsBuilder(point) : []} />;
}

export function HorizontalBarChart({
  data = [],
  color = 'accent',
  gradientId = 'adminGenericBar',
  valueFormatter = (v) => v,
  tooltipRows,
  height,
  emptyMessage = 'No data for this period',
}) {
  if (!data.length) return <ChartEmpty message={emptyMessage} />;

  const gradient = CHART_GRADIENTS[color] || CHART_GRADIENTS.accent;
  return (
    <RankedBarChart
      data={data}
      barColorId={gradientId}
      gradient={gradient}
      valueFormatter={valueFormatter}
      tooltip={<BarTooltip rowsBuilder={tooltipRows} />}
      height={height || Math.max(200, data.length * 40)}
    />
  );
}
