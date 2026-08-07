const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

const makeSub = (suffix = '') => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/test-endpoint-${suffix || Date.now()}`,
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
});

test('VAPID sozlanmagan bo\'lsa ochiq kalit null qaytadi', async () => {
  const api = makeClient();
  const res = await api.get('/api/push/public-key');
  assert.equal(res.status, 200);
  // Test muhitida VAPID kalitlari yo'q — bu normal holat
  assert.equal(res.data.configured, false);
  assert.equal(res.data.publicKey, null);
});

test('qurilma ro\'yxatdan o\'tadi', async () => {
  const api = makeClient();
  await api.register();

  const sub = makeSub('a');
  const res = await api.post('/api/push/subscribe', sub);
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(res.data.devices, 1);

  const stored = await PushSubscription.findOne({ endpoint: sub.endpoint });
  assert.ok(stored);
  assert.equal(stored.keys.p256dh, sub.keys.p256dh);
});

test('bir xil qurilma ikki marta yozilmaydi', async () => {
  const api = makeClient();
  await api.register();

  const sub = makeSub('dup');
  await api.post('/api/push/subscribe', sub);
  const second = await api.post('/api/push/subscribe', sub);

  assert.equal(second.status, 201);
  assert.equal(second.data.devices, 1, 'dublikat yaratildi');
});

test('bir foydalanuvchi bir nechta qurilma ulashi mumkin', async () => {
  const api = makeClient();
  await api.register();

  await api.post('/api/push/subscribe', makeSub('phone'));
  const res = await api.post('/api/push/subscribe', makeSub('laptop'));
  assert.equal(res.data.devices, 2);
});

test('qurilma o\'chiriladi', async () => {
  const api = makeClient();
  await api.register();

  const sub = makeSub('remove');
  await api.post('/api/push/subscribe', sub);

  const res = await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint });
  assert.equal(res.status, 200);
  assert.equal(res.data.devices, 0);

  assert.equal(await PushSubscription.countDocuments({ endpoint: sub.endpoint }), 0);
});

test('boshqa foydalanuvchining qurilmasini o\'chirib bo\'lmaydi', async () => {
  const a = makeClient();
  const b = makeClient();
  await a.register();
  await b.register();

  const sub = makeSub('victim');
  await a.post('/api/push/subscribe', sub);

  const attack = await b.post('/api/push/unsubscribe', { endpoint: sub.endpoint });
  assert.equal(attack.status, 200, 'javob bir xil bo\'lishi kerak');

  // Lekin obuna saqlanib qolishi kerak
  assert.equal(
    await PushSubscription.countDocuments({ endpoint: sub.endpoint }),
    1,
    'begona obuna o\'chirildi'
  );
});

test('hisob almashtirilganda obuna yangi egaga o\'tadi', async () => {
  // Umumiy kompyuterda ikkinchi odam kirsa, bildirishnoma birinchisiga
  // ketib qolmasligi kerak
  const a = makeClient();
  const b = makeClient();
  const emailA = `shareA${Date.now()}@test.uz`;
  const emailB = `shareB${Date.now()}@test.uz`;
  await a.register(emailA);
  await b.register(emailB);

  const sub = makeSub('shared');
  await a.post('/api/push/subscribe', sub);
  await b.post('/api/push/subscribe', sub);

  const stored = await PushSubscription.findOne({ endpoint: sub.endpoint });
  const userB = await User.findOne({ email: emailB });
  assert.equal(String(stored.user), String(userB._id), 'obuna eski egada qoldi');

  assert.equal(await PushSubscription.countDocuments({ endpoint: sub.endpoint }), 1);
});

test('yaroqsiz obuna rad etiladi', async () => {
  const api = makeClient();
  await api.register();

  assert.equal((await api.post('/api/push/subscribe', { endpoint: 'not-a-url', keys: makeSub().keys })).status, 400);
  assert.equal((await api.post('/api/push/subscribe', { endpoint: makeSub().endpoint })).status, 400);
  assert.equal(
    (await api.post('/api/push/subscribe', {
      endpoint: makeSub().endpoint,
      keys: { p256dh: 'qisqa', auth: 'x' },
    })).status,
    400
  );
});

test('tokensiz kirib bo\'lmaydi', async () => {
  const anon = makeClient();
  assert.equal((await anon.get('/api/push/status')).status, 401);
  assert.equal((await anon.post('/api/push/subscribe', makeSub())).status, 401);
  assert.equal((await anon.post('/api/push/test')).status, 401);

  // Ochiq kalit esa hammaga ochiq — brauzer obuna bo'lishdan oldin so'raydi
  assert.equal((await anon.get('/api/push/public-key')).status, 200);
});

test('push sozlanmagan bo\'lsa sinov 503 qaytaradi', async () => {
  const api = makeClient();
  await api.register();
  const res = await api.post('/api/push/test');
  assert.equal(res.status, 503);
});

test('holat ulangan qurilmalar sonini ko\'rsatadi', async () => {
  const api = makeClient();
  await api.register();

  assert.equal((await api.get('/api/push/status')).data.devices, 0);
  await api.post('/api/push/subscribe', makeSub('status'));
  assert.equal((await api.get('/api/push/status')).data.devices, 1);
});
