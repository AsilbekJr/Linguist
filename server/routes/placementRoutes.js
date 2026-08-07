const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PlacementSession = require('../models/PlacementSession');
const TopicProgress = require('../models/TopicProgress');
const Word = require('../models/Word');
const { protect } = require('../middleware/authMiddleware');
const { validate, placementAnswerSchema } = require('../middleware/validate');
const { topicsCache } = require('../utils/cache');
const { getStartDayForLevel } = require('../utils/topicHelpers');
const { enrichUserProfile } = require('../utils/gamification');
const {
  itemsByLevel,
  getItemById,
  nextStep,
  cefrToLearnerLevel,
  QUESTIONS_PER_LEVEL,
} = require('../content/placement');

const topicsDataPath = path.join(__dirname, '../data/topics.json');

const loadTopicsData = () => {
  const stat = fs.statSync(topicsDataPath);
  if (topicsCache.data && topicsCache.mtime === stat.mtimeMs) return topicsCache.data;
  const data = JSON.parse(fs.readFileSync(topicsDataPath, 'utf8'));
  topicsCache.data = data;
  topicsCache.mtime = stat.mtimeMs;
  return data;
};

/** Shu darajada hali berilmagan savollardan tasodifiy bittasi */
const pickItem = (cefr, usedIds) => {
  const pool = itemsByLevel(cefr).filter((i) => !usedIds.has(i.id));
  if (!pool.length) return null;
  return pool[crypto.randomInt(pool.length)];
};

/** Savolni mijozga xavfsiz shaklda berish — to'g'ri javob YUBORILMAYDI */
const publicItem = (item, session) => ({
  itemId: item.id,
  cefr: item.cefr,
  skill: item.skill,
  prompt: item.prompt,
  options: item.options,
  answered: session.answers.length,
  // Umumiy uzunlik oldindan noma'lum (adaptiv), taxminiy ko'rsatkich beramiz
  maxQuestions: QUESTIONS_PER_LEVEL * 4,
});

// @desc    Testni boshlash
// @route   POST /api/placement/start
router.post('/start', protect, async (req, res) => {
  try {
    // Tugallanmagan sessiyalarni tozalaymiz — bir vaqtda bitta test
    await PlacementSession.deleteMany({ user: req.user._id, completed: false });

    const session = await PlacementSession.create({ user: req.user._id, answers: [] });

    const step = nextStep([]);
    const item = pickItem(step.nextLevel, new Set());
    session.pendingItemId = item.id;
    await session.save();

    res.json({
      sessionId: session._id.toString(),
      question: publicItem(item, session),
    });
  } catch (error) {
    console.error('Placement start error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Javob berish va keyingi savolni olish
// @route   POST /api/placement/answer
router.post('/answer', protect, validate(placementAnswerSchema), async (req, res) => {
  try {
    const { sessionId, itemId, answered } = req.validated.body;

    const session = await PlacementSession.findOne({ _id: sessionId, user: req.user._id });
    if (!session) {
      return res.status(404).json({ error: 'Test sessiyasi topilmadi yoki muddati tugagan' });
    }
    if (session.completed) {
      return res.status(400).json({ error: 'Test allaqachon yakunlangan', code: 'ALREADY_DONE' });
    }
    // Faqat kutilayotgan savolga javob qabul qilinadi — aks holda mijoz
    // o'ziga qulay savolni tanlab, natijani ko'tarib olardi
    if (session.pendingItemId !== itemId) {
      return res.status(400).json({ error: 'Kutilmagan savol', code: 'UNEXPECTED_ITEM' });
    }

    const item = getItemById(itemId);
    if (!item) {
      return res.status(400).json({ error: 'Savol topilmadi' });
    }

    session.answers.push({
      itemId: item.id,
      cefr: item.cefr,
      answered,
      correct: answered === item.correct,
    });

    const step = nextStep(session.answers.map((a) => ({ cefr: a.cefr, correct: a.correct })));

    if (!step.done) {
      const usedIds = new Set(session.answers.map((a) => a.itemId));
      const nextItem = pickItem(step.nextLevel, usedIds);

      if (nextItem) {
        session.pendingItemId = nextItem.id;
        await session.save();
        return res.json({
          done: false,
          wasCorrect: answered === item.correct,
          question: publicItem(nextItem, session),
        });
      }
      // Bankda savol qolmadi — shu darajada yakunlaymiz
    }

    // ── Yakunlash ────────────────────────────────────────────────────────
    const resultCefr = step.level || step.nextLevel || 'A1';
    const learnerLevel = cefrToLearnerLevel(resultCefr);

    session.completed = true;
    session.resultCefr = resultCefr;
    session.pendingItemId = null;
    await session.save();

    // Darajani profilga yozamiz.
    // `completed` ATAYLAB tegilmaydi: placement darajani O'LCHAYDI, onboarding
    // esa maqsad va rejani so'rab yakunlaydi. Ikkalasini birlashtirish
    // onboarding'ning qolgan savollarini o'tkazib yuborardi.
    req.user.onboarding = {
      ...(req.user.onboarding?.toObject?.() || req.user.onboarding || {}),
      level: learnerLevel,
      placedCefr: resultCefr,
    };
    await req.user.save();

    // Kursning boshlanish kunini darajaga moslaymiz.
    // Busiz B1 darajali foydalanuvchi ham 1-kundan ("Tanishuv", A1) boshlardi.
    const topicsList = loadTopicsData();
    const startDay = getStartDayForLevel(topicsList, learnerLevel);
    let progress = await TopicProgress.findOne({ user: req.user._id });
    if (!progress) {
      progress = await TopicProgress.create({
        user: req.user._id,
        currentDay: startDay,
        history: [],
      });
    } else if (progress.history.length === 0) {
      // Faqat hali boshlamagan foydalanuvchining boshlanishini siljitamiz —
      // aks holda qayta test topshirish progressni o'chirib yuborardi
      progress.currentDay = startDay;
      await progress.save();
    }

    const correctCount = session.answers.filter((a) => a.correct).length;
    const startTopic = topicsList.find((t) => t.day === progress.currentDay);

    res.json({
      done: true,
      wasCorrect: answered === item.correct,
      resultCefr,
      learnerLevel,
      correctCount,
      totalQuestions: session.answers.length,
      startDay: progress.currentDay,
      startTopic: startTopic ? { day: startTopic.day, topicUz: startTopic.topicUz, cefr: startTopic.cefr } : null,
      user: enrichUserProfile(req.user, {
        totalWords: await Word.countDocuments({ user: req.user._id }),
      }),
    });
  } catch (error) {
    console.error('Placement answer error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Oxirgi natija
// @route   GET /api/placement/result
router.get('/result', protect, async (req, res) => {
  try {
    const session = await PlacementSession.findOne({
      user: req.user._id,
      completed: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      hasResult: Boolean(session),
      resultCefr: session?.resultCefr || null,
      placedCefr: req.user.onboarding?.placedCefr || null,
      learnerLevel: req.user.onboarding?.level || null,
    });
  } catch (error) {
    console.error('Placement result error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
