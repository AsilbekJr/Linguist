const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { protect } = require('../middleware/authMiddleware');
const { validate, vocabTopicAddSchema } = require('../middleware/validate');
const { getLevels, getTopic } = require('../content/vocab-topics');
const { initialState } = require('../utils/srs');

/**
 * Mavzular kutubxonasi (Vocabulary in Use mavzulari asosida).
 * So'zlar kontentdan keladi; foydalanuvchi ularni lug'atiga qo'shadi.
 */

const keyOf = (w) => String(w).trim().toLowerCase();

/** Foydalanuvchi lug'atidagi so'zlar (kichik harfda) — berilgan ro'yxat ichidan */
const savedKeys = async (userId, words) => {
  const keys = words.map((w) => keyOf(w.word));
  const rows = await Word.find({ user: userId, wordKey: { $in: keys } }).select('wordKey').lean();
  return new Set(rows.map((r) => r.wordKey));
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
    const saved = await savedKeys(req.user._id, topic.words);
    res.json({
      id: topic.id,
      unit: topic.unit,
      level: topic.level,
      cefr: topic.cefr,
      title: topic.title,
      titleUz: topic.titleUz,
      emoji: topic.emoji,
      words: topic.words.map((w) => ({ ...w, saved: saved.has(keyOf(w.word)) })),
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
    const wanted = requested ? new Set(requested.map(keyOf)) : null;
    const candidates = topic.words.filter((w) => !wanted || wanted.has(keyOf(w.word)));
    if (wanted && candidates.length === 0) {
      return res.status(400).json({ message: "Bu so'zlar mavzuda yo'q", code: 'NOT_IN_TOPIC' });
    }

    const saved = await savedKeys(req.user._id, candidates);
    const toAdd = candidates.filter((w) => !saved.has(keyOf(w.word)));

    let added = toAdd.length;
    if (toAdd.length) {
      try {
        await Word.insertMany(
          toAdd.map((w) => ({
            user: req.user._id,
            word: w.word,
            translation: w.translation,
            partOfSpeech: w.partOfSpeech,
            examples: [w.example],
            exampleUz: w.exampleUz,
            cefr: topic.cefr,
            // Qo'shilgan kuni birinchi takrorlash — "tanib olish" rejimida
            ...initialState(),
          })),
          { ordered: false }
        );
      } catch (err) {
        // Parallel so'rov shu so'zni allaqachon qo'shgan bo'lsa (unikal indeks) — muammo emas
        const writeErrors = err.writeErrors || [];
        const onlyDuplicates =
          err.code === 11000 || (writeErrors.length > 0 && writeErrors.every((e) => (e.code ?? e.err?.code) === 11000));
        if (!onlyDuplicates) throw err;
        added -= writeErrors.length || 0;
      }
    }

    res.json({ added, alreadySaved: candidates.length - toAdd.length });
  } catch (error) {
    console.error('Vocab topic add error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
