import test from 'node:test';
import assert from 'node:assert/strict';

import { matchSpeech, tokenize } from '../src/utils/speechMatch.js';

test('tokenize: tinish belgilari va qisqartmalar', () => {
  assert.deepEqual(tokenize("Hi! I'm Sara, nice to meet you."), ['hi', 'i', 'am', 'sara', 'nice', 'to', 'meet', 'you']);
  assert.deepEqual(tokenize('Don’t worry'), ['do', 'not', 'worry']);
});

test('aynan aytilgan gap — 100%', () => {
  const r = matchSpeech("Hi, I'm Sara.", 'hi I am Sara');
  assert.equal(r.percent, 100);
  assert.ok(r.words.every((w) => w.hit));
});

test("tushib qolgan so'z belgilanadi", () => {
  const r = matchSpeech('Where is the nearest bus stop?', 'where is the bus stop');
  assert.equal(r.words.find((w) => w.text === 'nearest').hit, false);
  assert.ok(r.percent >= 80 && r.percent < 100, String(r.percent));
});

test("bo'sh yoki boshqa gap — past ball", () => {
  assert.equal(matchSpeech('Good morning', '').percent, 0);
  assert.ok(matchSpeech('Good morning everyone', 'I like pizza very much today').percent < 30);
});

test("uzun tasodifiy nutq ball olmaydi", () => {
  const r = matchSpeech('I am fine', 'I am not really sure what you mean but I am fine');
  assert.ok(r.percent < 80, String(r.percent));
});
