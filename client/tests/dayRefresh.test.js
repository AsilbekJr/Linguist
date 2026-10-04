import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyInZone, watchDayChange } from '../src/utils/dayRefresh.js';
test('Tashkent midnight changes the day while UTC is still yesterday', () => {
  assert.equal(dayKeyInZone('Asia/Tashkent', new Date('2026-10-02T18:59:59Z')), '2026-10-02');
  assert.equal(dayKeyInZone('Asia/Tashkent', new Date('2026-10-02T19:00:00Z')), '2026-10-03');
});
test('an old cached day refreshes immediately and on next midnight', () => {
  let now = new Date('2026-10-02T20:00:00Z');
  let calls = 0;
  let tick;
  let cleared = false;
  const cleanup = watchDayChange({
    timezone: 'Asia/Tashkent', today: '2026-10-02', refresh: () => calls++,
    now: () => now, schedule: fn => { tick = fn; return 7; }, cancel: id => { cleared = id === 7; },
  });
  assert.equal(calls, 1);
  tick();
  assert.equal(calls, 1);
  now = new Date('2026-10-03T19:01:00Z');
  tick();
  assert.equal(calls, 2);
  cleanup();
  assert.equal(cleared, true);
});
