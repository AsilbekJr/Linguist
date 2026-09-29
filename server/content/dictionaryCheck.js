/**
 * Kurrikulumni lug'at snapshoti bilan solishtirish.
 *
 * Nega kerak:
 * `curriculum/*.js` dagi IPA va partOfSpeech QO'LDA yozilgan. 300 ta so'zda
 * bitta xato transkripsiya — masalan `/wɜːk/` o'rniga `/wɔːk/` — hech kimga
 * ko'rinmaydi: dastur ishlaydi, test o'tadi, faqat foydalanuvchi noto'g'ri
 * o'rganadi. `schema.js` buni ushlay olmaydi, chunki uning tekshiradigan
 * mustaqil manbasi yo'q. `data/dictionary-snapshot.json` — aynan shu manba.
 *
 * Qat'iylik darajalari ataylab farqlanadi:
 *
 *  XATO (build to'xtaydi)  — so'z ingliz tilida umuman yo'q (`notFound`).
 *      Bu deyarli har doim imlo xatosi va bunga shubha yo'q.
 *
 *  OGOHLANTIRISH           — IPA yoki partOfSpeech farqi.
 *      Bu YERDA XATO QILISH OSON: Wiktionary bir so'zga bir nechta talaffuz
 *      beradi (UK/US), o'quv lug'atlari esa soddalashtirilganini beradi.
 *      Farqni xato deb hisoblasak, to'g'ri kontent build'ni yiqitardi va
 *      tekshiruv birinchi kundayoq o'chirib qo'yilardi.
 *
 * Snapshot yo'q bo'lsa tekshiruv butunlay o'tkazib yuboriladi — yangi klon,
 * offline build va CI tarmoqsiz ham ishlashi kerak.
 */

const fs = require('fs');
const path = require('path');

const SNAPSHOT_PATH = path.join(__dirname, '../data/dictionary-snapshot.json');
const EXCEPTIONS_PATH = path.join(__dirname, 'phonetic-exceptions.json');

/**
 * Kurrikulum POS → lug'atda qabul qilinadigan variantlar.
 *
 * `phrase` va `number` ataylab yo'q: Wiktionary birinchisini `interjection`,
 * ikkinchisini `numeral` yoki `noun` deb belgilaydi va bu farq mazmunli emas.
 * Ularni tekshirmaslik — soxta ogohlantirish chiqarishdan yaxshiroq.
 */
const POS_EQUIVALENTS = {
  noun: ['noun', 'proper noun'],
  verb: ['verb'],
  adjective: ['adjective'],
  adverb: ['adverb'],
  preposition: ['preposition'],
  pronoun: ['pronoun'],
  conjunction: ['conjunction'],
  determiner: ['determiner', 'article'],
};

/** Tekshirilmaydigan POS'lar — yuqoridagi izohga qarang */
const POS_UNVERIFIABLE = new Set(['phrase', 'number']);

/**
 * Notatsion ekvivalentlar.
 *
 * Wiktionary fonetik aniqlikni, o'quv lug'atlari (Oxford, Cambridge) esa
 * soddalikni tanlaydi. Bir xil tovush ikki xil yoziladi va bu XATO EMAS:
 *
 *   ɹ ↔ r     Wiktionary `/ɹeɪn/`, o'quv lug'ati `/reɪn/` — bir xil tovush
 *   ɛ ↔ e     DRESS unlisi: `/bɹɛd/` va `/bred/`
 *   ɡ ↔ g     U+0261 va oddiy "g" — ko'z bilan farqlab bo'lmaydi
 *   ɚ → ər    amerikacha r-rangli schwa
 *   ɝ → ɜr    amerikacha r-rangli ɜ
 *
 * Bularni foldlamasak, tekshiruv 300 so'zning yarmiga ogohlantirish berardi
 * va shu zahoti o'chirilardi.
 */
