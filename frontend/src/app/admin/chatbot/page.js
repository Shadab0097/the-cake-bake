'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi, { formatDateTime } from '@/lib/adminApi';
import {
  AdminModal, AdminToast, useAdminToast, EmptyState,
  LoadingSkeleton, Pagination, RefreshButton
} from '@/components/admin/AdminUI';

const CATEGORIES = ['greeting', 'order', 'support', 'faq', 'custom'];
const MATCH_TYPES = ['contains', 'exact', 'startsWith'];

const EMPTY_RULE = { keyword: '', response: '', matchType: 'contains', category: 'custom', priority: 0, isActive: true };

export default function AdminChatbotPage() {
  const [tab, setTab] = useState('rules');
  const [stats, setStats] = useState(null);

  // Rules state
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesPage, setRulesPage] = useState(1);
  const [rulesTotalPages, setRulesTotalPages] = useState(1);
  const [rulesTotal, setRulesTotal] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [matchedFilter, setMatchedFilter] = useState('');

  // Modal state
  const [modal, setModal] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { toast, showToast, hideToast } = useAdminToast();

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.chatbot.getStats();
      setStats(res.data.data);
    } catch { /* silent */ }
  }, []);

  const fetchRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const params = { page: rulesPage, limit: 15 };
      if (categoryFilter) params.category = categoryFilter;
      if (searchText) params.search = searchText;
      const res = await adminApi.chatbot.listRules(params);
      const d = res.data.data;
      setRules(d.items || []);
      setRulesTotalPages(d.pagination?.totalPages || 1);
      setRulesTotal(d.pagination?.total || 0);
    } catch { showToast('Failed to load rules', 'error'); }
    finally { setRulesLoading(false); }
  }, [rulesPage, categoryFilter, searchText]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = { page: logsPage, limit: 20 };
      if (matchedFilter) params.matched = matchedFilter;
      const res = await adminApi.chatbot.getLogs(params);
      const d = res.data.data;
      setLogs(d.items || []);
      setLogsTotalPages(d.pagination?.totalPages || 1);
      setLogsTotal(d.pagination?.total || 0);
    } catch { showToast('Failed to load logs', 'error'); }
    finally { setLogsLoading(false); }
  }, [logsPage, matchedFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (tab === 'rules') fetchRules(); }, [tab, fetchRules]);
  useEffect(() => { if (tab === 'logs') fetchLogs(); }, [tab, fetchLogs]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreate = () => { setEditRule(null); setForm(EMPTY_RULE); setModal(true); };
  const openEdit = (r) => { setEditRule(r); setForm({ keyword: r.keyword, response: r.response, matchType: r.matchType, category: r.category, priority: r.priority, isActive: r.isActive }); setModal(true); };
  const closeModal = () => { setModal(false); setEditRule(null); };

  const handleSave = async () => {
    if (!form.keyword.trim() || !form.response.trim()) {
      showToast('Keyword and response are required', 'error'); return;
    }
    setSaving(true);
    try {
      if (editRule) {
        await adminApi.chatbot.updateRule(editRule._id, form);
        showToast('Rule updated');
      } else {
        await adminApi.chatbot.createRule(form);
        showToast('Rule created');
      }
      closeModal();
      fetchRules();
      fetchStats();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminApi.chatbot.deleteRule(deleteId);
      showToast('Rule deleted');
      setDeleteId(null);
      fetchRules();
      fetchStats();
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    } finally { setDeleting(false); }
  };

  const toggleActive = async (rule) => {
    try {
      await adminApi.chatbot.updateRule(rule._id, { isActive: !rule.isActive });
      fetchRules();
    } catch { showToast('Toggle failed', 'error'); }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const tabBtn = (t) => ({
    padding: '0.5rem 1.25rem', borderRadius: 'var(--admin-radius-sm)', border: 'none',
    cursor: 'pointer', fontSize: '0.875rem', fontWeight: tab === t ? 600 : 400,
    background: tab === t ? 'var(--admin-accent-soft)' : 'transparent',
    color: tab === t ? 'var(--admin-accent-hover)' : 'var(--admin-text-secondary)',
    transition: 'all var(--admin-transition)',
  });

  const matchBadgeStyle = (type) => {
    const map = {
      contains: { background: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
      exact: { background: 'rgba(34,197,94,0.12)', color: '#4ade80' },
      startsWith: { background: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
      fallback: { background: 'rgba(239,68,68,0.12)', color: '#f87171' },
    };
    return { ...(map[type] || map.fallback), padding: '0.15rem 0.5rem', borderRadius: 99, fontSize: '0.7rem', fontWeight: 600 };
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>💬 WhatsApp Bot</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
            Keyword-based auto-reply rules for customer messages
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <RefreshButton onRefresh={() => { fetchStats(); tab === 'rules' ? fetchRules() : fetchLogs(); }} />
          {tab === 'rules' && (
            <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ New Rule</button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Active Rules', value: stats.activeRules, icon: '✅' },
            { label: 'Total Rules', value: stats.totalRules, icon: '📋' },
            { label: 'Messages Today', value: stats.todayMessages, icon: '💬' },
            { label: 'Match Rate', value: `${stats.matchRate}%`, icon: '🎯' },
          ].map((s) => (
            <div key={s.label} className="admin-card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{s.icon}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--admin-text)' }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{s.label}</div>
            </div>
          ))}
          {stats.topKeywords?.length > 0 && (
            <div className="admin-card" style={{ padding: '1rem', gridColumn: 'span 2' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }}>TOP KEYWORDS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {stats.topKeywords.map((k) => (
                  <span key={k._id} style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent-hover)', padding: '0.15rem 0.5rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 500 }}>
                    {k._id} ({k.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--admin-surface)', padding: '0.25rem', borderRadius: 'var(--admin-radius-sm)', width: 'fit-content', border: '1px solid var(--admin-border-subtle)' }}>
        <button style={tabBtn('rules')} onClick={() => setTab('rules')}>📋 Rules ({rulesTotal})</button>
        <button style={tabBtn('logs')} onClick={() => setTab('logs')}>🗂 Conversations ({logsTotal})</button>
      </div>

      {/* ── RULES TAB ── */}
      {tab === 'rules' && (
        <div>
          {/* Filters */}
          <div className="admin-card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="admin-input" style={{ maxWidth: 220 }}
              placeholder="Search keyword..." value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setRulesPage(1); }}
            />
            <select className="admin-input admin-select" style={{ maxWidth: 160 }} value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setRulesPage(1); }}>
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{rulesTotal} rules</span>
          </div>

          <div className="admin-card" style={{ padding: 0 }}>
            {rulesLoading ? <LoadingSkeleton rows={6} cols={5} /> : rules.length === 0 ? (
              <EmptyState icon="🤖" message="No bot rules yet. Create your first keyword rule!" />
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Keyword</th>
                        <th>Match</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Response (preview)</th>
                        <th>Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r) => (
                        <tr key={r._id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--admin-accent-hover)' }}>{r.keyword}</td>
                          <td><span style={matchBadgeStyle(r.matchType)}>{r.matchType}</span></td>
                          <td><span className="admin-badge badge-new" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>{r.category}</span></td>
                          <td style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>{r.priority}</td>
                          <td style={{ maxWidth: 280 }}>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.response}
                            </div>
                          </td>
                          <td>
                            <button
                              onClick={() => toggleActive(r)}
                              style={{ background: r.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: r.isActive ? '#4ade80' : '#f87171', border: 'none', borderRadius: 99, padding: '0.15rem 0.6rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                            >
                              {r.isActive ? '● ON' : '○ OFF'}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openEdit(r)}>Edit</button>
                              <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteId(r._id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '0 1rem' }}>
                  <Pagination page={rulesPage} totalPages={rulesTotalPages} total={rulesTotal} onPageChange={setRulesPage} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {tab === 'logs' && (
        <div>
          <div className="admin-card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="admin-input admin-select" style={{ maxWidth: 180 }} value={matchedFilter}
              onChange={(e) => { setMatchedFilter(e.target.value); setLogsPage(1); }}>
              <option value="">All Messages</option>
              <option value="true">Matched a Rule</option>
              <option value="false">Fallback Only</option>
            </select>
            <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>{logsTotal} conversations</span>
          </div>

          <div className="admin-card" style={{ padding: 0 }}>
            {logsLoading ? <LoadingSkeleton rows={8} cols={5} /> : logs.length === 0 ? (
              <EmptyState icon="📭" message="No conversations yet. Bot replies will appear here once customers message." />
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Incoming Message</th>
                        <th>Matched Keyword</th>
                        <th>Bot Response</th>
                        <th>Delivered</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l._id}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>
                            +{l.senderPhone}
                          </td>
                          <td style={{ maxWidth: 200 }}>
                            <div style={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--admin-text)' }}>
                              {l.incomingMessage}
                            </div>
                          </td>
                          <td>
                            {l.matchedKeyword
                              ? <span style={matchBadgeStyle(l.matchType)}>{l.matchedKeyword}</span>
                              : <span style={matchBadgeStyle('fallback')}>fallback</span>}
                          </td>
                          <td style={{ maxWidth: 220 }}>
                            <div style={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--admin-text-secondary)' }}>
                              {l.outgoingResponse}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: l.delivered ? '#4ade80' : '#f87171' }}>
                              {l.delivered ? '✓ Yes' : '✗ No'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(l.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '0 1rem' }}>
                  <Pagination page={logsPage} totalPages={logsTotalPages} total={logsTotal} onPageChange={setLogsPage} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      <AdminModal open={modal} title={editRule ? 'Edit Bot Rule' : 'Create Bot Rule'} onClose={closeModal} width={520}>
        <div className="admin-field">
          <label className="admin-label">Keyword * <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>(stored lowercase)</span></label>
          <input className="admin-input" placeholder="e.g. order status, help, hi" value={form.keyword}
            onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value.toLowerCase() }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="admin-field">
            <label className="admin-label">Match Type</label>
            <select className="admin-input admin-select" value={form.matchType}
              onChange={(e) => setForm((f) => ({ ...f, matchType: e.target.value }))}>
              {MATCH_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label">Category</label>
            <select className="admin-input admin-select" value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="admin-field">
            <label className="admin-label">Priority <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>(higher = checked first)</span></label>
            <input className="admin-input" type="number" min={0} max={100} value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} />
          </div>
          <div className="admin-field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', paddingBottom: '0.5rem' }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--admin-accent)' }} />
              <span style={{ fontSize: '0.875rem', color: 'var(--admin-text-secondary)' }}>Active</span>
            </label>
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Response * <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>({form.response.length}/1000)</span></label>
          <textarea className="admin-input admin-textarea" rows={4} placeholder="The message the bot will send when this keyword is matched..."
            value={form.response} onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))} style={{ minHeight: 100 }} />
        </div>

        {/* Match type hint */}
        <div style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border-subtle)', borderRadius: 'var(--admin-radius-sm)', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
          💡 <strong style={{ color: 'var(--admin-text-secondary)' }}>{form.matchType}</strong>
          {form.matchType === 'contains' && ' — triggers if the customer message contains this keyword anywhere'}
          {form.matchType === 'exact' && ' — triggers only if the entire message equals this keyword'}
          {form.matchType === 'startsWith' && ' — triggers if the message begins with this keyword'}
        </div>

        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleSave}
            disabled={saving || !form.keyword.trim() || !form.response.trim()}>
            {saving ? 'Saving...' : editRule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </AdminModal>

      {/* ── Delete Confirmation ── */}
      <AdminModal open={!!deleteId} title="Delete Bot Rule" onClose={() => setDeleteId(null)} width={420}>
        <p style={{ color: 'var(--admin-text-secondary)', margin: 0 }}>
          Are you sure you want to delete this rule? This action cannot be undone.
        </p>
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
          <button className="admin-btn admin-btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Rule'}
          </button>
        </div>
      </AdminModal>
    </div>
  );
}
