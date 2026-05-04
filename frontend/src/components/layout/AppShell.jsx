'use client';

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePathname } from 'next/navigation';
import { fetchProfile, setSessionLoaded, setUser } from '@/store/slices/authSlice';
import { fetchCart } from '@/store/slices/cartSlice';
import { fetchWishlist } from '@/store/slices/wishlistSlice';
import { fetchCategories } from '@/store/slices/categoriesSlice';
import { clearToasts } from '@/store/slices/toastSlice';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import CartDrawer from '@/components/ui/CartDrawer';
import SearchOverlay from '@/components/ui/SearchOverlay';
import Toast from '@/components/ui/Toast';

// Module-level flag to prevent duplicate fetchProfile calls across remounts
let sessionInitStarted = false;

export default function AppShell({ children }) {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const { hasFetched: categoriesFetched } = useSelector((s) => s.categories);
  const dataFetchedRef = useRef(false);

  // Clear toasts on route change
  useEffect(() => {
    dispatch(clearToasts());
  }, [pathname, dispatch]);

  // Session restore — only once per app lifecycle
  useEffect(() => {
    if (sessionInitStarted) return;
    sessionInitStarted = true;

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        // Fetch profile then filter out admin users from the customer site
        dispatch(fetchProfile()).then((action) => {
          const user = action.payload;
          if (user && (user.role === 'admin' || user.role === 'superadmin')) {
            // Admin token found — don't show admin as a logged-in customer.
            // Reset auth state: user=null, isAuthenticated=false, isSessionLoading=false
            dispatch(setUser(null));
          }
        });
      } else {
        // No token — mark session as resolved immediately
        dispatch(setSessionLoaded());
      }
    }
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

  return (
    <>
      <Navbar />
      <main className="flex-1 pb-14 lg:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
      <CartDrawer />
      <SearchOverlay />
      <Toast />
    </>
  );
}
