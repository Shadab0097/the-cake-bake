'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HiOutlineHome, HiOutlineShoppingBag, HiOutlineCube, HiOutlineTag,
  HiOutlineTicket, HiOutlineTruck, HiOutlinePuzzlePiece, HiOutlineUsers,
  HiOutlineStar, HiOutlineEnvelope, HiOutlinePhoto, HiOutlineBell,
  HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineChatBubbleLeftRight,
  HiOutlineReceiptRefund, HiOutlineBugAnt, HiOutlineChartBar, HiOutlineBanknotes,
  HiOutlineUserGroup, HiOutlineCog6Tooth, HiOutlineDocumentText, HiOutlineBuildingStorefront
} from 'react-icons/hi2';
import { canAccess } from '@/lib/adminAccess.mjs';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: HiOutlineHome, section: 'dashboard' },
  { label: 'Sales', href: '/admin/sales', icon: HiOutlineChartBar, section: 'sales' },
  { label: 'Profit', href: '/admin/profit', icon: HiOutlineBanknotes, section: 'profit' },
  { label: 'GST', href: '/admin/gst', icon: HiOutlineDocumentText, section: 'gst' },
  { label: 'Orders', href: '/admin/orders', icon: HiOutlineShoppingBag, section: 'orders' },
  { label: 'Refunds', href: '/admin/refunds', icon: HiOutlineReceiptRefund, section: 'refunds' },
  { label: 'Products', href: '/admin/products', icon: HiOutlineCube, section: 'catalog' },
  { label: 'Categories', href: '/admin/categories', icon: HiOutlineTag, section: 'catalog' },
  { label: 'Coupons', href: '/admin/coupons', icon: HiOutlineTicket, section: 'coupons' },
  { label: 'Delivery', href: '/admin/delivery', icon: HiOutlineTruck, section: 'delivery' },
  { label: 'Add-Ons', href: '/admin/addons', icon: HiOutlinePuzzlePiece, section: 'catalog' },
  { label: 'Customers', href: '/admin/customers', icon: HiOutlineUsers, section: 'customers' },
  { label: 'Insights', href: '/admin/insights', icon: HiOutlineUserGroup, section: 'insights' },
  { label: 'Reviews', href: '/admin/reviews', icon: HiOutlineStar, section: 'reviews' },
  { label: 'Inquiries', href: '/admin/inquiries', icon: HiOutlineEnvelope, section: 'inquiries' },
  { label: 'Banners', href: '/admin/banners', icon: HiOutlinePhoto, section: 'catalog' },
  { label: 'Notifications', href: '/admin/notifications', icon: HiOutlineBell, section: 'notifications' },
  { label: 'System Logs', href: '/admin/logs', icon: HiOutlineBugAnt, section: 'logs' },
  { label: 'Bot', href: '/admin/chatbot', icon: HiOutlineChatBubbleLeftRight, section: 'chatbot' },
  { label: 'Settings', href: '/admin/settings', icon: HiOutlineCog6Tooth, section: 'settings' },
];

export default function AdminSidebar({ collapsed, onToggle, mobileOpen, onMobileClose, role, branchScoped = false }) {
  const pathname = usePathname();
  const navItems = NAV_ITEMS.filter((item) => canAccess(role, item.section, branchScoped));
  // Walled admins get a dedicated "My Branch" surface (settings + own staff).
  // Owners manage branches/admins through the richer global Settings page instead.
  if (branchScoped) {
    navItems.push({ label: 'My Branch', href: '/admin/my-branch', icon: HiOutlineBuildingStorefront, section: 'my-branch' });
  }

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
          style={{ padding: collapsed ? '0 0.75rem' : '0 1.25rem' }}
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
            {navItems.map((item) => {
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
