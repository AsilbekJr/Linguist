const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { checkSentence } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, reviewCheckSchema, reviewTranslationSchema, phraseCheckSchema } = require('../middleware/validate');
const { lookupTranslation } = require('../utils/localTranslations');
const { trackAiUsageSoft } = require('../middleware/usageQuota');
const { applySchedule, restartLearning, markKnown, stageInterval, readStage, MAX_STAGE } = require('../utils/srs');
const mongoose = require('mongoose');
const { userDayKey } = require('../utils/dayKey');
const User = require('../models/User');
const Phrase = require('../models/Phrase');
const phrases = require('../services/phrases');
const { matchPhrase } = require('../utils/phraseMatch');
const {
  advanceStreak,
  dailyStepMessage,
  QUEST_STEP_XP,
  DAILY_BONUS_XP,
  isPlanComplete,
} = require('../utils/gamification');
const { checkSentenceLocally } = require('../utils/sentenceCheck');
const { invalidateUserWords } = require('../utils/userWordsCache');
const { buildDistractorPool } = require('../utils/topicHelpers');
const {
  MODES,
  modeForWord,
  checkRecall,
  checkRecognize,
  checkCloze,
  checkBuild,
  exampleOf,
  buildOptions,
  presentDueWord,
  revealWord,
} = require('../utils/reviewModes');

const DUE_LIMIT = 20;

/**
 * Kunlik rejaning "takrorlash" qadami uchun: navbat bo'shasa YOKI bugun
 * shuncha so'z takrorlansa, qadam bajarilgan. Ikkinchi shart bo'lmasa,
 * 80 ta so'z yig'ib qo'ygan foydalanuvchi bir kunda rejani yopa olmasdi.
 */
const DAILY_REVIEW_GOAL = DUE_LIMIT;

/** Yodlangan so'zlar navbatga tushmaydi */
const dueFilter = (userId, now) => ({
  user: userId,
  learned: { $ne: true },
  $or: [
    { nextReviewDate: { $lte: now } },
    { nextReviewDate: { $exists: false } },
    { nextReviewDate: null },
  ],
});

/** `dueFilter` ning bitta hujjat uchun ekvivalenti */
const isDue = (word, now) =>
  !word.learned && (word.nextReviewDate == null || word.nextReviewDate <= now);

/** Kun almashgan bo'lsa kunlik questlarni nollash — atomik */
const rollDailyQuestsAtomic = (userId, todayKey) =>
  User.updateOne(
    { _id: userId, 'dailyQuests.date': { $ne: todayKey } },
    {
      $set: {
        dailyQuests: {
          date: todayKey,
          reviewCompleted: false,
          reviewSkipped: false,
          topicCompleted: false,
          speakCompleted: false,
          listeningCompleted: false,
          reviewedCount: 0,
        },
      },
    }
  );

/**
 * "Takrorlash" qadamini belgilash. Qadamni atomik "egallaymiz" — parallel
 * so'rovlar XP'ni ikki marta bermasligi uchun — va sahna ham tugagan bo'lsa
 * streak'ni oshiramiz.
 *
 * `req.user.save()` ATAYLAB ishlatilmaydi: u so'rov boshida o'qilgan eski
 * hujjat, uni saqlash parallel so'rovlar yozgan AI hisoblagichi va
 * `reviewedCount` ni eski qiymat bilan bosib yuborardi.
 */
