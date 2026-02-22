import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeTab: 'word-lab',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
  },
});

export const { setActiveTab } = uiSlice.actions;

export default uiSlice.reducer;
