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

test('rejim bosqich va darajaga qarab qiyinlashadi; boshlovchidan erkin gap talab qilinmaydi', () => {
  const ladder = (level) => [0, 1, 2, 3, 4, 5, 6].map((s) => modeForStage(s, level));
  assert.deepEqual(ladder('beginner'), ['recognize', 'recognize', 'recall', 'recall', 'cloze', 'build', 'build']);
  assert.deepEqual(ladder('intermediate'), ['recognize', 'recognize', 'recall', 'recall', 'cloze', 'build', 'sentence']);
  assert.deepEqual(ladder('advanced'), ['recognize', 'recognize', 'recall', 'recall', 'cloze', 'sentence', 'sentence']);
  // Daraja noma'lum bo'lsa — eng yumshoq zinapoya
  assert.deepEqual(ladder(undefined), ladder('beginner'));
});

test("misol gapi yo'q so'z bo'sh joy/gap yig'ishdan osonrog'iga tushadi", () => {
  const { modeForWord } = require('../utils/reviewModes');
  const noExample = { word: 'valley', translation: 'vodiy', examples: [] };
  assert.equal(modeForWord(noExample, 4, 'beginner'), 'recall');
  assert.equal(modeForWord(noExample, 5, 'beginner'), 'recall');
  // Gapda so'z yo'q (boshqa shakl) — cloze ham mumkin emas
  const irregular = { word: 'go', translation: 'bormoq', examples: ['She went home early.'] };
  assert.equal(modeForWord(irregular, 4, 'beginner'), 'recall');
  // Juda uzun gap — yig'ish o'rniga bo'sh joy
  const long = { word: 'river', translation: 'daryo', examples: ['We walked along the river for a very long time yesterday and saw many birds there.'] };
  assert.equal(modeForWord(long, 5, 'beginner'), 'cloze');
});

test("bo'sh joy: asosiy shakl ham, gapdagi shakl ham to'g'ri; gap yig'ish tartibni tekshiradi", () => {
  const { checkCloze, checkBuild, presentDueWord } = require('../utils/reviewModes');
  const w = { _id: 'x', word: 'journey', translation: 'sayohat', examples: ['Our journeys were long and tiring.'], exampleUz: 'Safarlarimiz uzoq edi.' };
  assert.deepEqual(checkCloze(w, 'journeys'), { isCorrect: true, nearMiss: false });
  assert.equal(checkCloze(w, 'journey').isCorrect, true);
  assert.equal(checkCloze(w, 'trip').isCorrect, false);
  assert.equal(checkBuild(w, 'our journeys were LONG and tiring').isCorrect, true);
  assert.equal(checkBuild(w, 'Were our journeys long and tiring').isCorrect, false);

  const cloze = presentDueWord(w, 'cloze');
  assert.equal(cloze.exampleMasked, 'Our _____ were long and tiring.');
  assert.equal(cloze.translation, undefined, "bo'sh joyda so'z tarjimasi ko'rinmaydi");
  assert.equal(cloze.word, undefined);
  const build = presentDueWord(w, 'build');
  assert.deepEqual([...build.tiles].sort(), ['Our', 'and', 'journeys', 'long', 'tiring', 'were'].sort());
  assert.notEqual(build.tiles.join(' '), 'Our journeys were long and tiring', "bo'laklar aralashtirilmagan");
  assert.equal(build.examples, undefined, "asl gap oshkor qilinmaydi");
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

test("tarjimasiz so'z tanib olish/eslash/gapga emas — tarjima yozishga tushadi", () => {
  const { modeForWord } = require('../utils/reviewModes');
  assert.equal(modeForWord({ translation: '' }, 0), 'translate');
  assert.equal(modeForWord({ translation: '   ' }, 2), 'translate');
  assert.equal(modeForWord({}, 5), 'translate');
  assert.equal(modeForWord({ translation: 'vodiy' }, 0), 'recognize');
  assert.equal(modeForWord({ translation: 'vodiy' }, 2), 'recall');
});

test("variantlarda bo'sh tarjima bo'lmaydi", () => {
  const opts = buildOptions('vodiy', { ownPool: ['', '  ', 'bolalar', 'kalit', null, 'tog\''], coursePool: [] });
  assert.ok(opts.every((o) => String(o).trim()), JSON.stringify(opts));
});

test("o'z kontentimizdan AI'siz tarjima topiladi", () => {
  const { lookupTranslation } = require('../utils/localTranslations');
  assert.equal(lookupTranslation('Valley'), 'vodiy');
  assert.equal(lookupTranslation('mother'), 'ona');
  assert.equal(lookupTranslation('serendipity'), '');
});
