const pool = require('../config/db');
const pdfService = require('../services/pdf.service');
const excelService = require('../services/excel.service');
const { dteValidoExistsSql } = require('../services/dteQueryFilters');

exports.getReporteVentas = async (req, res) => {
    try {
        const { fecha, turno } = req.query;
        const company_id = req.company_id;
        const branch_id = req.query.branch_id || req.user?.branch_id;

        if (!fecha) {
            return res.status(400).json({ message: 'La fecha es obligatoria' });
        }

        const turnoNum = parseInt(turno, 10) || 0;

        const query = `
            SELECT 
                p.codigo AS codigo_producto,
                p.nombre AS descripcion_producto,
                COALESCE(l.precio, v.precio, 0) AS precio,
                COALESCE(l.lectura_galones, 0) AS lectura_galones,
                COALESCE(l.lectura_monto, 0) AS lectura_monto,
                COALESCE(v.venta_galones, 0) AS venta_galones,
                COALESCE(v.venta_monto, 0) AS venta_monto,
                COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0) AS diferencia_galones,
                (COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0)) * COALESCE(l.precio, v.precio, 0) AS diferencia_monto
            FROM products p
            LEFT JOIN (
                SELECT 
                    r.product_id,
                    AVG(r.precio) AS precio,
                    SUM(COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) AS lectura_galones,
                    ROUND(SUM((COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) * r.precio), 2) AS lectura_monto
                FROM gas_station_closeout_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE c.company_id = ? AND c.fecha_turno = ? AND c.branch_id = ?
                  AND (? = 0 OR c.numero_turno = ?)
                GROUP BY r.product_id
            ) l ON p.id = l.product_id
            LEFT JOIN (
                SELECT 
                    si.product_id,
                    AVG(si.precio_unitario) AS precio,
                    SUM(si.cantidad) AS venta_galones,
                    ROUND(SUM(si.cantidad * si.precio_unitario), 2) AS venta_monto
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                WHERE sh.company_id = ? AND DATE(sh.created_at) = ? AND sh.branch_id = ?
                  AND sh.estado != 'anulado'
                  AND ${dteValidoExistsSql('sh')}
                  AND (? = 0 OR sh.shift_id IN (
                      SELECT id FROM pos_shifts
                      WHERE company_id = ? AND branch_id = ? AND shift_date = ? AND shift_number = ?
                  ))
                GROUP BY si.product_id
            ) v ON p.id = v.product_id
            WHERE p.company_id = ? AND p.tipo_combustible > 0 AND p.status = 'activo'
            ORDER BY p.codigo
        `;

        const params = [
            company_id, fecha, branch_id, turnoNum, turnoNum,
            company_id, fecha, branch_id, turnoNum,
            company_id, branch_id, fecha, turnoNum,
            company_id
        ];

        const [rows] = await pool.query(query, params);

        const totales = {
            lectura_galones: 0,
            lectura_monto: 0,
            venta_galones: 0,
            venta_monto: 0,
            diferencia_galones: 0,
            diferencia_monto: 0,
        };

        for (const row of rows) {
            totales.lectura_galones += parseFloat(row.lectura_galones) || 0;
            totales.lectura_monto += parseFloat(row.lectura_monto) || 0;
            totales.venta_galones += parseFloat(row.venta_galones) || 0;
            totales.venta_monto += parseFloat(row.venta_monto) || 0;
            totales.diferencia_galones += parseFloat(row.diferencia_galones) || 0;
            totales.diferencia_monto += parseFloat(row.diferencia_monto) || 0;
        }

        res.json({ data: rows, totales });
    } catch (error) {
        console.error('Error en getReporteVentas:', error);
        res.status(500).json({ message: 'Error al obtener reporte de ventas' });
    }
};

const tipoNombres = {
    remesas: 'Remesas',
    gastos: 'Gastos',
    creditos: 'Créditos',
    cupones: 'Cupones',
    descuentos: 'Descuentos',
    adelantos: 'Adelantos',
    tarjetas: 'Tarjetas',
    vales: 'Vales',
    anticipos_desp: 'Anticipos Despachados',
    lubricantes: 'Lubricantes'
};

const fuelTypeLabels = { 1: 'REGULAR', 2: 'SUPER', 3: 'DIESEL', 4: 'ION DIESEL' };

