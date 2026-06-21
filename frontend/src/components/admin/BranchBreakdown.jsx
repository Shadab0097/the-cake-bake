'use client';

import { useEffect, useState } from 'react';
import adminApi, { formatPrice } from '@/lib/adminApi';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

// Owner-only "compare all branches" panel. Self-gates: a branch-scoped admin
// (or any role the endpoint 403s) renders nothing, so it can be dropped onto the
// shared dashboard without leaking the financial comparison to non-owners.
export default function BranchBreakdown() {
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ status: 'loading', rows: [], totals: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      setState((s) => ({ ...s, status: 'loading' }));
      try {
        const me = await adminApi.me();
        if (me.data.data?.isBranchScoped) {
          if (alive) setState({ status: 'hidden', rows: [], totals: null });
          return;
        }
        const res = await adminApi.dashboard.branchBreakdown({ days });
        const d = res.data.data || {};
        if (alive) setState({ status: 'ready', rows: d.branches || [], totals: d.totals || null });
      } catch {
        // Non-owner (403) or transient error — hide rather than surface an error.
        if (alive) setState({ status: 'hidden', rows: [], totals: null });
      }
    })();
    return () => { alive = false; };
  }, [days]);

  if (state.status === 'hidden') return null;

  const { rows, totals } = state;
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue || 0));
  const totalsMargin = totals && totals.grossSales > 0
    ? Math.round((totals.netProfit / totals.grossSales) * 1000) / 10
    : 0;
  const profitColor = (v) => (v < 0 ? 'var(--admin-danger)' : 'var(--admin-success)');

  return (
    <section className="admin-dashboard-section">
      <div className="admin-section-heading">
        <div>
          <h2>Branch Performance</h2>
          <div className="admin-section-subtitle">Revenue, orders, and net profit by branch · last {days} days</div>
        </div>
        <div className="admin-range-switch" role="group" aria-label="Branch breakdown range">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`admin-range-btn ${days === r.value ? 'active' : ''}`}
              onClick={() => setDays(r.value)}
              aria-pressed={days === r.value}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ padding: 0 }}>
        {state.status === 'loading' ? (
          <div className="admin-empty-compact">Loading branch performance…</div>
        ) : rows.length === 0 ? (
          <div className="admin-empty-compact">No paid orders in this window</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="admin-num">Revenue</th>
                  <th className="admin-num">Orders</th>
                  <th className="admin-num">Avg Order</th>
                  <th className="admin-num">Net Profit</th>
                  <th className="admin-num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.branchId || 'unassigned'}>
                    <td style={{ minWidth: 180 }}>
                      <div className="admin-row-title">
                        {r.branchName}
                        {r.branchCode ? <span className="admin-row-meta"> · {r.branchCode}</span> : null}
                      </div>
                      <div className="admin-progress" style={{ marginTop: 6 }}>
                        <div
                          className="admin-progress-bar"
                          style={{ width: `${Math.round(((r.revenue || 0) / maxRevenue) * 100)}%`, background: 'var(--admin-accent-hover)' }}
                        />
                      </div>
                    </td>
                    <td className="admin-num admin-row-value">{formatPrice(r.revenue || 0)}</td>
                    <td className="admin-num">{(r.orders || 0).toLocaleString('en-IN')}</td>
                    <td className="admin-num">{formatPrice(r.aov || 0)}</td>
                    <td className="admin-num" style={{ color: profitColor(r.netProfit || 0) }}>{formatPrice(r.netProfit || 0)}</td>
                    <td className="admin-num">{r.margin}%</td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr>
                    <td className="admin-row-title">All branches</td>
                    <td className="admin-num admin-row-value">{formatPrice(totals.revenue || 0)}</td>
                    <td className="admin-num">{(totals.orders || 0).toLocaleString('en-IN')}</td>
                    <td className="admin-num">{formatPrice(totals.orders ? Math.round(totals.revenue / totals.orders) : 0)}</td>
                    <td className="admin-num" style={{ color: profitColor(totals.netProfit || 0) }}>{formatPrice(totals.netProfit || 0)}</td>
                    <td className="admin-num">{totalsMargin}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
