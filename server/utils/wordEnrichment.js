/**
 * So'zga ma'lumot yig'ish: ta'rif, transkripsiya, tarjima va misol.
 *
 * Nega alohida modul: bu mantiq ikki joyda kerak — yangi so'z qo'shilganda va
 * eskirgan/bo'sh yozuvni tuzatishda (`POST /api/words/:id/refresh`).
 *
 * ⚠️ Bu yerda ENG MUHIM qoida: MA'LUMOT TOPILMASA, SOXTA MA'LUMOT YOZILMAYDI.
 *
 * Ilgari tarmoq uzilsa so'z shunday saqlanardi:
 *     definition: "Definition unavailable (API failed). You can edit this later."
 *     examples:   ["Example unavailable."]
 * Bu uch jihatdan yomon edi:
 *   1. inglizcha xizmat matni foydalanuvchiga TA'RIF bo'lib ko'rinardi;
 *   2. "you can edit this later" — yolg'on, ilovada tahrirlash oynasi yo'q;
 *   3. buzuq kartochka SRS navbatiga tushib, har kuni qaytaverardi.
 * Endi bunday holatda so'z umuman saqlanmaydi va foydalanuvchiga sabab aytiladi.
 */

const { getDictionaryEntry } = require('./cache');
const { lookupSnapshot } = require('./dictionarySnapshot');
const { generateWordContext } = require('../services/geminiService');

const API = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const TIMEOUT_MS = 8000;

/**
 * Jonli lug'atdan olish, bitta qayta urinish bilan.
 *
 * Qayta urinish kerak, chunki bu bepul va SLA'siz xizmat: qisqa uzilish
 * foydalanuvchi uchun "so'z qo'shilmadi" bo'lib ko'rinadi. Aynan shu sabab
 * lug'atda bemalol mavjud so'z ("kids") ta'rifsiz saqlanib qolgan edi.
 *
 * 404 qayta urinilmaydi — bu javobning o'zi, xato emas.
 */
