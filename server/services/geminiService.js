const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getGeminiCached, setGeminiCached } = require('../utils/cache');

let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const MODEL = 'gemini-flash-latest';

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
  const jsonStr = String(text)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  return JSON.parse(jsonStr);
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

const getJsonModel = (maxOutputTokens = 384) => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.25,
      responseMimeType: 'application/json',
    },
  });
};

const getTextModel = (maxOutputTokens = 320) => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens, temperature: 0.45 },
  });
};

const runJson = async (prompt, maxTokens = 384) => {
  const model = getJsonModel(maxTokens);
  if (!model) return null;
  const result = await model.generateContent(prompt);
  return parseJson((await result.response).text());
};

const runText = async (prompt, maxTokens = 320) => {
  const model = getTextModel(maxTokens);
  if (!model) return null;
  const result = await model.generateContent(prompt);
  return (await result.response).text().trim();
};

const isQuotaError = (error) =>
  error?.message?.includes('429') ||
  error?.message?.includes('Quota') ||
  error?.message?.includes('503') ||
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

const translateUzbekToEnglish = async (uzbekText) => {
  const key = cacheKey('uz-en', uzbekText);
  return withCache(key, async () => {
    if (!genAI) return null;
    const prompt = `UZ→EN. Text: "${uzbekText.slice(0, 400)}". JSON: {"casual":"...","advanced":"..."}`;
    return runJson(prompt, 256);
  }).catch((error) => {
    if (isQuotaError(error)) quotaThrow();
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

const evaluatePronunciation = async (targetSentence, spokenText) => {
  const overlap = pronunciationOverlapScore(targetSentence, spokenText);
  if (overlap >= 90) {
    return {
      score: overlap,
      feedback: "Juda yaxshi! So'zlar aniq aytilgan.",
      color: 'green',
    };
  }

  const key = cacheKey('pron', targetSentence, spokenText);
  return withCache(key, async () => {
    if (!genAI) return null;
    const prompt = `Score reading 0-100. Target: "${targetSentence.slice(0, 200)}". Heard: "${spokenText.slice(0, 200)}". JSON: {"score":int,"feedback":"brief Uzbek","color":"green|yellow|red"}`;
    return runJson(prompt, 200);
  }).catch((error) => {
    if (isQuotaError(error)) quotaThrow();
    return null;
  });
};

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
  checkSentence,
  translateUzbekToEnglish,
  translateText,
  evaluatePronunciation,
  generateRoleplayResponse,
  generateTeacherResponse,
  generatePracticePrompt,
  checkPracticeSentence,
};
