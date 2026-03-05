const express = require('express');
const router = express.Router();
const Word = require('../models/Word');
const { generateWordContext, validateWord } = require('../services/geminiService');
const { protect } = require('../middleware/authMiddleware');

// @desc    Get all words
// @route   GET /api/words
router.get('/', protect, async (req, res) => {
    try {
        const words = await Word.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(words);
    } catch (error) {
        console.error("Error fetching words:", error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Add a word (with AI context and validation)
// @route   POST /api/words
router.post('/', protect, async (req, res) => {
    try {
        let { word } = req.body;

        if (!word) {
            return res.status(400).json({ message: 'Word is required' });
        }

        // 1. Title Case Convention (e.g., "apple" -> "Apple")
        word = word.trim().charAt(0).toUpperCase() + word.trim().slice(1).toLowerCase();

        // 2. Check Logic: Duplicate?
        const existingWord = await Word.findOne({ word, user: req.user._id });
        if (existingWord) {
            return res.status(400).json({ 
                message: `The word "${word}" is already in your list.`,
                type: 'DUPLICATE'
            });
        }

        // 3. AI Operations (Validation & Context)
        let aiContext;
        
        // 3.0 Check local dictionary JSON first
        let foundInLocalDict = false;
        try {
            const staticDict = require('../data/dictionary.json');
            const localMatch = staticDict.find(item => item.word.toLowerCase() === word.toLowerCase());
            if (localMatch) {
                console.log(`Word "${word}" found in local JSON dictionary. Skipping AI.`);
                aiContext = { ...localMatch };
                foundInLocalDict = true;
            }
        } catch (err) {
            console.warn("Could not load local dictionary.json:", err.message);
        }

        if (req.body.skipAI && !foundInLocalDict) {
            console.log("Skipping AI for:", word);
            aiContext = {
                word: word,
                definition: req.body.manualDefinition || "Definition unavailable (AI Limit Reached). You can edit this later.",
                examples: req.body.manualExamples && req.body.manualExamples.length > 0 ? req.body.manualExamples : ["Example unavailable."],
                translation: req.body.manualTranslation || "",
                collocations: [],
                fun_fact: "This word was saved manually."
            };
        } else if (!foundInLocalDict) {
            console.log("Fetching definition from Free Dictionary API for:", word);
            try {
                // Use built-in fetch since Node 18+
                const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        return res.status(400).json({
                            message: `"${word}" doesn't seem to be a valid English word or no definition found.`,
                            type: 'INVALID',
                            suggestions: []
                        });
                    }
                    throw new Error(`Dictionary API error: ${response.status}`);
                }
                
                const data = await response.json();
                const entry = data[0];
                
                // Extract best definition
                let definition = "Definition unavailable.";
                let example = "Example unavailable.";
                let partOfSpeech = "unknown verb/noun";
                
                if (entry.meanings && entry.meanings.length > 0) {
                    partOfSpeech = entry.meanings[0].partOfSpeech;
                    const defObj = entry.meanings[0].definitions[0];
                    if (defObj) {
                        definition = defObj.definition;
                        if (defObj.example) {
                            example = defObj.example;
                        }
                    }
                }
                
                // Extract phonetic
                let phonetic = entry.phonetic || "";
                if (!phonetic && entry.phonetics && entry.phonetics.length > 0) {
                    const backupPhonetic = entry.phonetics.find(p => p.text);
                    if (backupPhonetic) phonetic = backupPhonetic.text;
                }

                aiContext = {
                    word: entry.word || word,
                    phonetic: phonetic,
                    definition: `(${partOfSpeech}) ${definition}`,
                    translation: req.body.manualTranslation || "", // We don't have free translation API here, require manual or leave blank
                    examples: example !== "Example unavailable." ? [example] : [],
                    collocations: [],
                    fun_fact: "Word found in standard Oxford dictionary."
                };
                
            } catch (error) {
                console.error("Dictionary API Fetch error:", error);
                // Fallback to manual mode if API totally fails
                console.log("Falling back to manual save for:", word);
                aiContext = {
                    word: word,
                    definition: req.body.manualDefinition || "Definition unavailable (API failed). You can edit this later.",
                    examples: req.body.manualExamples && req.body.manualExamples.length > 0 ? req.body.manualExamples : ["Example unavailable."],
                    translation: req.body.manualTranslation || "",
                    collocations: [],
                    fun_fact: "Saved via fallback mechanism."
                };
            }
        }

        const newWord = await Word.create({
            user: req.user._id,
            word: aiContext.word || word, // Use AI's capitalization if it differs
            phonetic: aiContext.phonetic || "",
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
router.delete('/:id', protect, async (req, res) => {
    try {
        const word = await Word.findOne({ _id: req.params.id, user: req.user._id });

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