const NOTATION_FOLD = [
  [/ɹ/g, 'r'],
  [/ɡ/g, 'g'],
  [/ɛ/g, 'e'],
  [/ɚ/g, 'ər'],
  [/ɝ/g, 'ɜr'],
  // TRAP-BATH unlisi: Wiktionary `/ˈan.sə/`, o'quv lug'ati `/ˈɑːnsə/`
  [/ɑ/g, 'a'],
  // Qorong'i "l": `/kɔːɫ/` = `/kɔːl/` — ingliz tilida bu alohida fonema emas
  [/ɫ/g, 'l'],
];

/**
 * Kuchsiz (reduksiyalangan) unlilar.
 *
 * Urg'usiz bo'g'inda `/ˈkɪtʃɪn/` va `/ˈkɪtʃən/`, `/dɪˈvaɪs/` va `/dəˈvaɪs/` —
 * bir xil talaffuzning ikki yozuvi. Bo'g'in hosil qiluvchi undoshdan oldingi
 * schwa ham shunday: `/ˈsiːzn/` = `/ˈsiːzən/`.
 *
 * Shuning uchun bu to'plam ichidagi almashinuv va schwa'ning tushib qolishi
 * MASOFAGA QO'SHILMAYDI. Boshqa har qanday unli almashinuvi esa haqiqiy
 * fonema farqi va to'liq narxda hisoblanadi — aynan shu `/wɔːk/` ni
 * `/wɜːk/` dan ajratadi.
 */
const WEAK_VOWELS = new Set(['ə', 'ɪ', 'ʊ', 'ɐ', 'ɘ', 'ɨ']);

/**
 * IPA'ni solishtirish uchun normallashtiradi.
 *
 * Olib tashlanadi:
 *  - `/.../`, `[...]` chegaralari — yozuv uslubi, talaffuz emas;
 *  - bo'g'in nuqtasi `.`  — `/ˈstjuː.dənt/` va `/ˈstjuːdənt/` bir xil;
 *  - urg'u belgilari `ˈ ˌ` — o'quv lug'atlari ikkilamchini ko'pincha tushiradi;
 *  - qo'shma diakritikalar (U+0300–U+036F): bog'lovchi yoy `t͡ʃ`,
 *    bo'g'in hosil qiluvchi `l̩`, tish oldi `t̪` — hammasi notatsiya.
 *
 * Unli uzunligi `ː` SAQLANADI — `/ʃiːp/` (sheep) va `/ʃɪp/` (ship) farqi
 * aynan shu yerda, va bu o'zbek o'quvchilar uchun eng qiyin juftliklardan.
 */
