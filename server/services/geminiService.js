const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getGeminiCached, setGeminiCached } = require('../utils/cache');
const { fetchMyMemoryUzEn } = require('../utils/fallbackTranslate');

let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const levelTag = (level) =>
  ({ beginner: 'A1', intermediate: 'B1', advanced: 'C1' })[level] || 'A1';

const truncateHistory = (chatHistory, maxTurns = 6, maxChars = 280) =>
  (chatHistory || [])
    .slice(-maxTurns)
    .map((m) => ({
      role: m.role,
      content: String(m.content || '').slice(0, maxChars),
    }));

const parseJson = (text) => {
  const raw = String(text)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(raw);
  } catch {
    const block = raw.match(/\{[\s\S]*\}/);
    if (!block) throw new Error('No JSON object in response');
    const cleaned = block[0].replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
};

const extractLooseFields = (text) => {
  const raw = String(text);
  const casual = raw.match(/"casual"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
  const advanced = raw.match(/"advanced"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
  if (casual || advanced) {
    return {
      casual: casual?.[1]?.replace(/\\"/g, '"'),
      advanced: advanced?.[1]?.replace(/\\"/g, '"'),
    };
  }
  const casualLine = raw.match(/CASUAL:\s*(.+)/i);
  const advancedLine = raw.match(/ADVANCED:\s*(.+)/i);
  if (casualLine || advancedLine) {
    return { casual: casualLine?.[1]?.trim(), advanced: advancedLine?.[1]?.trim() };
  }
  return null;
};

const parseJsonSafe = (text) => {
  try {
    return parseJson(text);
  } catch {
    return extractLooseFields(text);
  }
};

const cacheKey = (...parts) =>
  crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40);

const withCache = async (key, fetcher) => {
  const hit = getGeminiCached(key);
  if (hit) return hit;
  const value = await fetcher();
  if (value != null) setGeminiCached(key, value);
  return value;
};

const normalizeTranslateResult = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return null;
  const casual =
    parsed.casual || parsed.Casual || parsed.informal || parsed.simple || '';
  const advanced =
    parsed.advanced || parsed.Advanced || parsed.formal || parsed.professional || '';
  if (!casual && !advanced) return null;
  return {
    casual: String(casual || advanced).trim(),
    advanced: String(advanced || casual).trim(),
  };
};

const getModel = (maxOutputTokens, temperature = 0.3) => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens, temperature },
  });
};

const runJson = async (prompt, maxTokens = 512) => {
  if (!genAI) return null;
  try {
    const model = getModel(maxTokens, 0.3);
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const parsed = parseJsonSafe(text);
    if (!parsed) {
      console.error('Gemini JSON error: could not parse response');
      return null;
    }
    return parsed;
  } catch (error) {
    if (isQuotaError(error)) throw error;
    console.error('Gemini JSON error:', error.message);
    return null;
  }
};

const isGeminiReady = () => Boolean(genAI && process.env.GEMINI_API_KEY);

const runText = async (prompt, maxTokens = 400) => {
  const model = getModel(maxTokens, 0.45);
  if (!model) return null;
  try {
    const result = await model.generateContent(prompt);
    return (await result.response).text().trim();
  } catch (error) {
    if (isQuotaError(error)) throw error;
    console.error('Gemini text error:', error.message);
    return null;
  }
};

const isQuotaError = (error) =>
  error?.type === 'QUOTA_EXCEEDED' ||
  error?.message?.includes('429') ||
  error?.message?.includes('Too Many Requests') ||
  error?.message?.includes('Quota') ||
  error?.message?.includes('quota') ||
  error?.message?.includes('RESOURCE_EXHAUSTED') ||
  error?.message?.includes('Overloaded');

const quotaThrow = () => {
  throw {
    type: 'QUOTA_EXCEEDED',
    message: "AI xizmatiga ulanib bo'lmadi. Keyinroq urinib ko'ring.",
  };
};

const normalizeWords = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const pronunciationOverlapScore = (target, spoken) => {
  const t = normalizeWords(target);
  const s = normalizeWords(spoken);
  if (!t.length) return 0;
  const hits = t.filter((w) => s.includes(w)).length;
  return Math.round((hits / t.length) * 100);
};

const checkSentenceCore = async (word, sentence, learnerLevel, extraRule = '') => {
  const key = cacheKey('check', word, sentence, learnerLevel, extraRule);
  return withCache(key, async () => {
    if (!genAI) return null;
    const prompt = `English teacher (${levelTag(learnerLevel)}). Word "${word}" in: "${sentence}". ${extraRule} JSON: {"isCorrect":bool,"feedback":"short Uzbek"}`;
    return runJson(prompt, 256);
  });
};

