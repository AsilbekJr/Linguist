const express = require('express');
const router = express.Router();
const {
  translateUzbekToEnglish,
  evaluateSpokenAccuracy,
} = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const {
  validate,
  speakingTranslateSchema,
  speakingEvaluateSchema,
} = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');

// @route   POST /api/speaking/translate
// O'zbekcha gapni ikki registrda inglizchaga o'girish
router.post(
  '/translate',
  protect,
  validate(speakingTranslateSchema),
  trackAiUsage,
  async (req, res) => {
    try {
      const { text } = req.validated.body;
      const result = await translateUzbekToEnglish(text);

      if (result.status === 'unavailable') {
        // AI javob bermadi — foydalanuvchi limitini yemaymiz
        await req.aiCall.refund();
        return res.status(503).json({
          error:
            result.reason === 'QUOTA_EXCEEDED'
              ? "AI limiti tugadi. Keyinroq urinib ko'ring."
              : "Tarjima xizmati vaqtincha ishlamayapti.",
          code: result.reason,
        });
      }

      req.aiCall.commit();
      res.json({ casual: result.casual, advanced: result.advanced });
    } catch (err) {
      console.error('Translation Route Error:', err);
      await req.aiCall?.refund();
      res.status(500).json({ error: 'Server error during translation' });
    }
  }
);

// @route   POST /api/speaking/evaluate
// Aytilgan matnning maqsad matnga mosligi. AI token sarflamaydi.
// DIQQAT: bu talaffuz bahosi emas — SpeechRecognition transkriptining mosligi.
router.post('/evaluate', protect, validate(speakingEvaluateSchema), async (req, res) => {
  try {
    const { targetSentence, spokenText } = req.validated.body;
    const result = evaluateSpokenAccuracy(targetSentence, spokenText);
    res.json(result);
  } catch (err) {
    console.error('Evaluation Route Error:', err);
    res.status(500).json({ error: 'Baholashda server xatosi.' });
  }
});

module.exports = router;
