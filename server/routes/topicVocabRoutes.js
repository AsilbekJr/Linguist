const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const TopicProgress = require('../models/TopicProgress');
const QuizSession = require('../models/QuizSession');
const Word = require('../models/Word');
const { protect } = require('../middleware/authMiddleware');
const { validate, topicQuizSubmitSchema, topicFinishSchema } = require('../middleware/validate');
const { topicsCache } = require('../utils/cache');
const { getSavedWordList, invalidateUserWords } = require('../utils/userWordsCache');
const { userDayKey } = require('../utils/dayKey');
const { enrichUserProfile, rollDailyQuests } = require('../utils/gamification');
const {
  getDailyWordTarget,
  resolveTopicDay,
  pickDailySessionWords,
  getScenarioMeta,
  buildBacklog,
  getTopicReviewDate,
  buildDistractorPool,
} = require('../utils/topicHelpers');

const topicsDataPath = path.join(__dirname, '../data/topics.json');
const QUIZ_PASS_PERCENT = 80;

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

const shuffle = (arr) => {
  // Fisher–Yates. Ilgari `sort(() => Math.random() - 0.5)` ishlatilardi —
  // u statistik jihatdan nosimmetrik aralashtiradi.
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const loadSavedWords = (userId) =>
  getSavedWordList(userId, async () => {
    const rows = await Word.find({ user: userId }).select('word -_id').lean();
    return rows.map((w) => w.word.toLowerCase());
  });

/** Foydalanuvchining bugungi kontekstini bir joyda hisoblash */
const resolveDailyContext = async (user) => {
  let progress = await TopicProgress.findOne({ user: user._id });
  if (!progress) {
    progress = await TopicProgress.create({ user: user._id, currentDay: 1, history: [] });
  }

  const topicsList = loadTopicsData();
  const learnerLevel = user.onboarding?.level || 'beginner';
  const wordTarget = getDailyWordTarget(learnerLevel);
  const todayKey = userDayKey(user);

  const latest = progress.history.length ? progress.history[progress.history.length - 1] : null;
  const isCompleteForToday = latest
    ? userDayKey(user, new Date(latest.completedAt)) === todayKey
    : false;

  const logicalDay = isCompleteForToday ? Math.max(1, progress.currentDay - 1) : progress.currentDay;
  const contentDay = resolveTopicDay(logicalDay, topicsList);
  const baseTopic = topicsList.find((t) => t.day === contentDay);

  return {
    progress,
    topicsList,
    learnerLevel,
    wordTarget,
    todayKey,
    isCompleteForToday,
    logicalDay,
    contentDay,
    baseTopic,
    isFinished: progress.currentDay > topicsList.length,
  };
};

// @desc    Bugungi kun paketi
// @route   GET /api/topics/current
router.get('/current', protect, async (req, res) => {
  try {
    const ctx = await resolveDailyContext(req.user);

    if (ctx.isFinished) {
      return res.json({
        message: 'You have completed all topics!',
        isFinished: true,
        history: ctx.progress.history,
      });
    }
    if (!ctx.baseTopic) {
      return res.status(404).json({ error: 'Topic not found for the current day.' });
    }

    const savedLower = await loadSavedWords(req.user._id);
    const { dailyWords, savedCount, requiredCount, totalToday, unsavedRemaining } =
      pickDailySessionWords(ctx.baseTopic.words || [], savedLower, ctx.wordTarget);
    const scenario = getScenarioMeta(ctx.contentDay);
    const backlog = buildBacklog(ctx.topicsList, ctx.contentDay, savedLower);

    // Bugun uchun allaqachon o'tilgan test bormi?
    const quiz = await QuizSession.findOne({
      user: req.user._id,
      dayKey: ctx.todayKey,
      contentDay: ctx.contentDay,
      passed: true,
    }).lean();

    res.json({
      day: ctx.logicalDay,
      contentDay: ctx.contentDay,
      topic: ctx.baseTopic.topic,
      topicUz: ctx.baseTopic.topicUz || ctx.baseTopic.topic,
      description: ctx.baseTopic.description,
      story: ctx.baseTopic.story || scenario.storyUz,
      scenarioEmoji: ctx.baseTopic.scenarioEmoji || scenario.emoji,
      cefr: ctx.baseTopic.cefr,
      grammarFocus: ctx.baseTopic.grammarFocus,
      // Dialog — kunning asosiy kontenti. So'zlar aynan shu suhbatdan chiqadi.
      dialogue: ctx.baseTopic.dialogue || [],
      words: dailyWords,
      wordTarget: ctx.wordTarget,
      requiredCount,
      packSavedCount: savedCount,
      savedFromToday: savedCount,
      totalWordsInTopic: totalToday,
      unsavedRemaining,
      backlogCount: backlog.length,
      isCompleteForToday: ctx.isCompleteForToday,
      quizPassed: Boolean(quiz),
      quizId: quiz?._id?.toString() || null,
      topicQuestCompleted:
        req.user.dailyQuests?.date === ctx.todayKey && req.user.dailyQuests?.topicCompleted,
      isFinished: false,
      history: ctx.progress.history,
      learnerLevel: ctx.learnerLevel,
    });
  } catch (error) {
    console.error('Topic API Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Mini-testni boshlash — savollar SERVERDA yaratiladi
// @route   POST /api/topics/quiz/start
router.post('/quiz/start', protect, async (req, res) => {
  try {
    const ctx = await resolveDailyContext(req.user);
    if (!ctx.baseTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const savedLower = await loadSavedWords(req.user._id);
    const { dailyWords } = pickDailySessionWords(
      ctx.baseTopic.words || [],
      savedLower,
      ctx.wordTarget
    );

    if (!dailyWords.length) {
      return res.status(400).json({ error: "Bugun uchun so'z yo'q", code: 'NO_WORDS' });
    }

    // Chalg'ituvchi variantlar butun kontent bazasidan olinadi.
    // Ilgari ular "Boshqa ma'no" / "Noto'g'ri tarjima" kabi qatorlar edi —
    // foydalanuvchi 3 soniyada shablonni payqab, hech narsa bilmasdan o'tib ketardi.
    const distractorPool = buildDistractorPool(ctx.topicsList, dailyWords);

    const questions = dailyWords.map((w) => {
      const wrong = shuffle(distractorPool.filter((d) => d !== w.translation)).slice(0, 3);
      const options = shuffle([w.translation, ...wrong]);
      return {
        word: w.word,
        options,
        correctIndex: options.indexOf(w.translation),
      };
    });

    const session = await QuizSession.create({
      user: req.user._id,
      contentDay: ctx.contentDay,
      dayKey: ctx.todayKey,
      questions,
    });

    res.json({
      quizId: session._id.toString(),
      passPercent: QUIZ_PASS_PERCENT,
      // correctIndex ATAYLAB yuborilmaydi
      questions: questions.map((q) => ({ word: q.word, options: q.options })),
    });
  } catch (error) {
    console.error('Quiz start error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Javoblarni tekshirish — baholash SERVERDA
// @route   POST /api/topics/quiz/submit
router.post('/quiz/submit', protect, validate(topicQuizSubmitSchema), async (req, res) => {
  try {
    const { quizId, answers } = req.validated.body;

    const session = await QuizSession.findOne({ _id: quizId, user: req.user._id });
    if (!session) {
      return res.status(404).json({ error: 'Test sessiyasi topilmadi yoki muddati tugagan' });
    }
    if (answers.length !== session.questions.length) {
      return res.status(400).json({ error: 'Javoblar soni savollar soniga mos emas' });
    }

    const results = session.questions.map((q, i) => ({
      word: q.word,
      correct: answers[i] === q.correctIndex,
      correctAnswer: q.options[q.correctIndex],
    }));
    const correctCount = results.filter((r) => r.correct).length;
    const score = Math.round((correctCount / results.length) * 100);
    const passed = score >= QUIZ_PASS_PERCENT;

    session.attempts += 1;
    session.score = Math.max(session.score, score);
    if (passed) session.passed = true;
    await session.save();

    res.json({
      passed,
      score,
      correctCount,
      total: results.length,
      passPercent: QUIZ_PASS_PERCENT,
      results, // endi to'g'ri javoblarni ko'rsatish mumkin — test tugadi
      quizId: session._id.toString(),
    });
  } catch (error) {
    console.error('Quiz submit error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    O'tgan kunlardan saqlanmagan so'zlar
// @route   GET /api/topics/backlog
router.get('/backlog', protect, async (req, res) => {
  try {
    const progress = await TopicProgress.findOne({ user: req.user._id });
    if (!progress) return res.json({ words: [], count: 0 });

    const topicsList = loadTopicsData();
    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const contentDay = resolveTopicDay(progress.currentDay, topicsList);
    const savedLower = await loadSavedWords(req.user._id);
    const words = buildBacklog(topicsList, contentDay, savedLower, 20);

    res.json({ words, count: words.length });
  } catch (error) {
    console.error('Topic backlog error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Bugungi kunni yakunlash
// @route   POST /api/topics/finish
router.post('/finish', protect, validate(topicFinishSchema), async (req, res) => {
  try {
    const ctx = await resolveDailyContext(req.user);
    if (!ctx.baseTopic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const savedLower = await loadSavedWords(req.user._id);
    const { dailyWords, savedCount, requiredCount } = pickDailySessionWords(
      ctx.baseTopic.words || [],
      savedLower,
      ctx.wordTarget
    );

    if (dailyWords.length > 0) {
      // Test natijasi SERVERDAN o'qiladi. Ilgari mijoz `quizPassed: true` yuborsa
      // yetardi — ya'ni himoya mijozning o'z qo'lida edi.
      const passedQuiz = await QuizSession.findOne({
        user: req.user._id,
        dayKey: ctx.todayKey,
        contentDay: ctx.contentDay,
        passed: true,
      }).lean();

      if (!passedQuiz) {
        return res.status(400).json({
          error: "Avval mini-testdan o'ting.",
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

    rollDailyQuests(req.user, ctx.todayKey);

    // Bugungi so'zlarni takrorlash navbatiga qo'yish.
    // Ilgari bu har so'z uchun alohida `updateOne` + indekslanmagan RegExp edi (N ta so'rov).
    // Endi bitta `updateMany` + indekslangan `wordKey`.
    const keys = dailyWords.map((w) => w.word.trim().toLowerCase());
    if (keys.length) {
      await Word.updateMany(
        { user: req.user._id, wordKey: { $in: keys } },
        {
          $set: {
            nextReviewDate: getTopicReviewDate(),
            mastered: false,
            reviewStage: 0,
            repetitions: 0,
            intervalDays: 0,
          },
        }
      );
    }

    if (!req.user.dailyQuests.topicCompleted) {
      req.user.xp += 15;
    }
    req.user.dailyQuests.topicCompleted = true;

    if (!ctx.isCompleteForToday) {
      ctx.progress.history.push({ day: ctx.progress.currentDay, completedAt: new Date() });
      ctx.progress.currentDay += 1;
      await ctx.progress.save();
    }

    await req.user.save();
    invalidateUserWords(req.user._id);

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

module.exports = router;