exports.getFuelInventoryPDF = async (req, res) => {
    const { start_date, end_date, tipo_combustible, branch_id } = req.query;
    const companyId = req.company_id;
    const fuelType = parseInt(tipo_combustible, 10);

    // Para DIESEL se incluye también el Combustible Master (tipo 5), variante diesel
    const fuelTypesFilter = fuelType === 3 ? [3, 5] : [fuelType];
    const fuelTypesPlaceholders = fuelTypesFilter.map(() => '?').join(',');

    try {
        if (!companyId) return res.status(401).json({ message: 'No session' });
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });
        if (!fuelType || ![1, 2, 3, 4].includes(fuelType)) return res.status(400).json({ message: 'Tipo de combustible inválido' });

        const [companyRows] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const companyInfo = companyRows[0] || { razon_social: 'Empresa', nit: '', nrc: '' };

        let branchName = 'Todas';
        if (branch_id && branch_id !== 'all') {
            const [br] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (br.length > 0) branchName = br[0].nombre;
        }

        const fuelLabel = fuelTypeLabels[fuelType];
        const branchFilter = branch_id && branch_id !== 'all' ? 'AND c.branch_id = ?' : '';
        const branchFilter2 = branch_id && branch_id !== 'all' ? 'AND ph.branch_id = ?' : '';
        const branchFilter3 = branch_id && branch_id !== 'all' ? 'AND c2.branch_id = ?' : '';
        const branchParams = branch_id && branch_id !== 'all' ? [branch_id] : [];

        // Sales by service type per day
        const [salesRows] = await pool.query(`
            SELECT c.fecha_turno, n.tipo,
                SUM(r.lectura_actual - r.lectura_anterior - COALESCE(r.calibracion, 0)) AS venta_gal,
                AVG(r.precio) AS precio
            FROM gas_station_closeout_readings r
            JOIN gas_station_closeouts c ON r.closeout_id = c.id
            JOIN gas_station_nozzles n ON r.nozzle_id = n.id
            JOIN products p ON r.product_id = p.id
            WHERE c.company_id = ?
                AND c.fecha_turno BETWEEN ? AND ?
                AND c.estado IN ('cerrado', 'reabierto')
                AND p.tipo_combustible IN (${fuelTypesPlaceholders})
                ${branchFilter}
            GROUP BY c.fecha_turno, n.tipo
            ORDER BY c.fecha_turno, n.tipo
        `, [companyId, start_date, end_date, ...fuelTypesFilter, ...branchParams]);

        // Tank inventory (last closeout per day) — only lectura_actual from the latest turn
        const [tankRows] = await pool.query(`
            SELECT c.fecha_turno,
                SUM(tr.lectura_actual) AS inventario_final
            FROM gas_station_closeout_tank_readings tr
            JOIN gas_station_closeouts c ON tr.closeout_id = c.id
            JOIN gas_station_tanks t ON tr.tank_id = t.id
            WHERE c.company_id = ?
                AND c.fecha_turno BETWEEN ? AND ?
                AND c.estado IN ('cerrado', 'reabierto')
                AND t.tipo_combustible IN (${fuelTypesPlaceholders})
                ${branchFilter}
                AND c.id IN (
                    SELECT MAX(c2.id)
                    FROM gas_station_closeouts c2
                    WHERE c2.company_id = ?
                        AND c2.estado IN ('cerrado', 'reabierto')
                        ${branchFilter3}
                    GROUP BY c2.fecha_turno, COALESCE(c2.branch_id, 0)
                )
            GROUP BY c.fecha_turno
            ORDER BY c.fecha_turno
        `, [companyId, start_date, end_date, ...fuelTypesFilter, ...branchParams, companyId, ...branchParams]);

        // Tank recargas (ALL closeouts per day accumulated)
        const [recargaRows] = await pool.query(`
            SELECT c.fecha_turno,
                SUM(tr.recarga) AS recarga_manual
            FROM gas_station_closeout_tank_readings tr
            JOIN gas_station_closeouts c ON tr.closeout_id = c.id
            JOIN gas_station_tanks t ON tr.tank_id = t.id
            WHERE c.company_id = ?
                AND c.fecha_turno BETWEEN ? AND ?
                AND c.estado IN ('cerrado', 'reabierto')
                AND t.tipo_combustible IN (${fuelTypesPlaceholders})
                ${branchFilter}
            GROUP BY c.fecha_turno
            ORDER BY c.fecha_turno
        `, [companyId, start_date, end_date, ...fuelTypesFilter, ...branchParams]);

        // Purchase quantities per day
        const [purchaseRows] = await pool.query(`
            SELECT DATE(ph.fecha) AS fecha,
                SUM(pi.cantidad) AS recarga_compra
            FROM purchase_items pi
            JOIN purchase_headers ph ON pi.purchase_id = ph.id
            JOIN products p ON pi.product_id = p.id
            WHERE ph.company_id = ?
                AND DATE(ph.fecha) BETWEEN ? AND ?
                AND ph.status = 'COMPLETADO'
                AND p.tipo_combustible IN (${fuelTypesPlaceholders})
                ${branchFilter2}
            GROUP BY DATE(ph.fecha)
            ORDER BY DATE(ph.fecha)
        `, [companyId, start_date, end_date, ...fuelTypesFilter, ...branchParams]);

        // Product cost for this fuel type
        const [costRows] = await pool.query(`
            SELECT AVG(costo) AS costo_promedio
            FROM products
            WHERE company_id = ? AND tipo_combustible IN (${fuelTypesPlaceholders}) AND status = 'activo'
        `, [companyId, ...fuelTypesFilter]);
        const costo = parseFloat(costRows[0]?.costo_promedio || 0);

        // Inventory from last closeout before start_date
        let inventario_inicial = 0;
        try {
            const [initRows] = await pool.query(`
                SELECT SUM(tr.lectura_actual) AS inventario_inicial
                FROM gas_station_closeout_tank_readings tr
                JOIN gas_station_closeouts c ON tr.closeout_id = c.id
                JOIN gas_station_tanks t ON tr.tank_id = t.id
                WHERE c.company_id = ?
                    AND c.fecha_turno < ?
                    AND c.estado IN ('cerrado', 'reabierto')
                    AND t.tipo_combustible IN (${fuelTypesPlaceholders})
                    ${branchFilter}
                    AND c.id IN (
                        SELECT MAX(c2.id)
                        FROM gas_station_closeouts c2
                        WHERE c2.company_id = ?
                            AND c2.fecha_turno < ?
                            AND c2.estado IN ('cerrado', 'reabierto')
                            ${branchFilter3}
                        GROUP BY c2.branch_id
                    )
            `, [companyId, start_date, ...fuelTypesFilter, ...branchParams, companyId, start_date, ...branchParams]);
            inventario_inicial = parseFloat(initRows[0]?.inventario_inicial || 0);
        } catch (e) {
            console.error('Error fetching initial inventory:', e);
        }

        // Build date map
        const dateMap = {};

        // Process sales
        for (const row of salesRows) {
            const fecha = row.fecha_turno.toISOString().slice(0, 10);
            if (!dateMap[fecha]) dateMap[fecha] = { fecha, venta_auto: 0, venta_full: 0, venta_master: 0, precio_auto: 0, precio_full: 0, precio_master: 0, inventario: 0, recarga_manual: 0, recarga_compra: 0, costo: costo };
            const key = row.tipo === 'A' ? 'auto' : row.tipo === 'C' ? 'full' : 'master';
            dateMap[fecha][`venta_${key}`] = parseFloat(row.venta_gal) || 0;
            dateMap[fecha][`precio_${key}`] = parseFloat(row.precio) || 0;
        }

        // Process tank inventory (lectura_actual from last closeout of the day)
        for (const row of tankRows) {
            const fecha = row.fecha_turno.toISOString().slice(0, 10);
            if (!dateMap[fecha]) dateMap[fecha] = { fecha, venta_auto: 0, venta_full: 0, venta_master: 0, precio_auto: 0, precio_full: 0, precio_master: 0, inventario: 0, recarga_manual: 0, recarga_compra: 0, costo: costo };
            dateMap[fecha].inventario = parseFloat(row.inventario_final) || 0;
        }

        // Process recargas (accumulated from ALL closeouts of the day)
        for (const row of recargaRows) {
            const fecha = row.fecha_turno.toISOString().slice(0, 10);
            if (!dateMap[fecha]) dateMap[fecha] = { fecha, venta_auto: 0, venta_full: 0, venta_master: 0, precio_auto: 0, precio_full: 0, precio_master: 0, inventario: 0, recarga_manual: 0, recarga_compra: 0, costo: costo };
            dateMap[fecha].recarga_manual += parseFloat(row.recarga_manual) || 0;
        }

        // Process purchases
        for (const row of purchaseRows) {
            const fecha = row.fecha.toISOString().slice(0, 10);
            if (!dateMap[fecha]) dateMap[fecha] = { fecha, venta_auto: 0, venta_full: 0, venta_master: 0, precio_auto: 0, precio_full: 0, precio_master: 0, inventario: 0, recarga_manual: 0, recarga_compra: 0, costo: costo };
            dateMap[fecha].recarga_compra += parseFloat(row.recarga_compra) || 0;
        }

        // Calculate derived columns and sort by date
        const rows = Object.values(dateMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

        let prev_inventario = inventario_inicial;
        for (const r of rows) {
            const va = r.venta_auto;
            const vf = r.venta_full;
            const vm = r.venta_master;
            const pa = r.precio_auto;
            const pf = r.precio_full;
            const pm = r.precio_master;
            const cos = r.costo;
            const inv = r.inventario;

            r.total_venta = va + vf + vm;
            r.margen_auto = pa - cos;
            r.margen_full = pf - cos;
            r.margen_master = pm - cos;
            r.utilidad_auto = r.margen_auto * va;
            r.utilidad_full = r.margen_full * vf;
            r.utilidad_master = r.margen_master * vm;
            r.utilidad_total = r.utilidad_auto + r.utilidad_full + r.utilidad_master;
            r.margen_total = r.margen_auto + r.margen_full + r.margen_master;

            r.dif_diaria = (prev_inventario + r.recarga_manual + r.recarga_compra - inv) - r.total_venta;
            prev_inventario = inv;

            r.precio_promedio = r.total_venta > 0
                ? (va * pa + vf * pf + vm * pm) / r.total_venta
                : 0;
        }

        const reportData = {
            company_id: companyId,
            company: companyInfo,
            company_name: companyInfo.razon_social,
            company_nit: companyInfo.nit,
            company_nrc: companyInfo.nrc,
            branch_name: branchName,
            start_date,
            end_date,
            fuel_label: fuelLabel,
            inventario_inicial,
            rows
        };

        if (req.query.format === 'excel') {
            const sheetData = [];

            // Initial inventory row
            sheetData.push({
                fecha: 'INVENTARIO INICIAL',
                venta_auto: '',
                venta_full: '',
                venta_master: '',
                precio_auto: '',
                precio_full: '',
                precio_master: '',
                inventario: inventario_inicial.toFixed(2),
                recarga_manual: '',
                recarga_compra: '',
                total_venta: '',
                precio_promedio: '',
                dif_diaria: ''
            });

            rows.forEach(r => {
                sheetData.push({
                    fecha: r.fecha,
                    venta_auto: parseFloat(r.venta_auto || 0).toFixed(2),
                    venta_full: parseFloat(r.venta_full || 0).toFixed(2),
                    venta_master: parseFloat(r.venta_master || 0).toFixed(2),
                    precio_auto: parseFloat(r.precio_auto || 0).toFixed(4),
                    precio_full: parseFloat(r.precio_full || 0).toFixed(4),
                    precio_master: parseFloat(r.precio_master || 0).toFixed(4),
                    inventario: parseFloat(r.inventario || 0).toFixed(2),
                    recarga_manual: parseFloat(r.recarga_manual || 0).toFixed(2),
                    recarga_compra: parseFloat(r.recarga_compra || 0).toFixed(2),
                    total_venta: parseFloat(r.total_venta || 0).toFixed(2),
                    precio_promedio: parseFloat(r.precio_promedio || 0).toFixed(4),
                    dif_diaria: parseFloat(r.dif_diaria || 0).toFixed(2)
                });
            });

            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: fuelLabel,
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 20 },
                        { header: 'Vta. Auto', key: 'venta_auto', width: 12 },
                        { header: 'Vta. Full', key: 'venta_full', width: 12 },
                        { header: 'Vta. Master', key: 'venta_master', width: 12 },
                        { header: 'P. Auto', key: 'precio_auto', width: 12 },
                        { header: 'P. Full', key: 'precio_full', width: 12 },
                        { header: 'P. Master', key: 'precio_master', width: 12 },
                        { header: 'Inventario', key: 'inventario', width: 14 },
                        { header: 'Rec. Manual', key: 'recarga_manual', width: 14 },
                        { header: 'Rec. Compra', key: 'recarga_compra', width: 14 },
                        { header: 'Total Vta.', key: 'total_venta', width: 12 },
                        { header: 'Precio Prom.', key: 'precio_promedio', width: 12 },
                        { header: 'Dif. Diaria', key: 'dif_diaria', width: 12 },
                    ],
                    data: sheetData
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Inventario_${fuelLabel}_${start_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateFuelInventoryPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Inventario_${fuelLabel}_${start_date}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en getFuelInventoryPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de inventario de combustible' });
    }
};

