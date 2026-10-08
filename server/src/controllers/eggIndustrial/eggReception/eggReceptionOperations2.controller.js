const { pool, eggRawMaterialLabReport, eggOriginCertificate } = require('./shared');

const calculateEggSizeFromWeight = (grams) => {
    if (!grams || isNaN(grams) || grams <= 0) return null;
    const g = parseFloat(grams);
    if (g >= 63.83) return 'Jumbo';
    if (g >= 56.74) return 'XL';
    if (g >= 49.64) return 'L';
    if (g >= 42.55) return 'M';
    if (g >= 35.45) return 'S';
    return 'Peewee';
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
        res.status(error.status || 500).json({ message: error.message });
    }
};

const saveQualityClassification = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            egg_classification,
            egg_size,
            egg_color,
            provider_lot,
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

        const resolvedEggSize = egg_size || (sample_egg_weight_g ? calculateEggSizeFromWeight(sample_egg_weight_g) : null);

        await pool.query(
            `UPDATE egg_raw_materials SET
                egg_classification = ?,
                egg_size = COALESCE(?, egg_size),
                egg_color = COALESCE(?, egg_color),
                provider_lot = COALESCE(?, provider_lot),
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
                resolvedEggSize || null,
                egg_color || null,
                provider_lot ? String(provider_lot).trim() : null,
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
        res.status(error.status || 500).json({ message: error.message });
    }
};

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
                reception_lot: b.reception_lot || data.reception_lot,
                provider_lot: b.provider_lot || data.provider_lot,
                plant_entry_date: b.plant_entry_date || data.plant_entry_date,
                reception_date: b.reception_date || data.reception_date,
                analysis_date: b.analysis_date || data.analysis_date,
                analysis_time: b.analysis_time || data.analysis_time,
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

        const safeLot = (data.reception_lot || data.provider_lot || `LOTE-${id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
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
        res.status(error.status || 500).json({ message: error.message });
    }
};

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
        res.status(error.status || 500).json({ message: error.message });
    }
};

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
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { voidRawMaterial, saveQualityClassification, getRawMaterialLab001Pdf, getOriginCertificate, getOriginCertificateByBatch };
