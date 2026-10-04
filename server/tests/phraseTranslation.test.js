const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const Phrase = require('../models/Phrase');
const User = require('../models/User');
const gemini = require('../services/geminiService');
const { getAiLimit } = require('../middleware/usageQuota');
const { userDayKey } = require('../utils/dayKey');
test.before(start);
test.after(stop);

test('a known sentence translates both ways without saving or using AI quota', async () => {
  const api = makeClient();
  const user = (await api.register()).data;
  const option = (await api.post('/api/words/preview', { text: 'olma', language: 'uz' })).data.options[0];
  for (const [sourceLanguage, input, expected] of [['en', option.example, option.exampleUz], ['uz', option.exampleUz, option.example]]) {
    const translated = await api.post('/api/review/phrases/translate', { text: input, sourceLanguage });
    assert.equal(translated.status, 200);
    assert.equal(translated.data.translation, expected);
  }
  assert.equal(await Phrase.countDocuments({ user: user._id }), 0);
  assert.equal((await User.findById(user._id)).usage.aiCallsToday, 0);
});

test('unavailable translation and invalid inputs never save a sentence', async () => {
  const api = makeClient();
  const user = (await api.register()).data;
  assert.equal((await api.post('/api/review/phrases/translate', { text: 'Bugun men uchta binafsha daftar sotib oldim.', sourceLanguage: 'uz' })).status, 503);
  assert.equal((await api.post('/api/review/phrases/translate', { text: '', sourceLanguage: 'uz' })).status, 400);
  assert.equal((await api.post('/api/review/phrases/translate', { text: 'Hello there.', sourceLanguage: 'fr' })).status, 400);
  assert.equal(await Phrase.countDocuments({ user: user._id }), 0);
});

test('AI sentence translation charges success, refunds failure and respects quota', async t => {
  let outcome = { status: 'unavailable' };
  const calls = [];
  t.mock.method(gemini, 'isGeminiReady', () => true);
  t.mock.method(gemini, 'translatePhrase', async (text, language) => { calls.push([text, language]); return outcome; });
  const api = makeClient();
  const user = (await api.register()).data;
  const body = { text: 'Bugun men uchta binafsha daftar sotib oldim.', sourceLanguage: 'uz' };
  assert.equal((await api.post('/api/review/phrases/translate', body)).status, 503);
  assert.equal((await User.findById(user._id)).usage.aiCallsToday, 0);
  outcome = { status: 'ok', translation: 'Today I bought three purple notebooks.' };
  const result = await api.post('/api/review/phrases/translate', body);
  assert.equal(result.status, 200);
  assert.equal(result.data.translation, 'Today I bought three purple notebooks.');
  const stored = await User.findById(user._id);
  assert.equal(stored.usage.aiCallsToday, 1);
  assert.deepEqual(calls[1], [body.text, 'uz']);
  await User.updateOne({ _id: user._id }, { $set: { 'usage.aiCallsDate': userDayKey(stored), 'usage.aiCallsToday': getAiLimit(stored) } });
  assert.equal((await api.post('/api/review/phrases/translate', body)).status, 402);
  assert.equal(calls.length, 2);
  assert.equal(await Phrase.countDocuments({ user: user._id }), 0);
});
