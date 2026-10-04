const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const Word = require('../models/Word');
const Phrase = require('../models/Phrase');

test.before(start);
test.after(stop);

test('Uzbek lookup previews English choices without saving a word', async () => {
  const api = makeClient();
  const user = (await api.register()).data;
  const preview = await api.post('/api/words/preview', { text: 'olma', language: 'uz' });
  assert.equal(preview.status, 200);
  assert.ok(preview.data.options.some(option => option.word.toLowerCase() === 'apple'));
  assert.ok(preview.data.options.every(option => option.translation && option.example && option.exampleUz));
  assert.equal(await Word.countDocuments({ user: user._id }), 0);
});

test('saving a bilingual word schedules its example independently and repeat sync preserves progress', async () => {
  const api = makeClient();
  const user = (await api.register()).data;
  const added = await api.post('/api/words', {
    word: 'apple', skipAI: true, manualTranslation: 'olma',
    manualExamples: ['I eat an apple.'], manualExampleUz: 'Men olma yeyman.',
  });
  assert.equal(added.status, 201);
  assert.equal(added.data.exampleUz, 'Men olma yeyman.');
  const list = await api.get('/api/review/phrases');
  assert.equal(list.status, 200);
  const card = list.data.find(p => p.text === 'I eat an apple.');
  assert.ok(card);
  assert.ok(card.wordIds.includes(added.data._id));
  await Phrase.updateOne({ _id: card._id }, { $set: { stage: 2, nextReviewDate: new Date(0) } });
  await api.get('/api/review/phrases');
  const stored = await Phrase.findById(card._id);
  assert.equal(stored.stage, 2);
  assert.equal(stored.nextReviewDate.getTime(), 0);
  const due = await api.get('/api/review/phrases/due');
  assert.ok(due.data.some(p => p._id === card._id && p.sourceWord === 'Apple'));
  assert.equal(due.data.find(p => p._id === card._id).text, undefined);
  const checked = await api.post(`/api/review/phrases/${card._id}/check`, { answer: 'I eat an apple.', source: 'voice' });
  assert.equal(checked.data.isCorrect, true);
  assert.equal(checked.data.stage, 3);
  assert.equal((await Word.findById(added.data._id)).stage, 0);
  assert.equal(await Phrase.countDocuments({ user: user._id, key: 'i eat an apple.' }), 1);
});

test('existing vocabulary gains sentence cards and user sentences validate the linked word', async () => {
  const api = makeClient();
  const user = (await api.register()).data;
  const word = await Word.create({ user: user._id, word: 'apple', translation: 'olma', examples: ['I eat an apple.'], exampleUz: 'Men olma yeyman.' });
  const list = await api.get('/api/review/phrases');
  assert.equal(list.status, 200);
  assert.ok(list.data.some(p => p.wordIds.includes(String(word._id))));
  const invalid = await api.post('/api/review/phrases', { text: 'I drink water.', textUz: 'Men suv ichaman.', wordId: String(word._id) });
  assert.equal(invalid.status, 400);
  const added = await api.post('/api/review/phrases', { text: 'This apple is red.', textUz: 'Bu olma qizil.', wordId: String(word._id) });
  assert.equal(added.status, 201);
  const repeat = await api.post('/api/review/phrases', { text: 'This apple is red.', textUz: 'Bu olma qizil.', wordId: String(word._id) });
  assert.equal(repeat.status, 200);
  const stranger = makeClient();
  await stranger.register();
  assert.equal((await stranger.post('/api/review/phrases', { text: 'This apple is red.', textUz: 'Bu olma qizil.', wordId: String(word._id) })).status, 404);
  assert.equal((await stranger.post(`/api/review/phrases/${added.data._id}/check`, { answer: 'This apple is red.' })).status, 404);
});

test('unavailable translation preserves the input without creating bogus vocabulary', async () => {
  const api = makeClient();
  const user = (await api.register()).data;
  const result = await api.post('/api/words/preview', { text: 'xyznotarealuzbekword', language: 'uz' });
  assert.equal(result.status, 503);
  assert.equal(await Word.countDocuments({ user: user._id }), 0);
  assert.equal((await api.post('/api/words/preview', { text: '', language: 'uz' })).status, 400);
});

