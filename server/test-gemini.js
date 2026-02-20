require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    console.log("Testing Gemini API...");
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Try gemini-flash-latest first
        let modelName = "gemini-flash-latest";
        console.log(`Using model: ${modelName}`);
        let model = genAI.getGenerativeModel({ model: modelName });
        
        let prompt = "Explain the word 'serendipity' briefly.";
        let result = await model.generateContent(prompt);
        let response = await result.response;
        console.log("Response from gemini-flash-latest:", response.text());
        
    } catch (error) {
        console.error("Error with gemini-flash-latest:", error.message);
    }
}

testGemini();
