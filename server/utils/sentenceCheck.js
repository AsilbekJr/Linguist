/**
 * AI'siz gap tekshiruvi — Gemini ishlamay qolganda ishlatiladi.
 *
 * Nega kerak:
 * Takrorlash endi yagona yo'l bilan o'tadi — so'z ishtirokida gap tuzish.
 * Agar bu yo'l Gemini'ga qattiq bog'lansa, kvota tugagan yoki kalit
 * sozlanmagan kuni foydalanuvchi UMUMAN ilgarilay olmasdi va streak uzilardi.
 * Loyihaning tamoyili boshqacha: AI yo'q bo'lsa ham asosiy oqim ishlaydi.
 *
 * Bu tekshiruv grammatikani BILMAYDI va shunday deb ko'rsatilishi kerak —
 * javobda `method: 'local'` qaytadi va UI "AI hozir ishlamayapti, grammatika
 * tekshirilmadi" deb aytadi. U faqat mashq haqiqatan bajarilganini tasdiqlaydi:
 * so'z ishlatilganmi va bu gapga o'xshaydimi.
 */

const { containsWord } = require('../content/schema');

/** Gap deb hisoblanishi uchun kamida shuncha so'z */
const MIN_TOKENS = 3;

const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .split(/[^a-z']+/)
    .filter(Boolean);

/**
 * @param {string} word      maqsad so'z
 * @param {string} sentence  foydalanuvchi yozgan (yoki aytgan) gap
 * @returns {{isCorrect: boolean, usedTargetWord: boolean, feedback: string, method: 'local'}}
 */
const checkSentenceLocally = (word, sentence) => {
  const tokens = tokenize(sentence);
  // `containsWord` so'z shakllarini ham biladi (live → lives, lived, living),
  // shuning uchun oddiy `includes` o'rniga o'sha ishlatiladi
  const usedTargetWord = containsWord(sentence, word);

  const base = { usedTargetWord, method: 'local' };

  if (!usedTargetWord) {
    return {
      ...base,
      isCorrect: false,
      feedback: `Gapda "${word}" so'zi ishlatilmagan. Shu so'z bilan gap tuzing.`,
    };
  }
  if (tokens.length < MIN_TOKENS) {
    return {
      ...base,
      isCorrect: false,
      feedback: `Gap juda qisqa — kamida ${MIN_TOKENS} ta so'z bo'lsin.`,
    };
  }
  // "help help help" kabi javoblar mashq emas
  if (new Set(tokens).size < 2) {
    return {
      ...base,
      isCorrect: false,
      feedback: "Bu gap emas — so'z takrorlangan xolos.",
    };
  }

  return {
    ...base,
    isCorrect: true,
    // AI nega ishlamagani (uzilish yoki kunlik limit) va bosqich o'zgargani
    // (mashq rejimida o'zgarmaydi) bu yerda noma'lum — ularni UI aytadi
    feedback: "So'z to'g'ri ishlatildi.",
  };
};

module.exports = { checkSentenceLocally, MIN_TOKENS };
