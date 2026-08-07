const crypto = require('crypto');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { getGeminiCached, setGeminiCached } = require('../utils/cache');

/**
 * Gemini qatlami.
 *
 * Ikkita tamoyil:
 *  1. AI ishlamasa — YOLG'ON JAVOB QAYTARMAYDI. Ilgari `checkSentence` xatoda
 *     `{isCorrect:false}` qaytarardi va bu to'g'ridan-to'g'ri SRS'ga yozilib,
 *     foydalanuvchining to'g'ri gapi "xato" deb belgilanardi. Endi
 *     `{status:'unavailable'}` qaytadi va route hech narsani o'zgartirmaydi.
 *  2. JSON — Gemini'ning structured output'i (`responseSchema`) orqali. Ilgari
 *     4 qatlamli qo'lbola parser bor edi (parseJson → extractLooseFields →
 *     parseJsonSafe → parseTranslateLines); endi model sxemaga majburlanadi.
 */

let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const isGeminiReady = () => Boolean(genAI && process.env.GEMINI_API_KEY);

// ─── Xato turlari ────────────────────────────────────────────────────────────

class AiUnavailableError extends Error {
  constructor(reason = 'AI_ERROR', message = "AI xizmati vaqtincha ishlamayapti.") {
    super(message);
    this.name = 'AiUnavailableError';
    this.reason = reason;
  }
}

const isQuotaError = (error) => {
  const msg = String(error?.message || '');
  return (
    error?.status === 429 ||
    /429|Too Many Requests|quota|RESOURCE_EXHAUSTED|Overloaded|503|UNAVAILABLE/i.test(msg)
  );
};

const UNAVAILABLE = (reason = 'AI_ERROR') => ({ status: 'unavailable', reason });

// ─── Umumiy yordamchilar ─────────────────────────────────────────────────────

const LEVEL_TAG = { beginner: 'A1-A2', intermediate: 'B1-B2', advanced: 'C1' };
const levelTag = (level) => LEVEL_TAG[level] || 'A1-A2';

const SYSTEM_INSTRUCTION = `You are an English tutor for Uzbek-speaking learners.
Rules you never break:
- All explanations and feedback are written in Uzbek (latin script). English only for the English examples themselves.
- Be concrete. Point at the exact word or structure that is wrong, never give vague praise.
- Match the learner's CEFR level: never explain with vocabulary above their level.
- Uzbek learners share predictable interference errors (missing articles a/the, wrong preposition,
  word order after question words, using present simple for ongoing actions). Watch for these first.
- Never invent a mistake in a sentence that is already correct.`;

const truncateHistory = (chatHistory, maxTurns = 6, maxChars = 280) =>
  (chatHistory || []).slice(-maxTurns).map((m) => ({
    role: m.role,
    content: String(m.content || '').slice(0, maxChars),
  }));

const cacheKey = (...parts) =>
  crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40);

const withCache = async (key, fetcher) => {
  const hit = getGeminiCached(key);
  if (hit) return hit;
  const value = await fetcher();
  // xato holatlarini keshlamaymiz — aks holda 2 soat davomida yopishib qoladi
  if (value != null && value.status !== 'unavailable') setGeminiCached(key, value);
  return value;
};

/** Oxirgi chora: model sxemani buzsa ham JSON'ni ajratib olishga urinish */
const looseJson = (text) => {
  const raw = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const block = raw.match(/\{[\s\S]*\}/);
    if (!block) return null;
    try {
      return JSON.parse(block[0].replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
};

// ─── Model chaqiruvlari ──────────────────────────────────────────────────────

/**
 * Sxemaga majburlangan JSON javob.
 * @throws {AiUnavailableError} model yo'q, limit tugagan yoki javob yaroqsiz bo'lsa
 */
const runStructured = async (prompt, responseSchema, { maxTokens = 512, temperature = 0.3 } = {}) => {
  if (!genAI) throw new AiUnavailableError('NO_API_KEY', 'AI xizmati sozlanmagan.');

  let text;
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
    const result = await model.generateContent(prompt);
    text = (await result.response).text();
  } catch (error) {
    if (isQuotaError(error)) {
      throw new AiUnavailableError('QUOTA_EXCEEDED', "AI limiti tugadi. Keyinroq urinib ko'ring.");
    }
    console.error('Gemini structured error:', error.message);
    throw new AiUnavailableError('AI_ERROR');
  }

  const parsed = looseJson(text);
  if (!parsed || typeof parsed !== 'object') {
    console.error('Gemini: sxemaga mos JSON kelmadi:', String(text).slice(0, 200));
    throw new AiUnavailableError('BAD_RESPONSE');
  }
  return parsed;
};

/** Erkin matnli javob (roleplay kabi suhbat oqimlari uchun) */
const runText = async (prompt, { maxTokens = 400, temperature = 0.6 } = {}) => {
  if (!genAI) throw new AiUnavailableError('NO_API_KEY', 'AI xizmati sozlanmagan.');
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    });
    const result = await model.generateContent(prompt);
    const text = (await result.response).text().trim();
    if (!text) throw new AiUnavailableError('EMPTY_RESPONSE');
    return text;
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    if (isQuotaError(error)) {
      throw new AiUnavailableError('QUOTA_EXCEEDED', "AI limiti tugadi. Keyinroq urinib ko'ring.");
    }
    console.error('Gemini text error:', error.message);
    throw new AiUnavailableError('AI_ERROR');
  }
};

