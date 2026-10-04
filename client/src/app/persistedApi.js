const PERSISTED_QUERIES = new Set(['getMe', 'getCurrentTopic', 'getReviewDue', 'getSubscription']);

/** A saved request cannot still be running in a new tab. Keep only usable data. */
export const sanitizePersistedApi = state => {
  if (!state?.queries) return state;
  const queries = {};
  for (const [key, query] of Object.entries(state.queries)) {
    if (!PERSISTED_QUERIES.has(query.endpointName || key.split('(')[0]) || query.data === undefined) continue;
    const saved = { ...query, status: 'fulfilled', fulfilledTimeStamp: query.fulfilledTimeStamp || 0 };
    delete saved.error;
    queries[key] = saved;
  }
  return { ...state, queries, mutations: {}, subscriptions: {} };
};
