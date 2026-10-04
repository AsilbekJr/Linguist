const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { protect } = require('../middleware/authMiddleware');
const { validate, wordCreateSchema, wordPreviewSchema } = require('../middleware/validate');
const { lookupUzbekEntries } = require('../utils/localTranslations');
const gemini = require('../services/geminiService');
const { reserveAiCall, refundAiCall } = require('../middleware/usageQuota');
const { addWordPhrases } = require('../services/phrases');
const { findWordInSentence } = require('../utils/reviewModes');
const { enrichWord } = require('../utils/wordEnrichment');
const { initialState } = require('../utils/srs');
const { invalidateUserWords } = require('../utils/userWordsCache');
const { getTopicReviewDate } = require('../utils/topicHelpers');

// @desc    Get all words
// @route   GET /api/words
router.get('/', protect, async (req, res) => {
    try {
        const words = await Word.find({ user: req.user._id })
            .select('word phonetic definition translation partOfSpeech synonyms examples exampleUz collocations stage learned learnedAt markedKnown lapses intervalDays nextReviewDate createdAt')
            .sort({ createdAt: -1 })
            .lean();
        res.json(words);
    } catch (error) {
        console.error("Error fetching words:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Add a word
// @route   POST /api/words
router.post('/preview', protect, validate(wordPreviewSchema), async (req, res) => {
    let reserved = false;
    try {
        const { text } = req.validated.body;
        const local = lookupUzbekEntries(text);
        if (local.length) return res.json({ options: local });
        if (!gemini.isGeminiReady()) return res.status(503).json({ message: "Tarjima xizmati hozir ishlamayapti. Inglizcha tarjimani qo'lda kiriting." });
        const quota = await reserveAiCall(req.user);
        if (!quota.ok) return res.status(402).json({ message: "Kunlik tarjima limiti tugadi. Qo'lda kiritishingiz mumkin." });
        reserved = true;
        const result = await gemini.translateUzbekWord(text, req.user.onboarding?.level || 'beginner');
        if (result.status !== 'ok') {
            await refundAiCall(req.user);
            reserved = false;
            return res.status(503).json({ message: "Tarjimani topib bo'lmadi. Matn saqlandi — qayta urining yoki qo'lda kiriting." });
        }
        res.json({ options: [result.data] });
    } catch (error) {
        if (reserved) await refundAiCall(req.user);
        console.error('Word preview error:', error);
        res.status(500).json({ message: "Tarjimani yuklab bo'lmadi." });
    }
});

router.post('/', protect, validate(wordCreateSchema), async (req, res) => {
    try {
        const body = req.validated.body;
        let { word } = body;

        // Title Case Convention (e.g., "apple" -> "Apple")
        word = word.trim().charAt(0).toUpperCase() + word.trim().slice(1).toLowerCase();

        if (body.manualExampleUz !== undefined) {
            const example = String(body.manualExamples?.[0] || '').trim();
            if (!body.manualExampleUz.trim() || example.length > 400 || example.split(/\s+/).length < 3 || !findWordInSentence(example, word)) {
                return res.status(400).json({ type: 'INVALID_EXAMPLE', message: "Misol gapda shu inglizcha so'z qatnashsin va kamida uchta so'z bo'lsin. Gap tarjimasini ham kiriting." });
            }
        }

        const existingWord = await Word.findOne({ word, user: req.user._id });
        if (existingWord) {
            return res.status(400).json({
                message: `"${word}" allaqachon lug'atingizda bor.`,
                type: 'DUPLICATE'
            });
        }

        const result = await enrichWord(word, {
            learnerLevel: req.user.onboarding?.level || 'beginner',
            skipAI: body.skipAI,
            manual: {
                definition: body.manualDefinition,
                translation: body.manualTranslation,
                examples: body.manualExamples,
                exampleUz: body.manualExampleUz,
            },
        });

        if (result.status === 'not_found') {
            return res.status(400).json({
                message: `"${word}" ingliz tilida topilmadi. Imloni tekshirib ko'ring.`,
                type: 'INVALID',
                suggestions: []
            });
        }

        // Hech narsa topilmadi — SOXTA MA'LUMOT BILAN SAQLAMAYMIZ.
        // Ilgari bu yerda "Definition unavailable (API failed)" degan inglizcha
        // matn ta'rif sifatida yozilardi va buzuq kartochka SRS navbatiga
        // tushib qolardi. Endi foydalanuvchi sababni biladi va qayta uradi.
        if (result.status === 'failed') {
            return res.status(503).json({
                message:
                    "Lug'at xizmatiga ulanib bo'lmadi, shuning uchun so'z saqlanmadi — " +
                    "aks holda u ta'rifsiz qolardi. Bir oz kutib qayta urinib ko'ring.",
                type: 'ENRICHMENT_FAILED',
                reason: result.reason,
            });
        }

        const info = result.data;
        const newWord = await Word.create({
            user: req.user._id,
            word: info.word || word,
            phonetic: info.phonetic,
            definition: info.definition,
            translation: info.translation,
            partOfSpeech: body.partOfSpeech || info.partOfSpeech,
            // Bo'sh massiv ham "truthy" — `||` ishlatilsa klientdagi bo'sh ro'yxat
            // topilgan sinonimlarni bosib ketardi
            synonyms: (body.synonyms?.length ? body.synonyms : info.synonyms) || [],
            examples: info.examples,
            exampleUz: info.exampleUz,
            collocations: info.collocations,
            ...initialState(),
            mastered: false,
            reviewStage: 0,
            nextReviewDate: body.fromTopic ? getTopicReviewDate() : new Date(),
        });

        invalidateUserWords(req.user._id);
        await addWordPhrases(req.user, [newWord]);
        newWord.sentenceSyncVersion = 1;
        await newWord.save();
        res.status(201).json(newWord);

    } catch (error) {
        console.error("Add Word Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

/**
 * @desc  Mavjud so'zning ma'lumotini qayta yuklash
 * @route POST /api/words/:id/refresh
 *
 * Tarmoq uzilgan paytda qo'shilgan so'zlar ta'rifsiz qolgan bo'lishi mumkin.
 * Bu marshrut o'sha yozuvlarni tuzatadi — takrorlash holatiga (bosqich,
 * interval, lapses) TEGMAYDI, faqat kontent maydonlari yangilanadi.
 */
router.post('/:id/refresh', protect, async (req, res) => {
    try {
        const wordDoc = await Word.findOne({ _id: req.params.id, user: req.user._id });
        if (!wordDoc) return res.status(404).json({ message: 'Word not found' });

        const result = await enrichWord(wordDoc.word, {
            learnerLevel: req.user.onboarding?.level || 'beginner',
        });

        if (result.status !== 'ok') {
            return res.status(503).json({
                message:
                    result.status === 'not_found'
                        ? `"${wordDoc.word}" ingliz lug'atida topilmadi.`
                        : "Lug'at xizmatiga ulanib bo'lmadi. Keyinroq urinib ko'ring.",
                type: result.status === 'not_found' ? 'INVALID' : 'ENRICHMENT_FAILED',
            });
        }

        const info = result.data;
        wordDoc.phonetic = info.phonetic || wordDoc.phonetic;
        wordDoc.definition = info.definition || wordDoc.definition;
        wordDoc.partOfSpeech = info.partOfSpeech || wordDoc.partOfSpeech;
        wordDoc.translation = info.translation || wordDoc.translation;
        if (info.examples.length) wordDoc.examples = info.examples;
        if (info.exampleUz) wordDoc.exampleUz = info.exampleUz;
        wordDoc.sentenceSyncVersion = 0;
        if (info.synonyms.length) wordDoc.synonyms = info.synonyms;

        await wordDoc.save();
        invalidateUserWords(req.user._id);
        res.json(wordDoc);
    } catch (error) {
        console.error('Refresh word error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete a word
// @route   DELETE /api/words/:id
router.delete('/:id', protect, async (req, res) => {
    try {
        const word = await Word.findOne({ _id: req.params.id, user: req.user._id });

        if (!word) {
            return res.status(404).json({ message: 'Word not found' });
        }

        await word.deleteOne();
        invalidateUserWords(req.user._id);
        res.json({ message: 'Word removed', id: req.params.id });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
