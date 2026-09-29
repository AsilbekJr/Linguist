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

/**
 * Serverda sessiya allaqachon yo'q bo'lganda (masalan hisob o'chirilgach)
 * faqat qurilmadagi holatni tozalash — logout so'rovi yuborilmaydi.
 */
export const clearLocalSession = async (dispatch) => {
  dispatch(logout());
  dispatch(apiSlice.util.resetApiState());
  resetIdentity();
  await persistor.purge();
};
