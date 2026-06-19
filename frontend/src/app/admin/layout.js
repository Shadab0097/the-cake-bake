'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';
import { AdminToast, useAdminToast } from '@/components/admin/AdminUI';
import { consumeAdminFlash } from '@/lib/adminFlash.mjs';
import './admin.css';

const PAGE_TITLES = [
  { path: '/admin/sales', title: 'Sales', subtitle: 'Revenue, products, and locations by date range' },
  { path: '/admin/profit', title: 'Profit & Loss', subtitle: 'Margins after cost, discounts, and gateway fees' },
  { path: '/admin/costs', title: 'Cost Prices', subtitle: 'Set make/buy cost per variant to power profit reporting' },
  { path: '/admin/gst', title: 'GST Summary', subtitle: 'Taxable value and tax collected by period' },
  { path: '/admin/settings', title: 'Settings', subtitle: 'Company details, scheduled reports, and admin roles' },
  { path: '/admin/orders', title: 'Orders', subtitle: 'Track fulfillment, payments, and delivery status' },
  { path: '/admin/refunds', title: 'Refunds', subtitle: 'Review approvals, provider processing, and failures' },
  { path: '/admin/products', title: 'Products', subtitle: 'Manage catalog, variants, stock, and pricing' },
  { path: '/admin/categories', title: 'Categories', subtitle: 'Organize storefront navigation and product groups' },
  { path: '/admin/coupons', title: 'Coupons', subtitle: 'Control discounts, usage limits, and campaigns' },
  { path: '/admin/delivery', title: 'Delivery', subtitle: 'Configure slots, zones, and fulfillment coverage' },
  { path: '/admin/addons', title: 'Add-Ons', subtitle: 'Manage optional extras customers can add to orders' },
  { path: '/admin/insights', title: 'Customer Insights', subtitle: 'Retention, lifetime value, segments, and acquisition' },
  { path: '/admin/customers', title: 'Customers', subtitle: 'Review customer activity and loyalty adjustments' },
  { path: '/admin/reviews', title: 'Reviews', subtitle: 'Moderate public feedback and product ratings' },
  { path: '/admin/inquiries', title: 'Inquiries', subtitle: 'Handle custom and corporate cake requests' },
  { path: '/admin/banners', title: 'Banners', subtitle: 'Control homepage and campaign visual placements' },
  { path: '/admin/notifications', title: 'Notifications', subtitle: 'Monitor sends, failures, and operational alerts' },
  { path: '/admin/logs', title: 'System Logs', subtitle: 'Trace errors, alerts, and admin activity' },
  { path: '/admin/chatbot', title: 'Bot', subtitle: 'Manage support automation rules and chat logs' },
];

function getAdminPageMeta(pathname) {
  if (pathname === '/admin') {
    return {
      title: 'Dashboard',
      subtitle: 'Revenue, orders, alerts, and operational health',
    };
  }

  return PAGE_TITLES.find((item) => pathname.startsWith(item.path)) || {
    title: 'Admin',
    subtitle: 'Manage The Cake Bake operations',
  };
}

export default function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const pageMeta = getAdminPageMeta(pathname);
  const { toast, showToast, hideToast } = useAdminToast();

  // Show a one-time flash left by another page (e.g. "Logged in successfully"
  // set just before the login redirect landed us here).
  useEffect(() => {
    const flash = consumeAdminFlash();
    if (flash) showToast(flash.message, flash.type);
  }, [showToast]);

  return (
    <AdminGuard>
      {(user) => (
        <div className="admin-root">
          <AdminSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
            role={user.role}
          />

          <div style={{
            marginLeft: collapsed ? 'var(--admin-sidebar-collapsed)' : 'var(--admin-sidebar-w)',
            transition: 'margin-left var(--admin-transition)',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
          }}
            className="admin-main-area"
          >
            <AdminTopbar
              user={user}
              title={pageMeta.title}
              subtitle={pageMeta.subtitle}
              onMenuToggle={() => setMobileOpen(!mobileOpen)}
            />

            <main className="admin-content">
              {children}
            </main>
          </div>

          <AdminToast {...toast} onClose={hideToast} />

        </div>
      )}
    </AdminGuard>
  );
}
