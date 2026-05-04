'use client';

import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiHeart, FiShoppingBag, FiUser, FiMenu, FiX, FiChevronDown,
} from 'react-icons/fi';
import { toggleSearch, toggleMobileMenu, closeMobileMenu } from '@/store/slices/uiSlice';
import { openCartDrawer } from '@/store/slices/cartSlice';
import { formatOccasion, OCCASIONS } from '@/lib/utils';

/* ─── Static nav links (categories injected dynamically) ─────────────────── */
const STATIC_LINKS = [
  { label: 'Home', href: '/' },
  {
    label: 'Shop',
    href: '/products',
    children: [
      { label: 'All Products', href: '/products' },
      { label: 'Featured',     href: '/products?tag=featured' },
      { label: 'Bestsellers',  href: '/products?sort=popularity' },
      { label: 'New Arrivals', href: '/products?sort=newest' },
    ],
  },
  {
    label: 'Categories',
    href: '/categories',
    key: 'categories',
  },
  {
    label: 'Occasions',
    href: '/occasions',
    children: OCCASIONS.slice(0, 10).map((o) => ({
      label: formatOccasion(o),
      href: `/occasions/${o}`,
    })),
  },
  { label: 'Custom Cake', href: '/custom-cake' },
  { label: 'Corporate',   href: '/corporate' },
  { label: 'Our Story',   href: '/about' },
];

