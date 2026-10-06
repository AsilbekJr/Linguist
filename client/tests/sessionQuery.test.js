import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionQuery } from '../src/features/api/sessionQuery.js';

const harness = (raw, auth = { token: 'old', isAuthenticated: true }) => {
  const api = { getState: () => ({ auth }), signal: new AbortController().signal,
    dispatch: action => {
      if (action.type === 'credentials') Object.assign(auth, { token: action.payload.token });
      if (action.type === 'logout') Object.assign(auth, { token: null, isAuthenticated: false });
    } };
  return { api, auth, ...createSessionQuery(raw, {
    credentials: payload => ({ type: 'credentials', payload }), logout: () => ({ type: 'logout' }),
  }) };
};

test('a temporary restoration failure makes no unauthenticated request and keeps login', async () => {
  const paths = [];
  const h = harness(async args => { paths.push(args.url || args); return { error: { status: 'FETCH_ERROR' } }; }, { token: null, isAuthenticated: true });
  const result = await h.baseQuery('/api/topics/current', h.api);
  assert.equal(result.error.status, 'FETCH_ERROR');
  assert.deepEqual(paths, ['/api/auth/refresh']);
  assert.equal(h.auth.isAuthenticated, true);
});

test('late 401 responses retry with the token already renewed by another request', async () => {
  let release;
  let refreshes = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const h = harness(async args => {
    const path = args.url || args;
    if (path === '/api/auth/refresh') { refreshes++; return { data: { token: 'new' } }; }
    if (h.auth.token === 'new') return { data: path };
    if (path === '/late') await gate;
    return { error: { status: 401 } };
  });
  const late = h.baseQuery('/late', h.api);
  await h.baseQuery('/first', h.api);
  release();
  assert.deepEqual(await late, { data: '/late' });
  assert.equal(refreshes, 1);
});

test('concurrent restoration is shared and survives the initiating query cancellation', async () => {
  let release;
  let refreshes = 0;
  let refreshSignal;
  const gate = new Promise(resolve => { release = resolve; });
  const h = harness(async (args, api) => {
    if (args.url === '/api/auth/refresh') {
      refreshes++;
      refreshSignal = api.signal;
      await gate;
      return { data: { token: 'new' } };
    }
    return { data: true };
  }, { token: null, isAuthenticated: true });
  const controller = new AbortController();
  const first = h.baseQuery('/first', { ...h.api, signal: controller.signal });
  const second = h.baseQuery('/second', h.api);
  controller.abort();
  assert.equal(refreshSignal.aborted, false);
  release();
  await Promise.all([first, second]);
  assert.equal(refreshes, 1);
  assert.equal(h.auth.token, 'new');
});

test('only a confirmed rejected refresh signs out', async () => {
  const h = harness(async () => ({ error: { status: 401 } }), { token: null, isAuthenticated: true });
  await h.baseQuery('/api/auth/me', h.api);
  assert.equal(h.auth.isAuthenticated, false);
});

test('a stale refresh cannot sign out a newer login for the same account', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = harness(async () => { await gate; return { error: { status: 401 } }; });
  const pending = h.refreshAccessToken(h.api);
  h.auth.token = 'new-login-token';
  release();
  await pending;
  assert.equal(h.auth.token, 'new-login-token');
  assert.equal(h.auth.isAuthenticated, true);
});
