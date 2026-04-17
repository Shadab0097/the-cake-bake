'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HiOutlineHome, HiOutlineShoppingBag, HiOutlineCube, HiOutlineTag,
  HiOutlineTicket, HiOutlineTruck, HiOutlinePuzzlePiece, HiOutlineUsers,
  HiOutlineStar, HiOutlineEnvelope, HiOutlinePhoto, HiOutlineBell,
  HiOutlineChevronLeft, HiOutlineChevronRight
} from 'react-icons/hi2';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: HiOutlineHome },
  { label: 'Orders', href: '/admin/orders', icon: HiOutlineShoppingBag },
  { label: 'Products', href: '/admin/products', icon: HiOutlineCube },
  { label: 'Categories', href: '/admin/categories', icon: HiOutlineTag },
  { label: 'Coupons', href: '/admin/coupons', icon: HiOutlineTicket },
  { label: 'Delivery', href: '/admin/delivery', icon: HiOutlineTruck },
  { label: 'Add-Ons', href: '/admin/addons', icon: HiOutlinePuzzlePiece },
  { label: 'Customers', href: '/admin/customers', icon: HiOutlineUsers },
  { label: 'Reviews', href: '/admin/reviews', icon: HiOutlineStar },
  { label: 'Inquiries', href: '/admin/inquiries', icon: HiOutlineEnvelope },
  { label: 'Banners', href: '/admin/banners', icon: HiOutlinePhoto },
  { label: 'Notifications', href: '/admin/notifications', icon: HiOutlineBell },
];

export default function AdminSidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="admin-sidebar-overlay"
        />
      )}

      <aside
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: collapsed ? 'var(--admin-sidebar-collapsed)' : 'var(--admin-sidebar-w)',
          background: 'var(--admin-surface)',
          borderRight: '1px solid var(--admin-border-subtle)',
          transition: 'width var(--admin-transition), transform var(--admin-transition)',
          zIndex: 45, display: 'flex', flexDirection: 'column',
          overflowX: 'hidden',
        }}
        className={`admin-sidebar${mobileOpen ? ' admin-sidebar-open' : ''}`}
      >
        {/* Logo */}
        <div style={{
          padding: collapsed ? '1.25rem 0.75rem' : '1.25rem 1.25rem',
          borderBottom: '1px solid var(--admin-border-subtle)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          minHeight: 'var(--admin-topbar-h)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'linear-gradient(135deg, #D81B60, #F06292)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, color: '#fff', fontSize: '1rem', flexShrink: 0,
          }}>
            CB
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--admin-text)', lineHeight: 1.2 }}>Cake Bake</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--admin-text-muted)', letterSpacing: '0.04em' }}>ADMIN PANEL</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: collapsed ? '0.625rem' : '0.625rem 0.875rem',
                    borderRadius: 'var(--admin-radius-sm)',
                    color: active ? 'var(--admin-accent-hover)' : 'var(--admin-text-secondary)',
                    background: active ? 'var(--admin-accent-soft)' : 'transparent',
                    textDecoration: 'none', fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                    transition: 'all var(--admin-transition)',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    whiteSpace: 'nowrap',
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon style={{ fontSize: '1.25rem', flexShrink: 0 }} />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          style={{
            padding: '0.75rem', borderTop: '1px solid var(--admin-border-subtle)',
            background: 'transparent', border: 'none', color: 'var(--admin-text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', fontSize: '0.8125rem', transition: 'color var(--admin-transition)',
          }}
          className="admin-sidebar-toggle"
        >
          {collapsed ? <HiOutlineChevronRight /> : <><HiOutlineChevronLeft /> <span>Collapse</span></>}
        </button>
      </aside>


    </>
  );
}
