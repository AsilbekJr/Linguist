const test = require('node:test');
const assert = require('node:assert/strict');
const { enrichWord } = require('../utils/wordEnrichment');
const { lookupEntry } = require('../utils/localTranslations');

test("kurs so'zi: ma'no tashqi lug'atdan emas, kursdan olinadi", async () => {
  // Snapshotda "window" uchun boshqa so'zning ma'nosi bor ("chaff")
  const r = await enrichWord('window', { skipAI: true });
  assert.equal(r.status, 'ok');
  assert.equal(r.data.definition, lookupEntry('window').definition);
  assert.doesNotMatch(r.data.definition, /grain/i);
  assert.equal(r.data.translation, 'deraza');
  assert.equal(r.data.examples[0], lookupEntry('window').example);
  assert.ok(r.data.exampleUz, "misolning o'zbekchasi ham kursdan");
});

test("foydalanuvchi yozgan tarjima va misol ustun", async () => {
  const r = await enrichWord('window', {
    skipAI: true,
    manual: { translation: 'oyna', examples: ['The window is dirty.'] },
  });
  assert.equal(r.data.translation, 'oyna');
  assert.equal(r.data.examples[0], 'The window is dirty.');
  assert.equal(r.data.exampleUz, '', "boshqa gapning o'zbekchasi qo'shilmaydi");
});
