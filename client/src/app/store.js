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
  'getWords',
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

const rootReducer = combineReducers({
  [apiSlice.reducerPath]: apiSlice.reducer,
  ui: uiReducer,
  auth: authReducer,
});

const persistConfig = {
  key: 'linguist-root',
  storage,
  whitelist: ['auth', apiSlice.reducerPath],
  transforms: [apiTransform],
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