const normalizePhonetic = (ipa) => {
  let out = String(ipa || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .trim()
    .replace(/^[/[]+|[/\]]+$/g, '')
    .replace(/[.\sˈˌ‿-]/g, '')
    .toLowerCase();
  for (const [re, to] of NOTATION_FOLD) out = out.replace(re, to);
  return out;
};

/**
 * Ixtiyoriy segmentlarni yoyadi: `/ˈmʌðə(ɹ)/` → {`ˈmʌðə`, `ˈmʌðər`}.
 *
 * Qavs Wiktionary'da rotik/norotik aksentlarni bitta qatorda berish uchun
 * ishlatiladi. Kurrikulum britancha (norotik) variantni yozadi, ya'ni qavssiz
 * shakl mos keladi — buni ko'rish uchun ikkala variantni ham hosil qilamiz.
 */
const phoneticVariants = (ipa) => {
  let variants = [normalizePhonetic(ipa)];

  for (let depth = 0; depth < 4; depth++) {
    const next = [];
    let expanded = false;
    for (const v of variants) {
      const m = v.match(/\(([^()]*)\)/);
      if (!m) {
        next.push(v);
        continue;
      }
      expanded = true;
      next.push(v.replace(m[0], ''), v.replace(m[0], m[1]));
    }
    variants = next;
    if (!expanded) break;
  }

  return [...new Set(variants.filter(Boolean))];
};

/** Ikki kuchsiz unlining almashuvi bepul, qolgani 1 */
const substitutionCost = (a, b) => {
  if (a === b) return 0;
  return WEAK_VOWELS.has(a) && WEAK_VOWELS.has(b) ? 0 : 1;
};

/** Kuchsiz unlining qo'shilishi/tushishi bepul (`/ˈsiːzn/` ↔ `/ˈsiːzən/`) */
const indelCost = (c) => (WEAK_VOWELS.has(c) ? 0 : 1);

/**
 * Og'irlikli Levenshtein — kod nuqtalari bo'yicha.
 *
 * Oddiy Levenshtein bu vazifaga yaramaydi: unda `/ˈkɪtʃɪn/` ↔ `/ˈkɪtʃən/`
 * (to'g'ri) va `/wɔːk/` ↔ `/wɜːk/` (xato) — ikkalasi ham 1 ga teng bo'lardi,
 * ya'ni chegarani qayerga qo'ysak ham biri noto'g'ri tomonda qolardi.
 */
const editDistance = (a, b) => {
  const x = Array.from(a);
  const y = Array.from(b);

  let prev = [0];
  for (let j = 1; j <= y.length; j++) prev[j] = prev[j - 1] + indelCost(y[j - 1]);

  for (let i = 1; i <= x.length; i++) {
    const curr = [prev[0] + indelCost(x[i - 1])];
    for (let j = 1; j <= y.length; j++) {
      curr[j] = Math.min(
        prev[j] + indelCost(x[i - 1]),
        curr[j - 1] + indelCost(y[j - 1]),
        prev[j - 1] + substitutionCost(x[i - 1], y[j - 1])
      );
    }
    prev = curr;
  }
  return prev[y.length];
};

/**
 * Notatsiyani foldlagandan keyin ham qoladigan farq — nechta tahrir?
 *
 * Nega aniq tenglik emas: fold hamma narsani qoplay olmaydi. Kuchsiz unlilar
 * (`/ˈkɪtʃɪn/` ↔ `/ˈkɪtʃən/`), bo'g'in hosil qiluvchi undoshdan oldingi schwa
 * (`/ˈsiːzn/` ↔ `/ˈsiːzən/`) — ikkalasi ham to'g'ri transkripsiya va bir
 * belgiga farq qiladi. Bizni qiziqtirgani "work" o'rniga "walk" yozib
 * yuborilgan holat, u esa 2 dan ko'p tahrir beradi.
 */
const phoneticDistance = (curriculumIpa, dictionaryPhonetics) => {
  const mine = phoneticVariants(curriculumIpa);
  if (!mine.length) return null;

  let best = Infinity;
  for (const dict of dictionaryPhonetics || []) {
    for (const theirs of phoneticVariants(dict)) {
      for (const target of mine) {
        best = Math.min(best, editDistance(target, theirs));
        if (best === 0) return 0;
      }
    }
  }
  return best === Infinity ? null : best;
};

/**
 * Shundan ko'p farq bo'lsa — ogohlantirish.
 *
 * 0 ataylab: og'irlikli masofa notatsiya va reduksiyani allaqachon bepul
 * qilib bo'ldi, ya'ni qolgan har bir belgi haqiqiy fonema farqi. Lekin
 * britancha/amerikacha variantlar ham xuddi shunday ko'rinadi — `/kəʊld/`
 * va `/koʊld/` orasida 1 belgi bor va ikkalasi ham to'g'ri.
 *
 * Shuning uchun chegara qattiq, ko'rib chiqilgan farqlar esa
 * `phonetic-exceptions.json` ga yoziladi (lint baseline'i kabi). Buning
 * ma'nosi: ogohlantirishlar soni nolga intiladi va YANGI farq darhol
 * ko'rinadi. 27 ta doimiy ogohlantirish bo'lsa, 28-chisini hech kim ko'rmasdi.
 */
const MAX_PHONETIC_DISTANCE = 0;

/** Kurrikulum IPA'si lug'atdagi variantlardan biriga (fold'dan keyin) mos keladimi */
const phoneticMatches = (curriculumIpa, dictionaryPhonetics) => {
  const d = phoneticDistance(curriculumIpa, dictionaryPhonetics);
  return d === null || d <= MAX_PHONETIC_DISTANCE;
};

/** Kurrikulum POS'i lug'atdagi ma'nolardan birida bormi */
const posMatches = (curriculumPos, dictionaryMeanings) => {
  const accepted = POS_EQUIVALENTS[curriculumPos];
  if (!accepted) return true; // noma'lum POS — schema.js allaqachon tekshirgan
  const found = new Set((dictionaryMeanings || []).map((m) => m.partOfSpeech));
  return accepted.some((p) => found.has(p));
};

/**
 * Butun kursni snapshot bilan solishtiradi.
 *
 * @param {Array} topics                 data/topics.json mazmuni
 * @param {Object|null} entries          snapshot.entries; null bo'lsa tekshiruv o'tkaziladi
 * @param {Object} exceptions            ko'rib chiqilgan farqlar: {words, posWords}
 * @returns {{ok: boolean, errors: string[], warnings: string[], stats: object|null}}
 */
const checkAgainstDictionary = (topics, entries, exceptions = {}) => {
  const errors = [];
  const warnings = [];
  const allowed = exceptions.words || {};
  const allowedPos = exceptions.posWords || {};
  const usedExceptions = new Set();
  const usedPosExceptions = new Set();
  /** Baseline'ni yangilash uchun: so'z → sabab qoralamasi */
  const mismatched = {};

  if (!entries) {
    return {
      ok: true,
      errors,
      warnings: [
        'Lug\'at snapshoti yo\'q — IPA/partOfSpeech tekshiruvi o\'tkazib yuborildi. ' +
          'Yoqish uchun: npm run dict:fetch',
      ],
      mismatched: {},
      stats: null,
    };
  }

  const missing = [];
  let checked = 0;
  let phoneticMismatches = 0;
  let posMismatches = 0;

  for (const topic of topics) {
    for (const word of topic.words || []) {
      const key = String(word.word || '').toLowerCase().trim();
      const at = `Kun ${topic.day} → "${word.word}"`;
      const entry = entries[key];

      if (!entry) {
        missing.push(key);
        continue;
      }

      if (entry.notFound) {
        errors.push(
          `${at}: bunday so'z ingliz lug'atida yo'q. Imlo xatosini tekshiring ` +
            `(manba: dictionaryapi.dev).`
        );
        continue;
      }

      checked++;

      if (word.phonetic && entry.phonetics?.length) {
        const distance = phoneticDistance(word.phonetic, entry.phonetics);
        if (distance !== null && distance > MAX_PHONETIC_DISTANCE) {
          mismatched[key] = `${word.phonetic} ≠ ${entry.phonetics.join(' / ')} (${distance})`;
          if (allowed[key]) {
            usedExceptions.add(key);
          } else {
            phoneticMismatches++;
            warnings.push(
              `${at}: IPA "${word.phonetic}" lug'atdan ${distance} belgiga farq qiladi ` +
                `(${entry.phonetics.join(', ')}). To'g'ri bo'lsa — ` +
                `"npm run content:validate -- --update-baseline".`
            );
          }
        }
      }

      if (word.partOfSpeech && !POS_UNVERIFIABLE.has(word.partOfSpeech)) {
        if (!posMatches(word.partOfSpeech, entry.meanings)) {
          if (allowedPos[key]) {
            usedPosExceptions.add(key);
          } else {
            posMismatches++;
            const found = [...new Set((entry.meanings || []).map((m) => m.partOfSpeech))];
            warnings.push(
              `${at}: partOfSpeech "${word.partOfSpeech}", lug'atda esa ` +
                `${found.join(', ') || 'hech narsa'}.`
            );
          }
        }
      }
    }
  }

  if (missing.length) {
    warnings.push(
      `${missing.length} ta so'z snapshotda yo'q (${missing.slice(0, 8).join(', ')}` +
        `${missing.length > 8 ? ', …' : ''}) — "npm run dict:fetch" ishga tushiring.`
    );
  }

  // Eskirgan istisno — IPA tuzatilgan yoki so'z olib tashlangan. Bularni
  // tozalamasak, baseline vaqt o'tib haqiqiy xatoni yashirib qo'yadi.
  const stale = [
    ...Object.keys(allowed).filter((w) => !usedExceptions.has(w)),
    ...Object.keys(allowedPos).filter((w) => !usedPosExceptions.has(w)),
  ];
  if (stale.length) {
    warnings.push(
      `phonetic-exceptions.json da ${stale.length} ta keraksiz istisno bor ` +
        `(${stale.slice(0, 8).join(', ')}${stale.length > 8 ? ', …' : ''}) — o'chirib tashlang.`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    mismatched,
    stats: {
      checked,
      missing: missing.length,
      phoneticMismatches,
      posMismatches,
      exceptions: usedExceptions.size + usedPosExceptions.size,
      staleExceptions: stale.length,
    },
  };
};

/** Snapshotni fayldan o'qiydi. Yo'q yoki buzuq bo'lsa — null (tekshiruv o'tkaziladi). */
const loadSnapshot = (file = SNAPSHOT_PATH) => {
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed.entries || null;
  } catch (err) {
    console.warn(`Lug'at snapshoti o'qilmadi: ${err.message}`);
    return null;
  }
};

/**
 * Ko'rib chiqilgan IPA farqlari ro'yxati.
 *
 * Bu "xatoni o'chirish" emas, "men buni ko'rdim va to'g'ri" degan yozuv —
 * shuning uchun har biri sabab bilan saqlanadi va faylning o'zi kod
 * ko'rigidan (code review) o'tadi.
 */
const EMPTY_EXCEPTIONS = { note: '', words: {}, posWords: {} };

const loadExceptions = (file = EXCEPTIONS_PATH) => {
  if (!fs.existsSync(file)) return { ...EMPTY_EXCEPTIONS };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      note: parsed.note || '',
      words: parsed.words || {},
      posWords: parsed.posWords || {},
    };
  } catch (err) {
    console.warn(`phonetic-exceptions.json o'qilmadi: ${err.message}`);
    return { ...EMPTY_EXCEPTIONS };
  }
};

