'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApiClient from '@/lib/adminApiClient';
import { clearAdminAccessToken } from '@/lib/authToken.mjs';
import { isAdminRole } from '@/lib/adminAccess.mjs';

export default function AdminGuard({ children }) {
  const [state, setState] = useState({ loading: true, user: null });
  const router = useRouter();

  useEffect(() => {
    adminApiClient.get('/users/me')
      .then((res) => {
        const user = res.data.data;
        if (!isAdminRole(user.role)) {
          router.replace('/admin-login');
          return;
        }
        setState({ loading: false, user });
      })
      .catch(() => {
        clearAdminAccessToken();
        router.replace('/admin-login');
      });
  }, [router]);

  if (state.loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0B0E14'
      }}>
        <div className="admin-spinner" style={{
          width: 40, height: 40, border: '3px solid #2A3146',
          borderTopColor: '#D81B60', borderRadius: '50%',
          animation: 'adminSpin 0.6s linear infinite'
        }} />
      </div>
    );
  }

  return children(state.user);
}
