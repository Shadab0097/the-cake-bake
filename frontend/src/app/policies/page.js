import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'Privacy Policy | The Cake Bake',
  description: 'The Cake Bake\'s privacy policy — how we collect, use, and protect your data.',
};

export default function PoliciesPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-dark mb-2">Privacy Policy</h1>
        <p className="text-sm text-outline mb-8">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Information We Collect</h2>
            <p>We collect information you provide directly when placing an order or creating an account, including:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Name, email address, and phone number</li>
              <li>Delivery address</li>
              <li>Payment information (processed securely via Razorpay — we do not store card details)</li>
              <li>Order and transaction history</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To process and fulfil your orders</li>
              <li>To send order confirmations and delivery updates</li>
              <li>To respond to customer service requests</li>
              <li>To send promotional offers (only with your consent)</li>
              <li>To improve our products and services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Data Security</h2>
            <p>We implement industry-standard security measures including SSL encryption, secure servers, and limited staff access to protect your personal data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Data Sharing</h2>
            <p>We do not sell or rent your personal information. We may share data with trusted third-party service providers (e.g., payment processors, delivery partners) solely to fulfil your order.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Contact</h2>
            <p>For any privacy-related queries, contact us at <a href="mailto:hello@cakebake.in" className="text-pink-deep underline">hello@cakebake.in</a>.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
