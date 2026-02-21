const express = require('express');
const router = express.Router();
const { translateUzbekToEnglish } = require('../services/geminiService');

// POST /api/speaking/translate
// Accepts an Uzbek text, returns structured English translations
router.post('/translate', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: "Text is required" });
        }

        const result = await translateUzbekToEnglish(text);
        
        if (!result) {
             return res.status(503).json({ error: "AI service failed or unavailable." });
        }

        res.json(result);
    } catch (err) {
        console.error("Translation Route Error:", err);
        if (err.type === 'QUOTA_EXCEEDED') {
            return res.status(429).json({ error: err.message });
        }
        res.status(500).json({ error: "Server error during translation" });
    }
});

module.exports = router;
