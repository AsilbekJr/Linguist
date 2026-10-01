const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const { protect } = require('../middleware/authMiddleware');
const { validate, speakTurnSchema } = require('../middleware/validate');
const { resolveDailyContext } = require('../utils/dailyContext');
const { pickDailySessionWords, pickKeyLines } = require('../utils/topicHelpers');
const { completeDailyStep, dailyStepMessage, isPlanComplete } = require('../utils/gamification');
const { buildUserProfile } = require('../utils/userProfile');
const { containsWord } = require('../content/schema');
const gemini = require('../services/geminiService');

/**
 * Suhbat — kunlik rejaning ikkinchi qadami (Sahna → Suhbat → Takrorlash).
 *
 * Foydalanuvchi bugungi sahnadagi qahramon bilan gaplashadi: dorixonada —
 * farmatsevt bilan, aeroportda — xodim bilan. Sahna yodlangan matn edi,
 * Suhbat esa o'sha so'zlarni JONLI vaziyatda ishlatish.
 *
 * Bugungi so'z ishlatilganini AI emas, server o'zi aniqlaydi (`containsWord`):
 * bu tez, bepul va qahramon nima deyishidan qat'i nazar bir xil ishlaydi.
 */

/** Rejaga hisoblanishi uchun kamida shuncha replika */
const MIN_USER_TURNS = 4;
/** Bitta suhbatda ko'pi bilan — AI xarajati va vaqt chegarasi */
const MAX_USER_TURNS = 10;
/** Bugungi so'zlardan nechtasini ishlatish topshirig'i */
const WORDS_TO_USE = 3;
/** Bepul tarifda kuniga suhbatlar soni (Pro — amalda cheksiz, suiiste'moldan himoya bilan) */
const DAILY_LIMIT = { free: 1, pro: 20, premium: 20 };
/** Bir replika uchun hisoblanadigan maksimal gapirish vaqti */
const MAX_SECONDS_PER_TURN = 60;

const SCRIPT_END = {
  text: 'Thank you for talking with me! Have a nice day.',
  textUz: "Suhbat uchun rahmat! Kuningiz yaxshi o'tsin.",
};

/**
 * Sahna dialogi qisqa (1-kunda qahramonning 3-4 qatori). Qatorlar tugab,
 * talaba hali kerakli sondagi javobni bermagan bo'lsa — qahramon suhbatni
 * davom ettiruvchi umumiy savollar beradi. Ilgari u xayrlashuv gapini
 * qayta-qayta takrorlardi.
 */
const SCRIPT_FOLLOW_UPS = [
  { text: 'That is interesting! Can you tell me more?', textUz: "Qiziq ekan! Batafsilroq aytib bera olasizmi?" },
  { text: 'Why do you think so?', textUz: "Nega shunday deb o'ylaysiz?" },
  { text: 'And what about you? What do you usually do?', textUz: 'Sizchi? Odatda nima qilasiz?' },
  { text: 'Is there anything else you want to ask me?', textUz: "Mendan yana nimadir so'ramoqchimisiz?" },
];

/** Sahna dialogi: birinchi gapiruvchi — talaba roli, undan boshqasi — qahramon */
const splitRoles = (dialogue = []) => {
  const learner = dialogue[0]?.speaker || '';
  const partner = dialogue.find((l) => l.speaker && l.speaker !== learner)?.speaker || 'Friend';
  return {
    partner,
    partnerLines: dialogue.filter((l) => l.speaker === partner),
    learnerLines: dialogue.filter((l) => l.speaker !== partner),
  };
};

