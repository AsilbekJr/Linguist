const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { start, stop, makeClient } = require('./helpers/testServer');

/**
 * Parolni tiklash oqimi.
 *
 * Ilgari bu funksiya umuman yo'q edi: parolni unutgan foydalanuvchi
 * hisobiga qayta kira olmasdi va butunlay yo'qolardi.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

const PasswordResetToken = require('../models/PasswordResetToken');
const { hashToken } = require('../utils/tokens');

/** Testda xat o'qib bo'lmaydi — tokenni bazadan olamiz */
const issueTokenFor = async (email) => {
  const User = require('../models/User');
  const user = await User.findOne({ email });
  const raw = require('crypto').randomBytes(32).toString('hex');
  await PasswordResetToken.create({
    user: user._id,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + 3600_000),
  });
  return raw;
};

test('to\'liq oqim: tiklash so\'rovi → yangi parol → yangi parol bilan kirish', async () => {
  const api = makeClient();
  const email = `reset${Date.now()}@test.uz`;
  await api.register(email);

  const forgot = await api.post('/api/auth/forgot-password', { email });
  assert.equal(forgot.status, 200);

  // Server haqiqatan token yaratdimi
  const User = require('../models/User');
  const user = await User.findOne({ email });
  const stored = await PasswordResetToken.findOne({ user: user._id, usedAt: null });
  assert.ok(stored, 'token yaratilmadi');
  assert.ok(stored.expiresAt > new Date(), 'token muddati o\'tgan');

  // Token bazada OCHIQ saqlanmasligi kerak — faqat hash
  assert.equal(stored.tokenHash.length, 64, 'SHA-256 hash kutilgan');

  const rawToken = await issueTokenFor(email);
  const reset = await api.post('/api/auth/reset-password', {
    token: rawToken,
    password: 'yangiParol12345',
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.data));

  // Eski parol endi ishlamasligi kerak
  const oldLogin = await api.post('/api/auth/login', { email, password: 'password12345' });
  assert.equal(oldLogin.status, 401, 'eski parol hali ham ishlayapti');

  // Yangi parol ishlashi kerak
  const newLogin = await api.post('/api/auth/login', { email, password: 'yangiParol12345' });
  assert.equal(newLogin.status, 200, 'yangi parol ishlamadi');
  assert.ok(newLogin.data.token);
});

test('mavjud bo\'lmagan email uchun ham bir xil javob (foydalanuvchi ro\'yxatini oshkor qilmaslik)', async () => {
  const api = makeClient();
  const realEmail = `exists${Date.now()}@test.uz`;
  await api.register(realEmail);

  const existing = await api.post('/api/auth/forgot-password', { email: realEmail });
  const missing = await api.post('/api/auth/forgot-password', { email: 'yoq@test.uz' });

  assert.equal(existing.status, missing.status, 'status kodlari farq qilyapti');
  assert.deepEqual(existing.data, missing.data, 'javob matni farq qilyapti — email mavjudligi oshkor bo\'ladi');
});

test('token bir martalik — qayta ishlatib bo\'lmaydi', async () => {
  const api = makeClient();
  const email = `once${Date.now()}@test.uz`;
  await api.register(email);

  const raw = await issueTokenFor(email);

  const first = await api.post('/api/auth/reset-password', { token: raw, password: 'birinchiParol1' });
  assert.equal(first.status, 200);

  const second = await api.post('/api/auth/reset-password', { token: raw, password: 'ikkinchiParol1' });
  assert.equal(second.status, 400, 'token ikkinchi marta ishladi');
  assert.equal(second.data.code, 'INVALID_RESET_TOKEN');

  // Ikkinchi urinish parolni o'zgartirmagan bo'lishi kerak
  const login = await api.post('/api/auth/login', { email, password: 'birinchiParol1' });
  assert.equal(login.status, 200);
});

test('muddati o\'tgan token rad etiladi', async () => {
  const api = makeClient();
  const email = `expired${Date.now()}@test.uz`;
  await api.register(email);

  const User = require('../models/User');
  const user = await User.findOne({ email });
  const raw = require('crypto').randomBytes(32).toString('hex');
  await PasswordResetToken.create({
    user: user._id,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() - 1000), // allaqachon o'tgan
  });

  const res = await api.post('/api/auth/reset-password', { token: raw, password: 'yangiParol123' });
  assert.equal(res.status, 400);
  assert.equal(res.data.code, 'INVALID_RESET_TOKEN');
});

test('yaroqsiz token rad etiladi', async () => {
  const api = makeClient();
  const res = await api.post('/api/auth/reset-password', {
    token: 'a'.repeat(64),
    password: 'yangiParol123',
  });
  assert.equal(res.status, 400);
});

test('yangi so\'rov eski havolani bekor qiladi', async () => {
  const api = makeClient();
  const email = `rotate${Date.now()}@test.uz`;
  await api.register(email);

  const oldToken = await issueTokenFor(email);
  // Yangi so'rov — eski tokenlar bekor qilinishi kerak
  await api.post('/api/auth/forgot-password', { email });

  const res = await api.post('/api/auth/reset-password', {
    token: oldToken,
    password: 'yangiParol123',
  });
  assert.equal(res.status, 400, 'eski havola hali ham ishlayapti');
});

test('parol almashgach barcha sessiyalar yopiladi', async () => {
  const api = makeClient();
  const email = `sessions${Date.now()}@test.uz`;
  await api.register(email);

  // Ro'yxatdan o'tishda sessiya yaratilgan
  const Session = require('../models/Session');
  const User = require('../models/User');
  const user = await User.findOne({ email });
  const before = await Session.countDocuments({ user: user._id, revokedAt: null });
  assert.ok(before > 0, 'sessiya yaratilmagan');

  const raw = await issueTokenFor(email);
  await api.post('/api/auth/reset-password', { token: raw, password: 'yangiParol12345' });

  const after = await Session.countDocuments({ user: user._id, revokedAt: null });
  assert.equal(after, 0, 'parol almashgach eski sessiyalar yopilmadi');
});

test('qisqa parol rad etiladi', async () => {
  const api = makeClient();
  const email = `short${Date.now()}@test.uz`;
  await api.register(email);
  const raw = await issueTokenFor(email);

  const res = await api.post('/api/auth/reset-password', { token: raw, password: '123' });
  assert.equal(res.status, 400);
});

test('mongoose ulanishi test oxirida toza', () => {
  assert.equal(mongoose.connection.readyState, 1);
});
