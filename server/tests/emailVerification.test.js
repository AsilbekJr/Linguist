const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { start, stop, makeClient } = require('./helpers/testServer');

/**
 * Email tasdiqlash: bloklamaydi, lekin to'lov va email eslatmalarni yopadi.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

const User = require('../models/User');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const { hashToken } = require('../utils/tokens');

const uniqueEmail = () => `v${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.uz`;

/** Testda xat o'qib bo'lmaydi — tokenni o'zimiz yaratamiz */
const issueToken = async (email, { expiresAt = new Date(Date.now() + 3600_000), tokenEmail = email } = {}) => {
  const user = await User.findOne({ email });
  const raw = crypto.randomBytes(32).toString('hex');
  await EmailVerificationToken.create({ user: user._id, tokenHash: hashToken(raw), email: tokenEmail, expiresAt });
  return raw;
};

// Parallel test yuklamasida fon yuborish sekinlashadi — 2 s yetmay qolardi
const waitFor = async (check, ms = 10000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
};

/**
 * Ro'yxatdan o'tish + fon yuborish tugashini kutish. Aks holda fon yuborish
 * testda qo'lda yaratilgan tokendan keyin tugab, uni bekor qilib qo'yadi
 * (yangi havola eskisini bekor qiladi — bu to'g'ri xatti-harakat).
 */
const registerSettled = async (api, email) => {
  await api.register(email);
  const user = await User.findOne({ email });
  await waitFor(() => EmailVerificationToken.exists({ user: user._id }));
  return user;
};

test("ro'yxatdan o'tish bloklanmaydi, tasdiqlash xati navbatga qo'yiladi", async () => {
  const api = makeClient();
  const email = uniqueEmail();
  const reg = await api.register(email);
  assert.equal(reg.status, 201);
  assert.equal(reg.data.emailVerified, false);

  const user = await User.findOne({ email });
  const created = await waitFor(() => EmailVerificationToken.exists({ user: user._id, usedAt: null }));
  assert.ok(created, 'tasdiqlash tokeni yaratilmadi');

  const me = await api.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.emailVerified, false);
});

test('havola emailni tasdiqlaydi, ikkinchi bosish xato bermaydi', async () => {
  const api = makeClient();
  const email = uniqueEmail();
  await registerSettled(api, email);
  const raw = await issueToken(email);

  // Havola ko'pincha boshqa qurilmada ochiladi — login shart emas
  const anon = makeClient();
  const first = await anon.post('/api/auth/verify-email', { token: raw });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.account, email);
  assert.equal(first.data.alreadyVerified, false);

  const again = await anon.post('/api/auth/verify-email', { token: raw });
  assert.equal(again.status, 200);
  assert.equal(again.data.alreadyVerified, true);

  const me = await api.get('/api/auth/me');
  assert.equal(me.data.emailVerified, true);
});

test("yaroqsiz, muddati o'tgan va boshqa manzil uchun havolalar rad etiladi", async () => {
  const api = makeClient();
  const email = uniqueEmail();
  await registerSettled(api, email);

  const bogus = await api.post('/api/auth/verify-email', { token: 'a'.repeat(64) });
  assert.equal(bogus.status, 400);
  assert.equal(bogus.data.code, 'INVALID_VERIFY_TOKEN');

  const expired = await issueToken(email, { expiresAt: new Date(Date.now() - 1000) });
  assert.equal((await api.post('/api/auth/verify-email', { token: expired })).status, 400);

  const otherAddress = await issueToken(email, { tokenEmail: 'eski@test.uz' });
  assert.equal((await api.post('/api/auth/verify-email', { token: otherAddress })).status, 400);

  assert.equal((await api.post('/api/auth/verify-email', { token: 'xyz' })).status, 400);
  assert.equal((await User.findOne({ email })).emailVerified, false);
});

test('qayta yuborish: oraliq bor, tasdiqlangandan keyin kerak emas', async () => {
  const api = makeClient();
  const email = uniqueEmail();
  const user = await registerSettled(api, email);

  // Ro'yxatdan o'tishda xat hozirgina ketdi
  const tooSoon = await api.post('/api/auth/resend-verification');
  assert.equal(tooSoon.status, 429);
  assert.equal(tooSoon.data.code, 'VERIFY_COOLDOWN');

  await User.updateOne({ _id: user._id }, { emailVerificationSentAt: new Date(Date.now() - 120_000) });
  const ok = await api.post('/api/auth/resend-verification');
  assert.equal(ok.status, 200, JSON.stringify(ok.data));

  // Yangi havola eskisini bekor qiladi
  const active = await EmailVerificationToken.countDocuments({ user: user._id, usedAt: null });
  assert.equal(active, 1);

  await User.updateOne({ _id: user._id }, { emailVerified: true });
  const done = await api.post('/api/auth/resend-verification');
  assert.equal(done.status, 200);
  assert.equal(done.data.alreadyVerified, true);
});

test('parolni tiklash emailni ham tasdiqlaydi', async () => {
  const api = makeClient();
  const email = uniqueEmail();
  await api.register(email);

  const PasswordResetToken = require('../models/PasswordResetToken');
  const user = await User.findOne({ email });
  const raw = crypto.randomBytes(32).toString('hex');
  await PasswordResetToken.create({ user: user._id, tokenHash: hashToken(raw), expiresAt: new Date(Date.now() + 3600_000) });

  const reset = await api.post('/api/auth/reset-password', { token: raw, password: 'yangiParol12345' });
  assert.equal(reset.status, 200);
  assert.equal((await User.findOne({ email })).emailVerified, true);
});

test("tasdiqlanmagan email bilan to'lov ochilmaydi", async () => {
  const api = makeClient();
  await api.register(uniqueEmail());
  const res = await api.post('/api/billing/checkout', { plan: 'pro' });
  assert.equal(res.status, 403);
  assert.equal(res.data.code, 'EMAIL_NOT_VERIFIED');
});

test("hisob o'chirilganda tasdiqlash tokenlari ham o'chadi", async () => {
  const api = makeClient();
  const email = uniqueEmail();
  const user = await registerSettled(api, email);

  const del = await api.del('/api/auth/account', { password: 'password12345' });
  assert.equal(del.status, 200);
  assert.equal(await EmailVerificationToken.countDocuments({ user: user._id }), 0);
});
