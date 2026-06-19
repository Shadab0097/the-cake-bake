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

import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { ScatterChart } from '@mui/x-charts/ScatterChart';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { Gauge } from '@mui/x-charts/Gauge';
import MuiChartsProvider, { ADMIN_SERIES_COLORS } from './MuiChartsProvider';

const DEFAULT_HEIGHT = 300;
const DEFAULT_MARGIN = { top: 12, right: 16, bottom: 24, left: 48 };

export function AdminBarChart({ height = DEFAULT_HEIGHT, margin = DEFAULT_MARGIN, ...props }) {
  return (
    <MuiChartsProvider>
      <BarChart colors={ADMIN_SERIES_COLORS} height={height} margin={margin} {...props} />
    </MuiChartsProvider>
  );
}

export function AdminLineChart({ height = DEFAULT_HEIGHT, margin = DEFAULT_MARGIN, ...props }) {
  return (
    <MuiChartsProvider>
      <LineChart colors={ADMIN_SERIES_COLORS} height={height} margin={margin} {...props} />
    </MuiChartsProvider>
  );
}

export function AdminPieChart({ height = DEFAULT_HEIGHT, ...props }) {
  return (
    <MuiChartsProvider>
      <PieChart colors={ADMIN_SERIES_COLORS} height={height} {...props} />
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
