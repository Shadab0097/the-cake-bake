'use client';

import { useCallback, useEffect, useState } from 'react';
import adminApi from '@/lib/adminApi';
import adminApiClient from '@/lib/adminApiClient';
import { ROLE_LABELS } from '@/lib/adminAccess.mjs';
import { LoadingSkeleton, AdminToast, useAdminToast, AdminModal } from '@/components/admin/AdminUI';

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

const STORE_TEXT_FIELDS = [
  ['addressLine1', 'Address Line 1', 'Shop 1, Bakery Lane'],
  ['addressLine2', 'Address Line 2', 'Near City Mall'],
  ['city', 'City', 'Amritsar'],
  ['state', 'State', 'Punjab'],
  ['pincode', 'Pincode', '143001'],
  ['defaultCity', 'Default City (storefront)', 'Amritsar'],
];

const ORIGIN_TEXT_FIELDS = [
  ['addressLine1', 'Address Line 1', 'Shop 1, Bakery Lane'],
  ['addressLine2', 'Address Line 2', 'Near City Mall'],
  ['city', 'City', 'Amritsar'],
  ['state', 'State', 'Punjab'],
  ['pincode', 'Pincode', '143001'],
];

const emptyBranchForm = {
  origin: { addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', lat: '', lng: '' },
  invoicePrefix: '',
  codEnabled: true,
  reportRecipients: '',
  reportEnabled: false,
};

const emptyBranchModal = { open: false, mode: 'create', id: '', name: '', code: '', isActive: true };

const ASSIGNABLE_ROLES = ['superadmin', 'manager', 'staff', 'branchadmin'];
const CREATABLE_ROLES = ['staff', 'manager', 'admin', 'superadmin', 'branchadmin'];
const emptyNewUser = { name: '', email: '', phone: '', role: 'staff', branchIds: [] };

// Branch ids on an admin record may arrive populated ({_id,name}) or as raw ids.
const adminBranchIds = (admin) => (admin?.branchIds || []).map((b) => (b && b._id ? b._id : b)).map(String);
const adminBranchNames = (admin) => (admin?.branchIds || []).map((b) => (b && b.name ? b.name : null)).filter(Boolean);

function getErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback;
}