// ─── Sxemalar ────────────────────────────────────────────────────────────────

const S = SchemaType;

const sentenceCheckSchema = {
  type: S.OBJECT,
  properties: {
    isCorrect: { type: S.BOOLEAN, description: 'Gap grammatik jihatdan to\'g\'ri va so\'z to\'g\'ri ishlatilganmi' },
    usedTargetWord: { type: S.BOOLEAN, description: 'Maqsadli so\'z haqiqatan ishlatilganmi' },
    feedback: { type: S.STRING, description: 'O\'zbekcha, 1-2 gap, aniq xatoni ko\'rsatuvchi' },
    corrected: { type: S.STRING, description: 'Tuzatilgan inglizcha gap. Agar xato bo\'lmasa bo\'sh qoldiring.' },
    errorType: {
      type: S.STRING,
      enum: ['none', 'article', 'preposition', 'word_order', 'tense', 'word_choice', 'spelling', 'other'],
    },
  },
  required: ['isCorrect', 'usedTargetWord', 'feedback', 'errorType'],
};

const practicePromptSchema = {
  type: S.OBJECT,
  properties: {
    promptUz: { type: S.STRING, description: 'O\'zbekcha vaziyat tavsifi, 2 gap' },
    targetWords: { type: S.ARRAY, items: { type: S.STRING } },
    miniTipUz: { type: S.STRING },
  },
  required: ['promptUz', 'targetWords', 'miniTipUz'],
};

const practiceCheckSchema = {
  type: S.OBJECT,
  properties: {
    isCorrect: { type: S.BOOLEAN },
    feedback: { type: S.STRING, description: 'O\'zbekcha izoh' },
    corrected: { type: S.STRING },
    wordsUsed: { type: S.ARRAY, items: { type: S.STRING }, description: 'To\'g\'ri ishlatilgan maqsadli so\'zlar' },
  },
  required: ['isCorrect', 'feedback', 'wordsUsed'],
};

const teacherSchema = {
  type: S.OBJECT,
  properties: {
    title: { type: S.STRING },
    explanation: { type: S.STRING, description: 'O\'zbekcha, 2 qisqa xatboshi' },
    rule: { type: S.STRING, description: 'Bitta qatorli inglizcha qoida' },
    examples: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: { en: { type: S.STRING }, uz: { type: S.STRING } },
        required: ['en', 'uz'],
      },
    },
    commonMistake: { type: S.STRING, description: 'O\'zbeklar ko\'p qiladigan xato' },
    tip: { type: S.STRING },
  },
  required: ['title', 'explanation', 'rule', 'examples'],
};

const translateSchema = {
  type: S.OBJECT,
  properties: {
    casual: { type: S.STRING, description: 'Kundalik og\'zaki ingliz tili' },
    advanced: { type: S.STRING, description: 'Rasmiyroq / boyroq variant' },
  },
  required: ['casual', 'advanced'],
};

// ─── Ommaviy API ─────────────────────────────────────────────────────────────

/**
 * Takrorlashdagi gapni tekshirish.
 * @returns {{status:'ok', isCorrect, usedTargetWord, feedback, corrected, errorType}
 *          | {status:'unavailable', reason}}
 *
 * MUHIM: 'unavailable' holatida chaqiruvchi SRS'ni O'ZGARTIRMASLIGI shart.
 */
const checkSentence = async (word, sentence, learnerLevel = 'beginner') => {
  const key = cacheKey('check-v2', word, sentence, learnerLevel);
  return withCache(key, async () => {
    try {
      const parsed = await runStructured(
        `Talaba darajasi: ${levelTag(learnerLevel)}.
Maqsadli so'z: "${word}"
Talaba yozgan gap: "${String(sentence).slice(0, 500)}"

Baholang: (1) so'z ma'nosiga mos ishlatilganmi, (2) gap grammatik to'g'rimi.
Agar gap to'g'ri bo'lsa isCorrect=true va corrected bo'sh bo'lsin — sun'iy xato o'ylab topmang.`,
        sentenceCheckSchema,
        { maxTokens: 400 }
      );
      return {
        status: 'ok',
        isCorrect: Boolean(parsed.isCorrect),
        usedTargetWord: Boolean(parsed.usedTargetWord),
        feedback: String(parsed.feedback || '').trim(),
        corrected: String(parsed.corrected || '').trim(),
        errorType: parsed.errorType || 'none',
      };
    } catch (error) {
      return UNAVAILABLE(error.reason);
    }
  });
};

