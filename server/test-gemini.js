require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelName = "gemini-flash-latest"; // Trying alternative model

    console.log(`Testing: ${modelName}`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Explain 'serendipity' in one sentence.");
        const response = await result.response;
        console.log(`✅ SUCCESS with ${modelName}`);
        console.log("Response:", response.text());
    } catch (error) {
        console.log(`❌ FAILED with ${modelName}:`, error.message);
    }
}

testGemini();
