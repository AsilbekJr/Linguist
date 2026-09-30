/**
 * Takrorlash rejimlari — so'z o'rganilgan sari topshiriq qiyinlashadi.
 *
 * Ilgari har bir so'z, hatto kecha birinchi marta ko'rilgani ham, "shu so'z
 * bilan gap tuzing" talab qilardi. Bu sifatli, lekin og'ir: 20 ta so'zlik
 * navbat 20-30 daqiqa olardi va har javob AI chaqiruvi edi. Endi:
 *
 *   bosqich 0-1  → recognize  — inglizcha so'z, 4 ta o'zbekcha variant
 *   bosqich 2-3  → recall     — o'zbekchasidan inglizcha so'zni yozish
 *   bosqich 4    → cloze      — misol gapdagi bo'sh joyga so'zni yozish (tarjimasiz)
 *   bosqich 5-6  → build / sentence — darajaga qarab (pastda)
 *
 * Ilgari "so'zni yozish"dan keyin darhol erkin gap tuzish kelardi — boshlovchi
 * uchun bu sakrash juda keskin edi. Endi oraliq pog'onalar bor:
 *   cloze — so'z KONTEKSTDAN eslanadi (o'zbekcha tarjima va harf ishorasi yo'q);
 *   build — misol gapni aralashtirilgan so'z bo'laklaridan yig'ish: gap
 *           tuzilishi mashq qilinadi, lekin bo'sh varaqdan yozish shart emas.
 * Erkin gap (AI tekshiradi) boshlovchida umuman talab qilinmaydi.
 *
 * Rejimni SERVER belgilaydi — mijoz o'ziga osonini tanlay olmaydi.
 */

const MODES = Object.freeze({
  RECOGNIZE: 'recognize',
  RECALL: 'recall',
  CLOZE: 'cloze',
  BUILD: 'build',
  SENTENCE: 'sentence',
  TRANSLATE: 'translate',
});

/** Bosqich (0-6) → rejim, darajaga qarab. 7-bosqich = yodlangan, takrorlanmaydi. */
const LADDERS = Object.freeze({
  beginner: ['recognize', 'recognize', 'recall', 'recall', 'cloze', 'build', 'build'],
  intermediate: ['recognize', 'recognize', 'recall', 'recall', 'cloze', 'build', 'sentence'],
  advanced: ['recognize', 'recognize', 'recall', 'recall', 'cloze', 'sentence', 'sentence'],
});

const modeForStage = (stage, level = 'beginner') => {
  const ladder = LADDERS[level] || LADDERS.beginner;
  const s = Math.min(Math.max(Number(stage) || 0, 0), ladder.length - 1);
  return ladder[s];
};

/**
 * So'z uchun haqiqiy rejim. Tarjimasi yo'q so'z (AI javob bermaganda faqat
 * inglizcha ta'rif bilan saqlanadi) tanib olish va eslashda ishlamaydi:
 * tanib olishda to'g'ri variant — tarjima, eslashda esa tarjima savolning
 * o'zi. Ilgari bunday so'zda variantlardan biri BO'SH chiqardi va uni tanlash
 * "Validation failed" berardi.
 *
 * Gap tuzishga o'tkazish ham yechim emas — boshlovchi uchun yangi so'z bilan
 * darhol gap tuzish juda qiyin. Shuning uchun bunday so'z bitta oddiy qadam
 * oladi: to'liq kartochkani ko'rib, o'zbekcha tarjimasini yozish. Tarjima
 * saqlanadi va so'z odatiy tartibda davom etadi (tanib olish → eslash → gap).
 */
const hasTranslation = (w) => Boolean(String(w?.translation || '').trim());

/** Misol gapda so'zning qaysi shakli turibdi ("journeys", "went" emas) */
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Faqat haqiqiy qo'shimchalar: -s/-es/-ed/-ing/-er/-est/-ly, y→ies/ied,
 * e→ing/ed, undosh ikkilanishi (stop→stopped). Ilgari `so'z[a-z]*` edi va
 * "car" so'zi "careful" ichida topilib, noto'g'ri yashirilardi.
 */
