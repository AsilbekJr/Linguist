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
/**
 * Diqqat — `maxTokens` ni ziqna qo'ymang.
 *
 * Limitga urilgan javob YARIM JSON bo'lib keladi va `looseJson` uni parse
 * qila olmaydi → `BAD_RESPONSE` → foydalanuvchi uchun bu "AI ishlamadi" bo'lib
 * ko'rinadi. Aynan shu sabab `generateWordContext` so'zlarning bir qismida
 * jimgina tarjimasiz qaytardi: o'zbekcha matn inglizchaga qaraganda ancha
 * ko'p token yeydi va 300 token yetmasdi.
 *
 * ⚠️ IKKINCHI, YASHIRINROQ SABAB — O'YLASH TOKENLARI.
 *
 * `gemini-2.5-flash` da "thinking" STANDART HOLATDA YOQIQ va o'ylash tokenlari
 * `maxOutputTokens` byudjetidan yeyiladi. Ya'ni 800 token so'ralganda model
 * 700 tasini o'ylashga sarflab, javobga 100 ta qoldirishi mumkin — JSON esa
 * o'rtasida kesiladi. Byudjet har chaqiruvda har xil bo'lgani uchun bu
 * "ba'zan ishlaydi, ba'zan yo'q" ko'rinishidagi tasodifiy nosozlik berardi:
 * bir so'z tarjima bilan, keyingisi tarjimasiz saqlanardi.
 *
 * Yechim — o'ylash byudjetini ANIQ belgilash va uni javob byudjetiga QO'SHIB
 * yuborish. Shunda `maxTokens` har doim "javobning o'ziga ajratilgan joy"
 * ma'nosini saqlaydi va o'ylash uni hech qachon yeb qo'ya olmaydi.
 *
 * `thinkingBudget`: 0 — o'ylash o'chiq (sxema bo'yicha oddiy ma'lumot
 * ajratish uchun shu yetarli). Noldan katta qiymat 512 dan boshlanishi kerak —
 * model qabul qiladigan eng kichik byudjet shu.
 */
const runStructured = async (
  prompt,
  responseSchema,
  { maxTokens = 512, temperature = 0.3, thinkingBudget = 0 } = {}
) => {
  if (!genAI) throw new AiUnavailableError('NO_API_KEY', 'AI xizmati sozlanmagan.');

  let text;
  let finishReason;
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        // O'ylash byudjeti javob byudjetining USTIGA qo'shiladi
        maxOutputTokens: maxTokens + thinkingBudget,
        thinkingConfig: { thinkingBudget },
        temperature,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    finishReason = response.candidates?.[0]?.finishReason;
    text = response.text();
  } catch (error) {
    if (isQuotaError(error)) {
      throw new AiUnavailableError('QUOTA_EXCEEDED', "AI limiti tugadi. Keyinroq urinib ko'ring.");
    }
    console.error('Gemini structured error:', error.message);
    throw new AiUnavailableError('AI_ERROR');
  }

  // Kesilgan javobni ALOHIDA belgilaymiz. Ilgari u ham `BAD_RESPONSE` edi va
  // logdan "model sxemani buzdi"mi yoki "joy yetmadi"mi — ajratib bo'lmasdi.
  if (finishReason === 'MAX_TOKENS') {
    console.error(
      `Gemini: javob token limitiga urildi (maxTokens=${maxTokens}, thinkingBudget=${thinkingBudget}). ` +
        `Kelgan qism: ${String(text).slice(0, 120)}`
    );
    throw new AiUnavailableError('TRUNCATED');
  }

  const parsed = looseJson(text);
  if (!parsed || typeof parsed !== 'object') {
    console.error('Gemini: sxemaga mos JSON kelmadi:', String(text).slice(0, 200));
    throw new AiUnavailableError('BAD_RESPONSE');
  }
  return parsed;
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

/**
 * Gap tahlili — har bir so'z uchun turkum va gap bo'lagi.
 *
 * `partOfSpeech` va `role` ENUM bilan cheklangan: erkin matn qaytsa UI ularni
 * ranglar bilan ajrata olmasdi va model har safar boshqa atama ishlatardi
 * ("fe'l", "verb", "harakat so'zi").
 */
