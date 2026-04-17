'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/toastSlice';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch {
      // Show success anyway for security (don't reveal if email exists)
      setSubmitted(true);
    }
    setLoading(false);
  };

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
          <p className="text-sm text-outline mt-2">Reset your password</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-card">
          {submitted ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <FiMail className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-lg font-bold text-dark mb-2">Check Your Email</h2>
              <p className="text-sm text-outline mb-6">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
              </p>
              <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-pink-deep hover:underline">
                <FiArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-on-surface-variant mb-5 text-center">
                Enter your registered email and we&apos;ll send you a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-dark mb-1.5 block">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep placeholder:text-outline"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

                <div className="text-center">
                  <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-outline hover:text-pink-deep transition-colors">
                    <FiArrowLeft className="w-4 h-4" />
                    Back to Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
