'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import adminApiClient from '@/lib/adminApiClient';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  // Check if already logged in as admin
  useEffect(() => {
    const token = localStorage.getItem('adminAccessToken');
    if (!token) { setChecking(false); return; }

    adminApiClient.get('/users/me')
      .then((res) => {
        const user = res.data.data;
        if (user.role === 'admin' || user.role === 'superadmin') {
          router.replace('/admin');
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await adminApiClient.post('/auth/login', { email, password });
      const { accessToken, refreshToken, user } = res.data.data;

      if (user.role !== 'admin' && user.role !== 'superadmin') {
        setError('Access denied. Admin credentials required.');
        setLoading(false);
        return;
      }

      localStorage.setItem('adminAccessToken', accessToken);
      localStorage.setItem('adminRefreshToken', refreshToken);
      router.replace('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={styles.page}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Animated gradient bg */}
      <div style={styles.bgGradient} />
      <div style={styles.bgGrid} />

      <div style={styles.container}>
        {/* Logo */}
        <div style={styles.logoBox}>
          <div style={styles.logoIcon}>CB</div>
          <div>
            <div style={styles.logoTitle}>Cake Bake</div>
            <div style={styles.logoSub}>Admin Dashboard</div>
          </div>
        </div>

        {/* Card */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h1 style={styles.heading}>Welcome back</h1>
            <p style={styles.subheading}>Sign in to your admin account</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {error && (
              <div style={styles.errorBox}>
                <span style={{ fontSize: '0.875rem' }}>⚠</span>
                {error}
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label} htmlFor="admin-email">Email Address</label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cakebake.in"
                required
                style={styles.input}
                autoComplete="email"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={styles.input}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ ...styles.spinner, width: 18, height: 18, borderWidth: 2 }} />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p style={styles.footer}>
          © {new Date().getFullYear()} Cake Bake. All rights reserved.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0B0E14',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', 'Montserrat', system-ui, sans-serif",
  },
  bgGradient: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at 30% 20%, rgba(216,27,96,0.12) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(240,98,146,0.08) 0%, transparent 50%)',
    pointerEvents: 'none',
  },
  bgGrid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
    backgroundSize: '64px 64px',
    pointerEvents: 'none',
  },
  container: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: 420,
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2rem',
  },
  logoBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #D81B60, #F06292)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    color: '#fff',
    fontSize: '1.125rem',
    boxShadow: '0 8px 32px rgba(216,27,96,0.3)',
  },
  logoTitle: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#E8ECF4',
    letterSpacing: '-0.01em',
  },
  logoSub: {
    fontSize: '0.75rem',
    color: '#6B7280',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  card: {
    width: '100%',
    background: 'rgba(22, 27, 38, 0.8)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(42, 49, 70, 0.6)',
    borderRadius: '16px',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '2rem 2rem 0',
    textAlign: 'center',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#E8ECF4',
    margin: '0 0 0.375rem',
  },
  subheading: {
    fontSize: '0.875rem',
    color: '#6B7280',
    margin: 0,
  },
  form: {
    padding: '1.5rem 2rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#9BA4B5',
    marginBottom: '0.375rem',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.875rem',
    background: '#0B0E14',
    border: '1px solid #2A3146',
    borderRadius: '8px',
    color: '#E8ECF4',
    fontSize: '0.9375rem',
    outline: 'none',
    transition: 'border-color 200ms, box-shadow 200ms',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '8px',
    color: '#EF4444',
    fontSize: '0.875rem',
  },
  submitBtn: {
    width: '100%',
    padding: '0.75rem',
    background: 'linear-gradient(135deg, #D81B60, #F06292)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    transition: 'opacity 200ms, transform 100ms',
    boxShadow: '0 4px 16px rgba(216,27,96,0.3)',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #2A3146',
    borderTopColor: '#D81B60',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
  footer: {
    fontSize: '0.75rem',
    color: '#4B5563',
    margin: 0,
  },
};