test('edited bilingual examples must contain the word and form a sentence before saving', async () => {
  const api = makeClient();
  const user = (await api.register()).data;
  for (const example of ['I drink water.', 'apple']) {
    const result = await api.post('/api/words', {
      word: 'apple', skipAI: true, manualTranslation: 'olma',
      manualExamples: [example], manualExampleUz: 'Men olma yeyman.',
    });
    assert.equal(result.status, 400);
    assert.equal(result.data.type, 'INVALID_EXAMPLE');
  }
  assert.equal(await Word.countDocuments({ user: user._id }), 0);
  assert.equal(await Phrase.countDocuments({ user: user._id }), 0);
});

test('known words gain their sentence cards after returning to learning', async () => {
  const api = makeClient();
  const user = (await api.register()).data;
  const word = await Word.create({ user: user._id, word: 'apple', learned: true, markedKnown: true, examples: ['I eat an apple.'], exampleUz: 'Men olma yeyman.' });
  assert.deepEqual((await api.get('/api/review/phrases')).data, []);
  assert.equal((await api.post(`/api/review/${word._id}/relearn`, {})).status, 200);
  const cards = (await api.get('/api/review/phrases')).data;
  assert.ok(cards.some(card => card.wordIds.includes(String(word._id))));
});

test('preview only accepts the Uzbek translation flow', async () => {
  const api = makeClient();
  await api.register();
  assert.equal((await api.post('/api/words/preview', { text: 'apple', language: 'en' })).status, 400);
});

test('curated Uzbek noun phrases retain plural examples when confirmed', async () => {
  const api = makeClient();
  await api.register();
  const preview = await api.post('/api/words/preview', { text: 'xususiy maktab', language: 'uz' });
  assert.equal(preview.status, 200);
  const option = preview.data.options.find(option => option.word === 'private school');
  assert.ok(option);
  const saved = await api.post('/api/words', {
    word: option.word, skipAI: true, manualTranslation: option.translation,
    manualExamples: [option.example], manualExampleUz: option.exampleUz,
  });
  assert.equal(saved.status, 201);
  assert.ok((await api.get('/api/review/phrases')).data.some(card => card.wordIds.includes(saved.data._id)));
});

test('confirmed bilingual expressions can override a stale dictionary miss', async t => {
  const entries = require('../data/dictionary-snapshot.json').entries;
  const previous = entries['look after'];
  entries['look after'] = { notFound: true };
  t.after(() => { if (previous) entries['look after'] = previous; else delete entries['look after']; });
  const api = makeClient();
  await api.register();
  const saved = await api.post('/api/words', {
    word: 'look after', skipAI: true, manualTranslation: "g'amxo'rlik qilmoq",
    manualExamples: ['We look after our cat.'], manualExampleUz: 'Biz mushugimizga qaraymiz.',
  });
  assert.equal(saved.status, 201);
  assert.ok((await api.get('/api/review/phrases')).data.some(card => card.wordIds.includes(saved.data._id)));
});

test('AI translation previews refund failures, charge successes and stop at the quota', async t => {
  const gemini = require('../services/geminiService');
  const User = require('../models/User');
  const { getAiLimit } = require('../middleware/usageQuota');
  const { userDayKey } = require('../utils/dayKey');
  let response = { status: 'unavailable' };
  let calls = 0;
  t.mock.method(gemini, 'isGeminiReady', () => true);
  t.mock.method(gemini, 'translateUzbekWord', async () => { calls++; return response; });
  const api = makeClient();
  const user = (await api.register()).data;
  const input = { text: 'mahalliy lugatda yoq ibora', language: 'uz' };
  assert.equal((await api.post('/api/words/preview', input)).status, 503);
  assert.equal((await User.findById(user._id)).usage.aiCallsToday, 0);
  response = { status: 'ok', data: { word: 'apple', translation: 'olma', example: 'I eat an apple.', exampleUz: 'Men olma yeyman.' } };
  assert.equal((await api.post('/api/words/preview', input)).status, 200);
  let stored = await User.findById(user._id);
  assert.equal(stored.usage.aiCallsToday, 1);
  await User.updateOne({ _id: user._id }, { $set: { 'usage.aiCallsDate': userDayKey(stored), 'usage.aiCallsToday': getAiLimit(stored) } });
  assert.equal((await api.post('/api/words/preview', input)).status, 402);
  assert.equal(calls, 2);
  assert.equal(await Word.countDocuments({ user: user._id }), 0);
});
