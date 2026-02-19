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
            "examples": ["Example sentence 1.", "Example sentence 2."],
            "collocations": ["collocation 1", "collocation 2", "collocation 3"],
            "fun_fact": "A short, interesting fact or memory aid about the word."
        }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Gemini API Error:", error);
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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Gemini Story Analysis Error:", error);
        return null;
    }
};

module.exports = { generateWordContext, analyzeStory };