const translateUzbekToEnglish = async (uzbekText) => {
  const key = cacheKey('uz-en-v2', uzbekText);
  return withCache(key, async () => {
    try {
      const parsed = await runStructured(
        `O'zbekcha gapni ikki xil inglizchaga tarjima qiling.
O'zbekcha: "${String(uzbekText).slice(0, 400)}"`,
        translateSchema,
        { maxTokens: 300, temperature: 0.4 }
      );
      const casual = String(parsed.casual || parsed.advanced || '').trim();
      const advanced = String(parsed.advanced || parsed.casual || '').trim();
      if (!casual) return UNAVAILABLE('EMPTY_RESPONSE');
      return { status: 'ok', casual, advanced };
    } catch (error) {
      return UNAVAILABLE(error.reason);
    }
  });
};

// ─── Gapirilgan matn aniqligi ────────────────────────────────────────────────

const normalizeWords = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * DIQQAT: bu talaffuz baholovchi EMAS.
 *
 * Kirish `spokenText` brauzerning SpeechRecognition'idan keladi va u allaqachon
 * to'g'ri inglizcha so'zlarga normallashtirilgan. Ya'ni bu o'lchov "aksent qanchalik
 * to'g'ri" degan savolga javob bermaydi — u faqat "aytilgan so'zlar matnga mos keldimi"
 * ni tekshiradi. Shuning uchun natija `method: 'transcript_match'` bilan belgilanadi
 * va UI uni "talaffuz bahosi" deb ko'rsatmasligi kerak.
 *
 * Haqiqiy talaffuz bahosi uchun fonema darajasidagi xizmat kerak (Azure Pronunciation
 * Assessment yoki shunga o'xshash) — bu keyingi bosqichda.
 */
const evaluateSpokenAccuracy = (targetSentence, spokenText) => {
  const target = normalizeWords(targetSentence);
  const spoken = new Set(normalizeWords(spokenText));

  if (!target.length) {
    return { score: 0, feedback: 'Matn topilmadi.', color: 'red', method: 'transcript_match', missedWords: [] };
  }

  const missedWords = target.filter((w) => w.length > 1 && !spoken.has(w));
  const hits = target.length - target.filter((w) => !spoken.has(w)).length;
  const score = Math.round((hits / target.length) * 100);

  let feedback;
  if (score >= 90) {
    feedback = "Ajoyib — matndagi so'zlarning deyarli hammasi aniq eshitildi.";
  } else if (missedWords.length > 0) {
    feedback = `Bu so'zlar eshitilmadi yoki boshqacha aytildi: ${missedWords.slice(0, 6).join(', ')}. Sekinroq va aniqroq takrorlang.`;
  } else {
    feedback = "Yaxshi urinish. Jumlani yana bir bor sekin o'qib ko'ring.";
  }

  return {
    score,
    feedback,
    color: score >= 90 ? 'green' : score >= 50 ? 'yellow' : 'red',
    missedWords: missedWords.slice(0, 10),
    method: 'transcript_match',
  };
};

const generateRoleplayResponse = async (
  scenario,
  targetWords,
  chatHistory,
  userMessage,
  learnerLevel = 'beginner'
) => {
  try {
    const history = truncateHistory(chatHistory)
      .map((m) => `${m.role === 'user' ? 'Talaba' : 'Siz'}: ${m.content}`)
      .join('\n');
    const words = (targetWords || []).slice(0, 8).join(', ');

    const reply = await runText(
      `Rol o'ynash mashqi. Talaba darajasi: ${levelTag(learnerLevel)}.
Vaziyat: ${String(scenario).slice(0, 160)}
Talaba takrorlashi kerak bo'lgan so'zlar: [${words || '—'}]

Suhbat:
${history || '(boshlanishi)'}
Talaba: ${String(userMessage || '').slice(0, 400)}

Rolda qoling. 1-2 ta inglizcha gap bilan javob bering va suhbatni davom ettiradigan savol qo'shing.
Iloji bo'lsa maqsadli so'zlardan bittasini tabiiy ishlating.
Agar talaba jiddiy grammatik xato qilgan bo'lsa, oxirida qavs ichida bitta qisqa o'zbekcha maslahat bering.`,
      { maxTokens: 300, temperature: 0.75 }
    );
    return { status: 'ok', reply };
  } catch (error) {
    return UNAVAILABLE(error.reason);
  }
};

const generateTeacherResponse = async (
  question,
  category = 'general',
  chatHistory = [],
  learnerLevel = 'beginner'
) => {
  const q = String(question).slice(0, 300);
  const history = truncateHistory(chatHistory, 4, 200);
  const historyText = history
    .map((m) => `${m.role === 'user' ? 'Talaba' : 'Ustoz'}: ${m.content}`)
    .join('\n');

  const fetch = async () => {
    try {
      const parsed = await runStructured(
        `Siz "Ustoz AI"siz. Talaba darajasi: ${levelTag(learnerLevel)}. Mavzu turi: ${category}.
${historyText ? `Oldingi suhbat:\n${historyText}\n` : ''}
Talaba savoli: "${q}"

Tushuntirishni o'zbek tilida yozing. 2-3 ta misol bering. commonMistake'da aynan o'zbek tilida
so'zlashuvchilar shu mavzuda qiladigan tipik xatoni ko'rsating.`,
        teacherSchema,
        { maxTokens: 900, temperature: 0.35 }
      );
      return { status: 'ok', answer: parsed };
    } catch (error) {
      return UNAVAILABLE(error.reason);
    }
  };

  // Suhbat konteksti bo'lmasa keshlash mumkin
  if (history.length === 0) {
    return withCache(cacheKey('teacher-v2', learnerLevel, category, q), fetch);
  }
  return fetch();
};

const generatePracticePrompt = async (words, bucketLabel, learnerLevel = 'beginner') => {
  const wordList = words.slice(0, 6).map((w) => w.word).join(', ');

  // AI bo'lmasa ham mashq to'xtamasligi kerak — bu o'rganishga to'sqinlik qilmaydigan zaxira
  const fallback = {
    status: 'fallback',
    promptUz: `${bucketLabel}: ${wordList} so'zlaridan kamida 2 tasini ishlatib inglizcha gap yozing.`,
    targetWords: words.slice(0, 3).map((w) => w.word),
    miniTipUz: "So'zlarni tabiiy jumla ichida ishlating.",
  };

  try {
    return await withCache(
      cacheKey('practice-p-v2', wordList, bucketLabel, learnerLevel),
      async () => {
        const parsed = await runStructured(
          `Talaba darajasi: ${levelTag(learnerLevel)}. Takrorlanayotgan so'zlar: ${wordList}.
Shu so'zlarni ishlatishga majbur qiladigan real hayotiy vaziyat o'ylab toping.
promptUz — o'zbekcha, 2 gap, "siz ..." shaklida murojaat qiling.`,
          practicePromptSchema,
          { maxTokens: 320, temperature: 0.7 }
        );
        return {
          status: 'ok',
          promptUz: parsed.promptUz || fallback.promptUz,
          targetWords: Array.isArray(parsed.targetWords) && parsed.targetWords.length
            ? parsed.targetWords
            : fallback.targetWords,
          miniTipUz: parsed.miniTipUz || fallback.miniTipUz,
        };
      }
    );
  } catch {
    return fallback;
  }
};

const checkPracticeSentence = async (words, sentence, learnerLevel = 'beginner') => {
  const targetList = words.map((w) => w.word).join(', ');

  try {
    return await withCache(
      cacheKey('practice-c-v2', targetList, sentence, learnerLevel),
      async () => {
        const parsed = await runStructured(
          `Talaba darajasi: ${levelTag(learnerLevel)}.
Maqsadli so'zlar: ${targetList}
Talaba yozgan gap: "${String(sentence).slice(0, 400)}"

Kamida 2 ta maqsadli so'z ma'noga mos ishlatilgan bo'lishi kerak.
wordsUsed'ga faqat HAQIQATAN va TO'G'RI ishlatilgan so'zlarni kiriting.`,
          practiceCheckSchema,
          { maxTokens: 400 }
        );
        return {
          status: 'ok',
          isCorrect: Boolean(parsed.isCorrect),
          feedback: String(parsed.feedback || '').trim(),
          corrected: String(parsed.corrected || '').trim(),
          wordsUsed: Array.isArray(parsed.wordsUsed) ? parsed.wordsUsed : [],
        };
      }
    );
  } catch (error) {
    return UNAVAILABLE(error.reason);
  }
};

module.exports = {
  isGeminiReady,
  AiUnavailableError,
  checkSentence,
  translateUzbekToEnglish,
  evaluateSpokenAccuracy,
  generateRoleplayResponse,
  generateTeacherResponse,
  generatePracticePrompt,
  checkPracticeSentence,
};
