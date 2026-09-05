const pool = require('../config/db');
const pdfService = require('../services/pdf.service');
const excelService = require('../services/excel.service');

const getSalesSetting = async (companyId, branchId, key) => {
    const [rows] = await pool.query(
        `SELECT setting_value FROM sales_settings
         WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
         AND setting_key = ?`,
        [companyId, branchId || null, branchId || null, key]
    );
    return rows[0]?.setting_value || null;
};

/**
 * Obtiene los IDs de los puntos de venta configurados como Tienda
 */
const getPuntosVentaTienda = async (companyId, branchId) => {
    let posIds = [];

    if (branchId && branchId !== 'all') {
        const raw = await getSalesSetting(companyId, branchId, 'puntos_venta_tienda');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    posIds = parsed.map(Number).filter(id => !isNaN(id) && id > 0);
                }
            } catch (e) {
                posIds = [];
            }
        }
        // Si no hay configuración explícita para la sucursal, buscar fallback por nombre
        if (posIds.length === 0) {
            const [fallbackRows] = await pool.query(
                `SELECT id FROM points_of_sale 
                 WHERE company_id = ? AND branch_id = ? 
                 AND (LOWER(nombre) LIKE '%tienda%' OR LOWER(nombre) LIKE '%super%')`,
                [companyId, branchId]
            );
            posIds = fallbackRows.map(r => r.id);
        }
    } else {
        // Todas las sucursales: leer todas las configuraciones de la empresa
        const [settingsRows] = await pool.query(
            `SELECT setting_value FROM sales_settings 
             WHERE company_id = ? AND setting_key = 'puntos_venta_tienda'`,
            [companyId]
        );
        for (const s of settingsRows) {
            try {
                const parsed = JSON.parse(s.setting_value);
                if (Array.isArray(parsed)) {
                    posIds.push(...parsed.map(Number).filter(id => !isNaN(id) && id > 0));
                }
            } catch (e) {}
        }
        // Fallback si no hay ninguna configuración
        if (posIds.length === 0) {
            const [fallbackRows] = await pool.query(
                `SELECT id FROM points_of_sale 
                 WHERE company_id = ? 
                 AND (LOWER(nombre) LIKE '%tienda%' OR LOWER(nombre) LIKE '%super%')`,
                [companyId]
            );
            posIds = fallbackRows.map(r => r.id);
        }
    }

    return [...new Set(posIds)];
};

/**
 * Formato de fecha DD/MM/YYYY
 */
