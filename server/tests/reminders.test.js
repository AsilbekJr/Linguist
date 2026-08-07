const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldSendReminder, buildReminderContent, localHour, SKIP } = require('../utils/reminders');

/** 19:00 Toshkent = 14:00 UTC */
const AT_19_TASHKENT = new Date('2026-06-10T14:00:00Z');

const makeUser = (over = {}) => ({
  name: 'Aziz',
  email: 'aziz@test.uz',
  timezone: 'Asia/Tashkent',
  onboarding: { completed: true },
  currentStreak: 0,
  lastStreakDay: '2026-06-09',
  dailyQuests: { date: '2026-06-10', reviewCompleted: false, topicCompleted: false, immersionCompleted: false },
  notifications: { email: { enabled: true, hour: 19, lastSentDay: '' } },
  streakFreeze: { available: 2 },
  ...over,
});

test('mahalliy soat vaqt zonasiga qarab hisoblanadi', () => {
  assert.equal(localHour({ timezone: 'Asia/Tashkent' }, AT_19_TASHKENT), 19);
  assert.equal(localHour({ timezone: 'UTC' }, AT_19_TASHKENT), 14);
  assert.equal(localHour({}, AT_19_TASHKENT), 19, 'default Asia/Tashkent');
});

test('reja bajarilmagan foydalanuvchiga mahalliy 19:00 da yuboriladi', () => {
  const res = shouldSendReminder(makeUser(), AT_19_TASHKENT);
  assert.equal(res.send, true);
  assert.equal(res.todayKey, '2026-06-10');
});

test('boshqa soatda yuborilmaydi', () => {
  const at15 = new Date('2026-06-10T10:00:00Z'); // 15:00 Toshkent
  const res = shouldSendReminder(makeUser(), at15);
  assert.equal(res.send, false);
  assert.equal(res.reason, SKIP.WRONG_HOUR);
});

test('foydalanuvchi tanlagan soat hurmat qilinadi', () => {
  const user = makeUser({ notifications: { email: { enabled: true, hour: 9, lastSentDay: '' } } });
  assert.equal(shouldSendReminder(user, AT_19_TASHKENT).send, false);

  const at9 = new Date('2026-06-10T04:00:00Z'); // 09:00 Toshkent
  assert.equal(shouldSendReminder(user, at9).send, true);
});

test("kunlik reja tugagan bo'lsa yuborilmaydi", () => {
  const user = makeUser({
    dailyQuests: {
      date: '2026-06-10',
      reviewCompleted: true,
      topicCompleted: true,
      immersionCompleted: true,
    },
  });
  const res = shouldSendReminder(user, AT_19_TASHKENT);
  assert.equal(res.send, false);
  assert.equal(res.reason, SKIP.PLAN_DONE);
});

test('kuniga faqat bir marta', () => {
  const user = makeUser({
    notifications: { email: { enabled: true, hour: 19, lastSentDay: '2026-06-10' } },
  });
  const res = shouldSendReminder(user, AT_19_TASHKENT);
  assert.equal(res.send, false);
  assert.equal(res.reason, SKIP.ALREADY_SENT);
});

test("kechagi yuborish bugungisiga to'sqinlik qilmaydi", () => {
  const user = makeUser({
    notifications: { email: { enabled: true, hour: 19, lastSentDay: '2026-06-09' } },
  });
  assert.equal(shouldSendReminder(user, AT_19_TASHKENT).send, true);
});

test("o'chirilgan bo'lsa yuborilmaydi", () => {
  const user = makeUser({ notifications: { email: { enabled: false, hour: 19 } } });
  const res = shouldSendReminder(user, AT_19_TASHKENT);
  assert.equal(res.send, false);
  assert.equal(res.reason, SKIP.DISABLED);
});

test('onboarding tugamagan foydalanuvchi bezovta qilinmaydi', () => {
  const user = makeUser({ onboarding: { completed: false } });
  const res = shouldSendReminder(user, AT_19_TASHKENT);
  assert.equal(res.send, false);
  assert.equal(res.reason, SKIP.ONBOARDING);
});

test('uzoq vaqt kirmagan foydalanuvchiga to\'xtaymiz — spam va pochta obro\'si', () => {
  const user = makeUser({ lastStreakDay: '2026-04-01' }); // 70 kun oldin
  const res = shouldSendReminder(user, AT_19_TASHKENT);
  assert.equal(res.send, false);
  assert.equal(res.reason, SKIP.DORMANT);
});

test('hech qachon faol bo\'lmagan, lekin yaqinda ro\'yxatdan o\'tgan — yuboriladi', () => {
  const user = makeUser({ lastStreakDay: '', createdAt: new Date('2026-06-08T10:00:00Z') });
  assert.equal(shouldSendReminder(user, AT_19_TASHKENT).send, true);
});

test('hech qachon faol bo\'lmagan va uzoq oldin ro\'yxatdan o\'tgan — yuborilmaydi', () => {
  const user = makeUser({ lastStreakDay: '', createdAt: new Date('2026-01-01T10:00:00Z') });
  const res = shouldSendReminder(user, AT_19_TASHKENT);
  assert.equal(res.send, false);
  assert.equal(res.reason, SKIP.DORMANT);
});

test('emailsiz foydalanuvchi tashlab ketiladi', () => {
  const res = shouldSendReminder(makeUser({ email: '' }), AT_19_TASHKENT);
  assert.equal(res.send, false);
  assert.equal(res.reason, SKIP.NO_EMAIL);
});

// ── Xabar mazmuni ─────────────────────────────────────────────────────────

test('streak bor bo\'lsa xabar aynan streak haqida bo\'ladi', () => {
  const content = buildReminderContent(makeUser({ currentStreak: 7 }));
  assert.match(content.subject, /7/);
  assert.match(content.headline, /muzlatish/i, 'muzlatish borligi aytilishi kerak');
});

test('muzlatish qolmagan bo\'lsa xabar buni ochiq aytadi', () => {
  const content = buildReminderContent(
    makeUser({ currentStreak: 5, streakFreeze: { available: 0 } })
  );
  assert.match(content.headline, /qolmagan/i);
});

test('streak yo\'q, lekin takrorlash kutmoqda', () => {
  const content = buildReminderContent(makeUser(), { dueCount: 12 });
  assert.match(content.subject, /12/);
  assert.match(content.headline, /unutila/i);
});

test('yangi foydalanuvchi uchun umumiy xabar', () => {
  const content = buildReminderContent(makeUser(), { dueCount: 0 });
  assert.match(content.subject, /3 qadam/);
});

test('qolgan qadamlar aniq sanab o\'tiladi', () => {
  const content = buildReminderContent(
    makeUser({
      dailyQuests: {
        date: '2026-06-10',
        topicCompleted: true,
        reviewCompleted: false,
        immersionCompleted: false,
      },
    })
  );
  assert.deepEqual(content.remaining, ['Takrorlash', 'Amaliyot']);
  assert.ok(!content.stepsLine.includes('Kunlik sahna'), 'bajarilgan qadam sanalmasligi kerak');
});
