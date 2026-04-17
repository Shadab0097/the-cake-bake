'use client';

import { useState, useEffect, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiUser, FiMail, FiPhone, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { register, clearError } from '@/store/slices/authSlice';
import { clearGuestCartAndStorage } from '@/store/slices/cartSlice';
import { addToast } from '@/store/slices/toastSlice';

function RegisterForm() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, error } = useSelector((s) => s.auth);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(clearGuestCartAndStorage());
      const redirectTo = searchParams.get('next') || '/';
      router.push(redirectTo);
    }
  }, [isAuthenticated, router, searchParams, dispatch]);

  useEffect(() => {
    if (error) {
      dispatch(addToast({ message: error, type: 'error' }));
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      dispatch(addToast({ message: 'Passwords do not match', type: 'error' }));
      return;
    }
    dispatch(register({ name: form.name, email: form.email, phone: form.phone, password: form.password }));
  };

  return (
    <div className="bg-white rounded-2xl p-8 shadow-card">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-dark mb-1.5 block">Full Name</label>
          <div className="relative">
            <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Your full name"
              className="w-full pl-10 pr-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-surface-container-lowest placeholder:text-outline"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-dark mb-1.5 block">Email</label>
          <div className="relative">
            <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-surface-container-lowest placeholder:text-outline"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-dark mb-1.5 block">Phone</label>
          <div className="relative">
            <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              required
              placeholder="+91 98765 43210"
              className="w-full pl-10 pr-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-surface-container-lowest placeholder:text-outline"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-dark mb-1.5 block">Password</label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              name="password"
              type={showPass ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
              placeholder="Min 8 characters"
              className="w-full pl-10 pr-10 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-surface-container-lowest placeholder:text-outline"
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline">
              {showPass ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-dark mb-1.5 block">Confirm Password</label>
          <div className="relative">
            <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
            <input
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Re-enter password"
              className="w-full pl-10 pr-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-surface-container-lowest placeholder:text-outline"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-outline-variant/20" />
        <span className="text-xs text-outline">or</span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>

      <p className="text-center text-sm text-on-surface-variant">
        Already have an account?{' '}
        <Link href="/login" className="text-pink-deep font-semibold hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
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
          <p className="text-sm text-outline mt-2">Create your account and start ordering</p>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-2xl p-8 shadow-card flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-pink-deep border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <RegisterForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