/**
 * `--update-baseline` uchun: joriy farqlarni faylga yozadi.
 *
 * Mavjud sabablar SAQLANADI. Aks holda flagni bir marta ishlatish qo'lda
 * yozilgan izohlarni avtomatik qoralama bilan almashtirib yuborardi va
 * fayl o'z ma'nosini yo'qotardi.
 */
const saveExceptions = (words, file = EXCEPTIONS_PATH) => {
  const previous = loadExceptions(file);
  const sorted = {};
  for (const key of Object.keys(words).sort()) sorted[key] = previous.words[key] || words[key];

  const payload = {
    note:
      previous.note ||
      "Lug'at bilan farq qiladigan, lekin TO'G'RI deb tan olingan transkripsiyalar. " +
        "Ko'pchiligi britancha/amerikacha variant farqi. Yangi so'z bu yerga tushsa — " +
        'avval haqiqatan to\'g\'riligini tekshiring, keyingina qo\'shing.',
    words: sorted,
    // POS istisnolari faqat qo'lda yoziladi — ular kamdan-kam va har biri
    // grammatik qaror talab qiladi
    posWords: previous.posWords,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return Object.keys(sorted).length;
};

module.exports = {
  SNAPSHOT_PATH,
  EXCEPTIONS_PATH,
  loadExceptions,
  saveExceptions,
  POS_EQUIVALENTS,
  POS_UNVERIFIABLE,
  MAX_PHONETIC_DISTANCE,
  normalizePhonetic,
  phoneticVariants,
  editDistance,
  phoneticDistance,
  phoneticMatches,
  posMatches,
  checkAgainstDictionary,
  loadSnapshot,
};
