import { dayKeyInZone } from '../utils/dayRefresh.js';

const DAILY_QUERIES = new Set(['getMe', 'getCurrentTopic', 'getReviewDue', 'getPhrasesDue', 'getSpeakToday']);
const PERSISTED_QUERIES = new Set([...DAILY_QUERIES, 'getSubscription']);

/** A saved request cannot still be running in a new tab. Keep only usable data. */
export const sanitizePersistedApi = (state, now = new Date()) => {
  if (!state?.queries) return state;
  const profile = Object.values(state.queries).find(query => query?.endpointName === 'getMe')?.data;
  const timezone = profile?.timezone;
  const today = dayKeyInZone(timezone, now);
  const queries = {};
  for (const [key, query] of Object.entries(state.queries)) {
    if (!query) continue;
    const endpoint = query.endpointName || key.split('(')[0];
    if (!PERSISTED_QUERIES.has(endpoint) || query.data === undefined) continue;
    if (DAILY_QUERIES.has(endpoint)) {
      const dataDay = query.data?.today || query.data?.dayKey;
      const fetchedDay = query.fulfilledTimeStamp ? dayKeyInZone(timezone, new Date(query.fulfilledTimeStamp)) : query.persistedDay;
      if (fetchedDay !== today || (dataDay && dataDay !== today) || (profile?.today && profile.today !== today)) continue;
    }
    const saved = { ...query, status: 'fulfilled', fulfilledTimeStamp: query.status === 'fulfilled' ? query.fulfilledTimeStamp || 0 : 0 };
    if (DAILY_QUERIES.has(endpoint)) saved.persistedDay = today;
    delete saved.error;
    queries[key] = saved;
  }
  return { ...state, queries, mutations: {}, subscriptions: {} };
};
