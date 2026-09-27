const { pool } = require('./shared');

const getTraceability = async (req, res) => {
    try {
        const { code } = req.params;
        const company_id = req.company_id;

        // Buscar el lote por UUID, lote de empaque o código de barras
        let batchQuery = `
            SELECT b.*, rm.egg_type as raw_egg_type, rm.provider_lot as raw_provider_lot, rm.temperature_c as raw_temp, rm.weight_lbs as raw_weight, rm.operator_name as raw_operator, p.nombre as provider_name
            FROM egg_production_batches b
            LEFT JOIN egg_raw_materials rm ON b.raw_material_id = rm.id
            LEFT JOIN providers p ON rm.provider_id = p.id
            LEFT JOIN egg_packaging_records pr ON pr.batch_id = b.id
            WHERE b.company_id = ? AND (b.batch_uuid = ? OR pr.lot_code = ? OR pr.barcode = ?)
            LIMIT 1
        `;

        const [batches] = await pool.query(batchQuery, [company_id, code, code, code]);
        if (batches.length === 0) {
            return res.status(404).json({ message: 'No se encontraron registros de trazabilidad para el código suministrado.' });
        }

        const batch = batches[0];
        const batch_id = batch.id;

        // Cargar bitácora de pasteurización
        const [pasteurizations] = await pool.query(
            `SELECT * FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? ORDER BY created_at DESC`,
            [batch_id, company_id]
        );

        // Cargar bitácora de empaque
        const [packaging] = await pool.query(
            `SELECT * FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?`,
            [batch_id, company_id]
        );

        // Cargar congelación (Blast Freezer)
        let blastFreezer = [];
        if (packaging.length > 0) {
            const [freezers] = await pool.query(
                `SELECT * FROM egg_blast_freezer_logs WHERE packaging_id = ? AND company_id = ?`,
                [packaging[0].id, company_id]
            );
            blastFreezer = freezers;
        }

        // Cargar bitácora de sanitización CIP que habilitó este lote
        // Buscamos sanitizaciones de pasteurizador realizadas en las 24 horas previas al inicio del lote
        const [cipLogs] = await pool.query(
            `SELECT * FROM egg_cip_logs
             WHERE company_id = ? AND equipment_name = 'pasteurizador'
               AND created_at <= ?
             ORDER BY created_at DESC LIMIT 2`,
            [company_id, batch.started_at]
        );

        // Cargar costos industriales
        const [costs] = await pool.query(
            `SELECT * FROM egg_industrial_costs WHERE batch_id = ? AND company_id = ?`,
            [batch_id, company_id]
        );

        // Cargar eventos del lote
        const [events] = await pool.query(
            `SELECT * FROM egg_industrial_events
             WHERE company_id = ? AND (description LIKE ? OR payload->'$.batch_uuid' = ? OR payload->'$.batch_id' = ?)
             ORDER BY created_at ASC`,
            [company_id, `%${batch.batch_uuid}%`, batch.batch_uuid, batch_id]
        );

        res.json({
            batch,
            pasteurizations,
            packaging: packaging.length > 0 ? packaging[0] : null,
            blastFreezer: blastFreezer.length > 0 ? blastFreezer[0] : null,
            cipLogs,
            costs: costs.length > 0 ? costs[0] : null,
            auditTrail: events
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports = { getTraceability };