const fetchRemote = async (word) => {
  let lastReason = 'NETWORK';

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700));

    try {
      const res = await fetch(`${API}/${encodeURIComponent(word)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });

      if (res.status === 404) return { status: 'not_found' };
      if (!res.ok) {
        lastReason = `HTTP_${res.status}`;
        continue;
      }

      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : null;
      if (!entry) {
        lastReason = 'EMPTY';
        continue;
      }
      return { status: 'ok', entry };
    } catch (err) {
      lastReason = err.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK';
    }
  }

  return { status: 'failed', reason: lastReason };
};

/** dictionaryapi.dev javobini ichki shaklga keltirish */
const normalizeRemote = (word, entry) => {
  const meaning = entry.meanings?.[0];
  const definitionObj = meaning?.definitions?.[0];

  let phonetic = entry.phonetic || '';
  if (!phonetic) phonetic = entry.phonetics?.find((p) => p.text)?.text || '';

  return {
    // ATAYLAB `entry.word` EMAS. API so'zni kichik harfda qaytaradi
    // ("apple"), marshrut esa uni Title Case'da saqlaydi va dublikatni
    // shu shaklda qidiradi. API yozuvini olsak, "Apple" ni ikkinchi marta
    // qo'shganda dublikat topilmasdi va unikal indeks 500 bilan yiqilardi.
    word,
    phonetic,
    definition: definitionObj?.definition || '',
    partOfSpeech: meaning?.partOfSpeech || '',
    synonyms: meaning?.synonyms?.slice(0, 8) || [],
    // Misol bo'lmasa BO'SH massiv — "Example unavailable." degan matn emas
    examples: definitionObj?.example ? [definitionObj.example] : [],
    collocations: [],
  };
};

/**
 * Ta'rif manbai zanjiri: qo'lda yozilgan lug'at → snapshot → jonli API.
 * @returns {{status:'ok', data, source} | {status:'not_found'} | {status:'failed', reason}}
 */
const resolveDefinition = async (word, { allowRemote = true } = {}) => {
  // 1) Qo'lda yozilgan lug'at — o'zbekcha tarjimasi bor
  try {
    const staticDict = require('../data/dictionary.json');
    const match = getDictionaryEntry(word, () =>
      staticDict.find((item) => item.word.toLowerCase() === word.toLowerCase())
    );
    if (match) return { status: 'ok', source: 'curated', data: { ...match } };
  } catch (err) {
    console.warn('dictionary.json o\'qilmadi:', err.message);
  }

  // 2) Build vaqtidagi snapshot — tarmoqqa chiqmaydi
  const snapshot = lookupSnapshot(word);
  if (snapshot?.notFound) return { status: 'not_found' };
  if (snapshot) return { status: 'ok', source: 'snapshot', data: { ...snapshot } };

  // 3) Jonli API. `skipAI` bunga ham taalluqli: foydalanuvchi qo'lda
  // saqlashni tanlaganda uni sekin tashqi so'rov kutishga majburlamaymiz.
  if (!allowRemote) return { status: 'failed', reason: 'SKIPPED' };

  const remote = await fetchRemote(word);
  if (remote.status === 'not_found') return { status: 'not_found' };
  if (remote.status === 'failed') return remote;
  return { status: 'ok', source: 'api', data: normalizeRemote(word, remote.entry) };
};

/**
 * So'z uchun to'liq ma'lumot yig'adi.
 *
 * @param {string} word
 * @param {object} options
 * @param {string} options.learnerLevel
 * @param {object} [options.manual]   {definition, translation, examples}
 * @param {boolean} [options.skipAI]
 * @returns {{status:'ok', data} | {status:'not_found'} | {status:'failed', reason}}
 *   `failed` — foydalanuvchiga ko'rsatiladigan hech narsa topilmadi.
 */
const enrichWord = async (word, { learnerLevel = 'beginner', manual = {}, skipAI = false } = {}) => {
  const resolved = await resolveDefinition(word, { allowRemote: !skipAI });
  if (resolved.status === 'not_found') return { status: 'not_found' };

  const base = resolved.status === 'ok' ? resolved.data : {};

  let translation = base.translation || manual.translation || '';
  let examples = Array.isArray(base.examples) ? [...base.examples] : [];
  if (manual.examples?.length) examples = [...manual.examples, ...examples];
  let exampleUz = '';
  let definition = base.definition || manual.definition || '';

  // Tarjima yoki misol yetishmasa AI to'ldiradi. Lug'atdagi misol ko'pincha
  // Wiktionary'niki va A1 uchun og'ir, tarjima esa u yerda umuman yo'q.
  if (!skipAI && (!translation || !examples.length)) {
    const ctx = await generateWordContext(word, base.definition, learnerLevel);
    if (ctx.status === 'ok') {
      if (!translation) translation = ctx.translationUz;

      // ⚠️ MA'NO BITTA MANBADAN OLINADI.
      //
      // Snapshot Wiktionary'ning birinchi ma'nosini oladi va u eng keng
      // tarqalgani bo'lmasligi mumkin: "kids" → "A young goat". AI esa
      // tarjimani "bolalar" deb beradi. Ikkalasini aralashtirsak kartochka
      // o'z-o'ziga zid bo'lardi — tarjima bir ma'no, ta'rif va misol boshqa.
      // Shuning uchun AI javob bersa, ta'rif ham, misol ham UNDAN olinadi.
      if (ctx.definitionEn) definition = ctx.definitionEn;
      if (ctx.exampleEn) {
        examples = [ctx.exampleEn];
        exampleUz = ctx.exampleUz;
      }
    } else {
      console.warn(`Word context unavailable for "${word}": ${ctx.reason}`);
    }
  }

  // Ko'rsatishga arziydigan hech narsa yo'q — saqlamaymiz.
  // Bo'sh kartochka SRS navbatiga tushsa, u har kuni qaytaverardi.
  if (!definition && !translation) {
    return {
      status: 'failed',
      reason: resolved.status === 'failed' ? resolved.reason : 'NO_CONTENT',
    };
  }

  return {
    status: 'ok',
    source: resolved.source || 'manual',
    data: {
      // Chaqiruvchi bergan yozilish saqlanadi — dublikat tekshiruvi shunga tayanadi
      word,
      phonetic: base.phonetic || '',
      definition,
      partOfSpeech: base.partOfSpeech || '',
      synonyms: base.synonyms || [],
      examples,
      exampleUz,
      translation,
      collocations: base.collocations || [],
    },
  };
};

module.exports = { enrichWord, resolveDefinition, fetchRemote, normalizeRemote };
