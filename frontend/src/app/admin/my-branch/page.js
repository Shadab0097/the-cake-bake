'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import adminApi, { formatPrice } from '@/lib/adminApi';
import { ROLE_LABELS } from '@/lib/adminAccess.mjs';
import { LoadingSkeleton, AdminToast, useAdminToast, AdminModal } from '@/components/admin/AdminUI';

const emptyStaff = { name: '', email: '', phone: '', role: 'staff', branchIds: [] };

const blankSettings = {
  addressLine1: '', addressLine2: '', city: '', state: '', pincode: '',
  invoicePrefix: '', codEnabled: true, reportEnabled: false, reportRecipientsText: '',
};

function settingsFromBranch(b) {
  if (!b) return blankSettings;
  const o = b.origin || {};
  return {
    addressLine1: o.addressLine1 || '', addressLine2: o.addressLine2 || '', city: o.city || '',
    state: o.state || '', pincode: o.pincode || '',
    invoicePrefix: b.invoicePrefix || '', codEnabled: b.codEnabled !== false,
    reportEnabled: !!b.reportEnabled, reportRecipientsText: (b.reportRecipients || []).join(', '),
  };
}

function errMsg(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback;
}

const adminBranchNames = (u) => (u?.branchIds || []).map((b) => (b && b.name ? b.name : null)).filter(Boolean);

