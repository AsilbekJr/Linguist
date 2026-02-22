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
            "feedback": "A short, encouraging explanation in **Uzbek** (O'zbek tili) of why it is correct or incorrect. MUST BE IN UZBEK."
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

const evaluatePronunciation = async (targetSentence, spokenText) => {
    try {
        if (!genAI) return null;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `
        Act as a strict English pronunciation and speech accuracy coach.
        You are evaluating how well a student read a target sentence out loud.
        
        Target Sentence (What they were supposed to say): "${targetSentence}"
        Student's Audio Transcript (What they actually said): "${spokenText}"
        
        Compare the transcript to the target sentence. Ignore minor punctuation, but strictly penalize missing words, completely wrong words, or heavily mispronounced words that altered the transcript meaning.
        
        Return a JSON object with this EXACT structure (no markdown):
        {
            "score": 85, // Integer from 0 to 100 representing accuracy.
            "feedback": "Short feedback in Uzbek explaining exactly what they got right, or what specific words they missed/mispronounced.",
            "color": "green" // Use 'green' if score >= 90, 'yellow' if between 50-89, 'red' if < 50
        }
        `;

        console.log("Speaking Validate: Calling Gemini API...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Gemini Speaking Validate Error:", error);
        logError("evaluatePronunciation", error);
        if (error.message.includes("429") || error.message.includes("Quota exceeded")) {
             throw { type: 'QUOTA_EXCEEDED', message: 'AI Quota Exceeded. Please try again later.' };
        }
        return null;
    }
};

const generateRoleplayResponse = async (scenario, targetWords, chatHistory, userMessage) => {
    try {
        if (!genAI) return null;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        
        // Format chat history for context
        const historyText = chatHistory.map(msg => `${msg.role === 'user' ? 'User' : 'You'}: ${msg.content}`).join('\n');
        const wordsList = targetWords.join(", ");

        const prompt = `
        You are an AI actor participating in an immersive English learning roleplay.
        
        Scenario: ${scenario}
        Target Vocabulary Words the user is currently learning: [${wordsList}]
        
        Your Instructions:
        1. Adopt a persona that fits the Scenario (e.g., if Cafe, you are the barista).
        2. Keep the conversation natural, engaging, and relatively short (1-3 sentences per turn).
        3. ALWAYS respond in English.
        4. CRITICAL: Try your best to seamlessly weave at least ONE of the Target Vocabulary Words into your response to expose the user to it in context.
        5. If the user makes a major grammatical error in their last message, provide a very concise, friendly correction at the end of your response inside parentheses in UZBEK (e.g., "(Maslahat: I am going dedingiz, I go deyish tabiiyroq)").

        Current Conversation History:
        ${historyText}

        User's Latest Message:
        "${userMessage}"
        
        Reply naturally to the user's latest message as your character. Do not use JSON, just return the raw text response.
        `;

        console.log("Roleplay: Calling Gemini API...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();

    } catch (error) {
        console.error("Gemini Roleplay Error:", error);
        logError("generateRoleplayResponse", error);
        if (error.message.includes("429") || error.message.includes("Quota exceeded")) {
             throw { type: 'QUOTA_EXCEEDED', message: 'AI Quota Exceeded. Please try again later.' };
        }
        return "Kechirasiz, men hozir javob bera olmayman. Keling boshqatdan urinib ko'ramiz (AI Error).";
    }
};

module.exports = { generateWordContext, analyzeStory, checkSentence, validateWord, translateUzbekToEnglish, evaluatePronunciation, generateRoleplayResponse };
