import { createSlice } from '@reduxjs/toolkit';

/**
 * `token` faqat xotirada — store.js uni saqlashdan chiqarib tashlaydi.
 * `isAuthenticated` esa saqlanadi: u "bu qurilmada sessiya bor edi" degan
 * belgi, sahifa qayta ochilganda token refresh cookie orqali tiklanadi.
 */
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  lastAuthAt: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = !!token;
      if (token) state.lastAuthAt = Date.now();
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.lastAuthAt = null;
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;

export default authSlice.reducer;
