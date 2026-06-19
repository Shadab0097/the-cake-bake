'use client';

import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import { hydrateGuestCart } from './slices/cartSlice';
import wishlistReducer from './slices/wishlistSlice';
import categoriesReducer from './slices/categoriesSlice';
import toastReducer from './slices/toastSlice';
import uiReducer from './slices/uiSlice';
import deliveryReducer, { hydrateDeliveryLocation } from './slices/deliverySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    categories: categoriesReducer,
    toast: toastReducer,
    ui: uiReducer,
    delivery: deliveryReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

if (typeof window !== 'undefined') {
  store.dispatch(hydrateGuestCart());
  store.dispatch(hydrateDeliveryLocation());
}
