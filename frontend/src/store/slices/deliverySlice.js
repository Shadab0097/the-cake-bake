import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError.mjs';
import { addToast } from './toastSlice';
import { getCurrentPosition } from '@/lib/geolocation.mjs';
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
  isDetecting: false,
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

/**
 * Auto-detect the customer's delivery location:
 *   browser GPS → backend reverse-geocode → pincode → existing checkPincode.
 *
 * checkPincode remains the single source of truth for serviceability and also
 * handles persistence, so this thunk only orchestrates and (for auto-detect)
 * surfaces a friendly toast when the detected area isn't serviceable.
 *
 * @param {{ auto?: boolean }} [opts] auto=true suppresses nothing but enables
 *   the "not serviceable" toast (manual detect shows inline results instead).
 */
export const detectLocation = createAsyncThunk(
  'delivery/detectLocation',
  async ({ auto = false } = {}, { dispatch, rejectWithValue }) => {
    let coords;
    try {
      coords = await getCurrentPosition({ timeout: 10000 });
    } catch (err) {
      // Permission denied / timeout / unsupported — fall back silently.
      return rejectWithValue(err.code || 'GEO_FAILED');
    }

    let geo;
    try {
      const res = await api.post('/delivery/reverse-geocode', {
        lat: coords.lat,
        lng: coords.lng,
      });
      geo = res.data.data || {};
    } catch (err) {
      // LocationIQ disabled / quota exhausted / upstream error — silent fallback.
      return rejectWithValue(getApiErrorMessage(err, 'Could not detect your location'));
    }

    if (!geo.pincode) {
      // Got a fix but no usable Indian pincode — let the user type it.
      return rejectWithValue('NO_PINCODE');
    }

    // Reuse the canonical serviceability check (also persists the result).
    let result;
    try {
      result = await dispatch(checkPincode(geo.pincode)).unwrap();
    } catch (err) {
      return rejectWithValue(typeof err === 'string' ? err : 'CHECK_FAILED');
    }

    if (auto) {
      if (result.status === 'unavailable') {
        dispatch(
          addToast({
            type: 'error',
            message: `We don’t deliver to your area (${geo.pincode}) yet — but feel free to browse our cakes!`,
            duration: 6000,
          })
        );
      } else if (result.status === 'coming_soon') {
        dispatch(
          addToast({
            type: 'info',
            message: `Delivery to ${result.city || geo.city || 'your area'} is launching soon — browse now, order shortly!`,
            duration: 6000,
          })
        );
      }
    }

    return { pincode: geo.pincode, detectedCity: geo.city, ...result };
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
      })
      // detectLocation only tracks the spinner; checkPincode (dispatched inside
      // it) mutates the actual location state and persistence.
      .addCase(detectLocation.pending, (state) => {
        state.isDetecting = true;
        state.error = null;
      })
      .addCase(detectLocation.fulfilled, (state) => {
        state.isDetecting = false;
      })
      .addCase(detectLocation.rejected, (state) => {
        state.isDetecting = false;
      });
  },
});

export const { hydrateDeliveryLocation, clearDeliveryLocation: clearDeliveryLocationState } =
  deliverySlice.actions;
export default deliverySlice.reducer;
