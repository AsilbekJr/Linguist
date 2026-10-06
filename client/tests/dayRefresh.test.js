import test from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyInZone, millisecondsUntilNextDay, watchDayChange } from '../src/utils/dayRefresh.js';
test('Tashkent midnight changes the day while UTC is still yesterday', () => {
  assert.equal(dayKeyInZone('Asia/Tashkent', new Date('2026-10-02T18:59:59Z')), '2026-10-02');
  assert.equal(dayKeyInZone('Asia/Tashkent', new Date('2026-10-02T19:00:00Z')), '2026-10-03');
});

test('the next midnight accounts for daylight saving time', () => {
  assert.equal(millisecondsUntilNextDay('Europe/London', new Date('2026-10-24T23:00:00Z')), 25 * 60 * 60 * 1000);
  assert.equal(millisecondsUntilNextDay('Europe/London', new Date('2026-03-29T00:00:00Z')), 23 * 60 * 60 * 1000);
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

test('day refresh is scheduled at midnight and rescheduled after returning to the tab', () => {
  let now = new Date('2026-10-02T18:59:59.500Z');
  let delay;
  let tick;
  let visible;
  let calls = 0;
  const cleanup = watchDayChange({
    timezone: 'Asia/Tashkent', today: '2026-10-02', now: () => now, refresh: () => calls++,
    schedule: (fn, ms) => { tick = fn; delay = ms; return 1; }, cancel: () => {},
    target: { addEventListener: (_type, fn) => { visible = fn; }, removeEventListener: () => {} },
  });
  assert.equal(delay, 500);
  now = new Date('2026-10-02T19:00:00Z');
  tick();
  assert.equal(calls, 1);
  assert.equal(delay, 24 * 60 * 60 * 1000);
  now = new Date('2026-10-04T07:00:00Z');
  visible();
  assert.equal(calls, 2);
  assert.equal(delay, 12 * 60 * 60 * 1000);
  cleanup();
});
