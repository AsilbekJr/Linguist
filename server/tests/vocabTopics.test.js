const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { loadLevels, validateLevels, exampleUsesWord } = require('../content/vocab-topics');

test("mavzular kutubxonasi kontenti validatordan o'tadi", () => {
  const errs = validateLevels(loadLevels());
  assert.deepEqual(errs, []);
});

test('validator xatolarni ushlaydi', () => {
  const bad = [{
    key: 'x',
    topics: [{
      id: 'x-01', title: 'T', titleUz: 'T', emoji: '•',
      words: [
        { word: 'cat', partOfSpeech: 'noun', translation: 'cat', example: 'A dog.', exampleUz: 'It.' },
        ...Array.from({ length: 8 }, (_, i) => ({
          word: `w${i}`, partOfSpeech: 'thing', translation: 't', example: `w${i} here`, exampleUz: 'u',
        })),
      ],
    }],
  }];
  // Bir so'z ikki mavzuda — lug'atda u bitta yozuv, shuning uchun taqiqlanadi
  bad.push({
    key: 'y',
    topics: [{
      id: 'y-01', title: 'U', titleUz: 'U', emoji: '•',
      words: Array.from({ length: 8 }, (_, i) => ({
        word: i === 0 ? 'w1' : `v${i}`, partOfSpeech: 'noun', translation: 't', example: `${i === 0 ? 'w1' : `v${i}`} here`, exampleUz: 'u',
      })),
    }],
  });
  const errs = validateLevels(bad).join('\n');
  assert.match(errs, /boshqa mavzuda ham bor \(x-01\)/);
  assert.match(errs, /tarjima so'zning o'zi/);
  assert.match(errs, /misolda so'z ishlatilmagan/);
  assert.match(errs, /noma'lum so'z turkumi/);
});

test("misol tekshiruvi so'z shakllari va defisli so'zlarni tushunadi", () => {
  assert.ok(exampleUsesWord('Rabbits love carrots.', 'carrot'));
  assert.ok(exampleUsesWord('Her husband is very good-looking.', 'good-looking'));
  assert.ok(exampleUsesWord("Tea or coffee? I don't mind.", "I don't mind"));
  assert.ok(!exampleUsesWord('I eat meat.', 'eat meal'));
});

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

test("ro'yxat → mavzu → hammasini qo'shish; takroriy qo'shish dublikat yaratmaydi", async () => {
  const api = makeClient();
  await api.register();

  const list = await api.get('/api/vocab-topics');
  assert.equal(list.status, 200);
  const elementary = list.data.levels.find((l) => l.key === 'elementary');
  assert.ok(elementary.topics.length >= 15);
  const family = elementary.topics.find((t) => t.unit === 1);
  assert.equal(family.savedCount, 0);

  const topic = await api.get(`/api/vocab-topics/${family.id}`);
  assert.equal(topic.status, 200);
  assert.equal(topic.data.words.length, family.wordCount);
  assert.ok(topic.data.words.every((w) => w.saved === false && w.translation && w.exampleUz));

  const add = await api.post(`/api/vocab-topics/${family.id}/add`, {});
  assert.equal(add.status, 200);
  assert.equal(add.data.added, family.wordCount);

  const again = await api.post(`/api/vocab-topics/${family.id}/add`, {});
  assert.equal(again.data.added, 0);
  assert.equal(again.data.alreadySaved, family.wordCount);

  const words = await api.get('/api/words');
  const list2 = Array.isArray(words.data) ? words.data : words.data.words;
  assert.equal(list2.filter((w) => w.word === 'mother').length, 1);

  // Qo'shilgan so'z bugun takrorlashga chiqadi — tanib olish rejimida
  const due = await api.get('/api/review/due');
  assert.ok(due.data.length > 0);
  assert.ok(due.data.every((d) => d.mode === 'recognize'));

  const after = await api.get('/api/vocab-topics');
  const fam2 = after.data.levels[0].topics.find((t) => t.id === family.id);
  assert.equal(fam2.savedCount, family.wordCount);
});

test("tanlangan so'zlarni qo'shish; mavzuda yo'q so'z qabul qilinmaydi", async () => {
  const api = makeClient();
  await api.register();

  const one = await api.post('/api/vocab-topics/elementary-10/add', { words: ['Bread', 'rice'] });
  assert.equal(one.status, 200);
  assert.equal(one.data.added, 2);

  const topic = await api.get('/api/vocab-topics/elementary-10');
  assert.deepEqual(topic.data.words.filter((w) => w.saved).map((w) => w.word).sort(), ['bread', 'rice']);

  const foreign = await api.post('/api/vocab-topics/elementary-10/add', { words: ['spaceship'] });
  assert.equal(foreign.status, 400);

  assert.equal((await api.get('/api/vocab-topics/nope-99')).status, 404);
  assert.equal((await api.post('/api/vocab-topics/elementary-10/add', { words: [] })).status, 400);
});

test('"Bilaman": yangi so\'z yodlangan holda qo\'shiladi, bor so\'z yodlanganga o\'tadi; navbatga tushmaydi', async () => {
  const api = makeClient();
  await api.register();

  // "bread" — avval oddiy qo'shilgan (navbatda), "rice" — lug'atda yo'q
  await api.post('/api/vocab-topics/elementary-10/add', { words: ['bread'] });
  const res = await api.post('/api/vocab-topics/elementary-10/known', { words: ['bread', 'rice'] });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.deepEqual(res.data, { added: 1, updated: 1 });

  const topic = await api.get('/api/vocab-topics/elementary-10');
  const byWord = Object.fromEntries(topic.data.words.map((w) => [w.word, w]));
  assert.equal(byWord.bread.known, true);
  assert.equal(byWord.rice.known, true);
  assert.equal(byWord.rice.saved, true);

  const due = await api.get('/api/review/due');
  assert.ok(!due.data.some((w) => ['bread', 'rice'].includes(String(w.word || '').toLowerCase())), 'navbatga tushmaydi');
  const words = await api.get('/api/words');
  const rice = words.data.find((w) => w.word.toLowerCase() === 'rice');
  assert.equal(rice.learned, true);
  assert.equal(rice.markedKnown, true);
  assert.equal(rice.translation.length > 0, true);
  assert.equal((await api.get('/api/auth/me')).data.knownWords, 2);

  // Takror — hech narsa o'zgarmaydi; so'zsiz yoki begona so'z — 400
  assert.deepEqual((await api.post('/api/vocab-topics/elementary-10/known', { words: ['rice'] })).data, { added: 0, updated: 0 });
  assert.equal((await api.post('/api/vocab-topics/elementary-10/known', {})).status, 400);
  assert.equal((await api.post('/api/vocab-topics/elementary-10/known', { words: ['spaceship'] })).status, 400);
});

test('tokensiz kirib bo\'lmaydi', async () => {
  const anon = makeClient();
  assert.equal((await anon.get('/api/vocab-topics')).status, 401);
  assert.equal((await anon.post('/api/vocab-topics/elementary-01/add', {})).status, 401);
});
