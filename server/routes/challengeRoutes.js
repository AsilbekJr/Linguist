const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const Word = require('../models/Word');
const { generateChallengeText } = require('../services/geminiService');

const TOPICS = [
    "A Memorable Travel Experience",
    "The Future of Technology",
    "A Book or Movie That Changed My Life",
    "The Importance of Mental Health",
    "My Dream Career",
    "Cultural Differences I've Noticed",
    "The Best Advice I've Ever Received",
    "How I Deal with Stress",
    "A Challenge I Overcame",
    "The Role of Social Media Today",
    "If I Could Meet Anyone from History",
    "The Most Delicious Meal I've Had",
    "A Skill I Want to Learn",
    "My Favorite Childhood Memory",
    "The Impact of Artificial Intelligence"
];

// Get current pending challenge (or create a new one for today)
router.get('/current', async (req, res) => {
    try {
        // Find the latest challenge
        const lastChallenge = await Challenge.findOne().sort({ dayNumber: -1 });
        
        // If there's a pending challenge today or from a previous day, return it so they can complete it
        if (lastChallenge && lastChallenge.status === 'pending') {
            return res.json(lastChallenge);
        }

        // If the last challenge is completed, check if it was completed today
        const todayStr = new Date().toISOString().split('T')[0];
        if (lastChallenge && lastChallenge.status === 'completed') {
            const lastCompletedDateStr = lastChallenge.updatedAt.toISOString().split('T')[0];
            if (lastCompletedDateStr === todayStr) {
                 return res.json({ message: "You have already completed today's challenge! Come back tomorrow.", isCompleteForToday: true, lastChallenge });
            }
        }

        // Otherwise, we need to create a NEW challenge
        let nextDaynum = lastChallenge ? lastChallenge.dayNumber + 1 : 1;
        if (nextDaynum > 100) {
            return res.json({ message: "Congratulations! You have completed the 100 Days Challenge!", isFinished: true });
        }

        // 1. Pick a topic
        const randomTopic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

        // 2. Fetch some target words from the user's vocabulary (e.g. 5 random words that are not 'Mastered')
        let targetWords = [];
        try {
            const activeWords = await Word.aggregate([
                { $match: { srsStage: { $lt: 5 } } },
                { $sample: { size: 5 } }
            ]);
            targetWords = activeWords.map(w => w.word);
        } catch (e) {
            console.warn("Could not fetch target words for challenge:", e);
        }

        // 3. Generate text using Gemini
        const generatedText = await generateChallengeText(randomTopic, targetWords);

        // 4. Save to DB
        const newChallenge = new Challenge({
            dayNumber: nextDaynum,
            topic: randomTopic,
            text: generatedText || "This is a fallback text because AI generation failed. Welcome to your challenge! Read this text aloud to practice.",
            status: 'pending'
        });
        await newChallenge.save();

        res.json(newChallenge);

    } catch (error) {
        console.error("Error fetching/creating current challenge:", error);
        res.status(500).json({ error: 'Server error while managing challenge' });
    }
});

// Get all challenges history
router.get('/history', async (req, res) => {
    try {
        // Find all challenges and sort by dayNumber
        const history = await Challenge.find().sort({ dayNumber: 1 });
        res.json(history);
    } catch (error) {
        console.error("Error fetching challenge history:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Complete a challenge (upload audio)
router.post('/complete', async (req, res) => {
    try {
        const { challengeId, audioData } = req.body;

        if (!challengeId || !audioData) {
            return res.status(400).json({ error: 'Challenge ID and audio data are required' });
        }

        const challenge = await Challenge.findById(challengeId);
        
        if (!challenge) {
            return res.status(404).json({ error: 'Challenge not found' });
        }

        if (challenge.status === 'completed') {
             return res.status(400).json({ error: 'Challenge is already completed' });
        }

        challenge.audioData = audioData;
        challenge.status = 'completed';
        await challenge.save();

        res.json({ message: 'Challenge completed successfully!', challenge });
    } catch (error) {
        console.error("Error completing challenge:", error);
        res.status(500).json({ error: 'Server error while completing challenge' });
    }
});

module.exports = router;
