'use client';

/**
 * Scoped MUI theme + provider used ONLY to theme MUI X Charts inside the admin
 * area. It mirrors the admin design tokens from admin.css (dark surfaces +
 * pink/magenta accent) so charts match the rest of the dashboard.
 *
 * Important: we deliberately do NOT render <CssBaseline>. MUI's baseline would
 * apply global resets that fight Tailwind + the hand-written admin.css. By only
 * providing a ThemeProvider, MUI styling stays contained to the charts that this
 * provider wraps and never leaks into the rest of the app.
 */

import { useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';

/* Mirrors the palette in admin.css (:root --admin-* tokens). */
const TOKENS = {
  bg: '#080B10',
  surface: '#151A23',
  surfaceRaised: '#1A202B',
  border: '#30384B',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  grid: 'rgba(255, 255, 255, 0.06)',
  text: '#E8ECF4',
  textSecondary: '#A9B2C3',
  textMuted: '#778092',
  accent: '#D81B60',
  accentHover: '#F06292',
  info: '#3B82F6',
  infoLight: '#60A5FA',
  violet: '#7C3AED',
  violetLight: '#A78BFA',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

/**
 * Default categorical series colors for charts. Ordered so the first series
 * picks up the brand accent, then complementary hues.
 */
export const ADMIN_SERIES_COLORS = [
  TOKENS.accent,
  TOKENS.info,
  TOKENS.violet,
  TOKENS.success,
  TOKENS.warning,
  TOKENS.accentHover,
  TOKENS.infoLight,
  TOKENS.violetLight,
];

export const ADMIN_CHART_TOKENS = TOKENS;

export function createAdminChartsTheme() {
  return createTheme({
    palette: {
      mode: 'dark',
      primary: { main: TOKENS.accent, light: TOKENS.accentHover },
      secondary: { main: TOKENS.info, light: TOKENS.infoLight },
      success: { main: TOKENS.success },
      warning: { main: TOKENS.warning },
      error: { main: TOKENS.danger },
      background: { default: TOKENS.surface, paper: TOKENS.surfaceRaised },
      text: { primary: TOKENS.text, secondary: TOKENS.textSecondary },
      divider: TOKENS.borderSubtle,
    },
    shape: { borderRadius: 8 },
    typography: {
      // Inherit the app font instead of pulling in Roboto.
      fontFamily: 'inherit',
      fontSize: 12,
    },
    components: {
      MuiChartsAxis: {
        styleOverrides: {
          tickLabel: { fill: TOKENS.textMuted, fontSize: 11 },
          tick: { stroke: TOKENS.borderSubtle },
          line: { stroke: TOKENS.borderSubtle },
          label: { fill: TOKENS.textSecondary },
        },
      },
      MuiChartsGrid: {
        styleOverrides: {
          line: { stroke: TOKENS.grid },
        },
      },
      MuiChartsLegend: {
        styleOverrides: {
          root: { color: TOKENS.textSecondary },
        },
      },
      MuiChartsTooltip: {
        styleOverrides: {
          paper: {
            background: TOKENS.surfaceRaised,
            border: `1px solid ${TOKENS.border}`,
            color: TOKENS.text,
          },
        },
      },
    },
  });
}

export default function MuiChartsProvider({ children }) {
  const theme = useMemo(() => createAdminChartsTheme(), []);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
