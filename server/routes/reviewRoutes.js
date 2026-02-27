const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { checkSentence } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');

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
router.post('/:id/check', protect, async (req, res) => {
    const { sentence } = req.body;
    const wordId = req.params.id;

    if (!sentence) {
        return res.status(400).json({ message: "Sentence is required" });
    }

    try {
        const wordDoc = await Word.findOne({ _id: wordId, user: req.user._id });
        if (!wordDoc) {
            return res.status(404).json({ message: "Word not found" });
        }

        // 1. Check with AI
        const aiResult = await checkSentence(wordDoc.word, sentence); // { isCorrect, feedback }
        
        // If AI failed due to quota/network, do not penalize the user or update SRS stages
        if (aiResult && aiResult.feedback === "AI service unavailable. Please try again.") {
            return res.json({
                ...aiResult,
                wordId: wordDoc._id,
                nextReviewDate: wordDoc.nextReviewDate,
                mastered: wordDoc.mastered
            });
        }
        
        // 2. SRS Logic
        let nextReview = new Date();
        let isMastered = false;

        if (aiResult && aiResult.isCorrect) {
            // Success: Increase stage
            // Stages (days): 0 -> 1 -> 3 -> 7 -> 14 -> 30 -> Mastered
            const stages = [1, 3, 7, 14, 30];
            const currentStage = wordDoc.reviewStage || 0;
            
            if (currentStage >= stages.length) {
                isMastered = true;
                nextReview = null; // No more reviews
            } else {
                const daysToAdd = stages[currentStage];
                nextReview.setDate(nextReview.getDate() + daysToAdd);
            }

            wordDoc.reviewStage = currentStage + 1;
            wordDoc.mastered = isMastered;
            wordDoc.nextReviewDate = nextReview;

        } else {
            // Failure: Reset stage or keep same?
            // Let's keep it simple: Reset to 0 or 1.
            // "Penalize" by setting review to tomorrow (Stage 0 logic essentially)
            nextReview.setDate(nextReview.getDate() + 1);
            wordDoc.reviewStage = Math.max(0, (wordDoc.reviewStage || 0) - 1); // Decrease stage slightly
            wordDoc.nextReviewDate = nextReview;
        }

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

module.exports = router;
