const express = require('express');
const router = express.Router();
const {
  translateUzbekToEnglish,
  evaluatePronunciation,
  translateText,
} = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, speakingTranslateSchema } = require('../middleware/validate');
const { trackAiUsage, recordAiUsage } = require('../middleware/usageQuota');

router.post('/translate', protect, validate(speakingTranslateSchema), async (req, res) => {
    try {
        const { text } = req.validated.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        const result = await translateUzbekToEnglish(text);

        if (!result?.casual) {
            return res.status(503).json({
                error: 'Tarjima xizmati vaqtincha ishlamayapti. Keyinroq urinib ko\'ring.',
                code: 'TRANSLATE_UNAVAILABLE',
            });
        }

        if (result._source === 'gemini') {
            await recordAiUsage(req.user);
        }

        const { _source, ...payload } = result;
        res.json(payload);
    } catch (err) {
        console.error('Translation Route Error:', err);
        res.status(500).json({ error: 'Server error during translation' });
    }
});

// POST /api/speaking/translate-text
// Generic text-to-text translation
router.post('/translate-text', protect, trackAiUsage, async (req, res) => {
    try {
        const { text, from, to } = req.body;
        if (!text || !from || !to) {
            return res.status(400).json({ error: "Missing required fields: text, from, to" });
        }
        const translatedResult = await translateText(text, from, to);
        if (!translatedResult) {
             return res.status(503).json({ error: "Translation service unavailable." });
        }
        res.json({ translatedText: translatedResult });
    } catch (err) {
        console.error("Text Translation Route Error:", err);
        if (err.type === 'QUOTA_EXCEEDED') {
            return res.status(429).json({ error: err.message });
        }
        res.status(500).json({ error: "Server error during text translation." });
    }
});

// POST /api/speaking/evaluate — mahalliy so'z mosligi (AI token sarflanmaydi)
router.post('/evaluate', protect, async (req, res) => {
    try {
        const { targetSentence, spokenText } = req.body;

        if (!targetSentence || !spokenText) {
            return res.status(400).json({ error: 'targetSentence va spokenText kerak.' });
        }

        const result = await evaluatePronunciation(targetSentence, spokenText);
        res.json(result);
    } catch (err) {
        console.error('Evaluation Route Error:', err);
        res.status(500).json({ error: 'Baholashda server xatosi.' });
    }
});

module.exports = router;
