const pool = require('../config/db');
const { owned } = require('../services/eggRules.service');

const references = {
    raw_material_id: 'egg_raw_materials', batch_id: 'egg_production_batches',
    target_batch_id: 'egg_production_batches', source_batch_id: 'egg_production_batches',
    packaging_id: 'egg_packaging_records', scheduled_production_id: 'egg_scheduled_productions',
    provider_id: 'providers', customer_id: 'customers', branch_id: 'branches'
};

// Los IDs secundarios también deben pertenecer al tenant. Los servicios mantienen
// los bloqueos y las comprobaciones de disponibilidad dentro de la transacción.
module.exports = async function eggReferences(req, res, next) {
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
    try {
        const companyId = req.company_id || req.user?.company_id;
        if (!companyId) return next();
        const pending = [req.body];
        const checked = new Set();
        while (pending.length) {
            const value = pending.pop();
            if (!value || typeof value !== 'object') continue;
            for (const [key, id] of Object.entries(value)) {
                if (id && typeof id === 'object') { pending.push(id); continue; }
                if (!references[key] || id === '' || id == null || id === 0) continue;
                const marker = `${key}:${id}`;
                if (!checked.has(marker)) {
                    await owned(pool, references[key], id, companyId);
                    checked.add(marker);
                }
            }
        }
        next();
    } catch (error) { res.status(error.status || 500).json({ message: error.message }); }
};
