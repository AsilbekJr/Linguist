const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreDictation, dictationFeedback, normalizeContractions } = require('../utils/dictation');

test('mukammal moslik 100% beradi', () => {
  const r = scoreDictation('My name is Aziz.', 'My name is Aziz');
  assert.equal(r.score, 100);
  assert.equal(r.isPerfect, true);
  assert.equal(r.missedWords.length, 0);
  assert.ok(r.tokens.every((t) => t.status === 'correct'));
});

test('registr va tinish belgilari xato hisoblanmaydi', () => {
  const r = scoreDictation('Hello! What is your name?', 'hello what is your name');
  assert.equal(r.score, 100);
});

test("qisqartmalar to'liq shakl bilan teng", () => {
  // Foydalanuvchi "don't" deb yozsa, "do not" bilan bir xil qabul qilinadi
  assert.equal(scoreDictation('I do not eat meat', "I don't eat meat").score, 100);
  assert.equal(scoreDictation("It's cold today", 'It is cold today').score, 100);
  assert.equal(scoreDictation('I am a student', "I'm a student").score, 100);
});

test("o'tkazib yuborilgan so'z aniqlanadi", () => {
  const r = scoreDictation('The bus leaves at eight', 'The bus leaves eight');
  assert.equal(r.correctCount, 4);
  assert.equal(r.total, 5);
  assert.equal(r.score, 80);
  assert.deepEqual(r.missedWords, ['at']);
  assert.ok(r.tokens.some((t) => t.word === 'at' && t.status === 'missing'));
});

test("ortiqcha so'z 'extra' deb belgilanadi va ballni oshirmaydi", () => {
  const r = scoreDictation('I need a bag', 'I really need a big bag');
  assert.equal(r.correctCount, 4);
  assert.equal(r.score, 100, 'barcha kutilgan so\'zlar bor');
  assert.equal(r.isPerfect, false, 'ortiqcha so\'zlar bor — mukammal emas');
  const extras = r.tokens.filter((t) => t.status === 'extra').map((t) => t.word);
  assert.deepEqual(extras.sort(), ['big', 'really']);
});

test("so'z tartibi buzilsa ham LCS to'g'ri ishlaydi", () => {
  const r = scoreDictation('the price is fifty thousand som', 'the price is som fifty thousand');
  assert.ok(r.score > 50 && r.score < 100, `kutilmagan ball: ${r.score}`);
  assert.ok(r.tokens.some((t) => t.status === 'extra' || t.status === 'missing'));
});

test("butunlay noto'g'ri javob 0 ga yaqin", () => {
  const r = scoreDictation('Where is the station', 'apple banana orange');
  assert.equal(r.score, 0);
  assert.equal(r.correctCount, 0);
  assert.equal(r.missedWords.length, 4);
});

test("bo'sh javob xato bermaydi", () => {
  const r = scoreDictation('Hello there', '');
  assert.equal(r.score, 0);
  assert.equal(r.total, 2);
  assert.equal(r.tokens.filter((t) => t.status === 'missing').length, 2);
});

test("bo'sh asl matn xavfsiz ishlanadi", () => {
  const r = scoreDictation('', 'something');
  assert.equal(r.score, 0);
  assert.equal(r.total, 0);
});

test('tokenlar tartibi asl gapni tiklaydi', () => {
  // UI tokenlarni ketma-ket chizadi — tartib buzilsa fikr-mulohaza o'qib bo\'lmaydi
  const r = scoreDictation('I live in Tashkent now', 'I live Tashkent now');
  const reconstructed = r.tokens
    .filter((t) => t.status !== 'extra')
    .map((t) => t.word)
    .join(' ');
  assert.equal(reconstructed, 'i live in tashkent now');
});

test('normalizeContractions faqat butun so\'zlarga tegadi', () => {
  const out = normalizeContractions("I can't go");
  assert.ok(out.includes('cannot') || out.includes('can not'), out);
  // "cant" (apostrofsiz) alohida so'z — o'zgartirilmasligi kerak
  assert.equal(normalizeContractions('scanty cant'), 'scanty cant');
});

test('fikr-mulohaza natijaga mos keladi', () => {
  assert.match(dictationFeedback(scoreDictation('one two', 'one two')), /Mukammal/);
  assert.match(dictationFeedback(scoreDictation('a b c d e f g h i j', 'x y z')), /Qiyin|tinglang/);
  assert.equal(dictationFeedback({ total: 0 }), 'Matn topilmadi.');
});
