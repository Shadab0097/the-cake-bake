import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/wishlist');
      // Backend returns: { user, products: [{ _id, name, slug, images, ... }] }
      return res.data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch wishlist');
    }
  }
);

export const toggleWishlistItem = createAsyncThunk(
  'wishlist/toggleItem',
  async (productId, { getState, rejectWithValue }) => {
    try {
      const { wishlist } = getState();
      // Items are flat product objects (not { product: {...} } wrappers)
      const isWishlisted = wishlist.items.some((item) => item._id === productId);

      if (isWishlisted) {
        // DELETE /wishlist/:productId
        const res = await api.delete(`/wishlist/${productId}`);
        return { action: 'removed', data: res.data.data };
      } else {
        // POST /wishlist/:productId  (productId in URL, NOT body)
        const res = await api.post(`/wishlist/${productId}`);
        return { action: 'added', data: res.data.data };
      }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update wishlist');
    }
  }
);

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: {
    items: [],    // flat array of product objects: [{ _id, name, slug, images, basePrice, ... }]
    count: 0,
    isLoading: false,
  },
  reducers: {
    resetWishlist: (state) => {
      state.items = [];
      state.count = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.pending, (state) => { state.isLoading = true; })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.isLoading = false;
        const data = action.payload;
        // Backend shape: { user, products: [...] }
        state.items = data?.products || (Array.isArray(data) ? data : []);
        state.count = state.items.length;
      })
      .addCase(fetchWishlist.rejected, (state) => {
        state.isLoading = false;
      })

      .addCase(toggleWishlistItem.pending, (state) => { state.isLoading = true; })
      .addCase(toggleWishlistItem.fulfilled, (state, action) => {
        state.isLoading = false;
        const { data } = action.payload;
        // Both add and remove return the full updated wishlist: { user, products: [...] }
        if (data?.products) {
          state.items = data.products;
          state.count = data.products.length;
        }
      })
      .addCase(toggleWishlistItem.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const { resetWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