const formatDDMMYYYY = (dateStr) => {
    if (!dateStr) return '---';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Procesa y obtiene la información de rentabilidad de tienda
 */
const fetchStoreProfitabilityData = async ({ companyId, branchId, startDate, endDate }) => {
    // 1. Datos de empresa y sucursal
    const [companies] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
    const company = companies[0] || { razon_social: 'EMPRESA' };

    let branchName = 'Todas las sucursales';
    if (branchId && branchId !== 'all') {
        const [branches] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branchId]);
        branchName = branches[0]?.nombre || '---';
    }

    // 2. Puntos de venta de tienda
    const posTiendaIds = await getPuntosVentaTienda(companyId, branchId);

    if (posTiendaIds.length === 0) {
        return {
            company_name: company.razon_social,
            company_nit: company.nit,
            branch_name: branchName,
            startDateFormatted: formatDDMMYYYY(startDate),
            endDateFormatted: formatDDMMYYYY(endDate),
            items: [],
            totals: {
                cantidad: 0,
                costoTotal: 0,
                totalVenta: 0,
                ganancia: 0,
                rentabilidadPorcentaje: 0
            },
            posTiendaCount: 0,
            posTiendaIds: []
        };
    }

    // 3. Consulta de ventas agrupada por producto
    let whereClauses = [
        'sh.company_id = ?',
        "LOWER(sh.estado) = 'emitido'",
        'NOT EXISTS (SELECT 1 FROM dtes d WHERE d.venta_id = sh.id AND d.status = \'INVALIDADO\')',
        'DATE(sh.fecha_emision) BETWEEN ? AND ?',
        'sh.pos_id IN (?)'
    ];
    let params = [companyId, startDate, endDate, posTiendaIds];

    if (branchId && branchId !== 'all') {
        whereClauses.push('sh.branch_id = ?');
        params.push(branchId);
    }

    const query = `
        SELECT 
            COALESCE(p.codigo, si.codigo, '---') AS codigo,
            COALESCE(p.nombre, si.descripcion, 'PRODUCTO S/N') AS descripcion,
            COALESCE(c.name, 'SIN CATEGORIA') AS categoria,
            COALESCE(p.costo, 0) AS costo,
            SUM(si.cantidad) AS cantidad,
            SUM(si.cantidad * si.precio_unitario - COALESCE(si.monto_descuento, 0)) AS total_venta
        FROM sales_headers sh
        JOIN sales_items si ON sh.id = si.sale_id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE ${whereClauses.join(' AND ')}
        GROUP BY 
            COALESCE(p.id, si.product_id, si.codigo), 
            COALESCE(p.codigo, si.codigo), 
            COALESCE(p.nombre, si.descripcion), 
            COALESCE(c.name, 'SIN CATEGORIA'), 
            p.costo
        ORDER BY categoria ASC, descripcion ASC
    `;

    const [rows] = await pool.query(query, params);

    let totalCantidad = 0;
    let totalCosto = 0;
    let totalVenta = 0;
    let totalGanancia = 0;

    const items = rows.map(r => {
        const cant = parseFloat(r.cantidad || 0);
        const costo = parseFloat(r.costo || 0);
        const venta = parseFloat(r.total_venta || 0);
        const precio = cant > 0 ? (venta / cant) : 0;
        const hasCost = costo > 0;

        let costoTotal = null;
        let ganancia = null;
        let rentabilidadUnitaria = null;
        let rentabilidadPorcentaje = 0;

        if (hasCost) {
            costoTotal = cant * costo;
            ganancia = venta - costoTotal;
            rentabilidadUnitaria = cant > 0 ? (ganancia / cant) : 0;
            rentabilidadPorcentaje = costoTotal > 0 ? ((ganancia / costoTotal) * 100) : 0;

            totalCosto += costoTotal;
            totalGanancia += ganancia;
        }

        totalCantidad += cant;
        totalVenta += venta;

        return {
            codigo: r.codigo,
            descripcion: r.descripcion,
            categoria: r.categoria,
            costo: hasCost ? costo : null,
            precio: precio,
            cantidad: cant,
            hasCost: hasCost,
            rentabilidadUnitaria: rentabilidadUnitaria,
            rentabilidadPorcentaje: rentabilidadPorcentaje,
            costoTotal: costoTotal,
            totalVenta: venta,
            ganancia: ganancia
        };
    });

    const rentabilidadGeneralPorcentaje = totalCosto > 0 ? ((totalGanancia / totalCosto) * 100) : 0;

    return {
        company_name: company.razon_social,
        company_nit: company.nit,
        branch_name: branchName,
        startDateFormatted: formatDDMMYYYY(startDate),
        endDateFormatted: formatDDMMYYYY(endDate),
        items,
        totals: {
            cantidad: totalCantidad,
            costoTotal: totalCosto,
            totalVenta: totalVenta,
            ganancia: totalGanancia,
            rentabilidadPorcentaje: rentabilidadGeneralPorcentaje
        },
        posTiendaCount: posTiendaIds.length,
        posTiendaIds
    };
};

/**
 * GET /api/sales/reports/store-profitability
 */
