const pool = require('../config/db');
const aiService = require('../services/ai.service');
const { DB_SCHEMA, AI_QUERY_MAX_ROWS } = require('../config/db.schema');

/**
 * Novas AI Controller — SQL Engine Mode
 *
 * The AI receives the full database schema, generates a SELECT query,
 * the backend executes it safely and returns the JSON results to the AI
 * so it can formulate a natural language response.
 *
 * Security:
 *  - Only SELECT statements are allowed.
 *  - company_id and branch_id are always injected from the JWT token (never from AI-generated SQL).
 *  - {COMPANY_ID} and {BRANCH_ID} are used as safe placeholders in the AI-generated SQL.
 *  - A maximum row limit is enforced on every query.
 */

// --- SQL Safety Validator ---

const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER',
    'CREATE', 'REPLACE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
    'CALL', 'LOAD', 'OUTFILE', 'DUMPFILE', 'INTO'
];

/**
 * Validates that a SQL string is a safe SELECT-only query.
 * @param {string} sql
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateSql = (sql) => {
    // Remove SQL comments before validation
    const cleaned = sql
        .replace(/--[^\n]*/g, '')      // Single line comments
        .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments
        .trim();

    // Must start with SELECT
    if (!/^SELECT\s+/i.test(cleaned)) {
        return { valid: false, reason: 'Solo se permiten consultas SELECT.' };
    }

    // Check for forbidden DDL/DML keywords
    const upperSql = cleaned.toUpperCase();
    for (const keyword of FORBIDDEN_KEYWORDS) {
        // Word-boundary check to avoid false positives (e.g. "INSERTED" in a string)
        const regex = new RegExp(`\\b${keyword}\\b`);
        if (regex.test(upperSql)) {
            return { valid: false, reason: `Instrucción no permitida detectada: ${keyword}` };
        }
    }

    return { valid: true, cleanedSql: cleaned };
};

/**
 * Injects company_id and branch_id placeholders and enforces row limit.
 * @param {string} sql
 * @param {number} companyId
 * @param {number} branchId
 * @returns {{ sql: string, params: any[] }}
 */
const prepareSql = (sql, companyId, branchId) => {
    const params = [];

    // Replace {COMPANY_ID} and {BRANCH_ID} with ? params
    let safeSql = sql.replace(/\{COMPANY_ID\}/g, () => {
        params.push(companyId);
        return '?';
    });

    safeSql = safeSql.replace(/\{BRANCH_ID\}/g, () => {
        params.push(branchId);
        return '?';
    });

    // Enforce row limit: add LIMIT if not already present
    const hasLimit = /\bLIMIT\s+\d+/i.test(safeSql);
    if (!hasLimit) {
        // Remove trailing semicolon if present
        safeSql = safeSql.replace(/;\s*$/, '');
        safeSql += ` LIMIT ${AI_QUERY_MAX_ROWS}`;
    }

    return { sql: safeSql, params };
};

// --- Main Chat Handler ---

