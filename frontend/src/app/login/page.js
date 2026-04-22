'use client';

import { useState, useEffect, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { login, clearError } from '@/store/slices/authSlice';
import { mergeGuestCartToServer } from '@/store/slices/cartSlice';
import { addToast } from '@/store/slices/toastSlice';

function LoginForm() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, error } = useSelector((s) => s.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      // Merge any guest cart items into the server cart, then redirect
      await dispatch(mergeGuestCartToServer());
      const redirectTo = searchParams.get('next') || '/';
      router.push(redirectTo);
    })();
  }, [isAuthenticated, router, searchParams, dispatch]);

  useEffect(() => {
    if (error) {
      dispatch(addToast({ message: error, type: 'error' }));
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-card">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-sm font-medium text-dark mb-1.5 block">
            Email Address
          </label>
          <div className="relative">
            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-surface-container-lowest placeholder:text-outline"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-dark mb-1.5 block">
            Password
          </label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-surface-container-lowest placeholder:text-outline"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-dark"
            >
              {showPass ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-pink-deep hover:underline font-medium">
            Forgot Password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Login'
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-outline-variant/20" />
        <span className="text-xs text-outline">or</span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>

      <p className="text-center text-sm text-on-surface-variant">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-pink-deep font-semibold hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-script text-pink-deep">Cake Bake</h1>
          </Link>
          <p className="text-sm text-outline mt-2">Welcome back! Login to your account</p>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-2xl p-8 shadow-card flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-pink-deep border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
