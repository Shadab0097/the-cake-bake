'use client';

import { useCallback, useRef, useState } from 'react';
import {
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineXCircle,
  HiOutlineXMark,
} from 'react-icons/hi2';

export function StatusBadge({ status }) {
  const label = status?.replace(/_/g, ' ') || 'unknown';
  return (
    <span className={`admin-badge badge-${status}`}>
      {label}
    </span>
  );
}

export function Pagination({ page, totalPages, total, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="admin-pagination">
      <span>{total} total results</span>
      <div className="admin-pagination-btns">
        <button
          className="admin-page-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <HiOutlineChevronLeft />
        </button>
        {start > 1 && (
          <>
            <button className="admin-page-btn" onClick={() => onPageChange(1)}>1</button>
            {start > 2 && <span style={{ padding: '0 4px', color: 'var(--admin-text-muted)' }}>...</span>}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            className={`admin-page-btn ${p === page ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span style={{ padding: '0 4px', color: 'var(--admin-text-muted)' }}>...</span>}
            <button className="admin-page-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
          </>
        )}
        <button
          className="admin-page-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <HiOutlineChevronRight />
        </button>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <div className="admin-modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3 style={{ margin: 0 }}>{title || 'Confirm Action'}</h3>
        </div>
        <div className="admin-modal-body">
          <p style={{ color: 'var(--admin-text-secondary)', margin: 0 }}>{message}</p>
        </div>
        <div className="admin-modal-footer">
          <button className="admin-btn admin-btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="admin-btn admin-btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminModal({ open, title, onClose, children, width = 600 }) {
  if (!open) return null;
  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="admin-btn admin-btn-ghost admin-btn-icon" onClick={onClose} aria-label="Close modal">
            <HiOutlineXMark />
          </button>
        </div>
        <div className="admin-modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, message, action }) {
  return (
    <div className="admin-empty">
      {icon && <div className="admin-empty-icon">{icon}</div>}
      <p>{message || 'No data found'}</p>
      {action}
    </div>
  );
}

export function LoadingSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div style={{ padding: '1rem' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="admin-skeleton" style={{ height: 20, flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCard({ label, value, icon, trend, color }) {
  return (
    <div className="admin-card admin-stat-card">
      <div className="admin-stat-icon" style={{ background: color || 'var(--admin-accent-soft)' }}>
        {icon}
      </div>
      <div className="admin-stat-body">
        <div className="admin-stat-label">{label}</div>
        <div className="admin-stat-value">{value}</div>
        {trend && (
          <div className="admin-stat-trend" style={{ color: trend > 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
            {trend > 0 ? '+' : '-'} {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminToast({ message, type = 'success', onClose }) {
  if (!message) return null;
  return (
    <div className={`admin-toast admin-toast-${type}`}>
      {type === 'success' ? <HiOutlineCheckCircle /> : <HiOutlineXCircle />}
      <span>{message}</span>
      <button onClick={onClose} className="admin-toast-close" aria-label="Dismiss notification">
        <HiOutlineXMark />
      </button>
    </div>
  );
}

export function useAdminToast() {
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast({ message: '', type: 'success' }), 4000);
  }, []);

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message: '', type: 'success' });
  }, []);

  return { toast, showToast, hideToast };
}

export function RefreshButton({ onRefresh }) {
  const [spinning, setSpinning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const handleRefresh = useCallback(async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
      setLastUpdated(new Date());
    } finally {
      setSpinning(false);
    }
  }, [onRefresh, spinning]);

  const timeLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="admin-refresh">
      {timeLabel && (
        <span className="admin-refresh-time">
          Updated {timeLabel}
        </span>
      )}
      <button
        onClick={handleRefresh}
        disabled={spinning}
        title="Refresh this page data"
        className="admin-btn admin-btn-secondary admin-btn-sm"
        style={{ minWidth: 98 }}
      >
        <HiOutlineArrowPath
          style={{
            transition: 'transform 0.6s ease',
            transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
            animation: spinning ? 'adminSpin 0.6s linear infinite' : 'none',
          }}
        />
        {spinning ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}
