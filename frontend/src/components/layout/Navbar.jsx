'use client';

import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiHeart, FiShoppingBag, FiUser, FiMenu, FiX, FiChevronDown, FiChevronRight,
} from 'react-icons/fi';
import { toggleSearch, toggleMobileMenu, closeMobileMenu } from '@/store/slices/uiSlice';
import { openCartDrawer } from '@/store/slices/cartSlice';
import { formatOccasion, OCCASIONS } from '@/lib/utils';
import DeliveryLocationWidget from '@/components/layout/DeliveryLocationWidget';

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
  const router      = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { isAuthenticated, user } = useSelector((s) => s.auth);
  const { itemCount, guestItemCount } = useSelector((s) => s.cart);
  const totalCartCount = isAuthenticated ? itemCount : guestItemCount;
  const wishlistCount  = useSelector((s) => s.wishlist.count);
  const { isMobileMenuOpen } = useSelector((s) => s.ui);

  const [scrolled,       setScrolled]       = useState(false);
  const [activeDropdown, setActiveDropdown]  = useState({ pathname: '', label: null });
  const categories = useSelector((s) => s.categories.items);
  const dropdownRef = useRef(null);
  const closeTimerRef = useRef(null);

  const activeDropdownLabel = activeDropdown.pathname === pathname ? activeDropdown.label : null;

  /* ── Hover-intent open/close for desktop mega menus ──────────────────── */
  const openDropdown = (label) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setActiveDropdown({ pathname, label });
  };

  const scheduleCloseDropdown = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setActiveDropdown((current) => ({ ...current, label: null }));
    }, 140);
  };

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

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
        setActiveDropdown((current) => ({ ...current, label: null }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── Close everything on route change ────────────────────────────────── */
  useEffect(() => {
    dispatch(closeMobileMenu());
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

  return (
    <>
      {/* Announcement Bar */}
      <div className="bg-pink-deep text-white text-center py-2 px-4 text-xs sm:text-sm font-medium tracking-wide">
        <span className="animate-pulse mr-2">🎂</span>
        Use code <strong className="underline">WELCOME20</strong> for 20% off your first order!
        <span className="animate-pulse ml-2">🎂</span>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-50" ref={dropdownRef}>
        {/* ── Row 1: brand bar (logo · location · search · actions) ──────── */}
        <div className={`bg-pink-light transition-shadow ${scrolled ? 'shadow-md' : ''}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 lg:gap-6 h-16 lg:h-20">

              {/* Logo + delivery location (desktop) */}
              <div className="flex items-center gap-3 shrink-0">
                <Link href="/" className="flex items-center shrink-0">
                  <span className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-script text-pink-deep whitespace-nowrap">
                    The Cake Bake
                  </span>
                </Link>
                <div className="hidden md:block">
                  <DeliveryLocationWidget variant="desktop" />
                </div>
              </div>

              {/* Inline search (desktop) */}
              <form onSubmit={handleSearchSubmit} className="hidden lg:flex flex-1 max-w-xl lg:ml-8" role="search">
                <div className="relative w-full">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for cakes, occasion, flavour and more…"
                    aria-label="Search"
                    className="w-full h-12 pl-12 pr-28 rounded-full bg-white text-sm text-dark placeholder:text-outline shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-deep/40"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-5 rounded-full gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Search
                  </button>
                </div>
              </form>

              {/* ── Right actions ───────────────────────────────────────── */}
              <div className="flex items-center gap-1 sm:gap-3 lg:gap-5 ml-auto">
                {/* Search icon (mobile / tablet) */}
                <button
                  onClick={() => dispatch(toggleSearch())}
                  className="lg:hidden p-2 rounded-full hover:bg-pink/20 transition-colors text-dark"
                  aria-label="Search"
                  id="nav-search-btn"
                >
                  <FiSearch className="w-6 h-6" />
                </button>

                {/* Delivery location (mobile / tablet) */}
                <div className="md:hidden">
                  <DeliveryLocationWidget variant="mobile" />
                </div>

                {/* Wishlist */}
                <Link
                  href="/wishlist"
                  className="hidden sm:flex flex-col items-center justify-center gap-1 text-dark hover:text-pink-deep transition-colors"
                  aria-label="Wishlist"
                  id="nav-wishlist-btn"
                >
                  <span className="relative">
                    <FiHeart className="w-6 h-6" />
                    {wishlistCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-pink-deep text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1">
                        {wishlistCount}
                      </span>
                    )}
                  </span>
                  <span className="hidden lg:block text-xs font-medium leading-none">Wishlist</span>
                </Link>

                {/* Cart */}
                <button
                  onClick={() => dispatch(openCartDrawer())}
                  className="flex flex-col items-center justify-center gap-1 text-dark hover:text-pink-deep transition-colors"
                  aria-label="Cart"
                  id="nav-cart-btn"
                >
                  <span className="relative">
                    <FiShoppingBag className="w-6 h-6" />
                    {totalCartCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-pink-deep text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1">
                        {totalCartCount}
                      </span>
                    )}
                  </span>
                  <span className="hidden lg:block text-xs font-medium leading-none">Cart</span>
                </button>

                {/* Account / Login */}
                {isAuthenticated ? (
                  <Link
                    href="/account"
                    className="hidden sm:flex flex-col items-center justify-center gap-1 text-dark hover:text-pink-deep transition-colors"
                    id="nav-account-btn"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-deep to-pink flex items-center justify-center text-white text-xs font-bold">
                      {user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="hidden lg:block text-xs font-medium leading-none">Account</span>
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    className="hidden sm:flex flex-col items-center justify-center gap-1 text-dark hover:text-pink-deep transition-colors"
                    id="nav-login-btn"
                  >
                    <FiUser className="w-6 h-6" />
                    <span className="hidden lg:block text-xs font-medium leading-none">Login</span>
                  </Link>
                )}

                {/* Mobile menu toggle */}
                <button
                  onClick={() => dispatch(toggleMobileMenu())}
                  className="lg:hidden p-2 rounded-full hover:bg-pink/20 transition-colors text-dark"
                  aria-label="Menu"
                  id="nav-mobile-menu-btn"
                >
                  {isMobileMenuOpen ? (
                    <FiX className="w-6 h-6" />
                  ) : (
                    <FiMenu className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: primary nav (desktop, white) ───────────────────────── */}
        <div className="hidden lg:block bg-white border-b border-outline-variant/10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-between h-12">
              {navLinks.map((link) => {
                const hasChildren = Boolean(link.children);
                const isOpen = activeDropdownLabel === link.label;
                const menuItems = hasChildren ? link.children.filter((c) => !c.divider) : [];
                const footerItems = hasChildren ? link.children.filter((c) => c.divider) : [];
                const isWide = menuItems.length > 5;
                return (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={hasChildren ? () => openDropdown(link.label) : undefined}
                  onMouseLeave={hasChildren ? scheduleCloseDropdown : undefined}
                >
                  {link.children ? (
                    <div
                      className={`group flex items-center rounded-full transition-colors ${
                        pathname.startsWith(link.href) && link.href !== '/'
                          ? 'bg-pink-light/30'
                          : 'hover:bg-pink-light/20'
                      }`}
                    >
                      <Link
                        href={link.href}
                        className={`pl-3.5 pr-1 py-2 text-[15px] font-semibold rounded-l-full transition-colors ${
                          pathname.startsWith(link.href) && link.href !== '/'
                            ? 'text-pink-deep'
                            : 'text-dark group-hover:text-pink-deep'
                        }`}
                      >
                        {link.label}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Toggle ${link.label} menu`}
                        aria-expanded={activeDropdownLabel === link.label}
                        onClick={() =>
                          setActiveDropdown(
                            activeDropdownLabel === link.label
                              ? { pathname, label: null }
                              : { pathname, label: link.label }
                          )
                        }
                        className={`pl-0.5 pr-2.5 py-2 rounded-r-full transition-colors ${
                          pathname.startsWith(link.href) && link.href !== '/'
                            ? 'text-pink-deep'
                            : 'text-dark group-hover:text-pink-deep'
                        }`}
                      >
                        <FiChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            activeDropdownLabel === link.label ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={link.href}
                      className={`px-3.5 py-2 text-[15px] font-semibold rounded-full transition-colors ${
                        pathname === link.href
                          ? 'text-pink-deep bg-pink-light/30'
                          : 'text-dark hover:text-pink-deep hover:bg-pink-light/20'
                      }`}
                    >
                      {link.label}
                    </Link>
                  )}

                  {/* Dropdown — mega menu style */}
                  <AnimatePresence>
                    {hasChildren && isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="absolute top-full left-0 z-50 pt-2"
                      >
                        <div
                          className={`overflow-hidden rounded-2xl bg-white shadow-[0_20px_48px_rgba(26,28,26,0.14)] ring-1 ring-outline-variant/20 ${
                            isWide ? 'w-[30rem]' : 'w-64'
                          }`}
                        >
                          {/* Accent header */}
                          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gradient-to-r from-pink-light/40 to-transparent border-b border-outline-variant/15">
                            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-pink-deep">
                              {link.label}
                            </span>
                            {footerItems.length === 0 && (
                              <Link
                                href={link.href}
                                className="group/all inline-flex items-center gap-1 text-xs font-semibold text-outline hover:text-pink-deep transition-colors"
                              >
                                View all
                                <FiChevronRight className="w-3.5 h-3.5 group-hover/all:translate-x-0.5 transition-transform" />
                              </Link>
                            )}
                          </div>

                          {/* Items */}
                          <div className={`p-2 ${isWide ? 'grid grid-cols-2 gap-0.5' : 'flex flex-col'}`}>
                            {menuItems.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className="group/item flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-dark hover:bg-pink-light/25 hover:text-pink-deep transition-colors"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-outline-variant group-hover/item:bg-pink-deep transition-colors" />
                                  <span className="truncate">{child.label}</span>
                                </span>
                                <FiChevronRight className="w-3.5 h-3.5 shrink-0 text-outline-variant opacity-0 -translate-x-1 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all" />
                              </Link>
                            ))}
                          </div>

                          {/* Footer CTA */}
                          {footerItems.length > 0 && (
                            <div className="border-t border-outline-variant/15 p-2">
                              {footerItems.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className="group/footer flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-pink-deep hover:bg-pink-light/25 transition-colors"
                                >
                                  {child.label}
                                  <FiChevronRight className="w-4 h-4 group-hover/footer:translate-x-0.5 transition-transform" />
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                );
                })}
            </nav>
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
                                activeDropdownLabel === link.label
                                  ? { pathname, label: null }
                                  : { pathname, label: link.label }
                              )
                            }
                            className="flex items-center justify-between w-full px-3 py-3 text-sm font-medium text-dark rounded-lg hover:bg-pink-light/20 transition-colors"
                          >
                            {link.label}
                            <FiChevronDown
                              className={`w-4 h-4 transition-transform ${
                                activeDropdownLabel === link.label ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                          {activeDropdownLabel === link.label && (
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