const findWordInSentence = (sentence, word) => {
  if (!sentence || !word) return null;
  const [head, ...rest] = String(word).trim().toLowerCase().split(/\s+/);
  if (!head) return null;
  // Iborada ("get by") qo'shimcha birinchi so'zga qo'shiladi: "gets by", "getting by"
  const forms = [`${escapeRe(head)}(?:s|es|ed|d|ing|er|ers|est|ly)?`];
  if (head.endsWith('y')) forms.push(`${escapeRe(head.slice(0, -1))}(?:ies|ied|ier|iest|ily)`);
  if (head.endsWith('e')) forms.push(`${escapeRe(head.slice(0, -1))}(?:ing|ed)`);
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(head)) forms.push(`${escapeRe(head)}${head.slice(-1)}(?:ing|ed|er)`);
  const tail = rest.map((t) => `\\s+${escapeRe(t)}`).join('');
  const m = String(sentence).match(new RegExp(`\\b(?:${forms.join('|')})${tail}\\b`, 'i'));
  return m ? m[0] : null;
};

/** Gapda faqat topilgan shaklni yashirish */
const maskForm = (sentence, word) => {
  const form = findWordInSentence(sentence, word);
  return form ? String(sentence).replace(form, '_____') : String(sentence || '');
};

const exampleOf = (w) => (w?.examples || []).find((e) => e && String(e).trim()) || '';

