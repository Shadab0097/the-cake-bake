'use client';

import { useState } from 'react';
import { useDispatch } from 'react-redux';
import AppShell from '@/components/layout/AppShell';
import { addToast } from '@/store/slices/toastSlice';
import api from '@/lib/api';

export default function CorporatePage() {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    companyName: '', contactName: '', email: '', phone: '',
    eventType: '', quantity: '', deliveryDate: '', requirements: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        companyName: form.companyName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        eventType: form.eventType,
        quantity: form.quantity ? Number(form.quantity) : 1,
        deliveryDate: form.deliveryDate || undefined,
        requirements: form.requirements,
      };
      await api.post('/inquiries/corporate', payload);
      dispatch(addToast({ message: 'Corporate inquiry submitted! We\'ll get back to you within 24 hours. 🏢', type: 'success' }));
      setForm({ companyName: '', contactName: '', email: '', phone: '', eventType: '', quantity: '', deliveryDate: '', requirements: '' });
    } catch (err) {
      dispatch(addToast({ message: err?.response?.data?.message || 'Failed to submit. Please try again.', type: 'error' }));
    }
    setSubmitting(false);
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <span className="text-5xl block mb-3">🏢</span>
          <h1 className="text-3xl font-bold text-dark mb-2">Corporate Orders</h1>
          <p className="text-sm text-outline max-w-lg mx-auto">
            Impress your team and clients with premium cakes. We handle events of any scale with customized solutions.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: '📦', text: 'Bulk Pricing' },
            { icon: '🎨', text: 'Custom Branding' },
            { icon: '🚛', text: 'Scheduled Delivery' },
            { icon: '🧾', text: 'GST Invoice' },
          ].map((b) => (
            <div key={b.text} className="text-center p-4 bg-surface-container-lowest rounded-xl shadow-card">
              <span className="text-2xl block mb-1">{b.icon}</span>
              <span className="text-xs font-medium text-dark">{b.text}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl p-6 lg:p-8 shadow-card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Company Name *" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
            <input placeholder="Contact Person *" required value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="email" placeholder="Email *" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
            <input type="tel" placeholder="Phone *" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep">
              <option value="">Event Type</option>
              <option>Office Party</option>
              <option>Corporate Event</option>
              <option>Client Gift</option>
              <option>Employee Birthday</option>
              <option>Festive Celebration</option>
            </select>
            <input type="number" placeholder="Est. Quantity" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
            <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep" />
          </div>
          <textarea placeholder="Describe your requirements... *" rows={4} required value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline resize-none" />
          <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Submit Inquiry 🏢</>}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