const checkSentence = (word, sentence, learnerLevel = 'beginner') =>
  checkSentenceCore(word, sentence, learnerLevel).catch(() => ({
    isCorrect: false,
    feedback: 'AI vaqtincha ishlamayapti.',
  }));

const parseTranslateLines = (rawText) => {
  const fromFields = normalizeTranslateResult(extractLooseFields(rawText));
  if (fromFields) return fromFields;

  const fromJson = normalizeTranslateResult(parseJsonSafe(rawText));
  if (fromJson) return fromJson;

  const lines = String(rawText)
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:\d+[\).:-]|[-*•])\s*/, '')
        .replace(/^(casual|advanced|informal|formal)\s*:\s*/i, '')
        .trim()
    )
    .filter((line) => line.length > 1 && !line.startsWith('{'));

  if (lines.length >= 2) {
    return { casual: lines[0], advanced: lines[1] };
  }
  if (lines.length === 1) {
    return { casual: lines[0], advanced: lines[0] };
  }
  return null;
};

const tryGeminiUzEn = async (text) => {
  if (!genAI) return null;

  const prompt = `Translate this Uzbek sentence into English two ways.
Uzbek: "${text}"

Reply with EXACTLY two lines and nothing else:
CASUAL: [everyday spoken English]
ADVANCED: [more formal English]`;

  const rawText = await runText(prompt, 256);
  const parsed = parseTranslateLines(rawText);
  if (!parsed) {
    console.error('tryGeminiUzEn parse failed:', rawText?.slice(0, 160));
    return null;
  }
  return { ...parsed, _source: 'gemini' };
};

const translateUzbekToEnglish = async (uzbekText) => {
  const key = cacheKey('uz-en', uzbekText);
  return withCache(key, async () => {
    const text = uzbekText.slice(0, 400);

    try {
      const gemini = await tryGeminiUzEn(text);
      if (gemini) return gemini;
    } catch (error) {
      if (isQuotaError(error)) {
        console.warn('Gemini limit — zaxira tarjima ishlatilmoqda');
      } else {
        console.error('translateUzbekToEnglish gemini:', error.message);
      }
    }

    const fallback = await fetchMyMemoryUzEn(text);
    if (fallback) {
      console.log('translateUzbekToEnglish: MyMemory fallback OK');
      return fallback;
    }

    return null;
  });
};

const translateText = async (text, fromLang, toLang) => {
  const key = cacheKey('tr', fromLang, toLang, text);
  return withCache(key, async () => {
    if (!genAI) return null;
    const prompt = `Translate ${fromLang}→${toLang}. Output translation only:\n"${text.slice(0, 500)}"`;
    return runText(prompt, 400);
  }).catch((error) => {
    if (isQuotaError(error)) quotaThrow();
    return 'Tarjima vaqtincha ishlamayapti.';
  });
};

const buildLocalEvaluation = (targetSentence, spokenText) => {
  const overlap = pronunciationOverlapScore(targetSentence, spokenText);
  const target = normalizeWords(targetSentence);
  const spoken = normalizeWords(spokenText);
  const missed = target.filter((w) => w.length > 1 && !spoken.includes(w));

  let feedback;
  if (overlap >= 90) {
    feedback = "Juda yaxshi! So'zlar aniq aytilgan.";
  } else if (missed.length > 0) {
    feedback = `Quyidagi so'zlarni aniqroq aytib ko'ring: ${missed.slice(0, 6).join(', ')}`;
  } else {
    feedback = "Yaxshi urinish! Jumlani yana bir bor sekin va aniq o'qib ko'ring.";
  }

  return {
    score: overlap,
    feedback,
    color: overlap >= 90 ? 'green' : overlap >= 50 ? 'yellow' : 'red',
  };
};

/** Mahalliy so'z mosligi — AI token sarflamaydi, limitga bog'liq emas */
const evaluatePronunciation = async (targetSentence, spokenText) =>
  buildLocalEvaluation(targetSentence, spokenText);

const generateRoleplayResponse = async (
  scenario,
  targetWords,
  chatHistory,
  userMessage,
  learnerLevel = 'beginner'
) => {
  try {
    if (!genAI) return null;

    const history = truncateHistory(chatHistory);
    const historyText = history
      .map((m) => `${m.role === 'user' ? 'U' : 'A'}: ${m.content}`)
      .join('\n');
    const words = (targetWords || []).slice(0, 8).join(', ');
    const msg = String(userMessage || '').slice(0, 400);

    const prompt = `Roleplay (${levelTag(learnerLevel)}). Scene: ${scenario.slice(0, 120)}. Words: [${words}]. History:\n${historyText}\nU: ${msg}\nReply 1-2 English sentences. Use 1 target word. Tiny Uzbek grammar tip in () if needed. Text only.`;

    return await runText(prompt, 280);
  } catch (error) {
    if (isQuotaError(error)) quotaThrow();
    return "Kechirasiz, hozir javob bera olmayman.";
  }
};

