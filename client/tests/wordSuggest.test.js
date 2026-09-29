import test from 'node:test';
import assert from 'node:assert/strict';

import { filterByPrefix, suggestWords, SUGGESTION_LIMIT } from '../src/utils/wordSuggest.js';
import wordlist from '../src/data/wordlist.js';

/**
 * Bu testlar brauzer ham, qo'shimcha paket ham talab qilmaydi: `wordSuggest.js`
 * toza ESM va so'zlar ro'yxati oddiy string eksporti.
 *
 *   npm --prefix client test
 */

const words = wordlist.split(' ');

// ─── Toza mantiq ─────────────────────────────────────────────────────────────

const SAMPLE = ['the', 'help', 'held', 'hello', 'helpful', 'hell', 'helper', 'he'];

test('prefiksga mos so\'zlar ro\'yxat tartibida qaytadi', () => {
  assert.deepEqual(filterByPrefix(SAMPLE, 'hel', { limit: 3 }), ['help', 'held', 'hello']);
});

test('yozilgan so\'zning o\'zi taklif qilinmaydi', () => {
  // "help" ni bosish hech narsani o'zgartirmaydi, lekin 8 o'rinning birini yeydi
  const out = filterByPrefix(SAMPLE, 'help');
  assert.ok(!out.includes('help'), `o'zi chiqib qoldi: ${out}`);
  assert.deepEqual(out, ['helpful', 'helper']);
});

test('foydalanuvchida bor so\'zlar chiqarib tashlanadi', () => {
  const out = filterByPrefix(SAMPLE, 'hel', { exclude: new Set(['help', 'hello']) });
  assert.deepEqual(out, ['held', 'helpful', 'hell', 'helper']);
});

test('registr va probel ahamiyatsiz', () => {
  assert.deepEqual(filterByPrefix(SAMPLE, '  HEL ', { limit: 2 }), ['help', 'held']);
});

test('limit hurmat qilinadi', () => {
  assert.equal(filterByPrefix(SAMPLE, 'hel', { limit: 2 }).length, 2);
  assert.ok(filterByPrefix(words, 'a').length <= SUGGESTION_LIMIT);
});

test('bo\'sh yoki harf bo\'lmagan so\'rov bo\'sh natija beradi', () => {
  assert.deepEqual(filterByPrefix(SAMPLE, ''), []);
  assert.deepEqual(filterByPrefix(SAMPLE, '   '), []);
  assert.deepEqual(filterByPrefix(SAMPLE, '123'), []);
  assert.deepEqual(filterByPrefix(SAMPLE, 'he llo'), []);
  assert.deepEqual(filterByPrefix(SAMPLE, null), []);
});

test('mos kelmasa bo\'sh massiv', () => {
  assert.deepEqual(filterByPrefix(SAMPLE, 'zzz'), []);
});

// ─── Haqiqiy ro'yxat ─────────────────────────────────────────────────────────

test('ro\'yxat yuklandi va tozalangan', () => {
  assert.ok(words.length > 9000, `so'zlar soni ${words.length}`);
  for (const w of words) {
    assert.match(w, /^[a-z]{2,}$/, `yaroqsiz yozuv: "${w}"`);
  }
});

test('ro\'yxat chastota tartibida — alifbo tartibida EMAS', () => {
  // Bu butun xususiyatning sifatini belgilaydi: alifbo tartibida "ab" so'rovi
  // "abaca, abaci" berardi, chastota tartibida esa "about, above, able"
  assert.equal(words[0], 'the');
  const sortedAlphabetically = [...words].sort();
  assert.notDeepEqual(words.slice(0, 20), sortedAlphabetically.slice(0, 20));
});

test('bir harf ham natija beradi', async () => {
  // Foydalanuvchi "bir ikki harf" yozganda taklif chiqishi kerak
  const out = await suggestWords('h');
  assert.equal(out.length, SUGGESTION_LIMIT);
  assert.ok(out.every((w) => w.startsWith('h')));
});

test('haqiqiy ro\'yxatda kutilgan so\'zlar bor', async () => {
  const hel = await suggestWords('hel');
  assert.ok(hel.includes('hello'), `hello yo'q: ${hel}`);
  assert.ok(hel.includes('help'), `help yo'q: ${hel}`);

  const ab = await suggestWords('ab');
  assert.ok(ab.includes('about'), `about yo'q: ${ab}`);
  assert.ok(!ab.includes('abaci'), 'kam ishlatiladigan so\'z yuqoriga chiqib qolgan');
});

test('veb-korpus axlati filtrlangan', async () => {
  const junk = new Set(['www', 'http', 'html', 'jpg', 'php', 'abc']);
  for (const w of words) {
    assert.ok(!junk.has(w), `filtrlanmagan axlat: "${w}"`);
  }
});

test('kurrikulum so\'zlari ro\'yxatda bor', async () => {
  // Kurs so'zlari eng chastotali leksika — ular taklifda chiqmasa
  // xususiyat o'z auditoriyasiga xizmat qilmayotgan bo'lardi
  const set = new Set(words);
  for (const w of ['student', 'family', 'weather', 'kitchen', 'answer', 'goal']) {
    assert.ok(set.has(w), `kurrikulum so'zi ro'yxatda yo'q: ${w}`);
  }
});
