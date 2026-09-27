const { pool } = require('../../../controllers/eggIndustrial/eggTraceability/shared');

const getTraceability360List = async (req) => {
    const responseHeaders = {};
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
                lab.fungi_yeasts_cfu,
                lab.staph_aureus,
                lab.solids_percentage,
                lab.ph,
                lab.temperature_c as lab_temperature_c,
                lab.salinity_pct as lab_salinity_pct,
                lab.density as lab_density,
                lab.fq_status as lab_fq_status,
                lab.mb_status as lab_mb_status,
                lab.release_status as lab_release_status,
                lab.incubation_started_at as lab_incubation_started_at,
                lab.incubation_hours as lab_incubation_hours,
                lab.released_at as lab_released_at,
                lab.released_by as lab_released_by,
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
                lab.fungi_yeasts_cfu,
                lab.staph_aureus,
                lab.solids_percentage,
                lab.ph,
                lab.temperature_c as lab_temperature_c,
                lab.salinity_pct as lab_salinity_pct,
                lab.density as lab_density,
                lab.fq_status as lab_fq_status,
                lab.mb_status as lab_mb_status,
                lab.release_status as lab_release_status,
                lab.incubation_started_at as lab_incubation_started_at,
                lab.incubation_hours as lab_incubation_hours,
                lab.released_at as lab_released_at,
                lab.released_by as lab_released_by,
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

                // Calidad & Alertas Oficiales (Mario / LAB-004)
                lab_log_id: r.lab_log_id,
                lab_sample_date: r.lab_sample_date,
                lab_status: r.lab_status || (r.batch_status === 'aprobado_calidad' ? 'aprobado' : (isTransformed ? 'cuarentena' : 'en_espera')),
                lab_release_status: r.lab_release_status || (r.lab_status === 'aprobado' || r.batch_status === 'aprobado_calidad' ? 'liberado' : 'cuarentena'),
                lab_mb_status: r.lab_mb_status || (r.lab_status === 'aprobado' ? 'aprobado' : 'en_incubacion'),
                lab_fq_status: r.lab_fq_status || 'aprobado',
                lab_temperature_c: r.lab_temperature_c !== null ? parseFloat(r.lab_temperature_c) : null,
                lab_salinity_pct: r.lab_salinity_pct !== null ? parseFloat(r.lab_salinity_pct) : null,
                lab_density: r.lab_density !== null ? parseFloat(r.lab_density) : null,
                lab_staph_aureus: r.lab_staph_aureus || 'negativo',
                fungi_yeasts_cfu: r.fungi_yeasts_cfu,
                lab_incubation_started_at: r.lab_incubation_started_at,
                lab_incubation_hours: r.lab_incubation_hours,
                lab_released_at: r.lab_released_at,
                lab_released_by: r.lab_released_by,
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

        return ({ status: 200, body: {
            data: paginatedData,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum) || 1
        }, headers: responseHeaders });
    } catch (error) {
        console.error('Error in getTraceability360List:', error);
        return ({ status: 500, body: { message: error.message }, headers: responseHeaders });
    }
};
module.exports = getTraceability360List;
