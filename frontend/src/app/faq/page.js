'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiMinus } from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';

const FAQS = [
  { q: 'How far in advance should I order?', a: 'We recommend ordering at least 24 hours in advance for standard cakes and 48-72 hours for custom designs. Same-day delivery is available for select products.' },
  { q: 'Do you offer eggless cakes?', a: 'Yes! Almost all our cakes are available in eggless variants. Just select the "Make it Eggless" option while ordering.' },
  { q: 'What areas do you deliver to?', a: 'We currently deliver across Amritsar and surrounding areas. Enter your pincode on the product page to check availability and delivery charges.' },
  { q: 'Can I add a personalized message on the cake?', a: 'Absolutely! You can add a custom message (up to 50 characters) on any cake during the ordering process.' },
  { q: 'What if I need to cancel my order?', a: 'You can cancel your order up to 12 hours before the scheduled delivery time for a full refund. Please refer to our cancellation policy for details.' },
  { q: 'How should I store the cake after delivery?', a: 'Store your cake in the refrigerator and consume it within 24-48 hours for the best taste. Remove from the fridge 30 minutes before serving.' },
  { q: 'Do you offer bulk or corporate orders?', a: 'Yes! We offer special pricing for bulk and corporate orders. Visit our Corporate page or contact us directly for customized quotes.' },
  { q: 'What payment methods do you accept?', a: 'We accept Cash on Delivery (COD), UPI, debit/credit cards, and net banking through our secure payment gateway.' },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <span className="text-5xl block mb-3">❓</span>
          <h1 className="text-3xl font-bold text-dark mb-2">Frequently Asked Questions</h1>
          <p className="text-sm text-outline">Quick answers to common questions</p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-surface-container-lowest rounded-xl shadow-card overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="text-sm font-semibold text-dark pr-4">{faq.q}</span>
                {openIndex === i ? (
                  <FiMinus className="w-4 h-4 text-pink-deep shrink-0" />
                ) : (
                  <FiPlus className="w-4 h-4 text-outline shrink-0" />
                )}
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="px-5 pb-5 text-sm text-on-surface-variant leading-relaxed">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
