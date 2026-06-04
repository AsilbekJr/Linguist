const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const TopicProgress = require('../models/TopicProgress');
const Word = require('../models/Word');
const { protect } = require('../middleware/authMiddleware');
const { topicsCache } = require('../utils/cache');
const {
  getDailyWordTarget,
  resolveTopicDay,
  pickDailySessionWords,
  getScenarioMeta,
  buildBacklog,
  getTopicReviewDate,
} = require('../utils/topicHelpers');

const topicsDataPath = path.join(__dirname, '../data/topics.json');

const loadTopicsData = () => {
  const stat = fs.statSync(topicsDataPath);
  if (topicsCache.data && topicsCache.mtime === stat.mtimeMs) {
    return topicsCache.data;
  }
  const data = JSON.parse(fs.readFileSync(topicsDataPath, 'utf8'));
  topicsCache.data = data;
  topicsCache.mtime = stat.mtimeMs;
  topicsCache.loadedAt = Date.now();
  return data;
};

// @desc    Bugungi kun paketi — faqat shu kun so'zlari, darajaga mos son
// @route   GET /api/topics/current
router.get('/current', protect, async (req, res) => {
  try {
    let progress = await TopicProgress.findOne({ user: req.user._id });

    if (!progress) {
      progress = new TopicProgress({
        user: req.user._id,
        currentDay: 1,
        history: [],
      });
      await progress.save();
    }

    const { currentDay, history } = progress;
    const topicsList = loadTopicsData();
    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const wordTarget = getDailyWordTarget(learnerLevel);

    if (currentDay > topicsList.length) {
      return res.json({
        message: 'You have completed all topics!',
        isFinished: true,
        history,
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const latestComplete = history.length > 0 ? history[history.length - 1] : null;
    let isCompleteForToday = false;

    if (latestComplete) {
      const latestDateStr = new Date(latestComplete.completedAt).toISOString().split('T')[0];
      if (latestDateStr === todayStr) {
        isCompleteForToday = true;
      }
    }

    const logicalDay = isCompleteForToday ? Math.max(1, currentDay - 1) : currentDay;
    const contentDay = resolveTopicDay(logicalDay, learnerLevel);

    const baseTopic = topicsList.find((t) => t.day === contentDay);
    if (!baseTopic) {
      return res.status(404).json({ error: 'Topic not found for the current day.' });
    }

    const userSavedWords = await Word.find({ user: req.user._id }).select('word -_id').lean();
    const savedLower = userSavedWords.map((w) => w.word.toLowerCase());

    const todayAllWords = baseTopic.words || [];
    const { dailyWords, savedCount, requiredCount, totalToday, unsavedRemaining } =
      pickDailySessionWords(todayAllWords, savedLower, wordTarget);
    const scenario = getScenarioMeta(contentDay);
    const backlog = buildBacklog(topicsList, contentDay, savedLower);

    res.json({
      day: logicalDay,
      contentDay,
      topic: baseTopic.topic,
      topicUz: baseTopic.topicUz || baseTopic.topic,
      description: baseTopic.description,
      story: baseTopic.story || scenario.storyUz,
      scenarioEmoji: baseTopic.scenarioEmoji || scenario.emoji,
      words: dailyWords,
      wordTarget,
      requiredCount,
      packSavedCount: savedCount,
      savedFromToday: savedCount,
      totalWordsInTopic: totalToday,
      unsavedRemaining,
      backlogCount: backlog.length,
      isCompleteForToday,
      topicQuestCompleted:
        req.user.dailyQuests?.date === todayStr && req.user.dailyQuests?.topicCompleted,
      isFinished: false,
      history,
      learnerLevel,
    });
  } catch (error) {
    console.error('Topic API Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    O'tgan kunlardan saqlanmagan so'zlar (ixtiyoriy)
// @route   GET /api/topics/backlog
router.get('/backlog', protect, async (req, res) => {
  try {
    const progress = await TopicProgress.findOne({ user: req.user._id });
    if (!progress) {
      return res.json({ words: [], count: 0 });
    }

    const topicsList = loadTopicsData();
    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const contentDay = resolveTopicDay(progress.currentDay, learnerLevel);
    const userSavedWords = await Word.find({ user: req.user._id }).select('word -_id').lean();
    const savedLower = userSavedWords.map((w) => w.word.toLowerCase());
    const words = buildBacklog(topicsList, contentDay, savedLower, 20);

    res.json({ words, count: words.length });
  } catch (error) {
    console.error('Topic backlog error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Bugungi sahni yakunlash — saqlangan so'zlar + quest + kun yopish
// @route   POST /api/topics/finish
router.post('/finish', protect, async (req, res) => {
  try {
    const { quizPassed } = req.body || {};
    const progress = await TopicProgress.findOne({ user: req.user._id });
    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    const topicsList = loadTopicsData();
    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const wordTarget = getDailyWordTarget(learnerLevel);
    const todayStr = new Date().toISOString().split('T')[0];

    const latestComplete = progress.history.length > 0 ? progress.history[progress.history.length - 1] : null;
    const alreadyCompletedDay =
      latestComplete &&
      new Date(latestComplete.completedAt).toISOString().split('T')[0] === todayStr;

    const logicalDay = alreadyCompletedDay ? Math.max(1, progress.currentDay - 1) : progress.currentDay;
    const contentDay = resolveTopicDay(logicalDay, learnerLevel);
    const baseTopic = topicsList.find((t) => t.day === contentDay);

    if (!baseTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const userSavedWords = await Word.find({ user: req.user._id }).select('word -_id').lean();
    const savedLower = userSavedWords.map((w) => w.word.toLowerCase());
    const todayWords = baseTopic.words || [];
    const { dailyWords, savedCount, requiredCount } = pickDailySessionWords(
      todayWords,
      savedLower,
      wordTarget
    );

    if (dailyWords.length > 0) {
      if (!quizPassed) {
        return res.status(400).json({
          error: 'Avval mini-testdan o\'ting.',
          code: 'QUIZ_REQUIRED',
        });
      }
      if (savedCount < requiredCount) {
        return res.status(400).json({
          error: `Kamida ${requiredCount} ta so'z saqlang (hozir: ${savedCount}).`,
          code: 'WORDS_REQUIRED',
          required: requiredCount,
          current: savedCount,
        });
      }
    }

    if (req.user.dailyQuests.date !== todayStr) {
      req.user.dailyQuests = {
        date: todayStr,
        reviewCompleted: false,
        topicCompleted: false,
        immersionCompleted: false,
      };
    }
    const reviewNow = getTopicReviewDate();
    for (const dw of dailyWords) {
      await Word.updateOne(
        { user: req.user._id, word: new RegExp(`^${dw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { $set: { nextReviewDate: reviewNow, mastered: false, reviewStage: 0 } }
      );
    }

    if (!req.user.dailyQuests.topicCompleted) {
      req.user.xp += 15;
    }
    req.user.dailyQuests.topicCompleted = true;

    if (!alreadyCompletedDay) {
      progress.history.push({ day: progress.currentDay, completedAt: new Date() });
      progress.currentDay += 1;
      await progress.save();
    }

    await req.user.save();

    const { enrichUserProfile } = require('../utils/gamification');
    const profile = enrichUserProfile(req.user, {
      totalWords: await Word.countDocuments({ user: req.user._id }),
    });

    res.json({
      message: 'Kunlik sahna bajarildi!',
      user: profile,
      topicCompleted: true,
    });
  } catch (error) {
    console.error('Topic finish error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Complete current day (legacy)
// @route   POST /api/topics/complete
router.post('/complete', protect, async (req, res) => {
  try {
    const progress = await TopicProgress.findOne({ user: req.user._id });

    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const latestComplete = progress.history.length > 0 ? progress.history[progress.history.length - 1] : null;
    if (latestComplete) {
      const latestDateStr = new Date(latestComplete.completedAt).toISOString().split('T')[0];
      if (latestDateStr === todayStr) {
        return res.json({ message: 'Today already completed', currentDay: progress.currentDay });
      }
    }

    progress.history.push({ day: progress.currentDay, completedAt: new Date() });
    progress.currentDay += 1;
    await progress.save();

    res.json({ message: 'Topic marked as complete!', currentDay: progress.currentDay });
  } catch (error) {
    console.error('Topic API Error (Complete):', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
