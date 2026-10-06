import { setupListeners } from '@reduxjs/toolkit/query';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  createTransform,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { apiSlice } from '../features/api/apiSlice';
import authReducer from '../features/auth/authSlice';
import { sanitizePersistedApi } from './persistedApi';

const apiTransform = createTransform(
  state => sanitizePersistedApi(state),
  state => sanitizePersistedApi(state),
  { whitelist: [apiSlice.reducerPath] }
);

/**
 * Access token hech qachon localStorage'ga yozilmaydi: XSS bo'lsa u darhol
 * o'g'irlanardi. Chiquvchi tomonda ham tozalanadi — yangilanishdan oldin
 * saqlangan eski token qayta tiklanmasin.
 */
const stripToken = (state) => (state && state.token ? { ...state, token: null } : state);
const authTransform = createTransform(stripToken, stripToken, { whitelist: ['auth'] });

const rootReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  auth: authReducer,
});

const persistConfig = {
  key: 'linguist-root',
  storage,
  whitelist: ['auth', apiSlice.reducerPath],
  transforms: [apiTransform, authTransform],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(apiSlice.middleware),
});

setupListeners(store.dispatch);

export const persistor = persistStore(store);
