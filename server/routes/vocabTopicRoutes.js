const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { protect } = require('../middleware/authMiddleware');
const { validate, vocabTopicAddSchema } = require('../middleware/validate');
const { getLevels, getTopic } = require('../content/vocab-topics');
const { initialState, markKnown } = require('../utils/srs');
const { invalidateUserWords } = require('../utils/userWordsCache');

/**
 * Mavzular kutubxonasi (Vocabulary in Use mavzulari asosida).
 * So'zlar kontentdan keladi; foydalanuvchi ularni lug'atiga qo'shadi.
 */

const keyOf = (w) => String(w).trim().toLowerCase();

/** Foydalanuvchi lug'atidagi so'zlar (kichik harfda) — berilgan ro'yxat ichidan */
const savedRows = (userId, words) =>
  Word.find({ user: userId, wordKey: { $in: words.map((w) => keyOf(w.word)) } }).select('wordKey learned');

const savedKeys = async (userId, words) => {
  const rows = await savedRows(userId, words).lean();
  return new Set(rows.map((r) => r.wordKey));
};

/** Kutubxona so'zidan lug'at yozuvi (holati alohida qo'shiladi) */
const wordDocFrom = (userId, topic, w) => ({
  user: userId,
  word: w.word,
  translation: w.translation,
  partOfSpeech: w.partOfSpeech,
  examples: [w.example],
  exampleUz: w.exampleUz,
  cefr: topic.cefr,
});

/** Parallel so'rov shu so'zni allaqachon qo'shgan bo'lsa (unikal indeks) — muammo emas */
const insertIgnoringDuplicates = async (docs) => {
  if (!docs.length) return 0;
  try {
    await Word.insertMany(docs, { ordered: false });
    return docs.length;
  } catch (err) {
    const writeErrors = err.writeErrors || [];
    const onlyDuplicates =
      err.code === 11000 || (writeErrors.length > 0 && writeErrors.every((e) => (e.code ?? e.err?.code) === 11000));
    if (!onlyDuplicates) throw err;
    return docs.length - (writeErrors.length || 0);
  }
};

/** So'rovdagi so'zlar — faqat shu mavzudagilar (mijoz kontent nomidan yozolmaydi) */
const pickTopicWords = (topic, requested) => {
  const wanted = requested ? new Set(requested.map(keyOf)) : null;
  return topic.words.filter((w) => !wanted || wanted.has(keyOf(w.word)));
};

// @route GET /api/vocab-topics
router.get('/', protect, async (req, res) => {
  try {
    const levels = getLevels();
    const allWords = levels.flatMap((l) => l.topics.flatMap((t) => t.words));
    const saved = await savedKeys(req.user._id, allWords);

    res.json({
      levels: levels.map((l) => ({
        key: l.key,
        title: l.title,
        titleUz: l.titleUz,
        cefrRange: l.cefrRange,
        topics: l.topics.map((t) => ({
          id: t.id,
          unit: t.unit,
          title: t.title,
          titleUz: t.titleUz,
          emoji: t.emoji,
          wordCount: t.words.length,
          savedCount: t.words.filter((w) => saved.has(keyOf(w.word))).length,
          preview: t.words.slice(0, 4).map((w) => w.word),
        })),
      })),
    });
  } catch (error) {
    console.error('Vocab topics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route GET /api/vocab-topics/:id
router.get('/:id', protect, async (req, res) => {
  const topic = getTopic(req.params.id);
  if (!topic) return res.status(404).json({ message: 'Mavzu topilmadi' });
  try {
    const rows = await savedRows(req.user._id, topic.words).lean();
    const state = new Map(rows.map((r) => [r.wordKey, r]));
    res.json({
      id: topic.id,
      unit: topic.unit,
      level: topic.level,
      cefr: topic.cefr,
      title: topic.title,
      titleUz: topic.titleUz,
      emoji: topic.emoji,
      words: topic.words.map((w) => {
        const row = state.get(keyOf(w.word));
        return { ...w, saved: Boolean(row), known: Boolean(row?.learned) };
      }),
    });
  } catch (error) {
    console.error('Vocab topic error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * So'zlarni lug'atga qo'shish.
 * `words` berilmasa — mavzudagi hali qo'shilmagan HAMMA so'z.
 * Faqat shu mavzuda bor so'zlar qabul qilinadi: mijoz ixtiyoriy
 * tarjima yoki matnni kontent nomidan yozib qo'ya olmaydi.
 *
 * @route POST /api/vocab-topics/:id/add
 */
router.post('/:id/add', protect, validate(vocabTopicAddSchema), async (req, res) => {
  const topic = getTopic(req.params.id);
  if (!topic) return res.status(404).json({ message: 'Mavzu topilmadi' });

  try {
    const requested = req.validated.body.words;
    const candidates = pickTopicWords(topic, requested);
    if (requested && candidates.length === 0) {
      return res.status(400).json({ message: "Bu so'zlar mavzuda yo'q", code: 'NOT_IN_TOPIC' });
    }

    const saved = await savedKeys(req.user._id, candidates);
    const toAdd = candidates.filter((w) => !saved.has(keyOf(w.word)));

    // Qo'shilgan kuni birinchi takrorlash — "tanib olish" rejimida
    const added = await insertIgnoringDuplicates(
      toAdd.map((w) => ({ ...wordDocFrom(req.user._id, topic, w), ...initialState() }))
    );
    if (added) invalidateUserWords(req.user._id);

    res.json({ added, alreadySaved: candidates.length - toAdd.length });
  } catch (error) {
    console.error('Vocab topic add error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * "Bilaman": so'zlarni takrorlashsiz yodlanganlar sifatida belgilash.
 * Lug'atda yo'q so'z yodlangan holda qo'shiladi, bor so'z yodlanganga
 * o'tkaziladi. Adashilsa — lug'atdagi "Qayta yodlash".
 *
 * @route POST /api/vocab-topics/:id/known   body: { words: [..] }
 */
router.post('/:id/known', protect, validate(vocabTopicAddSchema), async (req, res) => {
  const topic = getTopic(req.params.id);
  if (!topic) return res.status(404).json({ message: 'Mavzu topilmadi' });

  try {
    const requested = req.validated.body.words;
    // Butun mavzuni ko'r-ko'rona "bilaman" qilib bo'lmaydi — so'zlar aniq ko'rsatilishi shart
    if (!requested?.length) return res.status(400).json({ message: "So'zlarni ko'rsating", code: 'WORDS_REQUIRED' });
    const candidates = pickTopicWords(topic, requested);
    if (candidates.length === 0) {
      return res.status(400).json({ message: "Bu so'zlar mavzuda yo'q", code: 'NOT_IN_TOPIC' });
    }

    const now = new Date();
    const existing = await savedRows(req.user._id, candidates);
    let updated = 0;
    for (const doc of existing) {
      if (doc.learned) continue;
      markKnown(doc, now);
      await doc.save();
      updated += 1;
    }

    const have = new Set(existing.map((d) => d.wordKey));
    const added = await insertIgnoringDuplicates(
      candidates
        .filter((w) => !have.has(keyOf(w.word)))
        .map((w) => {
          const doc = { ...wordDocFrom(req.user._id, topic, w), ...initialState(now) };
          markKnown(doc, now);
          return doc;
        })
    );
    if (added || updated) invalidateUserWords(req.user._id);

    res.json({ added, updated });
  } catch (error) {
    console.error('Vocab topic known error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
