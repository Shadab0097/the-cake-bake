'use client';

import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUser, FiMail, FiPhone, FiMapPin, FiCalendar,
  FiCreditCard, FiCheck, FiArrowLeft, FiArrowRight, FiLock, FiTag, FiChevronDown,
} from 'react-icons/fi';
import AppShell from '@/components/layout/AppShell';
import { formatPrice } from '@/lib/utils';
import { addToast } from '@/store/slices/toastSlice';
import { clearGuestCart, resetCart, fetchCart, clearPendingAddOns, syncAddOnsToServerCart } from '@/store/slices/cartSlice';
import api from '@/lib/api';

const STEPS_GUEST  = ['How to Checkout', 'Your Details', 'Delivery', 'Payment'];
const STEPS_AUTHED = ['Delivery Address', 'Delivery Time', 'Payment'];

const DELIVERY_SLOTS = [
  '10:00 AM – 12:00 PM',
  '12:00 PM – 02:00 PM',
  '02:00 PM – 04:00 PM',
  '04:00 PM – 06:00 PM',
  '06:00 PM – 08:00 PM',
];

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function CheckoutPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated, isSessionLoading, user } = useSelector((s) => s.auth);
  const { items, guestItems, cart, pendingAddOns } = useSelector((s) => s.cart);

  const cartItems = isAuthenticated ? items : guestItems;

  // Step management — guests start at step 0 (choose method), authed at step 1
  const [step, setStep] = useState(isAuthenticated ? 1 : 0);
  const [checkoutMode, setCheckoutMode] = useState(isAuthenticated ? 'auth' : null); // 'auth' | 'guest'

  // Auto-advance when session restores mid-render (user was logged in but page refreshed)
  useEffect(() => {
    if (!isSessionLoading && isAuthenticated && step === 0) {
      setStep(1);
      setCheckoutMode('auth');
    }
  }, [isSessionLoading, isAuthenticated, step]);

  // Fetch server cart when authenticated user is present
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCart());
    }
  }, [isAuthenticated, dispatch]);

  // Guest details
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '', phone: '' });
  const [guestAddress, setGuestAddress] = useState({ line1: '', area: '', city: '', state: '', pincode: '' });

  // Delivery zones
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);

  // Coupon (auth only)
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discount, description }

  // Auth user
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    line1: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
  });
  const [showNewAddress, setShowNewAddress] = useState(false);

  // Fetch addresses function
  const fetchAddresses = async () => {
    try {
      const res = await api.get('/users/me/addresses');
      const list = res.data?.data || [];
      setAddresses(list);
      if (list.length > 0 && !selectedAddress) {
        setSelectedAddress(list[0]._id);
      }
    } catch { /* ignore */ }
  };

  // Fetch zones once
  useEffect(() => {
    api.get('/delivery/zones')
      .then((res) => setZones(res.data?.data || []))
      .catch(() => {});
  }, []);

  // Fetch addresses when user enters address step (step 1)
  useEffect(() => {
    if (step === 1 && checkoutMode === 'auth' && addresses.length === 0) {
      fetchAddresses();
    }
  }, [step, checkoutMode, addresses.length]);

  // Delivery
  const [deliveryDate, setDeliveryDate] = useState(getTomorrow());
  const [deliverySlot, setDeliverySlot] = useState(DELIVERY_SLOTS[0]);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [placing, setPlacing] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const orderInProgressRef = useRef(false);

  // Subtotals
  const subtotal = isAuthenticated
    ? cartItems.reduce((s, i) => s + (i.snapshotPrice || i.variant?.price || 0) * i.quantity, 0)
    : cartItems.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
  const couponDiscount = appliedCoupon?.discount || cart?.discount || 0;
  // Add-ons total across all pending selections
  const addonTotal = Object.values(pendingAddOns).reduce(
    (sum, list) => sum + list.reduce((s, a) => s + (a.price || 0), 0), 0
  );
  const deliveryCost = selectedZone
    ? (subtotal + addonTotal >= selectedZone.freeDeliveryAbove ? 0 : selectedZone.deliveryCharge)
    : (subtotal + addonTotal >= 49900 ? 0 : 4900);
  const total = subtotal + addonTotal - couponDiscount + deliveryCost;

  // Redirect if cart is empty
  if (cartItems.length === 0) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <span className="text-5xl block mb-3">🛒</span>
          <h1 className="text-xl font-bold text-dark mb-2">Your cart is empty</h1>
          <p className="text-sm text-outline mb-6">Add some cakes before checking out!</p>
          <Link href="/products" className="inline-flex px-6 py-2.5 rounded-full gradient-primary text-white font-semibold text-sm">
            Browse Cakes
          </Link>
        </div>
      </AppShell>
    );
  }

  // Show loading skeleton while session restores (prevents flash of guest/login choice)
  if (isSessionLoading) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── Step handlers ─────────────────────────────────────────────────────────

  const handleGuestContinue = () => {
    const { name, email, phone } = guestInfo;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      dispatch(addToast({ message: 'Please fill in all your details', type: 'error' }));
      return;
    }
    setStep(2);
  };

  const handleDeliveryContinue = () => {
    if (!deliveryDate || !deliverySlot) {
      dispatch(addToast({ message: 'Please select a delivery date and slot', type: 'error' }));
      return;
    }
    if (checkoutMode === 'auth') {
      if (!selectedAddress && !showNewAddress) {
        dispatch(addToast({ message: 'Please select or add a delivery address', type: 'error' }));
        return;
      }
      // Validate state + area for new address
      if (showNewAddress) {
        if (!newAddress.state || !newAddress.city) {
          dispatch(addToast({ message: 'Please select state and city', type: 'error' }));
          return;
        }
        const zone = zones.find((z) => z.state === newAddress.state && z.city === newAddress.city);
        if (zone?.areas?.length > 0 && !newAddress.area) {
          dispatch(addToast({ message: 'Please select an area / sector', type: 'error' }));
          return;
        }
      }
    } else {
      const { line1, state, city, pincode } = guestAddress;
      if (!line1 || !state || !city || !pincode) {
        dispatch(addToast({ message: 'Please complete your delivery address', type: 'error' }));
        return;
      }
      // Validate area for guest if zone has areas
      const zone = zones.find((z) => z.state === state && z.city === city);
      if (zone?.areas?.length > 0 && !guestAddress.area) {
        dispatch(addToast({ message: 'Please select an area / sector', type: 'error' }));
        return;
      }
    }
    setStep(checkoutMode === 'auth' ? 2 : 3);
  };

  // ─── Place Order ───────────────────────────────────────────────────────────

  const handlePlaceOrder = async () => {
    if (orderInProgressRef.current) return;
    orderInProgressRef.current = true;
    setPlacing(true);
    try {
      if (checkoutMode === 'guest') {
        // Build guest order items from guestItems (local Redux state)
        const guestOrderItems = cartItems.map((item) => {
          const addOns = pendingAddOns[item.localId] || [];
          return {
            name: item.productName || item.name || 'Cake',
            image: item.productImage || item.image || '',
            weight: item.variantWeight || item.weight || '',
            price: item.price || 0,
            quantity: item.quantity,
            isEggless: item.isEggless || false,
            cakeMessage: item.cakeMessage || '',
            addOns: addOns.map((a) => ({ name: a.name, price: a.price })),
          };
        });

        const guestSubtotal = cartItems.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
        const guestAddOnTotal = Object.values(pendingAddOns).reduce(
          (sum, list) => sum + list.reduce((s, a) => s + (a.price || 0), 0), 0
        );
        const guestDeliveryCharge = selectedZone
          ? (guestSubtotal + guestAddOnTotal >= selectedZone.freeDeliveryAbove ? 0 : selectedZone.deliveryCharge)
          : (guestSubtotal + guestAddOnTotal >= 49900 ? 0 : 4900);
        const guestTotal = guestSubtotal + guestAddOnTotal + guestDeliveryCharge;

        const guestPayload = {
          guestInfo: {
            name: guestInfo.name,
            email: guestInfo.email,
            phone: guestInfo.phone,
          },
          shippingAddress: {
            fullName: guestInfo.name,
            phone: guestInfo.phone,
            addressLine1: guestAddress.line1,
            area: guestAddress.area || '',
            city: guestAddress.city,
            state: guestAddress.state,
            pincode: guestAddress.pincode,
          },
          items: guestOrderItems,
          deliveryDate,
          deliverySlot,
          subtotal: guestSubtotal,
          deliveryCharge: guestDeliveryCharge,
          total: guestTotal,
        };

        const res = await api.post('/guest-checkout', guestPayload);
        const guestOrderNum = res.data?.data?.order?.orderNumber;
        const guestOrderId  = res.data?.data?.order?._id;
        dispatch(addToast({ message: 'Order placed successfully! 🎉', type: 'success' }));
        dispatch(clearGuestCart());
        dispatch(clearPendingAddOns());
        router.push(guestOrderNum
          ? `/order-confirmation?orderNumber=${guestOrderNum}`
          : `/order-confirmation?orderId=${guestOrderId}`);
        return;
      }

      // Authenticated order
      // Sync pending add-ons to the server cart so the backend picks them up
      if (Object.keys(pendingAddOns).length > 0) {
        await dispatch(syncAddOnsToServerCart()).unwrap();
      }
      // Convert the slot string "10:00 AM – 12:00 PM" → object shape the backend expects
      const slotParts = deliverySlot ? deliverySlot.split('–').map((s) => s.trim()) : [];
      const deliverySlotObj = {
        label: deliverySlot || '',
        startTime: slotParts[0] || '',
        endTime: slotParts[1] || '',
      };

      // Build order payload - use saved addressId or inline shippingAddress
      const orderPayload = {
        addressId: selectedAddress || null,
        deliveryDate,
        deliverySlot: deliverySlotObj,
        paymentMethod: paymentMethod === 'cod' ? 'cod' : 'online',
        items: items.map((i) => {
          const itemKey = i._id;
          const addOns = pendingAddOns[itemKey] || [];
          return {
            product: i.product?._id || i.product,
            variant: i.variant?._id || i.variant,
            quantity: i.quantity,
            isEggless: i.isEggless,
            cakeMessage: i.cakeMessage,
            addOns: addOns.map((a) => ({ name: a.name, price: a.price })),
          };
        }),
      };

      // If using unsaved new address, include inline shippingAddress
      if (!selectedAddress && showNewAddress && newAddress.fullName) {
        orderPayload.shippingAddress = {
          fullName: newAddress.fullName,
          phone: newAddress.phone,
          addressLine1: newAddress.line1,
          city: newAddress.city,
          state: newAddress.state,
          pincode: newAddress.pincode,
          landmark: newAddress.landmark || '',
        };
      }

      if (paymentMethod === 'cod') {
        const res = await api.post('/checkout/create-order', orderPayload);
        const orderNum = res.data?.data?.order?.orderNumber;
        const orderId  = res.data?.data?.order?._id;
        dispatch(addToast({ message: 'Order placed! 🎂', type: 'success' }));
        dispatch(resetCart());
        dispatch(clearPendingAddOns());
        if (isAuthenticated) dispatch(fetchCart());
        router.push(orderNum
          ? `/order-confirmation?orderNumber=${orderNum}`
          : `/order-confirmation?orderId=${orderId}`);
        return;
      } else {
        // Razorpay online
        const res = await api.post('/checkout/create-order', { ...orderPayload, paymentMethod: 'online' });
        const paymentParams = res.data?.data?.paymentParams || {};
        const orderId = res.data?.data?.order?._id;
        const options = {
          key: paymentParams.key_id,
          amount: paymentParams.amount,
          currency: paymentParams.currency || 'INR',
          name: paymentParams.name || 'The Cake Bake',
          description: paymentParams.description || 'Delicious cake order',
          order_id: paymentParams.order_id,
          handler: async (response) => {
            await api.post('/payments/verify', response);
            dispatch(addToast({ message: 'Payment successful! 🎂', type: 'success' }));
            dispatch(resetCart());
            dispatch(clearPendingAddOns());
            if (isAuthenticated) dispatch(fetchCart());
            const onlineOrderNum = res.data?.data?.order?.orderNumber;
            router.push(onlineOrderNum
              ? `/order-confirmation?orderNumber=${onlineOrderNum}`
              : `/order-confirmation?orderId=${orderId}`);
            return;
          },
          prefill: paymentParams.prefill || { name: user?.name, email: user?.email, contact: user?.phone },
          theme: { color: '#D81B60' },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      dispatch(addToast({ message: err?.response?.data?.message || 'Failed to place order', type: 'error' }));
    } finally {
      orderInProgressRef.current = false;
      setPlacing(false);
    }
  };

  // ─── Steps (shared progress indicator) ────────────────────────────────────
  const steps = checkoutMode === 'auth' ? STEPS_AUTHED : STEPS_GUEST;
  const displayStep = checkoutMode === 'auth' ? step - 1 : step; // normalize to 0-based for indicator

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Step indicator (not shown on step 0) */}
        {step > 0 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                  i < displayStep ? 'bg-success text-white' :
                  i === displayStep ? 'gradient-primary text-white' :
                  'bg-surface-container-high text-outline'
                }`}>
                  {i < displayStep ? <FiCheck className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`hidden sm:block text-xs font-medium ${i === displayStep ? 'text-pink-deep' : 'text-outline'}`}>
                  {label}
                </span>
                {i < steps.length - 1 && <div className={`w-8 sm:w-12 h-0.5 ${i < displayStep ? 'bg-success' : 'bg-surface-container-high'}`} />}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">

              {/* ── STEP 0: Choose checkout method ── */}
              {step === 0 && (
                <motion.div key="step0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <h1 className="text-2xl font-bold text-dark mb-2">How would you like to checkout?</h1>
                  <p className="text-sm text-outline mb-8">Choose an option to continue placing your order</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Guest Checkout */}
                    <button
                      onClick={() => { setCheckoutMode('guest'); setStep(1); }}
                      className="group text-left p-6 rounded-2xl border-2 border-outline-variant/30 hover:border-pink-deep hover:shadow-lg transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center mb-4 group-hover:bg-pink-light/30 transition-colors">
                        <FiUser className="w-6 h-6 text-outline group-hover:text-pink-deep transition-colors" />
                      </div>
                      <h3 className="text-lg font-bold text-dark mb-1">Guest Checkout</h3>
                      <p className="text-sm text-outline leading-relaxed">
                        No account needed. Just enter your name, email, and address to place your order.
                      </p>
                      <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-pink-deep">
                        Continue as Guest <FiArrowRight className="w-4 h-4" />
                      </div>
                    </button>

                    {/* Login / Account */}
                    <div className="p-6 rounded-2xl border-2 border-outline-variant/30">
                      <div className="w-12 h-12 rounded-2xl bg-pink-light/20 flex items-center justify-center mb-4">
                        <FiLock className="w-6 h-6 text-pink-deep" />
                      </div>
                      <h3 className="text-lg font-bold text-dark mb-1">Login to Account</h3>
                      <p className="text-sm text-outline leading-relaxed mb-4">
                        Save addresses, track orders & apply exclusive coupons with your account.
                      </p>
                      <Link
                        href={`/login?next=/checkout`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                      >
                        Login / Register
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 1 (Guest): Your Details ── */}
              {step === 1 && checkoutMode === 'guest' && (
                <motion.div key="step1g" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <button onClick={() => setStep(0)} className="flex items-center gap-1.5 text-sm text-outline hover:text-pink-deep mb-6 transition-colors">
                    <FiArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="text-xl font-bold text-dark mb-6">Your Contact Details</h2>

                  <div className="space-y-4">
                    {[
                      { icon: FiUser, label: 'Full Name', key: 'name', type: 'text', placeholder: 'Your name' },
                      { icon: FiMail, label: 'Email Address', key: 'email', type: 'email', placeholder: 'you@example.com' },
                      { icon: FiPhone, label: 'Mobile Number', key: 'phone', type: 'tel', placeholder: '+91 98765 43210' },
                    ].map(({ icon: Icon, label, key, type, placeholder }) => (
                      <div key={key}>
                        <label className="text-sm font-medium text-dark mb-1.5 block">{label}</label>
                        <div className="relative">
                          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                          <input
                            type={type}
                            value={guestInfo[key]}
                            onChange={(e) => setGuestInfo((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full pl-10 pr-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleGuestContinue}
                    className="mt-6 flex items-center gap-2 px-8 py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-opacity"
                  >
                    Continue <FiArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* ── STEP 1 (Auth): Address ── */}
              {step === 1 && checkoutMode === 'auth' && (
                <motion.div key="step1a" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <h2 className="text-xl font-bold text-dark mb-6">Delivery Address</h2>

                  {addresses.length > 0 && (
                    <div className="space-y-3 mb-5">
                      {addresses.map((addr) => (
                        <button
                          key={addr._id}
                          onClick={() => { setSelectedAddress(addr._id); setShowNewAddress(false); }}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                            selectedAddress === addr._id ? 'border-pink-deep bg-pink-light/10' : 'border-outline-variant/30 hover:border-pink-deep/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FiMapPin className="w-4 h-4 text-pink-deep" />
                            <span className="text-sm font-semibold text-dark">{addr.label || 'Address'}</span>
                          </div>
                          <p className="text-sm text-outline">{addr.line1}, {addr.city}, {addr.state} - {addr.pincode}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => { setShowNewAddress(!showNewAddress); setSelectedAddress(null); }}
                    className="text-sm font-semibold text-pink-deep hover:underline mb-4 block"
                  >
                    + Add New Address
                  </button>

                  {showNewAddress && (
                    <div className="space-y-3 p-4 bg-surface-container-low rounded-xl mb-4">
                      {/* Basic text fields */}
                      {[
                        { label: 'Full Name', key: 'fullName', placeholder: 'Enter your full name', required: true },
                        { label: 'Phone Number', key: 'phone', placeholder: '+91 98765 43210', required: true, type: 'tel' },
                        { label: 'Address Line 1', key: 'line1', placeholder: 'House no, Street name', required: true },
                      ].map(({ label, key, placeholder, required, type }) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-outline mb-1 block">
                            {label} {required && <span className="text-pink-deep">*</span>}
                          </label>
                          <input
                            type={type || 'text'}
                            value={newAddress[key]}
                            onChange={(e) => setNewAddress((p) => ({ ...p, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep"
                          />
                        </div>
                      ))}

                      {/* State dropdown */}
                      <div>
                        <label className="text-xs font-medium text-outline mb-1 block">State <span className="text-pink-deep">*</span></label>
                        <div className="relative">
                          <select
                            value={newAddress.state}
                            onChange={(e) => {
                              setNewAddress((p) => ({ ...p, state: e.target.value, city: '', area: '' }));
                              setSelectedZone(null);
                            }}
                            className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep appearance-none bg-white pr-8"
                          >
                            <option value="">Select state</option>
                            {[...new Set(zones.map((z) => z.state).filter(Boolean))].map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                        </div>
                      </div>

                      {/* City dropdown — filtered by state */}
                      {newAddress.state && (
                        <div>
                          <label className="text-xs font-medium text-outline mb-1 block">City <span className="text-pink-deep">*</span></label>
                          <div className="relative">
                            <select
                              value={newAddress.city}
                              onChange={(e) => {
                                const city = e.target.value;
                                const zone = zones.find((z) => z.state === newAddress.state && z.city === city) || null;
                                setNewAddress((p) => ({ ...p, city, area: '' }));
                                setSelectedZone(zone);
                              }}
                              className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep appearance-none bg-white pr-8"
                            >
                              <option value="">Select city</option>
                              {zones.filter((z) => z.state === newAddress.state).map((z) => (
                                <option key={z._id} value={z.city}>{z.city}</option>
                              ))}
                            </select>
                            <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                          </div>
                        </div>
                      )}

                      {/* Area dropdown — shown when city has areas */}
                      {newAddress.city && (() => {
                        const zone = zones.find((z) => z.state === newAddress.state && z.city === newAddress.city);
                        return zone?.areas?.length > 0 ? (
                          <div>
                            <label className="text-xs font-medium text-outline mb-1 block">Area / Sector <span className="text-pink-deep">*</span></label>
                            <div className="relative">
                              <select
                                value={newAddress.area}
                                onChange={(e) => setNewAddress((p) => ({ ...p, area: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep appearance-none bg-white pr-8"
                              >
                                <option value="">Select area</option>
                                {zone.areas.map((a) => <option key={a} value={a}>{a}</option>)}
                              </select>
                              <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Pincode + Landmark */}
                      {[
                        { label: 'Pincode', key: 'pincode', placeholder: '143001', required: true },
                        { label: 'Landmark (optional)', key: 'landmark', placeholder: 'Near by landmark', required: false },
                      ].map(({ label, key, placeholder, required }) => (
                        <div key={key}>
                          <label className="text-xs font-medium text-outline mb-1 block">
                            {label} {required && <span className="text-pink-deep">*</span>}
                          </label>
                          <input
                            type="text"
                            value={newAddress[key]}
                            onChange={(e) => setNewAddress((p) => ({ ...p, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full px-3 py-2 text-sm border border-outline-variant/30 rounded-lg focus:outline-none focus:border-pink-deep"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => {
                        if (selectedAddress) {
                          setStep(2);
                        } else {
                          dispatch(addToast({ message: 'Please select or add an address', type: 'error' }));
                        }
                      }}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                      disabled={!selectedAddress}
                    >
                      Continue <FiArrowRight className="w-4 h-4" />
                    </button>

                    {showNewAddress && (
                      <button
                        onClick={async () => {
                          if (!newAddress.fullName || !newAddress.phone || !newAddress.line1 || !newAddress.city || !newAddress.state || !newAddress.pincode) {
                            dispatch(addToast({ message: 'Please fill all required fields', type: 'error' }));
                            return;
                          }
                          // Validate area if zone has areas configured
                          const zone = zones.find((z) => z.state === newAddress.state && z.city === newAddress.city);
                          if (zone?.areas?.length > 0 && !newAddress.area) {
                            dispatch(addToast({ message: 'Please select an area / sector', type: 'error' }));
                            return;
                          }
                          setSavingAddress(true);
                          try {
                            const payload = {
                              label: newAddress.label,
                              fullName: newAddress.fullName,
                              phone: newAddress.phone,
                              addressLine1: newAddress.line1,
                              area: newAddress.area || '',
                              city: newAddress.city,
                              state: newAddress.state,
                              pincode: newAddress.pincode,
                              landmark: newAddress.landmark,
                            };
                            const res = await api.post('/users/me/addresses', payload);
                            const savedAddress = res.data?.data;
                            if (savedAddress) {
                              setAddresses((prev) => [...prev, savedAddress]);
                              setSelectedAddress(savedAddress._id);
                              setShowNewAddress(false);
                              setStep(2);
                              dispatch(addToast({ message: 'Address saved!', type: 'success' }));
                            }
                          } catch (err) {
                            dispatch(addToast({ message: err?.response?.data?.message || 'Failed to save address', type: 'error' }));
                          } finally {
                            setSavingAddress(false);
                          }
                        }}
                        disabled={savingAddress}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-pink-deep text-pink-deep font-semibold hover:bg-pink-deep/5 transition-colors disabled:opacity-50"
                      >
                        {savingAddress ? (
                          <div className="w-4 h-4 border-2 border-pink-deep border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Save & Continue'
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2 (Guest): Delivery Address + Date + Slot ── */}
              {step === 2 && checkoutMode === 'guest' && (
                <motion.div key="step2g" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-outline hover:text-pink-deep mb-6 transition-colors">
                    <FiArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="text-xl font-bold text-dark mb-6">Delivery Details</h2>

                  <div className="space-y-4 mb-6">
                    <p className="text-sm font-semibold text-dark">Delivery Address</p>

                    {/* Address line 1 */}
                    <div>
                      <label className="text-xs font-medium text-outline mb-1 block">Address Line 1</label>
                      <input
                        value={guestAddress.line1}
                        onChange={(e) => setGuestAddress((p) => ({ ...p, line1: e.target.value }))}
                        placeholder="House no, Street name"
                        className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep"
                      />
                    </div>

                    {/* State dropdown */}
                    <div>
                      <label className="text-xs font-medium text-outline mb-1 block">State</label>
                      <div className="relative">
                        <select
                          value={guestAddress.state}
                          onChange={(e) => {
                            setGuestAddress((p) => ({ ...p, state: e.target.value, city: '', area: '' }));
                            setSelectedZone(null);
                          }}
                          className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep appearance-none bg-white pr-8"
                        >
                          <option value="">Select state</option>
                          {[...new Set(zones.map((z) => z.state).filter(Boolean))].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                      </div>
                    </div>

                    {/* City dropdown — filtered by state */}
                    {guestAddress.state && (
                      <div>
                        <label className="text-xs font-medium text-outline mb-1 block">City</label>
                        <div className="relative">
                          <select
                            value={guestAddress.city}
                            onChange={(e) => {
                              const city = e.target.value;
                              const zone = zones.find((z) => z.state === guestAddress.state && z.city === city) || null;
                              setGuestAddress((p) => ({ ...p, city, area: '' }));
                              setSelectedZone(zone);
                            }}
                            className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep appearance-none bg-white pr-8"
                          >
                            <option value="">Select city</option>
                            {zones.filter((z) => z.state === guestAddress.state).map((z) => (
                              <option key={z._id} value={z.city}>{z.city}</option>
                            ))}
                          </select>
                          <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                        </div>
                      </div>
                    )}

                    {/* Area dropdown */}
                    {guestAddress.city && (() => {
                      const zone = zones.find((z) => z.state === guestAddress.state && z.city === guestAddress.city);
                      return zone?.areas?.length > 0 ? (
                        <div>
                          <label className="text-xs font-medium text-outline mb-1 block">Area / Sector</label>
                          <div className="relative">
                            <select
                              value={guestAddress.area}
                              onChange={(e) => setGuestAddress((p) => ({ ...p, area: e.target.value }))}
                              className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep appearance-none bg-white pr-8"
                            >
                              <option value="">Select area</option>
                              {zone.areas.map((a) => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Pincode */}
                    <div>
                      <label className="text-xs font-medium text-outline mb-1 block">Pincode</label>
                      <input
                        value={guestAddress.pincode}
                        onChange={(e) => setGuestAddress((p) => ({ ...p, pincode: e.target.value }))}
                        placeholder="143001"
                        className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep"
                      />
                    </div>
                  </div>

                  <DeliveryDateSlot
                    deliveryDate={deliveryDate}
                    setDeliveryDate={setDeliveryDate}
                    deliverySlot={deliverySlot}
                    setDeliverySlot={setDeliverySlot}
                  />

                  <button
                    onClick={handleDeliveryContinue}
                    className="mt-6 flex items-center gap-2 px-8 py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-opacity"
                  >
                    Continue <FiArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* ── STEP 2 (Auth): Delivery Date + Slot ── */}
              {step === 2 && checkoutMode === 'auth' && (
                <motion.div key="step2a" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-outline hover:text-pink-deep mb-6 transition-colors">
                    <FiArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="text-xl font-bold text-dark mb-6">Delivery Date & Time</h2>

                  <DeliveryDateSlot
                    deliveryDate={deliveryDate}
                    setDeliveryDate={setDeliveryDate}
                    deliverySlot={deliverySlot}
                    setDeliverySlot={setDeliverySlot}
                  />

                  <button
                    onClick={() => setStep(3)}
                    className="mt-6 flex items-center gap-2 px-8 py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-opacity"
                  >
                    Continue <FiArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* ── STEP 3: Payment ── */}
              {step === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                  <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-outline hover:text-pink-deep mb-6 transition-colors">
                    <FiArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <h2 className="text-xl font-bold text-dark mb-6">Payment Method</h2>

                  {/* ── Coupon Section ── */}
                  <div className="mb-6 p-4 bg-surface-container-low rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <FiTag className="w-4 h-4 text-pink-deep" />
                      <span className="text-sm font-semibold text-dark">Have a coupon?</span>
                    </div>
                    {isAuthenticated ? (
                      appliedCoupon ? (
                        <div className="flex items-center justify-between p-3 bg-success/10 rounded-xl">
                          <div>
                            <span className="text-sm font-bold text-success">{appliedCoupon.code}</span>
                            {appliedCoupon.description && (
                              <p className="text-xs text-success/80 mt-0.5">{appliedCoupon.description}</p>
                            )}
                            <p className="text-xs text-success font-medium">-{formatPrice(appliedCoupon.discount)} saved!</p>
                          </div>
                          <button
                            onClick={() => setAppliedCoupon(null)}
                            className="text-xs text-error hover:underline font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            placeholder="Enter coupon code"
                            className="flex-1 px-3 py-2 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep bg-white placeholder:text-outline"
                          />
                          <button
                            onClick={async () => {
                              if (!couponCode.trim()) return;
                              setCouponLoading(true);
                              try {
                                const res = await api.post('/coupons/validate', { code: couponCode.trim(), cartSubtotal: subtotal });
                                const data = res.data?.data;
                                setAppliedCoupon({ code: data.coupon.code, discount: data.discount, description: data.coupon.description });
                                setCouponCode('');
                              } catch (err) {
                                dispatch(addToast({ message: err?.response?.data?.message || 'Invalid coupon', type: 'error' }));
                              } finally {
                                setCouponLoading(false);
                              }
                            }}
                            disabled={couponLoading}
                            className="px-4 py-2 text-sm font-semibold text-pink-deep border border-pink-deep rounded-xl hover:bg-pink-light/20 transition-colors disabled:opacity-50"
                          >
                            {couponLoading ? <div className="w-4 h-4 border-2 border-pink-deep border-t-transparent rounded-full animate-spin" /> : 'Apply'}
                          </button>
                        </div>
                      )
                    ) : (
                      <p className="text-sm text-outline">
                        <Link href="/login?next=/checkout" className="text-pink-deep font-semibold hover:underline">Sign in</Link>
                        {' '}to unlock exclusive coupon codes
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 mb-8">
                    {[
                      { value: 'cod', label: 'Cash on Delivery', desc: 'Pay when your cake arrives at your door', icon: '💵' },
                      { value: 'online', label: 'Pay Online (Razorpay)', desc: 'Credit card, debit card, UPI, net banking', icon: '💳', disabled: checkoutMode === 'guest' },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          opt.disabled ? 'opacity-40 cursor-not-allowed' :
                          paymentMethod === opt.value ? 'border-pink-deep bg-pink-light/10' : 'border-outline-variant/30 hover:border-pink-deep/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={opt.value}
                          checked={paymentMethod === opt.value}
                          onChange={() => !opt.disabled && setPaymentMethod(opt.value)}
                          className="accent-pink-deep"
                          disabled={opt.disabled}
                        />
                        <span className="text-2xl">{opt.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-dark">{opt.label}</p>
                          <p className="text-xs text-outline">{opt.disabled ? 'Login required for online payment' : opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={placing}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl gradient-primary text-white font-bold text-base hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    {placing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <FiCreditCard className="w-5 h-5" />
                        Place Order · {formatPrice(total)}
                      </>
                    )}
                  </button>

                  <p className="text-xs text-center text-outline mt-3 flex items-center justify-center gap-1">
                    <FiLock className="w-3 h-3" /> Secure checkout · Your data is protected
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card sticky top-24">
              <h3 className="text-base font-bold text-dark mb-4">Order Summary</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {cartItems.map((item, i) => {
                  const name = isAuthenticated ? (item.snapshotName || item.product?.name) : item.productName;
                  const price = isAuthenticated ? (item.snapshotPrice || item.variant?.price || 0) : (item.price || 0);
                  return (
                    <div key={isAuthenticated ? item._id : item.localId || i} className="flex justify-between gap-2 text-sm">
                      <span className="text-on-surface-variant line-clamp-1 flex-1">{name} × {item.quantity}</span>
                      <span className="font-medium text-dark shrink-0">{formatPrice(price * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-outline-variant/20 pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-outline">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                {addonTotal > 0 && (
                  <div className="flex justify-between text-dark">
                    <span className="text-outline">Add-ons</span>
                    <span>+{formatPrice(addonTotal)}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-success">
                    <span>Coupon{appliedCoupon?.code ? ` (${appliedCoupon.code})` : ''}</span>
                    <span>-{formatPrice(couponDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-outline">Delivery{selectedZone ? ` · ${selectedZone.city}` : ''}</span>
                  <span className={deliveryCost === 0 ? 'text-success font-medium' : 'font-medium'}>
                    {deliveryCost === 0 ? 'Free' : formatPrice(deliveryCost)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-outline-variant/20">
                  <span>Total</span>
                  <span className="text-pink-deep">{formatPrice(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Shared Delivery Date & Slot Component ────────────────────────────────────
function DeliveryDateSlot({ deliveryDate, setDeliveryDate, deliverySlot, setDeliverySlot }) {
  const tomorrow = getTomorrow();

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-semibold text-dark mb-2 flex items-center gap-2">
          <FiCalendar className="w-4 h-4 text-pink-deep" /> Delivery Date
        </label>
        <input
          type="date"
          value={deliveryDate}
          min={tomorrow}
          onChange={(e) => setDeliveryDate(e.target.value)}
          className="w-full px-4 py-3 text-sm border border-outline-variant/30 rounded-xl focus:outline-none focus:border-pink-deep"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-dark mb-2 block">Delivery Time Slot</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DELIVERY_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setDeliverySlot(slot)}
              className={`px-3 py-2.5 text-sm rounded-xl border-2 text-left transition-all ${
                deliverySlot === slot
                  ? 'border-pink-deep bg-pink-light/10 text-pink-deep font-semibold'
                  : 'border-outline-variant/30 text-dark hover:border-pink-deep/50'
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
