const test = require('node:test');
const assert = require('node:assert/strict');

const {
  dayKey,
  userDayKey,
  startOfDay,
  shiftDayKey,
  daysBetween,
  isConsecutiveDay,
  isValidTimeZone,
} = require('../utils/dayKey');

test('kechqurun 23:00 Toshkentda hali BUGUN — eski UTC kodi ertaga deb yozardi', () => {
  // 2026-06-01 23:30 Toshkent = 2026-06-01T18:30Z
  const evening = new Date('2026-06-01T18:30:00Z');

  assert.equal(dayKey(evening, 'Asia/Tashkent'), '2026-06-01');
  // Eski xatti-harakat solishtirish uchun:
  assert.equal(evening.toISOString().split('T')[0], '2026-06-01');

  // Asosiy holat: mahalliy 01:00 — UTC hali kechagi kun
  const afterMidnight = new Date('2026-06-01T20:00:00Z'); // = 2026-06-02 01:00 Toshkent
  assert.equal(dayKey(afterMidnight, 'Asia/Tashkent'), '2026-06-02');
  assert.equal(
    afterMidnight.toISOString().split('T')[0],
    '2026-06-01',
    'eski UTC mantiqi bu yerda bir kun orqada qolardi'
  );
});

test('mahalliy tunning 04:00 i — UTC kuni allaqachon almashgan, mahalliy kun esa yo\'q', () => {
  // 2026-06-02 04:00 Toshkent = 2026-06-01T23:00Z
  const lateNight = new Date('2026-06-01T23:00:00Z');
  assert.equal(dayKey(lateNight, 'Asia/Tashkent'), '2026-06-02');
});

test('userDayKey foydalanuvchi zonasini oladi, noto\'g\'ri zonada default\'ga qaytadi', () => {
  const d = new Date('2026-06-01T20:00:00Z');
  assert.equal(userDayKey({ timezone: 'Asia/Tashkent' }, d), '2026-06-02');
  assert.equal(userDayKey({ timezone: 'UTC' }, d), '2026-06-01');
  assert.equal(userDayKey({ timezone: 'Not/AZone' }, d), '2026-06-02', 'default Asia/Tashkent');
  assert.equal(userDayKey({}, d), '2026-06-02');
  assert.equal(userDayKey(null, d), '2026-06-02');
});

test('startOfDay mahalliy yarim tunning UTC nuqtasini beradi', () => {
  const start = startOfDay('2026-06-02', 'Asia/Tashkent');
  // Toshkent UTC+5 → mahalliy 00:00 = oldingi kun 19:00Z
  assert.equal(start.toISOString(), '2026-06-01T19:00:00.000Z');
  // Aylanma tekshiruv
  assert.equal(dayKey(start, 'Asia/Tashkent'), '2026-06-02');
});

test('shiftDayKey oy va yil chegarasidan to\'g\'ri o\'tadi', () => {
  assert.equal(shiftDayKey('2026-06-01', -1), '2026-05-31');
  assert.equal(shiftDayKey('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDayKey('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDayKey('2028-02-28', 1), '2028-02-29', 'kabisa yili');
});

test('daysBetween va isConsecutiveDay', () => {
  assert.equal(daysBetween('2026-06-01', '2026-06-02'), 1);
  assert.equal(daysBetween('2026-06-02', '2026-06-01'), -1);
  assert.equal(daysBetween('2026-06-01', '2026-06-01'), 0);
  assert.equal(daysBetween('2026-02-27', '2026-03-01'), 2);

  assert.equal(isConsecutiveDay('2026-06-01', '2026-06-02'), true);
  assert.equal(isConsecutiveDay('2026-06-01', '2026-06-03'), false, 'kun o\'tkazib yuborildi');
  assert.equal(isConsecutiveDay('2026-06-01', '2026-06-01'), false, 'bir xil kun');
});

test('isValidTimeZone', () => {
  assert.equal(isValidTimeZone('Asia/Tashkent'), true);
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('Mars/Olympus'), false);
  assert.equal(isValidTimeZone(''), false);
  assert.equal(isValidTimeZone(null), false);
  assert.equal(isValidTimeZone(123), false);
});
