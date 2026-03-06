const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const Word = require('../models/Word');
const { generateChallengeText, evaluatePronunciation } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');

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
router.get('/current', protect, async (req, res) => {
    try {
        // Find the latest challenge
        const lastChallenge = await Challenge.findOne({ user: req.user._id }).sort({ dayNumber: -1 });
        
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

        let targetWords = [];
        try {
            const activeWords = await Word.aggregate([
                { $match: { user: req.user._id, srsStage: { $lt: 5 } } },
                { $sample: { size: 5 } }
            ]);
            targetWords = activeWords.map(w => w.word);
        } catch (e) {
            console.warn("Could not fetch target words for challenge:", e);
        }

        // 3. Generate challenge text: prefer AI, fallback to static JSON
        let generatedText = null;
        let randomTopic = TOPICS[(nextDaynum - 1) % TOPICS.length];

        try {
            generatedText = await generateChallengeText(randomTopic, targetWords, nextDaynum);
        } catch (err) {
            console.warn("AI generation failed, moving to fallback...", err.message);
        }

        if (!generatedText || generatedText.includes("Failed to generate text") || generatedText.trim().length === 0) {
            console.log("Using static JSON fallback for challenge text");
            try {
                const challengesData = require('../data/challenges.json');
                const dayData = challengesData.find(c => c.dayNumber === nextDaynum);
                if (dayData) {
                    randomTopic = dayData.topic;
                    generatedText = dayData.textTemplate;
                    if (targetWords.length > 0) {
                        generatedText = generatedText.replace('(Target words will be dynamically injected here in the route).', `\n\nYour target vocabulary words to focus on today are: **${targetWords.join('** , **')}**. Try to use them in your own sentences later!`);
                    } else {
                        generatedText = generatedText.replace('(Target words will be dynamically injected here in the route).', '');
                    }
                }
            } catch (err) {
                console.error("Failed to load local challenges JSON. Falling back to simple text.", err.message);
                generatedText = `This is a fallback text because challenges data was not found. Please manually read and practice these target words for your daily challenge:\n\n**${targetWords.join('**\n**')}**\n\nTry to create your own short story or sentences using these words.`;
            }
        }

        // 4. Save to DB
        const newChallenge = new Challenge({
            user: req.user._id,
            dayNumber: nextDaynum,
            topic: randomTopic,
            text: generatedText,
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
router.get('/history', protect, async (req, res) => {
    try {
        // Find all challenges and sort by dayNumber
        const history = await Challenge.find({ user: req.user._id }).sort({ dayNumber: 1 });
        res.json(history);
    } catch (error) {
        console.error("Error fetching challenge history:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Complete a challenge (upload audio)
router.post('/complete', protect, async (req, res) => {
    try {
        const { challengeId, audioData, spokenText } = req.body;

        if (!challengeId || !audioData) {
            return res.status(400).json({ error: 'Challenge ID and audio data are required' });
        }

        const challenge = await Challenge.findOne({ _id: challengeId, user: req.user._id });
        
        if (!challenge) {
            return res.status(404).json({ error: 'Challenge not found' });
        }

        if (challenge.status === 'completed') {
             return res.status(400).json({ error: 'Challenge is already completed' });
        }

        // Evaluate using Gemini if spokenText is provided
        if (spokenText && spokenText.trim().length > 0) {
            try {
                 const evalResult = await evaluatePronunciation(challenge.text, spokenText);
                 if (evalResult) {
                     challenge.score = evalResult.score;
                     challenge.feedback = evalResult.feedback;
                     challenge.color = evalResult.color;
                 }
            } catch (evalErr) {
                 console.warn("AI Evaluation failed for Challenge:", evalErr);
            }
        } else {
            challenge.feedback = "Audio yozib olinganiga qaramay ovoz aniqlanmadi (SpeechRecognition). Talaffuzingiz aniqroq bo'lishi mumkin.";
            challenge.score = 0;
            challenge.color = 'red';
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