const sentenceAnalysisSchema = {
  type: S.OBJECT,
  properties: {
    translationUz: { type: S.STRING, description: 'Butun gapning o\'zbekcha tarjimasi' },
    tenseUz: { type: S.STRING, description: 'Zamon, o\'zbekcha (masalan: Hozirgi oddiy zamon)' },
    structureUz: {
      type: S.STRING,
      description: 'Gap tuzilishi haqida 1-2 gaplik o\'zbekcha izoh',
    },
    tokens: {
      type: S.ARRAY,
      description: 'Gapdagi har bir so\'z, gapda kelgan tartibida',
      items: {
        type: S.OBJECT,
        properties: {
          word: { type: S.STRING, description: 'So\'zning gapdagi shakli' },
          partOfSpeech: {
            type: S.STRING,
            description: 'So\'z turkumi',
            enum: [
              'ot', 'fe\'l', 'sifat', 'ravish', 'olmosh', 'son',
              'predlog', 'artikl', 'bog\'lovchi', 'yuklama', 'undov',
            ],
          },
          role: {
            type: S.STRING,
            description: 'Gap bo\'lagi. Mustaqil bo\'lak bo\'lmasa "yordamchi".',
            enum: ['ega', 'kesim', 'to\'ldiruvchi', 'aniqlovchi', 'hol', 'yordamchi'],
          },
          meaningUz: { type: S.STRING, description: 'So\'zning shu gapdagi o\'zbekcha ma\'nosi' },
          noteUz: { type: S.STRING, description: 'Qisqa izoh: nega shu turkum/bo\'lak' },
        },
        required: ['word', 'partOfSpeech', 'role', 'meaningUz'],
      },
    },
  },
  required: ['translationUz', 'tenseUz', 'structureUz', 'tokens'],
};

/**
 * Yangi so'zga daraja bo'yicha ta'rif, misol va tarjima.
 *
 * `definitionEn` nega kerak: lug'at snapshoti Wiktionary'ning BIRINCHI ma'nosini
 * oladi, u esa ko'pincha eng keng tarqalgani emas. "kids" uchun u "A young goat"
 * beradi — natijada kartochkada tarjima "bolalar", ta'rif esa "echki bolasi"
 * bo'lib, o'z-o'ziga zid chiqadi.
 */
