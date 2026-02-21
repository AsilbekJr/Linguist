const express = require('express');
const router = express.Router();
const { translateUzbekToEnglish, evaluatePronunciation } = require('../services/geminiService');

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

// POST /api/speaking/evaluate
// Compares spoken transcript against the actual target English sentence
router.post('/evaluate', async (req, res) => {
    try {
        const { targetSentence, spokenText } = req.body;
        
        if (!targetSentence || !spokenText) {
            return res.status(400).json({ error: "Both targetSentence and spokenText are required." });
        }

        const result = await evaluatePronunciation(targetSentence, spokenText);
        
        if (!result) {
             return res.status(503).json({ error: "AI evaluation service unavailable." });
        }

        res.json(result);
    } catch (err) {
        console.error("Evaluation Route Error:", err);
        if (err.type === 'QUOTA_EXCEEDED') {
            return res.status(429).json({ error: err.message });
        }
        res.status(500).json({ error: "Server error during evaluation" });
    }
});

module.exports = router;
