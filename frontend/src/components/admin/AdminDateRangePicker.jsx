'use client';

/**
 * AdminDateRangePicker — popover month calendar for a from–to range, re-themed
 * from a 21st.dev shadcn date-range picker to the admin dark system (no Radix /
 * react-day-picker / Tailwind; plain admin-* CSS).
 *
 * Controlled with ISO 'yyyy-mm-dd' strings: `from`, `to`, `onChange({from,to})`.
 * Click once to set the start, again to set the end (auto-orders if reversed),
 * then it closes. `max` caps selectable days (e.g. today). Outside-click + Esc
 * close. Range and endpoints are highlighted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HiOutlineCalendarDays,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineXMark,
} from 'react-icons/hi2';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const fmtShort = (s) => {
  const d = parseISO(s);
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
};

export default function AdminDateRangePicker({
  from = '',
  to = '',
  onChange,
  max,
  placeholder = 'Pick a date range',
}) {
  const [open, setOpen] = useState(false);
  // Month currently shown in the grid (1st of month).
  const [cursor, setCursor] = useState(() => parseISO(from) || new Date());
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    setCursor(parseISO(from) || parseISO(to) || new Date());
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 6×7 grid of day cells for the cursor month (leading/trailing days padded).
  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // back up to the Sunday on/before the 1st
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return { cells, month };
  }, [cursor]);

  const maxISO = max || null;

  const onPick = useCallback((iso) => {
    if (maxISO && iso > maxISO) return;
    // No start yet, or a full range exists → begin a fresh range.
    if (!from || (from && to)) {
      onChange?.({ from: iso, to: '' });
      return;
    }
    // Have a start, picking the end.
    if (iso < from) {
      onChange?.({ from: iso, to: from });
    } else {
      onChange?.({ from, to: iso });
    }
    close();
  }, [from, to, onChange, maxISO, close]);

  const label = from && to
    ? `${fmtShort(from)} – ${fmtShort(to)}`
    : from
      ? `${fmtShort(from)} – …`
      : '';

  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="admin-daterange" ref={rootRef}>
      <button
        type="button"
        className={`admin-combobox-trigger ${open ? 'is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="admin-combobox-lead"><HiOutlineCalendarDays aria-hidden /></span>
        <span className={`admin-combobox-value ${label ? '' : 'is-placeholder'}`}>
          {label || placeholder}
        </span>
        {(from || to) && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear date range"
            className="admin-combobox-clear"
            onClick={(e) => { e.stopPropagation(); onChange?.({ from: '', to: '' }); }}
          >
            <HiOutlineXMark aria-hidden />
          </span>
        )}
      </button>

      {open && (
        <div className="admin-daterange-pop" role="dialog" aria-label="Choose date range">
          <div className="admin-daterange-head">
            <button
              type="button"
              className="admin-daterange-nav"
              aria-label="Previous month"
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            >
              <HiOutlineChevronLeft aria-hidden />
            </button>
            <span className="admin-daterange-month">{monthLabel}</span>
            <button
              type="button"
              className="admin-daterange-nav"
              aria-label="Next month"
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            >
              <HiOutlineChevronRight aria-hidden />
            </button>
          </div>

          <div className="admin-daterange-weekdays">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="admin-daterange-grid">
            {weeks.cells.map((d) => {
              const iso = toISO(d);
              const outside = d.getMonth() !== weeks.month;
              const disabled = maxISO ? iso > maxISO : false;
              const isStart = iso === from;
              const isEnd = iso === to;
              const inRange = from && to && iso > from && iso < to;
              const cls = [
                'admin-daterange-day',
                outside ? 'is-outside' : '',
                disabled ? 'is-disabled' : '',
                isStart || isEnd ? 'is-endpoint' : '',
                inRange ? 'is-inrange' : '',
              ].filter(Boolean).join(' ');
              return (
                <button
                  type="button"
                  key={iso}
                  className={cls}
                  disabled={disabled}
                  aria-pressed={isStart || isEnd}
                  onClick={() => onPick(iso)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
