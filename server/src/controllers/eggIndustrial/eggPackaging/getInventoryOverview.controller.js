const { pool, ensureEggSchema } = require('./shared');

/**
 * Obtiene el inventario integral de Huevo Industrial:
 * 1. Existencias de Materia Prima (lotes, cajas, lbs, kg, tarimas)
 * 2. Producto Terminado por sus Presentaciones (unidades, lbs, kg, lotes envasados)
 * 3. Mermas y Pérdidas del Proceso (cáscara en quebraje, pérdidas de pasteurización y tuberías/envasado)
 */
const getInventoryOverview = async (req, res) => {
    try {
        await ensureEggSchema();
        const company_id = req.company_id;

        // 1. MATERIA PRIMA
        const [rawMaterials] = await pool.query(`
            SELECT 
                rm.id,
                rm.provider_lot,
                rm.remission_note,
                rm.farm_name,
                rm.egg_type,
                rm.egg_color,
                rm.egg_size,
                rm.egg_classification,
                rm.total_boxes,
                rm.initial_boxes,
                rm.weight_lbs,
                rm.stock_lbs,
                rm.storage_location,
                rm.temperature_c,
                rm.status,
                rm.quality_status,
                rm.tarimas_json,
                rm.production_date,
                rm.expiration_date,
                COALESCE(rm.fecha, rm.created_at) as reception_date,
                COALESCE(p.nombre, p.nombre_comercial, 'Proveedor General') as provider_name
            FROM egg_raw_materials rm
            LEFT JOIN providers p ON rm.provider_id = p.id
            WHERE rm.company_id = ?
            ORDER BY rm.stock_lbs > 0 DESC, rm.id DESC
        `, [company_id]);

        let totalRmBoxes = 0;
        let totalRmStockLbs = 0;
        let totalRmTarimas = 0;
        let activeRmLotsCount = 0;

        const formattedRm = rawMaterials.map(rm => {
            let tarimas = [];
            if (rm.tarimas_json) {
                try {
                    tarimas = typeof rm.tarimas_json === 'string' ? JSON.parse(rm.tarimas_json) : rm.tarimas_json;
                } catch (e) {
                    tarimas = [];
                }
            }
            const stockLbs = parseFloat(rm.stock_lbs || 0);
            const boxes = parseInt(rm.total_boxes || 0, 10);
            if (stockLbs > 0) {
                activeRmLotsCount += 1;
                totalRmBoxes += boxes;
                totalRmStockLbs += stockLbs;
                if (Array.isArray(tarimas)) {
                    totalRmTarimas += tarimas.length;
                }
            }
            return {
                id: rm.id,
                provider_lot: rm.provider_lot,
                remission_note: rm.remission_note,
                farm_name: rm.farm_name,
                provider_name: rm.provider_name,
                egg_type: rm.egg_type,
                egg_color: rm.egg_color,
                egg_size: rm.egg_size,
                egg_classification: rm.egg_classification,
                total_boxes: boxes,
                initial_boxes: parseInt(rm.initial_boxes || 0, 10),
                weight_lbs: parseFloat(rm.weight_lbs || 0),
                stock_lbs: stockLbs,
                stock_kg: Math.round(stockLbs * 0.453592 * 100) / 100,
                storage_location: rm.storage_location || 'Bodega Principal',
                temperature_c: rm.temperature_c,
                status: rm.status,
                quality_status: rm.quality_status || 'pendiente',
                reception_date: rm.reception_date,
                production_date: rm.production_date,
                expiration_date: rm.expiration_date,
                tarimas_count: Array.isArray(tarimas) ? tarimas.length : 0,
                tarimas: Array.isArray(tarimas) ? tarimas : []
            };
        });

        const rawMaterialsData = {
            summary: {
                total_lots: rawMaterials.length,
                active_lots: activeRmLotsCount,
                total_boxes: totalRmBoxes,
                total_stock_lbs: Math.round(totalRmStockLbs * 100) / 100,
                total_stock_kg: Math.round(totalRmStockLbs * 0.453592 * 100) / 100,
                total_tarimas: totalRmTarimas
            },
            lots: formattedRm
        };

        // 2. PRODUCTO TERMINADO (x PRESENTACIÓN)
        const [packagingRows] = await pool.query(`
            SELECT 
                pk.id,
                pk.batch_id,
                pk.product_type,
                pk.presentation,
                pk.product_id,
                pk.units_packaged,
                COALESCE(pk.dispatched_units, 0) as dispatched_units,
                (pk.units_packaged - COALESCE(pk.dispatched_units, 0)) as available_units,
                pk.weight_per_unit_lbs,
                pk.total_batch_weight_lbs,
                pk.warehouse_zone,
                pk.product_state,
                pk.quality_status,
                pk.lot_code,
                pk.barcode,
                pk.expiry_date,
                pk.created_at,
                b.batch_code_display,
                b.batch_uuid
            FROM egg_packaging_records pk
            JOIN egg_production_batches b ON pk.batch_id = b.id
            WHERE pk.company_id = ?
            ORDER BY pk.id DESC
        `, [company_id]);

        const byPresentationMap = {};
        let totalFinishedUnits = 0;
        let totalFinishedLbs = 0;
        let activeFinishedLotsCount = 0;

        const lotsDetail = packagingRows.map(row => {
            const availUnits = Math.max(0, parseInt(row.available_units || 0, 10));
            const unitWeightLbs = parseFloat(row.weight_per_unit_lbs || 1);
            const stockLbs = availUnits * unitWeightLbs;
            const stockKg = Math.round(stockLbs * 0.453592 * 100) / 100;

            if (availUnits > 0) {
                activeFinishedLotsCount += 1;
                totalFinishedUnits += availUnits;
                totalFinishedLbs += stockLbs;
            }

            const pType = row.product_type || 'General';
            const pres = row.presentation || 'Estándar';
            const key = `${pType.toLowerCase().trim()}|${pres.toLowerCase().trim()}`;

            if (!byPresentationMap[key]) {
                byPresentationMap[key] = {
                    id: key,
                    product_type: pType,
                    presentation: pres,
                    unit_weight_lbs: unitWeightLbs,
                    unit_weight_kg: Math.round(unitWeightLbs * 0.453592 * 100) / 100,
                    total_packaged_units: 0,
                    total_dispatched_units: 0,
                    available_units: 0,
                    total_stock_lbs: 0,
                    total_stock_kg: 0,
                    active_lots_count: 0,
                    lots: []
                };
            }

            byPresentationMap[key].total_packaged_units += parseInt(row.units_packaged || 0, 10);
            byPresentationMap[key].total_dispatched_units += parseInt(row.dispatched_units || 0, 10);
            byPresentationMap[key].available_units += availUnits;
            byPresentationMap[key].total_stock_lbs += stockLbs;
            byPresentationMap[key].total_stock_kg += stockKg;
            if (availUnits > 0) {
                byPresentationMap[key].active_lots_count += 1;
            }

            const lotItem = {
                id: row.id,
                batch_id: row.batch_id,
                batch_code_display: row.batch_code_display,
                lot_code: row.lot_code,
                barcode: row.barcode,
                product_type: pType,
                presentation: pres,
                warehouse_zone: row.warehouse_zone || 'COOLER',
                product_state: row.product_state || 'liquido',
                quality_status: row.quality_status || 'cuarentena',
                units_packaged: parseInt(row.units_packaged || 0, 10),
                dispatched_units: parseInt(row.dispatched_units || 0, 10),
                available_units: availUnits,
                weight_per_unit_lbs: unitWeightLbs,
                weight_per_unit_kg: Math.round(unitWeightLbs * 0.453592 * 100) / 100,
                stock_lbs: Math.round(stockLbs * 100) / 100,
                stock_kg: stockKg,
                expiry_date: row.expiry_date,
                created_at: row.created_at
            };

            byPresentationMap[key].lots.push(lotItem);
            return lotItem;
        });

        const byPresentationList = Object.values(byPresentationMap).map(p => ({
            ...p,
            total_stock_lbs: Math.round(p.total_stock_lbs * 100) / 100,
            total_stock_kg: Math.round(p.total_stock_kg * 100) / 100
        }));

        const finishedProductsData = {
            summary: {
                total_presentations: byPresentationList.length,
                total_units: totalFinishedUnits,
                total_stock_lbs: Math.round(totalFinishedLbs * 100) / 100,
                total_stock_kg: Math.round(totalFinishedLbs * 0.453592 * 100) / 100,
                active_lots_count: activeFinishedLotsCount
            },
            by_presentation: byPresentationList,
            lots: lotsDetail
        };

        // 3. MERMAS Y PÉRDIDAS DEL PROCESO
        const [wasteLogs] = await pool.query(`
            SELECT 
                w.id,
                w.batch_id,
                w.stage,
                w.waste_type,
                w.quantity_lbs,
                w.reason,
                w.operator_name,
                w.created_at,
                b.batch_code_display,
                b.product_type as batch_product_type,
                b.input_weight_lbs as batch_input_lbs
            FROM egg_batch_waste_logs w
            JOIN egg_production_batches b ON w.batch_id = b.id
            WHERE w.company_id = ?
            ORDER BY w.created_at DESC, w.id DESC
        `, [company_id]);

        const [batchWastes] = await pool.query(`
            SELECT 
                b.id,
                b.batch_code_display,
                b.product_type,
                b.presentation,
                b.input_weight_lbs,
                b.yield_liquid_lbs,
                b.waste_shell_lbs,
                b.waste_loss_lbs,
                b.packaging_loss_lbs,
                b.started_at,
                b.completed_at
            FROM egg_production_batches b
            WHERE b.company_id = ? 
              AND (b.waste_shell_lbs > 0 OR b.waste_loss_lbs > 0 OR b.packaging_loss_lbs > 0)
            ORDER BY b.id DESC
            LIMIT 50
        `, [company_id]);

        let totalWasteLbs = 0;
        let shellWasteLbs = 0;
        let processWasteLbs = 0;
        let packagingWasteLbs = 0;
        let otherWasteLbs = 0;
        const byStageMap = {};

        const formattedLogs = wasteLogs.map(w => {
            const qty = parseFloat(w.quantity_lbs || 0);
            totalWasteLbs += qty;
            const stage = (w.stage || 'otro').toLowerCase();
            byStageMap[stage] = (byStageMap[stage] || 0) + qty;

            if (stage === 'quebraje' || (w.waste_type || '').toLowerCase().includes('cascaron')) {
                shellWasteLbs += qty;
            } else if (stage === 'pasteurizacion') {
                processWasteLbs += qty;
            } else if (stage === 'envasado' || stage === 'tuberias') {
                packagingWasteLbs += qty;
            } else {
                otherWasteLbs += qty;
            }

            return {
                id: w.id,
                batch_id: w.batch_id,
                batch_code_display: w.batch_code_display,
                batch_product_type: w.batch_product_type,
                batch_input_lbs: parseFloat(w.batch_input_lbs || 0),
                stage: w.stage,
                waste_type: w.waste_type,
                quantity_lbs: Math.round(qty * 100) / 100,
                quantity_kg: Math.round(qty * 0.453592 * 100) / 100,
                reason: w.reason || 'Sin justificación registrada',
                operator_name: w.operator_name || 'Operador de Planta',
                created_at: w.created_at
            };
        });

        const byStageList = Object.entries(byStageMap).map(([stage, lbs]) => ({
            stage,
            total_lbs: Math.round(lbs * 100) / 100,
            total_kg: Math.round(lbs * 0.453592 * 100) / 100,
            percentage: totalWasteLbs > 0 ? Math.round((lbs / totalWasteLbs) * 1000) / 10 : 0
        }));

        const wastesData = {
            summary: {
                total_waste_lbs: Math.round(totalWasteLbs * 100) / 100,
                total_waste_kg: Math.round(totalWasteLbs * 0.453592 * 100) / 100,
                shell_waste_lbs: Math.round(shellWasteLbs * 100) / 100,
                process_waste_lbs: Math.round(processWasteLbs * 100) / 100,
                packaging_waste_lbs: Math.round(packagingWasteLbs * 100) / 100,
                other_waste_lbs: Math.round(otherWasteLbs * 100) / 100,
                total_logs_count: wasteLogs.length
            },
            by_stage: byStageList,
            logs: formattedLogs,
            batch_wastes: batchWastes.map(b => {
                const inputLbs = parseFloat(b.input_weight_lbs || 0);
                const shellLbs = parseFloat(b.waste_shell_lbs || 0);
                const lossLbs = parseFloat(b.waste_loss_lbs || 0);
                const pkgLossLbs = parseFloat(b.packaging_loss_lbs || 0);
                const totalBatchWaste = shellLbs + lossLbs + pkgLossLbs;
                return {
                    id: b.id,
                    batch_code_display: b.batch_code_display,
                    product_type: b.product_type,
                    presentation: b.presentation,
                    input_weight_lbs: inputLbs,
                    yield_liquid_lbs: parseFloat(b.yield_liquid_lbs || 0),
                    waste_shell_lbs: shellLbs,
                    waste_loss_lbs: lossLbs,
                    packaging_loss_lbs: pkgLossLbs,
                    total_waste_lbs: Math.round(totalBatchWaste * 100) / 100,
                    waste_pct: inputLbs > 0 ? Math.round((totalBatchWaste / inputLbs) * 1000) / 10 : 0,
                    started_at: b.started_at,
                    completed_at: b.completed_at
                };
            })
        };

        return res.json({
            raw_materials: rawMaterialsData,
            finished_products: finishedProductsData,
            wastes: wastesData
        });
    } catch (error) {
        console.error('Error in getInventoryOverview:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener inventario general' });
    }
};

module.exports = { getInventoryOverview };
