const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class AIService {
    constructor() {
        this.deepseek = process.env.DEEPSEEK_API_KEY
            ? new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY })
            : null;
        this.gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
    }

    async getChatCompletion({ messages, tools, systemPrompt }) {
        let lastError = null;

        if (this.deepseek) {
            try {
                console.log('[AI Service] Attempting completion with DeepSeek...');
                const response = await this.deepseek.chat.completions.create({
                    model: "deepseek-chat",
                    messages: [{ role: "system", content: systemPrompt }, ...messages],
                    tools: tools.map(t => ({ type: "function", function: t })),
                    tool_choice: "auto"
                });
                return { provider: 'deepseek', data: response.choices[0].message };
            } catch (error) {
                lastError = error;
                console.error('[AI Service] DeepSeek failed:', error.status, error.message);
            }
        }

        if (this.gemini) {
            try {
                console.log('[AI Service] Falling back to Gemini (using gemini-3.6-flash)...');
                const model = this.gemini.getGenerativeModel({
                    model: "gemini-3.6-flash",
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

                if (error.message.includes('429') || error.message.includes('Quota')) {
                    throw new Error('Novas AI está un poco saturado por ahora. Por favor, espera unos 30 segundos e intenta de nuevo.');
                }

                const msg = error.message.includes('404') ? 'Modelo no disponible (404)' : error.message;
                throw new Error('Lo siento, Novas AI técnico ha ocurrido un error: ' + msg);
            }
        }

        throw lastError || new Error('No hay motores de búsqueda configurados.');
    }

    async getFinalResponse(provider, { messages, systemPrompt, toolResults }) {
        try {
            const client = provider === 'deepseek' ? this.deepseek : this.gemini;
            if (provider === 'deepseek') {
                const response = await client.chat.completions.create({
                    model: "deepseek-chat",
                    messages: [{ role: "system", content: systemPrompt }, ...messages, ...toolResults]
                });
                return response.choices[0].message;
            } else {
                console.log('[AI Service] Generating final Gemini response...');
                const model = this.gemini.getGenerativeModel({
                    model: "gemini-3.6-flash",
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

    async extractDteFromImage(imageBuffer, mimeType = 'image/jpeg') {
        if (!this.gemini) {
            throw new Error('El servicio de IA no está configurado (falta GEMINI_API_KEY).');
        }

        const model = this.gemini.getGenerativeModel({ model: 'gemini-3.6-flash' });
        const base64Data = imageBuffer.toString('base64');

        const prompt = `Eres un asistente contable experto en Documentos Tributarios Electrónicos (DTE) de El Salvador del Ministerio de Hacienda.
Analiza con máxima precisión la imagen de este DTE, factura o comprobante de crédito fiscal.

Extrae TODOS los campos visibles y responde EXCLUSIVAMENTE con un JSON válido y estricto (sin bloques markdown ni explicaciones adicionales):
{
  "codigo_generacion": "Código de generación en mayúsculas (UUID de 36 caracteres: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)",
  "numero_control": "Número de control oficial (ejemplo: DTE-03-M001P003-000000000002053 o DTE-01-...)",
  "sello_recepcion": "Sello de recepción oficial otorgado por Hacienda (cadena de 40 caracteres)",
  "fecha_emision": "Fecha de emisión en formato YYYY-MM-DD si es visible, o null",
  "tipo_documento_id": "03 para Crédito Fiscal (CCF), 01 para Factura, 05 para Nota de Crédito, 06 para Nota de Débito",
  "tipo_documento_nombre": "Nombre descriptivo del tipo de documento",
  "emisor": {
    "nombre": "Nombre o Razón Social del emisor / proveedor si es visible, o null",
    "nit": "NIT del emisor si es visible, o null",
    "nrc": "NRC del emisor si es visible, o null"
  },
  "totales": {
    "total_gravada": 0.0,
    "total_exenta": 0.0,
    "total_nosujeta": 0.0,
    "iva": 0.0,
    "retencion": 0.0,
    "percepcion": 0.0,
    "monto_total": 0.0
  }
}

REGLAS:
- Si un campo no es visible o está cortado en la foto, asígnalo como null (o 0.0 en valores numéricos).
- Asegúrate de que el código de generación y número de control estén en MAYÚSCULAS y limpios de espacios.
- IMPORTANTE: Tanto el código de generación (UUID) como el sello de recepción de Hacienda están compuestos ÚNICAMENTE por caracteres hexadecimales (dígitos 0-9 y letras A-F). En caracteres hexadecimales NUNCA existe la letra 'O'; si ves una forma redonda es el número cero '0'.
- El sello de recepción debe contener todos los caracteres visibles sin espacios.`;

        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType || 'image/jpeg'
                }
            },
            prompt
        ]);

        const rawText = result.response.text();
        const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        // Normalización post-procesamiento para evitar errores comunes de OCR en caracteres hexadecimales
        if (parsed.codigo_generacion) {
            let cg = String(parsed.codigo_generacion).trim().toUpperCase();
            cg = cg.replace(/O/g, '0');
            parsed.codigo_generacion = cg;
        }

        if (parsed.sello_recepcion) {
            let sr = String(parsed.sello_recepcion).trim().toUpperCase().replace(/\s+/g, '');
            sr = sr.replace(/O/g, '0');
            parsed.sello_recepcion = sr;
        }

        if (parsed.numero_control) {
            parsed.numero_control = String(parsed.numero_control).trim().toUpperCase().replace(/\s+/g, '');
        }

        return parsed;
    }
}

module.exports = new AIService();
