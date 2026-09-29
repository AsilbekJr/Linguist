/**
 * Lug'at snapshotini runtime'da o'qish.
 *
 * `data/dictionary-snapshot.json` ni `scripts/fetch-dictionary.js` build vaqtida
 * yozadi va u repoga kommit qilinadi. Bu yerda faqat o'qiladi — hech qachon
 * tarmoqqa chiqilmaydi.
 *
 * Nega kerak: kurrikulumdagi 300 so'z hamma foydalanuvchida bir xil. Ilgari
 * ularning har biri uchun `api.dictionaryapi.dev` ga jonli so'rov ketardi:
 * bepul, SLA'siz va rate limit'li API bilan bu ilovaning asosiy oqimini
 * tashqi xizmatga bog'lab qo'yardi. Endi kurrikulum so'zlari umuman tarmoqqa
 * chiqmaydi; faqat foydalanuvchi o'zi yozgan begona so'z chiqadi.
 */

const path = require('path');

const SNAPSHOT_PATH = path.join(__dirname, '../data/dictionary-snapshot.json');

/**
 * `null` — hali yuklanmagan, `false` — yuklab bo'lmadi (qayta urinilmaydi).
 * Snapshot yo'q bo'lsa ilova ishlashda davom etadi, shunchaki tarmoqqa chiqadi.
 */
let entries = null;

const load = () => {
  if (entries !== null) return entries;
  try {
    // require JSON'ni bir marta parse qilib keshlaydi
    entries = require(SNAPSHOT_PATH).entries || false;
  } catch (err) {
    console.warn(`Lug'at snapshoti yuklanmadi (${err.message}) — tashqi API ishlatiladi.`);
    entries = false;
  }
  return entries;
};

/** Eng ko'p ishlatiladigan ma'no — API ularni chastota bo'yicha tartiblab beradi */
const primaryMeaning = (entry) => entry.meanings?.[0] || null;

/**
 * So'zni snapshotdan qidiradi.
 *
 * @returns {null} snapshotda yo'q — chaqiruvchi tashqi API'ga murojaat qilsin
 * @returns {{notFound: true}} so'z ingliz lug'atida yo'q (404 keshlangan)
 * @returns {object} `wordRoutes` kutadigan shakl
 */
const lookupSnapshot = (word) => {
  const store = load();
  if (!store) return null;

  const entry = store[String(word || '').toLowerCase().trim()];
  if (!entry) return null;
  if (entry.notFound) return { notFound: true };

  const meaning = primaryMeaning(entry);
  const definition = meaning?.definitions?.[0];

  return {
    word: entry.word,
    phonetic: entry.phonetics?.[0] || '',
    definition: definition?.definition || '',
    partOfSpeech: meaning?.partOfSpeech || '',
    examples: definition?.example ? [definition.example] : [],
    synonyms: meaning?.synonyms || [],
    collocations: [],
    sourceUrls: entry.sourceUrls || [],
  };
};

module.exports = { SNAPSHOT_PATH, lookupSnapshot };
