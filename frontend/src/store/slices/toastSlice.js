import { createSlice } from '@reduxjs/toolkit';

let toastId = 0;

const toastSlice = createSlice({
  name: 'toast',
  initialState: {
    toasts: [],
  },
  reducers: {
    addToast: (state, action) => {
      const { message, type = 'info', duration = 4000, link, linkLabel } = action.payload;
      state.toasts.push({
        id: ++toastId,
        message,
        type, // 'success' | 'error' | 'info' | 'warning'
        duration,
        link,       // optional URL
        linkLabel,  // optional label for the link
      });
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts: (state) => {
      state.toasts = [];
    },
  },
});

export const { addToast, removeToast, clearToasts } = toastSlice.actions;
export default toastSlice.reducer;
