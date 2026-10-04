const test = require('node:test');
const assert = require('node:assert/strict');
const { buildActiveItems } = require('../utils/activeWords');
const { findWordInSentence } = require('../utils/reviewModes');
const { start, stop, makeClient } = require('./helpers/testServer');

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

test("so'z faqat haqiqiy shakllarda topiladi — 'car' 'careful' ichida emas", () => {
  assert.equal(findWordInSentence('Be careful.', 'car'), null);
  assert.equal(findWordInSentence('Two cities.', 'city'), 'cities');
  assert.equal(findWordInSentence('I stopped.', 'stop'), 'stopped');
  assert.equal(findWordInSentence('We are making tea.', 'make'), 'making');
  assert.equal(findWordInSentence('He gets by somehow.', 'get by'), 'gets by');
  assert.equal(findWordInSentence('Private schools are expensive.', 'private school'), 'Private schools');
  assert.equal(findWordInSentence('She wears contact lenses.', 'contact lens'), 'contact lenses');
  assert.equal(findWordInSentence('The schoolhouse is private.', 'private school'), null);
  assert.equal(findWordInSentence('Take private schooling seriously.', 'private school'), null);
  assert.equal(findWordInSentence('My grandmother cooks.', 'mother'), null);
});

test('faol blok: avval bugungi dialogdan, keyin kursdan; bugungi yangi so\'zlar chiqarib tashlanadi', () => {
  const words = [
    { _id: 'a', word: 'mother', translation: 'ona' },
    { _id: 'b', word: 'river', translation: 'daryo' },
    { _id: 'c', word: 'qwertyzz', translation: 'x' }, // hech qayerda yo'q
    { _id: 'd', word: 'window', translation: 'deraza' }, // bugungi so'z
  ];
  const items = buildActiveItems(words, {
    dialogue: [{ en: 'We swam in the river yesterday.', uz: 'Kecha daryoda suzdik.' }],
    exclude: new Set(['window']),
  });
  assert.equal(items[0].word, 'river');
  assert.equal(items[0].source, 'topic');
  assert.equal(items[0].sentence, 'We swam in the _____ yesterday.');
  assert.equal(items[0].answer, 'river');
  assert.ok(items.some((i) => i.word === 'mother' && i.source === 'course'));
  assert.ok(!items.some((i) => i.word === 'window' || i.word === 'qwertyzz'));
  for (const i of items) assert.ok(i.sentence.includes('_____') && !i.sentence.toLowerCase().includes(i.answer.toLowerCase()));
});

test("faol blok: 2 tadan kam so'z bo'lsa blok ko'rsatilmaydi", () => {
  assert.deepEqual(buildActiveItems([{ _id: 'a', word: 'mother', translation: 'ona' }], { dialogue: [] }), []);
});

test('GET /api/topics/active-words — foydalanuvchi so\'zlari gaplarda', async () => {
  const api = makeClient();
  await api.register();
  const empty = await api.get('/api/topics/active-words');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.data.items, []);

  for (const [word, tr] of [['mother', 'ona'], ['river', 'daryo'], ['journey', 'sayohat']]) {
    const r = await api.post('/api/words', { word, skipAI: true, manualTranslation: tr });
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
  const res = await api.get('/api/topics/active-words');
  assert.equal(res.status, 200);
  assert.ok(res.data.items.length >= 2, JSON.stringify(res.data));
  for (const i of res.data.items) {
    assert.ok(i.sentence.includes('_____'));
    assert.ok(i.answer && i.translation);
  }
});
