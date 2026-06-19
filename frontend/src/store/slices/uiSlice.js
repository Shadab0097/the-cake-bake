import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    isSearchOpen: false,
    isMobileMenuOpen: false,
    isDeliveryPopoverOpen: false,
    isLoading: false,
  },
  reducers: {
    toggleDeliveryPopover: (state) => {
      state.isDeliveryPopoverOpen = !state.isDeliveryPopoverOpen;
    },
    openDeliveryPopover: (state) => {
      state.isDeliveryPopoverOpen = true;
    },
    closeDeliveryPopover: (state) => {
      state.isDeliveryPopoverOpen = false;
    },
    toggleSearch: (state) => {
      state.isSearchOpen = !state.isSearchOpen;
    },
    openSearch: (state) => {
      state.isSearchOpen = true;
    },
    closeSearch: (state) => {
      state.isSearchOpen = false;
    },
    toggleMobileMenu: (state) => {
      state.isMobileMenuOpen = !state.isMobileMenuOpen;
    },
    closeMobileMenu: (state) => {
      state.isMobileMenuOpen = false;
    },
    setGlobalLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  toggleSearch,
  openSearch,
  closeSearch,
  toggleMobileMenu,
  closeMobileMenu,
  toggleDeliveryPopover,
  openDeliveryPopover,
  closeDeliveryPopover,
  setGlobalLoading,
} = uiSlice.actions;
export default uiSlice.reducer;
