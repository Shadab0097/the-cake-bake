'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiChevronRight, FiGift, FiShoppingBag } from 'react-icons/fi';
import { setItemAddOns, clearPendingAddOns } from '@/store/slices/cartSlice';
import { formatPrice, getOptimizedImageUrl } from '@/lib/utils';
import api from '@/lib/api';

const CATEGORY_META = {
  candles:     { icon: '🕯️', label: 'Candles' },
  flowers:     { icon: '🌸', label: 'Flowers' },
  cards:       { icon: '💌', label: 'Cards' },
  balloons:    { icon: '🎈', label: 'Balloons' },
  gifts:       { icon: '🎁', label: 'Gifts' },
  decorations: { icon: '✨', label: 'Decorations' },
};

export default function AddOnModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { items, guestItems, pendingAddOns } = useSelector((s) => s.cart);
  const { isAuthenticated }                  = useSelector((s) => s.auth);

  const cartItems = isAuthenticated ? items : guestItems;

  const [addons, setAddons]               = useState([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [selections, setSelections]       = useState({});   // { [itemKey]: { [addonId]: addon } }
  const [activeItem, setActiveItem]       = useState(0);

  /* ── Fetch add-ons when modal opens ── */
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadAddOns = async () => {
      setLoadingAddons(true);

      const init = {};
      cartItems.forEach((item) => {
        const key = isAuthenticated ? item._id : item.localId;
        if (pendingAddOns[key]) {
          init[key] = {};
          pendingAddOns[key].forEach((a) => { init[key][a._id] = a; });
        }
      });

      try {
        const res = await api.get('/addons');
        if (cancelled) return;
        const list = res.data?.data || [];
        setAddons(list);
        if (list.length > 0) setActiveCategory(list[0].category);
      } catch {
        if (!cancelled) setAddons([]);
      } finally {
        if (!cancelled) {
          setSelections(init);
          setActiveItem(0);
          setLoadingAddons(false);
        }
      }
    };

    Promise.resolve().then(loadAddOns);

    return () => { cancelled = true; };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const categories     = [...new Set(addons.map((a) => a.category))];
  const filteredAddons = addons.filter((a) => a.category === activeCategory);

  const getItemKey  = (item) => isAuthenticated ? item._id : item.localId;
  const getItemName = (item) => isAuthenticated ? (item.snapshotName || item.product?.name) : item.productName;

  const toggleAddon = (item, addon) => {
    const key = getItemKey(item);
    setSelections((prev) => {
      const cur = { ...prev[key] };
      if (cur[addon._id]) delete cur[addon._id];
      else cur[addon._id] = addon;
      return { ...prev, [key]: cur };
    });
  };

  const isSelected   = (item, addon) => !!(selections[getItemKey(item)]?.[addon._id]);
  const currentItem  = cartItems[activeItem];

  const totalAddonCost = Object.values(selections).reduce(
    (sum, s) => sum + Object.values(s).reduce((a, b) => a + (b.price || 0), 0), 0,
  );

  const handleConfirm = () => {
    cartItems.forEach((item) => {
      const key = getItemKey(item);
      dispatch(setItemAddOns({ itemKey: key, addons: Object.values(selections[key] || {}) }));
    });
    onClose();
    router.push('/checkout');
  };

  const handleSkip = () => {
    dispatch(clearPendingAddOns());
    onClose();
    router.push('/checkout');
  };

  /* ── Count badges per item ── */
  const badgeCount = (item) => Object.keys(selections[getItemKey(item)] || {}).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSkip}
            className="fixed inset-0 bg-on-surface/50 z-[60] backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 40 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-[61] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full sm:max-w-2xl bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-[0_24px_64px_rgba(26,28,26,0.28)] flex flex-col overflow-hidden"
              style={{ maxHeight: 'min(92vh, 720px)' }}
            >
              {/* Gradient accent bar */}
              <div className="h-1 w-full gradient-primary shrink-0" />

              {/* Mobile drag handle */}
              <div className="sm:hidden flex justify-center pt-3 shrink-0">
                <span className="h-1.5 w-11 rounded-full bg-outline-variant/60" />
              </div>

              {/* ─── Header ─── */}
              <div className="px-5 sm:px-6 pt-4 sm:pt-6 pb-4 shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
                      <FiGift className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-dark truncate">Make it Extra Special</h2>
                      <p className="text-xs text-outline mt-0.5">Add a finishing touch to your celebration</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSkip}
                    aria-label="Close"
                    className="p-2 -mr-1 -mt-1 rounded-xl hover:bg-surface-container transition-colors shrink-0"
                  >
                    <FiX className="w-5 h-5 text-outline" />
                  </button>
                </div>

                {/* Cart-item switcher (only when > 1 item) */}
                {cartItems.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
                    {cartItems.map((item, idx) => {
                      const count = badgeCount(item);
                      return (
                        <button
                          key={getItemKey(item)}
                          onClick={() => setActiveItem(idx)}
                          className={`relative shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all border-2 ${
                            activeItem === idx
                              ? 'border-pink-deep bg-pink-light/30 text-pink-deep'
                              : 'border-outline-variant/40 text-on-surface-variant hover:border-outline-variant'
                          }`}
                        >
                          {getItemName(item) || `Item ${idx + 1}`}
                          {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pink-deep text-white text-[10px] font-bold flex items-center justify-center shadow">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─── Currently Configuring ─── */}
              {currentItem && (
                <div className="mx-5 sm:mx-6 mb-3 flex items-center gap-2.5 px-4 py-2.5 bg-surface-container-low rounded-xl border border-outline-variant/20 shrink-0">
                  <FiShoppingBag className="w-4 h-4 text-pink-deep shrink-0" />
                  <span className="text-xs font-medium text-on-surface-variant line-clamp-1">
                    Adding extras for: <span className="font-bold text-dark">{getItemName(currentItem)}</span>
                  </span>
                </div>
              )}

              {/* ─── Category Pills ─── */}
              {categories.length > 0 && (
                <div className="flex gap-2 px-5 sm:px-6 pb-3 overflow-x-auto no-scrollbar shrink-0">
                  {categories.map((cat) => {
                    const meta = CATEGORY_META[cat] || { icon: '📦', label: cat };
                    const active = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                          active
                            ? 'bg-pink-deep text-white shadow-md shadow-pink-deep/30'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="text-sm">{meta.icon}</span>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ─── Add-ons Grid ─── */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 border-t border-outline-variant/15">
                {loadingAddons ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-32 rounded-2xl bg-surface-container-low animate-pulse" />
                    ))}
                  </div>
                ) : filteredAddons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-outline">
                    <span className="text-4xl mb-3">{CATEGORY_META[activeCategory]?.icon || '📦'}</span>
                    <p className="text-sm font-medium">No {activeCategory} add-ons available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredAddons.map((addon) => {
                      const selected = currentItem && isSelected(currentItem, addon);
                      const addonImage = getOptimizedImageUrl(addon.image, 'addon');
                      return (
                        <motion.button
                          key={addon._id}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => currentItem && toggleAddon(currentItem, addon)}
                          className={`relative text-left rounded-2xl border-2 transition-all overflow-hidden group ${
                            selected
                              ? 'border-pink-deep bg-pink-light/20 shadow-md shadow-pink-deep/10'
                              : 'border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant hover:shadow-sm'
                          }`}
                        >
                          {/* Top accent */}
                          <div className={`h-1 w-full transition-colors ${selected ? 'bg-pink-deep' : 'bg-transparent'}`} />

                          <div className="p-3">
                            {/* Selected checkmark */}
                            <AnimatePresence>
                              {selected && (
                                <motion.div
                                  initial={{ scale: 0, rotate: -90 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  exit={{ scale: 0, rotate: 90 }}
                                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-pink-deep flex items-center justify-center shadow-lg shadow-pink-deep/30"
                                >
                                  <FiCheck className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Icon / Image */}
                            <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center mb-2.5 text-2xl group-hover:scale-105 transition-transform overflow-hidden">
                              {addonImage ? (
                                <Image
                                  src={addonImage}
                                  alt={addon.name}
                                  width={48}
                                  height={48}
                                  className="object-cover rounded-xl"
                                />
                              ) : (
                                CATEGORY_META[addon.category]?.icon || '📦'
                              )}
                            </div>

                            <p className="text-sm font-semibold text-dark line-clamp-2 leading-tight mb-1.5">
                              {addon.name}
                            </p>

                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-pink-deep">
                                +{formatPrice(addon.price)}
                              </span>
                              {!selected && (
                                <span className="text-[10px] font-semibold text-outline uppercase tracking-wide">
                                  Add
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─── Footer ─── */}
              <div
                className="px-5 sm:px-6 py-4 sm:py-5 border-t border-outline-variant/15 bg-surface-container-low/60 shrink-0"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                {totalAddonCost > 0 && (
                  <div className="flex items-center justify-between mb-4 px-4 py-2.5 bg-success/10 rounded-xl border border-success/20">
                    <span className="text-xs font-semibold text-success">Add-ons total</span>
                    <span className="text-sm font-bold text-success">+{formatPrice(totalAddonCost)}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleSkip}
                    className="flex-1 py-3.5 rounded-xl border-2 border-outline-variant/40 text-on-surface-variant text-sm font-semibold hover:border-outline-variant hover:bg-surface-container-lowest transition-all"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-xl gradient-primary text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/25"
                  >
                    {totalAddonCost > 0 ? `Add to Order · ${formatPrice(totalAddonCost)}` : 'Continue to Checkout'}
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
