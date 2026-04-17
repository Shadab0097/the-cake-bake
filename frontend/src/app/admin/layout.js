'use client';

import { useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminTopbar from '@/components/admin/AdminTopbar';
import './admin.css';

export default function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AdminGuard>
      {(user) => (
        <div className="admin-root">
          <AdminSidebar
            collapsed={collapsed}
            onToggle={() => setCollapsed(!collapsed)}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
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
              onMenuToggle={() => setMobileOpen(!mobileOpen)}
            />

            <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
              {children}
            </main>
          </div>



        </div>
      )}
    </AdminGuard>
  );
}
