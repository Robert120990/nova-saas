const { pool } = require('./shared');

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
                (pk.units_packaged - pk.dispatched_units) AS units_packaged,
                pk.weight_per_unit_lbs,
                (pk.total_batch_weight_lbs - pk.dispatched_weight_lbs) AS total_batch_weight_lbs,
                pk.warehouse_zone,
                pk.product_state,
                pk.quality_status as pkg_quality_status,
                pk.expiry_date, (pk.expiry_date >= CURDATE()) AS date_valid,
                pk.customer_destination,
                b.id as batch_id,
                b.batch_uuid,
                b.batch_code_display,
                b.status as batch_status,
                lab.status as quality_status,
                lab.release_status as lab_release_status,
                lab.sample_date as quality_date,
                lab.mesophilic_aerobic_cfu,
                lab.salmonella_25g
            FROM egg_packaging_records pk
            JOIN egg_production_batches b ON pk.batch_id = b.id
            LEFT JOIN egg_lab_micro_logs lab ON lab.id = (SELECT MAX(l.id) FROM egg_lab_micro_logs l WHERE l.batch_id = b.id AND l.company_id = pk.company_id)
            WHERE pk.company_id = ?
            ORDER BY pk.id DESC
        `, [company_id]);

        const lots = rows.map(r => {
            const hasStock = (parseInt(r.units_packaged, 10) || 0) > 0;
            const isExpired = !r.date_valid;
            const releaseStatus = r.pkg_quality_status || r.lab_release_status || (r.batch_status === 'aprobado_calidad' ? 'liberado' : (r.batch_status === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'cuarentena'));
            const isQualityApproved = r.pkg_quality_status === 'liberado' && r.batch_status !== 'bloqueado_haccp';

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
                quality_status: isQualityApproved ? 'aprobado' : (releaseStatus === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'cuarentena'),
                release_status: releaseStatus,
                is_quality_approved: isQualityApproved,
                customer_destination: r.customer_destination
            };
        });

        let filtered = lots;
        if (all_lots !== 'true') {
            filtered = filtered.filter(l => l.has_stock && l.is_quality_approved && !l.is_expired);
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
module.exports = { getTraceability360Detail, getAvailableSalesLots };