exports.getGalonajeVendidoPDF = async (req, res) => {
    const { start_date, end_date, branch_id } = req.query;
    const companyId = req.company_id;

    try {
        if (!companyId) return res.status(401).json({ message: 'No session' });
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });

        const [companyRows] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const companyInfo = companyRows[0] || { razon_social: 'Empresa', nit: '', nrc: '' };

        let branchName = 'Todas';
        if (branch_id && branch_id !== 'all') {
            const [br] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (br.length > 0) branchName = br[0].nombre;
        }

        const branchFilterSale = branch_id && branch_id !== 'all' ? 'AND sh.branch_id = ?' : '';
        const branchFilterClose = branch_id && branch_id !== 'all' ? 'AND c.branch_id = ?' : '';
        const branchParams = branch_id && branch_id !== 'all' ? [branch_id] : [];

        const [salesRows] = await pool.query(`
            SELECT DATE(sh.created_at) AS fecha,
                p.tipo_combustible,
                SUM(si.cantidad) AS venta_galones
            FROM sales_items si
            JOIN sales_headers sh ON si.sale_id = sh.id
            JOIN products p ON si.product_id = p.id
            WHERE sh.company_id = ?
                AND DATE(sh.created_at) BETWEEN ? AND ?
                AND sh.estado != 'anulado'
                AND sh.estado != 'ANULADO'
                AND ${dteValidoExistsSql('sh')}
                AND p.tipo_combustible > 0
                ${branchFilterSale}
            GROUP BY DATE(sh.created_at), p.tipo_combustible
            ORDER BY DATE(sh.created_at), p.tipo_combustible
        `, [companyId, start_date, end_date, ...branchParams]);

        const [readingRows] = await pool.query(`
            SELECT c.fecha_turno AS fecha,
                p.tipo_combustible,
                SUM(r.lectura_actual - r.lectura_anterior - COALESCE(r.calibracion, 0)) AS lect_galones
            FROM gas_station_closeout_readings r
            JOIN gas_station_closeouts c ON r.closeout_id = c.id
            JOIN products p ON r.product_id = p.id
            WHERE c.company_id = ?
                AND c.fecha_turno BETWEEN ? AND ?
                AND c.estado IN ('cerrado', 'reabierto')
                AND p.tipo_combustible > 0
                ${branchFilterClose}
            GROUP BY c.fecha_turno, p.tipo_combustible
            ORDER BY c.fecha_turno, p.tipo_combustible
        `, [companyId, start_date, end_date, ...branchParams]);

        const dateMap = {};

        for (const row of readingRows) {
            const fecha = row.fecha instanceof Date ? row.fecha.toISOString().slice(0, 10) : String(row.fecha).slice(0, 10);
            if (!dateMap[fecha]) {
                dateMap[fecha] = { fecha, lect_diesel: 0, vta_diesel: 0, dif_diesel: 0, lect_regular: 0, vta_regular: 0, dif_regular: 0, lect_super: 0, vta_super: 0, dif_super: 0, lect_ion_diesel: 0, vta_ion_diesel: 0, dif_ion_diesel: 0 };
            }
            const t = row.tipo_combustible === 5 ? 3 : row.tipo_combustible;
            if (t === 3) dateMap[fecha].lect_diesel += parseFloat(row.lect_galones) || 0;
            else if (t === 1) dateMap[fecha].lect_regular += parseFloat(row.lect_galones) || 0;
            else if (t === 2) dateMap[fecha].lect_super += parseFloat(row.lect_galones) || 0;
            else if (t === 4) dateMap[fecha].lect_ion_diesel += parseFloat(row.lect_galones) || 0;
        }

        for (const row of salesRows) {
            const fecha = row.fecha instanceof Date ? row.fecha.toISOString().slice(0, 10) : String(row.fecha).slice(0, 10);
            if (!dateMap[fecha]) {
                dateMap[fecha] = { fecha, lect_diesel: 0, vta_diesel: 0, dif_diesel: 0, lect_regular: 0, vta_regular: 0, dif_regular: 0, lect_super: 0, vta_super: 0, dif_super: 0, lect_ion_diesel: 0, vta_ion_diesel: 0, dif_ion_diesel: 0 };
            }
            const t = row.tipo_combustible === 5 ? 3 : row.tipo_combustible;
            if (t === 3) dateMap[fecha].vta_diesel += parseFloat(row.venta_galones) || 0;
            else if (t === 1) dateMap[fecha].vta_regular += parseFloat(row.venta_galones) || 0;
            else if (t === 2) dateMap[fecha].vta_super += parseFloat(row.venta_galones) || 0;
            else if (t === 4) dateMap[fecha].vta_ion_diesel += parseFloat(row.venta_galones) || 0;
        }

        const rows = Object.values(dateMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

        for (const r of rows) {
            r.dif_diesel = r.lect_diesel - r.vta_diesel;
            r.dif_regular = r.lect_regular - r.vta_regular;
            r.dif_super = r.lect_super - r.vta_super;
            r.dif_ion_diesel = r.lect_ion_diesel - r.vta_ion_diesel;
        }

        const totales = { lect_diesel: 0, vta_diesel: 0, lect_regular: 0, vta_regular: 0, lect_super: 0, vta_super: 0, dif_diesel: 0, dif_regular: 0, dif_super: 0, lect_ion_diesel: 0, vta_ion_diesel: 0, dif_ion_diesel: 0 };
        for (const r of rows) {
            totales.lect_diesel += r.lect_diesel;
            totales.vta_diesel += r.vta_diesel;
            totales.lect_regular += r.lect_regular;
            totales.vta_regular += r.vta_regular;
            totales.lect_super += r.lect_super;
            totales.vta_super += r.vta_super;
            totales.dif_diesel += r.dif_diesel;
            totales.dif_regular += r.dif_regular;
            totales.dif_super += r.dif_super;
            totales.lect_ion_diesel += r.lect_ion_diesel;
            totales.vta_ion_diesel += r.vta_ion_diesel;
            totales.dif_ion_diesel += r.dif_ion_diesel;
        }

        const dif_diesel = totales.dif_diesel;
        const dif_regular = totales.dif_regular;
        const dif_super = totales.dif_super;
        const dif_ion_diesel = totales.dif_ion_diesel;
        const dif_total = dif_diesel + dif_regular + dif_super + dif_ion_diesel;

        const reportData = {
            company_id: companyId,
            company: companyInfo,
            company_name: companyInfo.razon_social,
            company_nit: companyInfo.nit,
            company_nrc: companyInfo.nrc,
            branch_name: branchName,
            start_date,
            end_date,
            rows,
            totales,
            diferencias: { diesel: dif_diesel, regular: dif_regular, super: dif_super, ion_diesel: dif_ion_diesel, total: dif_total }
        };

        if (req.query.format === 'excel') {
            const sheetData = rows.map(r => ({
                fecha: r.fecha instanceof Date ? r.fecha.toLocaleDateString('es-SV') : String(r.fecha).slice(0, 10),
                lect_diesel: parseFloat(r.lect_diesel || 0).toFixed(2),
                vta_diesel: parseFloat(r.vta_diesel || 0).toFixed(2),
                dif_diesel: parseFloat(r.dif_diesel || 0).toFixed(2),
                lect_regular: parseFloat(r.lect_regular || 0).toFixed(2),
                vta_regular: parseFloat(r.vta_regular || 0).toFixed(2),
                dif_regular: parseFloat(r.dif_regular || 0).toFixed(2),
                lect_super: parseFloat(r.lect_super || 0).toFixed(2),
                vta_super: parseFloat(r.vta_super || 0).toFixed(2),
                dif_super: parseFloat(r.dif_super || 0).toFixed(2),
                lect_ion_diesel: parseFloat(r.lect_ion_diesel || 0).toFixed(2),
                vta_ion_diesel: parseFloat(r.vta_ion_diesel || 0).toFixed(2),
                dif_ion_diesel: parseFloat(r.dif_ion_diesel || 0).toFixed(2),
            }));

            sheetData.push({
                fecha: 'TOTALES',
                lect_diesel: totales.lect_diesel.toFixed(2),
                vta_diesel: totales.vta_diesel.toFixed(2),
                dif_diesel: totales.dif_diesel.toFixed(2),
                lect_regular: totales.lect_regular.toFixed(2),
                vta_regular: totales.vta_regular.toFixed(2),
                dif_regular: totales.dif_regular.toFixed(2),
                lect_super: totales.lect_super.toFixed(2),
                vta_super: totales.vta_super.toFixed(2),
                dif_super: totales.dif_super.toFixed(2),
                lect_ion_diesel: totales.lect_ion_diesel.toFixed(2),
                vta_ion_diesel: totales.vta_ion_diesel.toFixed(2),
                dif_ion_diesel: totales.dif_ion_diesel.toFixed(2),
            });

            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Galonaje',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 14 },
                        { header: 'Lect. Diesel', key: 'lect_diesel', width: 14 },
                        { header: 'Vta. Diesel', key: 'vta_diesel', width: 14 },
                        { header: 'Dif. Diesel', key: 'dif_diesel', width: 14 },
                        { header: 'Lect. Regular', key: 'lect_regular', width: 14 },
                        { header: 'Vta. Regular', key: 'vta_regular', width: 14 },
                        { header: 'Dif. Regular', key: 'dif_regular', width: 14 },
                        { header: 'Lect. Super', key: 'lect_super', width: 14 },
                        { header: 'Vta. Super', key: 'vta_super', width: 14 },
                        { header: 'Dif. Super', key: 'dif_super', width: 14 },
                        { header: 'Lect. Ion Diesel', key: 'lect_ion_diesel', width: 14 },
                        { header: 'Vta. Ion Diesel', key: 'vta_ion_diesel', width: 14 },
                        { header: 'Dif. Ion Diesel', key: 'dif_ion_diesel', width: 14 },
                    ],
                    data: sheetData
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Galonaje_Vendido_${start_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateGalonajeVendidoPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Galonaje_Vendido_${start_date}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en getGalonajeVendidoPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de galonaje vendido' });
    }
};

