const { fail, number, pool } = require('./shared');

const deleteBlastFreezerLog = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM egg_blast_freezer_logs WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Registro de Blast Freezer no encontrado.' });
        }

        await pool.query('DELETE FROM egg_blast_freezer_logs WHERE id = ? AND company_id = ?', [id, company_id]);

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'blast_freezer.deleted', 'warning', ?, ?, ?)`,
            [
                company_id,
                `Registro de Blast Freezer #${id} eliminado.`,
                JSON.stringify({ blast_freezer_id: parseInt(id) }),
                req.user?.nombre || 'Operador'
            ]
        );

        res.json({ success: true, message: 'Registro de Blast Freezer eliminado exitosamente.' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const getPackagingRecords = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT pr.*,
                    COALESCE(pr.product_type, b.product_type) as product_type,
                    COALESCE(pr.presentation, b.presentation) as presentation,
                    b.batch_uuid
             FROM egg_packaging_records pr
             LEFT JOIN egg_production_batches b ON pr.batch_id = b.id
             WHERE pr.company_id = ?
             ORDER BY pr.created_at DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const createPackagingRecord = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const {
            batch_id, units_packaged, weight_per_unit_lbs, operator_name,
            warehouse_zone = 'COOLER', product_state = 'liquido',
            label_type = 'etiqueta_4x2', customer_destination = null,
            product_type: customProductType, presentation: customPresentation
        } = req.body;
        const company_id = req.company_id;

        // Obtener lote
        const [batches] = await connection.query('SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE', [batch_id, company_id]);
        if (batches.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });
        const batch = batches[0];
        if (batch.packaging_status === 'cerrado') fail('Reabra el envasado antes de agregar registros.', 409);
        // Validar si el lote está bloqueado por HACCP
        if (batch.status === 'bloqueado_haccp') {
            return res.status(400).json({
                message: 'ERROR DE CALIDAD: No se puede empaquetar este lote porque tiene un bloqueo activo de inocuidad alimentaria (Falla HACCP).'
            });
        }

        // Determinar si viene un array de presentaciones (items) o un registro individual
        const itemsToProcess = Array.isArray(req.body.items) && req.body.items.length > 0
            ? req.body.items
            : [req.body];

        const createdRecords = [];
        let latestWarehouseZone = warehouse_zone;
        let latestProductState = product_state;

        for (const item of itemsToProcess) {
            const units_packaged = number(item.units_packaged, 'Unidades', 1);
            const weight_per_unit_lbs = parseFloat(item.weight_per_unit_lbs || 0);
            number(item.units_packaged, 'Unidades', 1);
            number(item.weight_per_unit_lbs, 'Peso unitario', 0.001);
            if (!Number.isInteger(Number(item.units_packaged))) fail('Las unidades deben ser enteras.');
            const [balance] = await connection.query('SELECT COALESCE(SUM(total_batch_weight_lbs), 0) AS packaged FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?', [batch_id, company_id]);
            if (Number(balance[0].packaged) + units_packaged * weight_per_unit_lbs > Number(batch.yield_liquid_lbs || 0) + 0.01) fail('El envasado supera el rendimiento líquido registrado.');

            const itemWarehouseZone = item.warehouse_zone || warehouse_zone || 'COOLER';
            const itemProductState = item.product_state || product_state || 'liquido';
            latestWarehouseZone = itemWarehouseZone;
            latestProductState = itemProductState;

            const customProductType = item.product_type || req.body.product_type;
            const customPresentation = item.presentation || req.body.presentation;

            const resolvedProduct = (customProductType || batch.product_type || 'Huevo Entero Pasteurizado').trim();
            const resolvedPresentation = (customPresentation || batch.presentation || 'cubeta 30LB').trim();
            const total_batch_weight_lbs = units_packaged * weight_per_unit_lbs;
            const cleanProduct = resolvedProduct.replace(/\s+/g, '-').toUpperCase();

            // Correlativo de envasado para este lote
            const [pkgSeqRows] = await connection.query(
                'SELECT COUNT(*) as cnt FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
                [batch_id, company_id]
            );
            const pkgSeq = (pkgSeqRows[0]?.cnt || 0) + 1;

            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const baseLotCode = batch.batch_code_display
                ? `LOT-${batch.batch_code_display.replace(/\s+/g, '')}`
                : `LOT-${dateStr}-${cleanProduct}-${batch_id}`;

            // Garantizar unicidad de lot_code evitando colisiones
            let lot_code = pkgSeq > 1 ? `${baseLotCode}-${String(pkgSeq).padStart(2, '0')}` : baseLotCode;
            let suffixNum = pkgSeq > 1 ? pkgSeq : 1;
            let attempts = 0;
            while (attempts < 50) {
                const [dup] = await connection.query('SELECT id FROM egg_packaging_records WHERE lot_code = ?', [lot_code]);
                if (dup.length === 0) break;
                suffixNum++;
                lot_code = `${baseLotCode}-${String(suffixNum).padStart(2, '0')}`;
                attempts++;
            }

            // Código de barras simulado (UPC-A de 12 dígitos)
            const barcode = `741258${String(batch_id).padStart(4, '0')}${String(suffixNum).padStart(2, '0')}`;

            // Vida útil según estado: Congelado a -18°C = 365 días (1 año), Líquido refrigerado 2° a 4°C = 28 días
            const shelfLifeDays = itemProductState === 'congelado' ? 365 : 28;

            // Payload completo de trazabilidad para el código QR
            const qr_code_payload = JSON.stringify({
                lot_code,
                batch_display: batch.batch_code_display || lot_code,
                product: resolvedProduct,
                presentation: resolvedPresentation,
                units: units_packaged,
                weight_lbs: total_batch_weight_lbs,
                warehouse_zone: itemWarehouseZone,
                product_state: itemProductState,
                packaged_at: new Date().toISOString(),
                trace_uuid: batch.batch_uuid,
                operator: operator_name || req.user?.nombre || ''
            });

            // Determinar estado de calidad inicial según el estatus del lote
            const initialQualityStatus = 'cuarentena'; // La liberación requiere el dictamen de laboratorio para el empaque.

            // Insertar registro con product_type y presentation independientes
            const [result] = await connection.query(
                `INSERT INTO egg_packaging_records (
                    company_id, batch_id, product_type, presentation, units_packaged, warehouse_zone, product_state, quality_status,
                    weight_per_unit_lbs, total_batch_weight_lbs, lot_code, barcode, label_type,
                    customer_destination, qr_code_payload, expiry_date, operator_name
                )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), ?)`,
                [
                    company_id, batch_id, resolvedProduct, resolvedPresentation, units_packaged, itemWarehouseZone, itemProductState, initialQualityStatus,
                    weight_per_unit_lbs, total_batch_weight_lbs, lot_code, barcode, label_type,
                    customer_destination, qr_code_payload, shelfLifeDays, operator_name || req.user?.nombre || ''
                ]
            );

            createdRecords.push({
                id: result.insertId,
                lot_code,
                product_type: resolvedProduct,
                presentation: resolvedPresentation,
                barcode,
                warehouse_zone: itemWarehouseZone,
                product_state: itemProductState,
                quality_status: initialQualityStatus,
                units_packaged,
                weight_per_unit_lbs,
                total_batch_weight_lbs,
                shelfLifeDays,
                qr_code_payload
            });
        }

        if (createdRecords.length === 0) {
            return res.status(400).json({ message: 'Debe ingresar al menos una presentación con unidades válidas.' });
        }

        // Actualizar estado de lote preservando dictamen previo de calidad si existiera
        if (batch.status !== 'aprobado_calidad' && batch.status !== 'bloqueado_haccp') {
            const newBatchStatus = latestWarehouseZone === 'BLAST' || latestProductState === 'congelado' ? 'congelado' : 'empaquetado';
            await connection.query(
                `UPDATE egg_production_batches SET status = ? WHERE id = ? AND company_id = ?`,
                [newBatchStatus, batch_id, company_id]
            );
        }

        // Crear evento
        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'packaging.completed', 'info', ?, ?, ?)`,
            [
                company_id,
                `Empaque completado para lote ${batch.batch_code_display || batch_id} (${createdRecords.length} presentación(es) registrada(s)).`,
                JSON.stringify(createdRecords),
                operator_name || req.user?.nombre || 'Operador'
            ]
        );

        if (createdRecords.length === 1 && !Array.isArray(req.body.items)) {
            await connection.commit();
            res.status(201).json(createdRecords[0]);
        } else {
            await connection.commit();
            res.status(201).json({ success: true, count: createdRecords.length, records: createdRecords, ...createdRecords[0] });
        }
    } catch (error) {
        await connection.rollback();
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        await connection.rollback();
        connection.release();
    }
};
module.exports = { deleteBlastFreezerLog, getPackagingRecords, createPackagingRecord };
