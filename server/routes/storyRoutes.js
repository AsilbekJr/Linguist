const express = require('express');
const router = express.Router();
const { analyzeStory } = require('../services/geminiService');
const Story = require('../models/Story');
const mongoose = require('mongoose');

// @desc    Analyze a story
// @route   POST /api/stories/analyze
// @access  Public (for now)
router.post('/analyze', async (req, res) => {
    const { story, targetWords } = req.body;

    if (!story) {
        return res.status(400).json({ message: 'Story content is required' });
    }

    try {
        console.log("Analyzing story locally (AI Disabled)...");
        
        let wordsUsedCount = 0;
        let vocabUsage = {};
        
        const safeTargetWords = targetWords || [];
        safeTargetWords.forEach(w => {
            const isUsed = story.toLowerCase().includes(w.toLowerCase());
            vocabUsage[w] = isUsed ? "Correct" : "Incorrect";
            if (isUsed) wordsUsedCount++;
        });

        const wordCount = story.trim().split(/\s+/).length;
        let vibeScore = 50;
        let suggestions = [];

        // Simple scoring metric based on length
        if (wordCount > 50) vibeScore += 20;
        else if (wordCount > 20) vibeScore += 10;
        else suggestions.push("Hikoyangiz ancha qisqa. Keyingi safar uzaytirib kengroq yozishga harakat qiling.");

        // Metric based on target word usage
        if (safeTargetWords.length > 0) {
            const usagePercent = wordsUsedCount / safeTargetWords.length;
            if (usagePercent === 1) vibeScore += 30;
            else if (usagePercent >= 0.5) vibeScore += 15;
            else suggestions.push("Berilgan target so'zlarni ko'proq ishlatishga harakat qiling!");
        } else {
             vibeScore += 20;
        }

        vibeScore = Math.min(100, vibeScore);

        const responseData = {
            vibeScore: vibeScore,
            tone: "Neutral (AI izlanmadi)",
            suggestions: suggestions.length > 0 ? suggestions : ["Ajoyib! Hikoyangiz yaxshi shakllangan."],
            vocabularyUsage: vocabUsage
        };

        res.json(responseData);
    } catch (error) {
        console.error("Local Story Analysis Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Save a story
// @route   POST /api/stories
router.post('/', async (req, res) => {
    try {
        const { title, content, wordsUsed, vibeScore, analysis } = req.body;
        
        const newStory = await Story.create({
            title: title || "Untitled Flow",
            content,
            wordsUsed,
            vibeScore,
            analysis
        });
        
        console.log("Story saved to DB:", newStory.title);
        res.status(201).json(newStory);
    } catch (error) {
        console.error("Save Story Error:", error);
        res.status(500).json({ message: "Failed to save story" });
    }
});

// @desc    Get all stories
// @route   GET /api/stories
router.get('/', async (req, res) => {
    try {
        const stories = await Story.find({}).sort({ createdAt: -1 });
        res.json(stories);
    } catch (error) {
        console.error("Fetch Stories Error:", error);
        res.status(500).json({ message: "Failed to fetch stories" });
    }
});

module.exports = router;
