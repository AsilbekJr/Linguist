import { logout } from '../features/auth/authSlice';
import { apiSlice } from '../features/api/apiSlice';
import { persistor, store } from '../app/store';
import { resetIdentity } from '../lib/analytics';

export const performLogout = async (dispatch) => {
  try {
    await store.dispatch(apiSlice.endpoints.logoutSession.initiate()).unwrap();
  } catch {
    // ignore network errors on logout
  }
  dispatch(logout());
  dispatch(apiSlice.util.resetApiState());
  // Keyingi foydalanuvchi oldingisining ID'si bilan yozilib qolmasin
  resetIdentity();
  await persistor.purge();
};