export default function MyBranchPage() {
  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [settings, setSettings] = useState(blankSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newStaff, setNewStaff] = useState(emptyStaff);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null);
  const { toast, showToast, hideToast } = useAdminToast();

  const selected = useMemo(() => branches.find((b) => b._id === selectedId) || branches[0] || null, [branches, selectedId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [branchRes, staffRes] = await Promise.all([
        adminApi.myBranch.get(),
        adminApi.myBranch.staff.list().catch(() => ({ data: { data: [] } })),
      ]);
      const list = branchRes.data.data || [];
      setBranches(list);
      setStaff(staffRes.data.data || []);
      setSelectedId((prev) => (list.find((b) => b._id === prev) ? prev : (list[0]?._id || '')));
    } catch (err) {
      showToast(errMsg(err, 'Failed to load branch'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSettings(settingsFromBranch(selected)); }, [selected]);

  const saveSettings = async () => {
    if (!selected) return;
    setSavingSettings(true);
    try {
      const recipients = settings.reportRecipientsText.split(',').map((s) => s.trim()).filter(Boolean);
      await adminApi.myBranch.update(selected._id, {
        origin: {
          addressLine1: settings.addressLine1, addressLine2: settings.addressLine2,
          city: settings.city, state: settings.state, pincode: settings.pincode,
        },
        invoicePrefix: settings.invoicePrefix,
        codEnabled: settings.codEnabled,
        reportEnabled: settings.reportEnabled,
        reportRecipients: recipients,
      });
      showToast('Branch settings saved', 'success');
      await load();
    } catch (err) {
      showToast(errMsg(err, 'Save failed'), 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const openAddStaff = () => {
    setNewStaff({ ...emptyStaff, branchIds: selected ? [selected._id] : [] });
    setAddOpen(true);
  };

  const createStaff = async () => {
    if (!newStaff.name.trim() || !newStaff.email.trim()) { showToast('Name and email are required', 'error'); return; }
    setCreating(true);
    try {
      const res = await adminApi.myBranch.staff.create({
        name: newStaff.name.trim(), email: newStaff.email.trim(), phone: newStaff.phone.trim(),
        role: newStaff.role, branchIds: newStaff.branchIds,
      });
      const data = res.data.data || {};
      if (data.tempPassword) setTempPasswordInfo({ email: data.user?.email || newStaff.email, tempPassword: data.tempPassword });
      setAddOpen(false);
      showToast('Team member created', 'success');
      await load();
    } catch (err) {
      showToast(errMsg(err, 'Could not create team member'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (member) => {
    const next = member.isActive === false;
    setActionId(member._id);
    try {
      await adminApi.myBranch.staff.setActive(member._id, next);
      setStaff((prev) => prev.map((m) => (m._id === member._id ? { ...m, isActive: next } : m)));
      showToast(`${member.name} ${next ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
      showToast(errMsg(err, 'Update failed'), 'error');
    } finally {
      setActionId(null);
    }
  };

  const resetPassword = async (member) => {
    setActionId(member._id);
    try {
      const res = await adminApi.myBranch.staff.resetPassword(member._id);
      const data = res.data.data || {};
      if (data.tempPassword) setTempPasswordInfo({ email: data.email || member.email, tempPassword: data.tempPassword });
      showToast(`Password reset for ${member.name}`, 'success');
    } catch (err) {
      showToast(errMsg(err, 'Reset failed'), 'error');
    } finally {
      setActionId(null);
    }
  };

  if (loading) return <LoadingSkeleton rows={8} cols={2} />;

  if (branches.length === 0) {
    return (
      <div>
        <AdminToast {...toast} onClose={hideToast} />
        <div className="admin-empty-compact">No branch is assigned to your account yet.</div>
      </div>
    );
  }

  const zones = selected?.zones || [];

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div className="admin-page-kicker">Branch</div>
          <h1 className="admin-page-title">My Branch</h1>
          <div className="admin-page-subtitle">Manage your branch&apos;s pickup details, COD, reports, and team.</div>
        </div>
        {branches.length > 1 && (
          <select className="admin-input admin-select" style={{ maxWidth: 220 }} value={selected?._id || ''} onChange={(e) => setSelectedId(e.target.value)}>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {tempPasswordInfo && (
        <div className="admin-card" style={{ marginBottom: '1rem', borderColor: 'var(--admin-warning, #b8860b)', background: 'rgba(184,134,11,0.06)' }}>
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Temporary password for {tempPasswordInfo.email}</p>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>Share securely. Shown once; they should change it after signing in.</p>
          <code style={{ display: 'inline-block', padding: '0.5rem 0.75rem', background: 'var(--admin-surface, #fff)', border: '1px solid var(--admin-border, #ddd)', borderRadius: 6, fontSize: '1rem', userSelect: 'all' }}>{tempPasswordInfo.tempPassword}</code>
          <div style={{ marginTop: '0.75rem' }}><button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setTempPasswordInfo(null)}>Done</button></div>
        </div>
      )}

      {/* Branch settings */}
      <section className="admin-card" style={{ marginBottom: '1.25rem' }}>
        <div className="admin-section-heading"><h3 style={{ fontSize: '1rem' }}>Branch Settings</h3></div>
        <div className="admin-form-grid admin-form-grid-2">
          <div className="admin-field"><label className="admin-label">Pickup Address Line 1</label><input className="admin-input" value={settings.addressLine1} onChange={(e) => setSettings((s) => ({ ...s, addressLine1: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Address Line 2</label><input className="admin-input" value={settings.addressLine2} onChange={(e) => setSettings((s) => ({ ...s, addressLine2: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">City</label><input className="admin-input" value={settings.city} onChange={(e) => setSettings((s) => ({ ...s, city: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">State</label><input className="admin-input" value={settings.state} onChange={(e) => setSettings((s) => ({ ...s, state: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Pincode</label><input className="admin-input" value={settings.pincode} onChange={(e) => setSettings((s) => ({ ...s, pincode: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Invoice Prefix</label><input className="admin-input" value={settings.invoicePrefix} onChange={(e) => setSettings((s) => ({ ...s, invoicePrefix: e.target.value }))} placeholder="Global default if blank" /></div>
        </div>
        <label className={`admin-toggle${settings.codEnabled ? ' admin-toggle-on' : ''}`} style={{ marginTop: '0.75rem' }}>
          <input type="checkbox" checked={settings.codEnabled} onChange={(e) => setSettings((s) => ({ ...s, codEnabled: e.target.checked }))} />
          <span className="admin-switch" aria-hidden="true" />
          <span className="admin-toggle-text"><span className="admin-toggle-label">Cash on Delivery</span><span className="admin-toggle-desc">Applies to all of this branch&apos;s zones.</span></span>
        </label>
        <label className={`admin-toggle${settings.reportEnabled ? ' admin-toggle-on' : ''}`} style={{ marginTop: '0.5rem' }}>
          <input type="checkbox" checked={settings.reportEnabled} onChange={(e) => setSettings((s) => ({ ...s, reportEnabled: e.target.checked }))} />
          <span className="admin-switch" aria-hidden="true" />
          <span className="admin-toggle-text"><span className="admin-toggle-label">Daily branch report</span><span className="admin-toggle-desc">Email a daily sales/profit digest for this branch.</span></span>
        </label>
        <div className="admin-field" style={{ marginTop: '0.75rem' }}>
          <label className="admin-label">Report recipients</label>
          <input className="admin-input" value={settings.reportRecipientsText} onChange={(e) => setSettings((s) => ({ ...s, reportRecipientsText: e.target.value }))} placeholder="ops@branch.in, manager@branch.in" />
          <span className="admin-hint">Comma-separated email addresses.</span>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button className="admin-btn admin-btn-primary" onClick={saveSettings} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save settings'}</button>
        </div>
      </section>

      {/* Zones (read-only) */}
      <section className="admin-card" style={{ marginBottom: '1.25rem' }}>
        <div className="admin-section-heading"><h3 style={{ fontSize: '1rem' }}>Delivery Zones</h3><span className="admin-hint">Coverage is configured by HQ.</span></div>
        {zones.length === 0 ? (
          <div className="admin-empty-compact">No zones assigned to this branch yet.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>City</th><th>State</th><th>Pincodes</th><th>Delivery</th><th>COD</th><th>Status</th></tr></thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z._id}>
                    <td className="admin-row-title">{z.city}</td>
                    <td className="admin-row-meta">{z.state || '—'}</td>
                    <td className="admin-row-meta">{(z.pincodes || []).length || '—'}</td>
                    <td className="admin-row-meta">{z.deliveryCharge ? formatPrice(z.deliveryCharge) : 'Free'}</td>
                    <td><span className={`admin-badge ${z.codEnabled ? 'badge-active' : 'badge-inactive'}`}>{z.codEnabled ? 'On' : 'Off'}</span></td>
                    <td><span className={`admin-badge ${z.isActive === false ? 'badge-inactive' : 'badge-active'}`}>{z.status === 'coming_soon' ? 'Coming soon' : (z.isActive === false ? 'Inactive' : 'Live')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Staff */}
      <section className="admin-card">
        <div className="admin-section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem' }}>Team</h3>
          <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={openAddStaff}>+ Add Team Member</button>
        </div>
        {staff.length === 0 ? (
          <div className="admin-empty-compact">No team members yet.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Branches</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {staff.map((m) => {
                  const inactive = m.isActive === false;
                  return (
                    <tr key={m._id}>
                      <td className="admin-row-title">{m.name}{m.mustChangePassword && <span className="admin-pill" style={{ marginLeft: 6 }}>temp pw</span>}</td>
                      <td className="admin-row-meta">{m.email}</td>
                      <td>{ROLE_LABELS[m.role] || m.role}</td>
                      <td className="admin-row-meta">{adminBranchNames(m).join(', ') || '—'}</td>
                      <td><span className={`admin-badge ${inactive ? 'badge-inactive' : 'badge-active'}`}>{inactive ? 'Inactive' : 'Active'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" disabled={actionId === m._id} onClick={() => toggleActive(m)}>{inactive ? 'Activate' : 'Deactivate'}</button>
                          <button className="admin-btn admin-btn-ghost admin-btn-sm" disabled={actionId === m._id} onClick={() => resetPassword(m)}>Reset password</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdminModal open={addOpen} title="Add Team Member" onClose={() => setAddOpen(false)}>
        <div className="admin-form-grid admin-form-grid-2">
          <div className="admin-field"><label className="admin-label">Name *</label><input className="admin-input" value={newStaff.name} onChange={(e) => setNewStaff((u) => ({ ...u, name: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Email *</label><input className="admin-input" type="email" value={newStaff.email} onChange={(e) => setNewStaff((u) => ({ ...u, email: e.target.value }))} /></div>
          <div className="admin-field"><label className="admin-label">Phone</label><input className="admin-input" value={newStaff.phone} onChange={(e) => setNewStaff((u) => ({ ...u, phone: e.target.value }))} /></div>
          <div className="admin-field">
            <label className="admin-label">Role</label>
            <select className="admin-input admin-select" value={newStaff.role} onChange={(e) => setNewStaff((u) => ({ ...u, role: e.target.value }))}>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
          </div>
        </div>
        {branches.length > 1 && (
          <div className="admin-field" style={{ marginTop: '0.5rem' }}>
            <label className="admin-label">Branch access</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {branches.map((b) => {
                const checked = newStaff.branchIds.includes(b._id);
                return (
                  <label key={b._id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.6rem', border: '1px solid var(--admin-border-subtle)', borderRadius: 6, cursor: 'pointer', background: checked ? 'rgba(216,27,96,0.12)' : 'transparent' }}>
                    <input type="checkbox" checked={checked} onChange={() => setNewStaff((u) => ({ ...u, branchIds: u.branchIds.includes(b._id) ? u.branchIds.filter((x) => x !== b._id) : [...u.branchIds, b._id] }))} />
                    {b.name}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <span className="admin-hint">A one-time temporary password is generated and shown once. Team members are scoped to your branch.</span>
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={createStaff} disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
        </div>
      </AdminModal>
    </div>
  );
}
