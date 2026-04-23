import AppShell from '@/components/layout/AppShell';

export const metadata = {
  title: 'Our Story',
  description: 'Learn about The Cake Bake — premium cakes baked fresh in Amritsar with love and passion.',
};

export default function AboutPage() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <span className="text-5xl mb-4 block">🎂</span>
          <h1 className="text-3xl lg:text-4xl font-bold text-dark mb-4">Our Story</h1>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Born from a passion for baking and a love for celebrations,
            The Cake Bake has been crafting unforgettable moments since 2020.
          </p>
        </div>

        {/* Values */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: '🌾', title: 'Premium Ingredients', desc: 'We source only the finest ingredients — real butter, Belgian chocolate, and fresh fruits.' },
            { icon: '👨‍🍳', title: 'Expert Bakers', desc: 'Our team of skilled pastry chefs brings decades of combined experience to every creation.' },
            { icon: '🚀', title: 'Fresh Delivery', desc: 'Every cake is baked to order and delivered fresh to your doorstep, guaranteed.' },
          ].map((v) => (
            <div key={v.title} className="text-center p-6 bg-surface-container-lowest rounded-2xl shadow-card">
              <span className="text-4xl block mb-3">{v.icon}</span>
              <h3 className="text-base font-semibold text-dark mb-2">{v.title}</h3>
              <p className="text-sm text-outline leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Story */}
        <div className="prose prose-sm max-w-none text-on-surface-variant space-y-4">
          <h2 className="text-2xl font-bold text-dark">From Our Kitchen to Your Table</h2>
          <p>What started as a small home bakery in Amritsar has grown into a beloved brand trusted by thousands of families across Punjab. Every day, we wake up with one mission: to make celebrations sweeter.</p>
          <p>At The Cake Bake, we believe that every cake tells a story. Whether it&apos;s a child&apos;s first birthday, a golden anniversary, or a simple &ldquo;thank you&rdquo; — we pour our heart into every creation.</p>
          <p>Our commitment to quality is unwavering. We never use artificial preservatives, and every cake is freshly baked to order. This is our promise to you.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          {[
            { value: '10,000+', label: 'Happy Customers' },
            { value: '25,000+', label: 'Cakes Delivered' },
            { value: '4.8★', label: 'Average Rating' },
            { value: '50+', label: 'Cake Varieties' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-4 rounded-2xl bg-pink-light/20">
              <p className="text-2xl font-bold text-pink-deep">{stat.value}</p>
              <p className="text-xs text-outline mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
