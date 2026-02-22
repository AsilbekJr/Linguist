const express = require('express');
const router = express.Router();
const { generateRoleplayResponse } = require('../services/geminiService');

// @desc    Handle chat interaction for Roleplay Immersion mode
// @route   POST /api/roleplay/chat
router.post('/chat', async (req, res) => {
    const { scenario, targetWords = [], chatHistory = [], message } = req.body;

    if (!scenario || !message) {
        return res.status(400).json({ error: "Scenario and message are required." });
    }

    try {
        const aiResponse = await generateRoleplayResponse(scenario, targetWords, chatHistory, message);
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
