process.env.CRON_SECRET = 'test-cron-secret-value';

const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { runReminders } = require('../services/reminderRunner');
const User = require('../models/User');

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

/** Eslatma yuboriladigan holatga keltirilgan foydalanuvchi */
const prepareUser = async (email, over = {}) => {
  const user = await User.findOne({ email });
  user.onboarding = { ...user.onboarding.toObject(), completed: true };
  user.timezone = 'Asia/Tashkent';
  user.notifications = { email: { enabled: true, hour: 19, lastSentDay: '' } };
  user.dailyQuests = {
    date: '2026-06-10',
    reviewCompleted: false,
    topicCompleted: false,
    immersionCompleted: false,
  };
  user.lastStreakDay = '2026-06-09';
  Object.assign(user, over);
  await user.save();
  return user;
};

const AT_19_TASHKENT = new Date('2026-06-10T14:00:00Z');

test('sozlamalar o\'qiladi va yangilanadi', async () => {
  const api = makeClient();
  await api.register();

  const initial = await api.get('/api/notifications/preferences');
  assert.equal(initial.status, 200);
  assert.equal(initial.data.enabled, true, 'default yoqilgan bo\'lishi kerak');
  assert.equal(initial.data.hour, 19);

  const updated = await api.put('/api/notifications/preferences', { hour: 9 });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.hour, 9);

  const off = await api.put('/api/notifications/preferences', { enabled: false });
  assert.equal(off.data.enabled, false);
  assert.equal(off.data.hour, 9, 'soat saqlanib qolishi kerak');

  const reread = await api.get('/api/notifications/preferences');
  assert.equal(reread.data.enabled, false);
  assert.equal(reread.data.hour, 9);
});

test('yaroqsiz sozlama rad etiladi', async () => {
  const api = makeClient();
  await api.register();

  assert.equal((await api.put('/api/notifications/preferences', { hour: 25 })).status, 400);
  assert.equal((await api.put('/api/notifications/preferences', { hour: -1 })).status, 400);
  assert.equal((await api.put('/api/notifications/preferences', {})).status, 400);
});

test('sozlamalarga tokensiz kirib bo\'lmaydi', async () => {
  const anon = makeClient();
  assert.equal((await anon.get('/api/notifications/preferences')).status, 401);
  assert.equal((await anon.put('/api/notifications/preferences', { hour: 9 })).status, 401);
});

test('cron endpointi sirsiz ishlamaydi', async () => {
  const api = makeClient();
  const res = await api.post('/api/notifications/run');
  assert.equal(res.status, 401);
});

test('runReminders reja bajarilmagan foydalanuvchiga yuboradi', async () => {
  const api = makeClient();
  const email = `rem${Date.now()}@test.uz`;
  await api.register(email);
  await prepareUser(email);

  const stats = await runReminders(AT_19_TASHKENT, { dryRun: true });
  assert.ok(stats.sent >= 1, `yuborilmadi: ${JSON.stringify(stats)}`);

  const user = await User.findOne({ email });
  assert.equal(user.notifications.email.lastSentDay, '2026-06-10');
  assert.equal(user.notifications.email.sentCount, 1);
  assert.ok(user.notifications.unsubscribeToken, 'obunani bekor qilish tokeni yaratilmadi');
});

test('ikkinchi yugurish bir kunda takroriy yubormaydi', async () => {
  const api = makeClient();
  const email = `once${Date.now()}@test.uz`;
  await api.register(email);
  await prepareUser(email);

  const first = await runReminders(AT_19_TASHKENT, { dryRun: true });
  const sentFirst = first.sent;
  assert.ok(sentFirst >= 1);

  const second = await runReminders(AT_19_TASHKENT, { dryRun: true });
  assert.ok(
    (second.reasons.already_sent || 0) >= 1,
    `takroriy yuborishdan himoya ishlamadi: ${JSON.stringify(second)}`
  );

  const user = await User.findOne({ email });
  assert.equal(user.notifications.email.sentCount, 1, 'ikki marta yuborildi');
});

test('reja bajarilgan foydalanuvchiga yuborilmaydi', async () => {
  const api = makeClient();
  const email = `done${Date.now()}@test.uz`;
  await api.register(email);
  await prepareUser(email, {
    dailyQuests: {
      date: '2026-06-10',
      reviewCompleted: true,
      topicCompleted: true,
      immersionCompleted: true,
    },
  });

  const stats = await runReminders(AT_19_TASHKENT, { dryRun: true });
  assert.ok((stats.reasons.plan_done || 0) >= 1, JSON.stringify(stats.reasons));

  const user = await User.findOne({ email });
  assert.equal(user.notifications.email.sentCount || 0, 0);
});

test('obunani bekor qilish loginsiz ishlaydi', async () => {
  const api = makeClient();
  const email = `unsub${Date.now()}@test.uz`;
  await api.register(email);
  await prepareUser(email);
  await runReminders(AT_19_TASHKENT, { dryRun: true });

  const user = await User.findOne({ email });
  const token = user.notifications.unsubscribeToken;

  // Tokensiz mijoz — xatdagi havolani bosgan odam login qilmagan bo'lishi mumkin
  const anon = makeClient();
  const res = await anon.post('/api/notifications/unsubscribe', { token });
  assert.equal(res.status, 200);

  const after = await User.findOne({ email });
  assert.equal(after.notifications.email.enabled, false);

  // Endi eslatma yuborilmasligi kerak
  after.notifications.email.lastSentDay = '';
  await after.save();
  const stats = await runReminders(AT_19_TASHKENT, { dryRun: true });
  const stillDisabled = await User.findOne({ email });
  assert.equal(stillDisabled.notifications.email.sentCount, 1, 'o\'chirilgandan keyin ham yuborildi');
  assert.ok(stats);
});

test('yaroqsiz token ham muvaffaqiyat qaytaradi (token taxmin qilishni ma\'nosiz qiladi)', async () => {
  const anon = makeClient();
  const res = await anon.post('/api/notifications/unsubscribe', { token: 'a'.repeat(48) });
  assert.equal(res.status, 200);
  assert.ok(!res.data.email, 'mavjud bo\'lmagan token uchun email qaytmasligi kerak');
});

test('noto\'g\'ri soatda hech kimga yuborilmaydi', async () => {
  const api = makeClient();
  const email = `hour${Date.now()}@test.uz`;
  await api.register(email);
  await prepareUser(email);

  const at15 = new Date('2026-06-10T10:00:00Z'); // 15:00 Toshkent
  const stats = await runReminders(at15, { dryRun: true });

  const user = await User.findOne({ email });
  assert.equal(user.notifications.email.sentCount || 0, 0);
  assert.ok((stats.reasons.wrong_hour || 0) >= 1);
});
