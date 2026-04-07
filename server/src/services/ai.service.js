const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

/**
 * AI Service
 * Manages multiple AI providers (OpenAI, Gemini) with automatic fallback.
 */
class AIService {
    constructor() {
        this.openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
        this.gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
    }

    /**
     * Get a completion from the best available provider
     */
    async getChatCompletion({ messages, tools, systemPrompt }) {
        let lastError = null;

        // 1. Try OpenAI first (if configured)
        if (this.openai && !process.env.FORCE_GEMINI) {
            try {
                console.log('[AI Service] Attempting completion with OpenAI...');
                const response = await this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [{ role: "system", content: systemPrompt }, ...messages],
                    tools: tools.map(t => ({ type: "function", function: t })),
                    tool_choice: "auto"
                });
                return { provider: 'openai', data: response.choices[0].message };
            } catch (error) {
                lastError = error;
                console.error('[AI Service] OpenAI failed:', error.status, error.message);
                
                // If it's a quota or billing error, definitely fallback.
                if (error.status === 429 || error.status === 401) {
                    console.log('[AI Service] Quota/Auth issue detected. Proceeding to Gemini fallback.');
                }
            }
        }

        // 2. Fallback to Gemini
        if (this.gemini) {
            try {
                console.log('[AI Service] Falling back to Gemini (using gemini-2.5-flash-lite)...');
                const model = this.gemini.getGenerativeModel({ 
                    model: "gemini-2.5-flash-lite",
                    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
                });

                const geminiTools = tools.map(t => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters
                }));

                const history = messages.slice(0, -1);
                const firstUserIndex = history.findIndex(m => m.role === 'user');
                const cleanedHistory = firstUserIndex !== -1 ? history.slice(firstUserIndex) : [];

                const chat = model.startChat({
                    history: cleanedHistory.map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content || '' }]
                    })),
                    tools: [{ functionDeclarations: geminiTools }]
                });

                const lastMsg = messages[messages.length - 1].content;
                const result = await chat.sendMessage(lastMsg);
                const response = result.response;
                
                // Extraer llamadas a funciones
                const candidate = response.candidates?.[0];
                const parts = candidate?.content?.parts || [];
                const calls = parts.filter(p => p.functionCall);

                if (calls && calls.length > 0) {
                    return {
                        provider: 'gemini',
                        data: {
                            role: 'assistant',
                            content: null,
                            tool_calls: calls.map((c, i) => ({
                                id: `call_${Date.now()}_${i}`,
                                function: { 
                                    name: c.functionCall.name, 
                                    arguments: JSON.stringify(c.functionCall.args) 
                                }
                            }))
                        }
                    };
                }

                return {
                    provider: 'gemini',
                    data: { role: 'assistant', content: response.text() }
                };
            } catch (error) {
                console.error('[AI Service] Gemini also failed:', error.message);
                
                // Friendly error for rate limits (429)
                if (error.message.includes('429') || error.message.includes('Quota')) {
                    throw new Error('Novas AI está un poco saturado por ahora. Por favor, espera unos 30 segundos e intenta de nuevo.');
                }

                const msg = error.message.includes('404') ? 'Modelo no disponible (404)' : error.message;
                throw new Error('Lo siento, Novas AI técnico ha ocurrido un error: ' + msg);
            }
        }

        throw lastError || new Error('No hay motores de búsqueda configurados.');
    }

    /**
     * Specialized call for Gemini when tools are already executed (final response)
     */
    async getFinalResponse(provider, { messages, systemPrompt, toolResults }) {
        try {
            if (provider === 'openai') {
                const response = await this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [{ role: "system", content: systemPrompt }, ...messages, ...toolResults]
                });
                return response.choices[0].message;
            } else {
                console.log('[AI Service] Generating final Gemini response...');
                const model = this.gemini.getGenerativeModel({ 
                    model: "gemini-2.5-flash-lite", 
                    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
                });
                
                const findings = toolResults.map(t => {
                    const parsed = JSON.parse(t.content);
                    return `=== RESULTADO DE CONSULTA SQL ===\n${JSON.stringify(parsed, null, 2)}`;
                }).join('\n\n');

                const finalPrompt = `DATOS OBTENIDOS DE LA BASE DE DATOS:\n\n${findings}\n\nCon base en estos datos, responde la pregunta del usuario de forma profesional y en español.\nIMPORTANTE:\n- Nunca menciones IDs numéricos en tu respuesta (usa solo los nombres).\n- Formatea los montos monetarios con símbolo $ y 2 decimales.\n- Si hay múltiples registros, preséntalo como una lista o resumen claro.\n- No menciones el SQL ni tecnicismos de base de datos.`;
                const result = await model.generateContent(finalPrompt);
                return { role: 'assistant', content: result.response.text() };
            }
        } catch (error) {
            console.error('[AI Service] Final response failed:', error.message);
            if (error.message.includes('429')) {
                return { role: 'assistant', content: 'He obtenido los datos, pero estoy teniendo problemas para procesarlos ahora mismo por límites de tráfico. Por favor, intenta de nuevo en unos segundos.' };
            }
            throw error;
        }
    }
}

module.exports = new AIService();
