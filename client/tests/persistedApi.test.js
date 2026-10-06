import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePersistedApi } from '../src/app/persistedApi.js';

const now = new Date('2026-10-03T07:00:00Z');
const query = (endpointName, data, time = now.getTime()) => ({ endpointName, data, status: 'fulfilled', fulfilledTimeStamp: time });

test('yesterday daily cache is discarded at Tashkent midnight', () => {
  const old = new Date('2026-10-02T18:59:00Z').getTime();
  const state = { queries: {
    me: query('getMe', { today: '2026-10-02', timezone: 'Asia/Tashkent' }, old),
    topic: query('getCurrentTopic', { dayKey: '2026-10-02' }, old),
    words: query('getReviewDue', [{ _id: 'old-word' }], old),
    speak: query('getSpeakToday', { dayKey: '2026-10-02', preview: {} }, old),
    subscription: query('getSubscription', { plan: 'free' }, old),
  } };
  assert.deepEqual(Object.keys(sanitizePersistedApi(state, now).queries), ['subscription']);
});

test('current day conversation and phrase queue survive a reload', () => {
  const state = { queries: {
    me: query('getMe', { today: '2026-10-03', timezone: 'Asia/Tashkent' }),
    speak: query('getSpeakToday', { dayKey: '2026-10-03', preview: { topicUz: 'Bugun' } }),
    phrases: query('getPhrasesDue', [{ _id: 'phrase' }]),
  }, mutations: { pending: {} }, subscriptions: { oldTab: {} } };
  const saved = sanitizePersistedApi(state, now);
  assert.deepEqual(Object.keys(saved.queries), ['me', 'speak', 'phrases']);
  assert.deepEqual(saved.mutations, {});
  assert.deepEqual(saved.subscriptions, {});
});

test('a saved pending request keeps data but must refetch on reopen', () => {
  const state = { queries: { me: { ...query('getMe', { today: '2026-10-03', timezone: 'Asia/Tashkent' }), status: 'pending' } } };
  assert.equal(sanitizePersistedApi(state, now).queries.me.fulfilledTimeStamp, 0);
});
