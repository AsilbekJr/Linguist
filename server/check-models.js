const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
dotenv.config();

const modelsToTest = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-pro",
    "gemini-1.0-pro",
    "gemini-flash-latest" 
];

async function testModel(modelName) {
    try {
        console.log(`Testing ${modelName}...`);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Test.");
        const response = await result.response;
        console.log(`✅ SUCCESS: ${modelName} works!`);
        return true;
    } catch (error) {
        console.log(`❌ FAILED: ${modelName} - ${error.message.split('\n')[0]}`);
        return false;
    }
}

async function runTests() {
    console.log("Starting Model Availability Check...");
    for (const model of modelsToTest) {
        await testModel(model);
    }
    console.log("Check Complete.");
}

runTests();
