'use client';

import { useRouter } from 'next/navigation';
import { HiOutlineBars3, HiOutlineArrowRightStartOnRectangle } from 'react-icons/hi2';

export default function AdminTopbar({ user, onMenuToggle }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('adminAccessToken');
    localStorage.removeItem('adminRefreshToken');
    router.replace('/admin-login');
  };

  return (
    <header style={{
      height: 'var(--admin-topbar-h)',
      background: 'var(--admin-surface)',
      borderBottom: '1px solid var(--admin-border-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 30,
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onMenuToggle}
          className="admin-btn admin-btn-ghost admin-btn-icon admin-menu-toggle"
          id="admin-menu-btn"
        >
          <HiOutlineBars3 style={{ fontSize: '1.25rem' }} />
        </button>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--admin-text)' }}>
                {user.name}
              </div>
              <div style={{
                fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                color: user.role === 'superadmin' ? 'var(--admin-accent-hover)' : 'var(--admin-text-muted)',
                fontWeight: 600,
              }}>
                {user.role}
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #D81B60, #F06292)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, color: '#fff', fontSize: '0.8125rem',
            }}>
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="admin-btn admin-btn-ghost admin-btn-sm"
          title="Logout"
          style={{ color: 'var(--admin-danger)' }}
        >
          <HiOutlineArrowRightStartOnRectangle style={{ fontSize: '1.125rem' }} />
          <span className="admin-logout-label">Logout</span>
        </button>
      </div>


    </header>
  );
}
