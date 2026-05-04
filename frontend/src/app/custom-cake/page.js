'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import AppShell from '@/components/layout/AppShell';
import { addToast } from '@/store/slices/toastSlice';
import { FiUpload, FiX } from 'react-icons/fi';
import api from '@/lib/api';
import { IMAGE_UPLOAD, validateImageFiles } from '@/lib/uploadApi';

export default function CustomCakePage() {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', occasion: '', flavor: '', weight: '1 kg',
    message: '', designDescription: '', deliveryDate: '',
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
      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, value ?? '');
      });
      referenceFiles.forEach((file) => {
        payload.append('referenceImages', file);
      });
      await api.post('/inquiries/custom-cake', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      dispatch(addToast({ message: 'Custom cake request submitted! We\'ll contact you soon 🎨', type: 'success' }));
      setForm({ name: '', phone: '', email: '', occasion: '', flavor: '', weight: '1 kg', message: '', designDescription: '', deliveryDate: '' });
      clearReferenceFiles();
    } catch (err) {
      dispatch(addToast({ message: err?.response?.data?.message || 'Failed to submit. Please try again.', type: 'error' }));
    }
    setSubmitting(false);
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <span className="text-5xl block mb-3">🎨</span>
          <h1 className="text-3xl font-bold text-dark mb-2">Custom Cake Design</h1>
          <p className="text-sm text-outline max-w-lg mx-auto">
            Dream it, and we&apos;ll bake it! Describe your perfect cake and our expert bakers will bring it to life.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: '🎂', text: 'Any Design' },
            { icon: '📸', text: 'Photo Cakes' },
            { icon: '🏗️', text: 'Multi-Tier' },
            { icon: '🌱', text: 'Eggless Options' },
          ].map((f) => (
            <div key={f.text} className="text-center p-4 bg-surface-container-lowest rounded-xl shadow-card">
              <span className="text-2xl block mb-1">{f.icon}</span>
              <span className="text-xs font-medium text-dark">{f.text}</span>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl p-6 lg:p-8 shadow-card space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Your Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
            <input type="tel" placeholder="Phone *" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
          </div>
          <input type="email" placeholder="Email *" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep">
              <option value="">Occasion</option>
              <option>Birthday</option>
              <option>Wedding</option>
              <option>Anniversary</option>
              <option>Corporate</option>
              <option>Other</option>
            </select>
            <input placeholder="Preferred Flavor" value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
            <select value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep">
              {['0.5 kg', '1 kg', '1.5 kg', '2 kg', '3 kg', '5 kg', 'Custom'].map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </div>

          <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep" />
          <input placeholder="Message on Cake" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
          <textarea placeholder="Describe your dream cake in detail... *" rows={4} required value={form.designDescription} onChange={(e) => setForm({ ...form, designDescription: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline resize-none" />

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
            {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Submit Request 🎨</>}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
