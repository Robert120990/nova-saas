const { pool, excelService, eggReturnableService } = require('./shared');

const registerReturnableMovement = async (req, res) => {
    try {
        const {
            returnable_id,
            movement_type,
            quantity,
            cubetas_qty,
            cubetas_30lb_qty,
            cubetas_32lb_qty,
            tapaderas_qty,
            movement_date,
            reference_document,
            notes,
            registered_by
        } = req.body;

        const c30 = parseInt(cubetas_30lb_qty, 10) || 0;
        const c32 = parseInt(cubetas_32lb_qty, 10) || 0;
        let cQty = parseInt(cubetas_qty !== undefined ? cubetas_qty : quantity, 10) || 0;
        if (cQty === 0 && (c30 > 0 || c32 > 0)) {
            cQty = c30 + c32;
        }
        const tQty = parseInt(tapaderas_qty !== undefined ? tapaderas_qty : (cubetas_qty !== undefined ? cubetas_qty : quantity), 10) || 0;

        if (cQty <= 0 && tQty <= 0) {
            return res.status(400).json({ message: 'Debe ingresar una cantidad válida de cubetas o tapaderas (mayor a cero).' });
        }

        const [existing] = await pool.query(
            'SELECT * FROM egg_returnable_packaging WHERE id = ? AND company_id = ?',
            [returnable_id, req.company_id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Registro de retornable no encontrado.' });
        }

        const movDate = movement_date ? new Date(movement_date) : new Date();
        const mainQty = Math.max(cQty, tQty);

        // Registrar movimiento
        await pool.query(
            `INSERT INTO egg_returnable_movements
             (company_id, returnable_id, movement_type, quantity, cubetas_qty, cubetas_30lb_qty, cubetas_32lb_qty, tapaderas_qty, movement_date, reference_document, notes, registered_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.company_id,
                returnable_id,
                movement_type || 'devolucion',
                mainQty,
                cQty,
                c30,
                c32,
                tQty,
                movDate,
                reference_document || null,
                notes || null,
                registered_by || req.user?.nombre || 'Bodeguero'
            ]
        );

        // Actualizar saldos en egg_returnable_packaging
        if (movement_type === 'entrega') {
            await pool.query(
                `UPDATE egg_returnable_packaging
                 SET delivered_qty = delivered_qty + ?,
                     delivered_tapaderas = delivered_tapaderas + ?,
                     last_movement_date = ?
                 WHERE id = ? AND company_id = ?`,
                [cQty, tQty, movDate, returnable_id, req.company_id]
            );
        } else if (movement_type === 'devolucion') {
            await pool.query(
                `UPDATE egg_returnable_packaging
                 SET returned_qty = returned_qty + ?,
                     returned_tapaderas = returned_tapaderas + ?,
                     last_movement_date = ?
                 WHERE id = ? AND company_id = ?`,
                [cQty, tQty, movDate, returnable_id, req.company_id]
            );
        } else if (movement_type === 'ajuste') {
            await pool.query(
                `UPDATE egg_returnable_packaging
                 SET delivered_qty = delivered_qty + ?,
                     delivered_tapaderas = delivered_tapaderas + ?,
                     last_movement_date = ?
                 WHERE id = ? AND company_id = ?`,
                [cQty, tQty, movDate, returnable_id, req.company_id]
            );
        }

        res.status(201).json({ message: 'Movimiento registrado correctamente.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getReturnableCustomerStatement = async (req, res) => {
    try {
        const { id } = req.params;
        const statement = await eggReturnableService.getCustomerStatement(req.company_id, id);
        if (!statement) {
            return res.status(404).json({ message: 'Cliente o balance no encontrado.' });
        }
        res.json(statement);
    } catch (error) {
        console.error('Error fetching customer statement:', error);
        res.status(500).json({ message: error.message });
    }
};

const syncReturnablesFromSales = async (req, res) => {
    try {
        const result = await eggReturnableService.syncHistoricalSales(req.company_id);
        res.json({
            message: `Sincronización completada: ${result.syncedCount} ventas procesadas (${result.syncedCubetas} cubetas y tapaderas vinculadas).`,
            ...result
        });
    } catch (error) {
        console.error('Error syncing returnables from sales:', error);
        res.status(500).json({ message: error.message });
    }
};

const exportMarioQualityExcel = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { year = new Date().getFullYear() } = req.query;

        // Consultar todos los registros de calidad del año
        const [rows] = await pool.query(`
            SELECT l.*, b.batch_code_display, b.product_type, b.started_at,
                   (SELECT lot_code FROM egg_packaging_records WHERE batch_id = b.id ORDER BY id DESC LIMIT 1) as pkg_lot_code
            FROM egg_lab_micro_logs l
            JOIN egg_production_batches b ON l.batch_id = b.id
            WHERE l.company_id = ? AND YEAR(l.sample_date) = ?
            ORDER BY l.sample_date ASC, l.id ASC
        `, [company_id, year]);

        // Hoja 1: ANALISIS FQ
        const fqData = rows.map((r, idx) => ({
            num: idx + 1,
            fecha: r.sample_date ? new Date(r.sample_date).toLocaleDateString('es-SV') : '',
            producto: r.product_type || 'Huevo Entero',
            lote: r.commercial_lot_code || r.pkg_lot_code || r.batch_code_display || `LOTE-${r.batch_id}`,
            ph: r.ph !== null ? Number(r.ph).toFixed(2) : '',
            sol: r.solids_percentage !== null ? Number(r.solids_percentage).toFixed(1) : '',
            temp: r.temperature_c !== null ? Number(r.temperature_c).toFixed(1) : '',
            sal: r.salinity_pct !== null ? Number(r.salinity_pct).toFixed(2) : '',
            densidad: r.density !== null ? Number(r.density).toFixed(3) : '',
            observaciones: r.observations || ''
        }));

        // Hoja 2: ANALISIS MB
        const mbData = rows.map(r => ({
            fecha: r.sample_date ? new Date(r.sample_date).toLocaleDateString('es-SV') : '',
            producto: r.product_type || 'Huevo Entero',
            lote: r.commercial_lot_code || r.pkg_lot_code || r.batch_code_display || `LOTE-${r.batch_id}`,
            recuento_total: r.mesophilic_aerobic_cfu !== null ? r.mesophilic_aerobic_cfu : '< 10',
            coliformes_totales: r.total_coliforms_mpn !== null ? r.total_coliforms_mpn : '< 10',
            e_coli: r.e_coli_mpn ? 'Positivo' : 'Negativo',
            salmonella: (r.salmonella_25g || 'ausencia').toLowerCase().includes('presencia') ? 'Presencia' : 'Negativo',
            hongos_levaduras: r.fungi_yeasts_cfu !== null ? r.fungi_yeasts_cfu : '< 10',
            staph_aureus: (r.staph_aureus || 'negativo').toLowerCase().includes('positi') ? 'Positivo' : 'Negativo',
            dictamen: r.release_status === 'liberado' ? 'LIBERADO' : r.release_status === 'bloqueado_haccp' ? 'RECHAZADO HACCP' : 'CUARENTENA'
        }));

        const buffer = await excelService.createExcelBuffer({
            title: `Control_Calidad_Mario_${year}`,
            sheets: [
                {
                    name: 'ANALISIS FQ',
                    columns: [
                        { header: '#', key: 'num', width: 6 },
                        { header: 'FECHA', key: 'fecha', width: 14 },
                        { header: 'PRODUCTO', key: 'producto', width: 28 },
                        { header: 'LOTE', key: 'lote', width: 20 },
                        { header: 'PH', key: 'ph', width: 10 },
                        { header: 'SOL (%)', key: 'sol', width: 12 },
                        { header: 'TEMP. (°C)', key: 'temp', width: 12 },
                        { header: 'SAL %', key: 'sal', width: 10 },
                        { header: 'DENSIDAD', key: 'densidad', width: 12 },
                        { header: 'OBSERVACIONES', key: 'observaciones', width: 35 }
                    ],
                    data: fqData
                },
                {
                    name: 'ANALISIS MB',
                    columns: [
                        { header: 'FECHA', key: 'fecha', width: 14 },
                        { header: 'PRODUCTO', key: 'producto', width: 28 },
                        { header: 'LOTE', key: 'lote', width: 20 },
                        { header: 'RECUENTO TOTAL (UFC/g)', key: 'recuento_total', width: 24 },
                        { header: 'COLIFORMES TOTALES', key: 'coliformes_totales', width: 22 },
                        { header: 'E. COLI', key: 'e_coli', width: 14 },
                        { header: 'SALMONELLA SP. 25g', key: 'salmonella', width: 22 },
                        { header: 'HONGOS Y LEVADURAS', key: 'hongos_levaduras', width: 22 },
                        { header: 'ST. AUREUS', key: 'staph_aureus', width: 16 },
                        { header: 'DICTAMEN', key: 'dictamen', width: 18 }
                    ],
                    data: mbData
                }
            ]
        });

        return excelService.sendExcelResponse(res, buffer, `Control_Calidad_Mario_${year}.xlsx`);
    } catch (error) {
        console.error('Error exportando Excel de calidad Mario:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { registerReturnableMovement, getReturnableCustomerStatement, syncReturnablesFromSales, exportMarioQualityExcel };
