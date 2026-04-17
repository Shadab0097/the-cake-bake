'use client';

import { motion } from 'framer-motion';

const testimonials = [
  {
    name: 'Priya Sharma',
    city: 'Amritsar',
    rating: 5,
    text: 'The chocolate truffle cake was absolutely divine! Fresh, moist, and delivered on time. Best bakery in Amritsar!',
  },
  {
    name: 'Rajesh Kumar',
    city: 'Jalandhar',
    rating: 5,
    text: "Ordered a custom cake for my daughter's birthday. The design was exactly what we wanted. Highly recommended!",
  },
  {
    name: 'Anita Verma',
    city: 'Ludhiana',
    rating: 5,
    text: 'The eggless red velvet cake exceeded our expectations. Will definitely order again for every occasion!',
  },
  {
    name: 'Gurpreet Singh',
    city: 'Amritsar',
    rating: 5,
    text: 'Great quality and beautiful presentation. The corporate order was handled perfectly. Impressed!',
  },
  {
    name: 'Simran Kaur',
    city: 'Amritsar',
    rating: 5,
    text: 'Best cakes in town! The butterscotch cake was heavenly. Packaging was premium and delivery was swift.',
  },
  {
    name: 'Amit Patel',
    city: 'Chandigarh',
    rating: 5,
    text: 'The wedding cake was a showstopper! Everyone at the party loved it. Thank you Cake Bake!',
  },
];

export default function TestimonialMarquee() {
  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="py-12 lg:py-16 overflow-hidden bg-surface-container-low">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-dark mb-2">
            What Our Customers Say
          </h2>
          <p className="text-sm text-outline">Real reviews from real celebrations</p>
        </div>
      </div>

      <div className="relative">
        <motion.div
          className="flex gap-4"
          animate={{
            x: [0, -50 * testimonials.length * 5],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 40,
              ease: 'linear',
            },
          }}
        >
          {doubled.map((review, i) => (
            <div
              key={i}
              className="shrink-0 w-[300px] sm:w-[340px] bg-surface-container-lowest rounded-2xl p-5 shadow-card"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: review.rating }).map((_, j) => (
                  <span key={j} className="text-secondary text-sm">★</span>
                ))}
              </div>

              <p className="text-sm text-dark leading-relaxed mb-4 line-clamp-3">
                &ldquo;{review.text}&rdquo;
              </p>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-deep to-pink flex items-center justify-center text-white text-xs font-bold">
                  {review.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-dark">{review.name}</p>
                  <p className="text-xs text-outline">{review.city}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
