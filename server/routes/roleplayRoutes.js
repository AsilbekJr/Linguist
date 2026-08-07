const express = require('express');
const router = express.Router();
const { generateRoleplayResponse } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, roleplaySchema } = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');

router.post('/chat', protect, validate(roleplaySchema), trackAiUsage, async (req, res) => {
  const { scenario, targetWords = [], chatHistory = [], message } = req.validated.body;

  try {
    const learnerLevel = req.user.onboarding?.level || 'beginner';
    const result = await generateRoleplayResponse(
      scenario,
      targetWords,
      chatHistory,
      message,
      learnerLevel
    );

    if (result.status === 'unavailable') {
      await req.aiCall.refund();
      return res.status(503).json({
        error:
          result.reason === 'QUOTA_EXCEEDED'
            ? "AI limiti tugadi. Keyinroq urinib ko'ring."
            : "Suhbatdosh hozir javob bera olmadi. Qayta urinib ko'ring.",
        code: result.reason,
      });
    }

    req.aiCall.commit();
    res.json({ reply: result.reply });
  } catch (error) {
    console.error('Roleplay Route Error:', error);
    await req.aiCall?.refund();
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