const claimReviewStep = async (userId, todayKey, { skipped = false } = {}) => {
  // Takrorlanmagan qadam uchun XP yo'q: ilgari yangi foydalanuvchi hech narsa
  // qilmay "Qadam bajarildi!" va XP olardi
  const stepXp = skipped ? 0 : QUEST_STEP_XP;
  const claimed = await User.findOneAndUpdate(
    { _id: userId, 'dailyQuests.date': todayKey, 'dailyQuests.reviewCompleted': { $ne: true } },
    {
      $set: { 'dailyQuests.reviewCompleted': true, 'dailyQuests.reviewSkipped': skipped },
      $inc: { xp: stepXp },
    },
    { new: true }
  );
  if (!claimed) return null;

  const step = { xpAwarded: stepXp, streakUpdated: false, streakFrozen: false };
  if (isPlanComplete(claimed.dailyQuests)) {
    const streak = advanceStreak(claimed, todayKey);
    if (streak.changed) {
      claimed.xp += DAILY_BONUS_XP;
      step.xpAwarded += DAILY_BONUS_XP;
      step.streakUpdated = true;
      step.streakFrozen = streak.streakFrozen;
      await claimed.save();
    }
  }
  return { user: claimed, step };
};

const dailyStepPayload = (user, step) => ({
  reviewCompleted: Boolean(user.dailyQuests?.reviewCompleted),
  reviewSkipped: Boolean(user.dailyQuests?.reviewSkipped),
  reviewedCount: user.dailyQuests?.reviewedCount || 0,
  planCompleted: isPlanComplete(user.dailyQuests),
  xpAwarded: step?.xpAwarded || 0,
  streakUpdated: Boolean(step?.streakUpdated),
  streakFrozen: Boolean(step?.streakFrozen),
  currentStreak: user.currentStreak || 0,
  message: step ? dailyStepMessage(step) : null,
});

/**
 * Navbatdagi so'z takrorlangach: hisoblagichni oshiradi va navbat bo'shasa
 * yoki kunlik maqsadga yetilsa "takrorlash" qadamini belgilaydi.
 */
const recordReview = async (userDoc, now) => {
  const todayKey = userDayKey(userDoc, now);
  await rollDailyQuestsAtomic(userDoc._id, todayKey);
  let user = await User.findOneAndUpdate(
    { _id: userDoc._id },
    // Haqiqatan takrorladi — "so'z yo'q edi" belgisi endi to'g'ri emas
    { $inc: { 'dailyQuests.reviewedCount': 1 }, $set: { 'dailyQuests.reviewSkipped': false } },
    { new: true }
  );

  let step = null;
  if (!user.dailyQuests.reviewCompleted) {
    // Ibora kartalari ham "Takrorlash" qadamining bir qismi
    const remaining = (await Word.countDocuments(dueFilter(user._id, now))) + (await phrases.countDue(user._id, now));
    if (remaining === 0 || user.dailyQuests.reviewedCount >= DAILY_REVIEW_GOAL) {
      const claim = await claimReviewStep(user._id, todayKey);
      if (claim) ({ user, step } = claim);
    }
  }
  return dailyStepPayload(user, step);
};

/** Tanib olish variantlari uchun kurs so'zlari tarjimalari (bir marta, keshda) */
let coursePoolCache = null;
const getCoursePool = () => {
  if (!coursePoolCache) {
    try {
      const topics = require('../data/topics.json');
      coursePoolCache = buildDistractorPool(Array.isArray(topics) ? topics : topics.topics || []);
    } catch {
      coursePoolCache = [];
    }
  }
  return coursePoolCache;
};

/** So'zlarni rejimiga mos ko'rinishga keltiradi (tanib olishda — variantlar bilan) */
/** Rejim zinapoyasi darajaga bog'liq (utils/reviewModes.js → LADDERS) */
const levelOf = (user) => user?.onboarding?.level || 'beginner';

const presentWords = async (user, words) => {
  const level = levelOf(user);
  const needsOptions = words.some((w) => modeForWord(w, readStage(w), level) === MODES.RECOGNIZE);
  const ownPool = needsOptions
    ? (await Word.find({ user: user._id }).select('translation').limit(300).lean())
        .map((w) => w.translation)
        .filter(Boolean)
    : [];
  return words.map((w) => {
    const mode = modeForWord(w, readStage(w), level);
    const options =
      mode === MODES.RECOGNIZE ? buildOptions(w.translation, { ownPool, coursePool: getCoursePool() }) : undefined;
    return presentDueWord(w, mode, options);
  });
};

