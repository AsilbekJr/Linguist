const express = require('express');
const router = express.Router();
const { generateTeacherResponse } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, teacherAskSchema } = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');

// @route   POST /api/teacher/ask
// @desc    Ustoz AI — grammar, phrase, vocabulary explanations
router.post('/ask', protect, validate(teacherAskSchema), trackAiUsage, async (req, res) => {
  const { question, category, chatHistory } = req.validated.body;

  try {
    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const answer = await generateTeacherResponse(
      question,
      category,
      chatHistory,
      learnerLevel
    );

    if (!answer) {
      return res.status(503).json({ error: 'AI javob bera olmadi. Qayta urinib ko\'ring.' });
    }

    res.json({ answer });
  } catch (error) {
    console.error('Teacher route error:', error);
    if (error.type === 'QUOTA_EXCEEDED') {
      return res.status(402).json({ error: error.message, type: 'QUOTA_EXCEEDED' });
    }
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
