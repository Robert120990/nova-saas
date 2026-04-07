const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const models = [
        'gemini-2.5-flash', 
        'gemini-2.5-flash-lite', 
        'gemini-2.0-flash', 
        'gemini-2.0-flash-lite',
        'gemini-2-flash',
        'gemini-2-flash-lite',
        'gemini-1.5-flash'
    ];
    
    console.log('--- Testing Models (Current Year: 2026) ---');
    for (const m of models) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            await model.generateContent("test");
            console.log(`✅ [${m}] is WORKING`);
        } catch (e) {
            console.log(`❌ [${m}] failed: ${e.message}`);
        }
    }
}

listModels();