const chat = async (req, res) => {
    const { messages } = req.body;
    const companyId = req.user.company_id;
    const branchId = req.user.branch_id;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: 'Se requiere un arreglo de mensajes.' });
    }

    const systemPrompt = `Eres Novas AI, un asistente inteligente de análisis de negocios para el sistema Novas SaaS.
Tu objetivo es responder preguntas de negocio de forma clara, profesional y en español.

CONTEXTO DEL USUARIO AUTENTICADO:
- Empresa ID: ${companyId}
- Sucursal ID: ${branchId}
- Todas tus consultas deben estar SIEMPRE filtradas por esta empresa y sucursal.

INSTRUCCIONES CRÍTICAS:
1. Usa la herramienta 'execute_sql_query' para consultar datos reales de la base de datos.
2. En el SQL, usa SIEMPRE los placeholders {COMPANY_ID} y {BRANCH_ID} en las cláusulas WHERE.
3. Haz SIEMPRE JOINs para mostrar nombres legibles: nunca muestres IDs crudos (company_id, branch_id, customer_id, etc.) en tu respuesta final.
   - customers → c.nombre (no customer_id)
   - branches → b.nombre (no branch_id)
   - companies → c.razon_social o c.nombre_comercial (no company_id)
   - providers → p.nombre (no provider_id)
   - products → p.nombre, p.codigo (no product_id)
   - sellers → s.nombre (no seller_id)
   - users → u.nombre (no usuario_id)
4. Si necesitas calcular montos monetarios, formatea los resultados con símbolo $, separadores de miles y 2 decimales.
5. Solo genera consultas SELECT. NUNCA generes INSERT, UPDATE, DELETE, DROP u otras instrucciones.
6. Si no hay datos disponibles, responde amablemente que no hay información.
7. Sé conciso, claro y usa formato estructurado cuando haya múltiples resultados (listas, tablas simples).
8. No mentions el SQL generado en tu respuesta al usuario.

${DB_SCHEMA}`;

    const tools = [
        {
            name: "execute_sql_query",
            description: "Ejecuta una consulta SQL SELECT en la base de datos de Novas y devuelve los resultados en JSON. Usa {COMPANY_ID} y {BRANCH_ID} como placeholders seguros. Siempre incluye JOINs para obtener nombres legibles en lugar de IDs.",
            parameters: {
                type: "object",
                properties: {
                    sql: {
                        type: "string",
                        description: "La consulta SQL SELECT a ejecutar. Debe usar {COMPANY_ID} y {BRANCH_ID} como placeholders donde aplique."
                    }
                },
                required: ["sql"]
            }
        }
    ];

    try {
        const { provider, data: firstResponse } = await aiService.getChatCompletion({
            messages,
            tools,
            systemPrompt
        });

        const wantToUseTool = firstResponse.tool_calls;

        if (wantToUseTool && wantToUseTool.length > 0) {
            const toolResults = [];

            for (const toolCall of wantToUseTool) {
                const name = toolCall.function.name;
                let resultData;

                if (name === 'execute_sql_query') {
                    let args;
                    try {
                        args = typeof toolCall.function.arguments === 'string'
                            ? JSON.parse(toolCall.function.arguments)
                            : toolCall.function.arguments;
                    } catch {
                        resultData = { error: 'No se pudo parsear los argumentos de la consulta.' };
                        toolResults.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name,
                            content: JSON.stringify(resultData)
                        });
                        continue;
                    }

                    const rawSql = args.sql || '';

                    // 1. Validate SQL
                    const validation = validateSql(rawSql);
                    if (!validation.valid) {
                        console.warn('[Novas AI] SQL rechazado:', validation.reason, '| SQL:', rawSql);
                        resultData = { error: `Consulta rechazada por seguridad: ${validation.reason}` };
                    } else {
                        // 2. Inject company/branch and enforce LIMIT
                        const { sql: safeSql, params } = prepareSql(validation.cleanedSql, companyId, branchId);
                        console.log('[Novas AI] Ejecutando SQL:', safeSql, '| Params:', params);

                        try {
                            const [rows] = await pool.query(safeSql, params);
                            resultData = {
                                rowCount: rows.length,
                                data: rows
                            };
                            console.log(`[Novas AI] Query OK: ${rows.length} filas devueltas.`);
                        } catch (dbError) {
                            console.error('[Novas AI] Error al ejecutar SQL:', dbError.message);
                            resultData = {
                                error: 'Error al ejecutar la consulta en la base de datos.',
                                detail: dbError.message
                            };
                        }
                    }
                } else {
                    resultData = { error: `Herramienta desconocida: ${name}` };
                }

                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name,
                    content: JSON.stringify(resultData)
                });
            }

            // Final AI call: interpret results and generate natural language response
            const finalReply = await aiService.getFinalResponse(provider, {
                messages: [...messages, firstResponse],
                systemPrompt,
                toolResults
            });

            return res.json({ message: finalReply });
        }

        // No tool call — direct answer
        return res.json({ message: firstResponse });

    } catch (error) {
        console.error('CRITICAL [Novas AI Error]:', error.message);
        res.status(500).json({
            message: error.message || 'Error procesando consulta de IA',
            details: error.message
        });
    }
};

module.exports = { chat };
