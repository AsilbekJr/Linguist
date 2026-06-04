const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { protect } = require('../middleware/authMiddleware');
const { validate, practicePromptSchema, practiceCheckSchema } = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');
const { generatePracticePrompt, checkPracticeSentence } = require('../services/geminiService');
const {
  bucketWordsByDay,
  buildPracticeRounds,
  formatWordForClient,
} = require('../utils/practiceHelpers');

// @desc    Practice session — words grouped by today / yesterday / older
// @route   GET /api/practice/session
router.get('/session', protect, async (req, res) => {
  try {
    const words = await Word.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    if (!words.length) {
      return res.json({
        rounds: [],
        stats: { today: 0, yesterday: 0, older: 0, total: 0 },
        message: "Avval yangi so'z o'rganing.",
      });
    }

    const buckets = bucketWordsByDay(words);
    const rounds = buildPracticeRounds(buckets).map((r, index) => ({
      roundIndex: index,
      bucket: r.bucket,
      bucketLabel: r.bucketLabel,
      words: r.words.map(formatWordForClient),
    }));

    res.json({
      rounds,
      stats: {
        today: buckets.today.length,
        yesterday: buckets.yesterday.length,
        older: buckets.older.length,
        total: words.length,
      },
      method: 'active_recall_writing',
    });
  } catch (error) {
    console.error('Practice session error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    AI situational prompt for a practice round
// @route   POST /api/practice/prompt
router.post('/prompt', protect, validate(practicePromptSchema), trackAiUsage, async (req, res) => {
  try {
    const { wordIds, bucketLabel } = req.validated.body;
    const words = await Word.find({
      _id: { $in: wordIds },
      user: req.user._id,
    }).lean();

    if (!words.length) {
      return res.status(404).json({ message: "So'zlar topilmadi" });
    }

    const level = req.user.onboarding?.level || 'beginner';
    const prompt = await generatePracticePrompt(
      words.map(formatWordForClient),
      bucketLabel || "Yodlangan so'zlar",
      level
    );

    res.json(prompt);
  } catch (error) {
    console.error('Practice prompt error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Check learner sentence using target vocabulary (AI)
// @route   POST /api/practice/check
router.post('/check', protect, validate(practiceCheckSchema), trackAiUsage, async (req, res) => {
  try {
    const { wordIds, sentence } = req.validated.body;
    const words = await Word.find({
      _id: { $in: wordIds },
      user: req.user._id,
    }).lean();

    if (!words.length) {
      return res.status(404).json({ message: "So'zlar topilmadi" });
    }

    const level = req.user.onboarding?.level || 'beginner';
    const result = await checkPracticeSentence(
      words.map(formatWordForClient),
      sentence,
      level
    );

    res.json(result);
  } catch (error) {
    console.error('Practice check error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
