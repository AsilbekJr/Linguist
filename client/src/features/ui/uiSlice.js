import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  // Navigation is now handled by react-router-dom
  // Other global UI state (like modals) can go here later
  sidebarOpen: false, 
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    }
  },
});

export const { toggleSidebar, setSidebarOpen } = uiSlice.actions;

export default uiSlice.reducer;
