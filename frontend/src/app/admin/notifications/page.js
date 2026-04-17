'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi, { formatDateTime, NOTIFICATION_TEMPLATES } from '@/lib/adminApi';
import { Pagination, AdminModal, StatusBadge, AdminToast, useAdminToast, EmptyState, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: '', type: '' });
  const [sendModal, setSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({ phone: '', templateName: '', params: '{}' });
  const [sending, setSending] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      const res = await adminApi.notifications.list(params);
      const d = res.data.data;
      setNotifications(d.items || []);
      setTotalPages(d.pagination?.totalPages || 1);
      setTotal(d.pagination?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSend = async () => {
    setSending(true);
    try {
      let parsedParams = {};
      try { parsedParams = JSON.parse(sendForm.params); } catch (e) { /* ignore */ }
      await adminApi.notifications.send({
        phone: sendForm.phone,
        templateName: sendForm.templateName,
        params: parsedParams,
      });
      showToast('Notification sent');
      setSendModal(false);
      setSendForm({ phone: '', templateName: '', params: '{}' });
      fetch();
    } catch (err) { showToast(err.response?.data?.message || 'Send failed', 'error'); }
    finally { setSending(false); }
  };

  const getStatusColor = (status) => {
    const map = { sent: 'badge-confirmed', delivered: 'badge-delivered', read: 'badge-active', failed: 'badge-failed' };
    return map[status] || 'badge-pending';
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Notifications</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <RefreshButton onRefresh={fetch} />
          <button className="admin-btn admin-btn-primary" onClick={() => setSendModal(true)}>📤 Send Notification</button>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="admin-input admin-select" style={{ maxWidth: 160 }} value={filters.status} onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
          <option value="">All Status</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="read">Read</option>
          <option value="failed">Failed</option>
        </select>
        <select className="admin-input admin-select" style={{ maxWidth: 200 }} value={filters.type} onChange={(e) => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}>
          <option value="">All Types</option>
          {NOTIFICATION_TEMPLATES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{total} notifications</span>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0 }}>
        {loading ? <LoadingSkeleton rows={10} cols={6} /> : notifications.length === 0 ? (
          <EmptyState message="No notifications found" icon="🔔" />
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Channel</th>
                    <th>Type</th>
                    <th>Template</th>
                    <th>Status</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n._id}>
                      <td>
                        <div style={{ fontSize: '0.875rem' }}>{n.recipient || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{n.user?.name || ''}</div>
                      </td>
                      <td><span className="admin-badge badge-new" style={{ textTransform: 'uppercase', fontSize: '0.6875rem' }}>{n.channel || '—'}</span></td>
                      <td style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem' }}>{n.type?.replace(/_/g, ' ') || '—'}</td>
                      <td style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem', fontFamily: 'monospace' }}>{n.templateName || '—'}</td>
                      <td><span className={`admin-badge ${getStatusColor(n.status)}`}>{n.status || 'unknown'}</span></td>
                      <td style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDateTime(n.sentAt || n.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0 1rem' }}>
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Send Modal */}
      <AdminModal open={sendModal} title="Send Manual Notification" onClose={() => setSendModal(false)} width={500}>
        <div className="admin-field">
          <label className="admin-label">Phone Number *</label>
          <input className="admin-input" value={sendForm.phone} onChange={e => setSendForm(f => ({ ...f, phone: e.target.value }))} placeholder="+919999999999" />
        </div>
        <div className="admin-field">
          <label className="admin-label">Template *</label>
          <select className="admin-input admin-select" value={sendForm.templateName} onChange={e => setSendForm(f => ({ ...f, templateName: e.target.value }))}>
            <option value="">Select template...</option>
            {NOTIFICATION_TEMPLATES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Template Params (JSON)</label>
          <textarea className="admin-input admin-textarea" value={sendForm.params} onChange={e => setSendForm(f => ({ ...f, params: e.target.value }))} placeholder='{"customerName": "John", "orderNumber": "CB-1234"}' style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }} />
        </div>
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => setSendModal(false)}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleSend} disabled={sending || !sendForm.phone || !sendForm.templateName}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </AdminModal>
    </div>
  );
}
