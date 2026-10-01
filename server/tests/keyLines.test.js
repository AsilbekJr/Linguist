const test = require('node:test');
const assert = require('node:assert/strict');
const { pickKeyLines, pickDailySessionWords } = require('../utils/topicHelpers');

/**
 * "Yod olish" gaplari: so'z yolg'iz emas, gap ichida yodlanadi.
 * Tanlov serverda — Sahna va Suhbat ("Yordam") bir xil ro'yxatga tayanadi.
 */

const topics = (() => {
  const data = require('../data/topics.json');
  return Array.isArray(data) ? data : data.topics;
})();

test("har bir kurs kunida 3-5 ta kalit gap bor va ular dialogdagi tartibda", () => {
  for (const topic of topics) {
    const { dailyWords } = pickDailySessionWords(topic.words || [], [], 8);
    const lines = pickKeyLines(topic.dialogue || [], dailyWords);
    assert.ok(lines.length >= 3 && lines.length <= 5, `${topic.day}-kun: ${lines.length} ta`);
    const order = lines.map((l) => l.index);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${topic.day}-kun tartibi buzilgan`);
  }
});

test("bugungi so'z bor gaplar birinchi tanlanadi", () => {
  const dialogue = [
    { speaker: 'A', en: 'Good morning to you all.', uz: 'Xayrli tong.' },
    { speaker: 'B', en: 'I need a prescription for this.', uz: 'Menga retsept kerak.' },
    { speaker: 'A', en: 'The pharmacy is closed today.', uz: 'Dorixona yopiq.' },
    { speaker: 'B', en: 'Okay.', uz: 'Xo\'p.' },
  ];
  const lines = pickKeyLines(dialogue, [{ word: 'prescription' }, { word: 'pharmacy' }]);
  const withWords = lines.filter((l) => l.words.length);
  assert.deepEqual(withWords.map((l) => l.words[0]), ['prescription', 'pharmacy']);
  // Juda qisqa qator ("Okay.") yodlash uchun tanlanmaydi
  assert.ok(!lines.some((l) => l.en === 'Okay.'));
});

test("ko'p so'zli ibora ham topiladi", () => {
  const dialogue = [{ speaker: 'A', en: 'Could you look after my bag, please?', uz: '' }];
  const lines = pickKeyLines(dialogue, [{ word: 'look after' }]);
  assert.deepEqual(lines[0].words, ['look after']);
});
