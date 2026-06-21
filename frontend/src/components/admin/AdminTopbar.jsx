'use client';

import { useRouter } from 'next/navigation';
import { HiOutlineBars3, HiOutlineArrowRightStartOnRectangle } from 'react-icons/hi2';
import adminApiClient from '@/lib/adminApiClient';
import { clearAdminAccessToken } from '@/lib/authToken.mjs';
import { setAdminFlash } from '@/lib/adminFlash.mjs';
import { ROLE_LABELS } from '@/lib/adminAccess.mjs';

export default function AdminTopbar({ user, title = 'Admin', subtitle = '', onMenuToggle }) {
  const router = useRouter();
  const environment = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';

  const handleLogout = async () => {
    try {
      await adminApiClient.post('/auth/logout', { scope: 'admin' });
    } catch {
      // Client cleanup below still removes local access if the server session already expired.
    } finally {
      clearAdminAccessToken();
      setAdminFlash('Logged out successfully', 'success');
      router.replace('/admin-login');
    }
  };

  return (
    <header className="admin-shell-topbar">
      {/* Left */}
      <div className="admin-topbar-left">
        <button
          onClick={onMenuToggle}
          className="admin-btn admin-btn-ghost admin-btn-icon admin-menu-toggle"
          id="admin-menu-btn"
          aria-label="Open admin navigation"
        >
          <HiOutlineBars3 style={{ fontSize: '1.25rem' }} />
        </button>
        <div className="admin-topbar-heading">
          <div className="admin-topbar-title">{title}</div>
          {subtitle && <div className="admin-topbar-subtitle">{subtitle}</div>}
        </div>
      </div>

      {/* Right */}
      <div className="admin-topbar-right">
        <span className="admin-env-badge">{environment}</span>
        {user?.isBranchScoped && (
          <span
            className="admin-env-badge"
            style={{ background: 'rgba(216,27,96,0.12)', color: '#F48FB1', borderColor: 'rgba(216,27,96,0.3)' }}
            title="You are scoped to these branches"
          >
            {(user.branches || []).map((b) => b.name).join(', ') || `${user.branchIds?.length || 0} branch`}
          </span>
        )}
        {user && (
          <div className="admin-user-chip">
            <div className="admin-user-meta">
              <div className="admin-user-name">{user.name || 'Admin'}</div>
              <div className={`admin-user-role${user.role === 'superadmin' ? ' admin-user-role-super' : ''}`}>
                {ROLE_LABELS[user.role] || user.role}
              </div>
            </div>
            <div className="admin-avatar">
              {user.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="admin-btn admin-btn-ghost admin-btn-sm"
          title="Logout"
          aria-label="Logout from admin"
          style={{ color: 'var(--admin-danger)' }}
        >
          <HiOutlineArrowRightStartOnRectangle style={{ fontSize: '1.125rem' }} />
          <span className="admin-logout-label">Logout</span>
        </button>
      </div>


    </header>
  );
}
