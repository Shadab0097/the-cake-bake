import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

const GUEST_CART_KEY = 'guestCart';
const PENDING_ADDONS_KEY = 'pendingAddOns';

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

// ─── Pending Add-ons localStorage helpers ─────────────────────────────────
const loadPendingAddOnsFromStorage = () => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(PENDING_ADDONS_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
};

const syncPendingAddOnsToStorage = (pendingAddOns) => {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(pendingAddOns).length === 0) {
      localStorage.removeItem(PENDING_ADDONS_KEY);
    } else {
      localStorage.setItem(PENDING_ADDONS_KEY, JSON.stringify(pendingAddOns));
    }
  } catch { /* ignore */ }
};

const clearPendingAddOnsStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_ADDONS_KEY);
  } catch { /* ignore */ }
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

// Reads guest items from Redux state, pushes them to the server cart one-by-one,
// then fetches the merged result and clears the guest cart.
// Also includes any pendingAddOns (add-on IDs) in the merge payload so the
// server cart receives the correct add-ons during the guest→auth transition.
export const mergeGuestCartToServer = createAsyncThunk(
  'cart/mergeGuestCartToServer',
  async (_, { getState, rejectWithValue }) => {
    const { guestItems, pendingAddOns } = getState().cart;
    try {
      // Build a mapping so the fulfilled reducer can remap pendingAddOns keys
      // from localId → new server _id (matched by product+variant).
      const localIdToProductVariant = {};

      if (guestItems && guestItems.length > 0) {
        for (const item of guestItems) {
          const productId = item.product || item.productId;
          const variantId = item.variant || item.variantId;
          const payload = {
            productId,
            variantId,
            quantity: item.quantity || 1,
            isEggless: item.isEggless || false,
            cakeMessage: item.cakeMessage || '',
          };

          // Include add-ons from pendingAddOns in the merge payload
          const itemAddOns = pendingAddOns[item.localId];
          if (itemAddOns && itemAddOns.length > 0) {
            payload.addOns = itemAddOns.map((a) => a._id);
          } else if (item.addOns && item.addOns.length > 0) {
            payload.addOns = item.addOns;
          }

          await api.post('/cart/items', payload);

          // Track the mapping for key remapping
          if (item.localId && pendingAddOns[item.localId]) {
            localIdToProductVariant[item.localId] = {
              product: String(productId),
              variant: String(variantId),
            };
          }
        }
      }
      // Always fetch the final (merged) cart state
      const res = await api.get('/cart');
      return { cart: res.data.data, localIdToProductVariant };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to merge cart');
    }
  }
);

// Pushes pendingAddOns (add-on IDs) to each server cart item before placing order.
// The backend order service reads addOns from the cart model, so we must sync first.
export const syncAddOnsToServerCart = createAsyncThunk(
  'cart/syncAddOnsToServerCart',
  async (_, { getState, rejectWithValue }) => {
    const { pendingAddOns, items } = getState().cart;
    try {
      if (items && items.length > 0 && Object.keys(pendingAddOns).length > 0) {
        for (const item of items) {
          const itemKey = item._id;
          const addOns = pendingAddOns[itemKey];
          if (addOns && addOns.length > 0) {
            // Send add-on _id list to the backend
            await api.put(`/cart/items/${itemKey}`, {
              addOns: addOns.map((a) => a._id),
            });
          }
        }
      }
      // Fetch updated cart
      const res = await api.get('/cart');
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to sync add-ons');
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
    // Add-ons selected per item before checkout: { [itemKey]: [addonObject, ...] }
    pendingAddOns: {},
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
      state.pendingAddOns = loadPendingAddOnsFromStorage();
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
      state.pendingAddOns = {};
      clearGuestCartStorage();
      clearPendingAddOnsStorage();
    },

    // ─── Pending Add-ons (before checkout) ─────────────────────────────────
    setItemAddOns: (state, action) => {
      const { itemKey, addons } = action.payload;
      if (!addons || addons.length === 0) {
        delete state.pendingAddOns[itemKey];
      } else {
        state.pendingAddOns[itemKey] = addons;
      }
      syncPendingAddOnsToStorage(state.pendingAddOns);
    },
    clearPendingAddOns: (state) => {
      state.pendingAddOns = {};
      clearPendingAddOnsStorage();
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
      })
      .addCase(mergeGuestCartToServer.pending, (state) => { state.isLoading = true; })
      .addCase(mergeGuestCartToServer.fulfilled, (state, action) => {
        state.isLoading = false;
        const { cart, localIdToProductVariant } = action.payload;
        setCartState(state, cart);

        // Remap pendingAddOns keys: localId → server _id
        // After merge, the server cart items have _id values. We match them
        // to the old guest localId keys via product+variant.
        if (localIdToProductVariant && Object.keys(localIdToProductVariant).length > 0) {
          const remapped = {};
          const serverItems = state.items || [];

          for (const [localId, { product, variant }] of Object.entries(localIdToProductVariant)) {
            const addons = state.pendingAddOns[localId];
            if (!addons) continue;

            // Find the matching server cart item
            const serverItem = serverItems.find((si) => {
              const siProduct = String(si.product?._id || si.product);
              const siVariant = String(si.variant?._id || si.variant);
              return siProduct === product && siVariant === variant;
            });

            if (serverItem) {
              remapped[serverItem._id] = addons;
            }
            // Remove the old localId key
            delete state.pendingAddOns[localId];
          }

          // Merge remapped keys into pendingAddOns
          Object.assign(state.pendingAddOns, remapped);
          syncPendingAddOnsToStorage(state.pendingAddOns);
        }

        // Clear the guest cart from state and localStorage
        state.guestItems = [];
        state.guestItemCount = 0;
        clearGuestCartStorage();
      })
      .addCase(mergeGuestCartToServer.rejected, (state) => {
        // Even on failure, clear guest cart so we don't merge stale items repeatedly
        state.isLoading = false;
        state.guestItems = [];
        state.guestItemCount = 0;
        clearGuestCartStorage();
      })
      .addCase(syncAddOnsToServerCart.fulfilled, (state, action) => {
        setCartState(state, action.payload);
      })
      .addCase(syncAddOnsToServerCart.rejected, () => {
        // Proceed even if sync fails — the order will be placed without add-ons
      });
  },
});

export const {
  toggleCartDrawer, openCartDrawer, closeCartDrawer, resetCart,
  addGuestItem, updateGuestItem, removeGuestItem, clearGuestCart,
  hydrateGuestCart, clearGuestCartAndStorage,
  setItemAddOns, clearPendingAddOns,
} = cartSlice.actions;

export default cartSlice.reducer;
