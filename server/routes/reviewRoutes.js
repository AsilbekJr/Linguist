const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { checkSentence } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, reviewCheckSchema, reviewGradeSchema } = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');
const { applySchedule, previewIntervals, gradeFromBoolean, isValidGrade } = require('../utils/srs');

const DUE_LIMIT = 20;

// @desc    Takrorlash navbati
// @route   GET /api/review/due
router.get('/due', protect, async (req, res) => {
  try {
    const now = new Date();

    const dueWords = await Word.find({
      user: req.user._id,
      $or: [
        { nextReviewDate: { $lte: now } },
        { nextReviewDate: { $exists: false } },
        { nextReviewDate: null },
      ],
    })
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

// @desc    Takrorlash statistikasi (bugun nechta kutmoqda, ertaga nechta)
// @route   GET /api/review/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const [due, upcoming, total, struggling] = await Promise.all([
      Word.countDocuments({
        user: req.user._id,
        $or: [{ nextReviewDate: { $lte: now } }, { nextReviewDate: null }],
      }),
      Word.countDocuments({
        user: req.user._id,
        nextReviewDate: { $gt: now, $lte: tomorrow },
      }),
      Word.countDocuments({ user: req.user._id }),
      Word.countDocuments({ user: req.user._id, lapses: { $gte: 3 } }),
    ]);

    res.json({ due, upcoming, total, struggling });
  } catch (error) {
    console.error('Review stats error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    AI bilan gapni tekshirish va SRS'ni yangilash
// @route   POST /api/review/:id/check
router.post('/:id/check', protect, validate(reviewCheckSchema), trackAiUsage, async (req, res) => {
  const { sentence } = req.validated.body;
  const wordId = req.validated.params.id;

  try {
    const wordDoc = await Word.findOne({ _id: wordId, user: req.user._id });
    if (!wordDoc) {
      await req.aiCall.refund();
      return res.status(404).json({ message: 'Word not found' });
    }

    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const result = await checkSentence(wordDoc.word, sentence, learnerLevel);

    // ── AI javob bermadi ──────────────────────────────────────────────────
    // MUHIM: bu holatda SRS'ga UMUMAN tegmaymiz. Ilgari bu yerda `isCorrect:false`
    // yozilib, foydalanuvchining to'g'ri gapi xato deb belgilanar va takrorlash
    // pog'onasi pasayardi. Ya'ni Gemini'ning uzilishi foydalanuvchi progressini
    // buzardi. Endi hech narsa o'zgarmaydi va limit ham qaytariladi.
    if (result.status === 'unavailable') {
      await req.aiCall.refund();
      return res.status(503).json({
        status: 'unavailable',
        code: result.reason,
        message:
          result.reason === 'QUOTA_EXCEEDED'
            ? "AI limiti tugadi. Biroz kutib qayta urinib ko'ring — takrorlash holatingiz saqlanib qoldi."
            : "AI hozir javob bera olmadi. Takrorlash holatingiz o'zgarmadi, qayta urinib ko'ring.",
        srsUnchanged: true,
      });
    }

    req.aiCall.commit();

    // So'z ishlatilmagan bo'lsa — to'g'ri gap bo'lsa ham mashq bajarilmadi
    const grade = result.isCorrect && result.usedTargetWord ? 2 /* GOOD */ : 0 /* AGAIN */;
    const next = applySchedule(wordDoc, grade);
    await wordDoc.save();

    res.json({
      status: 'ok',
      isCorrect: result.isCorrect,
      usedTargetWord: result.usedTargetWord,
      feedback: result.feedback,
      corrected: result.corrected,
      errorType: result.errorType,
      wordId: wordDoc._id,
      nextReviewDate: next.nextReviewDate,
      intervalDays: next.intervalDays,
      mastered: wordDoc.mastered,
    });
  } catch (error) {
    console.error('Review Check Error:', error);
    await req.aiCall?.refund();
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    AI'siz baholash — flashcard va quiz rejimlari
// @route   POST /api/review/:id/grade
// @body    { grade: 0..3 }  yoki eski mijozlar uchun { known: boolean }
router.post('/:id/grade', protect, validate(reviewGradeSchema), async (req, res) => {
  try {
    const { grade, known } = req.validated.body;
    const resolvedGrade = isValidGrade(grade) ? grade : gradeFromBoolean(known);

    const wordDoc = await Word.findOne({ _id: req.validated.params.id, user: req.user._id });
    if (!wordDoc) {
      return res.status(404).json({ message: 'Word not found' });
    }

    const next = applySchedule(wordDoc, resolvedGrade);
    await wordDoc.save();

    res.json({
      status: 'ok',
      grade: resolvedGrade,
      wordId: wordDoc._id,
      nextReviewDate: next.nextReviewDate,
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor,
      lapses: next.lapses,
      mastered: wordDoc.mastered,
    });
  } catch (error) {
    console.error('Review grade error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Eski mijoz yo'li — /quick { known: boolean }
router.post('/:id/quick', protect, validate(reviewGradeSchema), async (req, res) => {
  try {
    const { known, grade } = req.validated.body;
    const resolvedGrade = isValidGrade(grade) ? grade : gradeFromBoolean(known);

    const wordDoc = await Word.findOne({ _id: req.validated.params.id, user: req.user._id });
    if (!wordDoc) {
      return res.status(404).json({ message: 'Word not found' });
    }

    const next = applySchedule(wordDoc, resolvedGrade);
    await wordDoc.save();

    res.json({
      isCorrect: resolvedGrade > 0,
      wordId: wordDoc._id,
      nextReviewDate: next.nextReviewDate,
      intervalDays: next.intervalDays,
      mastered: wordDoc.mastered,
    });
  } catch (error) {
    console.error('Quick review error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Har bir tugma qaysi intervalni beradi (UI'da ko'rsatish uchun)
// @route   GET /api/review/:id/preview
router.get('/:id/preview', protect, async (req, res) => {
  try {
    const wordDoc = await Word.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!wordDoc) return res.status(404).json({ message: 'Word not found' });
    res.json(previewIntervals(wordDoc));
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
