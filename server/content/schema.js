/**
 * Kontent sxemasi va validatori.
 *
 * Nega bu fayl bor:
 * Eski `topics.json` da 31 kun uchun 325 ta so'z sloti bor edi, lekin unikal
 * so'z atigi 45 ta — ya'ni har bir so'z o'rtacha 7 marta takrorlangan.
 * "Travel & Tourism" mavzusida `Quantitative`, `Hypothesis`, `Paradigm`
 * so'zlari turardi. 1-kun "Essential Daily Life Vocabulary" deb boshlanardi,
 * lekin ichida `Ubiquitous`, `Meticulous`, `Procrastinate` — C1 leksikasi.
 *
 * Bunday kontent bir marta ko'rilsa foydalanuvchi ishonchi qaytmaydi.
 * Validator shu holatning takrorlanishiga yo'l qo'ymaydi: build paytida
 * yiqiladi, ishlab chiqarishga chiqmaydi.
 */

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PARTS_OF_SPEECH = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'preposition',
  'pronoun', 'conjunction', 'phrase', 'determiner', 'number',
]);

/** Bir so'z eng ko'pi bilan nechta mavzuda qayta ishlatilishi mumkin */
const MAX_TOPIC_REUSE = 2;
/** Butun kursda unikal so'zlar ulushi shundan past bo'lmasligi kerak */
const MIN_UNIQUE_RATIO = 0.85;
/** Har bir mavzuda kamida shuncha so'z */
const MIN_WORDS_PER_TOPIC = 8;

const normalize = (s) => String(s || '').trim().toLowerCase();

/**
 * O'zbek tiliga o'zlashgan so'zlar — tarjimasi inglizchasi bilan bir xil bo'lishi
 * MUMKIN va bu xato emas. Sun'iy boshqa tarjima o'ylab topish kontentni
 * yomonlashtirardi. Ro'yxat ataylab qisqa va aniq: har bir qo'shimcha
 * shu yerda ko'rinib turadi va ko'rib chiqiladi.
 */
const LOANWORDS = new Set([
  'bank', 'internet', 'sport', 'menu', 'coffee', 'taxi', 'metro',
  'kilogram', 'litre', 'president', 'doctor', 'problem', 'project',
  'stress', 'stadium', 'hotel', 'radio', 'film', 'kilometre',
]);

/**
 * So'zning ehtimoliy shakllari.
 *
 * Stemmerdan ko'ra ishonchliroq: "solving" ni "solve" ga qaytarish uchun
 * stemmer 'e' ni tiklashi kerak edi va u buni qila olmasdi — validator
 * "solve mavzuda yo'q" deb noto'g'ri xato bergan edi.
 */
