'use client';

import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FiMapPin, FiChevronDown, FiCheck, FiClock, FiX } from 'react-icons/fi';
import { checkPincode, clearDeliveryLocationState } from '@/store/slices/deliverySlice';
import { closeDeliveryPopover, toggleDeliveryPopover } from '@/store/slices/uiSlice';
import { formatPrice } from '@/lib/utils';

const PIN_RE = /^\d{6}$/;

export default function DeliveryLocationWidget({ variant = 'desktop' }) {
  const dispatch = useDispatch();
  const { pincode, city, status } = useSelector((s) => s.delivery);
  const isOpen = useSelector((s) => s.ui.isDeliveryPopoverOpen);
  const wrapRef = useRef(null);

  // Close on outside click + Escape (no local state — dispatch only).
  useEffect(() => {
    if (!isOpen) return undefined;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        dispatch(closeDeliveryPopover());
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') dispatch(closeDeliveryPopover());
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, dispatch]);

  const hasLocation = !!pincode;
  const triggerLabel = !hasLocation
    ? 'Select location'
    : status === 'live'
      ? (city || pincode)
      : pincode;

  const dotClass =
    status === 'live' ? 'bg-success'
      : status === 'coming_soon' ? 'bg-warning'
        : status === 'unavailable' ? 'bg-error'
          : 'bg-outline';

  return (
    <div className={variant === 'desktop' ? 'relative' : ''} ref={wrapRef}>
      <button
        type="button"
        onClick={() => dispatch(toggleDeliveryPopover())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Set delivery location"
        className={
          variant === 'desktop'
            ? 'flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-outline-variant/40 hover:border-pink-deep/50 hover:bg-pink-light/10 transition-colors max-w-[240px]'
            : 'flex items-center p-2 rounded-full hover:bg-pink/20 transition-colors text-dark'
        }
      >
        <span className="relative shrink-0">
          <FiMapPin className={`text-pink-deep ${variant === 'desktop' ? 'w-5 h-5' : 'w-6 h-6'}`} />
          {hasLocation && (
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-pink-light ${dotClass}`} />
          )}
        </span>

        {variant === 'desktop' && (
          <>
            <span className="flex flex-col items-start leading-tight min-w-0">
              <span className="text-[11px] uppercase tracking-wide text-outline">Deliver to</span>
              <span className="text-sm font-semibold text-dark truncate max-w-[150px]">
                {triggerLabel}
              </span>
            </span>
            <FiChevronDown className={`w-4 h-4 text-outline shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      <AnimatePresence>
        {isOpen && <LocationPopover variant={variant} />}
      </AnimatePresence>
    </div>
  );
}

// Mounts fresh each time the popover opens, so the input seeds itself from the
// saved pincode via useState initializer (no setState-in-effect).
function LocationPopover({ variant }) {
  const dispatch = useDispatch();
  const reduceMotion = useReducedMotion();
  const { pincode, city, status, message, deliveryCharge, sameDayAvailable, isChecking, error } =
    useSelector((s) => s.delivery);

  const [input, setInput] = useState(pincode || '');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const valid = PIN_RE.test(input);

  const submit = (e) => {
    e?.preventDefault();
    setTouched(true);
    if (valid) dispatch(checkPincode(input));
  };

  const showResult = !isChecking && pincode && input === pincode && status;

  return (
    <motion.div
      role="dialog"
      aria-label="Delivery location"
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className={`absolute top-full mt-2 bg-white rounded-2xl shadow-float border border-outline-variant/10 p-4 z-50 ${
        variant === 'mobile'
          ? 'inset-x-3 mx-auto max-w-sm'
          : 'left-0 w-[300px] max-w-[calc(100vw-2rem)]'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-dark">Where should we deliver?</h3>
        <button
          type="button"
          onClick={() => dispatch(closeDeliveryPopover())}
          className="p-1 rounded-full hover:bg-surface-container-low text-outline"
          aria-label="Close"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-outline mb-3">Enter your 6-digit pincode to check availability.</p>

      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          inputMode="numeric"
          maxLength={6}
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="e.g. 143001"
          aria-label="Pincode"
          className="flex-1 px-3 py-2 text-sm border border-outline-variant/40 rounded-xl focus:outline-none focus:border-pink-deep"
        />
        <button
          type="submit"
          disabled={!valid || isChecking}
          className="px-4 py-2 rounded-xl gradient-primary text-white text-sm font-semibold disabled:opacity-50 transition-opacity"
        >
          {isChecking ? '…' : 'Check'}
        </button>
      </form>

      {touched && !valid && (
        <p className="text-xs text-error mt-2">Enter a valid 6-digit pincode.</p>
      )}
      {error && <p className="text-xs text-error mt-2">{error}</p>}

      {showResult && (
        <div className="mt-3">
          {status === 'live' ? (
            <div className="rounded-xl bg-success-light p-3">
              <div className="flex items-center gap-2 text-success font-semibold text-sm">
                <FiCheck className="w-4 h-4" /> Delivering to {city}
              </div>
              <div className="mt-1.5 space-y-0.5 text-xs text-on-surface-variant">
                <p>Delivery: {deliveryCharge > 0 ? formatPrice(deliveryCharge) : 'Free'}</p>
                {sameDayAvailable && (
                  <p className="flex items-center gap-1 text-success">
                    <FiClock className="w-3 h-3" /> Same-day delivery available
                  </p>
                )}
              </div>
            </div>
          ) : status === 'coming_soon' ? (
            <div className="rounded-xl bg-warning-light p-3 text-xs text-on-surface-variant">
              <p className="font-semibold text-warning mb-0.5">Launching soon{city ? ` in ${city}` : ''}</p>
              <p>You can browse cakes now — we’ll be delivering here shortly.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-error-container/40 p-3 text-xs text-on-surface-variant">
              <p className="font-semibold text-error mb-0.5">Not available yet</p>
              <p>{message || `We don’t deliver to ${pincode} yet.`} You can still browse our cakes.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              dispatch(clearDeliveryLocationState());
              setInput('');
              dispatch(closeDeliveryPopover());
            }}
            className="mt-2 text-xs text-pink-deep font-medium hover:underline"
          >
            Clear location
          </button>
        </div>
      )}
    </motion.div>
  );
}
