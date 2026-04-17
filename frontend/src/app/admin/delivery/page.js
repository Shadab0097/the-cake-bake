'use client';

import { useEffect, useState, useCallback } from 'react';
import adminApi, { formatPrice } from '@/lib/adminApi';
import { AdminModal, AdminToast, useAdminToast, EmptyState, LoadingSkeleton, RefreshButton } from '@/components/admin/AdminUI';

const emptySlot = { label: '', startTime: '', endTime: '', maxOrders: 50, extraCharge: 0, isActive: true, cities: '', sortOrder: 0 };
const emptyZone = { city: '', pincodes: '', deliveryCharge: '', freeDeliveryAbove: '', sameDayAvailable: false, sameDayCutoffTime: '14:00', isActive: true };

export default function AdminDeliveryPage() {
  const [tab, setTab] = useState('slots');
  const [slots, setSlots] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ open: false, type: '', mode: 'create', data: null });
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast, showToast, hideToast } = useAdminToast();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsRes, zonesRes] = await Promise.all([adminApi.delivery.getSlots(), adminApi.delivery.getZones()]);
      setSlots(slotsRes.data.data || []);
      setZones(zonesRes.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openModal = (type, mode, data = null) => {
    if (type === 'slot') {
      setForm(data ? {
        ...data, cities: Array.isArray(data.cities) ? data.cities.join(', ') : (data.cities || ''),
      } : { ...emptySlot });
    } else {
      setForm(data ? {
        ...data, pincodes: Array.isArray(data.pincodes) ? data.pincodes.join(', ') : (data.pincodes || ''),
      } : { ...emptyZone });
    }
    setModal({ open: true, type, mode, data });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.type === 'slot') {
        const data = { ...form, maxOrders: Number(form.maxOrders), extraCharge: Number(form.extraCharge) || 0, sortOrder: Number(form.sortOrder) || 0, cities: form.cities ? form.cities.split(',').map(c => c.trim()).filter(Boolean) : [] };
        if (modal.mode === 'create') await adminApi.delivery.createSlot(data);
        else await adminApi.delivery.updateSlot(modal.data._id, data);
      } else {
        const data = { ...form, deliveryCharge: Number(form.deliveryCharge), freeDeliveryAbove: Number(form.freeDeliveryAbove) || 0, pincodes: form.pincodes ? form.pincodes.split(',').map(p => p.trim()).filter(Boolean) : [] };
        if (modal.mode === 'create') await adminApi.delivery.createZone(data);
        else await adminApi.delivery.updateZone(modal.data._id, data);
      }
      showToast(modal.mode === 'create' ? 'Created successfully' : 'Updated successfully');
      setModal({ open: false, type: '', mode: 'create', data: null });
      fetch();
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <AdminToast {...toast} onClose={hideToast} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Delivery Settings</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <RefreshButton onRefresh={fetch} />
          <button className="admin-btn admin-btn-primary" onClick={() => openModal(tab === 'slots' ? 'slot' : 'zone', 'create')}>
            + Add {tab === 'slots' ? 'Slot' : 'Zone'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem' }}>
        {['slots', 'zones'].map(t => (
          <button key={t} className={`admin-btn ${tab === t ? 'admin-btn-primary' : 'admin-btn-secondary'}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <LoadingSkeleton rows={6} cols={5} /> : tab === 'slots' ? (
        /* Slots Table */
        <div className="admin-card" style={{ padding: 0 }}>
          {slots.length === 0 ? <EmptyState message="No delivery slots" icon="🕐" /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Label</th><th>Time</th><th>Max Orders</th><th>Extra Charge</th><th>Active</th><th>Actions</th></tr></thead>
                <tbody>
                  {slots.map(s => (
                    <tr key={s._id}>
                      <td style={{ fontWeight: 500 }}>{s.label}</td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{s.startTime} – {s.endTime}</td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{s.maxOrders}</td>
                      <td>{s.extraCharge > 0 ? formatPrice(s.extraCharge) : 'Free'}</td>
                      <td><span className={`admin-badge ${s.isActive ? 'badge-active' : 'badge-inactive'}`}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openModal('slot', 'edit', s)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Zones Table */
        <div className="admin-card" style={{ padding: 0 }}>
          {zones.length === 0 ? <EmptyState message="No delivery zones" icon="🗺️" /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>City</th><th>Delivery Charge</th><th>Free Above</th><th>Same Day</th><th>Cutoff</th><th>Active</th><th>Actions</th></tr></thead>
                <tbody>
                  {zones.map(z => (
                    <tr key={z._id}>
                      <td style={{ fontWeight: 500 }}>{z.city}</td>
                      <td>{formatPrice(z.deliveryCharge)}</td>
                      <td>{z.freeDeliveryAbove ? formatPrice(z.freeDeliveryAbove) : '—'}</td>
                      <td>{z.sameDayAvailable ? <span style={{ color: 'var(--admin-success)' }}>✓</span> : '—'}</td>
                      <td style={{ color: 'var(--admin-text-secondary)' }}>{z.sameDayCutoffTime || '—'}</td>
                      <td><span className={`admin-badge ${z.isActive !== false ? 'badge-active' : 'badge-inactive'}`}>{z.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                      <td><button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openModal('zone', 'edit', z)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AdminModal open={modal.open} title={`${modal.mode === 'create' ? 'Add' : 'Edit'} ${modal.type === 'slot' ? 'Delivery Slot' : 'Delivery Zone'}`} onClose={() => setModal({ open: false, type: '', mode: 'create', data: null })}>
        {modal.type === 'slot' ? (
          <>
            <div className="admin-field"><label className="admin-label">Label *</label><input className="admin-input" value={form.label || ''} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Morning (9 AM - 12 PM)" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="admin-field"><label className="admin-label">Start Time</label><input className="admin-input" value={form.startTime || ''} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} placeholder="09:00" /></div>
              <div className="admin-field"><label className="admin-label">End Time</label><input className="admin-input" value={form.endTime || ''} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} placeholder="12:00" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="admin-field"><label className="admin-label">Max Orders</label><input className="admin-input" type="number" value={form.maxOrders || ''} onChange={e => setForm(f => ({ ...f, maxOrders: e.target.value }))} /></div>
              <div className="admin-field"><label className="admin-label">Extra Charge (paise)</label><input className="admin-input" type="number" value={form.extraCharge || ''} onChange={e => setForm(f => ({ ...f, extraCharge: e.target.value }))} /></div>
            </div>
            <div className="admin-field"><label className="admin-label">Cities (comma-separated, leave empty for all)</label><input className="admin-input" value={form.cities || ''} onChange={e => setForm(f => ({ ...f, cities: e.target.value }))} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} /> Active
            </label>
          </>
        ) : (
          <>
            <div className="admin-field"><label className="admin-label">City *</label><input className="admin-input" value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Mumbai" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="admin-field"><label className="admin-label">Delivery Charge (paise)</label><input className="admin-input" type="number" value={form.deliveryCharge || ''} onChange={e => setForm(f => ({ ...f, deliveryCharge: e.target.value }))} /></div>
              <div className="admin-field"><label className="admin-label">Free Above (paise)</label><input className="admin-input" type="number" value={form.freeDeliveryAbove || ''} onChange={e => setForm(f => ({ ...f, freeDeliveryAbove: e.target.value }))} /></div>
            </div>
            <div className="admin-field"><label className="admin-label">Pincodes (comma-separated)</label><input className="admin-input" value={form.pincodes || ''} onChange={e => setForm(f => ({ ...f, pincodes: e.target.value }))} placeholder="400001, 400002" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.sameDayAvailable} onChange={e => setForm(f => ({ ...f, sameDayAvailable: e.target.checked }))} /> Same Day Available
              </label>
              <div className="admin-field"><label className="admin-label">Cutoff Time</label><input className="admin-input" value={form.sameDayCutoffTime || ''} onChange={e => setForm(f => ({ ...f, sameDayCutoffTime: e.target.value }))} placeholder="14:00" /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isActive !== false} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} /> Active
            </label>
          </>
        )}
        <div className="admin-modal-footer" style={{ padding: '1rem 0 0', borderTop: 'none' }}>
          <button className="admin-btn admin-btn-secondary" onClick={() => setModal({ open: false, type: '', mode: 'create', data: null })}>Cancel</button>
          <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </AdminModal>
    </div>
  );
}
