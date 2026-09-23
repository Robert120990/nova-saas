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


// --- TRAZABILIDAD 360° Y CARTAS DE CALIDAD ---
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

// 11.1 LISTADO MAESTRO DE TRAZABILIDAD 360° (Con filtros multicriterio y etapas)
const getTraceability360List = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { search, stage, start_date, end_date, page = 1, limit = 50 } = req.query;

        // 1. Consultar todos los flujos de recepción de materia prima
        const [rawRows] = await pool.query(`
            SELECT 
                rm.id as raw_material_id,
                rm.created_at as raw_reception_date,
                rm.provider_lot as raw_provider_lot,
                rm.egg_type as raw_egg_type,
                rm.egg_classification as raw_classification,
                rm.weight_lbs as raw_weight_lbs,
                rm.total_boxes as raw_total_boxes,
                rm.temperature_c as raw_temp_c,
                rm.truck_temperature_c,
                rm.truck_plate,
                rm.driver_name,
                rm.quality_status as raw_quality_status,
                rm.quality_defect_broken_pct as raw_defect_broken_pct,
                rm.quality_defect_dirty_pct as raw_defect_dirty_pct,
                rm.status as raw_status,
                rm.tarimas_json,
                p.nombre as provider_name,
                brm.quantity_lbs as brm_weight_used,
                b.id as batch_id,
                b.batch_uuid,
                b.batch_code_display,
                b.product_type as batch_product_type,
                b.presentation as batch_presentation,
                b.started_at as batch_started_at,
                b.completed_at as batch_completed_at,
                b.status as batch_status,
                b.input_weight_lbs as batch_input_weight,
                b.yield_liquid_lbs as batch_yield_liquid,
                b.waste_shell_lbs as batch_waste_shell,
                b.waste_loss_lbs as batch_waste_loss,
                b.operator_name as batch_operator,
                pk.id as packaging_id,
                pk.lot_code as commercial_lot_code,
                pk.product_type as packaged_product_type,
                pk.presentation as packaged_presentation,
                pk.units_packaged,
                pk.total_batch_weight_lbs as packaged_weight_lbs,
                pk.warehouse_zone,
                pk.product_state,
                pk.expiry_date,
                pk.customer_destination as pkg_customer_destination,
                pk.barcode as commercial_barcode,
                (SELECT GROUP_CONCAT(DISTINCT COALESCE(sh.cliente_nombre, c.nombre, 'Consumidor Final') SEPARATOR ', ') 
                 FROM sales_items si 
                 JOIN sales_headers sh ON sh.id = si.sale_id 
                 LEFT JOIN customers c ON c.id = sh.customer_id
                 WHERE pk.lot_code IS NOT NULL 
                   AND (si.codigo = pk.lot_code OR si.descripcion LIKE CONCAT('%', pk.lot_code, '%')) 
                   AND sh.estado != 'anulado'
                ) as sale_customer_name,
                lab.id as lab_log_id,
                lab.sample_date as lab_sample_date,
                lab.status as lab_status,
                lab.customer_name as lab_customer_name,
                lab.mesophilic_aerobic_cfu,
                lab.total_coliforms_mpn,
                lab.e_coli_mpn,
                lab.salmonella_25g,
                lab.solids_percentage,
                lab.ph,
                lab.observations as lab_observations,
                past.id as past_id,
                past.temperature_c as past_temp_c,
                past.holding_time_seconds as past_holding_time,
                past.haccp_compliant as past_haccp_compliant,
                past.deviation_description as past_deviation
            FROM egg_raw_materials rm
            LEFT JOIN providers p ON rm.provider_id = p.id
            LEFT JOIN batch_raw_materials brm ON brm.raw_material_id = rm.id
            LEFT JOIN egg_production_batches b ON (b.id = brm.batch_id OR b.raw_material_id = rm.id)
            LEFT JOIN egg_packaging_records pk ON pk.batch_id = b.id
            LEFT JOIN egg_lab_micro_logs lab ON lab.batch_id = b.id
            LEFT JOIN egg_pasteurization_logs past ON past.batch_id = b.id
            WHERE rm.company_id = ?
            ORDER BY rm.created_at DESC, b.started_at DESC, pk.id DESC
        `, [company_id]);

        // 2. Consultar lotes de producción independientes
        const [standaloneRows] = await pool.query(`
            SELECT 
                NULL as raw_material_id,
                b.started_at as raw_reception_date,
                'N/A (Lote Directo)' as raw_provider_lot,
                b.product_type as raw_egg_type,
                'Grado A' as raw_classification,
                b.input_weight_lbs as raw_weight_lbs,
                0 as raw_total_boxes,
                NULL as raw_temp_c,
                NULL as truck_temperature_c,
                NULL as truck_plate,
                NULL as driver_name,
                'aprobado' as raw_quality_status,
                0 as raw_defect_broken_pct,
                0 as raw_defect_dirty_pct,
                'aprobado' as raw_status,
                NULL as tarimas_json,
                'Planta ANDELSA' as provider_name,
                b.input_weight_lbs as brm_weight_used,
                b.id as batch_id,
                b.batch_uuid,
                b.batch_code_display,
                b.product_type as batch_product_type,
                b.presentation as batch_presentation,
                b.started_at as batch_started_at,
                b.completed_at as batch_completed_at,
                b.status as batch_status,
                b.input_weight_lbs as batch_input_weight,
                b.yield_liquid_lbs as batch_yield_liquid,
                b.waste_shell_lbs as batch_waste_shell,
                b.waste_loss_lbs as batch_waste_loss,
                b.operator_name as batch_operator,
                pk.id as packaging_id,
                pk.lot_code as commercial_lot_code,
                pk.product_type as packaged_product_type,
                pk.presentation as packaged_presentation,
                pk.units_packaged,
                pk.total_batch_weight_lbs as packaged_weight_lbs,
                pk.warehouse_zone,
                pk.product_state,
                pk.expiry_date,
                pk.customer_destination as pkg_customer_destination,
                pk.barcode as commercial_barcode,
                (SELECT GROUP_CONCAT(DISTINCT COALESCE(sh.cliente_nombre, c.nombre, 'Consumidor Final') SEPARATOR ', ') 
                 FROM sales_items si 
                 JOIN sales_headers sh ON sh.id = si.sale_id 
                 LEFT JOIN customers c ON c.id = sh.customer_id
                 WHERE pk.lot_code IS NOT NULL 
                   AND (si.codigo = pk.lot_code OR si.descripcion LIKE CONCAT('%', pk.lot_code, '%')) 
                   AND sh.estado != 'anulado'
                ) as sale_customer_name,
                lab.id as lab_log_id,
                lab.sample_date as lab_sample_date,
                lab.status as lab_status,
                lab.customer_name as lab_customer_name,
                lab.mesophilic_aerobic_cfu,
                lab.total_coliforms_mpn,
                lab.e_coli_mpn,
                lab.salmonella_25g,
                lab.solids_percentage,
                lab.ph,
                lab.observations as lab_observations,
                past.id as past_id,
                past.temperature_c as past_temp_c,
                past.holding_time_seconds as past_holding_time,
                past.haccp_compliant as past_haccp_compliant,
                past.deviation_description as past_deviation
            FROM egg_production_batches b
            LEFT JOIN egg_packaging_records pk ON pk.batch_id = b.id
            LEFT JOIN egg_lab_micro_logs lab ON lab.batch_id = b.id
            LEFT JOIN egg_pasteurization_logs past ON past.batch_id = b.id
            WHERE b.company_id = ? 
              AND b.id NOT IN (SELECT DISTINCT batch_id FROM batch_raw_materials WHERE batch_id IS NOT NULL)
              AND (b.raw_material_id IS NULL OR b.raw_material_id = 0)
            ORDER BY b.started_at DESC, pk.id DESC
        `, [company_id]);

        const allRows = [...rawRows, ...standaloneRows];

        // Normalizar y estructurar cada flujo de la cadena
        const processed = allRows.map((r, index) => {
            const isTransformed = !!r.batch_id;
            let transformStatus = 'en_silo';
            if (isTransformed) {
                if (['aprobado_calidad', 'completado', 'empaquetado', 'congelado'].includes(r.batch_status)) {
                    transformStatus = 'transformado';
                } else {
                    transformStatus = 'en_proceso';
                }
            }

            const hasHaccpAlert = r.past_haccp_compliant === 0 || !!r.past_deviation;
            const hasQualityAlert = r.lab_status === 'rechazado' || r.lab_status === 'cuarentena' ||
                (r.salmonella_25g && String(r.salmonella_25g).toLowerCase().includes('presencia')) ||
                (r.mesophilic_aerobic_cfu && Number(r.mesophilic_aerobic_cfu) > 10000) ||
                (r.total_coliforms_mpn && Number(r.total_coliforms_mpn) > 10);
            const hasAlerts = hasHaccpAlert || hasQualityAlert;

            const finalProduct = (r.packaged_product_type || r.batch_product_type || r.raw_egg_type || 'Huevo Entero Pasteurizado');
            const finalPresentation = (r.packaged_presentation || r.batch_presentation || 'Cubeta 30 Lb');
            const effectiveCustomer = r.sale_customer_name || r.pkg_customer_destination || r.lab_customer_name || null;
            const finalLotCode = r.commercial_lot_code || r.batch_code_display || r.raw_provider_lot || `LOTE-${index + 1}`;

            let tarimas = [];
            if (r.tarimas_json) {
                try {
                    tarimas = typeof r.tarimas_json === 'string' ? JSON.parse(r.tarimas_json) : r.tarimas_json;
                } catch { tarimas = []; }
            }

            return {
                id: `trace-${r.raw_material_id || 'b'}-${r.batch_id || 'none'}-${r.packaging_id || 'none'}-${index}`,
                raw_material_id: r.raw_material_id,
                raw_reception_date: r.raw_reception_date,
                provider_name: r.provider_name || 'Proveedor General',
                raw_provider_lot: r.raw_provider_lot,
                raw_egg_type: r.raw_egg_type,
                raw_classification: r.raw_classification || 'Grado A',
                raw_weight_lbs: parseFloat(r.raw_weight_lbs || 0),
                raw_total_boxes: parseInt(r.raw_total_boxes || 0, 10),
                raw_temp_c: r.raw_temp_c !== null ? parseFloat(r.raw_temp_c) : null,
                raw_quality_status: r.raw_quality_status || 'aprobado',
                raw_defect_broken_pct: parseFloat(r.raw_defect_broken_pct || 0),
                raw_defect_dirty_pct: parseFloat(r.raw_defect_dirty_pct || 0),
                tarimas,
                truck_plate: r.truck_plate,
                driver_name: r.driver_name,

                // Transformación / Producción
                is_transformed: isTransformed,
                transform_status: transformStatus,
                batch_id: r.batch_id,
                batch_uuid: r.batch_uuid,
                batch_code_display: r.batch_code_display,
                batch_started_at: r.batch_started_at,
                batch_completed_at: r.batch_completed_at,
                batch_status: r.batch_status,
                batch_yield_liquid: parseFloat(r.batch_yield_liquid || 0),
                batch_input_weight: parseFloat(r.batch_input_weight || 0),
                batch_operator: r.batch_operator,

                // Inventario Final / Empaque
                packaging_id: r.packaging_id,
                commercial_lot_code: r.commercial_lot_code,
                product_name: finalProduct,
                presentation: finalPresentation,
                units_packaged: parseInt(r.units_packaged || 0, 10),
                packaged_weight_lbs: parseFloat(r.packaged_weight_lbs || 0),
                warehouse_zone: r.warehouse_zone || 'COOLER',
                product_state: r.product_state || 'liquido',
                expiry_date: r.expiry_date,
                commercial_barcode: r.commercial_barcode,

                // Calidad & Alertas
                lab_log_id: r.lab_log_id,
                lab_sample_date: r.lab_sample_date,
                lab_status: r.lab_status || (r.batch_status === 'aprobado_calidad' ? 'aprobado' : (isTransformed ? 'pendiente' : 'en_espera')),
                has_haccp_alert: hasHaccpAlert,
                has_quality_alert: hasQualityAlert,
                has_alerts: hasAlerts,
                alert_reason: hasHaccpAlert ? (r.past_deviation || 'Desvío térmico HACCP en pasteurizador') : (hasQualityAlert ? (r.lab_observations || 'Observación en análisis microbiológico LAB-004') : null),
                past_temp_c: r.past_temp_c !== null ? parseFloat(r.past_temp_c) : null,
                past_holding_time: r.past_holding_time,
                mesophilic_aerobic_cfu: r.mesophilic_aerobic_cfu,
                total_coliforms_mpn: r.total_coliforms_mpn,
                e_coli_mpn: r.e_coli_mpn,
                salmonella_25g: r.salmonella_25g,
                solids_percentage: r.solids_percentage,
                ph: r.ph,

                // Destino / Cliente
                customer_name: effectiveCustomer,
                effective_lot: finalLotCode
            };
        });

        // 1. Filtro por Rango de Fecha (evalúa fecha de recepción de materia prima o fecha de inicio de producción)
        let filtered = processed;
        if (start_date || end_date) {
            filtered = filtered.filter(item => {
                const targetDate = item.raw_reception_date || item.batch_started_at;
                if (!targetDate) return true;
                const d = new Date(targetDate);
                if (isNaN(d.getTime())) return true;
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const itemDateStr = `${yyyy}-${mm}-${dd}`;

                if (start_date && itemDateStr < start_date) return false;
                if (end_date && itemDateStr > end_date) return false;
                return true;
            });
        }

        // 2. Filtro de búsqueda multicriterio
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(item => {
                return (
                    (item.provider_name && item.provider_name.toLowerCase().includes(q)) ||
                    (item.raw_provider_lot && item.raw_provider_lot.toLowerCase().includes(q)) ||
                    (item.batch_code_display && item.batch_code_display.toLowerCase().includes(q)) ||
                    (item.batch_uuid && item.batch_uuid.toLowerCase().includes(q)) ||
                    (item.commercial_lot_code && item.commercial_lot_code.toLowerCase().includes(q)) ||
                    (item.product_name && item.product_name.toLowerCase().includes(q)) ||
                    (item.customer_name && item.customer_name.toLowerCase().includes(q)) ||
                    (item.commercial_barcode && item.commercial_barcode.toLowerCase().includes(q))
                );
            });
        }

        // 3. Filtro por etapa de la cadena de trazabilidad
        if (stage && stage !== 'all') {
            if (stage === 'materia_prima') {
                // Muestra todos los ingresos de materia prima y su trazabilidad
                filtered = filtered.filter(i => !!i.raw_material_id);
            } else if (stage === 'produccion') {
                // Lotes que han ingresado a proceso de transformación
                filtered = filtered.filter(i => !!i.batch_id);
            } else if (stage === 'inventario_final') {
                // Lotes que ya cuentan con empaque / producto terminado
                filtered = filtered.filter(i => !!i.commercial_lot_code || !!i.packaging_id);
            } else if (stage === 'con_alertas') {
                // Lotes con desviaciones HACCP o fuera de norma de calidad
                filtered = filtered.filter(i => i.has_alerts);
            }
        }

        const total = filtered.length;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        const paginatedData = filtered.slice(offset, offset + limitNum);

        res.json({
            data: paginatedData,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1
        });
    } catch (error) {
        console.error('Error in getTraceability360List:', error);
        res.status(500).json({ message: error.message });
    }
};

