const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');

/**
 * Google orqali kirish. Google'ga so'rov yuborilmaydi: token tekshiruvi
 * almashtiriladi — bu testlar BIZNING mantiqimizni sinaydi (hisob topish,
 * bog'lash, oldindan egallashdan himoya), Google kutubxonasini emas.
 */

const googleAuth = require('../services/googleAuth');
const User = require('../models/User');
const Session = require('../models/Session');

/** credential satri → Google javobi */
const fakeTokens = new Map();
const originalVerify = googleAuth.verifyGoogleCredential;

test.before(async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  googleAuth.verifyGoogleCredential = async (credential) =>
    fakeTokens.get(credential) || { error: 'INVALID_GOOGLE_TOKEN' };
  await start();
});
test.after(async () => {
  googleAuth.verifyGoogleCredential = originalVerify;
  delete process.env.GOOGLE_CLIENT_ID;
  await stop();
});

let seq = 0;
const googleUser = (overrides = {}) => {
  seq += 1;
  const credential = `fake-google-credential-${Date.now()}-${seq}`;
  const profile = {
    googleId: `g-${Date.now()}-${seq}`,
    email: `g${Date.now()}${seq}@gmail.com`,
    name: 'Google User',
    ...overrides,
  };
  fakeTokens.set(credential, profile);
  return { credential, ...profile };
};

test('yangi foydalanuvchi: hisob parolsiz va email tasdiqlangan holda ochiladi', async () => {
  const g = googleUser();
  const api = makeClient();
  const res = await api.post('/api/auth/google', { credential: g.credential });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.ok(res.data.token);
  assert.equal(res.data.emailVerified, true);
  assert.equal(res.data.hasPassword, false);

  api.setToken(res.data.token);
  assert.equal((await api.get('/api/auth/me')).status, 200);

  // Ikkinchi marta — o'sha hisob, yangisi emas
  const again = await makeClient().post('/api/auth/google', { credential: g.credential });
  assert.equal(again.status, 200);
  assert.equal(again.data._id, res.data._id);
  assert.equal(await User.countDocuments({ email: g.email }), 1);
});

test('yaroqsiz yoki tasdiqlanmagan Google tokeni rad etiladi', async () => {
  const api = makeClient();
  const bad = await api.post('/api/auth/google', { credential: 'x'.repeat(40) });
  assert.equal(bad.status, 401);

  const credential = `unverified-${Date.now()}-xxxxxxxxxxxx`;
  fakeTokens.set(credential, { error: 'GOOGLE_EMAIL_NOT_VERIFIED' });
  const unverified = await api.post('/api/auth/google', { credential });
  assert.equal(unverified.status, 401);
  assert.equal(unverified.data.code, 'GOOGLE_EMAIL_NOT_VERIFIED');
});

test('tasdiqlangan mavjud hisob Google bilan bog\'lanadi, parol saqlanadi', async () => {
  const api = makeClient();
  const email = `linked${Date.now()}@gmail.com`;
  await api.register(email);
  await User.updateOne({ email }, { emailVerified: true });

  const g = googleUser({ email });
  const res = await makeClient().post('/api/auth/google', { credential: g.credential });
  assert.equal(res.status, 200);
  assert.equal(res.data.hasPassword, true);

  // Eski parol ham ishlayveradi
  assert.equal((await makeClient().post('/api/auth/login', { email, password: 'password12345' })).status, 200);
});

test('tasdiqlanmagan hisob bog\'langanda begona parol va sessiyalar o\'chiriladi (oldindan egallash)', async () => {
  // Hujumchi qurbonning emaili bilan parol qo'yib ro'yxatdan o'tgan
  const attacker = makeClient();
  const email = `victim${Date.now()}@gmail.com`;
  await attacker.register(email);
  const attackerUser = await User.findOne({ email });

  // Haqiqiy egasi Google bilan kiradi
  const g = googleUser({ email });
  const victim = await makeClient().post('/api/auth/google', { credential: g.credential });
  assert.equal(victim.status, 200);
  assert.equal(victim.data._id, String(attackerUser._id));
  assert.equal(victim.data.hasPassword, false);
  assert.equal(victim.data.emailVerified, true);

  // Hujumchining paroli ham, ochiq sessiyasi ham endi ishlamaydi
  assert.equal((await makeClient().post('/api/auth/login', { email, password: 'password12345' })).status, 401);
  assert.equal((await attacker.get('/api/auth/me')).status, 401);
  const alive = await Session.countDocuments({ user: attackerUser._id, revokedAt: null });
  assert.equal(alive, 1, 'faqat Google kirishining sessiyasi qolishi kerak');
});

test('Google hisobi: birinchi parol joriy parolsiz o\'rnatiladi, keyin oddiy tartib', async () => {
  const g = googleUser();
  const api = makeClient();
  const res = await api.post('/api/auth/google', { credential: g.credential });
  api.setToken(res.data.token);

  // Parolsiz hisob email+parol bilan kira olmaydi
  assert.equal((await makeClient().post('/api/auth/login', { email: g.email, password: 'anything123' })).status, 401);

  const set = await api.post('/api/auth/change-password', { newPassword: 'birinchiParol1' });
  assert.equal(set.status, 200, JSON.stringify(set.data));
  api.setToken(set.data.token);
  assert.equal((await api.get('/api/auth/me')).data.hasPassword, true);
  assert.equal((await makeClient().post('/api/auth/login', { email: g.email, password: 'birinchiParol1' })).status, 200);

  // Endi parol bor — joriy parolsiz o'zgartirib bo'lmaydi
  const noCurrent = await api.post('/api/auth/change-password', { newPassword: 'ikkinchiParol2' });
  assert.equal(noCurrent.status, 400);
  assert.equal(noCurrent.data.code, 'WRONG_PASSWORD');
});

test('parolsiz hisob emailni yozib o\'chiriladi', async () => {
  const g = googleUser();
  const api = makeClient();
  const res = await api.post('/api/auth/google', { credential: g.credential });
  api.setToken(res.data.token);

  const wrong = await api.del('/api/auth/account', { confirmEmail: 'boshqa@gmail.com' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.data.code, 'WRONG_CONFIRM_EMAIL');

  const ok = await api.del('/api/auth/account', { confirmEmail: g.email.toUpperCase() });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(await User.countDocuments({ email: g.email }), 0);
});

test('Google sozlanmagan bo\'lsa 503', async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  try {
    const res = await makeClient().post('/api/auth/google', { credential: 'y'.repeat(40) });
    assert.equal(res.status, 503);
  } finally {
    process.env.GOOGLE_CLIENT_ID = saved;
  }
});