exports.getCloseoutDetailPDF = async (req, res) => {
    const { start_date, end_date, tipo_reporte, branch_id } = req.query;
    const companyId = req.company_id;

    try {
        if (!companyId) return res.status(401).json({ message: 'No session' });
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });
        if (!tipo_reporte || !tipoNombres[tipo_reporte]) return res.status(400).json({ message: 'Tipo de reporte inválido' });

        const [companyRows] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const companyInfo = companyRows[0] || { razon_social: 'Empresa', nit: '', nrc: '' };

        let branchName = 'Todas';
        if (branch_id && branch_id !== 'all') {
            const [br] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (br.length > 0) branchName = br[0].nombre;
        }

        const branchFilter = branch_id && branch_id !== 'all' ? 'AND g.branch_id = ?' : '';
        const branchParams = branch_id && branch_id !== 'all' ? [branch_id] : [];

        let sql, params, columns;

        switch (tipo_reporte) {
            case 'remesas': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, r.documento, 
                           COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador, r.tipo_operacion, r.monto
                    FROM gas_station_closeout_remesas r
                    JOIN gas_station_closeouts g ON r.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
                    LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, r.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Documento', w: 120, accessor: 'documento' },
                    { label: 'Despachador', w: 150, accessor: 'despachador' },
                    { label: 'Tipo Operación', w: 170, accessor: 'tipo_operacion' },
                    { label: 'Monto', w: 100, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'gastos': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, 
                           e.rubro as rubro_nombre,
                           e.documento, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador, e.valor, e.comentario
                    FROM gas_station_closeout_expenses e
                    JOIN gas_station_closeouts g ON e.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON e.despachador_id = d.id
                    LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = e.closeout_id AND cd.despachador_id = e.despachador_id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, e.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Rubro', w: 140, accessor: 'rubro_nombre' },
                    { label: 'Documento', w: 140, accessor: 'documento' },
                    { label: 'Despachador', w: 140, accessor: 'despachador' },
                    { label: 'Comentario', w: 100, accessor: 'comentario' },
                    { label: 'Valor', w: 90, accessor: 'valor', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'creditos': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, c.cliente_nombre as cliente,
                           COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador, c.monto
                    FROM gas_station_closeout_creditos c
                    JOIN gas_station_closeouts g ON c.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
                    LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, c.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Cliente', w: 250, accessor: 'cliente' },
                    { label: 'Despachador', w: 200, accessor: 'despachador' },
                    { label: 'Monto', w: 100, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'cupones': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, c.cupon, c.distribuidora_nombre as distribuidora,
                           c.producto_descripcion as producto, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador, c.monto
                    FROM gas_station_closeout_cupones c
                    JOIN gas_station_closeouts g ON c.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
                    LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, c.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 45, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 70, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Cupón', w: 100, accessor: 'cupon' },
                    { label: 'Distribuidora', w: 150, accessor: 'distribuidora' },
                    { label: 'Producto', w: 140, accessor: 'producto' },
                    { label: 'Despachador', w: 130, accessor: 'despachador' },
                    { label: 'Monto', w: 80, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'descuentos': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, d.cliente_nombre as cliente,
                           COALESCE(NULLIF(cd.nombre, ''), desp.descripcion, desp.codigo, '—') as despachador,
                           COALESCE(d.cantidad, 0) as cantidad,
                           COALESCE(d.valor, 0) as valor,
                           COALESCE(d.total, 0) as total
                    FROM gas_station_closeout_descuentos d
                    JOIN gas_station_closeouts g ON d.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores desp ON d.despachador_id = desp.id
                    LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = d.closeout_id AND cd.despachador_id = d.despachador_id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, d.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 45, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 70, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Cliente', w: 210, accessor: 'cliente' },
                    { label: 'Despachador', w: 145, accessor: 'despachador' },
                    { label: 'Galonaje', w: 80, accessor: 'cantidad', format: 'qty', align: 'right' },
                    { label: 'Desc. x Galón', w: 85, accessor: 'valor', format: 'money', noTotal: true, align: 'right' },
                    { label: 'Total', w: 90, accessor: 'total', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'tarjetas': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno,
                           COALESCE(pt.nombre, 'SIN TIPO') as tipo_pos,
                           COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador,
                           t.monto
                    FROM gas_station_closeout_tarjetas t
                    JOIN gas_station_closeouts g ON t.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON t.despachador_id = d.id
                    LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = t.closeout_id AND cd.despachador_id = t.despachador_id
                    LEFT JOIN gas_station_pos_types pt ON t.pos_type_id = pt.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY tipo_pos, g.fecha_turno, g.numero_turno, t.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Tipo POS', w: 110, accessor: 'tipo_pos' },
                    { label: 'Turno', w: 80, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 120, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Despachador', w: 250, accessor: 'despachador' },
                    { label: 'Monto', w: 120, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'adelantos':
            case 'vales':
            case 'anticipos_desp': {
                const tableMap = {
                    adelantos: { table: 'gas_station_closeout_adelantos', montoField: 'monto' },
                    vales: { table: 'gas_station_closeout_vales', montoField: 'monto' },
                    anticipos_desp: { table: 'gas_station_closeout_anticipos_despachados', montoField: 'monto' }
                };
                const cfg = tableMap[tipo_reporte];
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador, r.${cfg.montoField} as monto
                    FROM ${cfg.table} r
                    JOIN gas_station_closeouts g ON r.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
                    LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, r.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 80, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 120, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Despachador', w: 300, accessor: 'despachador' },
                    { label: 'Monto', w: 120, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'lubricantes': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, l.producto_descripcion as producto,
                           l.ventas as cantidad, l.precio, l.total
                    FROM gas_station_closeout_lubricant_readings l
                    JOIN gas_station_closeouts g ON l.closeout_id = g.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, l.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Producto', w: 260, accessor: 'producto' },
                    { label: 'Cantidad', w: 90, accessor: 'cantidad', format: 'qty', align: 'right' },
                    { label: 'Precio', w: 90, accessor: 'precio', format: 'money', noTotal: true, align: 'right' },
                    { label: 'Total', w: 90, accessor: 'total', format: 'money', align: 'right' }
                ];
                break;
            }
            default:
                return res.status(400).json({ message: 'Tipo de reporte no implementado' });
        }

        const [rows] = await pool.query(sql, params);

        let groups = null;
        if (tipo_reporte === 'tarjetas') {
            const groupMap = new Map();
            rows.forEach(r => {
                const key = r.tipo_pos || 'SIN TIPO';
                if (!groupMap.has(key)) groupMap.set(key, { label: key, rows: [], subtotal: 0 });
                const g = groupMap.get(key);
                g.rows.push(r);
                g.subtotal += parseFloat(r.monto || 0);
            });
            groups = Array.from(groupMap.values());
        }

        const reportData = {
            company_id: companyId,
            company: companyInfo,
            company_name: companyInfo.razon_social,
            company_nit: companyInfo.nit,
            company_nrc: companyInfo.nrc,
            branch_name: branchName,
            start_date,
            end_date,
            tipo_reporte,
            tipo_nombre: tipoNombres[tipo_reporte],
            columns,
            rows,
            groups
        };

        if (req.query.format === 'excel') {
            const excelColumns = columns.map(c => ({
                header: c.label,
                key: c.accessor,
                width: Math.max(Math.round(c.w / 7), 10)
            }));

            const mapRow = (r) => {
                const rowData = {};
                columns.forEach(c => {
                    const val = r[c.accessor];
                    if (c.format === 'date' && val) {
                        rowData[c.accessor] = val instanceof Date
                            ? val.toLocaleDateString('es-SV')
                            : new Date(val).toLocaleDateString('es-SV');
                    } else if (c.format === 'money') {
                        rowData[c.accessor] = parseFloat(val || 0).toFixed(2);
                    } else if (c.format === 'qty') {
                        rowData[c.accessor] = parseFloat(val || 0).toFixed(2);
                    } else {
                        rowData[c.accessor] = val ?? '';
                    }
                });
                return rowData;
            };
            const emptyRow = () => {
                const rowData = {};
                columns.forEach(c => { rowData[c.accessor] = ''; });
                return rowData;
            };

            let excelData = rows.map(mapRow);
            if (groups) {
                const moneyCol = columns.find(c => c.format === 'money' && !c.noTotal);
                excelData = [];
                groups.forEach(g => {
                    const sub = emptyRow();
                    sub[columns[0].accessor] = `SUBTOTAL ${g.label}`;
                    if (moneyCol) sub[moneyCol.accessor] = g.subtotal.toFixed(2);
                    excelData.push(sub);
                    g.rows.forEach(r => excelData.push(mapRow(r)));
                });
                const totalRow = emptyRow();
                totalRow[columns[0].accessor] = 'TOTALES GENERALES';
                if (moneyCol) {
                    totalRow[moneyCol.accessor] = rows
                        .reduce((s, r) => s + (parseFloat(r[moneyCol.accessor]) || 0), 0)
                        .toFixed(2);
                }
                excelData.push(totalRow);
            } else if (rows.length > 0) {
                const totalRow = emptyRow();
                totalRow[columns[0].accessor] = 'TOTALES GENERALES';
                columns.forEach(c => {
                    if (c.format === 'money' && !c.noTotal) {
                        totalRow[c.accessor] = rows
                            .reduce((s, r) => s + (parseFloat(r[c.accessor]) || 0), 0)
                            .toFixed(2);
                    } else if ((c.format === 'qty' || c.accessor === 'cantidad') && !c.noTotal) {
                        totalRow[c.accessor] = rows
                            .reduce((s, r) => s + (parseFloat(r[c.accessor]) || 0), 0)
                            .toFixed(2);
                    }
                });
                excelData.push(totalRow);
            }

            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: tipoNombres[tipo_reporte],
                    columns: excelColumns,
                    data: excelData
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Detalle_Cierre_${tipo_reporte}_${start_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateCloseoutDetailPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Detalle_Cierre_${tipo_reporte}_${start_date}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en getCloseoutDetailPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte detalle de cierre' });
    }
};

exports.getFuelSalesSummaryPDF = async (req, res) => {
    const { start_date, end_date, branch_id } = req.query;
    const companyId = req.company_id;

    try {
        if (!companyId) return res.status(401).json({ message: 'No session' });
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });

        const [companyRows] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const companyInfo = companyRows[0] || { razon_social: 'Empresa', nit: '', nrc: '' };

        let branchName = 'Todas';
        if (branch_id && branch_id !== 'all') {
            const [br] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (br.length > 0) branchName = br[0].nombre;
        }

        const branchFilter = branch_id && branch_id !== 'all' ? 'AND c.branch_id = ?' : '';
        const branchParams = branch_id && branch_id !== 'all' ? [branch_id] : [];

        const [rows] = await pool.query(`
            SELECT
                c.fecha_turno,
                r.codigo_producto,
                r.descripcion_producto,
                SUM(r.lectura_actual - r.lectura_anterior - COALESCE(r.calibracion, 0)) AS galones,
                SUM((r.lectura_actual - r.lectura_anterior - COALESCE(r.calibracion, 0)) * r.precio) AS monto
            FROM gas_station_closeout_readings r
            JOIN gas_station_closeouts c ON c.id = r.closeout_id
            WHERE c.company_id = ?
                AND c.fecha_turno BETWEEN ? AND ?
                AND c.estado IN ('cerrado', 'reabierto')
                ${branchFilter}
            GROUP BY c.fecha_turno, r.codigo_producto, r.descripcion_producto
            ORDER BY c.fecha_turno ASC, r.codigo_producto ASC
        `, [companyId, start_date, end_date, ...branchParams]);

        const grouped = {};
        for (const r of rows) {
            const fecha = r.fecha_turno instanceof Date
                ? r.fecha_turno.toISOString().slice(0, 10)
                : String(r.fecha_turno).slice(0, 10);
            if (!grouped[fecha]) grouped[fecha] = [];
            grouped[fecha].push(r);
        }

        if (req.query.format === 'excel') {
            const sheetData = [];
            for (const [fecha, items] of Object.entries(grouped)) {
                let totalGalones = 0, totalMonto = 0;
                for (const r of items) {
                    sheetData.push({
                        fecha,
                        codigo_producto: r.codigo_producto,
                        descripcion_producto: r.descripcion_producto,
                        galones: parseFloat(r.galones || 0),
                        monto: parseFloat(r.monto || 0)
                    });
                    totalGalones += parseFloat(r.galones || 0);
                    totalMonto += parseFloat(r.monto || 0);
                }
                sheetData.push({
                    fecha,
                    codigo_producto: '',
                    descripcion_producto: 'TOTAL DIARIO',
                    galones: totalGalones,
                    monto: totalMonto,
                    porcentaje: ''
                });
            }

            // Resumen de operaciones para Excel
            const summaryByProduct = {};
            for (const [, items] of Object.entries(grouped)) {
                for (const r of items) {
                    const code = r.codigo_producto || 'SIN_COD';
                    if (!summaryByProduct[code]) {
                        summaryByProduct[code] = {
                            codigo: code,
                            descripcion: r.descripcion_producto || '',
                            galones: 0,
                            monto: 0
                        };
                    }
                    summaryByProduct[code].galones += parseFloat(r.galones || 0);
                    summaryByProduct[code].monto += parseFloat(r.monto || 0);
                }
            }
            const grandTotalGal = Object.values(summaryByProduct).reduce((acc, c) => acc + c.galones, 0);

            sheetData.push({ fecha: '', codigo_producto: '', descripcion_producto: '', galones: '', monto: '', porcentaje: '' });
            sheetData.push({ fecha: 'CUADRO RESUMEN DE OPERACIONES', codigo_producto: '', descripcion_producto: '', galones: '', monto: '', porcentaje: '' });
            for (const s of Object.values(summaryByProduct).sort((a, b) => a.codigo.localeCompare(b.codigo))) {
                const pct = grandTotalGal > 0 ? (s.galones / grandTotalGal) * 100 : 0;
                sheetData.push({
                    fecha: '',
                    codigo_producto: s.codigo,
                    descripcion_producto: s.descripcion,
                    galones: s.galones,
                    monto: s.monto,
                    porcentaje: `${pct.toFixed(2)}%`
                });
            }

            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'GLN Vendidos',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 15 },
                        { header: 'Codigo', key: 'codigo_producto', width: 12 },
                        { header: 'Descripcion', key: 'descripcion_producto', width: 30 },
                        { header: 'Galones', key: 'galones', width: 12 },
                        { header: 'Monto', key: 'monto', width: 14 },
                        { header: 'Porcentaje', key: 'porcentaje', width: 14 }
                    ],
                    data: sheetData
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Resumen_GLN_Vendidos_${start_date}_${end_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateFuelSalesSummaryPDF({
            company: companyInfo,
            company_id: companyId,
            branch_name: branchName,
            start_date,
            end_date,
            grouped,
            rows
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Resumen_GLN_Vendidos_${start_date}_${end_date}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en getFuelSalesSummaryPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte resumen de galones vendidos' });
    }
};

function buildFuelSalesSummaryPDF(companyInfo, branchName, startDate, endDate, grouped) {
    return pdfService.generateFuelSalesSummaryPDF({
        company: companyInfo,
        branch_name: branchName,
        start_date: startDate,
        end_date: endDate,
        grouped
    });
}

exports.getLubricantsSoldPDF = async (req, res) => {
    const { start_date, end_date, branch_id, only_with_sales } = req.query;
    const companyId = req.company_id;

    try {
        if (!companyId) return res.status(401).json({ message: 'No session' });
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });

        const [companyRows] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
        const companyInfo = companyRows[0] || { razon_social: 'Empresa', nit: '', nrc: '' };

        let branchName = 'Todas';
        if (branch_id && branch_id !== 'all') {
            const [br] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (br.length > 0) branchName = br[0].nombre;
        }

        const branchFilter = branch_id && branch_id !== 'all' ? 'AND c.branch_id = ?' : '';
        const branchParams = branch_id && branch_id !== 'all' ? [branch_id] : [];

        // By default, only show rows with sales > 0 unless only_with_sales === 'false'
        const salesFilter = only_with_sales === 'false' ? '' : 'AND lr.ventas > 0';

        const [rows] = await pool.query(`
            SELECT 
                c.fecha_turno,
                c.numero_turno,
                c.branch_id,
                COALESCE(b.nombre, 'Sin Sucursal') AS branch_name,
                lr.producto_id,
                lr.producto_codigo,
                lr.producto_descripcion,
                lr.lectura_inicial,
                lr.recarga,
                lr.lectura_final,
                lr.ventas,
                lr.precio,
                lr.total
            FROM gas_station_closeout_lubricant_readings lr
            JOIN gas_station_closeouts c ON lr.closeout_id = c.id
            LEFT JOIN branches b ON c.branch_id = b.id
            WHERE c.company_id = ?
              AND c.fecha_turno BETWEEN ? AND ?
              AND c.estado IN ('cerrado', 'reabierto')
              ${salesFilter}
              ${branchFilter}
            ORDER BY c.fecha_turno ASC, c.numero_turno ASC, lr.producto_descripcion ASC
        `, [companyId, start_date, end_date, ...branchParams]);

        // Group by fecha_turno
        const grouped = {};
        for (const r of rows) {
            const fecha = r.fecha_turno instanceof Date
                ? r.fecha_turno.toISOString().slice(0, 10)
                : String(r.fecha_turno).slice(0, 10);
            if (!grouped[fecha]) grouped[fecha] = [];
            grouped[fecha].push(r);
        }

        // Summary by product
        const summaryByProduct = {};
        let grandUnits = 0;
        let grandTotal = 0;

        for (const r of rows) {
            const code = r.producto_codigo || 'SIN_COD';
            const units = parseFloat(r.ventas || 0);
            const total = parseFloat(r.total || 0);
            grandUnits += units;
            grandTotal += total;

            if (!summaryByProduct[code]) {
                summaryByProduct[code] = {
                    codigo: code,
                    descripcion: r.producto_descripcion || '',
                    unidades: 0,
                    total: 0
                };
            }
            summaryByProduct[code].unidades += units;
            summaryByProduct[code].total += total;
        }

        const summaryList = Object.values(summaryByProduct).sort((a, b) => b.total - a.total);
        summaryList.forEach(s => {
            s.precio_promedio = s.unidades > 0 ? s.total / s.unidades : 0;
            s.porcentaje = grandTotal > 0 ? (s.total / grandTotal) * 100 : 0;
        });

        if (req.query.format === 'excel') {
            const sheetData = [];
            for (const [fecha, items] of Object.entries(grouped)) {
                let dayUnits = 0, dayTotal = 0;
                for (const r of items) {
                    const u = parseFloat(r.ventas || 0);
                    const t = parseFloat(r.total || 0);
                    sheetData.push({
                        fecha: r.fecha_turno instanceof Date ? r.fecha_turno.toLocaleDateString('es-SV') : String(fecha),
                        turno: `Turno ${r.numero_turno}`,
                        sucursal: r.branch_name,
                        codigo: r.producto_codigo,
                        descripcion: r.producto_descripcion,
                        inicial: parseFloat(r.lectura_inicial || 0).toFixed(2),
                        recarga: parseFloat(r.recarga || 0).toFixed(2),
                        final: parseFloat(r.lectura_final || 0).toFixed(2),
                        ventas: u.toFixed(2),
                        precio: parseFloat(r.precio || 0).toFixed(2),
                        total: t.toFixed(2)
                    });
                    dayUnits += u;
                    dayTotal += t;
                }
                sheetData.push({
                    fecha: `TOTAL DIARIO (${fecha})`,
                    turno: '',
                    sucursal: '',
                    codigo: '',
                    descripcion: '',
                    inicial: '',
                    recarga: '',
                    final: '',
                    ventas: dayUnits.toFixed(2),
                    precio: '',
                    total: dayTotal.toFixed(2)
                });
            }

            sheetData.push({
                fecha: 'TOTAL GENERAL',
                turno: '',
                sucursal: '',
                codigo: '',
                descripcion: '',
                inicial: '',
                recarga: '',
                final: '',
                ventas: grandUnits.toFixed(2),
                precio: '',
                total: grandTotal.toFixed(2)
            });

            // Summary sheet
            const summarySheetData = summaryList.map(s => ({
                codigo: s.codigo,
                descripcion: s.descripcion,
                unidades: s.unidades.toFixed(2),
                precio_promedio: s.precio_promedio.toFixed(2),
                total: s.total.toFixed(2),
                porcentaje: `${s.porcentaje.toFixed(2)}%`
            }));

            summarySheetData.push({
                codigo: 'TOTAL GENERAL',
                descripcion: '',
                unidades: grandUnits.toFixed(2),
                precio_promedio: '',
                total: grandTotal.toFixed(2),
                porcentaje: '100.00%'
            });

            const buffer = await excelService.createExcelBuffer({
                sheets: [
                    {
                        name: 'Detalle Movimientos',
                        columns: [
                            { header: 'Fecha', key: 'fecha', width: 15 },
                            { header: 'Turno', key: 'turno', width: 12 },
                            { header: 'Sucursal', key: 'sucursal', width: 22 },
                            { header: 'Código', key: 'codigo', width: 14 },
                            { header: 'Descripción', key: 'descripcion', width: 35 },
                            { header: 'Inv. Inicial', key: 'inicial', width: 13 },
                            { header: 'Recarga', key: 'recarga', width: 13 },
                            { header: 'Inv. Final', key: 'final', width: 13 },
                            { header: 'Cant. Vendida', key: 'ventas', width: 15 },
                            { header: 'Precio Unit.', key: 'precio', width: 13 },
                            { header: 'Total ($)', key: 'total', width: 15 }
                        ],
                        data: sheetData
                    },
                    {
                        name: 'Resumen por Producto',
                        columns: [
                            { header: 'Código', key: 'codigo', width: 14 },
                            { header: 'Descripción', key: 'descripcion', width: 35 },
                            { header: 'Unidades Vendidas', key: 'unidades', width: 18 },
                            { header: 'Precio Promedio ($)', key: 'precio_promedio', width: 20 },
                            { header: 'Monto Total ($)', key: 'total', width: 16 },
                            { header: '% Participación', key: 'porcentaje', width: 16 }
                        ],
                        data: summarySheetData
                    }
                ]
            });
            return excelService.sendExcelResponse(res, buffer, `Lubricantes_Vendidos_${start_date}_al_${end_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateLubricantsSoldPDF({
            company: companyInfo,
            company_id: companyId,
            branch_name: branchName,
            start_date,
            end_date,
            grouped,
            summaryList,
            grandUnits,
            grandTotal,
            totalItemsCount: rows.length
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Lubricantes_Vendidos_${start_date}_al_${end_date}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en getLubricantsSoldPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de lubricantes vendidos' });
    }
};