// 11.2 ESTADÍSTICAS GLOBALES DE LA CADENA 360° (con soporte para rango de fechas)
const getTraceability360Stats = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { start_date, end_date } = req.query;

        let rmWhere = 'company_id = ?';
        let rmParams = [company_id];
        let batchWhere = 'company_id = ?';
        let batchParams = [company_id];
        let pkgWhere = 'company_id = ?';
        let pkgParams = [company_id];
        let pastWhere = 'company_id = ? AND (haccp_compliant = 0 OR (deviation_description IS NOT NULL AND deviation_description != ""))';
        let pastParams = [company_id];
        let labAlertWhere = 'company_id = ? AND (status = "rechazado" OR status = "cuarentena" OR salmonella_25g = "presencia" OR mesophilic_aerobic_cfu > 10000)';
        let labAlertParams = [company_id];
        let labApprovedWhere = 'company_id = ? AND status = "aprobado"';
        let labApprovedParams = [company_id];

        if (start_date) {
            rmWhere += ' AND DATE(created_at) >= ?';
            rmParams.push(start_date);
            batchWhere += ' AND DATE(started_at) >= ?';
            batchParams.push(start_date);
            pkgWhere += ' AND DATE(created_at) >= ?';
            pkgParams.push(start_date);
            pastWhere += ' AND DATE(created_at) >= ?';
            pastParams.push(start_date);
            labAlertWhere += ' AND DATE(sample_date) >= ?';
            labAlertParams.push(start_date);
            labApprovedWhere += ' AND DATE(sample_date) >= ?';
            labApprovedParams.push(start_date);
        }
        if (end_date) {
            rmWhere += ' AND DATE(created_at) <= ?';
            rmParams.push(end_date);
            batchWhere += ' AND DATE(started_at) <= ?';
            batchParams.push(end_date);
            pkgWhere += ' AND DATE(created_at) <= ?';
            pkgParams.push(end_date);
            pastWhere += ' AND DATE(created_at) <= ?';
            pastParams.push(end_date);
            labAlertWhere += ' AND DATE(sample_date) <= ?';
            labAlertParams.push(end_date);
            labApprovedWhere += ' AND DATE(sample_date) <= ?';
            labApprovedParams.push(end_date);
        }

        const [[rmStats]] = await pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(weight_lbs), 0) as total_lbs FROM egg_raw_materials WHERE ${rmWhere}`,
            rmParams
        );

        const [[batchStats]] = await pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(yield_liquid_lbs), 0) as total_yield_lbs FROM egg_production_batches WHERE ${batchWhere}`,
            batchParams
        );

        const [[pkgStats]] = await pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total_batch_weight_lbs), 0) as total_pkg_lbs, COALESCE(SUM(units_packaged), 0) as total_units FROM egg_packaging_records WHERE ${pkgWhere}`,
            pkgParams
        );

        const [[alertPast]] = await pool.query(
            `SELECT COUNT(*) as count FROM egg_pasteurization_logs WHERE ${pastWhere}`,
            pastParams
        );

        const [[alertLab]] = await pool.query(
            `SELECT COUNT(*) as count FROM egg_lab_micro_logs WHERE ${labAlertWhere}`,
            labAlertParams
        );

        const [[approvedLab]] = await pool.query(
            `SELECT COUNT(*) as count FROM egg_lab_micro_logs WHERE ${labApprovedWhere}`,
            labApprovedParams
        );

        res.json({
            raw_materials: {
                count: rmStats?.count || 0,
                total_lbs: parseFloat(rmStats?.total_lbs || 0)
            },
            production: {
                batches_count: batchStats?.count || 0,
                liquid_yield_lbs: parseFloat(batchStats?.total_yield_lbs || 0)
            },
            packaging: {
                records_count: pkgStats?.count || 0,
                total_pkg_lbs: parseFloat(pkgStats?.total_pkg_lbs || 0),
                total_units: parseInt(pkgStats?.total_units || 0, 10)
            },
            alerts: {
                total_alerts: (alertPast?.count || 0) + (alertLab?.count || 0),
                pasteurization_alerts: alertPast?.count || 0,
                lab_alerts: alertLab?.count || 0
            },
            quality_approved_count: approvedLab?.count || 0
        });
    } catch (error) {
        console.error('Error in getTraceability360Stats:', error);
        res.status(500).json({ message: error.message });
    }
};

// 11.3 DETALLE 360° PARA EL INSPECTOR / LUPA
const getTraceability360Detail = async (req, res) => {
    try {
        const { type, id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        let rawMaterial = null;
        let batch = null;
        let batchId = null;

        if (type === 'raw') {
            const [rms] = await pool.query(
                `SELECT rm.*, p.nombre as provider_name, p.nit as provider_nit, p.telefono as provider_phone 
                 FROM egg_raw_materials rm 
                 LEFT JOIN providers p ON rm.provider_id = p.id 
                 WHERE rm.id = ? AND rm.company_id = ?`,
                [id, company_id]
            );
            if (rms.length > 0) {
                rawMaterial = rms[0];
                if (rawMaterial.tarimas_json && typeof rawMaterial.tarimas_json === 'string') {
                    try { rawMaterial.tarimas = JSON.parse(rawMaterial.tarimas_json); } catch { rawMaterial.tarimas = []; }
                } else {
                    rawMaterial.tarimas = rawMaterial.tarimas_json || [];
                }

                // Buscar lote asociado
                const [brms] = await pool.query(
                    `SELECT b.* FROM batch_raw_materials brm 
                     JOIN egg_production_batches b ON b.id = brm.batch_id 
                     WHERE brm.raw_material_id = ? AND b.company_id = ? LIMIT 1`,
                    [id, company_id]
                );
                if (brms.length > 0) {
                    batch = brms[0];
                    batchId = batch.id;
                } else {
                    const [dirBatches] = await pool.query(
                        `SELECT * FROM egg_production_batches WHERE raw_material_id = ? AND company_id = ? LIMIT 1`,
                        [id, company_id]
                    );
                    if (dirBatches.length > 0) {
                        batch = dirBatches[0];
                        batchId = batch.id;
                    }
                }
            }
        } else if (type === 'batch') {
            const [bRows] = await pool.query('SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?', [id, company_id]);
            if (bRows.length > 0) {
                batch = bRows[0];
                batchId = batch.id;

                // Buscar materias primas
                const [rms] = await pool.query(
                    `SELECT rm.*, p.nombre as provider_name 
                     FROM batch_raw_materials brm 
                     JOIN egg_raw_materials rm ON rm.id = brm.raw_material_id 
                     LEFT JOIN providers p ON rm.provider_id = p.id 
                     WHERE brm.batch_id = ? AND rm.company_id = ? LIMIT 1`,
                    [batchId, company_id]
                );
                if (rms.length > 0) {
                    rawMaterial = rms[0];
                }
            }
        } else if (type === 'pkg') {
            const [pkgRows] = await pool.query('SELECT * FROM egg_packaging_records WHERE id = ? AND company_id = ?', [id, company_id]);
            if (pkgRows.length > 0) {
                batchId = pkgRows[0].batch_id;
                const [bRows] = await pool.query('SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?', [batchId, company_id]);
                if (bRows.length > 0) batch = bRows[0];

                const [rms] = await pool.query(
                    `SELECT rm.*, p.nombre as provider_name 
                     FROM batch_raw_materials brm 
                     JOIN egg_raw_materials rm ON rm.id = brm.raw_material_id 
                     LEFT JOIN providers p ON rm.provider_id = p.id 
                     WHERE brm.batch_id = ? AND rm.company_id = ? LIMIT 1`,
                    [batchId, company_id]
                );
                if (rms.length > 0) rawMaterial = rms[0];
            }
        }

        if (!rawMaterial && !batch) {
            return res.status(404).json({ message: 'No se encontró el registro de trazabilidad solicitado.' });
        }

        // Cargar bitácora CIP
        let cipLogs = [];
        if (batch?.started_at) {
            const [cips] = await pool.query(
                `SELECT * FROM egg_cip_logs WHERE company_id = ? AND created_at <= ? ORDER BY created_at DESC LIMIT 2`,
                [company_id, batch.started_at]
            );
            cipLogs = cips;
        }

        // Cargar pasteurización
        let pasteurizations = [];
        if (batchId) {
            const [pasts] = await pool.query(
                'SELECT * FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ? ORDER BY created_at DESC',
                [batchId, company_id]
            );
            pasteurizations = pasts;
        }

        // Cargar empaques con detección de venta/despacho a clientes
        let packaging = [];
        if (batchId) {
            const [pkgs] = await pool.query(`
                SELECT pk.*,
                    (SELECT GROUP_CONCAT(DISTINCT COALESCE(sh.cliente_nombre, c.nombre, 'Consumidor Final') SEPARATOR ', ') 
                     FROM sales_items si 
                     JOIN sales_headers sh ON sh.id = si.sale_id 
                     LEFT JOIN customers c ON c.id = sh.customer_id
                     WHERE pk.lot_code IS NOT NULL 
                       AND (si.codigo = pk.lot_code OR si.descripcion LIKE CONCAT('%', pk.lot_code, '%')) 
                       AND sh.estado != 'anulado'
                    ) as sale_customer_name
                FROM egg_packaging_records pk 
                WHERE pk.batch_id = ? AND pk.company_id = ? 
                ORDER BY pk.id DESC
            `, [batchId, company_id]);
            packaging = pkgs;
        }

        // Cargar Blast Freezer
        let blastFreezer = [];
        if (packaging.length > 0) {
            const [bfs] = await pool.query(
                'SELECT * FROM egg_blast_freezer_logs WHERE packaging_id IN (?) AND company_id = ?',
                [packaging.map(p => p.id), company_id]
            );
            blastFreezer = bfs;
        }

        // Cargar Calidad LAB-004
        let qualityLab = null;
        if (batchId) {
            const [labs] = await pool.query(
                `SELECT l.*, c.nombre as customer_nombre_db 
                 FROM egg_lab_micro_logs l 
                 LEFT JOIN customers c ON l.customer_id = c.id 
                 WHERE l.batch_id = ? AND l.company_id = ? 
                 ORDER BY l.id DESC LIMIT 1`,
                [batchId, company_id]
            );
            if (labs.length > 0) {
                qualityLab = labs[0];
                if (qualityLab.custom_parameters && typeof qualityLab.custom_parameters === 'string') {
                    try { qualityLab.custom_parameters = JSON.parse(qualityLab.custom_parameters); } catch {}
                }
            }
        }

        // Cargar Auditoría / Eventos
        let auditTrail = [];
        if (batch?.batch_uuid) {
            const [evts] = await pool.query(
                `SELECT * FROM egg_industrial_events 
                 WHERE company_id = ? AND (description LIKE ? OR payload->'$.batch_uuid' = ? OR payload->'$.batch_id' = ?)
                 ORDER BY created_at ASC`,
                [company_id, `%${batch.batch_uuid}%`, batch.batch_uuid, batchId]
            );
            auditTrail = evts;
        }

        res.json({
            rawMaterial,
            batch,
            cipLogs,
            pasteurizations,
            packaging: packaging.length > 0 ? packaging[0] : null,
            allPackagings: packaging,
            blastFreezer: blastFreezer.length > 0 ? blastFreezer[0] : null,
            qualityLab,
            auditTrail
        });

    } catch (error) {
        console.error('Error in getTraceability360Detail:', error);
        res.status(500).json({ message: error.message });
    }
};

// 11.4 LOTES DISPONIBLES PARA EL PUNTO DE VENTA (Atajo Alt + Shift + L)
const getAvailableSalesLots = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { search, all_lots } = req.query;

        const [rows] = await pool.query(`
            SELECT 
                pk.id as packaging_id,
                pk.lot_code,
                pk.barcode,
                pk.product_type,
                pk.presentation,
                pk.units_packaged,
                pk.weight_per_unit_lbs,
                pk.total_batch_weight_lbs,
                pk.warehouse_zone,
                pk.product_state,
                pk.expiry_date,
                pk.customer_destination,
                b.id as batch_id,
                b.batch_uuid,
                b.batch_code_display,
                b.status as batch_status,
                lab.status as quality_status,
                lab.sample_date as quality_date,
                lab.mesophilic_aerobic_cfu,
                lab.salmonella_25g
            FROM egg_packaging_records pk
            JOIN egg_production_batches b ON pk.batch_id = b.id
            LEFT JOIN egg_lab_micro_logs lab ON lab.batch_id = b.id
            WHERE pk.company_id = ?
            ORDER BY pk.id DESC
        `, [company_id]);

        const lots = rows.map(r => {
            const hasStock = (parseInt(r.units_packaged, 10) || 0) > 0;
            const isExpired = r.expiry_date ? new Date(r.expiry_date) < new Date() : false;
            const isQualityApproved = r.quality_status === 'aprobado' || r.batch_status === 'aprobado_calidad' || !r.quality_status;

            return {
                packaging_id: r.packaging_id,
                batch_id: r.batch_id,
                lot_code: r.lot_code,
                barcode: r.barcode,
                product_type: r.product_type || 'Huevo Entero Pasteurizado',
                presentation: r.presentation || 'Cubeta 30 Lb',
                units_in_stock: parseInt(r.units_packaged, 10) || 0,
                weight_per_unit_lbs: parseFloat(r.weight_per_unit_lbs || 30),
                total_weight_lbs: parseFloat(r.total_batch_weight_lbs || 0),
                warehouse_zone: r.warehouse_zone || 'COOLER',
                product_state: r.product_state || 'liquido',
                expiry_date: r.expiry_date,
                has_stock: hasStock,
                is_expired: isExpired,
                quality_status: isQualityApproved ? 'aprobado' : (r.quality_status || 'observado'),
                customer_destination: r.customer_destination
            };
        });

        let filtered = lots;
        if (all_lots !== 'true') {
            filtered = filtered.filter(l => l.has_stock);
        }

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(l => 
                (l.lot_code && l.lot_code.toLowerCase().includes(q)) ||
                (l.product_type && l.product_type.toLowerCase().includes(q)) ||
                (l.presentation && l.presentation.toLowerCase().includes(q)) ||
                (l.barcode && l.barcode.includes(q))
            );
        }

        res.json(filtered);
    } catch (error) {
        console.error('Error in getAvailableSalesLots:', error);
        res.status(500).json({ message: error.message });
    }
};

// 11.5 EXPORTACIÓN MULTIFORMATO DE CARTA DE CALIDAD (PDF, Word, Excel)
const exportQualityLetter = async (req, res) => {
    try {
        const { batchId } = req.params;
        const company_id = req.company_id || req.user?.company_id;
        const { format = 'pdf', customer_name, customer_contact, use_existing_customer } = req.query;

        const letterData = await eggQualityLetterExport.getQualityLetterData(batchId, company_id, {
            customer_name,
            customer_contact,
            use_existing_customer: use_existing_customer === 'true'
        });

        if (!letterData) {
            return res.status(404).json({ message: 'Lote de producción no encontrado para generar carta de calidad.' });
        }

        const safeCode = (letterData.lotCode || `LOTE-${batchId}`).replace(/[^a-zA-Z0-9_-]/g, '_');

        if (format === 'word') {
            const buffer = await eggQualityLetterExport.generateQualityLetterWord(letterData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="Carta_Calidad_${safeCode}.docx"`);
            return res.send(buffer);
        }

        if (format === 'excel') {
            const buffer = await eggQualityLetterExport.generateQualityLetterExcel(letterData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Carta_Calidad_${safeCode}.xlsx"`);
            return res.send(buffer);
        }

        // Por defecto PDF estilo cotización con membrete Eggcelent/ANDELSA
        const pdfBuffer = await eggQualityLetterExport.generateQualityLetterPdf(letterData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Carta_Calidad_${safeCode}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportQualityLetter:', error);
        res.status(500).json({ message: error.message });
    }
};

// 12. AUDIT TRAIL / EVENTS LIST

module.exports = {
    getTraceability,
    getTraceability360List,
    getTraceability360Stats,
    getTraceability360Detail,
    getAvailableSalesLots,
    exportQualityLetter
};
