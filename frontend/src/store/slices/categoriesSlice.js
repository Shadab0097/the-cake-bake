import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';

/**
 * Categories Slice — Single source of truth for category data.
 *
 * Previously, both Navbar and CategoryCarousel independently called
 * api.get('/categories') on every page load, causing duplicate requests.
 * This slice fetches once and both components consume via useSelector.
 */

export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/categories');
      const data = res.data?.data || [];
      const list = Array.isArray(data) ? data : (data.docs || data.items || []);
      return list.filter((c) => c.isActive !== false);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch categories');
    }
  }
);

const categoriesSlice = createSlice({
  name: 'categories',
  initialState: {
    items: [],
    isLoading: false,
    hasFetched: false, // Prevents refetching on every mount
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
        state.hasFetched = true;
      })
      .addCase(fetchCategories.rejected, (state) => {
        state.isLoading = false;
        state.hasFetched = true; // Don't retry infinitely on error
      });
  },
});

export default categoriesSlice.reducer;
