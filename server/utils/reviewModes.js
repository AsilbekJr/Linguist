/**
 * Takrorlash rejimlari — so'z o'rganilgan sari topshiriq qiyinlashadi.
 *
 * Ilgari har bir so'z, hatto kecha birinchi marta ko'rilgani ham, "shu so'z
 * bilan gap tuzing" talab qilardi. Bu sifatli, lekin og'ir: 20 ta so'zlik
 * navbat 20-30 daqiqa olardi va har javob AI chaqiruvi edi. Endi:
 *
 *   bosqich 0-1  → recognize  — inglizcha so'z, 4 ta o'zbekcha variant
 *   bosqich 2-3  → recall     — o'zbekchasidan inglizcha so'zni yozish
 *   bosqich 4-6  → sentence   — so'z bilan gap tuzish (AI tekshiradi)
 *
 * 7 ta muvaffaqiyatli takrorlash = 2 tanib olish + 2 eslash + 3 gap.
 * Rejimni SERVER belgilaydi — mijoz o'ziga osonini tanlay olmaydi.
 */

const MODES = Object.freeze({ RECOGNIZE: 'recognize', RECALL: 'recall', SENTENCE: 'sentence' });

const modeForStage = (stage) => {
  const s = Number(stage) || 0;
  if (s <= 1) return MODES.RECOGNIZE;
  if (s <= 3) return MODES.RECALL;
  return MODES.SENTENCE;
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
  normalizeAnswer,
  editDistance,
  checkRecall,
  checkRecognize,
  buildOptions,
  maskWord,
  presentDueWord,
  revealWord,
};
