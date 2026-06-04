const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { checkSentence } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');
const { validate, reviewCheckSchema } = require('../middleware/validate');
const { trackAiUsage } = require('../middleware/usageQuota');

const applySrsResult = (wordDoc, isCorrect) => {
    let nextReview = new Date();
    let isMastered = false;

    if (isCorrect) {
        const stages = [1, 3, 7, 14, 30];
        const currentStage = wordDoc.reviewStage || 0;

        if (currentStage >= stages.length) {
            isMastered = true;
            nextReview = null;
        } else {
            const daysToAdd = stages[currentStage];
            nextReview.setDate(nextReview.getDate() + daysToAdd);
        }

        wordDoc.reviewStage = currentStage + 1;
        wordDoc.mastered = isMastered;
        wordDoc.nextReviewDate = nextReview;
    } else {
        nextReview.setDate(nextReview.getDate() + 1);
        wordDoc.reviewStage = Math.max(0, (wordDoc.reviewStage || 0) - 1);
        wordDoc.nextReviewDate = nextReview;
    }
};

// @desc    Get words due for review
// @route   GET /api/review/due
router.get('/due', protect, async (req, res) => {
    try {
        const now = new Date();
        
        const dueWords = await Word.find({
            user: req.user._id,
            $or: [
                { nextReviewDate: { $lte: now } },
                { nextReviewDate: { $exists: false } },
                { nextReviewDate: null }
            ],
            mastered: false // Don't review mastered words yet
        }).sort({ nextReviewDate: 1 }).limit(10); // Limit to 10 at a time

        res.json(dueWords);
    } catch (error) {
        console.error("Fetch Due Words Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// @desc    Check a sentence for a word and update SRS stage
// @route   POST /api/review/:id/check
router.post('/:id/check', protect, validate(reviewCheckSchema), trackAiUsage, async (req, res) => {
    const { sentence } = req.validated.body;
    const wordId = req.validated.params.id;

    if (!sentence) {
        return res.status(400).json({ message: "Sentence is required" });
    }

    try {
        const wordDoc = await Word.findOne({ _id: wordId, user: req.user._id });
        if (!wordDoc) {
            return res.status(404).json({ message: "Word not found" });
        }

        // 1. Check with AI
        let aiResult = {
            isCorrect: false,
            feedback: "AI tekshirishida xatolik yuz berdi."
        };

        try {
            const learnerLevel = req.user.onboarding?.level || 'beginner';
            const result = await checkSentence(wordDoc.word, sentence, learnerLevel);
            if (result) {
                aiResult = result;
            }
        } catch (error) {
             console.error("AI Check Error:", error);
             aiResult.feedback = "AI xizmatiga ulanib bo'lmadi. Iltimos keyinroq qayta urinib ko'ring.";
        }
        
        applySrsResult(wordDoc, aiResult && aiResult.isCorrect);
        await wordDoc.save();

        res.json({
            ...aiResult,
            wordId: wordDoc._id,
            nextReviewDate: wordDoc.nextReviewDate,
            mastered: wordDoc.mastered
        });

    } catch (error) {
        console.error("Review Check Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// @desc    Quick review without AI (flashcard / quiz)
// @route   POST /api/review/:id/quick
router.post('/:id/quick', protect, async (req, res) => {
    const { known } = req.body;
    if (typeof known !== 'boolean') {
        return res.status(400).json({ message: 'known (boolean) is required' });
    }

    try {
        const wordDoc = await Word.findOne({ _id: req.params.id, user: req.user._id });
        if (!wordDoc) {
            return res.status(404).json({ message: 'Word not found' });
        }

        applySrsResult(wordDoc, known);
        await wordDoc.save();

        res.json({
            isCorrect: known,
            wordId: wordDoc._id,
            nextReviewDate: wordDoc.nextReviewDate,
            mastered: wordDoc.mastered,
        });
    } catch (error) {
        console.error('Quick review error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
