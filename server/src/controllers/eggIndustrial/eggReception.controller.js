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
    computeJulianLotCode
} = require('./eggUtils');


// --- RECEPCIÓN DE MATERIA PRIMA & CERTIFICADOS ---
// 1. RECEPCIÓN DE MATERIA PRIMA
const getRawMaterials = async (req, res) => {
    try {
        const { only_with_stock } = req.query;
        let sql = `SELECT rm.*, p.nombre as provider_name 
             FROM egg_raw_materials rm
             LEFT JOIN providers p ON rm.provider_id = p.id
             WHERE rm.company_id = ?`;
        const params = [req.company_id];
        if (only_with_stock === 'true') {
            sql += ' AND rm.status = ? AND rm.stock_lbs > 0';
            params.push('aprobado');
            sql += ' ORDER BY rm.fecha ASC, rm.created_at ASC, rm.id ASC';
        } else {
            sql += ' ORDER BY rm.created_at DESC';
        }
        const [rows] = await pool.query(sql, params);

        // Consultar consumos previos por lote y tarima en batch_raw_materials
        const [consumedRows] = await pool.query(
            `SELECT brm.raw_material_id, brm.tarimas_json, brm.quantity_lbs, brm.boxes_count
             FROM batch_raw_materials brm
             JOIN egg_production_batches b ON b.id = brm.batch_id
             WHERE b.company_id = ? AND b.status != 'cancelado'`,
            [req.company_id]
        );

        const consumedMap = {};
        for (const c of consumedRows) {
            const rmId = c.raw_material_id;
            if (!consumedMap[rmId]) consumedMap[rmId] = { tarimas: {}, totalBoxes: 0, totalLbs: 0 };
            consumedMap[rmId].totalBoxes += parseInt(c.boxes_count) || 0;
            consumedMap[rmId].totalLbs += parseFloat(c.quantity_lbs) || 0;

            let parsed = [];
            if (c.tarimas_json) {
                try {
                    parsed = typeof c.tarimas_json === 'string' ? JSON.parse(c.tarimas_json) : c.tarimas_json;
                } catch (e) { }
            }
            if (Array.isArray(parsed)) {
                for (const t of parsed) {
                    const num = parseInt(t.tarima_number) || 1;
                    if (!consumedMap[rmId].tarimas[num]) {
                        consumedMap[rmId].tarimas[num] = { boxes: 0, lbs: 0 };
                    }
                    consumedMap[rmId].tarimas[num].boxes += parseInt(t.boxes_count) || 0;
                    consumedMap[rmId].tarimas[num].lbs += parseFloat(t.quantity_lbs) || 0;
                }
            }
        }

        const enrichedRows = rows.map(rm => {
            const consumed = consumedMap[rm.id] || { tarimas: {}, totalBoxes: 0, totalLbs: 0 };
            let originalTarimas = [];
            if (rm.tarimas_json) {
                try {
                    originalTarimas = typeof rm.tarimas_json === 'string' ? JSON.parse(rm.tarimas_json) : rm.tarimas_json;
                } catch (e) { }
            }

            const lotCode = (rm.provider_lot || 'LOTE').trim().toUpperCase();

            // Si no tiene desglose de tarimas pero tiene peso/cajas, crear tarima default #1
            if (!Array.isArray(originalTarimas) || originalTarimas.length === 0) {
                const origBoxes = parseInt(rm.total_boxes) || 0;
                const origLbs = parseFloat(rm.weight_lbs) || 0;
                originalTarimas = [{
                    tarima_number: 1,
                    boxes_count: origBoxes,
                    net_weight_lbs: origLbs,
                    storage_location: rm.storage_location || 'abajo'
                }];
            }

            const tarimasAvailable = originalTarimas.map((t, idx) => {
                const tarimaNum = parseInt(t.tarima_number) || (idx + 1);
                const origBoxes = parseInt(t.boxes_count) || 0;
                const origLbs = parseFloat(t.net_weight_lbs || t.gross_weight_lbs) || 0;

                const used = consumed.tarimas[tarimaNum] || { boxes: 0, lbs: 0 };
                const availBoxes = Math.max(0, origBoxes - used.boxes);
                const availLbs = Math.max(0, Math.round((origLbs - used.lbs) * 100) / 100);

                const barcode = `TAR-${lotCode}-${String(tarimaNum).padStart(2, '0')}`;
                const isDepleted = (availBoxes <= 0 && availLbs <= 0.01) || parseFloat(rm.stock_lbs) <= 0.01;

                return {
                    tarima_number: tarimaNum,
                    original_boxes: origBoxes,
                    original_lbs: origLbs,
                    consumed_boxes: used.boxes,
                    consumed_lbs: used.lbs,
                    available_boxes: availBoxes,
                    available_lbs: availLbs,
                    barcode: barcode,
                    storage_location: t.storage_location || rm.storage_location || 'abajo',
                    is_depleted: isDepleted
                };
            });

            const isDepleted = parseFloat(rm.stock_lbs) <= 0.01 || (tarimasAvailable.length > 0 && tarimasAvailable.every(t => t.is_depleted));

            return {
                ...rm,
                tarimas_available: tarimasAvailable,
                is_depleted: isDepleted
            };
        });

        const finalResult = only_with_stock === 'true'
            ? enrichedRows.filter(r => !r.is_depleted && parseFloat(r.stock_lbs) > 0.01)
            : enrichedRows;

        res.json(finalResult);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createRawMaterial = async (req, res) => {
    try {
        const {
            provider_id, egg_type, egg_color, egg_size, weight_lbs,
            temperature_c, truck_temperature_c, truck_plate, driver_name,
            total_boxes, tarimas_json, provider_lot, certificate_urls,
            operator_name, status, fecha, storage_location
        } = req.body;

        const mainStorageLocation = storage_location || 'abajo';

        // Si viene desglose de tarimas, calcular el peso neto total, cajas y asegurar storage_location
        let finalWeightLbs = weight_lbs;
        let finalBoxes = total_boxes || 0;
        let cleanTarimas = [];
        if (Array.isArray(tarimas_json) && tarimas_json.length > 0) {
            cleanTarimas = tarimas_json.map((t, idx) => ({
                ...t,
                tarima_number: t.tarima_number || (idx + 1),
                storage_location: t.storage_location || mainStorageLocation
            }));
            const sumNet = cleanTarimas.reduce((acc, t) => acc + (parseFloat(t.net_weight_lbs) || 0), 0);
            const sumBoxes = cleanTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0);
            if (sumNet > 0) finalWeightLbs = sumNet;
            if (sumBoxes > 0) finalBoxes = sumBoxes;
        }

        let branchId = req.body.branch_id || req.user?.branch_id;
        if (!branchId) {
            const [b] = await pool.query('SELECT id FROM branches WHERE company_id = ? LIMIT 1', [req.company_id]);
            branchId = b[0]?.id || 1;
        }

        const [result] = await pool.query(
            `INSERT INTO egg_raw_materials (
                company_id, branch_id, provider_id, egg_type, egg_color, egg_size, 
                fecha, weight_lbs, total_boxes, storage_location, stock_lbs, temperature_c, truck_temperature_c, 
                truck_plate, driver_name, provider_lot, certificate_urls, tarimas_json, operator_name, status
            ) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.company_id, branchId, provider_id, egg_type,
                egg_color || 'blanco', egg_size || 'L', fecha || new Date().toISOString().split('T')[0],
                finalWeightLbs, finalBoxes, mainStorageLocation, finalWeightLbs, temperature_c || null,
                truck_temperature_c || null, truck_plate || null, driver_name || null,
                provider_lot, JSON.stringify(certificate_urls || []),
                JSON.stringify(cleanTarimas.length > 0 ? cleanTarimas : (tarimas_json || [])), operator_name, status || 'aprobado'
            ]
        );

        // Crear evento de auditoría
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.received', 'info', ?, ?, ?)`,
            [
                req.company_id,
                `Recibido lote de materia prima ${egg_type} (${finalWeightLbs} LBS, ${finalBoxes} cajas) del proveedor lote ${provider_lot}.`,
                JSON.stringify({ raw_material_id: result.insertId, weight_lbs: finalWeightLbs, total_boxes: finalBoxes }),
                operator_name
            ]
        );

        res.status(201).json({ id: result.insertId, weight_lbs: finalWeightLbs, total_boxes: finalBoxes, storage_location: mainStorageLocation, ...req.body });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateRawMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            provider_id, egg_type, egg_color, egg_size, weight_lbs,
            temperature_c, truck_temperature_c, truck_plate, driver_name,
            total_boxes, tarimas_json, provider_lot, certificate_urls,
            operator_name, status, fecha, storage_location
        } = req.body;

        const [existing] = await pool.query(
            'SELECT * FROM egg_raw_materials WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Recepción no encontrada.' });
        }

        const mainStorageLocation = storage_location || existing[0].storage_location || 'abajo';

        let finalWeightLbs = weight_lbs;
        let finalBoxes = total_boxes || existing[0].total_boxes || 0;
        let cleanTarimas = [];
        if (Array.isArray(tarimas_json) && tarimas_json.length > 0) {
            cleanTarimas = tarimas_json.map((t, idx) => ({
                ...t,
                tarima_number: t.tarima_number || (idx + 1),
                storage_location: t.storage_location || mainStorageLocation
            }));
            const sumNet = cleanTarimas.reduce((acc, t) => acc + (parseFloat(t.net_weight_lbs) || 0), 0);
            const sumBoxes = cleanTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0);
            if (sumNet > 0) finalWeightLbs = sumNet;
            if (sumBoxes > 0) finalBoxes = sumBoxes;
        }

        // Si el peso cambia y el lote aún no ha sido consumido, ajustar stock_lbs
        const currentStock = parseFloat(existing[0].stock_lbs);
        const prevWeight = parseFloat(existing[0].weight_lbs);
        let updatedStock = currentStock;
        if (currentStock === prevWeight) {
            updatedStock = finalWeightLbs;
        }

        await pool.query(
            `UPDATE egg_raw_materials SET 
                provider_id = ?, egg_type = ?, egg_color = ?, egg_size = ?, 
                fecha = ?, weight_lbs = ?, total_boxes = ?, storage_location = ?, stock_lbs = ?, 
                temperature_c = ?, truck_temperature_c = ?, truck_plate = ?, driver_name = ?, 
                provider_lot = ?, certificate_urls = ?, tarimas_json = ?, operator_name = ?, status = ?
             WHERE id = ? AND company_id = ?`,
            [
                provider_id, egg_type, egg_color || 'blanco', egg_size || 'L',
                fecha || existing[0].fecha, finalWeightLbs, finalBoxes, mainStorageLocation, updatedStock,
                temperature_c, truck_temperature_c || null, truck_plate || null, driver_name || null,
                provider_lot, JSON.stringify(certificate_urls || []),
                JSON.stringify(cleanTarimas.length > 0 ? cleanTarimas : (tarimas_json || [])), operator_name, status || 'aprobado',
                id, req.company_id
            ]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.updated', 'info', ?, ?, ?)`,
            [req.company_id, `Recepción de materia prima #${id} actualizada.`, JSON.stringify({ raw_material_id: parseInt(id), ...req.body }), operator_name]
        );

        res.json({ id, weight_lbs: finalWeightLbs, total_boxes: finalBoxes, ...req.body });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const voidRawMaterial = async (req, res) => {
    try {
        const { id } = req.params;

        const [existing] = await pool.query(
            'SELECT * FROM egg_raw_materials WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Recepción no encontrada.' });
        }

        const stock = parseFloat(existing[0].stock_lbs || 0);
        const weight = parseFloat(existing[0].weight_lbs || 0);
        if (stock < weight) {
            return res.status(400).json({ message: `No se puede anular: el stock disponible (${stock.toFixed(2)} Lbs) es menor al peso original (${weight.toFixed(2)} Lbs). Parte del lote ya fue consumido en producción.` });
        }

        await pool.query(
            'UPDATE egg_raw_materials SET status = ? WHERE id = ? AND company_id = ?',
            ['anulado', id, req.company_id]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.voided', 'warning', ?, ?, ?)`,
            [req.company_id, `Recepción de materia prima #${id} anulada.`, JSON.stringify({ raw_material_id: parseInt(id) }), existing[0].operator_name]
        );

        res.json({ id, status: 'anulado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 1.1 Clasificación y Dictamen de Calidad de Lote de Materia Prima (Personal de Calidad LAB 001 / LAB-004)
const saveQualityClassification = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            egg_classification,
            egg_size,
            egg_color,
            quality_inspector_name,
            quality_reviewed_by,
            quality_status,
            quality_notes,
            quality_defect_broken_pct,
            quality_defect_dirty_pct,
            quality_brix,
            // Campos extendidos LAB 001
            remission_note,
            farm_name,
            production_date,
            expiration_date,
            sample_egg_weight_g,
            quality_lab_report_json
        } = req.body;

        const [existing] = await pool.query(
            'SELECT * FROM egg_raw_materials WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Recepción no encontrada.' });
        }

        const inspector = quality_inspector_name || req.user?.nombre || 'Inspector de Calidad';
        const reviewedBy = quality_reviewed_by || 'Jefe de Control de Calidad';
        const qStatus = quality_status || 'aprobado_calidad';
        const now = new Date();

        const jsonStr = quality_lab_report_json
            ? (typeof quality_lab_report_json === 'string' ? quality_lab_report_json : JSON.stringify(quality_lab_report_json))
            : null;

        await pool.query(
            `UPDATE egg_raw_materials SET 
                egg_classification = ?,
                egg_size = COALESCE(?, egg_size),
                egg_color = COALESCE(?, egg_color),
                quality_inspector_name = ?,
                quality_reviewed_by = ?,
                quality_status = ?,
                quality_date = ?,
                quality_notes = ?,
                quality_defect_broken_pct = ?,
                quality_defect_dirty_pct = ?,
                quality_brix = ?,
                remission_note = COALESCE(?, remission_note),
                farm_name = COALESCE(?, farm_name),
                production_date = COALESCE(?, production_date),
                expiration_date = COALESCE(?, expiration_date),
                sample_egg_weight_g = COALESCE(?, sample_egg_weight_g),
                quality_lab_report_json = COALESCE(?, quality_lab_report_json)
             WHERE id = ? AND company_id = ?`,
            [
                egg_classification || 'Grado A',
                egg_size || null,
                egg_color || null,
                inspector,
                reviewedBy,
                qStatus,
                now,
                quality_notes || null,
                parseFloat(quality_defect_broken_pct) || 0,
                parseFloat(quality_defect_dirty_pct) || 0,
                quality_brix ? parseFloat(quality_brix) : null,
                remission_note || null,
                farm_name || null,
                production_date || null,
                expiration_date || null,
                sample_egg_weight_g ? parseFloat(sample_egg_weight_g) : null,
                jsonStr,
                id,
                req.company_id
            ]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'raw_material.quality_classified', 'info', ?, ?, ?)`,
            [
                req.company_id,
                `Evaluación de calidad y dictamen LAB 001 registrado para lote ${existing[0].provider_lot || id}: ${egg_classification || 'Grado A'} (${qStatus}).`,
                JSON.stringify({ raw_material_id: parseInt(id), egg_classification, quality_status: qStatus }),
                inspector
            ]
        );

        res.json({
            success: true,
            message: 'Reporte técnico de calidad LAB 001 y dictamen guardados exitosamente.',
            data: {
                id,
                egg_classification,
                quality_inspector_name: inspector,
                quality_reviewed_by: reviewedBy,
                quality_status: qStatus,
                quality_date: now
            }
        });
    } catch (error) {
        console.error('Error al guardar clasificación de calidad:', error);
        res.status(500).json({ message: error.message });
    }
};

// 1.2 Exportación Oficial LAB 001 - Reporte de Control de Calidad de Materia Prima
const getRawMaterialLab001Pdf = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        let data = await eggRawMaterialLabReport.getRawMaterialLab001Data(id, companyId);
        if (!data) {
            return res.status(404).json({ message: 'Recepción de materia prima no encontrada.' });
        }

        // Si se envió un body (POST) o override con datos en edición, combinarlos con data
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            const b = req.body;
            data = {
                ...data,
                classification: b.egg_classification || data.classification,
                farm_name: b.farm_name || data.farm_name,
                remission_note: b.remission_note || data.remission_note,
                production_date: b.production_date || data.production_date,
                expiration_date: b.expiration_date || data.expiration_date,
                total_boxes: b.total_boxes !== undefined ? b.total_boxes : data.total_boxes,
                sample_egg_weight_g: b.sample_egg_weight_g || data.sample_egg_weight_g,
                egg_color: (b.egg_color || data.egg_color || 'BLANCO').toUpperCase(),
                egg_size: (b.egg_size || data.egg_size || 'L').toUpperCase(),
                physicochemical: b.physicochemical || data.physicochemical,
                organoleptic: b.organoleptic || data.organoleptic,
                transport_storage: b.transport_storage || data.transport_storage,
                observations: b.quality_notes || b.observations || data.observations,
                inspector_name: b.inspector_name || b.quality_inspector_name || data.inspector_name,
                reviewed_by: b.reviewed_by || b.quality_reviewed_by || data.reviewed_by
            };
        }

        const safeLot = (data.provider_lot || `LOTE-${id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const format = (req.query.format || req.body?.format || 'pdf').toLowerCase();

        if (format === 'word' || format === 'docx') {
            const docxBuffer = await eggRawMaterialLabReport.generateRawMaterialLab001Docx(data);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="LAB_001_Materia_Prima_${safeLot}.docx"`);
            return res.send(docxBuffer);
        }

        const pdfBuffer = await eggRawMaterialLabReport.generateRawMaterialLab001Pdf(data);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="LAB_001_Materia_Prima_${safeLot}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating LAB 001 PDF:', error);
        res.status(500).json({ message: error.message });
    }
};

// 1.3 Exportación Oficial Certificado de Calidad de Origen (Proveedor a ANDELSA)
const getOriginCertificate = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        let data = await eggOriginCertificate.getOriginCertificateData(id, companyId);
        if (!data) {
            return res.status(404).json({ message: 'Recepción de materia prima no encontrada.' });
        }

        // Si se envió un body (POST) con datos en edición o vista previa, combinarlos
        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            const b = req.body;
            data = {
                ...data,
                provider_name: b.provider_name ? String(b.provider_name).toUpperCase() : data.provider_name,
                client_name: b.client_name ? String(b.client_name).toUpperCase() : data.client_name,
                lot_provider: b.lot_provider || b.provider_lot || data.lot_provider,
                lot_internal: b.lot_internal || b.andelsa_lot || data.lot_internal,
                is_color_blanco: b.is_color_blanco !== undefined ? Boolean(b.is_color_blanco) : data.is_color_blanco,
                is_color_marron: b.is_color_marron !== undefined ? Boolean(b.is_color_marron) : data.is_color_marron,
                is_camion_cerrado: b.is_camion_cerrado !== undefined ? Boolean(b.is_camion_cerrado) : data.is_camion_cerrado,
                is_limpieza_camion: b.is_limpieza_camion !== undefined ? Boolean(b.is_limpieza_camion) : data.is_limpieza_camion,
                is_cartones_limpios: b.is_cartones_limpios !== undefined ? Boolean(b.is_cartones_limpios) : data.is_cartones_limpios,
                bird_batches: Array.isArray(b.bird_batches) ? b.bird_batches : data.bird_batches
            };
        }

        const safeLot = (data.lot_internal || data.lot_provider || `LOTE-${id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const format = (req.query.format || req.body?.format || 'pdf').toLowerCase();

        if (format === 'word' || format === 'docx') {
            const docxBuffer = await eggOriginCertificate.generateOriginCertificateWord(data);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="Certificado_Calidad_Origen_${safeLot}.docx"`);
            return res.send(docxBuffer);
        }

        const pdfBuffer = await eggOriginCertificate.generateOriginCertificatePdf(data);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Certificado_Calidad_Origen_${safeLot}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating Origin Certificate:', error);
        res.status(500).json({ message: error.message });
    }
};

// 1.4 Obtener Certificado de Calidad de Origen por Lote de Producción (Backward Traceability)
const getOriginCertificateByBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const companyId = req.company_id || req.user?.company_id;

        // 1. Buscar materia prima asociada al lote
        let rawMaterialId = null;
        const [brmRows] = await pool.query(
            `SELECT raw_material_id FROM batch_raw_materials WHERE batch_id = ? LIMIT 1`,
            [batchId]
        );
        if (brmRows.length > 0 && brmRows[0].raw_material_id) {
            rawMaterialId = brmRows[0].raw_material_id;
        } else {
            const [bRows] = await pool.query(
                `SELECT raw_material_id FROM egg_production_batches WHERE id = ? AND company_id = ? LIMIT 1`,
                [batchId, companyId]
            );
            if (bRows.length > 0 && bRows[0].raw_material_id) {
                rawMaterialId = bRows[0].raw_material_id;
            }
        }

        if (!rawMaterialId) {
            return res.status(404).json({ message: 'No se encontró recepción de materia prima asociada a este lote de producción.' });
        }

        // Reutilizar getOriginCertificate delegando el ID de materia prima
        req.params.id = rawMaterialId;
        return getOriginCertificate(req, res);
    } catch (error) {
        console.error('Error generating Origin Certificate by Batch:', error);
        res.status(500).json({ message: error.message });
    }
};

// 2. CIP LOGS (Clean In Place)

// --- ELIMINACIÓN DE MATERIA PRIMA ---
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
        res.status(500).json({ message: error.message });
    }
};

// 23. Reportes de Huevo Industrial

module.exports = {
    getRawMaterials,
    createRawMaterial,
    updateRawMaterial,
    voidRawMaterial,
    saveQualityClassification,
    getRawMaterialLab001Pdf,
    getOriginCertificate,
    getOriginCertificateByBatch,
    deleteRawMaterial
};
