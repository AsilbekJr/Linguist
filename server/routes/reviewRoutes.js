const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { checkSentence } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, reviewCheckSchema } = require('../middleware/validate');
const { trackAiUsageSoft } = require('../middleware/usageQuota');
const { applySchedule, restartLearning, stageInterval, readStage, MAX_STAGE } = require('../utils/srs');
const { userDayKey } = require('../utils/dayKey');
const User = require('../models/User');
const {
  advanceStreak,
  dailyStepMessage,
  QUEST_STEP_XP,
  DAILY_BONUS_XP,
} = require('../utils/gamification');
const { checkSentenceLocally } = require('../utils/sentenceCheck');
const { invalidateUserWords } = require('../utils/userWordsCache');

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
          topicCompleted: false,
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
const claimReviewStep = async (userId, todayKey) => {
  const claimed = await User.findOneAndUpdate(
    { _id: userId, 'dailyQuests.date': todayKey, 'dailyQuests.reviewCompleted': { $ne: true } },
    { $set: { 'dailyQuests.reviewCompleted': true }, $inc: { xp: QUEST_STEP_XP } },
    { new: true }
  );
  if (!claimed) return null;

  const step = { xpAwarded: QUEST_STEP_XP, streakUpdated: false, streakFrozen: false };
  if (claimed.dailyQuests.topicCompleted) {
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
  reviewedCount: user.dailyQuests?.reviewedCount || 0,
  planCompleted: Boolean(user.dailyQuests?.reviewCompleted && user.dailyQuests?.topicCompleted),
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
    { $inc: { 'dailyQuests.reviewedCount': 1 } },
    { new: true }
  );

  let step = null;
  if (!user.dailyQuests.reviewCompleted) {
    const remaining = await Word.countDocuments(dueFilter(user._id, now));
    if (remaining === 0 || user.dailyQuests.reviewedCount >= DAILY_REVIEW_GOAL) {
      const claim = await claimReviewStep(user._id, todayKey);
      if (claim) ({ user, step } = claim);
    }
  }
  return dailyStepPayload(user, step);
};

// @desc    Bugun takrorlanishi kerak bo'lgan so'zlar
// @route   GET /api/review/due
router.get('/due', protect, async (req, res) => {
  try {
    const dueWords = await Word.find(dueFilter(req.user._id, new Date()))
      // Eng ko'p unutilgan so'zlar oldinroq — qiyinlari birinchi kelsin
      .sort({ nextReviewDate: 1, lapses: -1 })
      .limit(DUE_LIMIT)
      .lean();

    res.json(dueWords);
  } catch (error) {
    console.error('Fetch Due Words Error:', error);
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
 * @desc  So'z ishtirokidagi gapni tekshirish va bosqichni yangilash
 * @route POST /api/review/:id/check
 * @body  { sentence, source?: 'text' | 'voice' }
 *
 * Gap klaviaturadan yozilgan yoki mikrofon orqali aytilgan bo'lishi mumkin —
 * ikkalasi ham bu yerga MATN bo'lib keladi (nutqni brauzerning
 * `SpeechRecognition`i transkripsiya qiladi), shuning uchun tekshiruv bir xil.
 *
 * Diqqat: bu talaffuzni baholamaydi. Ovozli javobda ham faqat transkript
 * matni tekshiriladi.
 */
router.post('/:id/check', protect, validate(reviewCheckSchema), trackAiUsageSoft, async (req, res) => {
  const { sentence, source } = req.validated.body;
  const wordId = req.validated.params.id;

  try {
    const wordDoc = await Word.findOne({ _id: wordId, user: req.user._id });
    if (!wordDoc) {
      await req.aiCall.refund();
      return res.status(404).json({ message: 'Word not found' });
    }

    const learnerLevel = req.user.onboarding?.level || 'beginner';
    // Kvota tugagan bo'lsa AI chaqirilmaydi — takrorlash to'xtamasligi kerak
    const aiResult = req.aiCall.quotaExceeded
      ? { status: 'unavailable', reason: 'QUOTA' }
      : await checkSentence(wordDoc.word, sentence, learnerLevel);

    // ── AI javob bermadi → mahalliy tekshiruvga tushamiz ──────────────────
    //
    // Ilgari bu yerda 503 qaytarilib, hech narsa o'zgarmasdi. Takrorlash
    // ixtiyoriy qadam bo'lganda bu to'g'ri edi; endi esa u yagona yo'l, ya'ni
    // Gemini uzilishi butun ilovani to'xtatib qo'yardi.
    const usingFallback = aiResult.status === 'unavailable';
    const result = usingFallback
      ? checkSentenceLocally(wordDoc.word, sentence)
      : aiResult;

    if (usingFallback) {
      await req.aiCall.refund();
    } else {
      req.aiCall.commit();
    }

    // So'z ishlatilmagan bo'lsa — gap grammatik to'g'ri bo'lsa ham mashq bajarilmadi
    const isCorrect = Boolean(result.isCorrect && result.usedTargetWord);

    // Muddati kelmagan so'z — MASHQ: gap tekshiriladi, lekin jadval o'zgarmaydi.
    //
    // Ilgari bu tekshiruv yo'q edi. Xato javobdan keyin "Qayta urinish"
    // bosilsa, so'z 1-bosqichga tushib, o'sha zahoti 2-bosqichga ko'tarilardi;
    // bir so'zni 7 marta ketma-ket yuborib uni "yodlangan" qilish mumkin edi.
    const now = new Date();
    if (!isDue(wordDoc, now)) {
      const stage = readStage(wordDoc);
      return res.json({
        status: 'ok',
        practice: true,
        isCorrect,
        usedTargetWord: Boolean(result.usedTargetWord),
        feedback: result.feedback,
        corrected: result.corrected,
        errorType: result.errorType,
        method: usingFallback ? 'local' : 'ai',
        aiReason: usingFallback ? aiResult.reason : undefined,
        source: source || 'text',
        wordId: wordDoc._id,
        stage,
        maxStage: MAX_STAGE,
        nextReviewDate: wordDoc.nextReviewDate,
        learned: Boolean(wordDoc.learned),
      });
    }

    const next = applySchedule(wordDoc, isCorrect, now, req.user.timezone);
    await wordDoc.save();
    if (next.learned) invalidateUserWords(req.user._id);

    const dailyStep = await recordReview(req.user, now);

    res.json({
      status: 'ok',
      practice: false,
      dailyStep,
      isCorrect,
      usedTargetWord: Boolean(result.usedTargetWord),
      feedback: result.feedback,
      corrected: result.corrected,
      errorType: result.errorType,
      // UI grammatika tekshirilmaganini aytishi kerak
      method: usingFallback ? 'local' : 'ai',
      aiReason: usingFallback ? aiResult.reason : undefined,
      source: source || 'text',
      wordId: wordDoc._id,
      stage: next.stage,
      maxStage: MAX_STAGE,
      intervalDays: next.intervalDays,
      nextReviewDate: next.nextReviewDate,
      learned: next.learned,
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
      const remaining = await Word.countDocuments(dueFilter(user._id, now));
      if (remaining > 0 && (user.dailyQuests.reviewedCount || 0) < DAILY_REVIEW_GOAL) {
        return res.status(409).json({
          message: `Navbatda hali ${remaining} ta so'z bor.`,
          code: 'REVIEW_PENDING',
          remaining,
        });
      }
      const claim = await claimReviewStep(user._id, todayKey);
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
