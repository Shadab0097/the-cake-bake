'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiChevronRight, FiGift, FiShoppingBag } from 'react-icons/fi';
import { setItemAddOns, clearPendingAddOns } from '@/store/slices/cartSlice';
import { formatPrice } from '@/lib/utils';
import api from '@/lib/api';

const CATEGORY_META = {
  candles:     { icon: '🕯️', label: 'Candles',     color: '#FFB74D' },
  flowers:     { icon: '🌸', label: 'Flowers',     color: '#F06292' },
  cards:       { icon: '💌', label: 'Cards',       color: '#BA68C8' },
  balloons:    { icon: '🎈', label: 'Balloons',    color: '#4FC3F7' },
  gifts:       { icon: '🎁', label: 'Gifts',       color: '#81C784' },
  decorations: { icon: '✨', label: 'Decorations', color: '#FFD54F' },
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
    setLoadingAddons(true);
    api.get('/addons')
      .then((res) => {
        const list = res.data?.data || [];
        setAddons(list);
        if (list.length > 0) setActiveCategory(list[0].category);
      })
      .catch(() => {})
      .finally(() => setLoadingAddons(false));

    // Seed from existing pendingAddOns
    const init = {};
    cartItems.forEach((item) => {
      const key = isAuthenticated ? item._id : item.localId;
      if (pendingAddOns[key]) {
        init[key] = {};
        pendingAddOns[key].forEach((a) => { init[key][a._id] = a; });
      }
    });
    setSelections(init);
    setActiveItem(0);
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
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: 'min(88vh, 700px)' }}
            >
              {/* ─── Header ─── */}
              <div className="relative px-6 pt-6 pb-4">
                {/* Gradient accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 rounded-t-3xl" />

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/25">
                      <FiGift className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Make it Extra Special</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Add extras to your cake order</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSkip}
                    className="p-2 -mr-1 -mt-1 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <FiX className="w-5 h-5 text-gray-400" />
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
                              ? 'border-pink-500 bg-pink-50 text-pink-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {getItemName(item) || `Item ${idx + 1}`}
                          {count > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
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
                <div className="mx-6 mb-3 flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <FiShoppingBag className="w-4 h-4 text-pink-500 shrink-0" />
                  <span className="text-xs font-medium text-gray-700 line-clamp-1">
                    Adding extras for: <span className="font-bold text-gray-900">{getItemName(currentItem)}</span>
                  </span>
                </div>
              )}

              {/* ─── Category Pills ─── */}
              {categories.length > 0 && (
                <div className="flex gap-2 px-6 pb-3 overflow-x-auto no-scrollbar">
                  {categories.map((cat) => {
                    const meta = CATEGORY_META[cat] || { icon: '📦', label: cat, color: '#9E9E9E' };
                    const active = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                          active
                            ? 'text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={active ? { backgroundColor: meta.color, boxShadow: `0 4px 12px ${meta.color}40` } : {}}
                      >
                        <span className="text-sm">{meta.icon}</span>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ─── Add-ons Grid ─── */}
              <div className="flex-1 overflow-y-auto px-6 py-4 border-t border-gray-100">
                {loadingAddons ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : filteredAddons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <span className="text-4xl mb-3">{CATEGORY_META[activeCategory]?.icon || '📦'}</span>
                    <p className="text-sm font-medium">No {activeCategory} add-ons available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredAddons.map((addon) => {
                      const selected = currentItem && isSelected(currentItem, addon);
                      const meta = CATEGORY_META[addon.category] || { color: '#9E9E9E' };
                      return (
                        <motion.button
                          key={addon._id}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => currentItem && toggleAddon(currentItem, addon)}
                          className={`relative text-left rounded-2xl border-2 transition-all overflow-hidden group ${
                            selected
                              ? 'border-pink-500 bg-pink-50 shadow-md shadow-pink-500/10'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                          }`}
                        >
                          {/* Top accent */}
                          <div
                            className="h-1 w-full transition-opacity"
                            style={{ backgroundColor: meta.color, opacity: selected ? 1 : 0.3 }}
                          />

                          <div className="p-3">
                            {/* Selected checkmark */}
                            <AnimatePresence>
                              {selected && (
                                <motion.div
                                  initial={{ scale: 0, rotate: -90 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  exit={{ scale: 0, rotate: 90 }}
                                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center shadow-lg shadow-pink-500/30"
                                >
                                  <FiCheck className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Icon / Image */}
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-2.5 text-2xl group-hover:scale-105 transition-transform">
                              {addon.image ? (
                                <Image
                                  src={addon.image.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000'}${addon.image}` : addon.image}
                                  alt={addon.name}
                                  width={48}
                                  height={48}
                                  className="object-cover rounded-xl"
                                  unoptimized
                                />
                              ) : (
                                CATEGORY_META[addon.category]?.icon || '📦'
                              )}
                            </div>

                            <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight mb-1.5">
                              {addon.name}
                            </p>

                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-pink-600">
                                +{formatPrice(addon.price)}
                              </span>
                              {!selected && (
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
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
              <div className="px-6 py-5 border-t border-gray-100 bg-gray-50/50">
                {totalAddonCost > 0 && (
                  <div className="flex items-center justify-between mb-4 px-4 py-2.5 bg-green-50 rounded-xl border border-green-100">
                    <span className="text-xs font-semibold text-green-700">Add-ons total</span>
                    <span className="text-sm font-bold text-green-700">+{formatPrice(totalAddonCost)}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleSkip}
                    className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:border-gray-300 hover:bg-white transition-all"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-pink-500/25"
                    style={{ background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)' }}
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
