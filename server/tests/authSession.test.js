const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { start, stop, makeClient, getBaseUrl } = require('./helpers/testServer');

/**
 * Sessiyalar: refresh rotation, o'g'irlangan tokenni aniqlash, logout va
 * access token'ning sessiyaga bog'liqligi.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

const Session = require('../models/Session');

const uniqueEmail = () => `s${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.uz`;

/** Cookie'ni qo'lda boshqaradigan so'rov — bir cookie'ni ikki marta yuborish uchun */
const raw = async (method, path, { cookie, token, body } = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  const text = await res.text();
  return {
    status: res.status,
    data: text ? JSON.parse(text) : null,
    cookie: setCookie ? setCookie.split(';')[0] : null,
  };
};

const registerRaw = async (email = uniqueEmail()) => {
  const res = await raw('POST', '/api/auth/register', {
    body: { name: 'Sessiya Test', email, password: 'password12345' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return { ...res, email };
};

test('a refresh arriving while its replacement is being saved keeps the session valid', async () => {
  const reg = await registerRaw();
  const originalSave = Session.prototype.save;
  let entered;
  let release;
  const saving = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let delayed = false;
  Session.prototype.save = async function (...args) {
    if (!delayed && String(this.user) === reg.data._id) {
      delayed = true;
      entered();
      await gate;
    }
    return originalSave.apply(this, args);
  };
  try {
    const firstRequest = raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
    await saving;
    const second = await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
    release();
    const first = await firstRequest;
    assert.equal(second.status, 200, JSON.stringify(second.data));
    assert.equal(first.status, 200, JSON.stringify(first.data));
    const winner = first.cookie || second.cookie;
    assert.ok(winner);
    assert.equal((await raw('POST', '/api/auth/refresh', { cookie: winner })).status, 200);
    assert.equal(await Session.countDocuments({ user: reg.data._id, revokedAt: null }), 1);
  } finally {
    release();
    Session.prototype.save = originalSave;
  }
});

test('a failed replacement save does not revoke the usable refresh cookie', async () => {
  const reg = await registerRaw();
  const originalSave = Session.prototype.save;
  Session.prototype.save = function (...args) {
    if (String(this.user) === reg.data._id) return Promise.reject(new Error('temporary database failure'));
    return originalSave.apply(this, args);
  };
  try {
    assert.equal((await raw('POST', '/api/auth/refresh', { cookie: reg.cookie })).status, 500);
  } finally {
    Session.prototype.save = originalSave;
  }
  assert.equal((await raw('POST', '/api/auth/refresh', { cookie: reg.cookie })).status, 200);
});

test('access token sessiyaga bog\'langan (sid) va /me ishlaydi', async () => {
  const reg = await registerRaw();
  const decoded = jwt.decode(reg.data.token);
  assert.ok(decoded.sid, 'sid yo\'q');
  assert.equal(decoded.iss, 'linguist-api');
  assert.equal(decoded.aud, 'linguist-app');

  const me = await raw('GET', '/api/auth/me', { token: reg.data.token });
  assert.equal(me.status, 200);
});

test('refresh har safar yangi cookie beradi', async () => {
  const reg = await registerRaw();
  const r1 = await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
  assert.equal(r1.status, 200);
  assert.ok(r1.cookie && r1.cookie !== reg.cookie, 'cookie almashmadi');
  assert.notEqual(jwt.decode(r1.data.token).sid, jwt.decode(reg.data.token).sid);

  // Yangi cookie ham ishlaydi
  const r2 = await raw('POST', '/api/auth/refresh', { cookie: r1.cookie });
  assert.equal(r2.status, 200);
});

test('parallel refresh (qisqa oraliq) foydalanuvchini chiqarib yubormaydi', async () => {
  const reg = await registerRaw();
  const first = await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
  assert.equal(first.status, 200);

  // Ikkinchi tab hali eski cookie bilan
  const second = await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
  assert.equal(second.status, 200, JSON.stringify(second.data));
  assert.equal(second.cookie, null, 'parallel so\'rovga yangi cookie berilmasligi kerak');
  assert.equal(jwt.decode(second.data.token).sid, jwt.decode(first.data.token).sid);

  // Birinchi so'rovdan kelgan cookie ishlashda davom etadi
  const next = await raw('POST', '/api/auth/refresh', { cookie: first.cookie });
  assert.equal(next.status, 200);
});

test('a delayed tab can follow more than five rapid refresh rotations', async () => {
  const reg = await registerRaw();
  let cookie = reg.cookie;
  let latest;
  for (let i = 0; i < 7; i++) {
    latest = await raw('POST', '/api/auth/refresh', { cookie });
    assert.equal(latest.status, 200);
    cookie = latest.cookie;
  }
  const delayed = await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
  assert.equal(delayed.status, 200, JSON.stringify(delayed.data));
  assert.equal(delayed.cookie, null);
  assert.equal(jwt.decode(delayed.data.token).sid, jwt.decode(latest.data.token).sid);
  assert.equal((await raw('POST', '/api/auth/refresh', { cookie })).status, 200);
});

test('eski refresh token keyinroq qayta kelsa — butun oila yopiladi', async () => {
  const reg = await registerRaw();
  const rotated = await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
  assert.equal(rotated.status, 200);

  // Oraliq o'tib ketgandek qilamiz
  const oldSid = jwt.decode(reg.data.token).sid;
  await Session.updateOne({ _id: oldSid }, { revokedAt: new Date(Date.now() - 60_000) });

  const reuse = await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
  assert.equal(reuse.status, 401);
  assert.equal(reuse.data.code, 'REFRESH_REUSED');

  // Haqiqiy egasining (yoki o'g'rining) yangi cookie'si ham endi ishlamaydi
  const legit = await raw('POST', '/api/auth/refresh', { cookie: rotated.cookie });
  assert.equal(legit.status, 401);

  // ...va access token darhol kuchini yo'qotadi
  const me = await raw('GET', '/api/auth/me', { token: rotated.data.token });
  assert.equal(me.status, 401);
  assert.equal(me.data.code, 'SESSION_REVOKED');
});

test('refreshdan oldingi access token o\'z muddatigacha ishlaydi', async () => {
  const reg = await registerRaw();
  await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
  const me = await raw('GET', '/api/auth/me', { token: reg.data.token });
  assert.equal(me.status, 200);
});

test('logout access token\'siz ishlaydi va tokenni darhol bekor qiladi', async () => {
  const reg = await registerRaw();
  const out = await raw('POST', '/api/auth/logout', { cookie: reg.cookie });
  assert.equal(out.status, 200);

  const me = await raw('GET', '/api/auth/me', { token: reg.data.token });
  assert.equal(me.status, 401);
  assert.equal(me.data.code, 'SESSION_REVOKED');

  const refresh = await raw('POST', '/api/auth/refresh', { cookie: reg.cookie });
  assert.equal(refresh.status, 401);
});

test('parol o\'zgarganda boshqa qurilmaning access tokeni darhol ishlamaydi', async () => {
  const email = uniqueEmail();
  const phone = await registerRaw(email);
  const laptop = await raw('POST', '/api/auth/login', { body: { email, password: 'password12345' } });
  assert.equal(laptop.status, 200);

  const change = await raw('POST', '/api/auth/change-password', {
    token: laptop.data.token,
    cookie: laptop.cookie,
    body: { currentPassword: 'password12345', newPassword: 'yangiParol12345' },
  });
  assert.equal(change.status, 200, JSON.stringify(change.data));

  const phoneMe = await raw('GET', '/api/auth/me', { token: phone.data.token });
  assert.equal(phoneMe.status, 401);

  // Parolni o'zgartirgan qurilma yangi token va cookie bilan qoladi
  const laptopMe = await raw('GET', '/api/auth/me', { token: change.data.token });
  assert.equal(laptopMe.status, 200);
  const laptopRefresh = await raw('POST', '/api/auth/refresh', { cookie: change.cookie });
  assert.equal(laptopRefresh.status, 200);
});

test('soxta yoki eski formatdagi tokenlar rad etiladi', async () => {
  const reg = await registerRaw();
  const { id, sid } = jwt.decode(reg.data.token);
  const secret = process.env.JWT_SECRET;

  const noSid = jwt.sign({ id }, secret, { issuer: 'linguist-api', audience: 'linguist-app', expiresIn: '5m' });
  const wrongAud = jwt.sign({ id, sid }, secret, { issuer: 'linguist-api', audience: 'other', expiresIn: '5m' });
  const noneAlg = jwt.sign({ id, sid }, null, { algorithm: 'none', issuer: 'linguist-api', audience: 'linguist-app' });
  const badSid = jwt.sign({ id, sid: 'not-an-id' }, secret, { issuer: 'linguist-api', audience: 'linguist-app', expiresIn: '5m' });

  for (const token of [noSid, wrongAud, noneAlg, badSid]) {
    const me = await raw('GET', '/api/auth/me', { token });
    assert.equal(me.status, 401, `qabul qilindi: ${token.slice(0, 20)}…`);
  }
});

test('email bir xil ko\'rinishga keltiriladi', async () => {
  const base = uniqueEmail();
  const reg = await raw('POST', '/api/auth/register', {
    body: { name: 'Katta Harf', email: `  ${base.toUpperCase()} `, password: 'password12345' },
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));
  assert.equal(reg.data.email, base);

  const login = await raw('POST', '/api/auth/login', { body: { email: base, password: 'password12345' } });
  assert.equal(login.status, 200);

  const dup = await raw('POST', '/api/auth/register', {
    body: { name: 'Takror', email: base.toUpperCase(), password: 'password12345' },
  });
  assert.equal(dup.status, 409);
  assert.equal(dup.data.code, 'EMAIL_TAKEN');
});

test('72 baytdan uzun parol rad etiladi (bcrypt qolganini e\'tiborsiz qoldirardi)', async () => {
  const api = makeClient();
  const res = await api.post('/api/auth/register', {
    name: 'Uzun Parol',
    email: uniqueEmail(),
    password: 'ы'.repeat(40), // 40 belgi, lekin 80 bayt
  });
  assert.equal(res.status, 400);
});

test('mavjud bo\'lmagan email va noto\'g\'ri parol bir xil javob oladi', async () => {
  const email = uniqueEmail();
  await registerRaw(email);
  const wrongPass = await raw('POST', '/api/auth/login', { body: { email, password: 'notTheRightOne1' } });
  const noUser = await raw('POST', '/api/auth/login', { body: { email: uniqueEmail(), password: 'notTheRightOne1' } });
  assert.equal(wrongPass.status, 401);
  assert.equal(noUser.status, 401);
  assert.deepEqual(wrongPass.data, noUser.data);
});
