import { logout } from '../features/auth/authSlice';
import { apiSlice } from '../features/api/apiSlice';
import { persistor, store } from '../app/store';

export const performLogout = async (dispatch) => {
  try {
    await store.dispatch(apiSlice.endpoints.logoutSession.initiate()).unwrap();
  } catch {
    // ignore network errors on logout
  }
  dispatch(logout());
  dispatch(apiSlice.util.resetApiState());
  await persistor.purge();
};
