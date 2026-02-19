const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Mock Data Store
let mockWords = [
    {
        _id: '1',
        word: 'Serendipity',
        definition: 'The occurrence and development of events by chance in a happy or beneficial way.',
        examples: ['It was pure serendipity that we met.'],
        mastered: false
    },
    {
        _id: '2',
        word: 'Ephemeral',
        definition: 'Lasting for a very short time.',
        examples: ['Fashions are ephemeral, changing with every season.'],
        mastered: true
    }
];

// @desc    Get all words
// @route   GET /api/words
// @access  Public (Mock)
router.get('/', (req, res) => {
    // If DB is not connected, return mock data
    if (mongoose.connection.readyState !== 1) {
         return res.json(mockWords);
    }
    // Real DB logic would go here
    res.json([]); 
});

const { generateWordContext } = require('../services/geminiService');

// @desc    Add a word (with AI context)
// @route   POST /api/words
// @access  Public (for now)
router.post('/', async (req, res) => {
    const { word } = req.body;
    
    if (!word) {
        return res.status(400).json({ message: 'Word is required' });
    }

    try {
        console.log(`Analyzing word: ${word}...`);
        
        // 1. Try to get AI context
        const aiContext = await generateWordContext(word);
        
        // 2. Fallback if AI fails or no key
        const newWordData = aiContext || {
            word,
            definition: "Definition unavailable (Mock or AI failed).",
            examples: ["Please add your own example."],
            collocations: [],
            fun_fact: "Did you know? You can add your own notes here."
        };

        // 3. Save to DB (mock for now if no DB connection)
        if (mongoose.connection.readyState !== 1) {
            const newWord = {
                _id: Date.now().toString(),
                ...newWordData,
                mastered: false
            };
            mockWords.unshift(newWord); // Add to beginning
            return res.status(201).json(newWord);
        }

        // Real DB Save logic (Schema needs to be updated to match AI response fields if different)
        // const wordDoc = await Word.create({ ...newWordData, user: req.user.id });
        // res.status(201).json(wordDoc);
        
        // Return mock even if DB connected for this stage, to ensure UI works
        return res.status(201).json({
             _id: Date.now().toString(),
             ...newWordData,
             mastered: false
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
});

const mongoose = require('mongoose');
module.exports = router;
