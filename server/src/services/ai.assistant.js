const pool = require('../config/db');
const aiService = require('./ai.service');
const { DB_SCHEMA, AI_QUERY_MAX_ROWS } = require('../config/db.schema');

/**
 * Novas AI Assistant — SQL Engine Mode (reutilizable por web y Telegram)
 *
 * El asistente recibe el esquema completo, genera una consulta SELECT,
 * el backend la ejecuta de forma segura y devuelve los resultados en JSON
 * para que la IA formule la respuesta en lenguaje natural.
 *
 * Seguridad:
 *  - Solo se permiten SELECT.
 *  - company_id y branch_id siempre se inyectan desde el contexto (nunca del SQL generado).
 *  - {COMPANY_ID} y {BRANCH_ID} son placeholders seguros.
 *  - Límite máximo de filas en toda consulta.
 */

const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER',
    'CREATE', 'REPLACE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
    'CALL', 'LOAD', 'OUTFILE', 'DUMPFILE', 'INTO'
];

/**
 * Valida que un SQL sea una consulta SELECT segura.
 */
const validateSql = (sql) => {
    const cleaned = sql
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

    if (!/^SELECT\s+/i.test(cleaned)) {
        return { valid: false, reason: 'Solo se permiten consultas SELECT.' };
    }

    const upperSql = cleaned.toUpperCase();
    for (const keyword of FORBIDDEN_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`);
        if (regex.test(upperSql)) {
            return { valid: false, reason: `Instrucción no permitida detectada: ${keyword}` };
        }
    }

    return { valid: true, cleanedSql: cleaned };
};

/**
 * Inyecta company_id/branch_id como parámetros y fuerza límite de filas.
 */
const prepareSql = (sql, companyId, branchId) => {
    const params = [];

    let safeSql = sql.replace(/\{COMPANY_ID\}/g, () => {
        params.push(companyId);
        return '?';
    });

    safeSql = safeSql.replace(/\{BRANCH_ID\}/g, () => {
        params.push(branchId);
        return '?';
    });

    const hasLimit = /\bLIMIT\s+\d+/i.test(safeSql);
    if (!hasLimit) {
        safeSql = safeSql.replace(/;\s*$/, '');
        safeSql += ` LIMIT ${AI_QUERY_MAX_ROWS}`;
    }

    return { sql: safeSql, params };
};

/**
 * Ejecuta el flujo completo del asistente.
 * @param {{ messages: Array, companyId: number, branchId: number }} opts
 * @returns {Promise<{ role: string, content?: string, tool_calls?: Array }>}
 */
async function runAssistant({ messages, companyId, branchId }) {
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
7. Siempre que sea posible, formatea los datos en una tabla Markdown para mejor legibilidad. Usa encabezados claros y alineación en columnas numéricas (moneda a la derecha, texto a la izquierda).
8. No menciones el SQL generado en tu respuesta al usuario.

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

                const validation = validateSql(rawSql);
                if (!validation.valid) {
                    console.warn('[Novas AI] SQL rechazado:', validation.reason, '| SQL:', rawSql);
                    resultData = { error: `Consulta rechazada por seguridad: ${validation.reason}` };
                } else {
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

        return aiService.getFinalResponse(provider, {
            messages: [...messages, firstResponse],
            systemPrompt,
            toolResults
        });
    }

    return firstResponse;
}

module.exports = { runAssistant };
