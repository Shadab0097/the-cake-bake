'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { FiHome, FiGrid, FiShoppingBag, FiHeart, FiUser } from 'react-icons/fi';
import { openCartDrawer } from '@/store/slices/cartSlice';

const tabs = [
  { label: 'Home', href: '/', icon: FiHome },
  { label: 'Shop', href: '/products', icon: FiGrid },
  { label: 'Cart', href: null, icon: FiShoppingBag, isCart: true },
  { label: 'Wishlist', href: '/wishlist', icon: FiHeart },
  { label: 'Account', href: '/account', icon: FiUser },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { itemCount, guestItemCount } = useSelector((s) => s.cart);
  const { isAuthenticated } = useSelector((s) => s.auth);
  const totalCount = isAuthenticated ? itemCount : guestItemCount;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-outline-variant/20 safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.href && pathname === tab.href;

          if (tab.isCart) {
            return (
              <button
                key={tab.label}
                onClick={() => dispatch(openCartDrawer())}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
                aria-label="Cart"
              >
                <div className="relative">
                  <Icon className="w-5 h-5 text-dark" />
                  {totalCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-pink-deep text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
                      {totalCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-dark">{tab.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 transition-colors ${
                isActive ? 'text-pink-deep' : 'text-dark'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