export default function Navbar() {
  const dispatch    = useDispatch();
  const pathname    = usePathname();
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const { itemCount, guestItemCount } = useSelector((s) => s.cart);
  const totalCartCount = isAuthenticated ? itemCount : guestItemCount;
  const wishlistCount  = useSelector((s) => s.wishlist.count);
  const { isMobileMenuOpen } = useSelector((s) => s.ui);

  const [scrolled,       setScrolled]       = useState(false);
  const [activeDropdown, setActiveDropdown]  = useState(null);
  const categories = useSelector((s) => s.categories.items);
  const dropdownRef = useRef(null);

  const isHeroPage = pathname === '/';

  /* ── Scroll ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ── Close dropdown on outside click ─────────────────────────────────── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Close everything on route change ────────────────────────────────── */
  useEffect(() => {
    dispatch(closeMobileMenu());
    setActiveDropdown(null);
  }, [pathname, dispatch]);

  /* ── Build nav links with dynamic categories ────────────────────────── */
  const navLinks = STATIC_LINKS.map((link) => {
    if (link.key === 'categories' && categories.length > 0) {
      return {
        ...link,
        children: [
          ...categories.slice(0, 8).map((cat) => ({
            label: cat.name,
            href:  `/categories/${cat.slug}`,
          })),
          { label: 'View All Categories', href: '/categories', divider: true },
        ],
      };
    }
    return link;
  });

  const navBg = scrolled || !isHeroPage
    ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-outline-variant/10'
    : 'bg-transparent';

  return (
    <>
      {/* Announcement Bar */}
      <div className="bg-pink-deep text-white text-center py-2 px-4 text-xs sm:text-sm font-medium tracking-wide">
        <span className="animate-pulse mr-2">🎂</span>
        Use code <strong className="underline">WELCOME20</strong> for 20% off your first order!
        <span className="animate-pulse ml-2">🎂</span>
      </div>

      {/* Main Navbar */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${navBg}`}
        ref={dropdownRef}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="text-2xl lg:text-3xl font-script text-pink-deep">
                The Cake Bake
              </span>
            </Link>

            {/* ── Desktop Nav ─────────────────────────────────────────── */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <div key={link.label} className="relative">
                  {link.children ? (
                    <div className="flex items-center">
                      <Link
                        href={link.href}
                        className={`px-3 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                          pathname.startsWith(link.href) && link.href !== '/'
                            ? 'text-pink-deep bg-pink-light/30'
                            : 'text-dark hover:text-pink-deep hover:bg-pink-light/20'
                        }`}
                      >
                        {link.label}
                      </Link>
                      <button
                        onClick={() =>
                          setActiveDropdown(activeDropdown === link.label ? null : link.label)
                        }
                        className={`px-1 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                          pathname.startsWith(link.href) && link.href !== '/'
                            ? 'text-pink-deep bg-pink-light/30'
                            : 'text-dark hover:text-pink-deep hover:bg-pink-light/20'
                        }`}
                      >
                        <FiChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            activeDropdown === link.label ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={link.href}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        pathname === link.href
                          ? 'text-pink-deep bg-pink-light/30'
                          : 'text-dark hover:text-pink-deep hover:bg-pink-light/20'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )}

                  {/* Dropdown — unified simple style */}
                  <AnimatePresence>
                    {link.children && activeDropdown === link.label && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-outline-variant/10 py-2 z-50"
                      >
                        {link.children.map((child, idx) => (
                          <div key={child.href}>
                            {child.divider && (
                              <div className="border-t border-outline-variant/10 my-1" />
                            )}
                            <Link
                              href={child.href}
                              className={`block px-4 py-2.5 text-sm transition-colors ${
                                child.divider
                                  ? 'text-pink-deep font-semibold hover:bg-pink-light/20'
                                  : 'text-dark hover:bg-pink-light/20 hover:text-pink-deep'
                              }`}
                            >
                              {child.label}
                            </Link>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </nav>

            {/* ── Right Actions ────────────────────────────────────────── */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => dispatch(toggleSearch())}
                className="p-2 rounded-full hover:bg-pink-light/30 transition-colors text-dark"
                aria-label="Search"
                id="nav-search-btn"
              >
                <FiSearch className="w-5 h-5" />
              </button>

              <Link
                href="/wishlist"
                className="relative p-2 rounded-full hover:bg-pink-light/30 transition-colors text-dark hidden sm:block"
                aria-label="Wishlist"
                id="nav-wishlist-btn"
              >
                <FiHeart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-pink-deep text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <button
                onClick={() => dispatch(openCartDrawer())}
                className="relative p-2 rounded-full hover:bg-pink-light/30 transition-colors text-dark"
                aria-label="Cart"
                id="nav-cart-btn"
              >
                <FiShoppingBag className="w-5 h-5" />
                {totalCartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-pink-deep text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                    {totalCartCount}
                  </span>
                )}
              </button>

              {isAuthenticated ? (
                <Link
                  href="/account"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-full hover:bg-pink-light/30 transition-colors"
                  id="nav-account-btn"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-deep to-pink flex items-center justify-center text-white text-xs font-bold">
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  id="nav-login-btn"
                >
                  <FiUser className="w-4 h-4" />
                  <span>Login</span>
                </Link>
              )}

              <button
                onClick={() => dispatch(toggleMobileMenu())}
                className="lg:hidden p-2 rounded-full hover:bg-pink-light/30 transition-colors text-dark"
                aria-label="Menu"
                id="nav-mobile-menu-btn"
              >
                {isMobileMenuOpen ? (
                  <FiX className="w-5 h-5" />
                ) : (
                  <FiMenu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile Menu ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                onClick={() => dispatch(closeMobileMenu())}
              />

              <motion.div
                key="drawer"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="fixed top-0 left-0 right-0 z-50 lg:hidden bg-white shadow-2xl"
                style={{ maxHeight: '90vh', overflowY: 'auto' }}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
                  <span className="text-xl font-script text-pink-deep">The Cake Bake</span>
                  <button
                    onClick={() => dispatch(closeMobileMenu())}
                    className="p-2 rounded-full hover:bg-pink-light/30 transition-colors text-dark"
                    aria-label="Close menu"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                <nav className="px-4 py-4 space-y-1">
                  {navLinks.map((link) => (
                    <div key={link.label}>
                      {link.children ? (
                        <>
                          <button
                            onClick={() =>
                              setActiveDropdown(
                                activeDropdown === link.label ? null : link.label
                              )
                            }
                            className="flex items-center justify-between w-full px-3 py-3 text-sm font-medium text-dark rounded-lg hover:bg-pink-light/20 transition-colors"
                          >
                            {link.label}
                            <FiChevronDown
                              className={`w-4 h-4 transition-transform ${
                                activeDropdown === link.label ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {activeDropdown === link.label && (
                            <div className="pl-4 space-y-0.5 mt-1">
                              {link.children.map((child) => (
                                <div key={child.href}>
                                  {child.divider && (
                                    <div className="border-t border-outline-variant/10 my-1 ml-3 mr-3" />
                                  )}
                                  <Link
                                    href={child.href}
                                    className={`block px-3 py-2.5 text-sm rounded-lg transition-colors ${
                                      child.divider
                                        ? 'text-pink-deep font-semibold hover:bg-pink-light/10'
                                        : 'text-on-surface-variant hover:text-pink-deep hover:bg-pink-light/10'
                                    }`}
                                  >
                                    {child.label}
                                  </Link>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <Link
                          href={link.href}
                          className={`block px-3 py-3 text-sm font-medium rounded-lg transition-colors ${
                            pathname === link.href
                              ? 'text-pink-deep bg-pink-light/30'
                              : 'text-dark hover:text-pink-deep hover:bg-pink-light/20'
                          }`}
                        >
                          {link.label}
                        </Link>
                      )}
                    </div>
                  ))}

                  <div className="pt-4 mt-2 border-t border-outline-variant/20 space-y-2">
                    <Link
                      href="/wishlist"
                      className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-dark hover:bg-pink-light/20 rounded-lg transition-colors"
                    >
                      <FiHeart className="w-5 h-5 text-pink-deep" />
                      Wishlist
                      {wishlistCount > 0 && (
                        <span className="ml-auto bg-pink-deep text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                          {wishlistCount}
                        </span>
                      )}
                    </Link>

                    {isAuthenticated ? (
                      <Link
                        href="/account"
                        className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-dark hover:bg-pink-light/20 rounded-lg transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-deep to-pink flex items-center justify-center text-white text-sm font-bold">
                          {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span>{user?.name || 'My Account'}</span>
                      </Link>
                    ) : (
                      <Link
                        href="/login"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-full gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                      >
                        <FiUser className="w-4 h-4" />
                        Login / Register
                      </Link>
                    )}
                  </div>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
