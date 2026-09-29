const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const User = require('../models/User');
const Word = require('../models/Word');
const Session = require('../models/Session');

/**
 * Profil va hisob boshqaruvi. Ilgari onboarding "keyinroq o'zgartirasiz"
 * deb va'da qilardi, lekin buning uchun hech qanday endpoint yo'q edi.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

const PASSWORD = 'password12345';

test('profilni qisman tahrirlash mumkin', async () => {
  const api = makeClient();
  await api.register();

  const res = await api.patch('/api/auth/profile', { name: 'Yangi Ism', goal: 'vocabulary' });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.name, 'Yangi Ism');
  assert.equal(res.data.onboarding.goal, 'vocabulary');
  // Yuborilmagan maydon o'zgarmaydi
  assert.equal(res.data.onboarding.level, 'beginner');

  const me = await api.get('/api/auth/me');
  assert.equal(me.data.name, 'Yangi Ism');
});

test("profil: noto'g'ri qiymat va bo'sh so'rov rad etiladi", async () => {
  const api = makeClient();
  await api.register();

  assert.equal((await api.patch('/api/auth/profile', { level: 'expert' })).status, 400);
  assert.equal((await api.patch('/api/auth/profile', {})).status, 400);
  // Ruxsat etilmagan maydon (masalan XP) orqali profilni buzib bo'lmaydi
  assert.equal((await api.patch('/api/auth/profile', { name: 'Ali', xp: 99999 })).status, 400);
});

test("parolni o'zgartirish: joriy parol tekshiriladi, boshqa sessiyalar yopiladi", async () => {
  const email = `pw${Date.now()}@test.uz`;
  const phone = makeClient();
  await phone.register(email);
  const laptop = makeClient();
  const login = await laptop.post('/api/auth/login', { email, password: PASSWORD });
  laptop.setToken(login.data.token);

  const wrong = await laptop.post('/api/auth/change-password', { currentPassword: 'xato-parol', newPassword: 'yangiparol123' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.data.code, 'WRONG_PASSWORD');

  const ok = await laptop.post('/api/auth/change-password', { currentPassword: PASSWORD, newPassword: 'yangiparol123' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.ok(ok.data.token, 'joriy qurilma yangi token olishi kerak');

  // Telefondagi eski refresh sessiya endi ishlamaydi
  assert.equal((await phone.post('/api/auth/refresh')).status, 401);
  // Laptop o'z yangi sessiyasini saqlaydi
  assert.equal((await laptop.post('/api/auth/refresh')).status, 200);

  // Yangi parol bilan kirish mumkin, eskisi bilan emas
  const anon = makeClient();
  assert.equal((await anon.post('/api/auth/login', { email, password: PASSWORD })).status, 401);
  assert.equal((await anon.post('/api/auth/login', { email, password: 'yangiparol123' })).status, 200);
});

test("hisobni o'chirish barcha ma'lumotni olib tashlaydi", async () => {
  const api = makeClient();
  const reg = await api.register();
  const userId = reg.data._id;
  await api.post('/api/words', { word: 'river', skipAI: true, manualTranslation: 'daryo' });

  const wrong = await api.del('/api/auth/account', { password: 'xato' });
  assert.equal(wrong.status, 400);
  assert.ok(await User.findById(userId), "noto'g'ri parol bilan hisob o'chmasligi kerak");

  const res = await api.del('/api/auth/account', { password: PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(await User.findById(userId), null);
  assert.equal(await Word.countDocuments({ user: userId }), 0);
  assert.equal(await Session.countDocuments({ user: userId }), 0);

  assert.equal((await api.get('/api/auth/me')).status, 401);
});

test("faol pullik obunasi bor hisob o'chirilmaydi", async () => {
  const api = makeClient();
  const reg = await api.register();
  await User.updateOne(
    { _id: reg.data._id },
    { $set: { 'subscription.plan': 'pro', 'subscription.status': 'active' } }
  );

  const res = await api.del('/api/auth/account', { password: PASSWORD });
  assert.equal(res.status, 409);
  assert.equal(res.data.code, 'ACTIVE_SUBSCRIPTION');
  assert.ok(await User.findById(reg.data._id));
});
