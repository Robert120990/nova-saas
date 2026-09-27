const { fail, pool } = require('./shared');

const deleteRawMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id;

        // Verificar si fue consumida en un lote de producción
        const [consumed] = await pool.query(
            'SELECT brm.*, b.batch_code_display FROM batch_raw_materials brm JOIN egg_production_batches b ON brm.batch_id = b.id WHERE brm.raw_material_id = ?',
            [id]
        );
        if (consumed.length > 0) {
            return res.status(400).json({
                message: `No se puede eliminar la recepción #${id} porque ya fue consumida en el lote de producción ${consumed[0].batch_code_display || '#' + consumed[0].batch_id}.`
            });
        }

        // Eliminar tarimas hijas si existen
        try {
            await pool.query('DELETE FROM egg_raw_material_tarimas WHERE raw_material_id = ?', [id]);
        } catch (e) { }

        await pool.query('DELETE FROM egg_raw_materials WHERE id = ? AND company_id = ?', [id, company_id]);

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.deleted', 'warning', ?, ?, ?)`,
            [company_id, `Recepción de materia prima #${id} eliminada.`, JSON.stringify({ raw_material_id: parseInt(id) }), req.user?.nombre || 'Administrador']
        );

        res.json({ success: true, message: 'Recepción de materia prima eliminada correctamente.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const approveRawMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const company_id = req.company_id || req.user?.company_id;

        const [existing] = await pool.query('SELECT id, status, provider_lot, egg_type FROM egg_raw_materials WHERE id = ? AND company_id = ?', [id, company_id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Lote de materia prima no encontrado.' });
        }

        if (['anulado', 'rechazado', 'bloqueado_haccp'].includes(existing[0].status)) fail('No se puede aprobar una recepción anulada o rechazada.', 409);
        if (existing[0].status === 'aprobado') {
            return res.json({ success: true, message: 'El lote ya se encuentra aprobado para producción.' });
        }

        await pool.query(
            `UPDATE egg_raw_materials
             SET status = 'aprobado',
                 notes = CASE
                     WHEN ? IS NOT NULL AND ? != '' THEN CONCAT(COALESCE(notes, ''), ' | [Aprobado: ', ?, ']')
                     ELSE notes
                 END
             WHERE id = ? AND company_id = ?`,
            [notes, notes, notes, id, company_id]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.approved', 'info', ?, ?, ?)`,
            [
                company_id,
                `Lote de materia prima #${id} (${existing[0].provider_lot || 'Sin Lote'}) aprobado para producción.`,
                JSON.stringify({ raw_material_id: parseInt(id) }),
                req.user?.nombre || 'Control de Calidad'
            ]
        );
        res.json({ success: true, message: 'Lote de materia prima aprobado exitosamente para producción.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { deleteRawMaterial, approveRawMaterial };