// @desc    Tarjimasiz so'zga o'zbekcha tarjima yozish ("translate" topshirig'i)
// @route   POST /api/review/:id/translation
//
// Baholanmaydi va jadvalga tegmaydi — bu so'z bilan birinchi tanishuv.
// Javobda shu so'zning endi odatiy topshirig'i qaytadi (odatda tanib olish),
// mijoz uni navbatdagi joyiga qo'yadi.
router.post('/:id/translation', protect, validate(reviewTranslationSchema), async (req, res) => {
  try {
    const wordDoc = await Word.findOne({ _id: req.validated.params.id, user: req.user._id });
    if (!wordDoc) return res.status(404).json({ message: 'Word not found' });
    wordDoc.translation = req.validated.body.translation;
    await wordDoc.save();
    invalidateUserWords(req.user._id);
    const [item] = await presentWords(req.user, [wordDoc.toObject()]);
    res.json({ item });
  } catch (error) {
    console.error('Review translation error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Bugun takrorlanishi kerak bo'lgan so'zlar — har biri o'z rejimida
// @route   GET /api/review/due
//
// Javobni oshkor qiladigan maydonlar rejimga qarab olib tashlanadi: tanib
// olishda tarjima, eslashda so'zning o'zi ko'rinmaydi (utils/reviewModes.js).
router.get('/due', protect, async (req, res) => {
  try {
    const dueWords = await Word.find(dueFilter(req.user._id, new Date()))
      // Eng ko'p unutilgan so'zlar oldinroq — qiyinlari birinchi kelsin
      .sort({ nextReviewDate: 1, lapses: -1 })
      .limit(DUE_LIMIT)
      .lean();

    // Tarjimasiz so'zlar: avval o'z kontentimizdan topishga urinamiz va saqlaymiz
    const fills = [];
    for (const w of dueWords) {
      if (String(w.translation || '').trim()) continue;
      const found = lookupTranslation(w.word);
      if (found) {
        w.translation = found;
        fills.push({ updateOne: { filter: { _id: w._id }, update: { $set: { translation: found } } } });
      }
    }
    if (fills.length) {
      await Word.bulkWrite(fills);
      invalidateUserWords(req.user._id);
    }

    res.json(await presentWords(req.user, dueWords));
  } catch (error) {
    console.error('Fetch Due Words Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Bugungi ibora kartalari (sahnada yodlangan gaplar)
// @route   GET /api/review/phrases/due
// Javob oshkor qilinmaydi: faqat o'zbekcha ma'nosi va birinchi harflar
router.get('/phrases/due', protect, async (req, res) => {
  try {
    const list = await phrases.listDue(req.user._id, new Date());
    res.json(list.map(phrases.presentPhrase));
  } catch (error) {
    console.error('Phrases due error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Ibora kartasini tekshirish: o'zbekcha ma'nodan butun gapni aytish
// @route   POST /api/review/phrases/:id/check
router.post('/phrases/:id/check', protect, validate(phraseCheckSchema), async (req, res) => {
  try {
    const doc = await Phrase.findOne({ _id: req.validated.params.id, user: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Ibora topilmadi.' });

    const now = new Date();
    const match = matchPhrase(doc.text, req.validated.body.answer);
    const isCorrect = match.percent >= phrases.PASS_PERCENT;
    const common = { status: 'ok', isCorrect, percent: match.percent, words: match.words, text: doc.text, textUz: doc.textUz };

    // Muddati kelmagan — mashq: tekshiriladi, jadval o'zgarmaydi
    if (doc.learned || doc.nextReviewDate > now) {
      return res.json({ ...common, practice: true, stage: doc.stage });
    }

    const next = phrases.applyPhraseSchedule(doc, isCorrect, now, req.user.timezone);
    await doc.save();
    const dailyStep = await recordReview(req.user, now);
    res.json({ ...common, practice: false, ...next, maxStage: phrases.LEARNED_STAGE, dailyStep });
  } catch (error) {
    console.error('Phrase check error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Takrorlash statistikasi
// @route   GET /api/review/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const [due, upcoming, total, learned, struggling] = await Promise.all([
      Word.countDocuments(dueFilter(req.user._id, now)),
      Word.countDocuments({
        user: req.user._id,
        learned: { $ne: true },
        nextReviewDate: { $gt: now, $lte: tomorrow },
      }),
      Word.countDocuments({ user: req.user._id }),
      Word.countDocuments({ user: req.user._id, learned: true }),
      Word.countDocuments({ user: req.user._id, lapses: { $gte: 3 } }),
    ]);

    res.json({ due, upcoming, total, learned, learning: total - learned, struggling });
  } catch (error) {
    console.error('Review stats error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * AI kvotasi faqat gap tuzish rejimida band qilinadi — tanib olish va eslash
 * AI'siz tekshiriladi va limitga umuman tegmasligi kerak.
 */
const NO_AI_CALL = { quotaExceeded: false, refund: async () => {}, commit: () => {} };
const aiQuotaForSentenceOnly = (req, res, next) => {
  if ((req.validated.body.mode || MODES.SENTENCE) !== MODES.SENTENCE) {
    req.aiCall = NO_AI_CALL;
    return next();
  }
  return trackAiUsageSoft(req, res, next);
};

/** Tanib olish, eslash, bo'sh joy va gap yig'ish — AI'siz, aniq javob bilan */
const gradeExact = (wordDoc, mode, answer) => {
  if (mode === MODES.BUILD) {
    const { isCorrect } = checkBuild(wordDoc, answer);
    const sentence = exampleOf(wordDoc);
    return {
      isCorrect,
      feedback: isCorrect ? "To'g'ri!" : `To'g'ri tartib: "${sentence}"`,
      correctAnswer: sentence,
    };
  }
  if (mode === MODES.CLOZE) {
    const { isCorrect, nearMiss } = checkCloze(wordDoc, answer);
    return {
      isCorrect,
      nearMiss,
      feedback: nearMiss
        ? `Deyarli to'g'ri — bitta harf xato. To'g'ri yozilishi: ${wordDoc.word}`
        : isCorrect
          ? "To'g'ri!"
          : `To'g'ri javob: ${wordDoc.word}`,
      correctAnswer: wordDoc.word,
    };
  }
  if (mode === MODES.RECOGNIZE) {
    const isCorrect = checkRecognize(wordDoc.translation, answer);
    return {
      isCorrect,
      feedback: isCorrect ? "To'g'ri!" : `To'g'ri javob: "${wordDoc.translation}"`,
      correctAnswer: wordDoc.translation,
    };
  }
  const { isCorrect, nearMiss } = checkRecall(wordDoc.word, answer);
  return {
    isCorrect,
    nearMiss,
    feedback: nearMiss
      ? `Deyarli to'g'ri — bitta harf xato. To'g'ri yozilishi: ${wordDoc.word}`
      : isCorrect
        ? "To'g'ri!"
        : `To'g'ri javob: ${wordDoc.word}`,
    correctAnswer: wordDoc.word,
  };
};

/**
 * @desc  Takrorlash javobini tekshirish va bosqichni yangilash
 * @route POST /api/review/:id/check
 * @body  { mode?: 'recognize'|'recall'|'sentence', answer?, sentence?, source? }
 *
 * Rejimni server so'z bosqichidan aniqlaydi. Mijoz boshqasini yuborsa (masalan
 * gap tuzish o'rniga osonroq tanib olishni) — 409. Mashq rejimida (muddati
 * kelmagan so'z) istalgan rejim qabul qilinadi, jadval baribir o'zgarmaydi.
 *
 * Gap rejimida matn klaviaturadan yoki mikrofon orqali kelishi mumkin — ikkalasi
 * ham MATN. Bu talaffuzni baholamaydi.
 */
router.post('/:id/check', protect, validate(reviewCheckSchema), aiQuotaForSentenceOnly, async (req, res) => {
  const { sentence, source, answer } = req.validated.body;
  const mode = req.validated.body.mode || MODES.SENTENCE;
  const wordId = req.validated.params.id;

  try {
    const wordDoc = await Word.findOne({ _id: wordId, user: req.user._id });
    if (!wordDoc) {
      await req.aiCall.refund();
      return res.status(404).json({ message: 'Word not found' });
    }

    const now = new Date();
    const due = isDue(wordDoc, now);
    const expectedMode = modeForWord(wordDoc, readStage(wordDoc), levelOf(req.user));
    if (due && mode !== expectedMode) {
      await req.aiCall.refund();
      return res.status(409).json({
        message: 'Bu so\'z uchun boshqa topshiriq kutilmoqda. Sahifani yangilang.',
        code: 'MODE_MISMATCH',
        expectedMode,
      });
    }

    // ── Baholash ─────────────────────────────────────────────────────────
    let graded;
    let method;
    let aiReason;
    if (mode === MODES.SENTENCE) {
      const learnerLevel = req.user.onboarding?.level || 'beginner';
      // Kvota tugagan bo'lsa AI chaqirilmaydi — takrorlash to'xtamasligi kerak
      const aiResult = req.aiCall.quotaExceeded
        ? { status: 'unavailable', reason: 'QUOTA' }
        : await checkSentence(wordDoc.word, sentence, learnerLevel);

      // AI javob bermadi → mahalliy tekshiruv. Takrorlash yagona yo'l bo'lgani
      // uchun Gemini uzilishi butun ilovani to'xtatib qo'ymasligi kerak.
      const usingFallback = aiResult.status === 'unavailable';
      const result = usingFallback ? checkSentenceLocally(wordDoc.word, sentence) : aiResult;
      if (usingFallback) await req.aiCall.refund();
      else req.aiCall.commit();

      method = usingFallback ? 'local' : 'ai';
      aiReason = usingFallback ? aiResult.reason : undefined;
      // So'z ishlatilmagan bo'lsa — gap grammatik to'g'ri bo'lsa ham mashq bajarilmadi
      graded = {
        isCorrect: Boolean(result.isCorrect && result.usedTargetWord),
        usedTargetWord: Boolean(result.usedTargetWord),
        feedback: result.feedback,
        corrected: result.corrected,
        errorType: result.errorType,
      };
    } else {
      method = 'exact';
      graded = gradeExact(wordDoc, mode, answer);
    }

    const common = {
      status: 'ok',
      mode,
      method,
      aiReason,
      source: source || 'text',
      wordId: wordDoc._id,
      maxStage: MAX_STAGE,
      reveal: revealWord(wordDoc),
      ...graded,
    };

    // Muddati kelmagan so'z — MASHQ: tekshiriladi, lekin jadval o'zgarmaydi.
    // Busiz xatodan keyingi "Qayta urinish" so'zni o'sha zahoti yuqori
    // bosqichga ko'tarardi.
    if (!due) {
      return res.json({
        ...common,
        practice: true,
        stage: readStage(wordDoc),
        nextReviewDate: wordDoc.nextReviewDate,
        learned: Boolean(wordDoc.learned),
      });
    }

    const next = applySchedule(wordDoc, graded.isCorrect, now, req.user.timezone);
    await wordDoc.save();
    if (next.learned) invalidateUserWords(req.user._id);

    const dailyStep = await recordReview(req.user, now);

    res.json({
      ...common,
      practice: false,
      dailyStep,
      stage: next.stage,
      intervalDays: next.intervalDays,
      nextReviewDate: next.nextReviewDate,
      learned: next.learned,
      // Keyingi safar qaysi topshiriq bo'lishi — UI "keyingi safar gap tuzasiz" deya oladi
      nextMode: next.learned ? null : modeForWord(wordDoc, next.stage, levelOf(req.user)),
    });
  } catch (error) {
    console.error('Review Check Error:', error);
    await req.aiCall?.refund();
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Yodlangan so'zni qayta yodlashga qaytarish (4-bosqichdan)
// @route   POST /api/review/:id/relearn
router.post('/:id/relearn', protect, async (req, res) => {
  try {
    const wordDoc = await Word.findOne({ _id: req.params.id, user: req.user._id });
    if (!wordDoc) return res.status(404).json({ message: 'Word not found' });

    if (!wordDoc.learned) {
      return res.status(400).json({ message: 'Bu so\'z allaqachon yodlanmoqda.' });
    }

    const next = restartLearning(wordDoc, new Date(), req.user.timezone);
    await wordDoc.save();
    invalidateUserWords(req.user._id);

    res.json({
      status: 'ok',
      wordId: wordDoc._id,
      stage: next.stage,
      intervalDays: next.intervalDays,
      nextReviewDate: next.nextReviewDate,
      learned: false,
    });
  } catch (error) {
    console.error('Relearn error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    "Bilaman": so'zni takrorlashsiz yodlanganlarga o'tkazish
// @route   POST /api/review/:id/known
//
// Kunlik reja qadamini YOPMAYDI — bu takrorlash emas. Navbat shu bilan
// bo'shasa, "Bugun" sahifasi odatdagidek complete-day orqali yopadi.
router.post('/:id/known', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Word not found' });
    const wordDoc = await Word.findOne({ _id: req.params.id, user: req.user._id });
    if (!wordDoc) return res.status(404).json({ message: 'Word not found' });
    if (wordDoc.learned) {
      return res.status(400).json({ message: "Bu so'z allaqachon yodlanganlar ro'yxatida." });
    }

    const next = markKnown(wordDoc);
    await wordDoc.save();
    invalidateUserWords(req.user._id);

    res.json({ status: 'ok', wordId: wordDoc._id, ...next, markedKnown: true });
  } catch (error) {
    console.error('Mark known error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * @desc  Navbat bo'sh bo'lgan kun uchun "takrorlash" qadamini yopish
 * @route POST /api/review/complete-day
 *
 * Takrorlaydigan so'zi yo'q foydalanuvchi ham kunlik rejani yopa olishi
 * kerak — aks holda uning streak'i hech qachon oshmasdi. Mijozga ishonilmaydi:
 * navbatda so'z bo'lsa rad etiladi.
 */
router.post('/complete-day', protect, async (req, res) => {
  try {
    const now = new Date();
    const todayKey = userDayKey(req.user, now);
    await rollDailyQuestsAtomic(req.user._id, todayKey);
    let user = await User.findById(req.user._id);

    let step = null;
    if (!user.dailyQuests.reviewCompleted) {
      const remaining = (await Word.countDocuments(dueFilter(user._id, now))) + (await phrases.countDue(user._id, now));
      if (remaining > 0 && (user.dailyQuests.reviewedCount || 0) < DAILY_REVIEW_GOAL) {
        return res.status(409).json({
          message: `Navbatda hali ${remaining} ta karta bor.`,
          code: 'REVIEW_PENDING',
          remaining,
        });
      }
      // Bugun birorta ham so'z takrorlanmagan — qadam "o'tkazildi", bajarilmadi
      const skipped = (user.dailyQuests.reviewedCount || 0) === 0;
      const claim = await claimReviewStep(user._id, todayKey, { skipped });
      if (claim) ({ user, step } = claim);
    }

    res.json(dailyStepPayload(user, step));
  } catch (error) {
    console.error('Complete review day error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Bosqichlar jadvali — UI'da "keyingi takrorlash" ni ko'rsatish uchun
// @route   GET /api/review/stages
router.get('/stages', protect, (req, res) => {
  res.json({
    // 7-bosqichga yetgan so'z yodlangan — u yerda kutish yo'q, shuning uchun
    // jadvalda faqat 1..6 intervallari ko'rsatiladi
    graduatesAtStage: MAX_STAGE,
    intervals: Array.from({ length: MAX_STAGE - 1 }, (_, i) => ({
      stage: i + 1,
      days: stageInterval(i + 1),
    })),
  });
});

module.exports = router;
