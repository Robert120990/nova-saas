const pool = require('../../config/db');
const { dteValidoExistsSql, dteLatestColSql } = require('../../services/dteQueryFilters');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const excelService = require('../../services/excel.service');
const { generateDetailedStatementPDF, formatAmountInWords } = require('../../services/pdf/detailedStatementPdf.service');

/**
 * Checks gas station configuration to see if closeout credits affect CXC.
 */
const getCreditosAfectanCxcConfig = async (companyId, branchId) => {
    try {
        const [rows] = await pool.query(
            `SELECT setting_key, setting_value FROM gas_station_settings
             WHERE company_id = ? AND (branch_id = ? OR branch_id IS NULL)
               AND setting_key IN ('creditos_afectan_cxc', 'creditos_afectan_cxc_desde')
             ORDER BY (branch_id = ?) DESC`,
            [companyId, branchId, branchId]
        );
        const active = rows.find(r => r.setting_key === 'creditos_afectan_cxc')?.setting_value === '1';
        const desdeFecha = rows.find(r => r.setting_key === 'creditos_afectan_cxc_desde')?.setting_value || null;
        return { active, desdeFecha };
    } catch (err) {
        console.error('Error fetching gas station creditos_afectan_cxc config:', err);
        return { active: false, desdeFecha: null };
    }
};

/**
 * Exports Detailed Customer Statement (Estado de Cuenta Detallado) in PDF or Excel.
 * Only includes movements within the specified date range (no initial balance).
 */
