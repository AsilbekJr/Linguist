const express = require('express');
const router = express.Router();
const { analyzeStory } = require('../services/geminiService');

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

// Mock Storage for Stories
let mockStories = [];

// @desc    Save a story
// @route   POST /api/stories
router.post('/', async (req, res) => {
    try {
        const { title, content, wordsUsed, vibeScore, analysis } = req.body;
        
        const newStory = {
            _id: Date.now().toString(),
            title: title || "Untitled Flow",
            content,
            wordsUsed,
            vibeScore,
            analysis,
            createdAt: new Date()
        };

        // In real app: const story = await Story.create({...})
        mockStories.unshift(newStory);

        res.status(201).json(newStory);
    } catch (error) {
        console.error("Save Story Error:", error);
        res.status(500).json({ message: "Failed to save story" });
    }
});

// @desc    Get all stories
// @route   GET /api/stories
router.get('/', (req, res) => {
    res.json(mockStories);
});

module.exports = router;
