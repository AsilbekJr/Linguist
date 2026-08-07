const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const TopicProgress = require('../models/TopicProgress');
const Word = require('../models/Word');
const { protect } = require('../middleware/authMiddleware');
const { validate, listeningCheckSchema } = require('../middleware/validate');
const { topicsCache } = require('../utils/cache');
const { userDayKey } = require('../utils/dayKey');
const { resolveTopicDay } = require('../utils/topicHelpers');
const { scoreDictation, dictationFeedback } = require('../utils/dictation');
const { enrichUserProfile, rollDailyQuests } = require('../utils/gamification');

const topicsDataPath = path.join(__dirname, '../data/topics.json');

const loadTopicsData = () => {
  const stat = fs.statSync(topicsDataPath);
  if (topicsCache.data && topicsCache.mtime === stat.mtimeMs) return topicsCache.data;
  const data = JSON.parse(fs.readFileSync(topicsDataPath, 'utf8'));
  topicsCache.data = data;
  topicsCache.mtime = stat.mtimeMs;
  return data;
};

/** Diktant uchun juda qisqa qatorlarni tashlab yuboramiz — ular mashq bermaydi */
const MIN_WORDS = 4;
const MAX_LINES = 5;

const resolveTodayTopic = async (user) => {
  let progress = await TopicProgress.findOne({ user: user._id });
  if (!progress) {
    progress = await TopicProgress.create({ user: user._id, currentDay: 1, history: [] });
  }

  const topicsList = loadTopicsData();
  const learnerLevel = user.onboarding?.level || 'beginner';
  const todayKey = userDayKey(user);

  const latest = progress.history.length ? progress.history[progress.history.length - 1] : null;
  const isCompleteForToday = latest
    ? userDayKey(user, new Date(latest.completedAt)) === todayKey
    : false;

  const logicalDay = isCompleteForToday
    ? Math.max(1, progress.currentDay - 1)
    : progress.currentDay;
  const contentDay = resolveTopicDay(logicalDay, topicsList);

  return {
    topic: topicsList.find((t) => t.day === contentDay),
    contentDay,
    todayKey,
    isFinished: progress.currentDay > topicsList.length,
  };
};

// @desc    Bugungi tinglash mashqi
// @route   GET /api/listening/session
router.get('/session', protect, async (req, res) => {
  try {
    const { topic, contentDay, todayKey, isFinished } = await resolveTodayTopic(req.user);

    if (isFinished || !topic) {
      return res.json({ lines: [], isFinished: true });
    }

    const lines = (topic.dialogue || [])
      .map((line, index) => ({ ...line, index }))
      .filter((line) => line.en.split(/\s+/).length >= MIN_WORDS)
      .slice(0, MAX_LINES);

    res.json({
      contentDay,
      topic: topic.topic,
      topicUz: topic.topicUz,
      cefr: topic.cefr,
      // Matn mijozga yuboriladi, chunki ovoz brauzerning speechSynthesis'i
      // bilan chiqariladi — bu tashqi TTS xizmatisiz yagona yo'l.
      // Bu mashq hech narsani ochmaydi (kunni yopmaydi), shuning uchun
      // "aldash" faqat aldayotgan odamning o'ziga zarar qiladi.
      // Baholash baribir serverda — natija bir xil hisoblanishi uchun.
      lines: lines.map((l) => ({ index: l.index, speaker: l.speaker, en: l.en, uz: l.uz })),
      total: lines.length,
      listeningCompleted:
        req.user.dailyQuests?.date === todayKey && req.user.dailyQuests?.listeningCompleted,
    });
  } catch (error) {
    console.error('Listening session error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Diktantni tekshirish
// @route   POST /api/listening/check
router.post('/check', protect, validate(listeningCheckSchema), async (req, res) => {
  try {
    const { lineIndex, typed } = req.validated.body;
    const { topic } = await resolveTodayTopic(req.user);

    const line = topic?.dialogue?.[lineIndex];
    if (!line) {
      return res.status(404).json({ error: 'Qator topilmadi' });
    }

    const result = scoreDictation(line.en, typed);
    res.json({
      ...result,
      feedback: dictationFeedback(result),
      expected: line.en,
      uz: line.uz,
    });
  } catch (error) {
    console.error('Listening check error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Tinglash mashqini yakunlash
// @route   POST /api/listening/complete
router.post('/complete', protect, async (req, res) => {
  try {
    const todayKey = userDayKey(req.user);
    rollDailyQuests(req.user, todayKey);

    let xpAwarded = 0;
    if (!req.user.dailyQuests.listeningCompleted) {
      xpAwarded = 10;
      req.user.xp += xpAwarded;
      req.user.dailyQuests.listeningCompleted = true;
    }
    await req.user.save();

    const profile = enrichUserProfile(req.user, {
      totalWords: await Word.countDocuments({ user: req.user._id }),
    });

    res.json({
      message: xpAwarded ? `Tinglash mashqi bajarildi! +${xpAwarded} XP` : 'Allaqachon bajarilgan',
      xpAwarded,
      user: profile,
    });
  } catch (error) {
    console.error('Listening complete error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
