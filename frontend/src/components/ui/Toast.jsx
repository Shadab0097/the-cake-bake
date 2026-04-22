'use client';

import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiAlertCircle, FiInfo, FiAlertTriangle } from 'react-icons/fi';
import Link from 'next/link';
import { removeToast } from '@/store/slices/toastSlice';

const ICONS = {
  success: FiCheck,
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

const COLORS = {
  success: 'bg-success/10 text-success border-success/20',
  error: 'bg-error/10 text-error border-error/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  info: 'bg-info/10 text-info border-info/20',
};

const ICON_BG = {
  success: 'bg-success',
  error: 'bg-error',
  warning: 'bg-warning',
  info: 'bg-info',
};

function ToastItem({ toast }) {
  const dispatch = useDispatch();
  const Icon = ICONS[toast.type] || FiInfo;

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(removeToast(toast.id));
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id, toast.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[280px] max-w-[400px] bg-white`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ICON_BG[toast.type]} text-white`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark font-medium">{toast.message}</p>
        {toast.link && toast.linkLabel && (
          <Link
            href={toast.link}
            onClick={() => dispatch(removeToast(toast.id))}
            className="text-xs font-semibold text-pink-deep underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {toast.linkLabel} →
          </Link>
        )}
      </div>
      <button
        onClick={() => dispatch(removeToast(toast.id))}
        className="p-1 rounded-full hover:bg-surface-container-high transition-colors shrink-0"
      >
        <FiX className="w-3.5 h-3.5 text-outline" />
      </button>
    </motion.div>
  );
}

export default function Toast() {
  const { toasts } = useSelector((s) => s.toast);

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