const generateTeacherResponse = async (
  question,
  category = 'general',
  chatHistory = [],
  learnerLevel = 'beginner'
) => {
  try {
    if (!genAI) return null;

    const q = String(question).slice(0, 300);
    const history = truncateHistory(chatHistory, 4, 200);
    const historyText = history
      .map((m) => `${m.role === 'user' ? 'S' : 'T'}: ${m.content}`)
      .join('\n');

    const key =
      history.length === 0
        ? cacheKey('teacher', learnerLevel, category, q)
        : null;

    const fetch = async () => {
      const prompt = `Ustoz AI (${levelTag(learnerLevel)}, ${category}). Prior:\n${historyText || '-'}\nQ: "${q}"\nJSON: {"title":"","explanation":"Uzbek 2 short paras","rule":"1 line EN","examples":[{"en":"","uz":""}],"commonMistake":"","tip":""}`;
      return runJson(prompt, 640);
    };

    if (key) return withCache(key, fetch);
    return fetch();
  } catch (error) {
    if (isQuotaError(error)) quotaThrow();
    return null;
  }
};

const generatePracticePrompt = async (words, bucketLabel, learnerLevel = 'beginner') => {
  const wordList = words
    .slice(0, 6)
    .map((w) => w.word)
    .join(', ');
  const fallback = {
    promptUz: `${bucketLabel}: ${wordList} so'zlaridan kamida 2 tasini ishlatib inglizcha gap yozing.`,
    targetWords: words.slice(0, 3).map((w) => w.word),
    miniTipUz: "So'zlarni tabiiy jumla ichida ishlating.",
  };

  try {
    const key = cacheKey('practice-p', wordList, bucketLabel, learnerLevel);
    const cached = await withCache(key, async () => {
      if (!genAI) return fallback;
      const prompt = `Coach (${levelTag(learnerLevel)}). Words: ${wordList}. JSON: {"promptUz":"2 uz sentences","targetWords":["w1"],"miniTipUz":"tip"}`;
      const parsed = await runJson(prompt, 256);
      return {
        promptUz: parsed.promptUz || fallback.promptUz,
        targetWords: Array.isArray(parsed.targetWords) ? parsed.targetWords : fallback.targetWords,
        miniTipUz: parsed.miniTipUz || fallback.miniTipUz,
      };
    });
    return cached || fallback;
  } catch {
    return fallback;
  }
};

const checkPracticeSentence = async (words, sentence, learnerLevel = 'beginner') => {
  const targetList = words.map((w) => w.word).join(', ');
  const usedCount = words.filter((w) =>
    sentence.toLowerCase().includes(w.word.toLowerCase())
  ).length;

  const fallback = {
    isCorrect: usedCount >= Math.min(2, words.length),
    feedback:
      usedCount >= 2
        ? "Yaxshi! So'zlar ishlatilgan."
        : `Kamida ${Math.min(2, words.length)} ta so'z ishlating: ${targetList}`,
    wordsUsed: Object.fromEntries(
      words.map((w) => [w.word, sentence.toLowerCase().includes(w.word.toLowerCase())])
    ),
  };

  try {
    const key = cacheKey('practice-c', targetList, sentence, learnerLevel);
    const cached = await withCache(key, async () => {
      if (!genAI) return fallback;
      const prompt = `Check (${levelTag(learnerLevel)}). Words: ${targetList}. Sentence: "${sentence.slice(0, 300)}". Need 2+ words used well. JSON: {"isCorrect":bool,"feedback":"Uzbek","wordsUsed":{}}`;
      const parsed = await runJson(prompt, 256);
      return {
        isCorrect: !!parsed.isCorrect,
        feedback: parsed.feedback || fallback.feedback,
        wordsUsed: parsed.wordsUsed || fallback.wordsUsed,
      };
    });
    return cached || fallback;
  } catch {
    return fallback;
  }
};

module.exports = {
  isGeminiReady,
  checkSentence,
  translateUzbekToEnglish,
  translateText,
  evaluatePronunciation,
  generateRoleplayResponse,
  generateTeacherResponse,
  generatePracticePrompt,
  checkPracticeSentence,
};
