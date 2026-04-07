const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        console.log('Fetching models...');
        // The listModels method is not available on the genAI object directly in some versions
        // We might need to use the REST API or check the environment.
        // Actually, let's try a common ones that might be in their list.
        const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite-preview-02-05', 'gemini-2.0-flash-exp'];
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                // We just try to get a small response to see if it exists
                const result = await model.generateContent("test");
                console.log(`✅ Model ${m} is AVAILABLE`);
            } catch (e) {
                console.log(`❌ Model ${m} is NOT available: ${e.message}`);
            }
        }
    } catch (err) {
        console.error('Error listing models:', err);
    }
}

listModels();
