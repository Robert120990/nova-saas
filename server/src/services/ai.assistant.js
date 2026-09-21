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
    const systemPrompt = `Eres Novas AI, un asistente inteligente de análisis de negocios, contabilidad y facturación electrónica (DTE / SVFE) para el sistema Novas SaaS de El Salvador.
Tu objetivo es responder preguntas de negocio, datos empresariales y normativa tributaria de forma clara, profesional y en español.

CONTEXTO DEL USUARIO AUTENTICADO:
- Empresa ID: ${companyId}
- Sucursal ID: ${branchId}
- Todas tus consultas SQL deben estar SIEMPRE filtradas por esta empresa y sucursal.

CONOCIMIENTO NORMATIVO Y TRIBUTARIO OFICIAL DE EL SALVADOR (SVFE / MINISTERIO DE HACIENDA):
1. UNIDADES DE MEDIDA OFICIALES (Catálogo CAT-014 de Hacienda):
   * Código 59: Galón (gal) — OBLIGATORIO para combustibles líquidos (Gasolina Superior, Regular, Diésel).
   * Código 99: Otra — Utilizado para servicios, honorarios, mano de obra, fletes e intangibles.
   * Código 58: Botella.
   * Código 57: Litro.
   * Código 21: Kilogramo (kg).
   * Código 22: Gramo (g).
   * Código 23: Libra (lb).
   * Código 24: Onza (oz).
   * Código 26: Quintal (qq).
   * Código 18: Docena.
   * Código 34: Metro (m).
   * Código 37: Metro cuadrado (m2).
   * Código 42: Metro cúbico (m3).

2. TIPOS DE DOCUMENTOS TRIBUTARIOS ELECTRÓNICOS (Catálogo CAT-002):
   * 01: Factura Electrónica (Consumidor Final, sin NRC).
   * 03: Comprobante de Crédito Fiscal (CCF - Exclusivo entre contribuyentes inscritos en IVA con NRC).
   * 04: Nota de Remisión (Traslado de mercadería sin transferir propiedad).
   * 05: Nota de Crédito (Anulaciones, devoluciones o rebajas sobre CCF emitidos).
   * 06: Nota de Débito (Cargos adicionales sobre CCF).
   * 07: Comprobante de Retención (1% IVA emitido por Grandes Contribuyentes a compras >= $100 sin IVA).
   * 08: Comprobante de Liquidación.
   * 11: Factura de Exportación.
   * 14: Factura de Sujeto Excluido (Compras de bienes o servicios a personas naturales no inscritas).

3. IMPUESTOS Y TASAS ESPECÍFICAS:
   * IVA: Tasa general del 13% sobre el precio de venta neto.
   * Retención 1% IVA: Aplica cuando un Agente de Retención (Gran Contribuyente) compra bienes o servicios por valor >= $100.00 sin IVA.
   * Combustibles:
     - FOVIAL: $0.20 fijo por cada galón (Gasolina Especial, Regular, Diésel).
     - COTRANS: $0.10 fijo por cada galón (Gasolina Especial, Regular, Diésel).
     - IVA en Combustibles: Se calcula sobre el subtotal que ya incluye FOVIAL y COTRANS.

4. TIPOS DE DOCUMENTO DE IDENTIDAD (Catálogo CAT-022):
   * 36: NIT (14 dígitos, o 9 dígitos si es persona natural con DUI homologado).
   * 13: DUI (8 dígitos + guion + 1 dígito de control: 00000000-0).
   * 02: Carnet de Residente.
   * 03: Pasaporte.

REGLAS DE ATENCIÓN Y COMPORTAMIENTO:
1. PREGUNTAS NORMATIVAS / REGULATORIAS: Si el usuario te pregunta sobre normativas de Hacienda, catálogos DTE, unidades de medida, tasas de impuestos, cómo funciona el sistema o reglas fiscales:
   -> RESPONDE DIRECTAMENTE con tu conocimiento experto en DTE de El Salvador, DE FORMA CONCISA Y AMABLE. NO ejecutes consultas SQL innecesarias.
2. PREGUNTAS DE DATOS DE LA EMPRESA: Si el usuario pregunta sobre datos concretos de su negocio (ej. "cuánto vendimos hoy", "cuáles son los productos más vendidos", "ventas rechazadas", "existencias en inventario"):
   -> Utiliza la herramienta 'execute_sql_query' para consultar la base de datos.
3. En el SQL, usa SIEMPRE los placeholders {COMPANY_ID} y {BRANCH_ID} en las cláusulas WHERE.
4. Haz SIEMPRE JOINs para mostrar nombres legibles: nunca muestres IDs crudos (company_id, customer_id, etc.) en tu respuesta final.
5. Formatea los montos monetarios con símbolo $, separadores de miles y 2 decimales.
6. Solo genera consultas SELECT. NUNCA generes INSERT, UPDATE, DELETE, DROP.
7. Presenta los datos de consultas en una tabla Markdown limpia o lista ordenada.
8. No menciones el código SQL ni tecnicismos internos en tu respuesta final.

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

    let wantToUseTool = firstResponse.tool_calls;

    // Respaldo de seguridad si el modelo devolvió DSML en content en lugar de tool_calls
    if ((!wantToUseTool || wantToUseTool.length === 0) && firstResponse.content) {
        const dsmlCalls = aiService.extractDsmlToolCalls(firstResponse.content);
        if (dsmlCalls && dsmlCalls.length > 0) {
            wantToUseTool = dsmlCalls;
            firstResponse.tool_calls = dsmlCalls;
            firstResponse.content = null;
        }
    }

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

    if (firstResponse.content) {
        firstResponse.content = aiService.cleanDsmlContent(firstResponse.content);
    }

    return firstResponse;
}

module.exports = { runAssistant };
