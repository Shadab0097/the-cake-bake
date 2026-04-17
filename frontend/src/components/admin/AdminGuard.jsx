'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function AdminGuard({ children }) {
  const [state, setState] = useState({ loading: true, user: null });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/admin-login');
      return;
    }

    api.get('/users/me')
      .then((res) => {
        const user = res.data.data;
        if (user.role !== 'admin' && user.role !== 'superadmin') {
          router.replace('/admin-login');
          return;
        }
        setState({ loading: false, user });
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
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
