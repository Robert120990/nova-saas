const pool = require('../../../config/db');

/**
 * Tool: Search accounts in chart_of_accounts for an enterprise.
 */

const toolDefinition = {
    name: 'search_chart_of_accounts',
    description: 'Busca cuentas contables en el catálogo oficial de la empresa por código o nombre. Solo devuelve cuentas habilitadas para registrar movimientos directos (allows_entries = 1).',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Término de búsqueda: nombre de cuenta (ej. "depreciacion", "combustible", "caja", "bancos") o código numérico.'
            },
            limit: {
                type: 'number',
                description: 'Cantidad máxima de cuentas a retornar (por defecto 10).'
            }
        },
        required: ['query']
    }
};

async function execute({ query, limit = 10 }, context) {
    const { companyId } = context;
    if (!companyId) throw new Error('companyId es requerido para buscar en el catálogo contable.');

    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return { accounts: [], message: 'Término de búsqueda vacío' };

    const maxRows = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);
    const likePattern = `%${cleanQuery}%`;

    const [rows] = await pool.query(
        `SELECT id, code, name, description, allows_entries
         FROM chart_of_accounts
         WHERE company_id = ?
           AND active = 1
           AND (code LIKE ? OR name LIKE ?)
         ORDER BY allows_entries DESC, code ASC
         LIMIT ?`,
        [companyId, likePattern, likePattern, maxRows]
    );

    return {
        count: rows.length,
        accounts: rows.map(r => ({
            id: r.id,
            code: r.code,
            name: r.name,
            allows_entries: Boolean(r.allows_entries)
        }))
    };
}

module.exports = {
    definition: toolDefinition,
    execute
};
