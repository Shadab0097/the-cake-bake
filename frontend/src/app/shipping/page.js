import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'Shipping Policy | The Cake Bake',
  description: 'Learn about The Cake Bake delivery areas, timelines, and charges.',
};

export default function ShippingPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold text-dark mb-2">Shipping Policy</h1>
        <p className="text-sm text-outline mb-8">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Delivery Areas</h2>
            <p>We currently deliver within Amritsar and surrounding areas within a 20 km radius. Enter your pincode on the product page to confirm availability.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Delivery Timeline</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Standard orders: Delivery within 24–48 hours of placement.</li>
              <li>Same-day delivery: Available for select products if ordered before 12:00 PM.</li>
              <li>Custom cakes: Minimum 48–72 hours advance booking required.</li>
              <li>Bulk / Corporate orders: Minimum 5–7 days advance notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Delivery Charges</h2>
            <p>Delivery is <strong className="text-dark">FREE</strong> on all orders above ₹499. A delivery fee of ₹49 applies to orders below ₹499.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Delivery Slots</h2>
            <p>You can choose from available time slots during checkout. While we strive to deliver on time, delays due to weather, traffic, or other unforeseen circumstances are beyond our control.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-dark mb-3">Damaged or Incorrect Orders</h2>
            <p>If you receive a damaged or incorrect cake, please contact us immediately at <a href="mailto:hello@cakebake.in" className="text-pink-deep underline">hello@cakebake.in</a> or call +91 98765 43210. We will arrange a replacement at no extra cost.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
