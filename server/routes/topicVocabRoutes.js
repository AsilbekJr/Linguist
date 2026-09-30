const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const TopicProgress = require('../models/TopicProgress');
const QuizSession = require('../models/QuizSession');
const Word = require('../models/Word');
const { buildActiveItems } = require('../utils/activeWords');
const { protect } = require('../middleware/authMiddleware');
const { validate, topicQuizSubmitSchema, topicFinishSchema } = require('../middleware/validate');
const { topicsCache } = require('../utils/cache');
const { getSavedWordList, invalidateUserWords } = require('../utils/userWordsCache');
const { userDayKey } = require('../utils/dayKey');
const { completeDailyStep, dailyStepMessage } = require('../utils/gamification');
const { buildUserProfile } = require('../utils/userProfile');
const { initialState } = require('../utils/srs');
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
  const wordTarget = getDailyWordTarget(user.onboarding);
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
// @desc    "Sizning so'zlaringiz": foydalanuvchining takrorlashdagi so'zlari
//          bugungi mavzu (yoki kurs) gaplarida — bo'sh joyga qo'yish uchun
// @route   GET /api/topics/active-words
//
// Mashq — SRS jadvaliga tegmaydi. So'zlar ustuvorligi: takrorlashi yaqin
// (nextReviewDate), keyin ko'p unutilgani (lapses). Bugungi sahnaning yangi
// so'zlari chiqarib tashlanadi — ular sahnaning o'zida o'rganiladi.
router.get('/active-words', protect, async (req, res) => {
  try {
    const ctx = await resolveDailyContext(req.user);
    if (ctx.isFinished || !ctx.baseTopic) return res.json({ items: [] });

    const words = await Word.find({
      user: req.user._id,
      learned: { $ne: true },
      translation: { $nin: [null, ''] },
    })
      .select('word translation examples exampleUz nextReviewDate lapses')
      .sort({ nextReviewDate: 1, lapses: -1 })
      .limit(40)
      .lean();

    const exclude = new Set((ctx.baseTopic.words || []).map((w) => String(w.word).toLowerCase()));
    const items = buildActiveItems(words, { dialogue: ctx.baseTopic.dialogue || [], exclude });
    res.json({ items });
  } catch (error) {
    console.error('Active words error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

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
    const { dailyWords } = pickDailySessionWords(ctx.baseTopic.words || [], savedLower, ctx.wordTarget);

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
    }

    // Kun so'zlari lug'atga AVTOMATIK qo'shiladi. Ilgari foydalanuvchi har
    // birini qo'lda saqlashi shart edi ("kamida N ta so'z saqlang") — bu
    // o'rganish emas, ortiqcha bosish edi va sahnani yakunlashni to'sardi.
    const toAdd = dailyWords.filter((w) => !savedLower.includes(w.word.trim().toLowerCase()));
    if (toAdd.length) {
      try {
        await Word.insertMany(
          toAdd.map((w) => ({
            user: req.user._id,
            word: w.word,
            phonetic: w.phonetic,
            definition: w.definition,
            translation: w.translation,
            partOfSpeech: w.partOfSpeech,
            examples: w.example ? [w.example] : [],
            exampleUz: w.exampleUz,
            collocations: w.collocations || [],
            ...initialState(),
            mastered: false,
            reviewStage: 0,
            nextReviewDate: getTopicReviewDate(),
          })),
          { ordered: false }
        );
      } catch (err) {
        // Parallel so'rov shu so'zni allaqachon qo'shgan bo'lsa (unikal indeks) — muammo emas
        const writeErrors = err.writeErrors || [];
        const onlyDuplicates =
          err.code === 11000 || (writeErrors.length > 0 && writeErrors.every((e) => (e.code ?? e.err?.code) === 11000));
        if (!onlyDuplicates) throw err;
      }
    }

    // Bugungi so'zlardan faqat YANGILARI (hali takrorlanmagan) navbatga qo'yiladi.
    //
    // Ilgari bu yerda mos kelgan HAR QANDAY so'z eski maydonlar bo'yicha
    // nollanardi (`reviewStage: 0`, `mastered: false`), lekin hozirgi `stage`
    // va `learned` tegilmasdi. Natija: allaqachon 5-bosqichdagi yoki yodlangan
    // so'z o'ziga zid holatga tushardi (`learned: true`, `mastered: false`).
    const keys = dailyWords.map((w) => w.word.trim().toLowerCase());
    if (keys.length) {
      await Word.updateMany(
        {
          user: req.user._id,
          wordKey: { $in: keys },
          learned: { $ne: true },
          $or: [{ stage: 0 }, { stage: null }, { stage: { $exists: false } }],
        },
        { $set: { nextReviewDate: getTopicReviewDate() } }
      );
    }

    const step = completeDailyStep(req.user, 'topic', ctx.todayKey);

    if (!ctx.isCompleteForToday) {
      ctx.progress.history.push({ day: ctx.progress.currentDay, completedAt: new Date() });
      ctx.progress.currentDay += 1;
      await ctx.progress.save();
    }

    await req.user.save();
    invalidateUserWords(req.user._id);

    const profile = await buildUserProfile(req.user);

    res.json({
      message: dailyStepMessage(step) || 'Kunlik sahna bajarildi!',
      user: profile,
      topicCompleted: true,
      xpAwarded: step.xpAwarded,
      streakUpdated: step.streakUpdated,
      streakFrozen: step.streakFrozen,
      planCompleted: step.planCompleted,
      wordsAdded: toAdd.length,
    });
  } catch (error) {
    console.error('Topic finish error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
