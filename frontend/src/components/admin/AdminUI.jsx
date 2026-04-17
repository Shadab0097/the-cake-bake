'use client';

import { useState, useCallback, useRef } from 'react';

export function StatusBadge({ status, type = 'order' }) {
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
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="admin-pagination">
      <span>{total} total results</span>
      <div className="admin-pagination-btns">
        <button
          className="admin-page-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ‹
        </button>
        {start > 1 && (
          <>
            <button className="admin-page-btn" onClick={() => onPageChange(1)}>1</button>
            {start > 2 && <span style={{ padding: '0 4px', color: 'var(--admin-text-muted)' }}>…</span>}
          </>
        )}
        {pages.map((p) => (
          <button
            key={p}
            className={`admin-page-btn ${p === page ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span style={{ padding: '0 4px', color: 'var(--admin-text-muted)' }}>…</span>}
            <button className="admin-page-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
          </>
        )}
        <button
          className="admin-page-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          ›
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
          <button className="admin-btn admin-btn-ghost admin-btn-icon" onClick={onClose}>✕</button>
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
    <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 'var(--admin-radius)',
        background: color || 'var(--admin-accent-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.25rem', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', marginBottom: '0.125rem' }}>{label}</div>
        <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--admin-text)' }}>{value}</div>
        {trend && <div style={{ fontSize: '0.75rem', color: trend > 0 ? 'var(--admin-success)' : 'var(--admin-danger)', marginTop: '0.125rem' }}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>}
      </div>
    </div>
  );
}

export function AdminToast({ message, type = 'success', onClose }) {
  if (!message) return null;
  return (
    <div className={`admin-toast admin-toast-${type}`}>
      {type === 'success' ? '✓' : '✕'} {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: '0.5rem', fontSize: '1rem' }}>✕</button>
    </div>
  );
}

// Hook for toast state
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

// Refresh button — only calls the onRefresh fn passed to it; no global effects
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {timeLabel && (
        <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
          Updated {timeLabel}
        </span>
      )}
      <button
        onClick={handleRefresh}
        disabled={spinning}
        title="Refresh this page data"
        className="admin-btn admin-btn-secondary admin-btn-sm"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', minWidth: 90 }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.875rem',
            transition: 'transform 0.6s ease',
            transform: spinning ? 'rotate(360deg)' : 'rotate(0deg)',
            animation: spinning ? 'adminSpin 0.6s linear infinite' : 'none',
          }}
        >
          ↻
        </span>
        {spinning ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}
