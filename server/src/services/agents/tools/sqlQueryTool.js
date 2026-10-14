const pool = require('../../../config/db');
const { AI_QUERY_MAX_ROWS } = require('../../../config/db.schema');

const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER',
    'CREATE', 'REPLACE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
    'CALL', 'LOAD', 'OUTFILE', 'DUMPFILE', 'INTO'
];

function validateSql(sql) {
    const cleaned = sql
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();

    if (!/^SELECT\s+/i.test(cleaned)) {
        return { valid: false, reason: 'Solo se permiten consultas SELECT de lectura.' };
    }

    const upperSql = cleaned.toUpperCase();
    for (const keyword of FORBIDDEN_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`);
        if (regex.test(upperSql)) {
            return { valid: false, reason: `Instrucción no permitida detectada: ${keyword}` };
        }
    }

    return { valid: true, cleanedSql: cleaned };
}

function prepareSql(sql, companyId, branchId) {
    const params = [];

    let safeSql = sql.replace(/\{COMPANY_ID\}/g, () => {
        params.push(companyId);
        return '?';
    });

    if (branchId !== null && branchId !== undefined && branchId !== 'all') {
        safeSql = safeSql.replace(/\{BRANCH_ID\}/g, () => {
            params.push(branchId);
            return '?';
        });
    } else {
        // When no specific branch is selected, neutralize branch_id comparisons to avoid ambiguous column errors in JOINs
        safeSql = safeSql.replace(/\b(?:[a-zA-Z0-9_]+\.)?branch_id\s*=\s*\{BRANCH_ID\}/gi, '1=1');
        safeSql = safeSql.replace(/\{BRANCH_ID\}/g, '1=1');
    }

    const hasLimit = /\bLIMIT\s+\d+/i.test(safeSql);
    if (!hasLimit) {
        safeSql = safeSql.replace(/;\s*$/, '');
        safeSql += ` LIMIT ${AI_QUERY_MAX_ROWS || 50}`;
    }

    return { sql: safeSql, params };
}

const toolDefinition = {
    name: 'execute_sql_query',
    description: 'Ejecuta una consulta SQL SELECT en la base de datos de Novas y devuelve los resultados en JSON. Usa {COMPANY_ID} y {BRANCH_ID} como placeholders seguros. Siempre incluye JOINs para obtener nombres descriptivos en lugar de IDs.',
    parameters: {
        type: 'object',
        properties: {
            sql: {
                type: 'string',
                description: 'La consulta SQL SELECT a ejecutar. Debe usar {COMPANY_ID} y {BRANCH_ID} como placeholders.'
            }
        },
        required: ['sql']
    }
};

async function execute({ sql }, context) {
    const { companyId, branchId } = context;
    if (!companyId) throw new Error('companyId es requerido para ejecutar consultas de datos.');

    const validation = validateSql(sql || '');
    if (!validation.valid) {
        console.warn('[SQL Tool] Rechazada:', validation.reason, '| SQL:', sql);
        return { error: `Consulta rechazada por seguridad: ${validation.reason}` };
    }

    const { sql: safeSql, params } = prepareSql(validation.cleanedSql, companyId, branchId);
    try {
        const [rows] = await pool.query(safeSql, params);
        return {
            rowCount: rows.length,
            data: rows
        };
    } catch (dbError) {
        console.error('[SQL Tool] Error al ejecutar:', dbError.message);
        return {
            error: 'Error al ejecutar la consulta en la base de datos.',
            detail: dbError.message
        };
    }
}

module.exports = {
    definition: toolDefinition,
    execute,
    validateSql,
    prepareSql
};