/** Ko'p so'zli iboralar (`look after`, `don't`) — oddiy kirish tekshiruvi */
const usesWord = (text, word) => {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return false;
  if (/[\s'-]/.test(w)) return String(text).toLowerCase().includes(w);
  return containsWord(text, w);
};

const { loadTopicsData } = require('../utils/dailyContext');

/** Talaba sahnada yodlagan iboralar (o'z rolidagi kalit gaplar) */
const memorizedPhrases = (conv) => {
  const topic = loadTopicsData().find((t) => t.day === conv.contentDay);
  if (!topic) return [];
  const { partner } = splitRoles(topic.dialogue);
  return pickKeyLines(topic.dialogue || [], conv.targetWords)
    .filter((l) => l.speaker !== partner)
    .map((l) => l.en);
};

const brief = (conv) => ({
  topic: conv.topicUz,
  situationUz: conv.situationUz,
  partnerName: conv.partner.name,
  cefr: conv.cefr,
  targetWords: conv.targetWords,
  // Qahramon shu iboralarni ishlatishga imkon beradigan savollar bersin
  phrases: memorizedPhrases(conv),
});

const userTurnCount = (conv) => conv.turns.filter((t) => t.role === 'user').length;

const wordsGoal = (conv) => Math.min(WORDS_TO_USE, conv.targetWords.length);

/** Mijozga yuboriladigan holat */
const serialize = (conv) => {
  const userTurns = userTurnCount(conv);
  return {
    id: String(conv._id),
    mode: conv.mode,
    status: conv.status,
    partner: conv.partner,
    topicUz: conv.topicUz,
    situationUz: conv.situationUz,
    targetWords: conv.targetWords.map((w) => ({ word: w.word, translation: w.translation, used: w.used })),
    wordsGoal: wordsGoal(conv),
    wordsUsed: conv.targetWords.filter((w) => w.used).length,
    goals: conv.goals.map((g) => ({ id: g.id, textUz: g.textUz, done: g.done })),
    turns: conv.turns.map((t) => ({ role: t.role, text: t.text, textUz: t.textUz, via: t.via })),
    userTurns,
    minTurns: MIN_USER_TURNS,
    maxTurns: MAX_USER_TURNS,
    canFinish: conv.status === 'active' && userTurns >= MIN_USER_TURNS,
    spokenSeconds: Math.round(conv.spokenSeconds || 0),
    feedback: conv.status === 'completed' ? conv.feedback : null,
  };
};

/** Bugungi sahna va Suhbat uchun kerakli hamma narsa */
const loadToday = async (user) => {
  const ctx = await resolveDailyContext(user);
  const quests = user.dailyQuests?.date === ctx.todayKey ? user.dailyQuests : {};
  return { ctx, quests, sceneDone: Boolean(quests.topicCompleted) };
};

const previewFor = (ctx) => {
  const topic = ctx.baseTopic;
  if (!topic) return null;
  const { partner } = splitRoles(topic.dialogue);
  const { dailyWords } = pickDailySessionWords(topic.words || [], [], ctx.wordTarget);
  return {
    partner: { name: partner, emoji: topic.scenarioEmoji || '💬' },
    topicUz: topic.topicUz || topic.topic,
    situationUz: topic.story || topic.description || '',
    targetWords: dailyWords.slice(0, 6).map((w) => ({ word: w.word, translation: w.translation })),
  };
};

const dailyLimitFor = (user) => DAILY_LIMIT[user.getEffectivePlan?.() || 'free'] ?? DAILY_LIMIT.free;

// @desc    Bugungi Suhbat holati
// @route   GET /api/speak/today
router.get('/today', protect, async (req, res) => {
  try {
    const { ctx, quests, sceneDone } = await loadToday(req.user);
    const [latest, startedToday, previous] = await Promise.all([
      Conversation.findOne({ user: req.user._id, dayKey: ctx.todayKey }).sort({ createdAt: -1 }),
      Conversation.countDocuments({ user: req.user._id, dayKey: ctx.todayKey }),
      // "Kechagi suhbatdan": oxirgi tugallangan (bugungidan oldingi) suhbat xatolari
      Conversation.findOne({
        user: req.user._id,
        dayKey: { $lt: ctx.todayKey },
        status: 'completed',
        'feedback.corrections.0': { $exists: true },
      })
        .sort({ completedAt: -1 })
        .select('partner topicUz dayKey feedback.corrections')
        .lean(),
    ]);
    const limit = dailyLimitFor(req.user);
    res.json({
      sceneDone,
      speakCompleted: Boolean(quests.speakCompleted),
      preview: previewFor(ctx),
      conversation: latest ? serialize(latest) : null,
      startedToday,
      dailyLimit: limit,
      canStartNew: sceneDone && startedToday < limit,
      plan: req.user.getEffectivePlan?.() || 'free',
      recent: previous
        ? {
            partner: previous.partner,
            topicUz: previous.topicUz,
            dayKey: previous.dayKey,
            corrections: previous.feedback.corrections.slice(0, 2),
          }
        : null,
    });
  } catch (error) {
    console.error('Speak today error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Suhbatni boshlash (yoki bugungi tugallanmaganini davom ettirish)
// @route   POST /api/speak/start
router.post('/start', protect, async (req, res) => {
  try {
    const { ctx, sceneDone } = await loadToday(req.user);
    if (!sceneDone) {
      return res.status(409).json({
        message: "Avval bugungi sahnani tugating — suhbat o'sha so'zlar ustida bo'ladi.",
        code: 'SCENE_FIRST',
      });
    }
    if (!ctx.baseTopic) return res.status(404).json({ message: 'Bugungi sahna topilmadi.' });

    // Tugallanmagan suhbat bo'lsa — yangisini ochmaymiz (limit ham yeyilmaydi)
    const active = await Conversation.findOne({ user: req.user._id, dayKey: ctx.todayKey, status: 'active' });
    if (active) return res.json({ conversation: serialize(active), resumed: true });

    const startedToday = await Conversation.countDocuments({ user: req.user._id, dayKey: ctx.todayKey });
    const limit = dailyLimitFor(req.user);
    if (startedToday >= limit) {
      return res.status(403).json({
        message:
          limit <= 1
            ? "Bepul tarifda kuniga 1 ta suhbat. Ertaga yangi sahna bilan yangi suhbat! Ko'proq mashq — Pro tarifida."
            : 'Bugungi suhbatlar limiti tugadi.',
        code: 'SPEAK_LIMIT',
        dailyLimit: limit,
      });
    }

    const preview = previewFor(ctx);
    const { partnerLines } = splitRoles(ctx.baseTopic.dialogue);
    const conv = new Conversation({
      user: req.user._id,
      dayKey: ctx.todayKey,
      contentDay: ctx.contentDay,
      partner: preview.partner,
      topicUz: preview.topicUz,
      situationUz: preview.situationUz,
      cefr: ctx.baseTopic.cefr || '',
      targetWords: preview.targetWords,
      mode: 'scripted',
    });

    // AI bo'lsa — erkin suhbat; bo'lmasa sahna dialogi bo'yicha
    let opened = null;
    if (gemini.isGeminiReady()) {
      const result = await gemini.openConversation(brief(conv));
      if (result.status === 'ok') opened = result;
    }
    if (opened) {
      conv.mode = 'ai';
      conv.goals = opened.goals.map((textUz, i) => ({ id: `g${i + 1}`, textUz }));
      conv.turns.push({ role: 'partner', text: opened.opening, textUz: opened.openingUz });
    } else {
      const first = partnerLines[0] || { en: 'Hello! How can I help you today?', uz: 'Salom! Sizga qanday yordam bera olaman?' };
      conv.turns.push({ role: 'partner', text: first.en, textUz: first.uz || '' });
      conv.scriptIndex = 1;
    }

    await conv.save();
    res.status(201).json({ conversation: serialize(conv), resumed: false });
  } catch (error) {
    console.error('Speak start error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

const loadOwnConversation = async (req, res) => {
  let conv = null;
  try {
    conv = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
  } catch {
    conv = null; // yaroqsiz ObjectId
  }
  if (!conv) {
    res.status(404).json({ message: 'Suhbat topilmadi.' });
    return null;
  }
  return conv;
};

/** Ssenariy rejimida qahramonning keyingi qatori */
const nextScriptedLine = (conv, dialogue) => {
  const { partnerLines } = splitRoles(dialogue);
  const index = conv.scriptIndex;
  conv.scriptIndex += 1;
  const line = partnerLines[index];
  if (line) return { text: line.en, textUz: line.uz || '' };
  // Dialog tugadi: talaba hali yetarli gapirmagan bo'lsa — suhbat davom etadi
  if (userTurnCount(conv) < MIN_USER_TURNS + 2) {
    return SCRIPT_FOLLOW_UPS[(index - partnerLines.length) % SCRIPT_FOLLOW_UPS.length];
  }
  return SCRIPT_END;
};

// @desc    Foydalanuvchi replikasi → qahramon javobi
// @route   POST /api/speak/:id/turn
router.post('/:id/turn', protect, validate(speakTurnSchema), async (req, res) => {
  try {
    const conv = await loadOwnConversation(req, res);
    if (!conv) return undefined;
    if (conv.status !== 'active') {
      return res.status(409).json({ message: 'Suhbat allaqachon yakunlangan.', code: 'CONVERSATION_DONE' });
    }
    if (userTurnCount(conv) >= MAX_USER_TURNS) {
      return res.status(409).json({ message: 'Replikalar soni tugadi — suhbatni yakunlang.', code: 'TURN_LIMIT' });
    }

    const { text, via, seconds } = req.validated.body;
    conv.turns.push({ role: 'user', text, via });
    if (via === 'voice' && seconds) conv.spokenSeconds += Math.min(seconds, MAX_SECONDS_PER_TURN);

    const newlyUsed = [];
    for (const w of conv.targetWords) {
      if (!w.used && usesWord(text, w.word)) {
        w.used = true;
        newlyUsed.push(w.word);
      }
    }

    const newlyDone = [];
    let partnerTurn = null;
    if (conv.mode === 'ai') {
      const result = await gemini.conversationReply(brief(conv), {
        history: conv.turns,
        goals: conv.goals,
      });
      if (result.status === 'ok') {
        for (const n of result.goalsDone) {
          const goal = conv.goals[n - 1];
          if (goal && !goal.done) {
            goal.done = true;
            newlyDone.push(goal.id);
          }
        }
        partnerTurn = { text: result.reply, textUz: result.replyUz };
      } else {
        // AI suhbat o'rtasida uzildi — qadam bloklanmasin, sahna dialogiga o'tamiz
        conv.mode = 'scripted';
      }
    }

    if (!partnerTurn) {
      const { ctx } = await loadToday(req.user);
      const topic = ctx.topicsList.find((t) => t.day === conv.contentDay) || ctx.baseTopic;
      partnerTurn = nextScriptedLine(conv, topic?.dialogue || []);
    }
    conv.turns.push({ role: 'partner', ...partnerTurn });

    await conv.save();
    res.json({ conversation: serialize(conv), newlyUsed, newlyDone });
  } catch (error) {
    console.error('Speak turn error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    "Yordam": nima deyish mumkinligini ko'rsatish (sahnadan, AI'siz)
// @route   POST /api/speak/:id/hint
router.post('/:id/hint', protect, async (req, res) => {
  try {
    const conv = await loadOwnConversation(req, res);
    if (!conv) return undefined;
    const { ctx } = await loadToday(req.user);
    const topic = ctx.topicsList.find((t) => t.day === conv.contentDay) || ctx.baseTopic;
    const { learnerLines, partner } = splitRoles(topic?.dialogue || []);
    const unused = conv.targetWords.filter((w) => !w.used);
    // Avval sahnada YODLANGAN iboralar (talaba roli) — ularni ishlatish eng oson
    const memorized = pickKeyLines(topic?.dialogue || [], conv.targetWords).filter((l) => l.speaker !== partner);
    const pool = memorized.length ? memorized : learnerLines;
    const line = pool.length ? pool[userTurnCount(conv) % pool.length] : null;
    res.json({
      // Sahnadagi tayyor ibora — tuzilishni ko'rsatadi, so'zma-so'z aytish shart emas
      example: line ? { text: line.en, textUz: line.uz || '', memorized: memorized.length > 0 } : null,
      // Hali ishlatilmagan bugungi so'zlar
      words: unused.slice(0, 3).map((w) => ({ word: w.word, translation: w.translation })),
    });
  } catch (error) {
    console.error('Speak hint error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Suhbatni yakunlash: tahlil + kunlik reja qadami
// @route   POST /api/speak/:id/finish
router.post('/:id/finish', protect, async (req, res) => {
  try {
    const conv = await loadOwnConversation(req, res);
    if (!conv) return undefined;

    if (conv.status !== 'completed') {
      if (userTurnCount(conv) < MIN_USER_TURNS) {
        return res.status(409).json({
          message: `Yakunlash uchun kamida ${MIN_USER_TURNS} marta javob bering.`,
          code: 'NOT_ENOUGH_TURNS',
        });
      }

      if (gemini.isGeminiReady()) {
        const review = await gemini.conversationFeedback(brief(conv), {
          history: conv.turns,
          learnerLevel: req.user.onboarding?.level,
        });
        if (review.status === 'ok') {
          conv.feedback = { summaryUz: review.summaryUz, corrections: review.corrections };
        }
      }
      conv.status = 'completed';
      conv.completedAt = new Date();
      await conv.save();
    }

    // Faqat BUGUNGI suhbat rejaga hisoblanadi (kecha boshlangani ertasi kuni yakunlansa — yo'q)
    const { ctx } = await loadToday(req.user);
    let step = null;
    if (conv.dayKey === ctx.todayKey) {
      step = completeDailyStep(req.user, 'speak', ctx.todayKey);
      await req.user.save();
    }

    res.json({
      conversation: serialize(conv),
      dailyStep: {
        speakCompleted: Boolean(req.user.dailyQuests?.speakCompleted),
        planCompleted: isPlanComplete(req.user.dailyQuests),
        xpAwarded: step?.xpAwarded || 0,
        streakUpdated: Boolean(step?.streakUpdated),
        streakFrozen: Boolean(step?.streakFrozen),
        currentStreak: req.user.currentStreak || 0,
        message: step ? dailyStepMessage(step) : null,
      },
      user: await buildUserProfile(req.user),
    });
  } catch (error) {
    console.error('Speak finish error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
module.exports.MIN_USER_TURNS = MIN_USER_TURNS;
module.exports.MAX_USER_TURNS = MAX_USER_TURNS;
