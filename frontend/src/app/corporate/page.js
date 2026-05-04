'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import AppShell from '@/components/layout/AppShell';
import { addToast } from '@/store/slices/toastSlice';
import { FiUpload, FiX } from 'react-icons/fi';
import api from '@/lib/api';
import { IMAGE_UPLOAD, validateImageFiles } from '@/lib/uploadApi';

export default function CorporatePage() {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    companyName: '', contactName: '', email: '', phone: '',
    eventType: '', quantity: '', deliveryDate: '', requirements: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [referencePreviews, setReferencePreviews] = useState([]);
  const referencePreviewsRef = useRef([]);

  useEffect(() => {
    referencePreviewsRef.current = referencePreviews;
  }, [referencePreviews]);

  useEffect(() => {
    return () => {
      referencePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, []);

  const clearReferenceFiles = () => {
    referencePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setReferenceFiles([]);
    setReferencePreviews([]);
  };

  const handleReferenceFiles = (files) => {
    const selected = Array.from(files || []);
    if (selected.length === 0) return;
    try {
      const nextFiles = [...referenceFiles, ...selected];
      validateImageFiles(nextFiles, { maxFiles: IMAGE_UPLOAD.maxInquiryFiles });
      setReferenceFiles(nextFiles);
      setReferencePreviews(prev => [...prev, ...selected.map((file) => URL.createObjectURL(file))]);
    } catch (err) {
      dispatch(addToast({ message: err.message || 'Invalid image file', type: 'error' }));
    }
  };

  const removeReferenceFile = (index) => {
    URL.revokeObjectURL(referencePreviews[index]);
    setReferenceFiles(prev => prev.filter((_, i) => i !== index));
    setReferencePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('companyName', form.companyName);
      payload.append('contactName', form.contactName);
      payload.append('email', form.email);
      payload.append('phone', form.phone);
      payload.append('eventType', form.eventType);
      payload.append('quantity', form.quantity ? Number(form.quantity) : 1);
      payload.append('deliveryDate', form.deliveryDate || '');
      payload.append('requirements', form.requirements);
      referenceFiles.forEach((file) => {
        payload.append('referenceImages', file);
      });
      await api.post('/inquiries/corporate', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      dispatch(addToast({ message: 'Corporate inquiry submitted! We\'ll get back to you within 24 hours. 🏢', type: 'success' }));
      setForm({ companyName: '', contactName: '', email: '', phone: '', eventType: '', quantity: '', deliveryDate: '', requirements: '' });
      clearReferenceFiles();
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
          <div className="space-y-3">
            <label className="flex items-center justify-center gap-2 w-full px-4 py-4 text-sm font-medium border border-dashed border-outline-variant/50 rounded-xl cursor-pointer hover:border-pink-deep transition-colors">
              <FiUpload className="w-4 h-4" />
              Add Reference Images
              <input
                type="file"
                multiple
                accept={IMAGE_UPLOAD.accept}
                onChange={(e) => {
                  handleReferenceFiles(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
              />
            </label>
            {referencePreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {referencePreviews.map((preview, index) => (
                  <div key={preview} className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt={`Reference ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeReferenceFile(index)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Submit Inquiry 🏢</>}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
