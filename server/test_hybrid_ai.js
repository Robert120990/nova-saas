const aiService = require('./src/services/ai.service');
require('dotenv').config();

async function testHybrid() {
    const messages = [{ role: 'user', content: 'cuanto vendi hoy?' }];
    const tools = [
        {
            name: "get_general_stats",
            description: "Obtiene estadísticas generales de ventas (hoy, mes) y conteos de clientes/productos para la sucursal actual.",
            parameters: { type: "object", properties: {} }
        }
    ];
    const systemPrompt = "Eres un analista de datos.";

    try {
        const res = await aiService.getChatCompletion({ messages, tools, systemPrompt });
        console.log('PROVIDER:', res.provider);
        console.log('DATA:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.error('FINAL ERROR:', e.message);
    }
}
testHybrid();
