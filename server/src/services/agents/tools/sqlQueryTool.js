const pool = require('../../../config/db');
const { AI_QUERY_MAX_ROWS } = require('../../../config/db.schema');

const FORBIDDEN_KEYWORDS = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER',
    'CREATE', 'REPLACE', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
    'CALL', 'LOAD', 'OUTFILE', 'DUMPFILE', 'INTO',
    'SLEEP', 'BENCHMARK', 'GET_LOCK', 'RELEASE_LOCK', 'IS_FREE_LOCK',
    'IS_USED_LOCK', 'LOAD_FILE', 'HANDLER', 'SHOW', 'DESCRIBE',
    'EXPLAIN', 'SET', 'PREPARE', 'DEALLOCATE'
];

const FORBIDDEN_TABLES = [
    'users', 'roles', 'usuario_empresa', 'usuario_sucursal',
    'user_sessions', 'login_rate_limits',
    'telegram_settings', 'telegram_chat_bindings', 'telegram_invite_tokens',
    'whatsapp_settings', 'smtp_settings', 'filpro_connections',
    'accounting_settings', 'gas_station_settings', 'energy_system_settings',
    'rh_biometric_devices', 'audit_logs',
    'ai_agent_tasks', 'ai_agent_task_logs', 'agent_conversations', 'agent_messages',
    'information_schema', 'performance_schema', 'mysql', 'sys'
];

const FORBIDDEN_COLUMNS = [
    'api_password', 'certificate_password', 'clave_privada', 'clave_publica',
    'password', 'bot_token', 'agent_key', 'fusion_password', 'fusion_agent_key',
    'oficina_db_password', 'filpro_password', 'growatt_password', 'gess_password',
    'restart_key'
];

function isCatalogOnlyQuery(sql) {
    const tableMatches = [...sql.matchAll(/\b(?:FROM|JOIN)\s+`?([a-zA-Z0-9_]+)`?(?:\s+(?:AS\s+)?[a-zA-Z0-9_]+)?(\s*,\s*`?[a-zA-Z0-9_]+`?)*/gi)];
    if (tableMatches.length === 0) return false;

    for (const match of tableMatches) {
        const primaryTable = match[1];
        if (!/^cat_0[a-zA-Z0-9_]*$/i.test(primaryTable)) {
            return false;
        }
        if (match[2]) {
            const extraTables = match[0].replace(/^\b(?:FROM|JOIN)\s+/i, '').split(',');
            for (const part of extraTables) {
                const tbl = part.trim().split(/\s+/)[0].replace(/`/g, '');
                if (!/^cat_0[a-zA-Z0-9_]*$/i.test(tbl)) {
                    return false;
                }
            }
        }
    }
    return true;
}

function validateSql(sql, _context = {}) {
    const cleaned = String(sql || '')
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/#[^\n]*/g, '')
        .trim()
        .replace(/;+\s*$/, '')
        .trim();

    if (cleaned.includes(';')) {
        return { valid: false, reason: 'Solo se permite una instrucción SELECT por consulta.' };
    }

    if (!/^(SELECT|WITH)\s+/i.test(cleaned)) {
        return { valid: false, reason: 'Solo se permiten consultas SELECT de lectura.' };
    }

    for (const keyword of FORBIDDEN_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(cleaned)) {
            return { valid: false, reason: `Instrucción no permitida detectada: ${keyword}` };
        }
    }

    for (const table of FORBIDDEN_TABLES) {
        const regex = new RegExp(`\\b${table}\\b`, 'i');
        if (regex.test(cleaned)) {
            return { valid: false, reason: `Acceso no permitido a tabla restringida: ${table}` };
        }
    }

    for (const col of FORBIDDEN_COLUMNS) {
        const regex = new RegExp(`\\b${col}\\b`, 'i');
        if (regex.test(cleaned)) {
            return { valid: false, reason: `Acceso no permitido a columna sensible: ${col}` };
        }
    }

    if (!cleaned.includes('{COMPANY_ID}') && !isCatalogOnlyQuery(cleaned)) {
        return {
            valid: false,
            reason: 'Por seguridad multi-empresa, toda consulta debe filtrar obligatoriamente con el marcador {COMPANY_ID}.'
        };
    }

    return { valid: true, cleanedSql: cleaned };
}

function prepareSql(sql, companyId, branchId) {
    const params = [];

    let safeSql = sql.replace(/\{COMPANY_ID\}/g, () => {
        params.push(Number(companyId));
        return '?';
    });

    if (branchId !== null && branchId !== undefined && branchId !== 'all' && branchId !== '') {
        safeSql = safeSql.replace(/\{BRANCH_ID\}/g, () => {
            params.push(Number(branchId));
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

async function executeSqlQuery({ sql } = {}, context = {}) {
    const { companyId, branchId } = context || {};
    const parsedCompanyId = Number(companyId);
    if (!companyId || !Number.isInteger(parsedCompanyId) || parsedCompanyId <= 0) {
        return { error: 'companyId válido es requerido para ejecutar consultas de datos.' };
    }

    const validation = validateSql(sql || '', context);
    if (!validation.valid) {
        console.warn('[SQL Tool] Rechazada:', validation.reason, '| SQL:', sql);
        return { error: `Consulta rechazada por seguridad: ${validation.reason}` };
    }

    const { sql: safeSql, params } = prepareSql(validation.cleanedSql, parsedCompanyId, branchId);
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
    execute: executeSqlQuery,
    executeSqlQuery,
    validateSql,
    prepareSql
};

