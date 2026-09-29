const test = require('node:test');
const assert = require('node:assert/strict');
const {
  modeForStage,
  checkRecall,
  checkRecognize,
  buildOptions,
  maskWord,
  presentDueWord,
} = require('../utils/reviewModes');

test('rejim bosqichga qarab qiyinlashadi: 2 × tanib olish, 2 × eslash, qolgani gap', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(modeForStage), [
    'recognize', 'recognize', 'recall', 'recall', 'sentence', 'sentence', 'sentence',
  ]);
});

test('eslash: katta-kichik harf va bo\'shliq ahamiyatsiz', () => {
  assert.equal(checkRecall('Journey', '  journey ').isCorrect, true);
  assert.equal(checkRecall('journey', 'JOURNEY.').isCorrect, true);
});

test('eslash: uzun so\'zda bitta harf xatosi kechiriladi, qisqada — yo\'q', () => {
  assert.deepEqual(checkRecall('receive', 'receve'), { isCorrect: true, nearMiss: true });
  // 4 harfli so'zda bitta harf farqi — boshqa so'z bo'lishi mumkin (cat/cut)
  assert.equal(checkRecall('rent', 'rant').isCorrect, false);
  assert.equal(checkRecall('journey', 'jorny').isCorrect, false, 'ikki harf xatosi — xato');
  assert.equal(checkRecall('journey', '').isCorrect, false);
});

test('tanib olish: to\'g\'ri tarjima, aks holda xato', () => {
  assert.equal(checkRecognize("ko'prik", "Ko'prik"), true);
  assert.equal(checkRecognize("ko'prik", "ko’prik"), true, 'turli apostrof belgisi');
  assert.equal(checkRecognize("ko'prik", 'daryo'), false);
});

test('variantlar: 4 ta, unikal, to\'g\'ri javob ichida; avval o\'z so\'zlaridan', () => {
  const opts = buildOptions('sayohat', {
    ownPool: ['uy', 'sayohat', 'uy', 'non', 'suv'],
    coursePool: ['kitob', 'qalam'],
  });
  assert.equal(opts.length, 4);
  assert.equal(new Set(opts).size, 4);
  assert.ok(opts.includes('sayohat'));
  // O'z pool'i yetarli — kurs so'zlari kerak emas
  assert.ok(opts.every((o) => ['uy', 'sayohat', 'non', 'suv'].includes(o)));
});

test('variantlar: o\'z so\'zlari kam bo\'lsa kurs so\'zlari bilan to\'ldiriladi', () => {
  const opts = buildOptions('sayohat', { ownPool: ['uy'], coursePool: ['kitob', 'qalam', 'daftar'] });
  assert.equal(opts.length, 4);
  assert.ok(opts.includes('uy'));
});

test("misolda so'z shakllari bilan birga yashiriladi", () => {
  assert.equal(maskWord('Our journeys were long. Journey on!', 'journey'), 'Our _____ were long. _____ on!');
  assert.equal(maskWord('', 'x'), '');
});

test("navbat ko'rinishi javobni oshkor qilmaydi", () => {
  const w = {
    _id: '1', word: 'journey', translation: 'sayohat', phonetic: '/ˈdʒɜːni/',
    definition: 'a journey from A to B', examples: ['A long journey.'], exampleUz: "Uzoq sayohat.", stage: 0,
  };
  const rec = presentDueWord(w, 'recognize', ['a', 'b', 'c', 'sayohat']);
  assert.equal(rec.translation, undefined);
  assert.equal(rec.exampleUz, undefined);
  assert.equal(rec.definition, undefined);

  const recall = presentDueWord(w, 'recall');
  assert.equal(recall.word, undefined);
  assert.equal(recall.phonetic, undefined);
  assert.ok(!/journey/i.test(recall.definition));
  assert.ok(!/journey/i.test(recall.exampleMasked));
  assert.deepEqual(recall.hint, { firstLetter: 'j', length: 7 });
});
