'use client';

/**
 * AdminCombobox — searchable select, re-themed from a 21st.dev shadcn combobox
 * to the admin dark system (no Radix/cmdk/Tailwind; plain admin-* CSS).
 *
 * Controlled: pass `value` ('' = the empty/all option) and `onChange(value)`.
 * Options are `[{ value, label }]`. `emptyLabel` renders a first row that maps
 * back to '' (e.g. "All Cities"). Supports type-to-filter, full keyboard nav
 * (↑/↓/Home/End/Enter/Esc), outside-click + Escape close, and ARIA listbox.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  HiOutlineCheck,
  HiOutlineChevronUpDown,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
} from 'react-icons/hi2';

export default function AdminCombobox({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select…',
  emptyLabel,
  searchPlaceholder = 'Search…',
  leadingIcon = null,
  ariaLabel,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const baseId = useId();

  // Visible rows: the empty/all row (only when not searching) + filtered options.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
    const list = filtered.map((o) => ({ ...o, isEmpty: false }));
    if (emptyLabel !== undefined && !q) {
      list.unshift({ value: '', label: emptyLabel, isEmpty: true });
    }
    return list;
  }, [options, query, emptyLabel]);

  const selectedLabel = useMemo(() => {
    if (value === '' || value === null || value === undefined) return emptyLabel ?? '';
    return options.find((o) => o.value === value)?.label ?? '';
  }, [value, options, emptyLabel]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const commit = useCallback((row) => {
    if (!row) return;
    onChange?.(row.value);
    close();
  }, [onChange, close]);

  // Open → focus the search box and point the highlight at the current value.
  useEffect(() => {
    if (!open) return undefined;
    const idx = rows.findIndex((r) => r.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlight in range as the filtered list shrinks.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  // Outside click closes the popover.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(rows.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        commit(rows[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  };

  const hasValue = value !== '' && value !== null && value !== undefined;
  const listboxId = `${baseId}-listbox`;
  const optionId = (i) => `${baseId}-opt-${i}`;

  return (
    <div className="admin-combobox" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={`admin-combobox-trigger ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {leadingIcon && <span className="admin-combobox-lead">{leadingIcon}</span>}
        <span className={`admin-combobox-value ${selectedLabel ? '' : 'is-placeholder'}`}>
          {selectedLabel || placeholder}
        </span>
        {hasValue && emptyLabel !== undefined ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            className="admin-combobox-clear"
            onClick={(e) => { e.stopPropagation(); onChange?.(''); }}
          >
            <HiOutlineXMark aria-hidden />
          </span>
        ) : (
          <HiOutlineChevronUpDown className="admin-combobox-caret" aria-hidden />
        )}
      </button>

      {open && (
        <div className="admin-combobox-pop" role="presentation">
          <div className="admin-combobox-search">
            <HiOutlineMagnifyingGlass aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={rows.length > 0 ? optionId(activeIndex) : undefined}
            />
          </div>
          <ul className="admin-combobox-list" role="listbox" id={listboxId} ref={listRef}>
            {rows.length === 0 ? (
              <li className="admin-combobox-empty">No matches</li>
            ) : (
              rows.map((row, i) => {
                const selected = row.value === value;
                const active = i === activeIndex;
                return (
                  <li
                    key={`${row.value}-${i}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    data-active={active}
                    className={`admin-combobox-option ${active ? 'is-active' : ''} ${selected ? 'is-selected' : ''} ${row.isEmpty ? 'is-empty-row' : ''}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(row)}
                  >
                    <span className="admin-combobox-option-label">{row.label}</span>
                    {selected && <HiOutlineCheck className="admin-combobox-option-check" aria-hidden />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
