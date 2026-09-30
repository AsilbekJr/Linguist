const { loadTopics } = require('./topicsData');
const { findWordInSentence, sentenceTokens } = require('./reviewModes');

/**
 * "Sizning so'zlaringiz" — kunlik sahnadagi faol ishlatish bloki.
 *
 * Muammo: foydalanuvchi o'rgangan so'z faqat takrorlash kartochkasida
 * yashardi — u hech qachon yangi kontekstda uchramasdi. Tadqiqotlar esa
 * so'z turli kontekstlarda qayta-qayta ko'rilganda va ishlatilganda chuqur
 * xotiraga o'tishini ko'rsatadi.
 *
 * Yechim (AI'siz): foydalanuvchining takrorlashdagi so'zlaridan bir nechtasi
 * uchun gap topiladi — avval BUGUNGI mavzu dialogidan, keyin kursdagi va
 * kutubxonadagi boshqa gaplardan, oxirida so'zning o'z misolidan. Gapda so'z
 * o'rni bo'sh qoladi, foydalanuvchi uni so'zlar bankidan qo'yadi.
 */

const MAX_ITEMS = 4;
const MIN_ITEMS = 2;
const MAX_TOKENS = 16;

/** Kurs va kutubxonadagi barcha inglizcha gaplar (o'zbekchasi bilan) — bir marta yig'iladi */
let sentenceCache = null;
const courseSentences = () => {
  if (sentenceCache) return sentenceCache;
  const out = [];
  const seen = new Set();
  const add = (en, uz, source) => {
    const key = String(en || '').trim();
    if (!key || seen.has(key)) return;
    const n = sentenceTokens(key).length;
    if (n < 3 || n > MAX_TOKENS) return;
    seen.add(key);
    out.push({ en: key, uz: String(uz || '').trim(), source });
  };
  try {
    for (const t of loadTopics()) {
      for (const line of t.dialogue || []) add(line.en, line.uz, 'course');
      for (const w of t.words || []) add(w.example, w.exampleUz, 'course');
    }
  } catch {
    // kurs yo'q — kutubxona yetadi
  }
  try {
    const { getLevels } = require('../content/vocab-topics');
    for (const level of getLevels()) for (const t of level.topics) for (const w of t.words) add(w.example, w.exampleUz, 'library');
  } catch {
    // kutubxona yuklanmadi
  }
  sentenceCache = out;
  return out;
};

const maskForm = (sentence, form) => String(sentence).replace(form, '_____'); // form — findWordInSentence natijasi

/** So'z uchun eng mos gap: bugungi dialog → kurs/kutubxona → o'z misoli */
const sentenceForWord = (w, dialogue, pool) => {
  for (const line of dialogue) {
    const form = findWordInSentence(line.en, w.word);
    if (form) return { en: line.en, uz: line.uz || '', form, source: 'topic' };
  }
  for (const s of pool) {
    const form = findWordInSentence(s.en, w.word);
    if (form) return { ...s, form };
  }
  const own = (w.examples || [])[0];
  const form = own && findWordInSentence(own, w.word);
  if (form) return { en: own, uz: w.exampleUz || '', form, source: 'own' };
  return null;
};

/**
 * @param {Array} words — foydalanuvchining so'zlari (ustuvorlik tartibida)
 * @param {{dialogue?: Array, exclude?: Set<string>, pool?: Array}} opts
 * @returns {Array<{id, word, translation, sentence, answer, sentenceUz, source}>}
 *   `answer` — gapdagi aniq shakl ("journeys"), bankda shu ko'rinadi
 */
const buildActiveItems = (words, { dialogue = [], exclude = new Set(), pool = courseSentences() } = {}) => {
  const items = [];
  const usedSentences = new Set();
  const usedAnswers = new Set();
  for (const w of words) {
    if (items.length >= MAX_ITEMS) break;
    const key = String(w.word || '').toLowerCase();
    if (!key || exclude.has(key)) continue;
    const found = sentenceForWord(w, dialogue, pool);
    if (!found || usedSentences.has(found.en)) continue;
    // Bankda bir xil shakl ikki marta bo'lsa, qaysi gapga qaysisi — farqlab bo'lmaydi
    const answerKey = found.form.toLowerCase();
    if (usedAnswers.has(answerKey)) continue;
    usedSentences.add(found.en);
    usedAnswers.add(answerKey);
    items.push({
      id: String(w._id),
      word: w.word,
      translation: w.translation || '',
      sentence: maskForm(found.en, found.form),
      answer: found.form,
      sentenceUz: found.uz,
      source: found.source,
    });
  }
  // Bugungi mavzudan topilganlar birinchi
  items.sort((a, b) => (a.source === 'topic' ? 0 : 1) - (b.source === 'topic' ? 0 : 1));
  return items.length >= MIN_ITEMS ? items : [];
};

module.exports = { buildActiveItems, courseSentences, MAX_ITEMS, MIN_ITEMS };