const exportDetailedStatementPDF = async (req, res) => {
    const { customer_id, branch_id, start_date, end_date, startDate, endDate, format } = req.query;
    const fromDate = (start_date || startDate || '').trim() || null;
    const toDate = (end_date || endDate || '').trim() || null;
    const company_id = req.company_id;

    if (!customer_id || !branch_id) {
        return res.status(400).json({ message: 'Cliente y Sucursal son obligatorios' });
    }

    try {
        const comp = await reportPdfHelper.getCompanyInfo(company_id);
        const [branchRows] = await pool.query('SELECT nombre FROM branches WHERE id = ? AND company_id = ?', [branch_id, company_id]);
        const [customerRows] = await pool.query(
            'SELECT nombre, correo, nit, nrc, numero_documento, telefono FROM customers WHERE id = ? AND company_id = ?',
            [customer_id, company_id]
        );

        if (!customerRows.length) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        const customer = customerRows[0];
        const branchName = branchRows[0]?.nombre || 'Sucursal Principal';

        const { active: gasActive, desdeFecha } = await getCreditosAfectanCxcConfig(company_id, branch_id);

        // 1. Invoiced Credit Sales Items
        let salesSql = `
            SELECT 
                h.id as sale_id,
                h.fecha_emision as fecha,
                COALESCE(${dteLatestColSql('h', 'numero_control')}, CAST(h.id AS CHAR)) as documento,
                CASE h.tipo_documento 
                    WHEN '01' THEN 'FAC'
                    WHEN '03' THEN 'CCF'
                    WHEN '04' THEN 'NR'
                    WHEN '05' THEN 'NC'
                    WHEN '06' THEN 'ND'
                    WHEN '11' THEN 'FEX'
                    WHEN '14' THEN 'FSE'
                    ELSE COALESCE(cat.description, h.tipo_documento)
                END as tipo,
                i.descripcion as producto,
                COALESCE(NULLIF(h.vehicle_plate, ''), '—') as placas,
                '0.00' as odometro,
                ROUND(COALESCE(i.cantidad * i.precio_unitario, i.venta_gravada + i.venta_exenta), 2) as valor,
                0 as abono
            FROM sales_headers h
            JOIN sales_items i ON h.id = i.sale_id
            LEFT JOIN cat_002_tipo_dte cat ON h.tipo_documento = cat.code
            WHERE h.company_id = ? AND h.branch_id = ? AND h.customer_id = ? 
              AND (h.payment_condition = 2 OR h.condicion_operacion = 2)
              AND h.estado != 'ANULADO'
              AND ${dteValidoExistsSql('h')}
        `;
        const salesParams = [company_id, branch_id, customer_id];

        if (fromDate) {
            salesSql += ' AND h.fecha_emision >= ?';
            salesParams.push(fromDate);
        }
        if (toDate) {
            salesSql += ' AND h.fecha_emision <= ?';
            salesParams.push(toDate);
        }

        const [salesRows] = await pool.query(salesSql, salesParams);

        // 2. Gas Station Closeout Credits (if active for this branch)
        let gasRows = [];
        if (gasActive) {
            let gasSql = `
                SELECT 
                    c.fecha_turno as fecha,
                    COALESCE(NULLIF(gcc.documento, ''), CAST(gcc.id AS CHAR)) as documento,
                    COALESCE(NULLIF(gcc.tipo_documento, ''), 'CCF') as tipo,
                    COALESCE(NULLIF(gcc.producto_descripcion, ''), 'COMBUSTIBLE') as producto,
                    COALESCE(NULLIF(gcc.placa, ''), '—') as placas,
                    COALESCE(NULLIF(gcc.kilometraje, ''), '0.00') as odometro,
                    CAST(gcc.monto AS DECIMAL(12,2)) as valor,
                    0 as abono
                FROM gas_station_closeout_creditos gcc
                JOIN gas_station_closeouts c ON gcc.closeout_id = c.id
                WHERE c.company_id = ? AND c.branch_id = ? AND gcc.cliente_id = ?
            `;
            const gasParams = [company_id, branch_id, customer_id];

            if (desdeFecha) {
                gasSql += ' AND c.fecha_turno >= ?';
                gasParams.push(desdeFecha);
            }
            if (fromDate) {
                gasSql += ' AND c.fecha_turno >= ?';
                gasParams.push(fromDate);
            }
            if (toDate) {
                gasSql += ' AND c.fecha_turno <= ?';
                gasParams.push(toDate);
            }

            const [gRows] = await pool.query(gasSql, gasParams);
            gasRows = gRows;
        }

        // 3. Customer Payments (Abonos)
        let paymentsSql = `
            SELECT 
                p.fecha_pago as fecha,
                COALESCE(NULLIF(p.referencia, ''), CONCAT('REC-', p.id)) as documento,
                'RECIBO' as tipo,
                CONCAT('ABONO A CUENTA', CASE WHEN p.metodo_pago THEN CONCAT(' (', p.metodo_pago, ')') ELSE '' END) as producto,
                '—' as placas,
                '—' as odometro,
                0 as valor,
                CAST(p.monto AS DECIMAL(12,2)) as abono
            FROM customer_payments p
            WHERE p.company_id = ? AND p.branch_id = ? AND p.customer_id = ?
              AND (
                  p.gas_credito_id IS NULL OR (
                      ? = 1 AND EXISTS (
                          SELECT 1 FROM gas_station_closeout_creditos gcc2
                          JOIN gas_station_closeouts c2 ON gcc2.closeout_id = c2.id
                          WHERE gcc2.id = p.gas_credito_id
                          ${desdeFecha ? 'AND c2.fecha_turno >= ?' : ''}
                      )
                  )
              )
        `;
        const paymentParams = [
            company_id, branch_id, customer_id,
            gasActive ? 1 : 0,
            ...(gasActive && desdeFecha ? [desdeFecha] : [])
        ];

        if (fromDate) {
            paymentsSql += ' AND p.fecha_pago >= ?';
            paymentParams.push(fromDate);
        }
        if (toDate) {
            paymentsSql += ' AND p.fecha_pago <= ?';
            paymentParams.push(toDate);
        }

        const [paymentRows] = await pool.query(paymentsSql, paymentParams);

        // 4. Combine and sort
        const combined = [...salesRows, ...gasRows, ...paymentRows].sort((a, b) => {
            const da = new Date(a.fecha).getTime();
            const db = new Date(b.fecha).getTime();
            if (da !== db) return da - db;
            return String(a.documento).localeCompare(String(b.documento));
        });

        // 5. Map calculations
        let totalValor = 0;
        let totalAbono = 0;

        const movements = combined.map(item => {
            const valor = parseFloat(item.valor) || 0;
            const abono = parseFloat(item.abono) || 0;
            const acumulado = valor - abono;
            totalValor += valor;
            totalAbono += abono;
            return {
                ...item,
                valor,
                abono,
                acumulado
            };
        });

        const totalAcumulado = totalValor - totalAbono;

        // 6. Handle Excel Export
        if (format === 'excel' || req.query.format === 'excel') {
            const cleanCustName = (customer.nombre || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
            const buffer = await excelService.createExcelBuffer({
                title: `ESTADO DE CUENTA DETALLADO - ${(customer.nombre || '').toUpperCase()}`,
                subtitle: (fromDate && toDate) ? `PERÍODO DEL ${fromDate} AL ${toDate}` : undefined,
                sheets: [{
                    name: 'Estado de Cuenta Detallado',
                    columns: [
                        { header: 'Fecha', key: 'fecha', width: 14 },
                        { header: 'Documento', key: 'documento', width: 18 },
                        { header: 'Tipo', key: 'tipo', width: 12 },
                        { header: 'Producto', key: 'producto', width: 34 },
                        { header: 'Placas', key: 'placas', width: 16 },
                        { header: 'Odómetro', key: 'odometro', width: 14 },
                        { header: 'Valor', key: 'valor', width: 16 },
                        { header: 'Abono', key: 'abono', width: 16 },
                        { header: 'Acumulado', key: 'acumulado', width: 16 }
                    ],
                    data: [
                        ...movements.map(m => ({
                            fecha: reportPdfHelper.formatDate(m.fecha),
                            documento: m.documento,
                            tipo: m.tipo,
                            producto: m.producto,
                            placas: m.placas,
                            odometro: m.odometro,
                            valor: m.valor,
                            abono: m.abono,
                            acumulado: m.acumulado
                        })),
                        {
                            fecha: '',
                            documento: '',
                            tipo: '',
                            producto: 'TOTAL VALORES',
                            placas: '',
                            odometro: '',
                            valor: totalValor,
                            abono: totalAbono,
                            acumulado: totalAcumulado
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Estado_Cuenta_Detallado_${cleanCustName}.xlsx`);
        }

        // 7. Handle PDF Generation
        const pdfData = {
            company: comp,
            branch_name: branchName,
            customer_name: customer.nombre,
            customer_email: customer.correo,
            customer_nit: customer.nit || customer.numero_documento,
            customer_nrc: customer.nrc,
            customer_phone: customer.telefono,
            startDate: fromDate,
            endDate: toDate,
            movements,
            totalAcumulado
        };

        const pdfBuffer = await generateDetailedStatementPDF(pdfData);
        const cleanName = (customer.nombre || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Estado_Cuenta_Detallado_${cleanName}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error in exportDetailedStatementPDF:', error);
        res.status(500).json({ message: 'Error al generar estado de cuenta detallado', error: error.message });
    }
};

module.exports = {
    exportDetailedStatementPDF,
    getCreditosAfectanCxcConfig
};
