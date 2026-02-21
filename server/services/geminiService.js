const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize lazily or check for key
let genAI;
try {
    if (process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
} catch (error) {
    console.warn("Gemini Client Init Failed:", error.message);
}

const fs = require('fs');
const path = require('path');

const logError = (context, error) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${context}: ${error.message || error}\n${error.stack || ''}\n\n`;
    try {
        fs.appendFileSync(path.join(__dirname, '../server_error.log'), logMessage);
    } catch (e) {
        console.error("Failed to write to log file:", e);
    }
};

const generateWordContext = async (word) => {
    try {
        console.log("Generating context for:", word);
        if (!genAI) {
            console.warn("Gemini API Key missing or client not initialized. Returning mock data.");
            return null; 
        }

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        Act as an expert linguist and English teacher.
        Analyze the word: "${word}".
        Return a JSON object with this EXACT structure (no markdown, just raw JSON):
        {
            "word": "${word}",
            "definition": "A clear, concise definition tailored for an intermediate learner.",
            "translation": "The direct Uzbek (O'zbek tili) translation of this word.",
            "examples": ["Example sentence 1.", "Example sentence 2."],
            "collocations": ["collocation 1", "collocation 2", "collocation 3"],
            "fun_fact": "A short, interesting fact or memory aid about the word."
        }
        `;

        console.log("Calling Gemini API...");
        const result = await model.generateContent(prompt);
        console.log("Gemini API responded. Processing...");
        const response = await result.response;
        const text = response.text();
        console.log("Raw text received:", text);
        
        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Gemini API Error:", error);
        logError("generateWordContext", error);
        if (error.message.includes("429") || error.message.includes("Quota exceeded")) {
            throw { type: 'QUOTA_EXCEEDED', message: 'AI Quota Exceeded. Please try again later.' };
        }
        return null;
    }
};

const analyzeStory = async (story, targetWords) => {
    try {
        if (!genAI) return null;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        Act as a creative writing coach and linguist.
        Analyze the following short story: "${story}"
        Target words to check: ${JSON.stringify(targetWords)}

        Return a JSON object with this EXACT structure (no markdown):
        {
            "vibeScore": 85, // 0-100 based on creativity and flow
            "tone": "Describe the tone (e.g., Melancholic, Upbeat, Mystery)",
            "suggestions": ["Specific improvement 1", "Specific improvement 2"],
            "vocabularyUsage": {
                "word1": "Correct/Incorrect",
                "word2": "Correct/Incorrect"
            }
        }
        `;

        console.log("Analyze Story: Calling Gemini API...");
        const result = await model.generateContent(prompt);
        console.log("Analyze Story: Gemini Responded.");
        const response = await result.response;
        const text = response.text();
        console.log("Analyze Story: Raw text:", text);

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Gemini Story Analysis Error:", error);
        logError("analyzeStory", error);
        return null;
    }
};

const checkSentence = async (word, sentence) => {
    try {
        if (!genAI) return null;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        Act as an English teacher.
        Check if the word "${word}" is used correctly in this sentence: "${sentence}".
        Ignore minor punctuation errors. Focus on the meaning and context of the target word.
        
        Return a JSON object with this EXACT structure (no markdown):
        {
            "isCorrect": true, // or false
            "feedback": "A short, encouraging explanation of why it is correct or incorrect."
        }
        `;

        console.log("Check Sentence: Calling Gemini API...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Gemini Check Sentence Error:", error);
        logError("checkSentence", error);
        return { isCorrect: false, feedback: "AI service unavailable. Please try again." }; 
    }
};

const validateWord = async (word) => {
    try {
        if (!genAI) return null;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        Act as a strict English dictionary editor.
        Check if the word "${word}" is a valid, standard English word found in a specified dictionary (like Oxford or Merriam-Webster).
        
        Rules:
        1. If it is gibberish (e.g., "asdf", "sdjkhfg"), return isValid: false.
        2. If it is a proper noun (name of person/place) but not a dictionary word, return isValid: false.
        3. If it is a very common slang term (e.g., "selfie"), it CAN be valid, but obscure slang should be invalid.
        4. If misspelled, return isValid: false and provide corrected suggestions.

        Return a JSON object with this EXACT structure (no markdown):
        {
            "isValid": true, // or false
            "suggestions": ["suggestion1", "suggestion2", "suggestion3"] // Only if isValid is false
        }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Gemini Validation Error:", error);
        logError("validateWord", error);
        if (error.message.includes("429") || error.message.includes("Quota exceeded")) {
            throw { type: 'QUOTA_EXCEEDED', message: 'AI Quota Exceeded. Please try again later.' };
        }
        return null; 
    }
};

const translateUzbekToEnglish = async (uzbekText) => {
    try {
        if (!genAI) return null;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        Act as a professional Uzbek-to-English translator and language coach.
        Translate this Uzbek text into natural English: "${uzbekText}"
        Provide two English versions:
        1. "casual": How a native speaker would naturally say this in everyday conversation.
        2. "advanced": A more formal, vocabulary-rich version.

        Return a JSON object with this EXACT structure (no markdown):
        {
            "casual": "...",
            "advanced": "..."
        }
        `;

        console.log("Speaking Translate: Calling Gemini API...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Gemini Speaking Translate Error:", error);
        logError("translateUzbekToEnglish", error);
        if (error.message.includes("429") || error.message.includes("Quota exceeded")) {
            throw { type: 'QUOTA_EXCEEDED', message: 'AI Quota Exceeded. Please try again later.' };
        }
        return null;
    }
};

module.exports = { generateWordContext, analyzeStory, checkSentence, validateWord, translateUzbekToEnglish };
