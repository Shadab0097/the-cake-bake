import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'Cancellation & Refund Policy | Cake Bake',
  description: 'Understand Cake Bake\'s cancellation and refund policy.',
};

export default function RefundPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-dark mb-2">Cancellation &amp; Refund Policy</h1>
        <p className="text-sm text-outline mb-8">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Order Cancellation</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You can cancel an order up to <strong className="text-dark">12 hours</strong> before the scheduled delivery time for a <strong className="text-dark">full refund</strong>.</li>
              <li>Cancellations within 12 hours of delivery are not eligible for a refund as preparation would have begun.</li>
              <li>Custom-designed cakes cannot be cancelled once production has begun (typically 24 hours before delivery).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">How to Cancel</h2>
            <p>To cancel your order, contact us via:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Email: <a href="mailto:hello@cakebake.in" className="text-pink-deep underline">hello@cakebake.in</a></li>
              <li>Phone: +91 98765 43210</li>
              <li>WhatsApp: +91 98765 43210</li>
            </ul>
            <p className="mt-2">Please have your Order ID ready.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Refund Process</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Approved refunds are processed within <strong className="text-dark">5–7 business days</strong>.</li>
              <li>Refunds for online payments are credited back to the original payment method.</li>
              <li>Cash on Delivery orders: Refunds are processed via bank transfer.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Quality Issues</h2>
            <p>If you are unsatisfied with the quality of your cake, contact us within <strong className="text-dark">2 hours of delivery</strong> with photos. We will offer a replacement or full refund at our discretion.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
