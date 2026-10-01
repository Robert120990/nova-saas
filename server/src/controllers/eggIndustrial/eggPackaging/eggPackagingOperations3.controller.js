const { fail, pool, ensureEggSchema } = require('./shared');

const closeBatchPackaging = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { reason, operator_name, notes } = req.body;
        const company_id = req.company_id;

        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (batches.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote no encontrado.' });
        }
        const batch = batches[0];
        if (batch.status === 'bloqueado_haccp') fail('No se puede cerrar un lote bloqueado por calidad.', 409);
        if (batch.packaging_status === 'cerrado') {
            await connection.commit();
            return res.json({ success: true, message: 'El envasado ya estaba cerrado.', missingLbs: Number(batch.packaging_loss_lbs || 0) });
        }

        // Sumar envasado real
        const [pkgSum] = await connection.query(
            'SELECT COALESCE(SUM(total_batch_weight_lbs), 0) as packaged_weight FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
            [id, company_id]
        );
        const packagedWeight = parseFloat(pkgSum[0]?.packaged_weight || 0);
        const yieldLiquid = parseFloat(batch.yield_liquid_lbs || 0);

        // Sumar remanentes asignados al lote si existen para obtener la base líquida total
        const [remSum] = await connection.query(
            'SELECT COALESCE(SUM(quantity_lbs), 0) as remanentes_lbs FROM egg_batch_remanentes WHERE target_batch_id = ? AND company_id = ?',
            [id, company_id]
        );
        const remanentesLbs = parseFloat(remSum[0]?.remanentes_lbs || 0);
        const totalAvailableLiquid = yieldLiquid + remanentesLbs;
        const basisLiquid = totalAvailableLiquid > 0 ? totalAvailableLiquid : yieldLiquid;

        if (basisLiquid <= 0 && packagedWeight <= 0) {
            fail('No hay rendimiento líquido registrado ni producto envasado para realizar el cierre técnico.', 400);
        }

        const missingLbs = Math.max(0, basisLiquid - packagedWeight);
        const efficiencyPct = basisLiquid > 0
            ? Math.round((packagedWeight / basisLiquid) * 10000) / 100
            : (packagedWeight > 0 ? 100 : 0);

        const closingNotes = notes || reason || '';

        // Si faltaron libras por envasar, registrarlas como merma en tuberías / envasado
        if (missingLbs > 0.01) {
            await connection.query(
                `INSERT INTO egg_batch_waste_logs (company_id, batch_id, stage, waste_type, quantity_lbs, reason, operator_name)
                 VALUES (?, ?, 'envasado', 'merma_tuberias_envasado', ?, ?, ?)`,
                [
                    company_id, id, missingLbs,
                    closingNotes || `Faltante de cierre de envasado (${missingLbs.toFixed(2)} Lbs no envasadas / residuos en tuberías).`,
                    operator_name || req.user?.nombre || 'Operador Envasado'
                ]
            );
        }

        // Marcar lote como cerrado en envasado
        await connection.query(
            `UPDATE egg_production_batches
             SET packaging_status = 'cerrado',
                 status = CASE WHEN status = 'aprobado_calidad' THEN status ELSE 'empaquetado' END,
                 packaging_loss_lbs = ?,
                 packaging_efficiency_pct = ?,
                 completed_at = COALESCE(completed_at, NOW())
             WHERE id = ? AND company_id = ?`,
            [missingLbs, efficiencyPct, id, company_id]
        );

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'packaging.closed', 'info', ?, ?, ?)`,
            [
                company_id,
                `Envasado de lote #${id} (${batch.batch_code_display || batch.batch_uuid}) cerrado. Envasado: ${packagedWeight} Lbs. Base líquida: ${basisLiquid} Lbs. ${missingLbs > 0 ? `Faltante registrado como merma: ${missingLbs.toFixed(2)} Lbs.` : 'Sin merma residual.'} Eficiencia: ${efficiencyPct}%.`,
                JSON.stringify({ batch_id: parseInt(id), packagedWeight, yieldLiquid, remanentesLbs, basisLiquid, missingLbs, efficiencyPct, notes: closingNotes }),
                operator_name || req.user?.nombre || 'Operador'
            ]
        );

        await connection.commit();
        res.json({
            success: true,
            message: `Lote cerrado exitosamente. Eficiencia de envasado: ${efficiencyPct}%. Merma registrada: ${missingLbs.toFixed(2)} Lbs.`,
            packagedWeight,
            missingLbs,
            efficiencyPct
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in closeBatchPackaging:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const reopenBatchPackaging = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;

        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (batches.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote no encontrado.' });
        }
        const batch = batches[0];

        // Revertir merma automática de faltante de envasado si existía
        await connection.query(
            `DELETE FROM egg_batch_waste_logs
             WHERE batch_id = ? AND company_id = ? AND stage = 'envasado' AND waste_type = 'merma_tuberias_envasado'`,
            [id, company_id]
        );

        // Reabrir lote en envasado
        await connection.query(
            `UPDATE egg_production_batches
             SET packaging_status = 'en_envasado',
                 status = CASE WHEN status = 'empaquetado' THEN 'pasteurizado' ELSE status END,
                 packaging_loss_lbs = 0,
                 packaging_efficiency_pct = 0
             WHERE id = ? AND company_id = ?`,
            [id, company_id]
        );

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'packaging.reopened', 'warning', ?, ?, ?)`,
            [
                company_id,
                `Envasado del lote #${id} (${batch.batch_code_display || batch.batch_uuid}) reabierto para nuevos registros.`,
                JSON.stringify({ batch_id: parseInt(id) }),
                req.user?.nombre || 'Operador'
            ]
        );

        await connection.commit();
        res.json({ success: true, message: 'Envasado reabierto exitosamente. Ahora puede agregar más empaques o modificar registros.', packaging_status: 'en_envasado' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in reopenBatchPackaging:', error);
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const getCodeMappings = async (req, res) => {
    try {
        await ensureEggSchema();
        const RECIPE_NAMES = {
            'huevo entero': 'Huevo Entero Pasteurizado',
            'huevo rapido': 'Huevo Entero Rápido',
            'clara': 'Clara Pasteurizada',
            'clara ppg': 'Clara PPG',
            'yema salada': 'Yema Líquida Salada',
            'yema azucarada': 'Yema Líquida Azucarada',
            'yema': 'Yema Líquida',
            'fórmula especial': 'Fórmula Especial / Mezcla Premium'
        };

        const [rows] = await pool.query(
            `SELECT m.*,
                    m.catalog_product_id AS product_id,
                    COALESCE(
                        NULLIF(TRIM(m.catalog_product_name), ''),
                        p.nombre,
                        CONCAT(m.industrial_product_type, ' - ', m.presentation)
                    ) AS product_name,
                    m.industrial_product_type AS product_type,
                    m.catalog_codes AS codes,
                    m.unit_weight_lbs AS weight_lbs,
                    m.unit_weight_kg AS weight_kg
             FROM egg_product_code_mappings m
             LEFT JOIN products p ON p.id = m.catalog_product_id AND p.company_id = m.company_id
             WHERE m.company_id = ?
             ORDER BY m.industrial_product_type, m.presentation`,
            [req.company_id]
        );

        const processed = rows.map(r => {
            const key = String(r.product_type || r.industrial_product_type || '').trim().toLowerCase();
            const canonicalRecipe = RECIPE_NAMES[key] || r.product_name;
            return {
                ...r,
                recipe_name: canonicalRecipe,
                product_name: r.product_name || canonicalRecipe
            };
        });

        res.json(processed);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { closeBatchPackaging, reopenBatchPackaging, getCodeMappings };
