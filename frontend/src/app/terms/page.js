import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'Terms & Conditions | The Cake Bake',
  description: 'Read The Cake Bake\'s terms and conditions for using our website and services.',
};

export default function TermsPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-dark mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-outline mb-8">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Acceptance of Terms</h2>
            <p>By accessing or using The Cake Bake website or placing an order, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our services.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Order Placement</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All orders are subject to availability and confirmation.</li>
              <li>Prices are in Indian Rupees (₹) and inclusive of applicable taxes.</li>
              <li>We reserve the right to refuse or cancel orders at our discretion.</li>
              <li>For custom cake orders, a design briefing may be required.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Intellectual Property</h2>
            <p>All content on this website — including images, text, logos, and designs — is the property of The Cake Bake and may not be reproduced without written permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Limitation of Liability</h2>
            <p>The Cake Bake shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or services. Our maximum liability shall be limited to the value of the order placed.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Governing Law</h2>
            <p>These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Amritsar, Punjab.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Contact</h2>
            <p>For any questions about these terms, contact us at <a href="mailto:hello@cakebake.in" className="text-pink-deep underline">hello@cakebake.in</a>.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