exports.getStoreProfitabilityData = async (req, res) => {
    try {
        const { start_date, end_date, branch_id } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Debe especificar start_date y end_date' });
        }

        const reportData = await fetchStoreProfitabilityData({
            companyId,
            branchId: branch_id || req.user?.branch_id || 'all',
            startDate: start_date,
            endDate: end_date
        });

        res.json(reportData);
    } catch (error) {
        console.error('Error in getStoreProfitabilityData:', error);
        res.status(500).json({ message: 'Error al generar datos de rentabilidad', error: error.message });
    }
};

/**
 * GET /api/sales/reports/store-profitability/pdf
 * Genera el reporte en PDF o Excel (si format=excel)
 */
exports.exportStoreProfitabilityPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, format } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Debe especificar start_date y end_date' });
        }

        const reportData = await fetchStoreProfitabilityData({
            companyId,
            branchId: branch_id || 'all',
            startDate: start_date,
            endDate: end_date
        });

        if (format === 'excel') {
            const excelData = reportData.items.map(item => ({
                CODIGO: item.codigo,
                DESCRIPCION: item.descripcion,
                CATEGORIA: item.categoria,
                COSTO: item.hasCost ? item.costo.toFixed(2) : '-',
                PRECIO: item.precio.toFixed(2),
                CANT: item.cantidad.toFixed(2),
                'RENTABILIDAD ($)': item.hasCost ? item.rentabilidadUnitaria.toFixed(2) : '-',
                'RENTABILIDAD (%)': item.hasCost ? `${item.rentabilidadPorcentaje.toFixed(2)}%` : '0.00%',
                'COSTO TOT': item.hasCost ? item.costoTotal.toFixed(2) : '-',
                VENTAS: item.totalVenta.toFixed(2),
                GANANCIA: item.hasCost ? item.ganancia.toFixed(2) : '-'
            }));

            // Fila de totales
            excelData.push({
                CODIGO: '',
                DESCRIPCION: 'TOTALES GENERALES',
                CATEGORIA: '',
                COSTO: '',
                PRECIO: '',
                CANT: reportData.totals.cantidad.toFixed(2),
                'RENTABILIDAD ($)': '',
                'RENTABILIDAD (%)': `${reportData.totals.rentabilidadPorcentaje.toFixed(2)}%`,
                'COSTO TOT': reportData.totals.costoTotal.toFixed(2),
                VENTAS: reportData.totals.totalVenta.toFixed(2),
                GANANCIA: reportData.totals.ganancia.toFixed(2)
            });

            const buffer = await excelService.createExcelBuffer({
                title: `INFORME DE VENTAS Y RENTABILIDAD TIENDA (${reportData.startDateFormatted} AL ${reportData.endDateFormatted})`,
                sheets: [{
                    name: 'Rentabilidad Tienda',
                    columns: [
                        { header: 'CODIGO', key: 'CODIGO', width: 16 },
                        { header: 'DESCRIPCION', key: 'DESCRIPCION', width: 35 },
                        { header: 'CATEGORIA', key: 'CATEGORIA', width: 22 },
                        { header: 'COSTO', key: 'COSTO', width: 12 },
                        { header: 'PRECIO', key: 'PRECIO', width: 12 },
                        { header: 'CANT.', key: 'CANT', width: 12 },
                        { header: 'RENTABILIDAD ($)', key: 'RENTABILIDAD ($)', width: 16 },
                        { header: 'RENTABILIDAD (%)', key: 'RENTABILIDAD (%)', width: 16 },
                        { header: 'COSTO TOT', key: 'COSTO TOT', width: 14 },
                        { header: 'VENTAS', key: 'VENTAS', width: 14 },
                        { header: 'GANANCIA', key: 'GANANCIA', width: 14 }
                    ],
                    data: excelData
                }]
            });

            return excelService.sendExcelResponse(res, buffer, `Rentabilidad_Tienda_${start_date}_al_${end_date}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateStoreProfitabilityPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Rentabilidad_Tienda_${start_date}_al_${end_date}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportStoreProfitabilityPDF:', error);
        res.status(500).json({ message: 'Error al exportar reporte de rentabilidad', error: error.message });
    }
};
