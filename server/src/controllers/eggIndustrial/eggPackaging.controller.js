const {
    pool,
    nodemailer,
    broadcastToCompany,
    notificationService,
    eggExportService,
    eggReportsExportService,
    eggQualityLetterExport,
    eggRawMaterialLabReport,
    eggOriginCertificate,
    reportPdfHelper,
    excelService,
    resolveEggCatalogProduct,
    safeNum,
    safeInt,
    computeJulianLotCode,
    ensureEggSchema
} = require('./eggUtils');


// --- REGISTROS DE ENVASADO Y TÚNEL DE CONGELACIÓN (BLAST FREEZER) ---
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
        res.status(500).json({ message: error.message });
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
        res.status(500).json({ message: error.message });
    }
};

const createPackagingRecord = async (req, res) => {
    try {
        const {
            batch_id, units_packaged, weight_per_unit_lbs, operator_name,
            warehouse_zone = 'COOLER', product_state = 'liquido',
            label_type = 'etiqueta_4x2', customer_destination = null,
            product_type: customProductType, presentation: customPresentation
        } = req.body;
        const company_id = req.company_id;

        // Obtener lote
        const [batches] = await pool.query('SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?', [batch_id, company_id]);
        if (batches.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });
        const batch = batches[0];

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
            const units_packaged = parseInt(item.units_packaged || 0, 10);
            const weight_per_unit_lbs = parseFloat(item.weight_per_unit_lbs || 0);
            if (units_packaged <= 0 || weight_per_unit_lbs <= 0) continue;

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
            const [pkgSeqRows] = await pool.query(
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
                const [dup] = await pool.query('SELECT id FROM egg_packaging_records WHERE lot_code = ?', [lot_code]);
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
            const initialQualityStatus = batch.status === 'aprobado_calidad' ? 'liberado' : (batch.status === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'cuarentena');

            // Insertar registro con product_type y presentation independientes
            const [result] = await pool.query(
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
            await pool.query(
                `UPDATE egg_production_batches SET status = ? WHERE id = ? AND company_id = ?`,
                [newBatchStatus, batch_id, company_id]
            );
        }

        // Crear evento
        await pool.query(
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
            res.status(201).json(createdRecords[0]);
        } else {
            res.status(201).json({ success: true, count: createdRecords.length, records: createdRecords, ...createdRecords[0] });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updatePackagingRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            units_packaged,
            weight_per_unit_lbs,
            operator_name,
            lot_code,
            product_type,
            presentation,
            batch_id,
            reopen_packaging
        } = req.body;
        const company_id = req.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM egg_packaging_records WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Registro de empaque no encontrado.' });
        }
        const currentRecord = existing[0];

        const userPerms = Array.isArray(req.user?.permissions)
            ? req.user.permissions
            : (typeof req.user?.permissions === 'string' ? JSON.parse(req.user?.permissions || '[]') : []);
        const canEditLots = req.user?.role === 'SuperAdmin' || req.user?.role === 'Admin' || req.user?.role_id <= 2 || userPerms.includes('manage_egg_production_lots') || userPerms.includes('manage_egg_packaging_close');

        const finalUnits = parseInt(units_packaged !== undefined ? units_packaged : currentRecord.units_packaged, 10);
        const finalWeight = parseFloat(weight_per_unit_lbs !== undefined ? weight_per_unit_lbs : currentRecord.weight_per_unit_lbs);
        const total_batch_weight_lbs = finalUnits * finalWeight;

        // Si tiene permiso especial, puede cambiar lote de empaque, lote de producción, producto y presentación
        const finalLotCode = (canEditLots && lot_code && lot_code.trim()) ? lot_code.trim() : currentRecord.lot_code;
        const finalProductType = (canEditLots && product_type && product_type.trim()) ? product_type.trim() : currentRecord.product_type;
        const finalPresentation = (canEditLots && presentation && presentation.trim()) ? presentation.trim() : currentRecord.presentation;
        const finalBatchId = (canEditLots && batch_id) ? parseInt(batch_id, 10) : currentRecord.batch_id;

        // Actualizar qr_code_payload si cambió algo clave
        let updatedQrPayload = currentRecord.qr_code_payload;
        try {
            const parsed = JSON.parse(currentRecord.qr_code_payload || '{}');
            parsed.lot_code = finalLotCode;
            parsed.product = finalProductType;
            parsed.presentation = finalPresentation;
            parsed.units = finalUnits;
            parsed.weight_lbs = total_batch_weight_lbs;
            updatedQrPayload = JSON.stringify(parsed);
        } catch {
            updatedQrPayload = JSON.stringify({
                lot_code: finalLotCode,
                product: finalProductType,
                presentation: finalPresentation,
                units: finalUnits,
                weight_lbs: total_batch_weight_lbs
            });
        }

        await pool.query(
            `UPDATE egg_packaging_records 
             SET units_packaged = ?, 
                 weight_per_unit_lbs = ?, 
                 total_batch_weight_lbs = ?, 
                 lot_code = ?,
                 product_type = ?,
                 presentation = ?,
                 batch_id = ?,
                 qr_code_payload = ?,
                 operator_name = ? 
             WHERE id = ? AND company_id = ?`,
            [
                finalUnits,
                finalWeight,
                total_batch_weight_lbs,
                finalLotCode,
                finalProductType,
                finalPresentation,
                finalBatchId,
                updatedQrPayload,
                operator_name || currentRecord.operator_name,
                id,
                company_id
            ]
        );

        // Si se solicitó reabrir el envasado del lote asociado
        if (canEditLots && reopen_packaging) {
            await pool.query(
                `UPDATE egg_production_batches 
                 SET packaging_status = 'abierto',
                     status = CASE WHEN status = 'empaquetado' THEN 'pasteurizado' ELSE status END,
                     packaging_loss_lbs = 0,
                     packaging_efficiency_pct = 0
                 WHERE id = ? AND company_id = ?`,
                [finalBatchId, company_id]
            );
            await pool.query(
                `DELETE FROM egg_batch_waste_logs 
                 WHERE batch_id = ? AND company_id = ? AND stage = 'envasado' AND waste_type = 'merma_tuberias_envasado'`,
                [finalBatchId, company_id]
            );
        }

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'packaging.updated', 'info', ?, ?, ?)`,
            [
                company_id,
                `Empaque #${id} (${finalLotCode}) actualizado: ${finalUnits} unidades, ${total_batch_weight_lbs} Lbs, producto: ${finalProductType}.`,
                JSON.stringify({ packaging_id: parseInt(id), lot_code: finalLotCode, product_type: finalProductType, presentation: finalPresentation }),
                operator_name || req.user?.nombre || 'Operador'
            ]
        );

        res.json({
            id,
            units_packaged: finalUnits,
            weight_per_unit_lbs: finalWeight,
            total_batch_weight_lbs,
            lot_code: finalLotCode,
            product_type: finalProductType,
            presentation: finalPresentation,
            batch_id: finalBatchId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deletePackagingRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id;

        const [existing] = await pool.query(
            'SELECT * FROM egg_packaging_records WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Registro de empaque no encontrado.' });
        }

        // Check if this packaging record is linked to a blast freezer log
        const [freezerRefs] = await pool.query(
            'SELECT id FROM egg_blast_freezer_logs WHERE packaging_id = ?',
            [id]
        );
        if (freezerRefs.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar: este empaque tiene registros de Blast Freezer asociados. Elimine primero los registros de congelación.' });
        }

        await pool.query('DELETE FROM egg_packaging_records WHERE id = ? AND company_id = ?', [id, company_id]);

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'packaging.deleted', 'warning', ?, ?, ?)`,
            [company_id, `Empaque #${id} eliminado.`, JSON.stringify({ packaging_id: parseInt(id) }), existing[0].operator_name]
        );

        res.json({ id, deleted: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 7. BLAST FREEZER (Congelador rápido)
const getBlastFreezerLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT fl.*, pr.lot_code, b.product_type 
             FROM egg_blast_freezer_logs fl
             LEFT JOIN egg_packaging_records pr ON fl.packaging_id = pr.id
             LEFT JOIN egg_production_batches b ON pr.batch_id = b.id
             WHERE fl.company_id = ? 
             ORDER BY fl.created_at DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createBlastFreezerLog = async (req, res) => {
    try {
        const { packaging_id, freezer_location, core_temperature_c, freezing_duration_hours, status } = req.body;
        const company_id = req.company_id;

        const [result] = await pool.query(
            `INSERT INTO egg_blast_freezer_logs (company_id, packaging_id, freezer_location, core_temperature_c, freezing_duration_hours, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [company_id, packaging_id, freezer_location, core_temperature_c, freezing_duration_hours, status || 'congelando']
        );

        // Si ya está completado el congelado, actualizar el lote general
        if (status === 'congelado_ok') {
            const [pkgs] = await pool.query('SELECT batch_id FROM egg_packaging_records WHERE id = ? AND company_id = ?', [packaging_id, company_id]);
            if (pkgs.length > 0) {
                await pool.query(
                    `UPDATE egg_production_batches SET status = 'congelado' WHERE id = ? AND company_id = ?`,
                    [pkgs[0].batch_id, company_id]
                );
            }
        }

        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 8. MANTENIMIENTO

// --- CIERRE DE ENVASADO ---
const closeBatchPackaging = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { reason, operator_name } = req.body;
        const company_id = req.company_id;

        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (batches.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote no encontrado.' });
        }
        const batch = batches[0];

        // Sumar envasado real
        const [pkgSum] = await connection.query(
            'SELECT COALESCE(SUM(total_batch_weight_lbs), 0) as packaged_weight FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
            [id, company_id]
        );
        const packagedWeight = parseFloat(pkgSum[0]?.packaged_weight || 0);
        const yieldLiquid = parseFloat(batch.yield_liquid_lbs || 0);
        const missingLbs = Math.max(0, yieldLiquid - packagedWeight);
        const efficiencyPct = yieldLiquid > 0 ? Math.round((packagedWeight / yieldLiquid) * 10000) / 100 : 0;

        // Si faltaron libras por envasar, registrarlas como merma en tuberías / envasado
        if (missingLbs > 0.01) {
            await connection.query(
                `INSERT INTO egg_batch_waste_logs (company_id, batch_id, stage, waste_type, quantity_lbs, reason, operator_name)
                 VALUES (?, ?, 'envasado', 'merma_tuberias_envasado', ?, ?, ?)`,
                [
                    company_id, id, missingLbs,
                    reason || `Faltante de cierre de envasado (${missingLbs.toFixed(2)} Lbs no envasadas / residuos en tuberías).`,
                    operator_name || req.user?.nombre || 'Operador Envasado'
                ]
            );
        }

        // Marcar lote como cerrado en envasado
        await connection.query(
            `UPDATE egg_production_batches 
             SET packaging_status = 'cerrado', 
                 status = 'empaquetado',
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
                `Envasado de lote #${id} (${batch.batch_code_display || batch.batch_uuid}) cerrado. Envasado: ${packagedWeight} Lbs. Faltante registrado como merma: ${missingLbs} Lbs. Eficiencia: ${efficiencyPct}%.`,
                JSON.stringify({ batch_id: parseInt(id), packagedWeight, yieldLiquid, missingLbs, efficiencyPct }),
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
        res.status(500).json({ message: error.message });
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
             SET packaging_status = 'abierto',
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
        res.json({ success: true, message: 'Envasado reabierto exitosamente. Ahora puede agregar más empaques o modificar registros.', packaging_status: 'abierto' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in reopenBatchPackaging:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

// 3.8 Exportar Resumen de Producción en PDF, Excel y Word

// --- MAPEO DE CÓDIGOS E INVENTARIO TRADUCIDO ---
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
        res.status(500).json({ message: error.message });
    }
};

const saveCodeMapping = async (req, res) => {
    try {
        await ensureEggSchema();
        const mappingId = req.params?.id || req.body?.id;
        const {
            industrial_product_type,
            product_type,
            presentation,
            catalog_codes,
            codes,
            code_items,
            unit_weight_lbs,
            weight_lbs,
            unit_weight_kg,
            weight_kg,
            catalog_product_id,
            product_id,
            catalog_product_name,
            product_name,
            unit_of_measure,
            notes
        } = req.body;
        const company_id = req.company_id;
        const resolvedProductType = String(industrial_product_type || product_type || '').trim();
        const resolvedPresentation = String(presentation || '').trim();
        const resolvedUnit = String(unit_of_measure || 'lb').trim().toLowerCase();
        const currentMappingId = mappingId ? Number(mappingId) : null;

        // Normalizar lista de códigos y pesos por código
        let items = [];
        if (Array.isArray(code_items) && code_items.length > 0) {
            items = code_items;
        } else if (Array.isArray(codes)) {
            items = codes.map((c) => {
                if (typeof c === 'object' && c !== null) return c;
                return {
                    code: String(c || '').trim(),
                    weight_lbs: Number(unit_weight_lbs ?? weight_lbs ?? 1),
                    weight_kg: Number(unit_weight_kg ?? weight_kg ?? 0.45)
                };
            });
        } else {
            const rawCodes = normalizeCatalogCodes(catalog_codes ?? codes);
            items = rawCodes.map((c) => ({
                code: c,
                weight_lbs: Number(unit_weight_lbs ?? weight_lbs ?? 1),
                weight_kg: Number(unit_weight_kg ?? weight_kg ?? 0.45)
            }));
        }

        // Filtrar códigos vacíos y estandarizar
        items = items
            .map((it) => {
                const c = String(it.code || '').trim();
                const itemLbs = Number(it.weight_lbs ?? unit_weight_lbs ?? weight_lbs ?? 1);
                const itemKg = Number(it.weight_kg ?? (itemLbs * 0.45359237).toFixed(2));
                return {
                    code: c,
                    weight_lbs: Number.isFinite(itemLbs) && itemLbs > 0 ? itemLbs : 1,
                    weight_kg: Number.isFinite(itemKg) && itemKg > 0 ? itemKg : 0.45,
                    product_id: it.product_id ? Number(it.product_id) : null,
                    product_name: it.product_name ? String(it.product_name).trim() : null
                };
            })
            .filter((it) => it.code.length > 0);

        const resolvedCodes = items.map((it) => it.code);

        if (!resolvedProductType || !resolvedPresentation || resolvedCodes.length === 0) {
            return res.status(400).json({ message: 'Tipo de producto, presentación y al menos un código vinculado son obligatorios.' });
        }
        if (mappingId && (!Number.isInteger(currentMappingId) || currentMappingId <= 0)) {
            return res.status(400).json({ message: 'El identificador del mapeo no es válido.' });
        }
        if (!['lb', 'kg'].includes(resolvedUnit)) {
            return res.status(400).json({ message: 'La unidad de medida debe ser lb o kg.' });
        }

        // 1. Validar que no haya códigos repetidos dentro de la misma solicitud
        const uniqueSet = new Set();
        const duplicatesInForm = [];
        for (const c of resolvedCodes) {
            const lower = c.toLowerCase();
            if (uniqueSet.has(lower)) {
                duplicatesInForm.push(c);
            }
            uniqueSet.add(lower);
        }
        if (duplicatesInForm.length > 0) {
            return res.status(400).json({
                message: `El código "${duplicatesInForm.join(', ')}" está repetido en el formulario. Cada código debe ser único.`
            });
        }

        // 2. Validar que ninguno de los códigos esté ya vinculado a otra configuración
        const [otherMappings] = await pool.query(
            currentMappingId
                ? 'SELECT id, catalog_codes, catalog_product_name, industrial_product_type FROM egg_product_code_mappings WHERE company_id = ? AND id <> ?'
                : 'SELECT id, catalog_codes, catalog_product_name, industrial_product_type FROM egg_product_code_mappings WHERE company_id = ?',
            currentMappingId ? [company_id, currentMappingId] : [company_id]
        );
        const assignedCodesMap = new Map();
        for (const om of otherMappings) {
            const ocList = normalizeCatalogCodes(om.catalog_codes);
            for (const oc of ocList) {
                assignedCodesMap.set(oc.toLowerCase(), om.catalog_product_name || om.industrial_product_type || 'otra vinculación');
            }
        }

        const duplicateCodes = resolvedCodes.filter((c) => assignedCodesMap.has(c.toLowerCase()));
        if (duplicateCodes.length > 0) {
            const details = duplicateCodes
                .map((c) => `"${c}" (ya vinculado en ${assignedCodesMap.get(c.toLowerCase())})`)
                .join(', ');
            return res.status(409).json({
                message: `Los siguientes códigos ya están vinculados a otro producto: ${details}. Evite duplicar productos para evitar inconsistencias de inventario.`
            });
        }

        const requestedProductId = catalog_product_id ?? product_id ?? items.find((i) => i.product_id)?.product_id;
        const parsedProductId = requestedProductId ? Number(requestedProductId) : null;
        let resolvedProductId = null;
        let resolvedProductName = String(catalog_product_name || product_name || items[0]?.product_name || '').trim() || null;

        if (parsedProductId !== null) {
            if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
                return res.status(400).json({ message: 'El producto de catálogo seleccionado no es válido.' });
            }
            const [products] = await pool.query(
                'SELECT id, nombre FROM products WHERE id = ? AND company_id = ? LIMIT 1',
                [parsedProductId, company_id]
            );
            if (products.length === 0) {
                return res.status(400).json({ message: 'El producto seleccionado no pertenece a la empresa actual.' });
            }
            resolvedProductId = products[0].id;
            if (!resolvedProductName) resolvedProductName = products[0].nombre;
        }

        if (!resolvedProductName) {
            return res.status(400).json({ message: 'Debe indicar un nombre descriptivo para el producto comercial.' });
        }

        const primaryLbs = items.length > 0 ? items[0].weight_lbs : Number(unit_weight_lbs ?? weight_lbs ?? 1);
        const primaryKg = items.length > 0 ? items[0].weight_kg : Number((primaryLbs * 0.45359237).toFixed(2));
        const resolvedNotes = notes ? String(notes).trim() : null;
        const codeWeightsJson = JSON.stringify(items);

        if (currentMappingId) {
            const [result] = await pool.query(
                `UPDATE egg_product_code_mappings 
                 SET catalog_product_id = ?, catalog_product_name = ?, industrial_product_type = ?, presentation = ?, catalog_codes = ?,
                     code_weights_json = ?, unit_weight_lbs = ?, unit_weight_kg = ?, unit_of_measure = ?, notes = ?, updated_at = NOW()
                 WHERE id = ? AND company_id = ?`,
                [
                    resolvedProductId, resolvedProductName, resolvedProductType, resolvedPresentation, resolvedCodes.join(', '),
                    codeWeightsJson, primaryLbs, primaryKg, resolvedUnit, resolvedNotes, currentMappingId, company_id
                ]
            );
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Mapeo de códigos no encontrado.' });
            }
            return res.json({ success: true, message: 'Vinculación de códigos actualizada correctamente.' });
        } else {
            const [result] = await pool.query(
                `INSERT INTO egg_product_code_mappings (
                    company_id, catalog_product_id, catalog_product_name, industrial_product_type, presentation, catalog_codes,
                    code_weights_json, unit_weight_lbs, unit_weight_kg, unit_of_measure, notes
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    company_id, resolvedProductId, resolvedProductName, resolvedProductType, resolvedPresentation,
                    resolvedCodes.join(', '), codeWeightsJson, primaryLbs, primaryKg, resolvedUnit, resolvedNotes
                ]
            );
            return res.status(201).json({ id: result.insertId, success: true, message: 'Vinculación de códigos creada exitosamente.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteCodeMapping = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM egg_product_code_mappings WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Mapeo de códigos no encontrado.' });
        }
        res.json({ success: true, message: 'Mapeo eliminado exitosamente.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 25. Inventario Traducido de Huevo Industrial
const getTranslatedInventory = async (req, res) => {
    try {
        await ensureEggSchema();
        const company_id = req.company_id;

        // 1. Obtener todos los mapeos activos
        const [mappings] = await pool.query(
            'SELECT * FROM egg_product_code_mappings WHERE company_id = ?',
            [company_id]
        );

        // Crear mapas rápidos de código y producto de catálogo -> mapeo con peso unitario específico por código.
        const codeMap = {};
        const mappingByProductId = {};
        const mappedCodesList = [];
        const mappedProductIds = [];
        for (const m of mappings) {
            let weightsByCode = {};
            if (m.code_weights_json) {
                try {
                    const parsed = typeof m.code_weights_json === 'string' ? JSON.parse(m.code_weights_json) : m.code_weights_json;
                    if (Array.isArray(parsed)) {
                        parsed.forEach((item) => {
                            if (item && item.code) {
                                weightsByCode[item.code.toLowerCase().trim()] = item;
                            }
                        });
                    }
                } catch (e) {
                    console.error('Error parsing code_weights_json in getTranslatedInventory:', e);
                }
            }

            const rawCodes = normalizeCatalogCodes(m.catalog_codes).map((code) => code.toLowerCase());
            for (const c of rawCodes) {
                const specificItem = weightsByCode[c];
                const specificLbs = specificItem ? parseFloat(specificItem.weight_lbs) : null;
                const specificKg = specificItem ? parseFloat(specificItem.weight_kg) : null;

                codeMap[c] = {
                    mapping: m,
                    weight_lbs: Number.isFinite(specificLbs) && specificLbs > 0 ? specificLbs : parseFloat(m.unit_weight_lbs || 1),
                    weight_kg: Number.isFinite(specificKg) && specificKg > 0 ? specificKg : parseFloat(m.unit_weight_kg || 0.45),
                    matched_code: c
                };
                mappedCodesList.push(c);
            }
            const catalogProductId = Number(m.catalog_product_id);
            if (Number.isInteger(catalogProductId) && catalogProductId > 0) {
                mappingByProductId[catalogProductId] = {
                    mapping: m,
                    weight_lbs: parseFloat(m.unit_weight_lbs || 1),
                    weight_kg: parseFloat(m.unit_weight_kg || 0.45)
                };
                mappedProductIds.push(catalogProductId);
            }
        }

        // 2. Consultar productos del inventario general con su stock real de forma optimizada
        const safeCodes = mappedCodesList.length > 0 ? mappedCodesList : ['__none__'];
        const safeProductIds = mappedProductIds.length > 0 ? mappedProductIds : [0];
        const [products] = await pool.query(
            `SELECT p.id, p.codigo, p.codigo_barra, p.nombre, COALESCE(SUM(i.stock), 0) as stock, p.unidad_medida, c.name as category_name
             FROM products p
             LEFT JOIN inventory i ON p.id = i.product_id
             LEFT JOIN product_categories c ON p.category_id = c.id
             WHERE p.company_id = ? AND p.status = 'activo'
               AND (
                   LOWER(p.nombre) LIKE '%huevo%' 
                   OR LOWER(p.nombre) LIKE '%clara%' 
                   OR LOWER(p.nombre) LIKE '%yema%'
                   OR LOWER(c.name) LIKE '%huevo%'
                   OR LOWER(c.name) LIKE '%ovoproducto%'
                   OR LOWER(p.codigo) IN (?)
                   OR LOWER(p.codigo_barra) IN (?)
                   OR p.id IN (?)
               )
             GROUP BY p.id, p.codigo, p.codigo_barra, p.nombre, p.unidad_medida, c.name`,
            [company_id, safeCodes, safeCodes, safeProductIds]
        );

        // 3. Clasificar y traducir inventario
        const items = [];
        const byType = {};
        let grandTotalUnits = 0;
        let grandTotalLbs = 0;
        let grandTotalKg = 0;
        const unmappedProducts = [];

        for (const prod of products) {
            const code = (prod.codigo || '').trim().toLowerCase();
            const barcode = (prod.codigo_barra || '').trim().toLowerCase();
            const matchedEntry = codeMap[code] || codeMap[barcode] || mappingByProductId[prod.id];
            const mapping = matchedEntry?.mapping;
            const currentStockUnits = parseFloat(prod.stock || 0);

            const isEggCandidate =
                (prod.nombre || '').toLowerCase().includes('huevo') ||
                (prod.nombre || '').toLowerCase().includes('clara') ||
                (prod.nombre || '').toLowerCase().includes('yema') ||
                (prod.categoria || '').toLowerCase().includes('huevo') ||
                (prod.category_name || '').toLowerCase().includes('huevo') ||
                (prod.category_name || '').toLowerCase().includes('ovoproducto');

            if (mapping) {
                // Usar peso unitario específico de este código si fue configurado individualmente
                const lbsPerUnit = parseFloat(matchedEntry?.weight_lbs ?? mapping.unit_weight_lbs ?? 1);
                const kgPerUnit = parseFloat(matchedEntry?.weight_kg ?? mapping.unit_weight_kg ?? (lbsPerUnit * 0.453592));
                const totalLbs = currentStockUnits * lbsPerUnit;
                const totalKg = currentStockUnits * kgPerUnit;

                grandTotalUnits += currentStockUnits;
                grandTotalLbs += totalLbs;
                grandTotalKg += totalKg;

                // Fila para tabla plana
                items.push({
                    product_id: prod.id,
                    product_code: prod.codigo,
                    product_barcode: prod.codigo_barra,
                    product_name: prod.nombre,
                    product_type: mapping.industrial_product_type,
                    presentation: mapping.presentation,
                    matched_code: (codeMap[code] ? prod.codigo : (codeMap[barcode] ? prod.codigo_barra : mapping.catalog_codes)),
                    unit_of_measure: mapping.unit_of_measure || 'lb',
                    stock_units: currentStockUnits,
                    weight_per_unit_lbs: lbsPerUnit,
                    weight_per_unit_kg: kgPerUnit,
                    total_lbs: totalLbs,
                    total_kg: totalKg
                });

                // Agrupar por Tipo de Producto
                const pType = mapping.industrial_product_type;
                if (!byType[pType]) {
                    byType[pType] = { product_type: pType, units: 0, total_lbs: 0, total_kg: 0, presentations: {} };
                }
                byType[pType].units += currentStockUnits;
                byType[pType].total_lbs += totalLbs;
                byType[pType].total_kg += totalKg;

                // Agrupar por Presentación
                const pres = mapping.presentation;
                if (!byType[pType].presentations[pres]) {
                    byType[pType].presentations[pres] = {
                        presentation: pres,
                        units: 0,
                        total_lbs: 0,
                        total_kg: 0,
                        unit_weight_lbs: lbsPerUnit,
                        unit_weight_kg: kgPerUnit,
                        unit_of_measure: mapping.unit_of_measure || 'lb',
                        matched_products: []
                    };
                }
                byType[pType].presentations[pres].units += currentStockUnits;
                byType[pType].presentations[pres].total_lbs += totalLbs;
                byType[pType].presentations[pres].total_kg += totalKg;
                byType[pType].presentations[pres].matched_products.push({
                    product_id: prod.id,
                    codigo: prod.codigo,
                    codigo_barra: prod.codigo_barra,
                    nombre: prod.nombre,
                    stock_units: currentStockUnits
                });
            } else if (isEggCandidate) {
                unmappedProducts.push({
                    id: prod.id,
                    codigo: prod.codigo,
                    nombre: prod.nombre,
                    stock_units: currentStockUnits,
                    categoria: prod.category_name || prod.categoria || 'Sin categoría'
                });
            }
        }

        // 4. Agrupar existencias según la vinculación de productos (egg_product_code_mappings)
        const byMapping = mappings.map(m => {
            const mCodes = normalizeCatalogCodes(m.catalog_codes).map(c => c.toLowerCase());
            const matchedProds = items.filter(it => 
                mCodes.includes((it.product_code || '').toLowerCase()) || 
                mCodes.includes((it.product_barcode || '').toLowerCase()) ||
                (it.product_id && it.product_id === Number(m.catalog_product_id))
            );

            const totalUnits = matchedProds.reduce((sum, it) => sum + (parseFloat(it.stock_units) || 0), 0);
            const totalLbs = matchedProds.reduce((sum, it) => sum + (parseFloat(it.total_lbs) || 0), 0);
            const totalKg = matchedProds.reduce((sum, it) => sum + (parseFloat(it.total_kg) || 0), 0);

            return {
                id: m.id,
                commercial_name: m.catalog_product_name || m.industrial_product_type,
                industrial_product_type: m.industrial_product_type,
                presentation: m.presentation,
                catalog_codes: m.catalog_codes,
                unit_weight_lbs: parseFloat(m.unit_weight_lbs || 1),
                unit_weight_kg: parseFloat(m.unit_weight_kg || 0.45),
                unit_of_measure: m.unit_of_measure || 'lb',
                total_stock_units: totalUnits,
                total_weight_lbs: Math.round(totalLbs * 100) / 100,
                total_weight_kg: Math.round(totalKg * 100) / 100,
                status: totalUnits <= 0 ? 'Agotado' : (totalUnits < 10 ? 'Bajo' : 'En Stock'),
                matched_items: matchedProds
            };
        });

        res.json({
            totals: {
                total_items: items.length,
                total_stock_units: grandTotalUnits,
                total_weight_lbs: Math.round(grandTotalLbs * 100) / 100,
                total_weight_kg: Math.round(grandTotalKg * 100) / 100
            },
            summary: {
                grandTotalUnits,
                grandTotalLbs: Math.round(grandTotalLbs * 100) / 100,
                grandTotalKg: Math.round(grandTotalKg * 100) / 100,
                mappedProductsCount: new Set([
                    ...Object.keys(codeMap).map((code) => `code:${code}`),
                    ...Object.keys(mappingByProductId).map((productId) => `product:${productId}`)
                ]).size,
                unmappedProductsCount: unmappedProducts.length
            },
            items,
            by_type: Object.values(byType),
            by_mapping: byMapping,
            unmapped_products: unmappedProducts,
            mappings_count: mappings.length
        });
    } catch (error) {
        console.error('Error in getTranslatedInventory:', error);
        res.status(500).json({ message: error.message });
    }
};

// 25.1 Exportación Oficial de Inventario Traducido (PDF / Excel)
const exportTranslatedInventory = async (req, res) => {
    try {
        await ensureEggSchema();
        const company_id = req.company_id || req.user?.company_id;
        const format = (req.query.format || 'pdf').toLowerCase();

        const [mappings] = await pool.query(
            'SELECT * FROM egg_product_code_mappings WHERE company_id = ?',
            [company_id]
        );

        const codeMap = {};
        const mappingByProductId = {};
        const mappedCodesList = [];
        const mappedProductIds = [];
        for (const m of mappings) {
            let weightsByCode = {};
            if (m.code_weights_json) {
                try {
                    const parsed = typeof m.code_weights_json === 'string' ? JSON.parse(m.code_weights_json) : m.code_weights_json;
                    if (Array.isArray(parsed)) {
                        parsed.forEach((item) => {
                            if (item && item.code) {
                                weightsByCode[item.code.toLowerCase().trim()] = item;
                            }
                        });
                    }
                } catch (e) {}
            }
            const rawCodes = normalizeCatalogCodes(m.catalog_codes).map((code) => code.toLowerCase());
            for (const c of rawCodes) {
                const specificItem = weightsByCode[c];
                const specificLbs = specificItem ? parseFloat(specificItem.weight_lbs) : null;
                const specificKg = specificItem ? parseFloat(specificItem.weight_kg) : null;
                codeMap[c] = {
                    mapping: m,
                    weight_lbs: Number.isFinite(specificLbs) && specificLbs > 0 ? specificLbs : parseFloat(m.unit_weight_lbs || 1),
                    weight_kg: Number.isFinite(specificKg) && specificKg > 0 ? specificKg : parseFloat(m.unit_weight_kg || 0.45),
                    matched_code: c
                };
                mappedCodesList.push(c);
            }
            const catalogProductId = Number(m.catalog_product_id);
            if (Number.isInteger(catalogProductId) && catalogProductId > 0) {
                mappingByProductId[catalogProductId] = {
                    mapping: m,
                    weight_lbs: parseFloat(m.unit_weight_lbs || 1),
                    weight_kg: parseFloat(m.unit_weight_kg || 0.45)
                };
                mappedProductIds.push(catalogProductId);
            }
        }

        const safeCodes = mappedCodesList.length > 0 ? mappedCodesList : ['__none__'];
        const safeProductIds = mappedProductIds.length > 0 ? mappedProductIds : [0];
        const [products] = await pool.query(
            `SELECT p.id, p.codigo, p.codigo_barra, p.nombre, COALESCE(SUM(i.stock), 0) as stock, p.unidad_medida, c.name as category_name
             FROM products p
             LEFT JOIN inventory i ON p.id = i.product_id
             LEFT JOIN product_categories c ON p.category_id = c.id
             WHERE p.company_id = ? AND p.status = 'activo'
               AND (
                   LOWER(p.nombre) LIKE '%huevo%' 
                   OR LOWER(p.nombre) LIKE '%clara%' 
                   OR LOWER(p.nombre) LIKE '%yema%'
                   OR LOWER(c.name) LIKE '%huevo%'
                   OR LOWER(c.name) LIKE '%ovoproducto%'
                   OR LOWER(p.codigo) IN (?)
                   OR LOWER(p.codigo_barra) IN (?)
                   OR p.id IN (?)
               )
             GROUP BY p.id, p.codigo, p.codigo_barra, p.nombre, p.unidad_medida, c.name`,
            [company_id, safeCodes, safeCodes, safeProductIds]
        );

        const items = [];
        let grandTotalUnits = 0;
        let grandTotalLbs = 0;
        let grandTotalKg = 0;

        for (const prod of products) {
            const code = (prod.codigo || '').trim().toLowerCase();
            const barcode = (prod.codigo_barra || '').trim().toLowerCase();
            const matchedEntry = codeMap[code] || codeMap[barcode] || mappingByProductId[prod.id];
            const mapping = matchedEntry?.mapping;
            const currentStockUnits = parseFloat(prod.stock || 0);

            if (mapping) {
                const lbsPerUnit = parseFloat(matchedEntry?.weight_lbs ?? mapping.unit_weight_lbs ?? 1);
                const kgPerUnit = parseFloat(matchedEntry?.weight_kg ?? mapping.unit_weight_kg ?? (lbsPerUnit * 0.453592));
                const totalLbs = currentStockUnits * lbsPerUnit;
                const totalKg = currentStockUnits * kgPerUnit;
                grandTotalUnits += currentStockUnits;
                grandTotalLbs += totalLbs;
                grandTotalKg += totalKg;

                items.push({
                    product_code: prod.codigo || '',
                    matched_code: (codeMap[code] ? prod.codigo : (codeMap[barcode] ? prod.codigo_barra : mapping.catalog_codes)),
                    product_name: mapping.catalog_product_name || prod.nombre,
                    product_type: mapping.industrial_product_type,
                    presentation: mapping.presentation,
                    stock_units: currentStockUnits,
                    weight_per_unit_lbs: lbsPerUnit,
                    weight_per_unit_kg: kgPerUnit,
                    total_lbs: totalLbs,
                    total_kg: totalKg,
                    status: currentStockUnits <= 0 ? 'Agotado' : (currentStockUnits < 10 ? 'Bajo' : 'En Stock')
                });
            }
        }

        // Exportar a Excel
        if (format === 'excel') {
            const rows = items.map(it => [
                it.product_code,
                it.matched_code,
                it.product_name,
                it.stock_units,
                it.weight_per_unit_lbs.toFixed(2),
                it.total_lbs.toFixed(2),
                it.total_kg.toFixed(2),
                it.status
            ]);
            rows.push([
                'TOTAL GENERAL',
                '',
                `${items.length} Productos`,
                grandTotalUnits,
                '',
                grandTotalLbs.toFixed(2),
                grandTotalKg.toFixed(2),
                ''
            ]);

            const buffer = await excelService.createExcelBuffer({
                title: 'Inventario Industrial Traducido',
                sheets: [{
                    name: 'Inventario Traducido',
                    headers: ['CÓDIGO CATÁLOGO', 'CÓDIGOS VINCULADOS', 'PRODUCTO COMERCIAL', 'STOCK FÍSICO', 'PESO UNIT. (LBS)', 'TOTAL LIBRAS (LBS)', 'TOTAL KILOS (KG)', 'ESTADO'],
                    rows
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `inventario_industrial_${new Date().toISOString().split('T')[0]}.xlsx`);
        }

        // Exportar a PDF (Estándar Contable Oficial Andelsa / Report Design Rules)
        const company = await reportPdfHelper.getCompanyInfo(company_id);
        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

        const title = 'INVENTARIO INDUSTRIAL TRADUCIDO';
        const subtitle = 'CONTROL DE STOCK, EQUIVALENCIAS Y CONVERSIÓN A LIBRAS Y KILOS';
        const periodText = `EMISIÓN: ${new Date().toLocaleDateString('es-SV')} ${new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}`;

        let currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);

        const drawTableHeader = (y) => {
            doc.rect(30, y, 732, 16).fill('#f1f5f9');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7);
            doc.text('CÓD. CATÁLOGO', 35, y + 4, { width: 65 });
            doc.text('CÓD. VINCULADOS', 105, y + 4, { width: 100 });
            doc.text('PRODUCTO COMERCIAL', 210, y + 4, { width: 200 });
            doc.text('STOCK (U)', 415, y + 4, { width: 65, align: 'right' });
            doc.text('PESO U. (LB)', 485, y + 4, { width: 65, align: 'right' });
            doc.text('TOTAL LBS', 555, y + 4, { width: 70, align: 'right' });
            doc.text('TOTAL KG', 630, y + 4, { width: 70, align: 'right' });
            doc.text('ESTADO', 705, y + 4, { width: 50, align: 'center' });
            doc.rect(30, y + 16, 732, 0.5).fill('#cbd5e1');
            return y + 18;
        };

        currentY = drawTableHeader(currentY);

        items.forEach((item, idx) => {
            if (currentY > 510) {
                doc.addPage();
                currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                currentY = drawTableHeader(currentY);
            }

            if (idx % 2 === 1) {
                doc.rect(30, currentY - 1, 732, 14).fill('#f8fafc');
            }

            doc.fillColor('#334155').font('Helvetica').fontSize(7);
            doc.text(item.product_code || '-', 35, currentY + 2, { width: 65 });
            doc.text(String(item.matched_code || '-').substring(0, 25), 105, currentY + 2, { width: 100 });
            doc.fillColor('#0f172a').font('Helvetica-Bold').text(item.product_name, 210, currentY + 2, { width: 200, ellipsis: true });
            doc.font('Helvetica').fillColor('#334155');
            doc.text(parseInt(item.stock_units).toLocaleString(), 415, currentY + 2, { width: 65, align: 'right' });
            doc.text(item.weight_per_unit_lbs.toFixed(2), 485, currentY + 2, { width: 65, align: 'right' });
            doc.font('Helvetica-Bold').fillColor('#047857').text(item.total_lbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 555, currentY + 2, { width: 70, align: 'right' });
            doc.fillColor('#6d28d9').text(item.total_kg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 630, currentY + 2, { width: 70, align: 'right' });
            doc.font('Helvetica').fillColor(item.stock_units <= 0 ? '#b91c1c' : '#047857').text(item.status, 705, currentY + 2, { width: 50, align: 'center' });

            currentY += 14;
        });

        if (currentY > 500) {
            doc.addPage();
            currentY = reportPdfHelper.renderHeader(doc, company, title, periodText, 'landscape', subtitle);
            currentY = drawTableHeader(currentY);
        }

        doc.rect(30, currentY, 732, 16).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5);
        doc.text('TOTALES DE INVENTARIO INDUSTRIAL:', 35, currentY + 4, { width: 370 });
        doc.text(parseInt(grandTotalUnits).toLocaleString(), 415, currentY + 4, { width: 65, align: 'right' });
        doc.fillColor('#047857').text(grandTotalLbs.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Lbs', 555, currentY + 4, { width: 70, align: 'right' });
        doc.fillColor('#6d28d9').text(grandTotalKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' Kg', 630, currentY + 4, { width: 70, align: 'right' });
        currentY += 24;

        reportPdfHelper.renderClosingFooter(doc, 30, currentY, items.length, 'Líneas de Inventario');
        reportPdfHelper.renderPageNumbers(doc);

        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=inventario_industrial_${new Date().toISOString().split('T')[0]}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error al exportar inventario traducido:', error);
        res.status(500).json({ message: error.message });
    }
};

// 20.1 Comprobante / Orden de Despacho y Entrega de Ovoproductos

module.exports = {
    getPackagingRecords,
    createPackagingRecord,
    updatePackagingRecord,
    deletePackagingRecord,
    closeBatchPackaging,
    reopenBatchPackaging,
    getBlastFreezerLogs,
    createBlastFreezerLog,
    deleteBlastFreezerLog,
    getCodeMappings,
    saveCodeMapping,
    deleteCodeMapping,
    getTranslatedInventory,
    exportTranslatedInventory
};
