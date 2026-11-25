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
                const msg = response.choices[0].message;
                if (!msg.tool_calls || msg.tool_calls.length === 0) {
                    const extracted = this.extractDsmlToolCalls(msg.content);
                    if (extracted && extracted.length > 0) {
                        msg.tool_calls = extracted;
                    }
                }
                if (msg.content) {
                    msg.content = this.cleanDsmlContent(msg.content);
                }
                return { provider: 'deepseek', data: msg };
            } catch (error) {
                lastError = error;
                console.error('[AI Service] DeepSeek failed:', error.status, error.message);
            }
        }

        if (this.gemini) {
            try {
                console.log('[AI Service] Falling back to Gemini (using gemini-flash-lite-latest)...');
                const model = this.gemini.getGenerativeModel({
                    model: "gemini-flash-lite-latest",
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
                    history: cleanedHistory.map(m => {
                        let text = m.content || '';
                        if (m.role === 'tool') {
                            text = `[Resultado de herramienta ${m.name || ''}]: ${m.content || ''}`;
                        } else if (m.role === 'assistant' && m.tool_calls) {
                            text = text || `[Llamada a herramientas: ${m.tool_calls.map(tc => tc.function?.name).join(', ')}]`;
                        }
                        return {
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text }]
                        };
                    }),
                    tools: [{ functionDeclarations: geminiTools }]
                });

                const lastItem = messages[messages.length - 1];
                let lastMsg = lastItem?.content || '';
                if (lastItem?.role === 'tool') {
                    lastMsg = `[Resultado de herramienta ${lastItem.name || ''}]: ${lastItem.content || ''}`;
                }
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

    extractDsmlToolCalls(content) {
        if (!content) return null;
        const calls = [];

        // 1. Sintaxis DSML: < | | DSML | | invoke name="execute_sql_query"> ...
        const dsmlRegex = /<\s*\|\s*\|\s*DSML\s*\|\s*\|\s*invoke\s+name=["']([^"']+)["']>([\s\S]*?)(?:<\s*\/\s*\|\s*\|\s*DSML\s*\|\s*\|\s*invoke\s*>|<\s*\/\s*\|\s*\|\s*DSML\s*\|?|$)/gi;
        let match;
        while ((match = dsmlRegex.exec(content)) !== null) {
            const name = match[1];
            const body = match[2];
            const paramRegex = /<\s*\|\s*\|\s*DSML\s*\|\s*\|\s*parameter\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)(?:<\s*\/\s*\|\s*\|\s*DSML\s*\|\s*\|\s*parameter\s*>|<\s*\/\s*\|\s*\|\s*DSML\s*\|?|$)/gi;
            const args = {};
            let pMatch;
            while ((pMatch = paramRegex.exec(body)) !== null) {
                args[pMatch[1]] = pMatch[2].trim();
            }
            calls.push({
                id: `call_${Date.now()}_${calls.length}`,
                type: 'function',
                function: {
                    name,
                    arguments: JSON.stringify(args)
                }
            });
        }

        // 2. Sintaxis Tool Pipe: <｜tool call begin｜>function<｜tool sep｜>...
        if (calls.length === 0) {
            const toolPipeRegex = /<[|｜]tool call begin[|｜]>\s*function\s*<[|｜]tool sep[|｜]>\s*([a-zA-Z0-9_]+)\s*\n*```(?:json)?\s*([\s\S]*?)\s*```\s*<[|｜]tool call end[|｜]>/gi;
            let pPipe;
            while ((pPipe = toolPipeRegex.exec(content)) !== null) {
                calls.push({
                    id: `call_${Date.now()}_${calls.length}`,
                    type: 'function',
                    function: {
                        name: pPipe[1],
                        arguments: pPipe[2].trim()
                    }
                });
            }
        }

        return calls.length > 0 ? calls : null;
    }

    cleanDsmlContent(text) {
        if (!text || typeof text !== 'string') return text;
        const cleaned = text
            .replace(/<\s*\|\s*\|\s*DSML\s*\|\s*\|\s*calls>[\s\S]*?(?:<\s*\/\s*\|\s*\|\s*DSML\s*\|\s*\|\s*calls>|<\s*\/\s*\|\s*\|\s*DSML\s*\|?|$)/gi, '')
            .replace(/<\s*\|\s*\|\s*DSML\s*\|\s*\|\s*invoke[\s\S]*?(?:<\s*\/\s*\|\s*\|\s*DSML\s*\|\s*\|\s*invoke>|<\s*\/\s*\|\s*\|\s*DSML\s*\|?|$)/gi, '')
            .replace(/<\s*\|\s*\|\s*DSML[\s\S]*$/gi, '')
            .replace(/<[|｜]tool calls begin[|｜]>[\s\S]*?(?:<[|｜]tool calls end[|｜]>|$)/gi, '')
            .replace(/<[|｜]tool[\s\S]*?[|｜]>/gi, '')
            .trim();
        return cleaned || null;
    }

    async getFinalResponse(provider, { messages, systemPrompt, toolResults }) {
        try {
            const findings = toolResults.map(t => {
                let parsed = t.content;
                try { parsed = JSON.parse(t.content); } catch (e) {}
                return `=== RESULTADO DE CONSULTA SQL (${t.name || 'consulta'}) ===\n${typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed}`;
            }).join('\n\n');

            const finalPrompt = `DATOS OBTENIDOS DE LA BASE DE DATOS:\n\n${findings}\n\nCon base en estos datos y la pregunta del usuario, responde de forma clara, profesional y en español.\nIMPORTANTE:\n- Nunca menciones IDs numéricos en tu respuesta (usa solo los nombres reales de clientes, sucursales, productos, etc.).\n- Formatea los montos monetarios con símbolo $ y 2 decimales.\n- Si hay múltiples registros, preséntalos como una tabla Markdown limpia o lista.\n- No menciones el código SQL ni tecnicismos internos de la base de datos.`;

            if (provider === 'deepseek' && this.deepseek) {
                try {
                    const cleanHistory = messages
                        .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content && !m.tool_calls))
                        .map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));
                    const response = await this.deepseek.chat.completions.create({
                        model: "deepseek-chat",
                        messages: [
                            { role: "system", content: systemPrompt },
                            ...cleanHistory,
                            { role: "user", content: finalPrompt }
                        ]
                    });
                    return response.choices[0].message;
                } catch (dsError) {
                    console.error('[AI Service] DeepSeek final response failed, falling back to Gemini:', dsError.message);
                }
            }

            // Fallback a Gemini
            if (this.gemini) {
                console.log('[AI Service] Generating final Gemini response (using gemini-flash-lite-latest)...');
                const model = this.gemini.getGenerativeModel({
                    model: "gemini-flash-lite-latest",
                    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
                });

                const result = await model.generateContent(finalPrompt);
                return { role: 'assistant', content: result.response.text() };
            }

            throw new Error('No hay motor disponible para generar la respuesta final.');
        } catch (error) {
            console.error('[AI Service] Final response failed:', error.message);
            if (error.message.includes('429')) {
                return { role: 'assistant', content: 'He obtenido los datos, pero estoy teniendo problemas para procesarlos ahora mismo por límites de tráfico. Por favor, intenta de nuevo en unos segundos.' };
            }
            throw error;
        }
    }

    /**
     * Genera planes técnicos o parches quirúrgicos JSON para tickets AGY (con soporte DeepSeek + Gemini).
     */
    async generateCodeResponse({ systemPrompt = '', userPrompt = '', history = [], jsonMode = false }) {
        let lastErr = null;
        const cleanHistory = Array.isArray(history)
            ? history
                .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
                .map((m) => ({ role: m.role, content: String(m.content) }))
            : [];

        const deepseekClient = this.deepseek || (process.env.DEEPSEEK_API_KEY
            ? new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: process.env.DEEPSEEK_API_KEY })
            : null);

        if (deepseekClient) {
            try {
                const reqPayload = {
                    model: 'deepseek-chat',
                    temperature: 0.15,
                    max_tokens: 8192,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...cleanHistory,
                        { role: 'user', content: userPrompt }
                    ]
                };
                if (jsonMode) {
                    reqPayload.response_format = { type: 'json_object' };
                }
                const completion = await deepseekClient.chat.completions.create(reqPayload);
                const text = completion.choices?.[0]?.message?.content || '';
                if (text && text.trim()) {
                    return { provider: 'deepseek', role: 'assistant', content: text.trim() };
                }
            } catch (err) {
                lastErr = err;
                console.warn('[AI Service] DeepSeek generateCodeResponse fallback a Gemini:', err.message);
            }
        }

        const geminiClient = this.gemini || (process.env.GEMINI_API_KEY
            ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
            : null);

        if (geminiClient) {
            const candidateModels = [
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-flash-latest',
                'gemini-2.5-flash-lite',
                'gemini-flash-lite-latest'
            ];
            for (const gModel of candidateModels) {
                try {
                    const generationConfig = {
                        temperature: 0.15,
                        maxOutputTokens: 8192
                    };
                    if (jsonMode) {
                        generationConfig.responseMimeType = 'application/json';
                    }
                    const model = geminiClient.getGenerativeModel({
                        model: gModel,
                        systemInstruction: systemPrompt ? { role: 'system', parts: [{ text: systemPrompt }] } : undefined,
                        generationConfig
                    });
                    const result = await model.generateContent(userPrompt);
                    const text = result.response?.text?.() || '';
                    if (text && text.trim()) {
                        return { provider: 'gemini', model: gModel, role: 'assistant', content: text.trim() };
                    }
                } catch (gErr) {
                    lastErr = gErr;
                    console.warn(`[AI Service] Gemini ${gModel} generateCodeResponse warning:`, gErr.message);
                }
            }
        }

        if (lastErr) throw lastErr;
        throw new Error('No hay motor IA configurado (DEEPSEEK_API_KEY / GEMINI_API_KEY).');
    }

    /**
     * Alias retrocompatible utilizado por ticketAgyCodeEngine.service.js
     */
    async generateFinalResponse({ systemPrompt = '', history = [], finalPrompt = '', jsonMode = false } = {}) {
        return this.generateCodeResponse({
            systemPrompt,
            userPrompt: finalPrompt,
            history,
            jsonMode
        });
    }

    async extractDteFromImage(imageBuffer, mimeType = 'image/jpeg', options = {}) {
        const recognizeItems = options.recognizeItems === true;

        if (!this.gemini) {
            throw new Error('El servicio de IA no está configurado (falta GEMINI_API_KEY).');
        }

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
    "nombre_comercial": "Nombre comercial si es visible, o null",
    "nit": "NIT del emisor si es visible, o null",
    "nrc": "NRC del emisor si es visible, o null",
    "direccion": "Dirección completa si es visible, o null",
    "correo": "Correo electrónico si es visible, o null",
    "telefono": "Teléfono si es visible, o null",
    "actividad_economica": "Actividad económica si es visible, o null"
  },
  "totales": {
    "total_gravada": 0.0,
    "total_exenta": 0.0,
    "total_nosujeta": 0.0,
    "iva": 0.0,
    "retencion": 0.0,
    "percepcion": 0.0,
    "fovial": 0.0,
    "cotrans": 0.0,
    "monto_total": 0.0
  }${recognizeItems ? `,
  "items": [
    {
      "codigo": "Código del producto o ítem si es visible, o null",
      "descripcion": "Descripción o nombre del producto o servicio",
      "cantidad": 1.0,
      "precio_unitario": 0.0,
      "total": 0.0
    }
  ]` : ''}
}

