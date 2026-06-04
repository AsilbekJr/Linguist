const express = require('express');
const router = express.Router();
const { generateRoleplayResponse } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, roleplaySchema } = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');

router.post('/chat', protect, validate(roleplaySchema), trackAiUsage, async (req, res) => {
    const { scenario, targetWords = [], chatHistory = [], message } = req.validated.body;

    if (!scenario || !message) {
        return res.status(400).json({ error: "Scenario and message are required." });
    }

    try {
        const learnerLevel = req.user.onboarding?.level || 'beginner';
        const aiResponse = await generateRoleplayResponse(
            scenario,
            targetWords,
            chatHistory,
            message,
            learnerLevel
        );
        res.json({ reply: aiResponse });
    } catch (error) {
        console.error("Roleplay Route Error:", error);
        if (error.type === 'QUOTA_EXCEEDED') {
             res.status(429).json({ error: error.message });
        } else {
             res.status(500).json({ error: "Server Error" });
        }
    }
});

module.exports = router;
