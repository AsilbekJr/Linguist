#!/usr/bin/env node
/**
 * So'z takliflari uchun ro'yxat: chastota korpusi  →  src/data/wordlist.js
 *
 * Nega tashqi API emas:
 * `api.dictionaryapi.dev` prefiks bo'yicha qidira olmaydi — u faqat aniq
 * so'zni topadi (`/entries/en/hel` → 404). Ya'ni "hel" yozganda "hello, help,
 * held" ni ko'rsatish uchun undan foydalanib bo'lmaydi va bizga alohida
 * so'zlar ro'yxati kerak.
 *
 * Nega chastota bo'yicha tartiblangan ro'yxat:
 * Alifbo tartibida "ab" so'rovi "abaca, abaci, aback" beradi — o'rganuvchi
 * uchun mutlaqo foydasiz. Chastota tartibida esa "about, above, able".
 * Shuning uchun ro'yxatning TARTIBI saqlanadi va qidiruv shu tartibda
 * birinchi mos kelganlarni oladi.
 *
 *   npm run wordlist:fetch
 *
 * Natija repoga kommit qilinadi — build paytida tarmoq talab qilinmaydi.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// first20hours/google-10000-english — Google'ning Trillion Word Corpus'i
// asosida, MIT litsenziyasi. "no-swears" varianti tanlangan: bu o'quv
// ilovasi va taklif ro'yxatida haqorat chiqishi mumkin emas.
const SOURCE =
  'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt';

const OUT_PATH = path.join(__dirname, '../src/data/wordlist.js');
const TIMEOUT_MS = 20000;

/**
 * Veb-korpus artefaktlari.
 *
 * Ro'yxat veb-sahifalardan yig'ilgani uchun ichida ingliz so'zi bo'lmagan
 * narsalar bor. Ular taklif ro'yxatida chiqsa, ilova o'ylamay ishlayotgandek
 * ko'rinadi — "ht" yozgan odamga "html" taklif qilishning ma'nosi yo'q.
 */
const CORPUS_JUNK = new Set([
  'www', 'http', 'https', 'html', 'htm', 'php', 'asp', 'aspx', 'xml', 'url',
  'jpg', 'jpeg', 'gif', 'png', 'pdf', 'doc', 'txt', 'zip', 'exe', 'css', 'js',
  'faq', 'faqs', 'abc', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah', 'ai',
  'inc', 'ltd', 'llc', 'isbn', 'asin', 'uk', 'usa', 'gmt', 'utc', 'nbsp',
  'href', 'src', 'img', 'div', 'span', 'nav', 'ie', 'eg', 'etc', 'vs',
]);

const main = async () => {
  console.log(`\nManba: ${SOURCE}`);

  let text;
  try {
    const res = await fetch(SOURCE, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.error(`\n✗ Ro'yxat olinmadi: ${err.message}`);
    console.error('  Mavjud src/data/wordlist.js o\'zgarishsiz qoldi.\n');
    process.exit(1);
  }

  const raw = text.split(/\r?\n/).map((w) => w.trim().toLowerCase());
  const seen = new Set();
  const words = [];

  for (const word of raw) {
    // Faqat harflardan iborat va kamida 2 harfli. Bir harfli "a"/"i" ham
    // so'z, lekin taklif sifatida foydasiz.
    if (!/^[a-z]{2,}$/.test(word)) continue;
    if (CORPUS_JUNK.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }

  // Probel bilan ajratilgan bitta satr — JS massiv literalidan ~25% ixcham
  // (har elementga qo'shtirnoq va vergul ketmaydi). Runtime'da split qilinadi.
  const payload = words.join(' ');

  const file = `/**
 * Taklif ro'yxati uchun so'zlar — CHASTOTA BO'YICHA tartiblangan.
 *
 * AVTOMATIK YARATILGAN — qo'lda tahrirlamang.
 * Yangilash: npm run wordlist:fetch  (client/scripts/fetch-wordlist.js)
 *
 * Manba: first20hours/google-10000-english (MIT), Google Trillion Word Corpus
 * asosida, haqoratsiz variant. ${words.length} ta so'z.
 *
 * Tartib muhim: qidiruv shu ketma-ketlikda birinchi mos kelganlarni oladi,
 * shuning uchun "ab" → "about, above, able" chiqadi, "abaca" emas.
 * Massivga aylantirmang va saralamang.
 */
export default ${JSON.stringify(payload)};
`;

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, file, 'utf8');

  const kb = (Buffer.byteLength(file, 'utf8') / 1024).toFixed(1);
  console.log(`\n✓ Yozildi: ${path.relative(process.cwd(), OUT_PATH)}`);
  console.log(`  So'zlar:    ${words.length} (${raw.length - words.length} ta filtrlandi)`);
  console.log(`  Hajm:       ${kb} KB (lazy-load, boshlang'ich bundle'ga kirmaydi)`);
  console.log(`  Namuna:     ${words.slice(0, 8).join(', ')}\n`);
};

main().catch((err) => {
  console.error(`\nKutilmagan xato: ${err.stack || err.message}\n`);
  process.exit(1);
});