/** Gap yig'ish uchun bo'laklar: tinish belgilarisiz so'zlar */
const sentenceTokens = (sentence) =>
  String(sentence || '')
    .replace(/[“”"«»]/g, '')
    .split(/\s+/)
    .map((t) => t.replace(/^[^\w']+|[^\w']+$/g, ''))
    .filter(Boolean);

const BUILD_MIN = 3;
const BUILD_MAX = 12;
const canCloze = (w) => Boolean(findWordInSentence(exampleOf(w), w.word));
const canBuild = (w) => {
  const n = sentenceTokens(exampleOf(w)).length;
  return canCloze(w) && n >= BUILD_MIN && n <= BUILD_MAX;
};

/**
 * So'z uchun haqiqiy rejim: bosqich + daraja + so'zda nima borligi.
 * Misol gapi yo'q (yoki gapda so'z topilmaydigan) so'z uchun cloze/build
 * mumkin emas — bir pog'ona osonrog'iga tushadi.
 */
const modeForWord = (w, stage, level) => {
  if (!hasTranslation(w)) return MODES.TRANSLATE;
  const mode = modeForStage(stage, level);
  if (mode === MODES.BUILD && !canBuild(w)) return canCloze(w) ? MODES.CLOZE : MODES.RECALL;
  if (mode === MODES.CLOZE && !canCloze(w)) return MODES.RECALL;
  return mode;
};

const normalizeAnswer = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+$/, '');

/** Levenshtein masofasi — qisqa so'zlar uchun yetarli va tez */
const editDistance = (a, b) => {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

/**
 * Eslash rejimi: foydalanuvchi inglizcha so'zni yozadi.
 * Uzun so'zlarda bitta harf xatosi kechiriladi (nearMiss) — "recieve" ni
 * bilmaslik deb hisoblash adolatsiz bo'lardi, lekin to'g'ri imlo ko'rsatiladi.
 */
const checkRecall = (word, answer) => {
  const target = normalizeAnswer(word);
  const given = normalizeAnswer(answer);
  if (!given) return { isCorrect: false, nearMiss: false };
  if (given === target) return { isCorrect: true, nearMiss: false };
  if (target.length >= 5 && editDistance(given, target) <= 1) {
    return { isCorrect: true, nearMiss: true };
  }
  return { isCorrect: false, nearMiss: false };
};

/** Bo'sh joy: so'zning asosiy shakli ham, gapdagi shakli ham qabul qilinadi */
const checkCloze = (w, answer) => {
  const form = findWordInSentence(exampleOf(w), w.word);
  const base = checkRecall(w.word, answer);
  if (!form) return base;
  const inSentence = checkRecall(form, answer);
  // Aniq moslik (qaysi shakl bo'lsa ham) "deyarli to'g'ri"dan ustun
  if (inSentence.isCorrect && !inSentence.nearMiss) return inSentence;
  return base.isCorrect ? base : inSentence;
};

const tokenKey = (tokens) => tokens.map((t) => t.toLowerCase().replace(/[’`]/g, "'")).join(' ');

/** Gap yig'ish: bo'laklar tartibi misol gap bilan bir xilmi (katta-kichik harf, tinish ahamiyatsiz) */
const checkBuild = (w, answer) => {
  const target = tokenKey(sentenceTokens(exampleOf(w)));
  const given = tokenKey(sentenceTokens(answer));
  return { isCorrect: Boolean(given) && given === target, nearMiss: false };
};

/** Tanib olish rejimi: tanlangan variant to'g'ri tarjimami */
const checkRecognize = (translation, answer) =>
  normalizeAnswer(answer) === normalizeAnswer(translation);

const shuffle = (arr, random = Math.random) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * 4 ta variant: to'g'ri tarjima + 3 ta chalg'ituvchi.
 * Chalg'ituvchilar avval foydalanuvchining O'Z so'zlaridan olinadi (ular
 * tanish, shuning uchun tanlov haqiqiy), yetmasa — kurs so'zlaridan.
 */
const buildOptions = (translation, { ownPool = [], coursePool = [] } = {}, random = Math.random) => {
  const correctKey = normalizeAnswer(translation);
  const seen = new Set([correctKey]);
  const pick = (pool) => {
    const out = [];
    for (const t of shuffle(pool, random)) {
      const key = normalizeAnswer(t);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= 3) break;
    }
    return out;
  };
  // Bo'sh tarjimalar hech qachon variant bo'lmaydi (pick ichida `!key` tekshiruvi)
  const distractors = pick(ownPool);
  if (distractors.length < 3) distractors.push(...pick(coursePool).slice(0, 3 - distractors.length));
  return shuffle([translation, ...distractors], random);
};

/** Misol gapda so'zni yashirish (eslash rejimi uchun) */
const maskWord = (text, word) => {
  if (!text || !word) return text || '';
  const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text).replace(new RegExp(`\\b${escaped}[a-z]*`, 'gi'), '_____');
};

/**
 * Navbatdagi so'zni rejimga mos ko'rinishga keltiradi — javobni oshkor
 * qiladigan maydonlar olib tashlanadi.
 */
const presentDueWord = (w, mode, options) => {
  const base = {
    _id: w._id,
    mode,
    stage: w.stage ?? 0,
    partOfSpeech: w.partOfSpeech,
    lapses: w.lapses || 0,
  };
  if (mode === MODES.RECOGNIZE) {
    // Tarjima va o'zbekcha misol javobni oshkor qiladi; inglizcha ta'rif ham
    return { ...base, word: w.word, phonetic: w.phonetic, examples: (w.examples || []).slice(0, 1), options };
  }
  if (mode === MODES.TRANSLATE) {
    // Tarjima yo'q — kartochkaning qolgan hammasi ko'rinadi, foydalanuvchi uni o'zi yozadi
    return {
      ...base,
      word: w.word,
      phonetic: w.phonetic,
      definition: w.definition,
      examples: (w.examples || []).slice(0, 1),
    };
  }
  if (mode === MODES.CLOZE) {
    // Kontekstdan eslash: o'zbekcha so'z tarjimasi va harf ishorasi YO'Q,
    // faqat gapning o'zbekchasi (ma'noni tushunish uchun) va so'z turkumi
    const example = exampleOf(w);
    return {
      ...base,
      exampleMasked: maskForm(example, w.word),
      exampleUz: w.exampleUz,
      hint: { length: String(findWordInSentence(example, w.word) || w.word).length },
    };
  }
  if (mode === MODES.BUILD) {
    const tokens = sentenceTokens(exampleOf(w));
    let tiles = shuffle(tokens);
    // Aralashtirish tasodifan asl tartibni qaytarsa — qayta
    for (let i = 0; i < 5 && tokenKey(tiles) === tokenKey(tokens); i++) tiles = shuffle(tokens);
    return {
      ...base,
      word: w.word,
      translation: w.translation,
      exampleUz: w.exampleUz,
      tiles,
    };
  }
  if (mode === MODES.RECALL) {
    // So'zning o'zi ham, talaffuzi ham yashiriladi
    const example = (w.examples || [])[0];
    return {
      ...base,
      translation: w.translation,
      definition: maskWord(w.definition, w.word),
      exampleMasked: maskWord(example, w.word),
      exampleUz: w.exampleUz,
      hint: { firstLetter: String(w.word || '').charAt(0).toLowerCase(), length: String(w.word || '').length },
    };
  }
  return { ...w, mode };
};

/** Javobdan keyin ko'rsatiladigan to'liq kartochka */
const revealWord = (w) => ({
  word: w.word,
  phonetic: w.phonetic,
  translation: w.translation,
  definition: w.definition,
  partOfSpeech: w.partOfSpeech,
  examples: (w.examples || []).slice(0, 1),
  exampleUz: w.exampleUz,
});

module.exports = {
  MODES,
  modeForStage,
  modeForWord,
  normalizeAnswer,
  editDistance,
  checkRecall,
  checkRecognize,
  checkCloze,
  checkBuild,
  sentenceTokens,
  findWordInSentence,
  exampleOf,
  LADDERS,
  buildOptions,
  maskWord,
  presentDueWord,
  revealWord,
};