export default function AdminSettingsPage() {
  const [company, setCompany] = useState(null);
  const [reports, setReports] = useState({ dailyEnabled: false, recipients: [], hour: 9 });
  const [recipientsText, setRecipientsText] = useState('');
  const [commerce, setCommerce] = useState({ codEnabled: true });
  const [storeLocation, setStoreLocation] = useState({});
  const [zones, setZones] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [branchForm, setBranchForm] = useState(emptyBranchForm);
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchModal, setBranchModal] = useState(emptyBranchModal);
  const [savingBranchIdentity, setSavingBranchIdentity] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [meId, setMeId] = useState('');
  const [meRole, setMeRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingReports, setSavingReports] = useState(false);
  const [savingCommerce, setSavingCommerce] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState(null);
  const [userActionId, setUserActionId] = useState(null);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [creatingUser, setCreatingUser] = useState(false);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null); // { email, tempPassword }
  const [branchAssign, setBranchAssign] = useState({ open: false, admin: null, branchIds: [], saving: false });
  const { toast, showToast, hideToast } = useAdminToast();

  const isSuperAdmin = meRole === 'superadmin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, adminsRes, meRes, zonesRes, branchesRes] = await Promise.all([
        adminApi.settings.get(),
        adminApi.admins.list(),
        adminApiClient.get('/users/me'),
        adminApi.delivery.getZones().catch(() => ({ data: { data: [] } })),
        adminApi.delivery.getBranches().catch(() => ({ data: { data: [] } })),
      ]);
      const settings = settingsRes.data.data || {};
      setCompany(settings.company || {});
      const r = settings.reports || {};
      setReports({ dailyEnabled: !!r.dailyEnabled, recipients: r.recipients || [], hour: r.hour ?? 9 });
      setRecipientsText((r.recipients || []).join(', '));
      setCommerce({ codEnabled: settings.commerce?.codEnabled !== false });
      setStoreLocation(settings.storeLocation || {});
      setZones(zonesRes.data.data || []);
      setBranches(branchesRes.data.data || []);
      setAdmins(adminsRes.data.data || []);
      setMeId(meRes.data.data?._id || '');
      setMeRole(meRes.data.data?.role || '');
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to load settings'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const setCompanyField = (key, val) => setCompany((prev) => ({ ...prev, [key]: val }));
  const setStoreField = (key, val) => setStoreLocation((prev) => ({ ...prev, [key]: val }));

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

  const saveCommerce = async (codEnabled) => {
    setSavingCommerce(true);
    try {
      const res = await adminApi.settings.update({ commerce: { codEnabled } });
      setCommerce({ codEnabled: res.data.data.commerce?.codEnabled !== false });
      showToast(codEnabled ? 'Cash on Delivery enabled' : 'Cash on Delivery disabled', 'success');
    } catch (err) {
      // Revert optimistic toggle on failure
      setCommerce((prev) => ({ ...prev }));
      showToast(getErrorMessage(err, 'Save failed'), 'error');
    } finally {
      setSavingCommerce(false);
    }
  };

  const toggleCod = (checked) => {
    setCommerce({ codEnabled: checked });
    saveCommerce(checked);
  };

  const saveStore = async () => {
    setSavingStore(true);
    try {
      const payload = {
        addressLine1: storeLocation.addressLine1 || '',
        addressLine2: storeLocation.addressLine2 || '',
        city: storeLocation.city || '',
        state: storeLocation.state || '',
        pincode: storeLocation.pincode || '',
        defaultCity: storeLocation.defaultCity || '',
        lat: storeLocation.lat === '' || storeLocation.lat === undefined ? null : storeLocation.lat,
        lng: storeLocation.lng === '' || storeLocation.lng === undefined ? null : storeLocation.lng,
      };
      const res = await adminApi.settings.update({ storeLocation: payload });
      setStoreLocation(res.data.data.storeLocation || {});
      showToast('Store location saved', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Save failed'), 'error');
    } finally {
      setSavingStore(false);
    }
  };

  const loadBranchForm = (branch) => {
    if (!branch) { setBranchForm(emptyBranchForm); return; }
    const o = branch.origin || {};
    setBranchForm({
      origin: {
        addressLine1: o.addressLine1 || '',
        addressLine2: o.addressLine2 || '',
        city: o.city || '',
        state: o.state || '',
        pincode: o.pincode || '',
        lat: o.lat ?? '',
        lng: o.lng ?? '',
      },
      invoicePrefix: branch.invoicePrefix || '',
      codEnabled: branch.codEnabled !== false,
      reportRecipients: (branch.reportRecipients || []).join(', '),
      reportEnabled: !!branch.reportEnabled,
    });
  };

  const selectBranch = (branchId) => {
    setSelectedBranchId(branchId);
    loadBranchForm(branches.find((b) => b._id === branchId));
  };

  const setBranchOriginField = (key, val) => setBranchForm((prev) => ({ ...prev, origin: { ...prev.origin, [key]: val } }));

  const saveBranchSettings = async () => {
    if (!selectedBranchId) return;
    setSavingBranch(true);
    try {
      const o = branchForm.origin;
      const toNum = (v) => (v === '' || v === undefined || v === null ? null : (Number.isNaN(Number(v)) ? null : Number(v)));
      const payload = {
        origin: {
          addressLine1: o.addressLine1.trim(),
          addressLine2: o.addressLine2.trim(),
          city: o.city.trim(),
          state: o.state.trim(),
          pincode: o.pincode.trim(),
          lat: toNum(o.lat),
          lng: toNum(o.lng),
        },
        invoicePrefix: branchForm.invoicePrefix.trim(),
        codEnabled: !!branchForm.codEnabled,
        reportRecipients: branchForm.reportRecipients.split(',').map((s) => s.trim()).filter(Boolean),
        reportEnabled: !!branchForm.reportEnabled,
      };
      const res = await adminApi.delivery.updateBranch(selectedBranchId, payload);
      const updated = res.data.data;
      setBranches((prev) => prev.map((b) => (b._id === selectedBranchId ? updated : b)));
      loadBranchForm(updated);
      showToast('Branch settings saved', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Save failed'), 'error');
    } finally {
      setSavingBranch(false);
    }
  };

  const openBranchModal = (mode, branch = null) => {
    if (mode === 'edit' && branch) {
      setBranchModal({ open: true, mode: 'edit', id: branch._id, name: branch.name || '', code: branch.code || '', isActive: branch.isActive !== false });
    } else {
      setBranchModal({ ...emptyBranchModal, open: true, mode: 'create' });
    }
  };

  const saveBranchIdentity = async () => {
    const name = branchModal.name.trim();
    if (!name) { showToast('Branch name is required', 'error'); return; }
    setSavingBranchIdentity(true);
    try {
      const payload = { name, code: branchModal.code.trim(), isActive: !!branchModal.isActive };
      if (branchModal.mode === 'create') {
        const res = await adminApi.delivery.createBranch(payload);
        const created = res.data.data;
        setBranches((prev) => [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        setSelectedBranchId(created._id);
        loadBranchForm(created);
        showToast('Branch created', 'success');
      } else {
        const res = await adminApi.delivery.updateBranch(branchModal.id, payload);
        const updated = res.data.data;
        setBranches((prev) => prev.map((b) => (b._id === branchModal.id ? updated : b)));
        if (selectedBranchId === branchModal.id) loadBranchForm(updated);
        showToast('Branch updated', 'success');
      }
      setBranchModal(emptyBranchModal);
    } catch (err) {
      showToast(getErrorMessage(err, 'Save failed'), 'error');
    } finally {
      setSavingBranchIdentity(false);
    }
  };

  const selectedBranch = branches.find((b) => b._id === selectedBranchId) || null;
  const branchZones = selectedBranchId ? zones.filter((z) => String(z.branchId) === String(selectedBranchId)) : [];

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

  const createUser = async () => {
    const name = newUser.name.trim();
    const email = newUser.email.trim();
    if (!name || !email) {
      showToast('Name and email are required', 'error');
      return;
    }
    setCreatingUser(true);
    try {
      const res = await adminApi.admins.create({
        name,
        email,
        phone: newUser.phone.trim(),
        role: newUser.role,
        branchIds: newUser.branchIds,
      });
      const data = res.data.data || {};
      setNewUser(emptyNewUser);
      if (data.tempPassword) {
        setTempPasswordInfo({ email: data.user?.email || email, tempPassword: data.tempPassword });
      }
      showToast('Admin user created', 'success');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not create user'), 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const toggleActive = async (admin) => {
    const nextActive = admin.isActive === false;
    setUserActionId(admin._id);
    try {
      await adminApi.admins.setActive(admin._id, nextActive);
      setAdmins((prev) => prev.map((a) => (a._id === admin._id ? { ...a, isActive: nextActive } : a)));
      showToast(`${admin.name} ${nextActive ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Update failed'), 'error');
    } finally {
      setUserActionId(null);
    }
  };

  const resetPassword = async (admin) => {
    setUserActionId(admin._id);
    try {
      const res = await adminApi.admins.resetPassword(admin._id);
      const data = res.data.data || {};
      if (data.tempPassword) {
        setTempPasswordInfo({ email: data.email || admin.email, tempPassword: data.tempPassword });
      }
      showToast(`Password reset for ${admin.name}`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Reset failed'), 'error');
    } finally {
      setUserActionId(null);
    }
  };

  const openBranchAssign = (admin) => {
    setBranchAssign({ open: true, admin, branchIds: adminBranchIds(admin), saving: false });
  };

  const toggleAssignBranch = (id) => {
    setBranchAssign((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(id)
        ? prev.branchIds.filter((b) => b !== id)
        : [...prev.branchIds, id],
    }));
  };

  const saveBranchAssign = async () => {
    const admin = branchAssign.admin;
    if (!admin) return;
    setBranchAssign((prev) => ({ ...prev, saving: true }));
    try {
      await adminApi.admins.setBranches(admin._id, branchAssign.branchIds);
      showToast(`Branch access updated for ${admin.name}`, 'success');
      setBranchAssign({ open: false, admin: null, branchIds: [], saving: false });
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Could not update branch access'), 'error');
      setBranchAssign((prev) => ({ ...prev, saving: false }));
    }
  };

  if (loading) return <LoadingSkeleton rows={8} cols={2} />;

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div className="admin-page-kicker">Configuration</div>
          <h1 className="admin-page-title">Settings</h1>
          <div className="admin-page-subtitle">Company details, payments, branches, scheduled reports, and admin users.</div>
        </div>
        {/* Top-right location/branch picker — scopes the per-location sections below. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div className="admin-field" style={{ margin: 0, minWidth: 200 }}>
            <label className="admin-label" style={{ fontSize: '0.7rem' }}>Active Branch / Location</label>
            <select className="admin-input admin-select" value={selectedBranchId} onChange={(e) => selectBranch(e.target.value)}>
              <option value="">{branches.length ? 'Select a branch…' : 'No branches yet'}</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}{b.code ? ` (${b.code})` : ''}{b.isActive === false ? ' · inactive' : ''}</option>
              ))}
            </select>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={() => openBranchModal('create')}>+ Add Branch</button>
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

      {/* Payments / COD */}
      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-section-heading"><h3>Payments</h3></div>
        <label className={`admin-toggle${commerce.codEnabled ? ' admin-toggle-on' : ''}`}>
          <input type="checkbox" checked={commerce.codEnabled} disabled={savingCommerce} onChange={(e) => toggleCod(e.target.checked)} />
          <span className="admin-switch" aria-hidden="true" />
          <span className="admin-toggle-text">
            <span className="admin-toggle-label">Allow Cash on Delivery</span>
            <span className="admin-toggle-desc">
              Master switch, enforced at checkout. Per-zone COD can be turned off individually under Delivery → Zones.
              Note: guest checkout is COD-only, so turning this off prevents guest orders (signed-in customers can still pay online).
            </span>
          </span>
        </label>
      </section>

      {/* Store base location */}
      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-section-heading">
          <div>
            <h3>Default Store Location <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>· global fallback</span></h3>
            <span className="admin-section-subtitle">Base / origin address used as the invoice ship-from when a branch has no address of its own. Per-branch addresses are set below.</span>
          </div>
        </div>
        <div className="admin-form-grid admin-form-grid-2">
          {STORE_TEXT_FIELDS.map(([key, label, placeholder]) => (
            <div className="admin-field" key={key}>
              <label className="admin-label">{label}</label>
              <input className="admin-input" value={storeLocation?.[key] || ''} placeholder={placeholder} onChange={(e) => setStoreField(key, e.target.value)} />
            </div>
          ))}
          <div className="admin-field">
            <label className="admin-label">Latitude (optional)</label>
            <input className="admin-input" type="number" step="any" value={storeLocation?.lat ?? ''} placeholder="31.6340" onChange={(e) => setStoreField('lat', e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Longitude (optional)</label>
            <input className="admin-input" type="number" step="any" value={storeLocation?.lng ?? ''} placeholder="74.8723" onChange={(e) => setStoreField('lng', e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button className="admin-btn admin-btn-primary" onClick={saveStore} disabled={savingStore}>
            {savingStore ? 'Saving…' : 'Save Store Location'}
          </button>
        </div>
      </section>

      {/* Per-branch / per-location settings — driven by the top-right picker. */}
      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-section-heading">
          <div>
            <h3>Branch Settings{selectedBranch ? ` · ${selectedBranch.name}` : ''}</h3>
            <span className="admin-section-subtitle">Per-location overrides for the branch chosen in the top-right picker. Blank fields fall back to the global settings above. Company legal identity &amp; GSTIN stay global.</span>
          </div>
        </div>

        {branches.length === 0 ? (
          <div className="admin-hint">No branches yet. Click <strong>+ Add Branch</strong> (top right) to create your first store location, then assign delivery zones to it under Delivery → Zones.</div>
        ) : !selectedBranchId ? (
          <div className="admin-hint">Select a branch in the top-right picker to edit its location settings.</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>
                Zones: {branchZones.length ? branchZones.map((z) => z.city).join(', ') : <span style={{ color: 'var(--admin-text-muted)' }}>none assigned yet — assign under Delivery → Zones</span>}
              </div>
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openBranchModal('edit', selectedBranch)}>Edit name / code</button>
            </div>

            <div className="admin-section-heading" style={{ marginTop: '1rem' }}>
              <h3 style={{ fontSize: '1rem' }}>Ship-from Address</h3>
            </div>
            <span className="admin-hint">Printed as the seller address on invoices for orders delivered to this branch&apos;s zones.</span>
            <div className="admin-form-grid admin-form-grid-2" style={{ marginTop: '0.75rem' }}>
              {ORIGIN_TEXT_FIELDS.map(([key, label, placeholder]) => (
                <div className="admin-field" key={key}>
                  <label className="admin-label">{label}</label>
                  <input className="admin-input" value={branchForm.origin[key] || ''} placeholder={placeholder} onChange={(e) => setBranchOriginField(key, e.target.value)} />
                </div>
              ))}
              <div className="admin-field">
                <label className="admin-label">Latitude (optional)</label>
                <input className="admin-input" type="number" step="any" value={branchForm.origin.lat ?? ''} placeholder="31.6340" onChange={(e) => setBranchOriginField('lat', e.target.value)} />
              </div>
              <div className="admin-field">
                <label className="admin-label">Longitude (optional)</label>
                <input className="admin-input" type="number" step="any" value={branchForm.origin.lng ?? ''} placeholder="74.8723" onChange={(e) => setBranchOriginField('lng', e.target.value)} />
              </div>
              <div className="admin-field">
                <label className="admin-label">Invoice Prefix (optional)</label>
                <input className="admin-input" value={branchForm.invoicePrefix} placeholder="INV-ASR" onChange={(e) => setBranchForm((p) => ({ ...p, invoicePrefix: e.target.value }))} />
                <span className="admin-hint">Overrides the global prefix for invoices from this branch.</span>
              </div>
            </div>

            <div className="admin-field" style={{ marginTop: '0.5rem' }}>
              <label className="admin-label">Daily report recipients (this branch)</label>
              <input className="admin-input" value={branchForm.reportRecipients} placeholder="manager.asr@email.com, owner@email.com" onChange={(e) => setBranchForm((p) => ({ ...p, reportRecipients: e.target.value }))} />
              <span className="admin-hint">Comma-separated. They receive a daily digest of only this branch&apos;s sales &amp; profit (all its zones).</span>
            </div>

            <label className={`admin-toggle${branchForm.reportEnabled ? ' admin-toggle-on' : ''}`} style={{ marginTop: '0.75rem' }}>
              <input type="checkbox" checked={branchForm.reportEnabled} onChange={(e) => setBranchForm((p) => ({ ...p, reportEnabled: e.target.checked }))} />
              <span className="admin-switch" aria-hidden="true" />
              <span className="admin-toggle-text">
                <span className="admin-toggle-label">Send this branch&apos;s daily report</span>
                <span className="admin-toggle-desc">Independent of the global Daily Email Report below. Off = recipients above get nothing.</span>
              </span>
            </label>

            <label className={`admin-toggle${branchForm.codEnabled ? ' admin-toggle-on' : ''}`} style={{ marginTop: '0.75rem' }}>
              <input type="checkbox" checked={branchForm.codEnabled} onChange={(e) => setBranchForm((p) => ({ ...p, codEnabled: e.target.checked }))} />
              <span className="admin-switch" aria-hidden="true" />
              <span className="admin-toggle-text">
                <span className="admin-toggle-label">Cash on Delivery at this branch</span>
                <span className="admin-toggle-desc">Applies to all of this branch&apos;s zones on save. Effective COD = global switch AND zone. Fine-grained per-zone override stays under Delivery → Zones.</span>
              </span>
            </label>

            <div style={{ marginTop: '1rem' }}>
              <button className="admin-btn admin-btn-primary" onClick={saveBranchSettings} disabled={savingBranch}>
                {savingBranch ? 'Saving…' : 'Save Branch Settings'}
              </button>
            </div>
          </>
        )}
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
        <label className={`admin-toggle${reports.dailyEnabled ? ' admin-toggle-on' : ''}`} style={{ marginBottom: '1rem' }}>
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

        {!isSuperAdmin && (
          <div className="admin-hint" style={{ marginBottom: '1rem' }}>
            Only a Super Admin can add users or change roles. You can view the list below.
          </div>
        )}

        {/* One-time temporary password reveal */}
        {tempPasswordInfo && (
          <div className="admin-card" style={{ marginBottom: '1rem', borderColor: 'var(--admin-warning, #b8860b)', background: 'rgba(184,134,11,0.06)' }}>
            <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Temporary password for {tempPasswordInfo.email}</p>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>
              Share this securely. It is shown only once and the user should change it after signing in.
            </p>
            <code style={{ display: 'inline-block', padding: '0.5rem 0.75rem', background: 'var(--admin-surface, #fff)', border: '1px solid var(--admin-border, #ddd)', borderRadius: 6, fontSize: '1rem', userSelect: 'all' }}>
              {tempPasswordInfo.tempPassword}
            </code>
            <div style={{ marginTop: '0.75rem' }}>
              <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setTempPasswordInfo(null)}>Done</button>
            </div>
          </div>
        )}

        {/* Add user form (super admin only) */}
        {isSuperAdmin && (
          <div className="admin-card" style={{ marginBottom: '1rem' }}>
            <div className="admin-section-heading"><h3 style={{ fontSize: '1rem' }}>Add User</h3></div>
            <div className="admin-form-grid admin-form-grid-2">
              <div className="admin-field">
                <label className="admin-label">Name *</label>
                <input className="admin-input" value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} placeholder="Jane Baker" />
              </div>
              <div className="admin-field">
                <label className="admin-label">Email *</label>
                <input className="admin-input" type="email" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} placeholder="jane@thecakebake.in" />
              </div>
              <div className="admin-field">
                <label className="admin-label">Phone (optional)</label>
                <input className="admin-input" value={newUser.phone} onChange={(e) => setNewUser((u) => ({ ...u, phone: e.target.value }))} placeholder="+91 99999 99999" />
              </div>
              <div className="admin-field">
                <label className="admin-label">Role</label>
                <select className="admin-input admin-select" value={newUser.role} onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}>
                  {CREATABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
                </select>
              </div>
              <div className="admin-field" style={{ gridColumn: '1 / -1' }}>
                <label className="admin-label">
                  Branch access {newUser.role === 'branchadmin' ? '*' : <span style={{ fontWeight: 400, color: 'var(--admin-text-muted)' }}>(optional — leave empty for all branches)</span>}
                </label>
                {branches.length === 0 ? (
                  <span className="admin-hint">No branches yet. Add a branch below before scoping a branch admin.</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {branches.map((b) => {
                      const checked = newUser.branchIds.includes(b._id);
                      return (
                        <label key={b._id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.6rem', border: '1px solid var(--admin-border-subtle)', borderRadius: 6, cursor: 'pointer', background: checked ? 'rgba(216,27,96,0.12)' : 'transparent' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setNewUser((u) => ({
                              ...u,
                              branchIds: u.branchIds.includes(b._id) ? u.branchIds.filter((x) => x !== b._id) : [...u.branchIds, b._id],
                            }))}
                          />
                          {b.name}
                        </label>
                      );
                    })}
                  </div>
                )}
                <span className="admin-hint">A branch admin sees only their branches&apos; orders, sales, profit &amp; refunds. Leave empty to make an owner/HQ account that sees all branches.</span>
              </div>
            </div>
            <span className="admin-hint">A one-time temporary password is generated and shown once after creation. The user should change it after first sign-in.</span>
            <div style={{ marginTop: '1rem' }}>
              <button className="admin-btn admin-btn-primary" onClick={createUser} disabled={creatingUser}>
                {creatingUser ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        )}

        {admins.length === 0 ? (
          <div className="admin-empty-compact">No admin users</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Branches</th><th>Status</th>{isSuperAdmin && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isSelf = admin._id === meId;
                  const isLegacyAdmin = admin.role === 'admin';
                  const isInactive = admin.isActive === false;
                  return (
                    <tr key={admin._id}>
                      <td className="admin-row-title">
                        {admin.name}
                        {isSelf && <span className="admin-pill admin-pill-success" style={{ marginLeft: 6 }}>you</span>}
                        {admin.mustChangePassword && <span className="admin-pill" style={{ marginLeft: 6 }}>temp pw</span>}
                      </td>
                      <td className="admin-row-meta">{admin.email}</td>
                      <td>
                        {isSuperAdmin ? (
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
                        ) : (
                          <span>{ROLE_LABELS[admin.role] || admin.role}</span>
                        )}
                      </td>
                      <td className="admin-row-meta">
                        {adminBranchNames(admin).length
                          ? adminBranchNames(admin).join(', ')
                          : <span className="admin-pill">All branches</span>}
                      </td>
                      <td>
                        <span className={`admin-badge ${isInactive ? 'badge-inactive' : 'badge-active'}`}>
                          {isInactive ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              disabled={userActionId === admin._id}
                              onClick={() => openBranchAssign(admin)}
                            >
                              Branches
                            </button>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              disabled={isSelf || userActionId === admin._id}
                              onClick={() => toggleActive(admin)}
                              title={isSelf ? 'You cannot change your own status' : ''}
                            >
                              {isInactive ? 'Activate' : 'Deactivate'}
                            </button>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              disabled={userActionId === admin._id}
                              onClick={() => resetPassword(admin)}
                            >
                              Reset password
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Branch identity modal (create / edit name + code + active) */}
      <AdminModal
        open={branchModal.open}
        title={branchModal.mode === 'create' ? 'Add Branch' : 'Edit Branch'}
        onClose={() => setBranchModal(emptyBranchModal)}
      >
        <div className="admin-field">
          <label className="admin-label">Branch Name *</label>
          <input className="admin-input" value={branchModal.name} placeholder="Amritsar Main" onChange={(e) => setBranchModal((m) => ({ ...m, name: e.target.value }))} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Code (optional)</label>
          <input className="admin-input" value={branchModal.code} placeholder="ASR" onChange={(e) => setBranchModal((m) => ({ ...m, code: e.target.value }))} />
          <span className="admin-hint">Short label for this branch (e.g. on invoice prefixes).</span>
        </div>
        <label className={`admin-toggle${branchModal.isActive ? ' admin-toggle-on' : ''}`} style={{ marginTop: '0.5rem' }}>
          <input type="checkbox" checked={branchModal.isActive} onChange={(e) => setBranchModal((m) => ({ ...m, isActive: e.target.checked }))} />
          <span className="admin-switch" aria-hidden="true" />
          <span className="admin-toggle-text">
            <span className="admin-toggle-label">Active</span>
            <span className="admin-toggle-desc">Inactive branches are skipped by per-branch reports and hidden as a default.</span>
          </span>
        </label>
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => setBranchModal(emptyBranchModal)}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={saveBranchIdentity} disabled={savingBranchIdentity}>
            {savingBranchIdentity ? 'Saving…' : 'Save'}
          </button>
        </div>
      </AdminModal>

      {/* Branch access modal — wall an admin to specific branches (empty = all) */}
      <AdminModal
        open={branchAssign.open}
        title={branchAssign.admin ? `Branch access · ${branchAssign.admin.name}` : 'Branch access'}
        onClose={() => setBranchAssign({ open: false, admin: null, branchIds: [], saving: false })}
      >
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>
          Selected branches wall this admin to only those branches&apos; data. Leave all unchecked for an
          owner/HQ account that sees every branch.
        </p>
        {branches.length === 0 ? (
          <span className="admin-hint">No branches exist yet.</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 280, overflowY: 'auto' }}>
            {branches.map((b) => {
              const checked = branchAssign.branchIds.includes(b._id);
              return (
                <label key={b._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.6rem', border: '1px solid var(--admin-border-subtle)', borderRadius: 6, cursor: 'pointer', background: checked ? 'rgba(216,27,96,0.12)' : 'transparent' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleAssignBranch(b._id)} />
                  <span>{b.name}{b.code ? <span className="admin-row-meta"> · {b.code}</span> : null}</span>
                </label>
              );
            })}
          </div>
        )}
        {branchAssign.admin?.role === 'branchadmin' && branchAssign.branchIds.length === 0 && (
          <span className="admin-hint" style={{ color: 'var(--admin-danger)' }}>
            A branch admin must keep at least one branch.
          </span>
        )}
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => setBranchAssign({ open: false, admin: null, branchIds: [], saving: false })}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={saveBranchAssign} disabled={branchAssign.saving}>
            {branchAssign.saving ? 'Saving…' : 'Save branch access'}
          </button>
        </div>
      </AdminModal>
    </div>
  );
}
