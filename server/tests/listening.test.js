const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

test('tinglash sessiyasi bugungi mavzu dialogidan tuziladi', async () => {
  const api = makeClient();
  await api.register();

  const res = await api.get('/api/listening/session');
  assert.equal(res.status, 200);
  assert.ok(res.data.lines.length > 0, 'qatorlar yo\'q');
  assert.ok(res.data.lines.length <= 5, 'juda ko\'p qator');
  assert.ok(res.data.topicUz, 'mavzu nomi yo\'q');

  for (const line of res.data.lines) {
    assert.equal(typeof line.index, 'number');
    assert.ok(line.en && line.uz, 'qator to\'liq emas');
    assert.ok(line.en.split(/\s+/).length >= 4, `juda qisqa qator: "${line.en}"`);
  }

  // Bugungi kunlik sahna mavzusi bilan bir xil bo'lishi kerak
  const topic = await api.get('/api/topics/current');
  assert.equal(res.data.topic, topic.data.topic);
});

test('diktant serverda baholanadi va aniq fikr-mulohaza beradi', async () => {
  const api = makeClient();
  await api.register();

  const session = await api.get('/api/listening/session');
  const line = session.data.lines[0];

  // To'g'ri yozilgan
  const perfect = await api.post('/api/listening/check', {
    lineIndex: line.index,
    typed: line.en,
  });
  assert.equal(perfect.status, 200);
  assert.equal(perfect.data.score, 100);
  assert.equal(perfect.data.isPerfect, true);
  assert.match(perfect.data.feedback, /Mukammal/);

  // Bir so'z tashlab ketilgan
  const words = line.en.split(/\s+/);
  const withGap = words.filter((_, i) => i !== 1).join(' ');
  const partial = await api.post('/api/listening/check', {
    lineIndex: line.index,
    typed: withGap,
  });
  assert.ok(partial.data.score < 100, 'ball pasaymadi');
  assert.ok(partial.data.missedWords.length > 0, 'o\'tkazib yuborilgan so\'z aniqlanmadi');
  assert.ok(partial.data.tokens.some((t) => t.status === 'missing'));

  // To'g'ri javob faqat tekshiruvdan KEYIN qaytadi
  assert.ok(partial.data.expected, 'to\'g\'ri javob ko\'rsatilmadi');
});

test('mavjud bo\'lmagan qator rad etiladi', async () => {
  const api = makeClient();
  await api.register();

  const res = await api.post('/api/listening/check', { lineIndex: 49, typed: 'test' });
  assert.equal(res.status, 404);
});

test('yaroqsiz kirish validatsiyadan o\'tmaydi', async () => {
  const api = makeClient();
  await api.register();

  assert.equal((await api.post('/api/listening/check', { lineIndex: -1, typed: 'a' })).status, 400);
  assert.equal((await api.post('/api/listening/check', { typed: 'a' })).status, 400);
  assert.equal(
    (await api.post('/api/listening/check', { lineIndex: 0, typed: 'x'.repeat(2000) })).status,
    400
  );
});

test('yakunlash XP beradi, lekin ikki marta bermaydi', async () => {
  const api = makeClient();
  await api.register();

  const before = await api.get('/api/auth/me');

  const first = await api.post('/api/listening/complete');
  assert.equal(first.status, 200);
  assert.equal(first.data.xpAwarded, 10);
  assert.equal(first.data.user.xp, before.data.xp + 10);

  const second = await api.post('/api/listening/complete');
  assert.equal(second.data.xpAwarded, 0, 'XP takroriy berildi');
  assert.equal(second.data.user.xp, before.data.xp + 10);
});

test('tinglash mashqi kunlik 3 qadamni va streak\'ni BLOKLAMAYDI', async () => {
  const api = makeClient();
  await api.register();

  // Tinglashga tegmasdan 3 qadamni bajaramiz
  await api.post('/api/auth/sync-quest', { type: 'topic' });
  await api.post('/api/auth/sync-quest', { type: 'review' });
  const last = await api.post('/api/auth/sync-quest', { type: 'immersion' });

  assert.equal(
    last.data.streakUpdated,
    true,
    'tinglash bajarilmagani streak\'ni to\'sib qo\'ydi — bu qo\'shimcha mashq bo\'lishi kerak'
  );
  assert.equal(last.data.user.currentStreak, 1);
});

test('yakunlangani sessiyada ko\'rinadi', async () => {
  const api = makeClient();
  await api.register();

  assert.equal((await api.get('/api/listening/session')).data.listeningCompleted, false);
  await api.post('/api/listening/complete');
  assert.equal((await api.get('/api/listening/session')).data.listeningCompleted, true);
});

test('tokensiz kirib bo\'lmaydi', async () => {
  const anon = makeClient();
  assert.equal((await anon.get('/api/listening/session')).status, 401);
  assert.equal((await anon.post('/api/listening/check', { lineIndex: 0, typed: 'a' })).status, 401);
});
