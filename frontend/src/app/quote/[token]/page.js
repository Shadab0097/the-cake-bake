'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiCheckCircle, FiClock, FiCreditCard, FiMapPin } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError.mjs';
import { resolveImageUrl } from '@/lib/uploadApi';

const RAZORPAY_SCRIPT_ID = 'razorpay-checkout-script';
const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let razorpayScriptPromise = null;

function formatPrice(paise = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(paise || 0) / 100);
}

function loadRazorpayCheckoutScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Payment is unavailable'));
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(RAZORPAY_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load payment gateway')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      razorpayScriptPromise = null;
      reject(new Error('Failed to load payment gateway'));
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

export default function QuoteApprovalPage({ params }) {
  const { token } = use(params);
  const router = useRouter();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    deliveryDate: '',
    deliverySlot: '',
  });

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/inquiries/quotes/${token}`);
      const data = res.data.data;
      setQuote(data);
      const inquiry = data.inquiry || {};
      setForm(prev => ({
        ...prev,
        fullName: inquiry.name || inquiry.contactName || prev.fullName,
        phone: inquiry.phone || prev.phone,
        deliveryDate: inquiry.deliveryDate ? new Date(inquiry.deliveryDate).toISOString().slice(0, 10) : prev.deliveryDate,
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Quote link is invalid or expired'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAccept = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await loadRazorpayCheckoutScript();
      const payload = {
        shippingAddress: {
          fullName: form.fullName,
          phone: form.phone,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          landmark: form.landmark,
        },
        deliveryDate: form.deliveryDate,
        deliverySlot: form.deliverySlot,
      };

      const res = await api.post(`/inquiries/quotes/${token}/accept`, payload);
      const data = res.data.data;
      if (data.paid && data.orderNumber) {
        router.push(`/order-confirmation?orderNumber=${data.orderNumber}${data.trackingToken ? `&trackingToken=${encodeURIComponent(data.trackingToken)}` : ''}`);
        return;
      }

      const paymentParams = data.paymentParams || {};
      if (!paymentParams.key_id || !paymentParams.amount || !paymentParams.order_id) {
        throw new Error('Payment could not be initialized. Please contact support.');
      }

      const trackingToken = data.trackingToken || '';
      const options = {
        key: paymentParams.key_id,
        amount: paymentParams.amount,
        currency: paymentParams.currency || 'INR',
        name: paymentParams.name || 'The Cake Bake',
        description: paymentParams.description || 'Inquiry quote payment',
        order_id: paymentParams.order_id,
        prefill: paymentParams.prefill || {
          name: form.fullName,
          contact: form.phone,
        },
        handler: async (response) => {
          const verifyRes = await api.post(`/inquiries/quotes/${token}/payment/verify`, {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          const verified = verifyRes.data.data;
          const finalTrackingToken = verified.trackingToken || trackingToken;
          router.push(`/order-confirmation?orderNumber=${verified.orderNumber}${finalTrackingToken ? `&trackingToken=${encodeURIComponent(finalTrackingToken)}` : ''}`);
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setError('Payment was cancelled. You can reopen this quote link to try again.');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setSubmitting(false);
      setError(getApiErrorMessage(err, 'Failed to start payment'));
    }
  };

  const inquiry = quote?.inquiry || {};
  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-deep border-t-transparent" />
          </div>
        ) : error && !quote ? (
          <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h1 className="text-xl font-bold text-dark">Quote unavailable</h1>
            <p className="mt-2 text-sm text-outline">{error}</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <section className="rounded-2xl bg-surface-container-lowest p-5 shadow-card sm:p-6">
              <div className="mb-6">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-pink-light/20 px-3 py-1 text-xs font-semibold text-pink-deep">
                  <FiCheckCircle className="h-4 w-4" />
                  Quote ready for approval
                </div>
                <h1 className="text-2xl font-bold text-dark">Review your cake quote</h1>
                <p className="mt-2 text-sm leading-6 text-outline">
                  Confirm the delivery details below and complete payment to convert this inquiry into a confirmed order.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleAccept} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input required value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                  <input required type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Phone" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                </div>
                <input required value={form.addressLine1} onChange={(e) => updateField('addressLine1', e.target.value)} placeholder="Address line 1" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                <input value={form.addressLine2} onChange={(e) => updateField('addressLine2', e.target.value)} placeholder="Address line 2" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                <div className="grid gap-4 sm:grid-cols-3">
                  <input required value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="City" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                  <input required value={form.state} onChange={(e) => updateField('state', e.target.value)} placeholder="State" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                  <input required value={form.pincode} onChange={(e) => updateField('pincode', e.target.value)} placeholder="Pincode" inputMode="numeric" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                </div>
                <input value={form.landmark} onChange={(e) => updateField('landmark', e.target.value)} placeholder="Landmark" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <input required type="date" min={minDate} value={form.deliveryDate} onChange={(e) => updateField('deliveryDate', e.target.value)} className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                  <input value={form.deliverySlot} onChange={(e) => updateField('deliverySlot', e.target.value)} placeholder="Preferred time slot" className="w-full rounded-xl border border-outline-variant/30 px-4 py-3 text-sm focus:border-pink-deep focus:outline-none" />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !quote?.canAccept}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl gradient-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  <FiCreditCard className="h-4 w-4" />
                  {submitting ? 'Opening payment...' : `Approve & Pay ${formatPrice(quote?.amount)}`}
                </button>
              </form>
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-card">
                <div className="text-sm font-semibold text-dark">{inquiry.label || 'Inquiry Quote'}</div>
                <div className="mt-3 text-3xl font-bold text-dark">{formatPrice(quote?.amount)}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-outline">
                  <FiClock className="h-4 w-4" />
                  Valid until {quote?.expiresAt ? new Date(quote.expiresAt).toLocaleDateString('en-IN') : '-'}
                </div>
                {quote?.notes && (
                  <p className="mt-4 rounded-lg bg-surface-container-low px-3 py-2 text-sm leading-6 text-outline">
                    {quote.notes}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-surface-container-lowest p-5 shadow-card">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-dark">
                  <FiMapPin className="h-4 w-4 text-pink-deep" />
                  Request details
                </div>
                <div className="space-y-2 text-sm text-outline">
                  {inquiry.companyName && <p><strong className="text-dark">Company:</strong> {inquiry.companyName}</p>}
                  {inquiry.occasion && <p><strong className="text-dark">Occasion:</strong> {inquiry.occasion}</p>}
                  {inquiry.eventType && <p><strong className="text-dark">Event:</strong> {inquiry.eventType}</p>}
                  {inquiry.weight && <p><strong className="text-dark">Weight:</strong> {inquiry.weight}</p>}
                  {inquiry.flavor && <p><strong className="text-dark">Flavor:</strong> {inquiry.flavor}</p>}
                  {inquiry.quantity && <p><strong className="text-dark">Quantity:</strong> {inquiry.quantity}</p>}
                  {(inquiry.designDescription || inquiry.requirements) && (
                    <p className="leading-6">{inquiry.designDescription || inquiry.requirements}</p>
                  )}
                </div>
              </div>

              {inquiry.referenceImages?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {inquiry.referenceImages.slice(0, 6).map((image, index) => (
                    <a key={`${image}-${index}`} href={resolveImageUrl(image)} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-outline-variant/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveImageUrl(image)} alt={`Reference ${index + 1}`} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </AppShell>
  );
}
