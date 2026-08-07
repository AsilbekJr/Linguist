const express = require('express');
const router = express.Router();
const { generateTeacherResponse } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, teacherAskSchema } = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');

// @route   POST /api/teacher/ask
// Ustoz AI — grammatika, ibora, leksika tushuntirishlari
router.post('/ask', protect, validate(teacherAskSchema), trackAiUsage, async (req, res) => {
  const { question, category, chatHistory } = req.validated.body;

  try {
    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const result = await generateTeacherResponse(
      question,
      category,
      chatHistory,
      learnerLevel
    );

    if (result.status === 'unavailable') {
      await req.aiCall.refund();
      return res.status(503).json({
        error:
          result.reason === 'QUOTA_EXCEEDED'
            ? "AI limiti tugadi. Keyinroq urinib ko'ring."
            : "Ustoz hozir javob bera olmadi. Qayta urinib ko'ring.",
        code: result.reason,
      });
    }

    req.aiCall.commit();
    res.json({ answer: result.answer });
  } catch (error) {
    console.error('Teacher route error:', error);
    await req.aiCall?.refund();
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
