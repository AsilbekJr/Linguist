/**
 * Mavzular kutubxonasi: daraja → mavzu → so'zlar.
 *
 * Kunlik kursdan farqi: bu erkin tanlov. Foydalanuvchi o'ziga kerakli
 * mavzuni ochadi va so'zlarni lug'atiga qo'shadi — qo'shilgan so'z odatdagi
 * takrorlashga tushadi (tanib olish → eslash → gap tuzish).
 *
 * Yangi daraja qo'shish: shu papkada fayl yozib, LEVEL_FILES ga qo'shing.
 */

const { PARTS_OF_SPEECH, containsWord } = require('../schema');

const LEVEL_FILES = ['./elementary', './upper-intermediate', './advanced'];

const normalize = (s) => String(s || '').trim().toLowerCase();

/** Namuna gapda so'z (yoki uning shakli) bormi — defisli so'zlar uchun ham */
const exampleUsesWord = (example, word) => {
  const w = normalize(word);
  if (/[\s'-]/.test(w)) return normalize(example).includes(w);
  return containsWord(example, word);
};

const toWord = ([word, partOfSpeech, translation, example, exampleUz]) => ({
  word,
  partOfSpeech,
  translation,
  example,
  exampleUz,
});

const loadLevels = () =>
  LEVEL_FILES.map((file) => {
    const level = require(file);
    return {
      ...level,
      topics: level.topics.map((t) => ({
        ...t,
        id: `${level.key}-${String(t.unit).padStart(2, '0')}`,
        level: level.key,
        cefr: level.cefr,
        words: t.words.map(toWord),
      })),
    };
  });

/**
 * Kontentni tekshiradi.
 * @returns {string[]} xatolar
 */
const validateLevels = (levels) => {
  const errs = [];
  // Butun kutubxona bo'yicha: bir so'z faqat bitta mavzuda. Lug'atda so'z
  // bitta yozuv — ikkinchi mavzuda u "allaqachon qo'shilgan" bo'lib ko'rinardi
  const owner = new Map();
  for (const level of levels) {
    const ids = new Set();
    for (const t of level.topics) {
      const ref = `${t.id} (${t.title})`;
      if (ids.has(t.id)) errs.push(`${ref}: unit takrorlangan`);
      ids.add(t.id);
      for (const f of ['title', 'titleUz', 'emoji']) {
        if (!t[f]) errs.push(`${ref}: "${f}" bo'sh`);
      }
      if (t.words.length < 8) errs.push(`${ref}: kamida 8 ta so'z kerak (${t.words.length})`);

      const seen = new Set();
      for (const w of t.words) {
        const at = `${ref} → "${w.word}"`;
        for (const f of ['word', 'partOfSpeech', 'translation', 'example', 'exampleUz']) {
          if (!w[f] || !String(w[f]).trim()) errs.push(`${at}: "${f}" bo'sh`);
        }
        if (!w.word) continue;
        const key = normalize(w.word);
        if (seen.has(key)) errs.push(`${at}: mavzuda takrorlangan`);
        else if (owner.has(key)) errs.push(`${at}: boshqa mavzuda ham bor (${owner.get(key)})`);
        seen.add(key);
        if (!owner.has(key)) owner.set(key, t.id);
        if (!PARTS_OF_SPEECH.has(w.partOfSpeech)) errs.push(`${at}: noma'lum so'z turkumi "${w.partOfSpeech}"`);
        if (normalize(w.translation) === key) errs.push(`${at}: tarjima so'zning o'zi`);
        if (w.example && !exampleUsesWord(w.example, w.word)) errs.push(`${at}: misolda so'z ishlatilmagan`);
      }
    }
  }
  return errs;
};

let cache = null;
const getLevels = () => {
  if (!cache) cache = loadLevels();
  return cache;
};

const getTopic = (id) => {
  for (const level of getLevels()) {
    const topic = level.topics.find((t) => t.id === id);
    if (topic) return topic;
  }
  return null;
};

module.exports = { getLevels, getTopic, validateLevels, loadLevels, exampleUsesWord };