const wordContextSchema = {
  type: S.OBJECT,
  properties: {
    translationUz: { type: S.STRING, description: 'So\'zning o\'zbekcha tarjimasi, 1-3 so\'z' },
    definitionEn: {
      type: S.STRING,
      description: 'Eng keng tarqalgan ma\'noning sodda inglizcha ta\'rifi, bitta qisqa gap',
    },
    exampleEn: { type: S.STRING, description: 'Misol gap, so\'z ishtirok etishi SHART' },
    exampleUz: { type: S.STRING, description: 'Misol gapning o\'zbekcha tarjimasi' },
  },
  required: ['translationUz', 'definitionEn', 'exampleEn', 'exampleUz'],
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
        // Grammatik hukm — o'ylash sifatni oshiradi, shuning uchun byudjet
        // beriladi. U javob byudjetidan alohida, ya'ni feedback'ni kesmaydi.
        { maxTokens: 900, thinkingBudget: 512 }
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
        { maxTokens: 900, temperature: 0.4 }
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

/**
 * Gapni grammatik tahlil qilish — "Ustoz AI" ning o'rniga.
 *
 * Eski Ustoz AI erkin savol-javob chati edi: foydalanuvchi nima so'rashini
 * bilmasdi, javob sifati savolga bog'liq edi va u hech qanday tarzda
 * foydalanuvchining o'z lug'atiga bog'lanmagan edi. Bu funksiya aniq bitta ish
 * qiladi: foydalanuvchi yozgan (yoki takrorlashda tuzgan) gapni olib, har bir
 * so'zning turkumi va gap bo'lagini ko'rsatadi.
 *
 * @returns {{status:'ok', analysis} | {status:'unavailable', reason}}
 */
const analyzeSentence = async (sentence, learnerLevel = 'beginner') => {
  const text = String(sentence || '').trim().slice(0, 400);
  if (!text) return UNAVAILABLE('EMPTY');

  return withCache(cacheKey('analyze-v1', text, learnerLevel), async () => {
    try {
      const parsed = await runStructured(
        `Talaba darajasi: ${levelTag(learnerLevel)}.
Quyidagi inglizcha gapni tahlil qiling:

"${text}"

Qoidalar:
- tokens massivida gapdagi HAR BIR so'z bo'lishi kerak, gapda kelgan tartibda.
  Tinish belgilarini alohida token qilmang.
- role: faqat bitta ega va bitta kesim bo'lishi kerak (qo'shma gapda har bir
  sodda gap uchun bittadan). Artikl, predlog, ko'makchi fe'l — "yordamchi".
- noteUz qisqa bo'lsin: bir gap, ko'pi bilan 12 so'z.
- Izohlar o'zbek tilida (lotin yozuvida).`,
        sentenceAnalysisSchema,
        // Har bir so'zning turkumi va gap bo'lagi — eng murakkab tahlil,
        // shuning uchun byudjet kattaroq.
        { maxTokens: 3000, temperature: 0.2, thinkingBudget: 1024 }
      );

      const tokens = Array.isArray(parsed.tokens) ? parsed.tokens : [];
      if (!tokens.length) return UNAVAILABLE('EMPTY_ANALYSIS');

      return {
        status: 'ok',
        analysis: {
          sentence: text,
          translationUz: String(parsed.translationUz || '').trim(),
          tenseUz: String(parsed.tenseUz || '').trim(),
          structureUz: String(parsed.structureUz || '').trim(),
          tokens: tokens.map((t) => ({
            word: String(t.word || '').trim(),
            partOfSpeech: String(t.partOfSpeech || '').trim(),
            role: String(t.role || 'yordamchi').trim(),
            meaningUz: String(t.meaningUz || '').trim(),
            noteUz: String(t.noteUz || '').trim(),
          })),
        },
      };
    } catch (error) {
      return UNAVAILABLE(error.reason);
    }
  });
};

/**
 * Yangi so'zga tarjima va DARAJAGA MOS misol gap.
 *
 * Nega lug'atdagi misol yetmaydi: `dictionary-snapshot.json` dagi misollar
 * Wiktionary'dan keladi va ular A1 o'quvchisi uchun ko'pincha juda og'ir
 * ("He is a student of life"). Bu yerda misol foydalanuvchining darajasiga
 * qarab yoziladi va o'zbekcha tarjimasi bilan keladi.
 *
 * @returns {{status:'ok', translationUz, exampleEn, exampleUz}
 *          | {status:'unavailable', reason}}
 */
const generateWordContext = async (word, definition = '', learnerLevel = 'beginner') => {
  const w = String(word || '').trim().slice(0, 60);
  if (!w) return UNAVAILABLE('EMPTY');

  return withCache(cacheKey('wordctx-v1', w, learnerLevel), async () => {
    // Bitta qayta urinish: bu foydalanuvchi kutib turgan interaktiv oqim va
    // ketma-ket so'z qo'shilganda Gemini qisqa muddatli 429 qaytaradi.
    // Qayta urinmasak so'z tarjimasiz va misolsiz saqlanib qolardi.
    const attempt = async () => runStructured(
        `Talaba darajasi: ${levelTag(learnerLevel)}. So'z: "${w}".
${definition ? `Inglizcha ta'rifi: ${String(definition).slice(0, 200)}` : ''}

Vazifa — so'zning ENG KENG TARQALGAN kundalik ma'nosini oling
(lug'atdagi birinchi ma'no eng keng tarqalgani bo'lmasligi mumkin):
1. translationUz — shu ma'noning o'zbekcha tarjimasi (1-3 so'z).
2. definitionEn — shu ma'noning sodda inglizcha ta'rifi, bitta qisqa gap.
   translationUz bilan BIR XIL ma'noni tavsiflashi shart.
3. exampleEn — AYNAN shu darajaga mos misol gap. "${w}" so'zi gapda BO'LISHI SHART.
   Gap qisqa va kundalik bo'lsin; darajadan yuqori leksika ishlatmang.
4. exampleUz — misol gapning tabiiy o'zbekcha tarjimasi.`,
        wordContextSchema,
        { maxTokens: 800, temperature: 0.4 }
      );

    // Qayta urinishga arziydigan sabablar — hammasi o'tkinchi.
    // `BAD_RESPONSE` ham shu ro'yxatda: model vaqti-vaqti bilan sxemani buzadi
    // va bu bitta so'zning tarjimasiz saqlanib qolishiga olib kelardi.
    // `NO_API_KEY` va `TRUNCATED` yo'q — ular qayta urinishdan o'zgarmaydi.
    const RETRYABLE = new Set(['QUOTA_EXCEEDED', 'AI_ERROR', 'BAD_RESPONSE']);

    let parsed;
    try {
      parsed = await attempt();
    } catch (first) {
      if (!RETRYABLE.has(first.reason)) {
        return UNAVAILABLE(first.reason);
      }
      await new Promise((r) => setTimeout(r, 1500));
      try {
        parsed = await attempt();
      } catch (second) {
        return UNAVAILABLE(second.reason);
      }
    }

    return {
      status: 'ok',
      translationUz: String(parsed.translationUz || '').trim(),
      definitionEn: String(parsed.definitionEn || '').trim(),
      exampleEn: String(parsed.exampleEn || '').trim(),
      exampleUz: String(parsed.exampleUz || '').trim(),
    };
  });
};

module.exports = {
  isGeminiReady,
  AiUnavailableError,
  checkSentence,
  translateUzbekToEnglish,
  evaluateSpokenAccuracy,
  analyzeSentence,
  generateWordContext,
};
