/**
 * Diktant baholash — eshitilgan gapni yozib olish mashqi.
 *
 * Nega alohida modul: bu mashqning butun qiymati ANIQ fikr-mulohazada.
 * "60% to'g'ri" degan raqam foydasiz; foydalanuvchi qaysi so'zni o'tkazib
 * yuborgani va qaysi so'zni noto'g'ri eshitganini ko'rishi kerak.
 *
 * Shuning uchun bu yerda so'z darajasidagi taqqoslash (LCS asosida) bor:
 * "kutilgan" va "yozilgan" ketma-ketliklar solishtiriladi va har bir so'zga
 * holat beriladi: correct | wrong | missing | extra.
 */

/** Tinish belgilari va registrni tashlab, so'zlarga bo'lish */
const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Diktantda bu farqlar xato hisoblanmaydi */
const EQUIVALENTS = [
  ['do not', "don't"],
  ['does not', "doesn't"],
  ['did not', "didn't"],
  ['cannot', "can't"],
  ['can not', "can't"],
  ['i am', "i'm"],
  ['it is', "it's"],
  ['that is', "that's"],
  ['what is', "what's"],
  ['let us', "let's"],
  ['you are', "you're"],
  ['we are', "we're"],
  ['they are', "they're"],
  ['i will', "i'll"],
  ['is not', "isn't"],
  ['are not', "aren't"],
  ['will not', "won't"],
];

/**
 * Qisqartmalarni yoyadi: "don't" → "do not".
 * Busiz to'g'ri yozgan foydalanuvchi faqat apostrof tufayli xato olardi.
 */
const normalizeContractions = (text) => {
  let out = ` ${String(text || '').toLowerCase()} `;
  for (const [full, short] of EQUIVALENTS) {
    out = out.split(` ${short} `).join(` ${full} `);
  }
  return out.trim();
};

const prepare = (text) => tokenize(normalizeContractions(text));

/**
 * Eng uzun umumiy ketma-ketlik jadvali.
 * Kichik gaplar uchun (diktant qatori odatda < 20 so'z) O(n·m) yetarli.
 */
const lcsTable = (a, b) => {
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
};

/**
 * Diktantni baholaydi.
 *
 * @param {string} expected  asl gap
 * @param {string} typed     foydalanuvchi yozgani
 * @returns {{
 *   score: number,            // 0..100 — to'g'ri joylashgan so'zlar ulushi
 *   correctCount: number,
 *   total: number,
 *   isPerfect: boolean,
 *   tokens: Array<{word: string, status: 'correct'|'missing'|'extra'}>,
 *   missedWords: string[]
 * }}
 */
const scoreDictation = (expected, typed) => {
  const a = prepare(expected);
  const b = prepare(typed);

  if (a.length === 0) {
    return { score: 0, correctCount: 0, total: 0, isPerfect: false, tokens: [], missedWords: [] };
  }

  const table = lcsTable(a, b);
  const tokens = [];
  const missedWords = [];
  let i = 0;
  let j = 0;
  let correctCount = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      tokens.push({ word: a[i], status: 'correct' });
      correctCount++;
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      // Kutilgan so'z yozilmagan
      tokens.push({ word: a[i], status: 'missing' });
      missedWords.push(a[i]);
      i++;
    } else {
      // Ortiqcha so'z yozilgan
      tokens.push({ word: b[j], status: 'extra' });
      j++;
    }
  }
  while (i < a.length) {
    tokens.push({ word: a[i], status: 'missing' });
    missedWords.push(a[i]);
    i++;
  }
  while (j < b.length) {
    tokens.push({ word: b[j], status: 'extra' });
    j++;
  }

  const score = Math.round((correctCount / a.length) * 100);

  return {
    score,
    correctCount,
    total: a.length,
    isPerfect: correctCount === a.length && b.length === a.length,
    tokens,
    missedWords,
  };
};

/** O'zbekcha qisqa xulosa */
const dictationFeedback = (result) => {
  if (result.total === 0) return 'Matn topilmadi.';
  if (result.isPerfect) return "Mukammal — barcha so'zlar to'g'ri!";
  if (result.score >= 90) return "Deyarli mukammal. Bir-ikki so'zga e'tibor bering.";
  if (result.score >= 70) {
    return result.missedWords.length
      ? `Yaxshi. O'tkazib yuborilgan so'zlar: ${result.missedWords.slice(0, 5).join(', ')}`
      : 'Yaxshi natija.';
  }
  if (result.score >= 40) return "Yana bir marta tinglang — sekinroq tugmasidan foydalaning.";
  return "Qiyin bo'ldi. Avval matnni o'qib chiqing, keyin tinglab yozing.";
};

module.exports = { scoreDictation, dictationFeedback, tokenize, normalizeContractions };
