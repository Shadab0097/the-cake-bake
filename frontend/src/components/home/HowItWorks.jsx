'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function HowItWorks() {
  const steps = [
    {
      step: '01',
      icon: '🎂',
      title: 'Choose Your Cake',
      description: 'Browse our premium collection or design a custom cake that matches your vision.',
    },
    {
      step: '02',
      icon: '📅',
      title: 'Pick Delivery Date',
      description: 'Select your preferred delivery date and time slot. Same-day delivery available!',
    },
    {
      step: '03',
      icon: '🚀',
      title: 'Enjoy Fresh Delivery',
      description: 'We bake it fresh and deliver it to your doorstep with love and care.',
    },
  ];

  return (
    <section className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl lg:text-3xl font-bold text-dark mb-2">
            How It Works
          </h2>
          <p className="text-sm text-outline max-w-md mx-auto">
            Ordering is as easy as 1-2-3. Fresh cakes delivered to your doorstep.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="text-center group"
            >
              <div className="relative w-24 h-24 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full bg-pink-light/30 group-hover:bg-pink-light/50 transition-colors" />
                <div className="relative w-full h-full rounded-full flex items-center justify-center text-5xl">
                  {item.icon}
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full gradient-primary text-white text-xs font-bold flex items-center justify-center">
                  {item.step}
                </div>
              </div>
              <h3 className="text-lg font-semibold text-dark mb-2">{item.title}</h3>
              <p className="text-sm text-outline leading-relaxed max-w-xs mx-auto">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full gradient-primary text-white font-semibold hover:opacity-90 transition-opacity shadow-lg"
          >
            Start Ordering 🎂
          </Link>
        </div>
      </div>
    </section>
  );
}
