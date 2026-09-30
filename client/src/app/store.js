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
import uiReducer from '../features/ui/uiSlice';
import authReducer from '../features/auth/authSlice';

const PERSISTED_QUERIES = new Set([
  'getMe',
  'getCurrentTopic',
  'getReviewDue',
  'getSubscription',
]);

const apiTransform = createTransform(
  (inboundState) => {
    if (!inboundState?.queries) return inboundState;
    const queries = {};
    for (const [key, value] of Object.entries(inboundState.queries)) {
      const endpoint = key.split('(')[0];
      if (PERSISTED_QUERIES.has(endpoint)) {
        queries[key] = value;
      }
    }
    return { ...inboundState, queries, mutations: {} };
  },
  (outboundState) => outboundState,
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
  ui: uiReducer,
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

export const persistor = persistStore(store);
