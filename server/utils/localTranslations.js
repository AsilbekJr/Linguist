const { loadTopics } = require('./topicsData');

/**
 * AI'siz o'zbekcha tarjima: kurs sahnalari (data/topics.json) va mavzular
 * kutubxonasi (content/vocab-topics) so'zlaridan yig'ilgan lug'at.
 *
 * Gemini javob bermaganda (yoki kalit yo'q bo'lsa) so'z tarjimasiz saqlanardi
 * va takrorlashda boshlovchi uchun eng oson topshiriq — variant tanlash —
 * ishlamay qolardi. Ko'p so'zlar esa bizning o'z kontentimizda allaqachon
 * tarjimasi bilan bor. ~5000 so'z, bir marta yig'iladi.
 */
let cache = null;

const build = () => {
  const map = new Map();
  const add = (word, translation) => {
    const key = String(word || '').trim().toLowerCase();
    const tr = String(translation || '').trim();
    if (key && tr && !map.has(key)) map.set(key, tr);
  };
  try {
    for (const topic of loadTopics()) for (const w of topic.words || []) add(w.word, w.translation);
  } catch {
    // kurs fayli yo'q — kutubxona bilan davom etamiz
  }
  try {
    const { getLevels } = require('../content/vocab-topics');
    for (const level of getLevels()) for (const t of level.topics) for (const w of t.words) add(w.word, w.translation);
  } catch {
    // kutubxona yuklanmadi — kurs so'zlarining o'zi yetadi
  }
  return map;
};

/** @returns {string} tarjima yoki '' */
const lookupTranslation = (word) => {
  if (!cache) cache = build();
  return cache.get(String(word || '').trim().toLowerCase()) || '';
};

module.exports = { lookupTranslation };