const wordForms = (word) => {
  const w = normalize(word);
  const forms = new Set([w]);
  if (!/^[a-z' -]+$/.test(w)) return forms;

  forms.add(`${w}s`);
  forms.add(`${w}es`);
  forms.add(`${w}ed`);
  forms.add(`${w}ing`);
  forms.add(`${w}er`);
  forms.add(`${w}est`);
  forms.add(`${w}ly`);

  // -e bilan tugaydigan fe'llar: solve → solving, solved
  if (w.endsWith('e')) {
    const stem = w.slice(0, -1);
    forms.add(`${stem}ing`);
    forms.add(`${stem}ed`);
    forms.add(`${stem}er`);
  }
  // undosh + y: study → studies, studied
  if (/[^aeiou]y$/.test(w)) {
    const stem = w.slice(0, -1);
    forms.add(`${stem}ies`);
    forms.add(`${stem}ied`);
  }
  // qisqa unli + undosh: stop → stopped, stopping
  if (/^[a-z]{2,4}$/.test(w) && /[aeiou][^aeiouy]$/.test(w)) {
    const last = w.slice(-1);
    forms.add(`${w}${last}ed`);
    forms.add(`${w}${last}ing`);
  }
  return forms;
};

/**
 * Matnda so'z (yoki uning shakli) mustaqil so'z sifatida uchraydimi.
 *
 * `includes` ishlatilmaydi: "meat" ichida "eat" bor, "sun" ichida "s" bor —
 * substring tekshiruvi soxta moslikka olib keladi.
 */
const containsWord = (text, word) => {
  const forms = wordForms(word);
  const tokens = normalize(text).split(/[^a-z']+/).filter(Boolean);
  if (tokens.some((tok) => forms.has(tok))) return true;

  // Ko'p so'zli birikmalar uchun ("ice cream")
  const w = normalize(word);
  if (w.includes(' ')) {
    return normalize(text).includes(w);
  }
  return false;
};

/**
 * Bitta so'z yozuvini tekshiradi.
 * @returns {string[]} xatolar ro'yxati
 */
const validateWord = (word, ctx) => {
  const errs = [];
  const at = `${ctx.topicRef} → "${word.word}"`;

  for (const field of ['word', 'translation', 'definition', 'phonetic', 'partOfSpeech', 'example']) {
    if (!word[field] || !String(word[field]).trim()) {
      errs.push(`${at}: "${field}" bo'sh`);
    }
  }
  if (errs.length) return errs;

  if (!/^[a-zA-Z][a-zA-Z\s'-]*$/.test(word.word)) {
    errs.push(`${at}: so'zda yaroqsiz belgi bor`);
  }
  if (!PARTS_OF_SPEECH.has(word.partOfSpeech)) {
    errs.push(`${at}: noma'lum partOfSpeech "${word.partOfSpeech}"`);
  }
  if (!/^\/.+\/$/.test(word.phonetic)) {
    errs.push(`${at}: phonetic /.../ shaklida bo'lishi kerak, hozir "${word.phonetic}"`);
  }
  if (word.cefr && !CEFR_ORDER.includes(word.cefr)) {
    errs.push(`${at}: noma'lum CEFR "${word.cefr}"`);
  }

  // Tarjima inglizchaning nusxasi bo'lmasligi kerak — o'zlashgan so'zlardan tashqari
  if (
    normalize(word.translation) === normalize(word.word) &&
    !LOANWORDS.has(normalize(word.word))
  ) {
    errs.push(
      `${at}: tarjima inglizcha so'zning o'zi. Agar bu o'zlashgan so'z bo'lsa, ` +
        `schema.js dagi LOANWORDS ro'yxatiga qo'shing.`
    );
  }

  // Misol gap so'zning o'zini ishlatishi SHART — aks holda misol foydasiz
  if (!containsWord(word.example, word.word)) {
    errs.push(`${at}: misol gapda so'zning o'zi yo'q → "${word.example}"`);
  }
  if (word.exampleUz && normalize(word.exampleUz) === normalize(word.example)) {
    errs.push(`${at}: o'zbekcha misol inglizchasining nusxasi`);
  }

  return errs;
};

/**
 * Bitta mavzuni tekshiradi — jumladan so'zlarning mavzuga TEGISHLILIGINI.
 *
 * Tegishlilik mezoni: so'z mavzuning dialogida yoki hikoyasida uchrashi kerak.
 * Bu avtomatik tekshirish mumkin bo'lgan eng kuchli proksi — aynan shu tekshiruv
 * "Food & Cooking" mavzusidagi "Hypothesis" ni ushlaydi.
 */
const validateTopic = (topic, ctx) => {
  const errs = [];
  const ref = `Kun ${topic.day} (${topic.topic})`;

  for (const field of ['day', 'topic', 'topicUz', 'story', 'cefr', 'words']) {
    if (topic[field] === undefined || topic[field] === null || topic[field] === '') {
      errs.push(`${ref}: "${field}" bo'sh`);
    }
  }
  if (errs.length) return errs;

  if (!CEFR_ORDER.includes(topic.cefr)) {
    errs.push(`${ref}: noma'lum CEFR "${topic.cefr}"`);
  }
  if (!Array.isArray(topic.words) || topic.words.length < MIN_WORDS_PER_TOPIC) {
    errs.push(`${ref}: kamida ${MIN_WORDS_PER_TOPIC} ta so'z kerak, hozir ${topic.words?.length || 0}`);
  }
  if (!Array.isArray(topic.dialogue) || topic.dialogue.length < 4) {
    errs.push(`${ref}: kamida 4 qatorli dialog kerak`);
  }

  // Mavzu ichida so'z takrorlanmasin
  const seen = new Map();
  for (const w of topic.words || []) {
    const key = normalize(w.word);
    if (seen.has(key)) errs.push(`${ref}: "${w.word}" mavzu ichida takrorlangan`);
    seen.set(key, true);
    errs.push(...validateWord(w, { topicRef: ref }));
  }

  // ── Tegishlilik: so'z mavzu kontekstida HAQIQATAN ishlatilishi kerak ───
  //
  // Muhim nuqta: so'zning O'Z misoli hisobga olinmaydi. Aks holda tekshiruv
  // ma'nosiz bo'lardi — istalgan so'zga misol yozib qo'yish yetarli bo'lardi.
  // So'z dialogda, hikoyada yoki BOSHQA so'zning misolida uchrashi shart.
  // Bu muallifni mavzu leksikasini haqiqatan ishlatadigan dialog yozishga majbur qiladi.
  for (const w of topic.words || []) {
    const contextParts = [
      topic.story,
      topic.description,
      ...(topic.dialogue || []).flatMap((line) => [line.en, line.uz]),
      ...(topic.words || []).filter((other) => other.word !== w.word).map((other) => other.example),
    ];
    const appears = contextParts.some((part) => containsWord(part, w.word));

    if (!appears) {
      errs.push(
        `${ref}: "${w.word}" mavzu kontekstida ishlatilmagan — dialogda ham, hikoyada ham yo'q. ` +
          `(O'z misoli hisobga olinmaydi.) Aynan shunday tekshiruvsizlik eski kontentda ` +
          `"Food & Cooking" mavzusiga "Hypothesis" ni tushirgan.`
      );
    }
  }

  return errs;
};

/** Butun kursni tekshiradi */
const validateCurriculum = (topics) => {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(topics) || topics.length === 0) {
    return { ok: false, errors: ['Kurs bo\'sh'], warnings, stats: null };
  }

  // Kun raqamlari ketma-ket va unikal
  const days = topics.map((t) => t.day);
  const uniqueDays = new Set(days);
  if (uniqueDays.size !== days.length) {
    errors.push('Kun raqamlari takrorlangan');
  }
  for (let i = 0; i < topics.length; i++) {
    if (topics[i].day !== i + 1) {
      errors.push(`Kunlar ketma-ket emas: ${i + 1}-o'rinda day=${topics[i].day}`);
      break;
    }
  }

  // CEFR daraja pasaymasligi kerak
  let prevRank = -1;
  for (const t of topics) {
    const rank = CEFR_ORDER.indexOf(t.cefr);
    if (rank < prevRank) {
      errors.push(`Kun ${t.day}: daraja pasaydi (${CEFR_ORDER[prevRank]} → ${t.cefr})`);
    }
    prevRank = Math.max(prevRank, rank);
  }

  for (const topic of topics) {
    errors.push(...validateTopic(topic));
  }

  // ── Takroriylik: eski kontentning asosiy nuqsoni ──────────────────────
  const occurrences = new Map();
  let totalSlots = 0;
  for (const topic of topics) {
    for (const w of topic.words || []) {
      const key = normalize(w.word);
      totalSlots++;
      if (!occurrences.has(key)) occurrences.set(key, []);
      occurrences.get(key).push(topic.day);
    }
  }

  const uniqueCount = occurrences.size;
  const ratio = totalSlots ? uniqueCount / totalSlots : 0;

  if (ratio < MIN_UNIQUE_RATIO) {
    errors.push(
      `Unikal so'zlar ulushi juda past: ${uniqueCount}/${totalSlots} = ${(ratio * 100).toFixed(0)}% ` +
        `(kamida ${MIN_UNIQUE_RATIO * 100}%). Eski topics.json da bu ko'rsatkich 45/325 = 14% edi.`
    );
  }

  for (const [word, daysUsed] of occurrences) {
    if (daysUsed.length > MAX_TOPIC_REUSE) {
      errors.push(
        `"${word}" ${daysUsed.length} ta mavzuda takrorlangan (kunlar: ${daysUsed.join(', ')}), ` +
          `ruxsat etilgani ${MAX_TOPIC_REUSE}`
      );
    }
  }

  // Boshlang'ich kunlarda C1 so'z bo'lmasligi kerak
  for (const topic of topics.slice(0, 10)) {
    for (const w of topic.words || []) {
      if (w.cefr && CEFR_ORDER.indexOf(w.cefr) > CEFR_ORDER.indexOf('A2')) {
        errors.push(
          `Kun ${topic.day}: "${w.word}" darajasi ${w.cefr} — boshlang'ich kunlar uchun juda og'ir`
        );
      }
    }
  }

  const byCefr = {};
  for (const [, daysUsed] of occurrences) void daysUsed;
  for (const topic of topics) {
    byCefr[topic.cefr] = (byCefr[topic.cefr] || 0) + (topic.words?.length || 0);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      topics: topics.length,
      totalSlots,
      uniqueWords: uniqueCount,
      uniqueRatio: Number((ratio * 100).toFixed(1)),
      byCefr,
    },
  };
};

module.exports = {
  CEFR_ORDER,
  PARTS_OF_SPEECH,
  MAX_TOPIC_REUSE,
  MIN_UNIQUE_RATIO,
  MIN_WORDS_PER_TOPIC,
  containsWord,
  validateWord,
  validateTopic,
  validateCurriculum,
};
