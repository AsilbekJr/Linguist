/**
 * So'z takliflari — prefiks bo'yicha.
 *
 * Ro'yxat (`src/data/wordlist.js`, ~74 KB) DINAMIK import qilinadi: u faqat
 * foydalanuvchi so'z qo'shish maydoniga yozishni boshlaganda yuklanadi va
 * boshlang'ich bundle'ga umuman kirmaydi. Vite uni alohida, kontent-xesh
 * bilan nomlangan chunk qiladi, ya'ni service worker'ning `assets/`
 * qoidasi (stale-while-revalidate) unga o'z-o'zidan tegishli bo'ladi.
 */

/** Yuklangan ro'yxat (massiv) yoki null */
let words = null;
/** Parallel chaqiruvlar bitta importni kutsin */
let pending = null;

const loadWordlist = () => {
  if (words) return Promise.resolve(words);
  if (pending) return pending;

  pending = import('../data/wordlist.js')
    .then((mod) => {
      words = mod.default.split(' ');
      return words;
    })
    .catch((err) => {
      // Chunk yuklanmasa (oflayn, tarmoq uzilishi) — taklif bo'lmaydi, xolos.
      // So'z qo'shish oqimi buzilmasligi kerak.
      console.warn('So\'zlar ro\'yxati yuklanmadi:', err.message);
      words = [];
      return words;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
};

/** Eng ko'pi bilan shuncha taklif ko'rsatiladi */
export const SUGGESTION_LIMIT = 8;

/**
 * Ro'yxatdan prefiksga mos so'zlarni tanlaydi.
 *
 * Ro'yxat chastota bo'yicha tartiblangani uchun oddiy ketma-ket qidiruv
 * kifoya — birinchi mos kelganlar eng ko'p ishlatiladiganlari bo'ladi.
 * Trie yoki indeks qurish 10 000 element uchun keraksiz murakkablik.
 *
 * @param {string[]} list      chastota tartibidagi so'zlar
 * @param {string} prefix      foydalanuvchi yozgani
 * @param {object} [options]
 * @param {Set<string>} [options.exclude]  chiqarib tashlanadigan so'zlar (kichik harfda)
 * @param {number} [options.limit]
 * @returns {string[]}
 */
export const filterByPrefix = (list, prefix, options = {}) => {
  const { exclude, limit = SUGGESTION_LIMIT } = options;
  const q = String(prefix || '').trim().toLowerCase();

  // Faqat harflar: raqam yoki tinish belgisi bo'lsa mos keladigan so'z yo'q
  if (!q || !/^[a-z]+$/.test(q)) return [];

  const out = [];
  for (const word of list) {
    if (out.length >= limit) break;
    if (!word.startsWith(q)) continue;
    // Aynan yozilgan so'zning o'zi taklif sifatida foydasiz — uni bosish
    // hech narsani o'zgartirmaydi, lekin cheklangan 8 o'rinning birini egallaydi
    if (word === q) continue;
    if (exclude?.has(word)) continue;
    out.push(word);
  }
  return out;
};

/**
 * Prefiksga mos so'zlarni qaytaradi (ro'yxatni kerak bo'lsa yuklaydi).
 *
 * @param {string} prefix
 * @param {object} [options] — `filterByPrefix` bilan bir xil
 * @returns {Promise<string[]>}
 */
export const suggestWords = async (prefix, options = {}) => {
  const q = String(prefix || '').trim();
  // Ro'yxatni bo'sh maydon uchun yuklab o'tirmaymiz
  if (!q) return [];
  return filterByPrefix(await loadWordlist(), q, options);
};

/** Maydon fokus olganda ro'yxatni oldindan yuklash uchun */
export const preloadWordlist = () => {
  loadWordlist();
};
