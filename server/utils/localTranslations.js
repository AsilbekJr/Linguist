const { loadTopics } = require('./topicsData');

/**
 * AI'siz so'z ma'lumoti: kurs sahnalari (data/topics.json) va mavzular
 * kutubxonasi (content/vocab-topics) so'zlaridan yig'ilgan lug'at.
 *
 * Gemini javob bermaganda (yoki kalit yo'q bo'lsa) so'z tarjimasiz saqlanardi
 * va takrorlashda boshlovchi uchun eng oson topshiriq — variant tanlash —
 * ishlamay qolardi. Ko'p so'zlar esa bizning o'z kontentimizda allaqachon
 * tarjimasi bilan bor. ~5000 so'z, bir marta yig'iladi.
 *
 * Bu ma'lumot qo'lda yozilgan va validatordan o'tgan, shuning uchun tashqi
 * lug'atdan ISHONCHLIROQ: dictionaryapi.dev ba'zan boshqa so'zning ma'nosini
 * qaytaradi ("window" → "The inedible parts of a grain-producing plant").
 */
let cache = null;

const build = () => {
  const map = new Map();
  const add = (entry) => {
    const key = String(entry.word || '').trim().toLowerCase();
    if (!key || !String(entry.translation || '').trim() || map.has(key)) return;
    map.set(key, {
      translation: String(entry.translation).trim(),
      definition: entry.definition || '',
      example: entry.example || '',
      exampleUz: entry.exampleUz || '',
      partOfSpeech: entry.partOfSpeech || '',
      phonetic: entry.phonetic || '',
      collocations: Array.isArray(entry.collocations) ? entry.collocations : [],
    });
  };
  // Kurs birinchi: unda inglizcha ta'rif ham bor
  try {
    for (const topic of loadTopics()) for (const w of topic.words || []) add(w);
  } catch {
    // kurs fayli yo'q — kutubxona bilan davom etamiz
  }
  try {
    const { getLevels } = require('../content/vocab-topics');
    for (const level of getLevels()) for (const t of level.topics) for (const w of t.words) add(w);
  } catch {
    // kutubxona yuklanmadi — kurs so'zlarining o'zi yetadi
  }
  return map;
};

/** @returns {null | {translation, definition, example, exampleUz, partOfSpeech, phonetic, collocations}} */
const lookupEntry = (word) => {
  if (!cache) cache = build();
  return cache.get(String(word || '').trim().toLowerCase()) || null;
};

/** @returns {string} tarjima yoki '' */
const lookupTranslation = (word) => lookupEntry(word)?.translation || '';

module.exports = { lookupTranslation, lookupEntry };
