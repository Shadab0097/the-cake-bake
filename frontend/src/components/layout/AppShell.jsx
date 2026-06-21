'use client';

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePathname } from 'next/navigation';
import { fetchProfile, setUser } from '@/store/slices/authSlice';
import { fetchCart } from '@/store/slices/cartSlice';
import { fetchWishlist } from '@/store/slices/wishlistSlice';
import { fetchCategories } from '@/store/slices/categoriesSlice';
import { clearToasts } from '@/store/slices/toastSlice';
import { detectLocation } from '@/store/slices/deliverySlice';
import {
  isGeolocationEnabled,
  isGeolocationSupported,
  getGeolocationPermissionState,
} from '@/lib/geolocation.mjs';
import { isAdminRole } from '@/lib/adminAccess.mjs';
import Navbar from '@/components/layout/Navbar';
import DeliveryBanner from '@/components/layout/DeliveryBanner';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import CartDrawer from '@/components/ui/CartDrawer';
import SearchOverlay from '@/components/ui/SearchOverlay';

// Module-level flag to prevent duplicate fetchProfile calls across remounts
let sessionInitStarted = false;
// Separate guard so location auto-detect runs at most once per app lifecycle.
let autoDetectStarted = false;

export default function AppShell({ children }) {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const { hasFetched: categoriesFetched } = useSelector((s) => s.categories);
  const deliveryHydrated = useSelector((s) => s.delivery._hydrated);
  const savedPincode = useSelector((s) => s.delivery.pincode);
  const dataFetchedRef = useRef(false);

  // Clear toasts on route change
  useEffect(() => {
    dispatch(clearToasts());
  }, [pathname, dispatch]);

  // Session restore — only once per app lifecycle
  useEffect(() => {
    if (sessionInitStarted) return;
    sessionInitStarted = true;

    // Fetch profile then filter out admin users from the customer site.
    // If only the HttpOnly refresh cookie exists, the API interceptor refreshes once.
    dispatch(fetchProfile()).then((action) => {
      const user = action.payload;
      if (user && isAdminRole(user.role)) {
        // Admin token found — don't show admin as a logged-in customer.
        // Reset auth state: user=null, isAuthenticated=false, isSessionLoading=false
        dispatch(setUser(null));
      }
    });
  }, [dispatch]);

  // Fetch cart + wishlist once when authenticated
  useEffect(() => {
    if (isAuthenticated && !dataFetchedRef.current) {
      dataFetchedRef.current = true;
      dispatch(fetchCart());
      dispatch(fetchWishlist());
    }
  }, [isAuthenticated, dispatch]);

  // Fetch categories once (public data, no auth needed)
  useEffect(() => {
    if (!categoriesFetched) {
      dispatch(fetchCategories());
    }
  }, [categoriesFetched, dispatch]);

  // Auto-detect delivery location on first visit only — when the persisted
  // cookie has hydrated and produced no saved pincode. Runs at most once per
  // app lifecycle; any saved location (or a prior detection) short-circuits it,
  // so refreshes never re-trigger the prompt. Silent on denial/failure: the
  // manual pincode widget remains the fallback.
  useEffect(() => {
    if (autoDetectStarted) return;
    if (!deliveryHydrated) return; // wait for cookie hydration to settle
    if (savedPincode) return; // already have a location — don't prompt
    if (!isGeolocationEnabled() || !isGeolocationSupported()) return;

    autoDetectStarted = true;

    let cancelled = false;
    (async () => {
      // Skip prompting entirely if the user already blocked location access.
      const permission = await getGeolocationPermissionState();
      if (cancelled || permission === 'denied') return;
      dispatch(detectLocation({ auto: true }));
    })();

    return () => {
      cancelled = true;
    };
  }, [deliveryHydrated, savedPincode, dispatch]);

  return (
    <>
      <Navbar />
      <DeliveryBanner />
      <main className="flex-1 pb-14 lg:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      <CartDrawer />
      <SearchOverlay />
    </>
  );
}
