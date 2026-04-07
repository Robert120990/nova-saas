const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function findWorkingModel() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const models = [
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
    ];
    
    let report = '';
    for (const m of models) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            await model.generateContent("hi");
            report += `YES:${m}\n`;
        } catch (e) {
            report += `NO:${m}:${e.message.substring(0, 30)}\n`;
        }
    }
    require('fs').writeFileSync('working_models.txt', report);
    console.log('DONE');
}

findWorkingModel();