REGLAS:
- Si un campo no es visible o está cortado en la foto, asígnalo como null (o 0.0 en valores numéricos).
- Asegúrate de que el código de generación y número de control estén en MAYÚSCULAS y limpios de espacios.
- IMPORTANTE: Tanto el código de generación (UUID) como el sello de recepción de Hacienda están compuestos ÚNICAMENTE por caracteres hexadecimales (dígitos 0-9 y letras A-F). En caracteres hexadecimales NUNCA existe la letra 'O'; si ves una forma redonda es el número cero '0'.
- El sello de recepción debe contener todos los caracteres visibles sin espacios.
- En facturas o créditos fiscales de combustible, extrae con exactitud los impuestos especiales FOVIAL (o FEFE) y COTRANS que aparezcan en los tributos o totales. Si no existen, colócalos en 0.0.${recognizeItems ? `
- Extrae con precisión cada una de las filas o renglones de la tabla de detalle/cuerpo de la factura en el arreglo "items". Asegura cantidad numérica, precio unitario sin IVA y total de la línea.` : ''}`;

        const candidateModels = [
            'gemini-2.5-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-flash-latest'
        ];

        let lastError = null;
        for (const modelName of candidateModels) {
            try {
                const model = this.gemini.getGenerativeModel({ model: modelName });
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout de espera en modelo ${modelName}`)), 15000)
                );

                const generatePromise = model.generateContent([
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType || 'image/jpeg'
                        }
                    },
                    prompt
                ]);

                const result = await Promise.race([generatePromise, timeoutPromise]);

                const rawText = result.response.text();
                let jsonStr = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[0];
                }
                const parsed = JSON.parse(jsonStr);

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
            } catch (error) {
                console.warn(`[AI Service] Error con modelo ${modelName} (${error.message}). Intentando modelo alternativo...`);
                lastError = error;
                // Pequeña pausa antes de intentar con el siguiente modelo si hay saturación temporal
                await new Promise(res => setTimeout(res, 400));
            }
        }

        console.error('[AI Service] Todos los modelos de Gemini fallaron:', lastError?.message);
        throw new Error(`El servicio de IA experimentó alta demanda. Por favor, reintenta en un momento. (${lastError?.message || '503'})`);
    }

    /**
     * Diagnósticos inteligentes de rechazo de DTE emitidos por el Ministerio de Hacienda (SVFE)
     * Motor primario: DeepSeek (deepseek-chat) en la nube (0% CPU en servidor local).
     * Fallback automático: Google Gemini Flash (gemini-flash-latest).
     * Safety net: Heurística local de catálogos oficiales MH.
     */
    async diagnoseDteError({ errorData, dteInfo, customerInfo }) {
        const prompt = `Eres el especialista tributario y auditor técnico senior del Ministerio de Hacienda de El Salvador (SVFE - Sistema de Transmisión de Documentos Tributarios Electrónicos).
Analiza el siguiente rechazo oficial de un DTE y genera un diagnóstico profesional, claro y accionable para el contribuyente.

DATOS DEL DOCUMENTO RECHAZADO:
- Tipo de Documento: ${dteInfo?.tipo_documento_name || dteInfo?.tipo_documento || 'No especificado'}
- Código de Generación: ${dteInfo?.codigo_generacion || 'No generado/N/A'}
- Número de Control: ${dteInfo?.numero_control || 'N/A'}
- Monto Total: $${dteInfo?.total_pagar || dteInfo?.monto_total || '0.00'}

DATOS DEL CLIENTE / RECEPTOR:
- Nombre: ${customerInfo?.nombre || customerInfo?.customer_name || 'Consumidor Final'}
- Tipo y Número de Documento: ${customerInfo?.tipo_documento || 'N/A'} - ${customerInfo?.num_documento || customerInfo?.customer_dui || customerInfo?.customer_nit || 'N/A'}
- NRC: ${customerInfo?.nrc || customerInfo?.customer_nrc || 'N/A'}
- Actividad Económica: ${customerInfo?.actividad_economica || 'N/A'}
- Dirección / Ubicación: ${customerInfo?.direccion || customerInfo?.customer_address || 'N/A'}, ${customerInfo?.municipio || 'N/A'}, ${customerInfo?.departamento || 'N/A'}

RESPUESTA Y ERROR EMITIDO POR HACIENDA:
${typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : String(errorData || 'No se recibió detalle')}

REGLAS PARA EL DIAGNÓSTICO:
1. Explica en lenguaje humano, directo y profesional qué causó exactamente el rechazo (en "quePaso").
2. Cita el fundamento legal o acápite técnico oficial de El Salvador (Código Tributario, Guía de Orientación SVFE, CAT-012, CAT-014, CAT-019, CAT-022, etc.) en "normativa".
3. Proporciona los pasos claros y exactos que el operador debe realizar en el sistema para corregirlo y transmitir con éxito en "solucion".
4. Clasifica el tipo de corrección en "tipoCorreccion" como uno de: "CLIENTE", "PRODUCTO", "EMISOR", "DATOS_VENTA", "SISTEMA_MH".

Responde ÚNICAMENTE con un objeto JSON estricto:
{
  "quePaso": "Explicación concisa y clara de la causa del rechazo",
  "normativa": "Base legal o técnica de Hacienda aplicable",
  "solucion": "Instrucciones numeradas paso a paso para resolver el error",
  "tipoCorreccion": "CLIENTE | PRODUCTO | EMISOR | DATOS_VENTA | SISTEMA_MH"
}`;

        // 1. Intentar con DeepSeek (deepseek-chat)
        if (this.deepseek) {
            try {
                console.log('[AI Service] Diagnosticando rechazo DTE con DeepSeek (deepseek-chat)...');
                const completion = await this.deepseek.chat.completions.create({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: 'Eres un experto tributario y auditor de sistemas para DTE del Ministerio de Hacienda de El Salvador. Responde siempre únicamente en formato JSON válido sin markdown.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    response_format: { type: 'json_object' }
                });

                const rawContent = completion.choices[0]?.message?.content || '{}';
                const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanJson);
                return {
                    provider: 'deepseek',
                    data: {
                        quePaso: parsed.quePaso || parsed.que_paso || 'Rechazo reportado por el Ministerio de Hacienda.',
                        normativa: parsed.normativa || 'Normativa de Facturación Electrónica de El Salvador (SVFE).',
                        solucion: parsed.solucion || 'Revise los datos del cliente y reintente la transmisión.',
                        tipoCorreccion: parsed.tipoCorreccion || parsed.tipo_correccion || 'CLIENTE'
                    }
                };
            } catch (error) {
                console.error('[AI Service] DeepSeek falló para diagnóstico DTE:', error.message);
            }
        }

        // 2. Fallback con Gemini Flash
        if (this.gemini) {
            const candidateGeminiModels = [
                'gemini-2.5-flash-lite',
                'gemini-flash-lite-latest',
                'gemini-3.5-flash-lite',
                'gemini-3.5-flash',
                'gemini-flash-latest'
            ];
            for (const gModel of candidateGeminiModels) {
                try {
                    console.log(`[AI Service] Fallback a Gemini (${gModel}) para diagnóstico DTE...`);
                    const model = this.gemini.getGenerativeModel({
                        model: gModel,
                        generationConfig: { responseMimeType: 'application/json' }
                    });

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout de espera en modelo ${gModel}`)), 12000)
                    );

                    const result = await Promise.race([
                        model.generateContent(prompt),
                        timeoutPromise
                    ]);

                    const rawText = result.response.text();
                    let jsonStr = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
                    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                    if (jsonMatch) jsonStr = jsonMatch[0];
                    const parsed = JSON.parse(jsonStr);
                    return {
                        provider: 'gemini',
                        data: {
                            quePaso: parsed.quePaso || parsed.que_paso || 'Rechazo reportado por el Ministerio de Hacienda.',
                            normativa: parsed.normativa || 'Normativa de Facturación Electrónica de El Salvador (SVFE).',
                            solucion: parsed.solucion || 'Revise los datos del cliente y reintente la transmisión.',
                            tipoCorreccion: parsed.tipoCorreccion || parsed.tipo_correccion || 'CLIENTE'
                        }
                    };
                } catch (geminiError) {
                    console.warn(`[AI Service] Gemini ${gModel} falló:`, geminiError.message);
                }
            }
        }

        // 3. Fallback Heurístico (offline / sin API keys)
        return {
            provider: 'heuristic',
            data: this._heuristicDiagnosis(errorData)
        };
    }

    _heuristicDiagnosis(errorData) {
        const str = typeof errorData === 'object' ? JSON.stringify(errorData) : String(errorData || '');
        const lower = str.toLowerCase();

        if (lower.includes('"codigomsg":"004"') || lower.includes('numerocontrol') || lower.includes('ya existe')) {
            return {
                quePaso: 'El número de control o código de generación ya fue utilizado o existe previamente en Hacienda.',
                normativa: 'Normativa SVFE - Identificación única de Documento Tributario Electrónico (codigoMsg 004).',
                solucion: '1. Haga clic en "Solventar / Corregir Datos DTE".\n2. Use la acción "Guardar y Regenerar (Nuevo Control)" para generar un nuevo UUID y Número de Control correlativo y transmitirlo.',
                tipoCorreccion: 'DATOS_VENTA'
            };
        }

        if (lower.includes('fecemi') || lower.includes('fecha de envío') || lower.includes('fecha de envio')) {
            return {
                quePaso: 'La fecha de emisión (fecEmi) del DTE difiere de la fecha actual de transmisión esperada por Hacienda.',
                normativa: 'Validaciones de Tiempo y Fecha de Emisión SVFE (codigoMsg 005 / 020).',
                solucion: '1. Abra "Solventar / Corregir Datos DTE".\n2. Marque la casilla "Actualizar fecha/hora de emisión a hoy".\n3. Pulse "Guardar y Reintentar Envío" (o Regenerar si aplica).',
                tipoCorreccion: 'DATOS_VENTA'
            };
        }

        if (lower.includes('documentorelacionado') || lower.includes('cuerpodocumento/0/numerodocumento') || lower.includes('018') || lower.includes('fecha fuera de plazo')) {
            return {
                quePaso: 'El documento relacionado (Nota de Crédito, Nota de Débito, Retención o Remisión) tiene un número o fecha que no cumple el formato o plazo de Hacienda.',
                normativa: 'Esquemas SVFE de Documentos Relacionados (UUID 36 caracteres para DTE electrónico o correlativo válido y período tributario vigente).',
                solucion: '1. Abra "Solventar / Corregir Datos DTE" en la pestaña "Docs. Relacionados".\n2. Busque y vincule el DTE aceptado (UUID oficial) o corrija el número y la fecha de emisión.\n3. Guarde y reintente la transmisión.',
                tipoCorreccion: 'DATOS_VENTA'
            };
        }

        if (lower.includes('recintofiscal') || lower.includes('tipoitemexpor') || lower.includes('tiporegimen') || lower.includes('codpais') || lower.includes('incoterms')) {
            return {
                quePaso: 'Faltan campos obligatorios de Exportación (FEX-11) o contienen un valor inválido según los catálogos aduaneros.',
                normativa: 'Esquema fe-fex-v3 y Catálogos CAT-011, CAT-020, CAT-027 y CAT-033 del Ministerio de Hacienda.',
                solucion: '1. Abra "Solventar / Corregir Datos DTE" en la pestaña "Exportación / Remisión".\n2. Verifique Tipo de Ítem, Recinto Fiscal, Régimen y País de Destino (ISO 2 letras).\n3. Guarde y reintente la transmisión.',
                tipoCorreccion: 'DATOS_VENTA'
            };
        }

        if ((lower.includes('"codigomsg":"003"') && !lower.includes('receptor')) || lower.includes('cuerpodocumento.item') || lower.includes('resumen.') || lower.includes('aproxim') || lower.includes('totalpagar') || lower.includes('totaliva')) {
            return {
                quePaso: 'Existe una diferencia de cálculo, aproximación o redondeo entre los ítems, impuestos (IVA/Retención) o pagos y el resumen del DTE.',
                normativa: 'Reglas de Cuadre Aritmético y Aproximación DTE v2.0 del Ministerio de Hacienda.',
                solucion: '1. Abra "Solventar / Corregir Datos DTE" en la pestaña "Montos / Aproximación".\n2. Pulse "Recalcular y Cuadrar Automáticamente" para alinear precio, gravado, IVA, retención y pagos al centavo.\n3. Pulse "Guardar y Reintentar Envío".',
                tipoCorreccion: 'DATOS_VENTA'
            };
        }

        if (lower.includes('014') || lower.includes('nit') || lower.includes('nrc') || lower.includes('padron') || lower.includes('padrón')) {
            return {
                quePaso: 'El NIT o NRC del cliente receptor no concuerda con los registros activos en el padrón tributario de Hacienda.',
                normativa: 'Código Tributario de El Salvador Art. 86 y Guía de Orientación SVFE sobre identificación de contribuyentes.',
                solucion: '1. Abra "Solventar / Corregir Datos DTE" > pestaña Cliente.\n2. Valide que el NIT (14 o 9 dígitos) y el NRC coincidan con la tarjeta de IVA del cliente.\n3. Guarde los cambios y pulse "Guardar y Reintentar Envío".',
                tipoCorreccion: 'CLIENTE'
            };
        }

        if (lower.includes('016') || lower.includes('actividad') || lower.includes('giro')) {
            return {
                quePaso: 'El código de actividad económica asignado al cliente receptor no es válido según el catálogo oficial de Hacienda.',
                normativa: 'Catálogo Oficial CAT-019 (Actividades Económicas) del Ministerio de Hacienda.',
                solucion: '1. Abra "Solventar / Corregir Datos DTE" > pestaña Cliente.\n2. Asigne un código de actividad económica válido del catálogo CAT-019.\n3. Guarde y reintente el envío.',
                tipoCorreccion: 'CLIENTE'
            };
        }

        if (lower.includes('017') || lower.includes('018') || lower.includes('distrito') || lower.includes('direccion') || lower.includes('municipio') || lower.includes('departamento')) {
            return {
                quePaso: 'La dirección del cliente está incompleta o la combinación de departamento, municipio y distrito no coincide con el catálogo CAT-008.',
                normativa: 'Catálogos Oficiales CAT-012 (Departamentos), CAT-013 (Municipios) y CAT-008 (Distritos) del SVFE.',
                solucion: '1. Abra "Solventar / Corregir Datos DTE" > pestaña Cliente.\n2. Seleccione Departamento, Municipio y Distrito válidos e ingrese una dirección completa.\n3. Guarde y reintente el envío.',
                tipoCorreccion: 'CLIENTE'
            };
        }

        return {
            quePaso: 'El Ministerio de Hacienda rechazó la recepción del documento electrónico según las validaciones de esquema o negocio.',
            normativa: 'Manual de Especificaciones Técnicas de Transmisión DTE versión 2.0 (Ministerio de Hacienda).',
            solucion: '1. Pulse "Solventar / Corregir Datos DTE" para revisar Cliente, Montos/Aproximación, Documentos Relacionados o Exportación.\n2. Aplique las correcciones necesarias.\n3. Pulse "Guardar y Reintentar Envío".',
            tipoCorreccion: 'DATOS_VENTA'
        };
    }
}

module.exports = new AIService();
