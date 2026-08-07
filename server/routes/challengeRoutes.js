const express = require('express');
const router = express.Router();
const Challenge = require('../models/Challenge');
const CHALLENGES = require('../data/challenges.json');
const { evaluateSpokenAccuracy } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, challengeCompleteSchema } = require('../middleware/validate');
const { userDayKey } = require('../utils/dayKey');

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
        // (foydalanuvchi vaqt zonasida, UTC'da emas)
        const todayStr = userDayKey(req.user);
        if (lastChallenge && lastChallenge.status === 'completed') {
            const lastCompletedDateStr = userDayKey(req.user, lastChallenge.updatedAt);
            if (lastCompletedDateStr === todayStr) {
                 return res.json({ message: "You have already completed today's challenge! Come back tomorrow.", isCompleteForToday: true, lastChallenge });
            }
        }

        // Yangi challenge yaratamiz
        const nextDaynum = lastChallenge ? lastChallenge.dayNumber + 1 : 1;

        // Kunlar soni REAL kontent hajmiga teng. Ilgari bu yerda qattiq "100"
        // yozilgan edi, lekin haqiqiy matn atigi 4 ta shablondan iborat edi.
        if (nextDaynum > CHALLENGES.length) {
            return res.json({
                message: `Tabriklaymiz! ${CHALLENGES.length} kunlik gapirish mashqini tugatdingiz.`,
                isFinished: true,
                totalDays: CHALLENGES.length,
            });
        }

        const dayData = CHALLENGES.find((c) => c.dayNumber === nextDaynum);
        if (!dayData) {
            return res.status(404).json({ error: 'Challenge topilmadi' });
        }

        const newChallenge = new Challenge({
            user: req.user._id,
            dayNumber: nextDaynum,
            topic: dayData.topic,
            text: dayData.text,
            status: 'pending',
        });
        await newChallenge.save();

        res.json({
            ...newChallenge.toObject(),
            topicUz: dayData.topicUz,
            cefr: dayData.cefr,
            lines: dayData.lines,
            focusWords: dayData.focusWords,
            instructionUz: dayData.instructionUz,
            totalDays: CHALLENGES.length,
        });

    } catch (error) {
        console.error("Error fetching/creating current challenge:", error);
        res.status(500).json({ error: 'Server error while managing challenge' });
    }
});

// Get all challenges history
router.get('/history', protect, async (req, res) => {
    try {
        // Find all challenges and sort by dayNumber
        const history = await Challenge.find({ user: req.user._id })
            .select('-audioData')
            .sort({ dayNumber: 1 })
            .lean();
        res.json(history);
    } catch (error) {
        console.error("Error fetching challenge history:", error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Complete a challenge
// Bu route AI chaqirmaydi (baholash mahalliy so'z mosligi), shuning uchun
// trackAiUsage olib tashlandi — ilgari foydalanuvchi bekorga limit yo'qotardi.
router.post('/complete', protect, validate(challengeCompleteSchema), async (req, res) => {
    try {
        const { challengeId, audioData, spokenText } = req.validated.body;

        const challenge = await Challenge.findOne({ _id: challengeId, user: req.user._id });
        if (!challenge) {
            return res.status(404).json({ error: 'Challenge not found' });
        }
        if (challenge.status === 'completed') {
            return res.status(400).json({ error: 'Challenge is already completed' });
        }

        if (spokenText && spokenText.trim().length > 0) {
            const evalResult = evaluateSpokenAccuracy(challenge.text, spokenText);
            challenge.score = evalResult.score;
            challenge.feedback = evalResult.feedback;
            challenge.color = evalResult.color;
            challenge.evaluationMethod = evalResult.method;
        } else {
            challenge.feedback =
                "Ovoz matnga aylantirilmadi. Mikrofon ruxsatini va internetni tekshirib, qayta urinib ko'ring.";
            challenge.score = null;
            challenge.color = 'gray';
            challenge.evaluationMethod = 'none';
        }

        if (audioData) {
            challenge.audioData = audioData;
        }
        challenge.status = 'completed';
        await challenge.save();

        // audioData'ni javobda qaytarmaymiz — mijozda allaqachon bor, bekorga trafik
        const { audioData: _omit, ...payload } = challenge.toObject();
        res.json({ message: 'Challenge completed successfully!', challenge: payload });
    } catch (error) {
        console.error("Error completing challenge:", error);
        res.status(500).json({ error: 'Server error while completing challenge' });
    }
});

module.exports = router;
