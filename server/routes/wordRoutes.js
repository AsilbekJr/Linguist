const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { generateWordContext, validateWord } = require('../services/geminiService');

// @desc    Get all words
// @route   GET /api/words
router.get('/', async (req, res) => {
    try {
        const words = await Word.find({}).sort({ createdAt: -1 });
        res.json(words);
    } catch (error) {
        console.error("Error fetching words:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Add a word (with AI context and validation)
// @route   POST /api/words
router.post('/', async (req, res) => {
    try {
        let { word } = req.body;

        if (!word) {
            return res.status(400).json({ message: 'Word is required' });
        }

        // 1. Title Case Convention (e.g., "apple" -> "Apple")
        word = word.trim().charAt(0).toUpperCase() + word.trim().slice(1).toLowerCase();

        // 2. Check Logic: Duplicate?
        const existingWord = await Word.findOne({ word });
        if (existingWord) {
            return res.status(400).json({ 
                message: `The word "${word}" is already in your list.`,
                type: 'DUPLICATE'
            });
        }

        // 3. AI Operations (Validation & Context)
        let aiContext;
        
        if (req.body.skipAI) {
            console.log("Skipping AI for:", word);
            aiContext = {
                word: word,
                definition: req.body.manualDefinition || "Definition unavailable (AI Limit Reached). You can edit this later.",
                examples: req.body.manualExamples && req.body.manualExamples.length > 0 ? req.body.manualExamples : ["Example unavailable."],
                translation: req.body.manualTranslation || "",
                collocations: [],
                fun_fact: "This word was saved manually."
            };
        } else {
            // 3.1 AI Validation
            console.log("Validating word:", word);
            let validation;
            try {
                validation = await validateWord(word);
            } catch (error) {
                if (error.type === 'QUOTA_EXCEEDED') {
                    return res.status(429).json({ message: error.message, type: 'QUOTA_EXCEEDED' });
                }
                throw error; // Rethrow for general catch
            }
            
            if (validation && validation.isValid === false) {
                 return res.status(400).json({
                     message: `"${word}" doesn't seem to be a valid English word.`,
                     type: 'INVALID',
                     suggestions: validation.suggestions || []
                 });
            }

            // 3.2 Generate Context (if valid)
            console.log("Generating context for:", word);
            try {
                aiContext = await generateWordContext(word);
            } catch (error) {
                 if (error.type === 'QUOTA_EXCEEDED') {
                    return res.status(429).json({ message: error.message, type: 'QUOTA_EXCEEDED' });
                }
                throw error;
            }

            if (!aiContext) {
                 return res.status(500).json({ message: "Failed to generate AI context" });
            }
        }

        const newWord = await Word.create({
            word: aiContext.word || word, // Use AI's capitalization if it differs
            definition: aiContext.definition,
            translation: aiContext.translation || req.body.manualTranslation || "",
            examples: aiContext.examples,
            collocations: aiContext.collocations,
            fun_fact: aiContext.fun_fact,
            mastered: false
        });

        console.log("Word saved to DB:", newWord.word);
        res.status(201).json(newWord);

    } catch (error) {
        console.error("Add Word Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Delete a word
// @route   DELETE /api/words/:id
router.delete('/:id', async (req, res) => {
    try {
        const word = await Word.findById(req.params.id);

        if (!word) {
            return res.status(404).json({ message: 'Word not found' });
        }

        await word.deleteOne();
        res.json({ message: 'Word removed', id: req.params.id });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
