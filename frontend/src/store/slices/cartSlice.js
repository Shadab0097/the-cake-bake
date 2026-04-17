import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

const GUEST_CART_KEY = 'guestCart';

const loadGuestCartFromStorage = () => {
  if (typeof window === 'undefined') return { items: [], count: 0 };
  try {
    const saved = localStorage.getItem(GUEST_CART_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch { /* ignore parse errors */ }
  return { items: [], count: 0 };
};

const syncGuestCartToStorage = (items, count) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify({ items, count }));
  } catch { /* ignore storage errors */ }
};

const clearGuestCartStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch { /* ignore storage errors */ }
};

// ─── API Thunks (for authenticated users) ────────────────────────────────────

export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/cart');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch cart');
    }
  }
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async (itemData, { rejectWithValue }) => {
    try {
      // Map frontend properties precisely to the backend's expected schema, omitting any extra fields
      const payload = {
        productId: itemData.product || itemData.productId,
        variantId: itemData.variant || itemData.variantId,
        quantity: itemData.quantity || 1,
        isEggless: itemData.isEggless || false,
        cakeMessage: itemData.cakeMessage || '',
      };
      if (itemData.addOns) payload.addOns = itemData.addOns;
      
      const res = await api.post('/cart/items', payload);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to add item');
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async ({ itemId, data }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/cart/items/${itemId}`, data);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update item');
    }
  }
);

export const removeCartItem = createAsyncThunk(
  'cart/removeCartItem',
  async (itemId, { rejectWithValue }) => {
    try {
      const res = await api.delete(`/cart/items/${itemId}`);
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove item');
    }
  }
);

export const applyCoupon = createAsyncThunk(
  'cart/applyCoupon',
  async (code, { rejectWithValue }) => {
    try {
      const res = await api.post('/cart/coupon', { code });
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Invalid coupon');
    }
  }
);

export const removeCoupon = createAsyncThunk(
  'cart/removeCoupon',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.delete('/cart/coupon');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove coupon');
    }
  }
);

export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async (_, { rejectWithValue }) => {
    try {
      await api.delete('/cart');
      return null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to clear cart');
    }
  }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const recalcCount = (items) =>
  items.reduce((sum, item) => sum + item.quantity, 0);

// ─── Slice ────────────────────────────────────────────────────────────────────

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    cart: null,
    items: [],
    itemCount: 0,
    isLoading: false,
    error: null,
    isDrawerOpen: false,
    guestItems: [],
    guestItemCount: 0,
    _hydrated: false,
  },
  reducers: {
    toggleCartDrawer: (state) => { state.isDrawerOpen = !state.isDrawerOpen; },
    openCartDrawer: (state) => { state.isDrawerOpen = true; },
    closeCartDrawer: (state) => { state.isDrawerOpen = false; },
    resetCart: (state) => {
      state.cart = null;
      state.items = [];
      state.itemCount = 0;
    },

    hydrateGuestCart: (state) => {
      const { items, count } = loadGuestCartFromStorage();
      state.guestItems = items;
      state.guestItemCount = count;
      state._hydrated = true;
    },

    addGuestItem: (state, action) => {
      const payload = action.payload;
      const existing = state.guestItems.find(
        (i) =>
          i.product === payload.product &&
          i.variant === payload.variant &&
          i.isEggless === payload.isEggless
      );
      if (existing) {
        existing.quantity += payload.quantity || 1;
      } else {
        state.guestItems.push({
          localId: `${payload.product}-${payload.variant || 'base'}-${Date.now()}`,
          ...payload,
          quantity: payload.quantity || 1,
        });
      }
      state.guestItemCount = recalcCount(state.guestItems);
      syncGuestCartToStorage(state.guestItems, state.guestItemCount);
    },

    updateGuestItem: (state, action) => {
      const { localId, quantity } = action.payload;
      const item = state.guestItems.find((i) => i.localId === localId);
      if (item) {
        item.quantity = Math.max(1, quantity);
      }
      state.guestItemCount = recalcCount(state.guestItems);
      syncGuestCartToStorage(state.guestItems, state.guestItemCount);
    },

    removeGuestItem: (state, action) => {
      state.guestItems = state.guestItems.filter((i) => i.localId !== action.payload);
      state.guestItemCount = recalcCount(state.guestItems);
      syncGuestCartToStorage(state.guestItems, state.guestItemCount);
    },

    clearGuestCart: (state) => {
      state.guestItems = [];
      state.guestItemCount = 0;
      syncGuestCartToStorage([], 0);
    },

    clearGuestCartAndStorage: (state) => {
      state.guestItems = [];
      state.guestItemCount = 0;
      clearGuestCartStorage();
    },
  },
  extraReducers: (builder) => {
    const setCartState = (state, cart) => {
      state.cart = cart;
      state.items = cart?.items || [];
      state.itemCount = (cart?.items || []).reduce((sum, item) => sum + item.quantity, 0);
    };

    builder
      .addCase(fetchCart.pending, (state) => { state.isLoading = true; })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.isLoading = false;
        setCartState(state, action.payload);
      })
      .addCase(fetchCart.rejected, (state) => { state.isLoading = false; })
      .addCase(addToCart.pending, (state) => { state.isLoading = true; })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.isLoading = false;
        setCartState(state, action.payload);
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(updateCartItem.fulfilled, (state, action) => {
        setCartState(state, action.payload);
      })
      .addCase(removeCartItem.fulfilled, (state, action) => {
        setCartState(state, action.payload);
      })
      .addCase(applyCoupon.fulfilled, (state, action) => {
        setCartState(state, action.payload);
      })
      .addCase(applyCoupon.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(removeCoupon.fulfilled, (state, action) => {
        setCartState(state, action.payload);
      })
      .addCase(clearCart.fulfilled, (state) => {
        state.cart = null;
        state.items = [];
        state.itemCount = 0;
      });
  },
});

export const {
  toggleCartDrawer, openCartDrawer, closeCartDrawer, resetCart,
  addGuestItem, updateGuestItem, removeGuestItem, clearGuestCart,
  hydrateGuestCart, clearGuestCartAndStorage,
} = cartSlice.actions;

export default cartSlice.reducer;
