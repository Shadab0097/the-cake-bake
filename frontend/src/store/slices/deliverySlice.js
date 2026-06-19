import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError.mjs';
import {
  loadDeliveryLocation,
  saveDeliveryLocation,
  clearDeliveryLocation,
} from '@/lib/deliveryLocation.mjs';

// status: null = not chosen | 'live' = serviceable | 'coming_soon' | 'unavailable'
const initialState = {
  pincode: null,
  city: null,
  status: null,
  message: null,
  deliveryCharge: null,
  freeDeliveryAbove: null,
  sameDayAvailable: null,
  sameDayCutoffTime: null,
  isChecking: false,
  error: null,
  _hydrated: false,
};

export const checkPincode = createAsyncThunk(
  'delivery/checkPincode',
  async (pincode, { rejectWithValue }) => {
    try {
      const res = await api.post('/delivery/check-pincode', { pincode });
      return { pincode, ...res.data.data };
    } catch (err) {
      return rejectWithValue(getApiErrorMessage(err, 'Could not check this pincode'));
    }
  }
);

const PERSIST_KEYS = [
  'pincode', 'city', 'status', 'message',
  'deliveryCharge', 'freeDeliveryAbove', 'sameDayAvailable', 'sameDayCutoffTime',
];

const persist = (state) => {
  const snapshot = {};
  for (const key of PERSIST_KEYS) snapshot[key] = state[key];
  saveDeliveryLocation(snapshot);
};

const deliverySlice = createSlice({
  name: 'delivery',
  initialState,
  reducers: {
    hydrateDeliveryLocation: (state) => {
      const saved = loadDeliveryLocation();
      if (saved) {
        for (const key of PERSIST_KEYS) {
          if (saved[key] !== undefined) state[key] = saved[key];
        }
      }
      state._hydrated = true;
    },
    clearDeliveryLocation: (state) => {
      for (const key of PERSIST_KEYS) state[key] = null;
      state.error = null;
      clearDeliveryLocation();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkPincode.pending, (state) => {
        state.isChecking = true;
        state.error = null;
      })
      .addCase(checkPincode.fulfilled, (state, action) => {
        const p = action.payload;
        state.isChecking = false;
        state.pincode = p.pincode || state.pincode;
        state.city = p.city || null;
        state.status = p.status || (p.serviceable ? 'live' : 'unavailable');
        state.message = p.message || null;
        state.deliveryCharge = p.deliveryCharge ?? null;
        state.freeDeliveryAbove = p.freeDeliveryAbove ?? null;
        state.sameDayAvailable = p.sameDayAvailable ?? null;
        state.sameDayCutoffTime = p.sameDayCutoffTime ?? null;
        persist(state);
      })
      .addCase(checkPincode.rejected, (state, action) => {
        state.isChecking = false;
        state.error = action.payload;
      });
  },
});

export const { hydrateDeliveryLocation, clearDeliveryLocation: clearDeliveryLocationState } =
  deliverySlice.actions;
export default deliverySlice.reducer;
