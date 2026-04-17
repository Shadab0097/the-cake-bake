'use client';

import { useState } from 'react';
import { FiMail, FiPhone, FiMapPin, FiSend } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import { addToast } from '@/store/slices/toastSlice';
import { useDispatch } from 'react-redux';

export default function ContactPage() {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(addToast({ message: 'Message sent! We\'ll get back to you soon 💌', type: 'success' }));
    setForm({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-dark mb-2">Contact Us</h1>
          <p className="text-sm text-outline">We&apos;d love to hear from you! Reach out with any questions.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact Info */}
          <div className="space-y-6">
            {[
              { icon: FiMail, title: 'Email', info: 'hello@cakebake.in', href: 'mailto:hello@cakebake.in' },
              { icon: FiPhone, title: 'Phone', info: '+91 98765 43210', href: 'tel:+919876543210' },
              { icon: FiMapPin, title: 'Address', info: 'Amritsar, Punjab, India' },
            ].map(({ icon: Icon, title, info, href }) => (
              <div key={title} className="flex items-start gap-4 p-5 bg-surface-container-lowest rounded-2xl shadow-card">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-dark">{title}</h3>
                  {href ? (
                    <a href={href} className="text-sm text-pink-deep hover:underline">{info}</a>
                  ) : (
                    <p className="text-sm text-outline">{info}</p>
                  )}
                </div>
              </div>
            ))}

            <div className="p-5 bg-pink-light/20 rounded-2xl">
              <p className="text-sm font-semibold text-dark mb-1">🕐 Working Hours</p>
              <p className="text-sm text-outline">Monday - Sunday: 8:00 AM - 10:00 PM</p>
            </div>
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-2xl p-6 shadow-card space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input name="name" placeholder="Your Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
              <input name="email" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
            </div>
            <input name="phone" type="tel" placeholder="Phone (Optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
            <input name="subject" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline" />
            <textarea name="message" placeholder="Your message..." rows="5" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline resize-none" />
            <button type="submit" className="w-full py-3 rounded-xl gradient-primary text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
              <FiSend className="w-4 h-4" />
              Send Message
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
