const express = require('express');
const router = express.Router();
const { analyzeSentence } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, sentenceAnalyzeSchema } = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');

/**
 * Gap tahlili — "Ustoz AI" ning o'rniga kelgan marshrut.
 *
 * Eski `/api/teacher/ask` erkin chat edi: foydalanuvchi nima so'rashini bilmasdi
 * va javob uning o'z lug'atiga bog'lanmagan edi. Bu yerda kirish aniq — bitta
 * gap, chiqish ham aniq — har bir so'zning turkumi va gap bo'lagi.
 *
 * @route POST /api/analysis/sentence
 * @body  { sentence }
 */
router.post('/sentence', protect, validate(sentenceAnalyzeSchema), trackAiUsage, async (req, res) => {
  const { sentence } = req.validated.body;

  try {
    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const result = await analyzeSentence(sentence, learnerLevel);

    if (result.status === 'unavailable') {
      // Bu yerda mahalliy zaxira YO'Q va bo'lishi ham mumkin emas: gap
      // bo'laklarini qoidalar bilan aniqlash uchun to'liq sintaktik tahlilchi
      // kerak. Yolg'on tahlil ko'rsatgandan ko'ra hech narsa ko'rsatmagan
      // yaxshi — foydalanuvchi noto'g'ri grammatikani o'rganib qolmasin.
      await req.aiCall.refund();
      return res.status(503).json({
        status: 'unavailable',
        code: result.reason,
        message:
          result.reason === 'QUOTA_EXCEEDED'
            ? "AI limiti tugadi. Biroz kutib qayta urinib ko'ring."
            : 'Gap tahlili hozir ishlamayapti. Keyinroq urinib ko\'ring.',
      });
    }

    req.aiCall.commit();
    res.json({ status: 'ok', ...result.analysis });
  } catch (error) {
    console.error('Sentence analysis error:', error);
    await req.aiCall?.refund();
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
