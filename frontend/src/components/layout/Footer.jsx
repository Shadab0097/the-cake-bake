import Link from 'next/link';
import { FiMail, FiPhone, FiMapPin, FiInstagram, FiYoutube } from 'react-icons/fi';
import { FaWhatsapp, FaFacebookF } from 'react-icons/fa';

const QUICK_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/products' },
  { label: 'Custom Cake', href: '/custom-cake' },
  { label: 'Corporate Orders', href: '/corporate' },
  { label: 'Our Story', href: '/about' },
];

const HELP_LINKS = [
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Shipping Policy', href: '/shipping' },
  { label: 'Cancellation & Refund', href: '/refund' },
  { label: 'Privacy Policy', href: '/policies' },
  { label: 'Terms & Conditions', href: '/terms' },
];

export default function Footer() {
  return (
    <footer className="bg-dark text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <span className="text-3xl font-script text-pink-light">Cake Bake</span>
            </Link>
            <p className="text-sm text-white/70 leading-relaxed mb-6">
              Freshly Baked, Delivered with Love. Premium cakes for every celebration,
              crafted with the finest ingredients and delivered to your doorstep.
            </p>
            {/* Social */}
            <div className="flex items-center gap-3">
              {[
                { icon: FaFacebookF, href: '#', label: 'Facebook' },
                { icon: FiInstagram, href: '#', label: 'Instagram' },
                { icon: FaWhatsapp, href: '#', label: 'WhatsApp' },
                { icon: FiYoutube, href: '#', label: 'YouTube' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-pink-deep transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-pink-light mb-4">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 hover:text-pink-light transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-pink-light mb-4">
              Help
            </h3>
            <ul className="space-y-3">
              {HELP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 hover:text-pink-light transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Newsletter */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-pink-light mb-4">
              Get In Touch
            </h3>
            <div className="space-y-3 text-sm text-white/70">
              <a href="mailto:hello@cakebake.in" className="flex items-center gap-2 hover:text-pink-light transition-colors">
                <FiMail className="w-4 h-4 shrink-0" />
                hello@cakebake.in
              </a>
              <a href="tel:+919876543210" className="flex items-center gap-2 hover:text-pink-light transition-colors">
                <FiPhone className="w-4 h-4 shrink-0" />
                +91 98765 43210
              </a>
              <div className="flex items-start gap-2">
                <FiMapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Amritsar, Punjab, India</span>
              </div>
            </div>

            {/* Newsletter */}
            <div className="mt-6">
              <p className="text-xs text-white/50 mb-2">Subscribe for sweet updates</p>
              <form
                className="flex"
                onSubmit={(e) => e.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-l-lg placeholder:text-white/40 focus:outline-none focus:border-pink-light text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-pink-deep text-white text-sm font-medium rounded-r-lg hover:bg-pink transition-colors"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} Cake Bake. All rights reserved.
          </p>
          <p className="text-xs text-white/50">
            Made with 💖 in Amritsar
          </p>
        </div>
      </div>
    </footer>
  );
}
