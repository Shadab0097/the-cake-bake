'use client';

import { useCallback, useEffect, useState } from 'react';
import adminApi from '@/lib/adminApi';
import adminApiClient from '@/lib/adminApiClient';
import { ROLE_LABELS } from '@/lib/adminAccess.mjs';
import { LoadingSkeleton, AdminToast, useAdminToast } from '@/components/admin/AdminUI';

const COMPANY_FIELDS = [
  ['name', 'Display Name', 'The Cake Bake'],
  ['legalName', 'Legal Name', 'The Cake Bake Pvt Ltd'],
  ['gstin', 'GSTIN', '22AAAAA0000A1Z5'],
  ['hsnCode', 'HSN Code', '1905'],
  ['phone', 'Phone', '+91 99999 99999'],
  ['email', 'Email', 'hello@thecakebake.in'],
  ['addressLine1', 'Address Line 1', 'Shop 1, Bakery Lane'],
  ['addressLine2', 'Address Line 2', 'Near City Mall'],
  ['city', 'City', 'Mumbai'],
  ['state', 'State', 'Maharashtra'],
  ['pincode', 'Pincode', '400001'],
  ['invoicePrefix', 'Invoice Prefix', 'INV'],
];

const ASSIGNABLE_ROLES = ['superadmin', 'manager', 'staff'];

function getErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function AdminSettingsPage() {
  const [company, setCompany] = useState(null);
  const [reports, setReports] = useState({ dailyEnabled: false, recipients: [], hour: 9 });
  const [recipientsText, setRecipientsText] = useState('');
  const [admins, setAdmins] = useState([]);
  const [meId, setMeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingReports, setSavingReports] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState(null);
  const { toast, showToast, hideToast } = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, adminsRes, meRes] = await Promise.all([
        adminApi.settings.get(),
        adminApi.admins.list(),
        adminApiClient.get('/users/me'),
      ]);
      const settings = settingsRes.data.data || {};
      setCompany(settings.company || {});
      const r = settings.reports || {};
      setReports({ dailyEnabled: !!r.dailyEnabled, recipients: r.recipients || [], hour: r.hour ?? 9 });
      setRecipientsText((r.recipients || []).join(', '));
      setAdmins(adminsRes.data.data || []);
      setMeId(meRes.data.data?._id || '');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load settings'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const setCompanyField = (key, val) => setCompany((prev) => ({ ...prev, [key]: val }));

  const saveCompany = async () => {
    setSavingCompany(true);
    try {
      const payload = { ...company, gstRate: Number(company.gstRate) || 0 };
      const res = await adminApi.settings.update({ company: payload });
      setCompany(res.data.data.company || {});
      showToast('Company details saved', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Save failed'), 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const saveReports = async () => {
    setSavingReports(true);
    try {
      const recipients = recipientsText.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await adminApi.settings.update({
        reports: { dailyEnabled: reports.dailyEnabled, recipients, hour: Number(reports.hour) || 9 },
      });
      const r = res.data.data.reports || {};
      setReports({ dailyEnabled: !!r.dailyEnabled, recipients: r.recipients || [], hour: r.hour ?? 9 });
      setRecipientsText((r.recipients || []).join(', '));
      showToast('Report settings saved', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Save failed'), 'error');
    } finally {
      setSavingReports(false);
    }
  };

  const sendTest = async () => {
    setSendingTest(true);
    try {
      const res = await adminApi.settings.sendDailyReport();
      showToast(res.data.message || 'Report sent', res.data.data?.success ? 'success' : 'error');
    } catch (err) {
      showToast(getErrorMessage(err, 'Send failed'), 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const changeRole = async (admin, role) => {
    setRoleSavingId(admin._id);
    try {
      await adminApi.admins.setRole(admin._id, role);
      setAdmins((prev) => prev.map((a) => (a._id === admin._id ? { ...a, role } : a)));
      showToast(`${admin.name} → ${ROLE_LABELS[role] || role}`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Role update failed'), 'error');
    } finally {
      setRoleSavingId(null);
    }
  };

  if (loading) return <LoadingSkeleton rows={8} cols={2} />;

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      <div className="admin-page-header">
        <div>
          <div className="admin-page-kicker">Configuration</div>
          <h1 className="admin-page-title">Settings</h1>
          <div className="admin-page-subtitle">Company details for invoices, scheduled reports, and admin roles.</div>
        </div>
      </div>

      {/* Company details */}
      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-section-heading"><h3>Company &amp; Invoice Details</h3></div>
        <div className="admin-form-grid admin-form-grid-2">
          {COMPANY_FIELDS.map(([key, label, placeholder]) => (
            <div className="admin-field" key={key}>
              <label className="admin-label">{label}</label>
              <input className="admin-input" value={company?.[key] || ''} placeholder={placeholder} onChange={(e) => setCompanyField(key, e.target.value)} />
            </div>
          ))}
          <div className="admin-field">
            <label className="admin-label">GST Rate (%)</label>
            <input className="admin-input" type="number" min="0" max="28" value={company?.gstRate ?? 0} onChange={(e) => setCompanyField('gstRate', e.target.value)} />
            <span className="admin-hint">Shown on invoices. Order tax is ₹0 until you enable tax at checkout.</span>
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button className="admin-btn admin-btn-primary" onClick={saveCompany} disabled={savingCompany}>
            {savingCompany ? 'Saving…' : 'Save Company Details'}
          </button>
        </div>
      </section>

      {/* Scheduled reports */}
      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-section-heading"><h3>Daily Email Report</h3></div>
        <div className="admin-form-grid admin-form-grid-2">
          <div className="admin-field">
            <label className="admin-label">Recipients</label>
            <input className="admin-input" value={recipientsText} placeholder="owner@email.com, finance@email.com" onChange={(e) => setRecipientsText(e.target.value)} />
            <span className="admin-hint">Comma-separated. Leave blank to send to all super admins.</span>
          </div>
          <div className="admin-field">
            <label className="admin-label">Send at hour (0–23, server time)</label>
            <input className="admin-input" type="number" min="0" max="23" value={reports.hour} onChange={(e) => setReports((p) => ({ ...p, hour: e.target.value }))} style={{ maxWidth: 120 }} />
          </div>
        </div>
        <label className="admin-toggle" style={{ marginBottom: '1rem' }}>
          <input type="checkbox" checked={reports.dailyEnabled} onChange={(e) => setReports((p) => ({ ...p, dailyEnabled: e.target.checked }))} />
          <span className="admin-switch" aria-hidden="true" />
          <span className="admin-toggle-text">
            <span className="admin-toggle-label">Enable daily report</span>
            <span className="admin-toggle-desc">Emails yesterday&apos;s sales &amp; profit summary each morning. Requires email to be configured.</span>
          </span>
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="admin-btn admin-btn-primary" onClick={saveReports} disabled={savingReports}>
            {savingReports ? 'Saving…' : 'Save Report Settings'}
          </button>
          <button className="admin-btn admin-btn-secondary" onClick={sendTest} disabled={sendingTest}>
            {sendingTest ? 'Sending…' : 'Send Test Now'}
          </button>
        </div>
      </section>

      {/* Admin users */}
      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h3>Admin Users &amp; Roles</h3>
            <span className="admin-section-subtitle">Super Admin = full · Manager = no financials/settings · Staff = operations only</span>
          </div>
        </div>
        {admins.length === 0 ? (
          <div className="admin-empty-compact">No admin users</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th></tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isSelf = admin._id === meId;
                  const isLegacyAdmin = admin.role === 'admin';
                  return (
                    <tr key={admin._id}>
                      <td className="admin-row-title">{admin.name}{isSelf && <span className="admin-pill admin-pill-success" style={{ marginLeft: 6 }}>you</span>}</td>
                      <td className="admin-row-meta">{admin.email}</td>
                      <td>
                        <select
                          className="admin-input admin-select"
                          style={{ maxWidth: 170 }}
                          value={isLegacyAdmin ? 'admin' : admin.role}
                          disabled={isSelf || roleSavingId === admin._id}
                          onChange={(e) => changeRole(admin, e.target.value)}
                        >
                          {isLegacyAdmin && <option value="admin">Admin (legacy · full)</option>}
                          {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
