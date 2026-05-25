'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HiOutlineHome, HiOutlineShoppingBag, HiOutlineCube, HiOutlineTag,
  HiOutlineTicket, HiOutlineTruck, HiOutlinePuzzlePiece, HiOutlineUsers,
  HiOutlineStar, HiOutlineEnvelope, HiOutlinePhoto, HiOutlineBell,
  HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineChatBubbleLeftRight,
  HiOutlineReceiptRefund, HiOutlineBugAnt
} from 'react-icons/hi2';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: HiOutlineHome },
  { label: 'Orders', href: '/admin/orders', icon: HiOutlineShoppingBag },
  { label: 'Refunds', href: '/admin/refunds', icon: HiOutlineReceiptRefund },
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
  { label: 'System Logs', href: '/admin/logs', icon: HiOutlineBugAnt },
  { label: 'Bot', href: '/admin/chatbot', icon: HiOutlineChatBubbleLeftRight },
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
          borderRight: '1px solid var(--admin-border-subtle)',
          transition: 'width var(--admin-transition), transform var(--admin-transition)',
          zIndex: 45, display: 'flex', flexDirection: 'column',
          overflowX: 'hidden',
        }}
        className={`admin-sidebar${mobileOpen ? ' admin-sidebar-open' : ''}`}
      >
        {/* Logo */}
        <div
          className="admin-sidebar-brand"
          style={{ padding: collapsed ? '1.25rem 0.75rem' : '1.25rem 1.25rem' }}
        >
          <div className="admin-brand-mark">
            CB
          </div>
          {!collapsed && (
            <div>
              <div className="admin-brand-name">The Cake Bake</div>
              <div className="admin-brand-subtitle">Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem', overflowY: 'auto' }}>
          <div className="admin-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={`admin-nav-link${active ? ' active' : ''}`}
                  style={{
                    padding: collapsed ? '0.625rem' : '0.625rem 0.875rem',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="admin-nav-icon" />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand admin navigation' : 'Collapse admin navigation'}
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
