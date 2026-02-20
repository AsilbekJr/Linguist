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
        console.log("Analyzing story...");
        const analysis = await analyzeStory(story, targetWords || []);
        
        const responseData = analysis || {
            vibeScore: 70,
            tone: "Analysis Failed (Mock)",
            suggestions: ["AI service temporary unavailable, please try again."],
            vocabularyUsage: {}
        };

        res.json(responseData);
    } catch (error) {
        console.error(error);
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
